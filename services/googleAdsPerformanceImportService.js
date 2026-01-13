const { supabaseAdmin } = require('../config/supabase');
const GoogleAdsClient = require('../integrations/googleAdsClient');
const logger = require('../utils/logger');

/**
 * GoogleAdsPerformanceImportService
 * 
 * Imports daily performance metrics from Google Ads API into our campaign_performance table.
 * This enables us to track performance over time and make data-driven optimization decisions.
 */
class GoogleAdsPerformanceImportService {
  /**
   * Import daily metrics from Google Ads for a date range
   * @param {Object} options
   * @param {string} options.customerId - Google Ads customer ID (defaults to env)
   * @param {string} options.dateFrom - Start date (YYYY-MM-DD), defaults to yesterday
   * @param {string} options.dateTo - End date (YYYY-MM-DD), defaults to yesterday
   * @param {number} options.limitCampaigns - Optional limit on number of campaigns to process
   * @returns {Promise<Object>} Import summary
   */
  static async importDailyMetrics({ customerId, dateFrom, dateTo, limitCampaigns } = {}) {
    try {
      const targetCustomerId = customerId || process.env.GOOGLE_ADS_CUSTOMER_ID;
      if (!targetCustomerId) {
        throw new Error('GOOGLE_ADS_CUSTOMER_ID is required');
      }

      // Default to yesterday if no dates provided
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const defaultDate = yesterday.toISOString().slice(0, 10);

      const fromDate = dateFrom || defaultDate;
      const toDate = dateTo || defaultDate;

      logger.info(`📊 Importing Google Ads performance metrics from ${fromDate} to ${toDate}`);

      const customer = await GoogleAdsClient.getCustomer(targetCustomerId);
      if (!customer) {
        throw new Error('Google Ads API client not initialized');
      }

      // Build GAQL query
      // Note: Adapt field names to your Google Ads API version
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          metrics.clicks,
          metrics.impressions,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          segments.date
        FROM campaign
        WHERE segments.date BETWEEN '${fromDate}' AND '${toDate}'
          AND campaign.status != 'REMOVED'
        ${limitCampaigns ? `LIMIT ${limitCampaigns}` : ''}
      `;

      logger.info(`🔍 Executing GAQL query for date range ${fromDate} to ${toDate}`);
      const rows = await customer.query(query);

      if (!rows || rows.length === 0) {
        logger.info('No campaign data found for the specified date range');
        return {
          success: true,
          imported: 0,
          dateRange: { from: fromDate, to: toDate }
        };
      }

      logger.info(`📥 Fetched ${rows.length} campaign performance rows from Google Ads`);

      // Build a map of campaign_id -> segment_id from campaign_logs or lead_segments
      const campaignToSegmentMap = new Map();
      const campaignIds = [...new Set(rows.map(r => String(r.campaign.id)))];
      
      if (campaignIds.length > 0) {
        // Try to resolve segment_id from lead_segments first (most reliable)
        const { data: segments, error: segError } = await supabaseAdmin
          .from('lead_segments')
          .select('id, google_ads_campaign_id')
          .in('google_ads_campaign_id', campaignIds)
          .not('google_ads_campaign_id', 'is', null);

        if (!segError && segments) {
          for (const seg of segments) {
            if (seg.google_ads_campaign_id) {
              campaignToSegmentMap.set(String(seg.google_ads_campaign_id), seg.id);
            }
          }
        }

        // Fallback: try campaign_logs (most recent SUCCESS log per campaign)
        const { data: logs, error: logError } = await supabaseAdmin
          .from('campaign_logs')
          .select('segment_id, google_ads_campaign_id')
          .in('google_ads_campaign_id', campaignIds)
          .eq('status', 'SUCCESS')
          .order('created_at', { ascending: false });

        if (!logError && logs) {
          for (const log of logs) {
            if (log.google_ads_campaign_id && log.segment_id && !campaignToSegmentMap.has(String(log.google_ads_campaign_id))) {
              campaignToSegmentMap.set(String(log.google_ads_campaign_id), log.segment_id);
            }
          }
        }
      }

      // Prepare upsert data
      const performanceRows = [];
      for (const row of rows) {
        const campaignId = String(row.campaign.id);
        const date = row.segments?.date || fromDate;
        const segmentId = campaignToSegmentMap.get(campaignId) || null;

        performanceRows.push({
          google_ads_customer_id: targetCustomerId,
          google_ads_campaign_id: campaignId,
          segment_id: segmentId,
          date: date,
          clicks: row.metrics?.clicks || 0,
          impressions: row.metrics?.impressions || 0,
          cost_micros: row.metrics?.cost_micros || 0,
          conversions: Number(row.metrics?.conversions || 0),
          conv_value: Number(row.metrics?.conversions_value || 0)
        });
      }

      // Upsert into campaign_performance
      // Supabase upsert using the unique constraint
      let imported = 0;
      const batchSize = 100;
      for (let i = 0; i < performanceRows.length; i += batchSize) {
        const batch = performanceRows.slice(i, i + batchSize);
        const { error: upsertError } = await supabaseAdmin
          .from('campaign_performance')
          .upsert(batch, {
            onConflict: 'google_ads_customer_id,google_ads_campaign_id,date',
            ignoreDuplicates: false
          });

        if (upsertError) {
          logger.error(`❌ Error upserting campaign_performance batch ${i / batchSize + 1}:`, upsertError);
          throw upsertError;
        }
        imported += batch.length;
      }

      logger.info(`✅ Successfully imported ${imported} performance records`);

      return {
        success: true,
        imported: imported,
        dateRange: { from: fromDate, to: toDate },
        campaignsProcessed: campaignIds.length
      };
    } catch (error) {
      logger.error('❌ Error importing Google Ads performance metrics:', error);
      return {
        success: false,
        error: error.message || 'Failed to import performance metrics',
        imported: 0
      };
    }
  }
}

module.exports = GoogleAdsPerformanceImportService;

