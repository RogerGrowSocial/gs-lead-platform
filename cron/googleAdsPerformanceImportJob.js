const cron = require('node-cron');
const GoogleAdsPerformanceImportService = require('../services/googleAdsPerformanceImportService');
const logger = require('../utils/logger') || console;

/**
 * Google Ads Performance Import Cron Job
 * 
 * Imports daily performance metrics from Google Ads API into campaign_performance table.
 * Runs daily at 02:00 AM (after midnight, before demand planning).
 */
cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('📊 Starting daily Google Ads performance import...');
    
    // Import yesterday's data
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    
    const result = await GoogleAdsPerformanceImportService.importDailyMetrics({
      dateFrom: dateStr,
      dateTo: dateStr
    });
    
    if (result.success) {
      logger.info(`✅ Performance import completed: ${result.imported} records imported for ${dateStr}`);
    } else {
      logger.error(`❌ Performance import failed: ${result.error}`);
    }
  } catch (error) {
    logger.error('❌ Error in Google Ads performance import cron job:', error);
  }
}, {
  timezone: 'Europe/Amsterdam'
});

logger.info('📊 Google Ads performance import cron job scheduled (daily at 02:00 AM)');

