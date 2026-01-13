const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const GoogleAdsPerformanceImportService = require('../services/googleAdsPerformanceImportService');
const GoogleAdsCampaignOptimizationService = require('../services/googleAdsCampaignOptimizationService');
const GoogleAdsCampaignBuilderService = require('../services/googleAdsCampaignBuilderService');

/**
 * Simple guard: only non-prod or with secret token
 */
function ensureInternalAccess(req, res, next) {
  const isProd = process.env.NODE_ENV === 'production';
  const token = req.query.token;
  const required = process.env.INTERNAL_DASHBOARD_TOKEN;

  if (!isProd) return next();
  if (required && token === required) return next();

  return res.status(404).send('Not found');
}

/**
 * Campaign Cockpit UI
 * Shows aggregated stats, performance, and health for all campaigns
 */
router.get('/internal/campaigns', ensureInternalAccess, async (req, res) => {
  try {
    const customerId = req.query.customerId || process.env.GOOGLE_ADS_CUSTOMER_ID || null;

    // Last N days (default 7, including today)
    const days = Number(req.query.days || 7);
    const now = new Date();
    const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const fromDateStr = fromDate.toISOString().slice(0, 10);
    const fromDateTs = fromDateStr + 'T00:00:00.000Z';

    // 1) Segments with linked Google Ads campaigns
    const { data: segments, error: segError } = await supabaseAdmin
      .from('lead_segments')
      .select('id, name, branch, region, google_ads_campaign_id, target_cpl_eur, min_daily_budget_eur, max_daily_budget_eur')
      .not('google_ads_campaign_id', 'is', null);

    if (segError) throw segError;
    if (!segments || segments.length === 0) {
      return res.render('internal/campaign-cockpit', {
        rows: [],
        meta: { customerId, days, fromDate: fromDateStr }
      });
    }

    const campaignIds = [...new Set(segments.map((s) => s.google_ads_campaign_id).filter(Boolean))];

    // 2) Performance last X days
    const { data: perfRows, error: perfError } = await supabaseAdmin
      .from('campaign_performance')
      .select('google_ads_campaign_id, date, clicks, impressions, cost_micros, conversions, conv_value')
      .in('google_ads_campaign_id', campaignIds)
      .gte('date', fromDateStr);

    if (perfError) throw perfError;

    // 3) Leads last X days
    const { data: leadsRows, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('id, google_ads_campaign_id, created_at')
      .in('google_ads_campaign_id', campaignIds)
      .gte('created_at', fromDateTs);

    if (leadsError) throw leadsError;

    // 4) Last campaign_logs entry per campaign
    const { data: logsRows, error: logsError } = await supabaseAdmin
      .from('campaign_logs')
      .select('id, segment_id, google_ads_campaign_id, status, error_code, error_message, created_at')
      .in('google_ads_campaign_id', campaignIds)
      .order('created_at', { ascending: false });

    if (logsError) throw logsError;

    // ---- Aggregations in JS ----
    const perfByCampaign = new Map();
    for (const row of perfRows || []) {
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

    const leadsByCampaign = new Map();
    for (const row of leadsRows || []) {
      const id = row.google_ads_campaign_id;
      leadsByCampaign.set(id, (leadsByCampaign.get(id) || 0) + 1);
    }

    const lastLogByCampaign = new Map();
    for (const row of logsRows || []) {
      const id = row.google_ads_campaign_id;
      if (!lastLogByCampaign.has(id)) {
        lastLogByCampaign.set(id, row);
      }
    }

    // 5) Build rows for UI
    const rows = segments.map((seg) => {
      const campId = seg.google_ads_campaign_id;
      const perf = perfByCampaign.get(campId) || {
        clicks: 0,
        impressions: 0,
        cost_micros: 0,
        conversions: 0,
        conv_value: 0
      };
      const leadsCount = leadsByCampaign.get(campId) || 0;
      const log = lastLogByCampaign.get(campId) || null;

      const costEur = perf.cost_micros / 1_000_000;
      const cpc = perf.clicks > 0 ? costEur / perf.clicks : null;
      const cpl = leadsCount > 0 ? costEur / leadsCount : null;

      return {
        segmentId: seg.id,
        segmentName: seg.name,
        branch: seg.branch,
        region: seg.region,
        googleAdsCampaignId: campId,
        targetCplEur: seg.target_cpl_eur,
        minDailyBudgetEur: seg.min_daily_budget_eur,
        maxDailyBudgetEur: seg.max_daily_budget_eur,
        stats: {
          impressions: perf.impressions,
          clicks: perf.clicks,
          costEur,
          conversions: perf.conversions,
          convValue: perf.conv_value,
          leads: leadsCount,
          cpc,
          cpl
        },
        lastLog: log
      };
    });

    return res.render('internal/campaign-cockpit', {
      rows,
      meta: { customerId, days, fromDate: fromDateStr }
    });
  } catch (error) {
    logger.error('Error rendering campaign cockpit:', error);
    return res.status(500).send('Internal error');
  }
});

/**
 * Manual performance import trigger (dev/internal only)
 */
router.get('/internal/google-ads/performance/import', ensureInternalAccess, async (req, res) => {
  try {
    const dateFrom = req.query.from;
    const dateTo = req.query.to;
    const customerId = req.query.customerId || process.env.GOOGLE_ADS_CUSTOMER_ID;

    const result = await GoogleAdsPerformanceImportService.importDailyMetrics({
      customerId,
      dateFrom,
      dateTo
    });

    return res.json({
      success: result.success,
      imported: result.imported,
      dateRange: result.dateRange,
      campaignsProcessed: result.campaignsProcessed,
      error: result.error
    });
  } catch (error) {
    logger.error('Error in manual performance import:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to import performance'
    });
  }
});

/**
 * Manual optimization trigger (dev/internal only)
 */
router.get('/internal/google-ads/optimize', ensureInternalAccess, async (req, res) => {
  try {
    const customerId = req.query.customerId || process.env.GOOGLE_ADS_CUSTOMER_ID;
    const dateRangeDays = Number(req.query.days || 7);

    const result = await GoogleAdsCampaignOptimizationService.optimizeCampaigns({
      customerId,
      dateRangeDays
    });

    return res.json({
      success: result.success,
      optimized: result.optimized,
      suggestions: result.suggestions,
      mode: result.mode,
      error: result.error
    });
  } catch (error) {
    logger.error('Error in manual optimization:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to optimize campaigns'
    });
  }
});

module.exports = router;

