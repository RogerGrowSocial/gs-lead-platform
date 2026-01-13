const { supabaseAdmin } = require('../config/supabase');
const GoogleAdsClient = require('../integrations/googleAdsClient');
const logger = require('../utils/logger');

/**
 * GoogleAdsCampaignOptimizationService
 * 
 * Conservative optimization skeleton that can automatically adjust budgets/bids
 * based on performance data. Uses very conservative rules with guardrails.
 * 
 * If GOOGLE_ADS_OPTIMIZATION_ENABLED !== 'true', only computes suggestions
 * and writes them to campaign_optimization_suggestions table.
 */
class GoogleAdsCampaignOptimizationService {
  /**
   * Optimize campaigns based on performance data
   * @param {Object} options
   * @param {string} options.customerId - Google Ads customer ID (defaults to env)
   * @param {number} options.dateRangeDays - Number of days to look back (default 7)
   * @returns {Promise<Object>} Optimization summary
   */
  static async optimizeCampaigns({ customerId, dateRangeDays = 7 } = {}) {
    try {
      const targetCustomerId = customerId || process.env.GOOGLE_ADS_CUSTOMER_ID;
      if (!targetCustomerId) {
        throw new Error('GOOGLE_ADS_CUSTOMER_ID is required');
      }

      const isEnabled = (process.env.GOOGLE_ADS_OPTIMIZATION_ENABLED || 'false').toLowerCase() === 'true';
      const minLeads = Number(process.env.GOOGLE_ADS_OPTIMIZATION_MIN_LEADS || 5);
      const maxChangePct = Number(process.env.GOOGLE_ADS_OPTIMIZATION_MAX_CHANGE_PCT || 0.2); // 20%
      const defaultTargetCpl = Number(process.env.GOOGLE_ADS_DEFAULT_TARGET_CPL_EUR || 25.0);

      logger.info(`🔧 Starting campaign optimization (enabled: ${isEnabled}, dateRange: ${dateRangeDays} days)`);

      // Calculate date range
      const now = new Date();
      const fromDate = new Date(now.getTime() - dateRangeDays * 24 * 60 * 60 * 1000);
      const fromDateStr = fromDate.toISOString().slice(0, 10);

      // Get all active campaigns with performance data
      const { data: segments, error: segError } = await supabaseAdmin
        .from('lead_segments')
        .select('id, name, branch, region, google_ads_campaign_id, target_cpl_eur, min_daily_budget_eur, max_daily_budget_eur')
        .not('google_ads_campaign_id', 'is', null);

      if (segError) throw segError;

      if (!segments || segments.length === 0) {
        logger.info('No segments with Google Ads campaigns found');
        return {
          success: true,
          optimized: 0,
          suggestions: 0
        };
      }

      const campaignIds = segments.map(s => s.google_ads_campaign_id).filter(Boolean);

      // Get aggregated performance for date range
      const { data: performance, error: perfError } = await supabaseAdmin
        .from('campaign_performance')
        .select('google_ads_campaign_id, clicks, impressions, cost_micros, conversions, conv_value')
        .in('google_ads_campaign_id', campaignIds)
        .gte('date', fromDateStr);

      if (perfError) throw perfError;

      // Aggregate performance by campaign
      const perfByCampaign = new Map();
      for (const row of performance || []) {
        const id = row.google_ads_campaign_id;
        if (!perfByCampaign.has(id)) {
          perfByCampaign.set(id, {
            clicks: 0,
            impressions: 0,
            cost_micros: 0,
            conversions: 0,
            conv_value: 0
          });
        }
        const agg = perfByCampaign.get(id);
        agg.clicks += row.clicks || 0;
        agg.impressions += row.impressions || 0;
        agg.cost_micros += row.cost_micros || 0;
        agg.conversions += Number(row.conversions || 0);
        agg.conv_value += Number(row.conv_value || 0);
      }

      // Get leads count per campaign
      const { data: leads, error: leadsError } = await supabaseAdmin
        .from('leads')
        .select('google_ads_campaign_id')
        .in('google_ads_campaign_id', campaignIds)
        .gte('created_at', fromDate.toISOString());

      if (leadsError) throw leadsError;

      const leadsByCampaign = new Map();
      for (const lead of leads || []) {
        if (lead.google_ads_campaign_id) {
          leadsByCampaign.set(lead.google_ads_campaign_id, (leadsByCampaign.get(lead.google_ads_campaign_id) || 0) + 1);
        }
      }

      // Get current campaign budgets from Google Ads
      const customer = await GoogleAdsClient.getCustomer(targetCustomerId);
      if (!customer) {
        throw new Error('Google Ads API client not initialized');
      }

      const budgetQuery = `
        SELECT
          campaign.id,
          campaign.campaign_budget,
          campaign_budget.amount_micros
        FROM campaign
        WHERE campaign.id IN (${campaignIds.join(',')})
          AND campaign.status != 'REMOVED'
      `;

      let budgetRows = [];
      try {
        budgetRows = await customer.query(budgetQuery);
      } catch (budgetError) {
        logger.warn('⚠️ Could not fetch campaign budgets from Google Ads:', budgetError.message);
      }

      const budgetByCampaign = new Map();
      for (const row of budgetRows || []) {
        if (row.campaign?.id && row.campaign_budget?.amount_micros) {
          budgetByCampaign.set(String(row.campaign.id), Number(row.campaign_budget.amount_micros));
        }
      }

      // Process each campaign
      let optimized = 0;
      let suggestions = 0;

      for (const segment of segments) {
        const campaignId = segment.google_ads_campaign_id;
        if (!campaignId) continue;

        const perf = perfByCampaign.get(campaignId) || {
          clicks: 0,
          impressions: 0,
          cost_micros: 0,
          conversions: 0,
          conv_value: 0
        };

        const leadsCount = leadsByCampaign.get(campaignId) || 0;
        const currentBudgetMicros = budgetByCampaign.get(String(campaignId)) || null;

        // Compute metrics
        const costEur = perf.cost_micros / 1_000_000;
        const cpl = leadsCount > 0 ? costEur / leadsCount : null;

        const targetCpl = segment.target_cpl_eur || defaultTargetCpl;
        const minBudget = segment.min_daily_budget_eur || Number(process.env.GOOGLE_ADS_CAMPAIGN_MIN_DAILY_BUDGET || 5);
        const maxBudget = segment.max_daily_budget_eur || Number(process.env.GOOGLE_ADS_CAMPAIGN_MAX_DAILY_BUDGET || 1000);

        // Decision logic
        let changeType = 'NO_CHANGE';
        let suggestedNewBudgetMicros = currentBudgetMicros;
        let reason = '';

        // Guardrail: No activity
        if (perf.impressions === 0 || perf.clicks === 0) {
          changeType = 'NO_CHANGE';
          reason = `No activity (${perf.impressions} impressions, ${perf.clicks} clicks) - manual review recommended`;
        }
        // Guardrail: Not enough leads for statistical significance
        else if (leadsCount < minLeads) {
          changeType = 'NO_CHANGE';
          reason = `Insufficient leads (${leadsCount} < ${minLeads} minimum) - need more data`;
        }
        // Optimization: CPL below target → consider increasing budget
        else if (cpl && cpl < 0.7 * targetCpl) {
          if (currentBudgetMicros) {
            const increase = Math.round(currentBudgetMicros * maxChangePct);
            const newBudget = currentBudgetMicros + increase;
            const newBudgetEur = newBudget / 1_000_000;

            if (newBudgetEur <= maxBudget) {
              changeType = 'BUDGET_INCREASE';
              suggestedNewBudgetMicros = newBudget;
              reason = `CPL €${cpl.toFixed(2)} < target €${targetCpl.toFixed(2)} (${((cpl / targetCpl) * 100).toFixed(1)}%) - increase budget by ${(maxChangePct * 100).toFixed(0)}%`;
            } else {
              changeType = 'NO_CHANGE';
              reason = `CPL below target but new budget (€${newBudgetEur.toFixed(2)}) would exceed max (€${maxBudget.toFixed(2)})`;
            }
          }
        }
        // Optimization: CPL above target → consider decreasing budget
        else if (cpl && cpl > 1.3 * targetCpl) {
          if (currentBudgetMicros) {
            const decrease = Math.round(currentBudgetMicros * maxChangePct);
            const newBudget = currentBudgetMicros - decrease;
            const newBudgetEur = newBudget / 1_000_000;

            if (newBudgetEur >= minBudget) {
              changeType = 'BUDGET_DECREASE';
              suggestedNewBudgetMicros = newBudget;
              reason = `CPL €${cpl.toFixed(2)} > target €${targetCpl.toFixed(2)} (${((cpl / targetCpl) * 100).toFixed(1)}%) - decrease budget by ${(maxChangePct * 100).toFixed(0)}%`;
            } else {
              changeType = 'NO_CHANGE';
              reason = `CPL above target but new budget (€${newBudgetEur.toFixed(2)}) would be below min (€${minBudget.toFixed(2)})`;
            }
          }
        } else {
          changeType = 'NO_CHANGE';
          reason = `CPL €${cpl ? cpl.toFixed(2) : 'N/A'} is within acceptable range of target €${targetCpl.toFixed(2)}`;
        }

        // Apply or suggest
        if (changeType !== 'NO_CHANGE' && suggestedNewBudgetMicros && currentBudgetMicros) {
          if (isEnabled) {
            // Apply the change via Google Ads API
            try {
              const budgetResourceName = budgetRows.find(r => String(r.campaign?.id) === String(campaignId))?.campaign?.campaign_budget;
              if (budgetResourceName) {
                // Google Ads API expects a single object, not an array
                await customer.campaignBudgets.update({
                  resource_name: budgetResourceName,
                  amount_micros: suggestedNewBudgetMicros,
                  delivery_method: 'STANDARD'
                });

                logger.info(`✅ Updated budget for campaign ${campaignId}: €${(currentBudgetMicros / 1_000_000).toFixed(2)} → €${(suggestedNewBudgetMicros / 1_000_000).toFixed(2)} (${reason})`);
                optimized++;
              }
            } catch (updateError) {
              logger.error(`❌ Failed to update budget for campaign ${campaignId}:`, updateError.message);
            }
          } else {
            // Write suggestion
            await supabaseAdmin
              .from('campaign_optimization_suggestions')
              .insert({
                segment_id: segment.id,
                google_ads_campaign_id: campaignId,
                suggested_change_type: changeType,
                suggested_new_budget_micros: suggestedNewBudgetMicros,
                current_budget_micros: currentBudgetMicros,
                reason: reason,
                cpl_eur: cpl,
                target_cpl_eur: targetCpl,
                leads_count: leadsCount
              });
            suggestions++;
            logger.info(`💡 Suggestion for campaign ${campaignId}: ${changeType} - ${reason}`);
          }
        }
      }

      return {
        success: true,
        optimized: isEnabled ? optimized : 0,
        suggestions: isEnabled ? 0 : suggestions,
        mode: isEnabled ? 'auto' : 'suggestions_only'
      };
    } catch (error) {
      logger.error('❌ Error optimizing campaigns:', error);
      return {
        success: false,
        error: error.message || 'Failed to optimize campaigns',
        optimized: 0,
        suggestions: 0
      };
    }
  }
}

module.exports = GoogleAdsCampaignOptimizationService;

