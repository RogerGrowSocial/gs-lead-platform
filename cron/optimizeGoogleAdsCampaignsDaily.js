'use strict'

const GoogleAdsOptimizationService = require('../services/googleAdsOptimizationService');
const logger = require('../utils/logger');

/**
 * Optimize Google Ads Campaigns Daily Cronjob
 * 
 * Automatisch optimaliseert alle actieve Google Ads campagnes:
 * - Pauzeert keywords met 0 conversies na 100 clicks
 * - Pauzeert ads met CTR < 1% na 1000 impressions
 * - Monitort Quality Scores
 * - Genereert performance alerts
 * 
 * Moet dagelijks draaien (bijv. om 04:00, na budget adjustments)
 */
async function optimizeGoogleAdsCampaignsDaily() {
  try {
    logger.info('🔍 Starting daily Google Ads campaign optimization...');

    // Optimize all active campaigns
    const result = await GoogleAdsOptimizationService.optimizeAllCampaigns();

    logger.info(`✅ Campaign optimization completed:`, {
      campaignsOptimized: result.campaignsOptimized,
      totalCampaigns: result.totalCampaigns
    });

    // Log summary
    if (result.results) {
      const totalPausedKeywords = result.results.reduce((sum, r) => 
        sum + (r.optimizations?.pausedKeywords || 0), 0
      );
      const totalPausedAds = result.results.reduce((sum, r) => 
        sum + (r.optimizations?.pausedAds || 0), 0
      );
      const totalAlerts = result.results.reduce((sum, r) => 
        sum + (r.optimizations?.alerts || 0), 0
      );

      logger.info(`📊 Optimization Summary:`, {
        pausedKeywords: totalPausedKeywords,
        pausedAds: totalPausedAds,
        alerts: totalAlerts
      });
    }

    return result;
  } catch (error) {
    logger.error('❌ Error in optimizeGoogleAdsCampaignsDaily:', error);
    throw error;
  }
}

// If run directly (not as module)
if (require.main === module) {
  optimizeGoogleAdsCampaignsDaily()
    .then(() => {
      console.log('✅ Optimization completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Optimization failed:', error);
      process.exit(1);
    });
}

module.exports = optimizeGoogleAdsCampaignsDaily;

