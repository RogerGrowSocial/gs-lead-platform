const { supabaseAdmin } = require('../config/supabase');
const GoogleAdsClient = require('../integrations/googleAdsClient');
const logger = require('../utils/logger');

/**
 * GoogleAdsOfflineConversionService
 *
 * Responsible for uploading offline conversions (form submits, qualified leads, sales)
 * to Google Ads using the ConversionUploadService.
 *
 * This service is designed so it can be scheduled via a cron job later on.
 */
class GoogleAdsOfflineConversionService {
  /**
   * Upload all pending lead_conversions that have a click identifier (gclid/gbraid/wbraid)
   * and haven't been uploaded to Google yet.
   *
   * @param {Object} options
   * @param {number} options.limit - Max number of conversions to upload in one run
   */
  static async uploadPendingConversions(options = {}) {
    const limit = options.limit || 100;

    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    const conversionActionId = process.env.GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID;

    if (!customerId || !conversionActionId) {
      logger.warn('⚠️ Skipping offline conversion upload: GOOGLE_ADS_CUSTOMER_ID or GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID not configured');
      return { success: false, reason: 'MISSING_CONFIG' };
    }

    try {
      // 1) Fetch pending conversions
      const { data: pending, error } = await supabaseAdmin
        .from('lead_conversions')
        .select('*')
        .eq('uploaded_to_google', false)
        .not('gclid', 'is', null)
        .order('occurred_at', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      if (!pending || pending.length === 0) {
        logger.info('No pending offline conversions to upload');
        return { success: true, uploaded: 0 };
      }

      logger.info(`📤 Uploading ${pending.length} offline conversions to Google Ads`);

      const customer = await GoogleAdsClient.getCustomer(customerId);
      if (!customer) {
        throw new Error('Google Ads API client not initialized');
      }

      const conversionActionResourceName = `customers/${customerId}/conversionActions/${conversionActionId}`;

      const conversions = pending.map((row) => {
        const occurredAt = row.occurred_at || row.created_at || new Date().toISOString();
        // Google Ads expects RFC3339 with timezone offset, e.g. 2025-12-04T19:00:00+00:00
        const dateTime = new Date(occurredAt).toISOString().replace('Z', '+00:00');

        return {
          conversion_action: conversionActionResourceName,
          conversion_date_time: dateTime,
          conversion_value: row.value || 0,
          currency_code: row.currency || 'EUR',
          gclid: row.gclid || undefined,
          gbraid: row.gbraid || undefined,
          wbraid: row.wbraid || undefined,
          order_id: row.id // Use our conversion id as order identifier
        };
      });

      const request = {
        customer_id: customerId,
        conversions,
        partial_failure: true,
        validate_only: false
      };

      const response = await customer.conversionUploads.uploadClickConversions(request);

      logger.info('✅ Offline conversions upload response from Google Ads', {
        uploadCnt: conversions.length,
        response
      });

      // 3) Mark conversions as uploaded
      const ids = pending.map((p) => p.id);
      const { error: updateError } = await supabaseAdmin
        .from('lead_conversions')
        .update({
          uploaded_to_google: true,
          uploaded_at: new Date().toISOString()
        })
        .in('id', ids);

      if (updateError) {
        logger.error('Error marking conversions as uploaded in DB:', updateError);
      }

      return {
        success: true,
        uploaded: conversions.length,
        googleResponse: response
      };
    } catch (error) {
      logger.error('❌ Error uploading offline conversions to Google Ads:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload offline conversions'
      };
    }
  }
}

module.exports = GoogleAdsOfflineConversionService;


