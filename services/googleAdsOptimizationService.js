const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const GoogleAdsClient = require('../integrations/googleAdsClient');

/**
 * GoogleAdsOptimizationService
 * 
 * Next-level automatische optimalisatie van Google Ads campagnes:
 * - Performance monitoring & auto-optimization
 * - Quality Score tracking & improvement
 * - Keyword/Ad performance analysis
 * - Automatic pausing of underperforming keywords/ads
 * 
 * Best practices 2025/2026:
 * - Automatisch pauzeren van keywords met 0 conversies na 100 clicks
 * - Automatisch pauzeren van ads met CTR < 1% na 1000 impressions
 * - Quality Score monitoring en alerts
 * - Performance-based bid adjustments
 */
class GoogleAdsOptimizationService {
  // Performance thresholds
  static PERFORMANCE_THRESHOLDS = {
    KEYWORD_MIN_CLICKS: 100,
    KEYWORD_MIN_CONVERSIONS: 1,
    AD_MIN_IMPRESSIONS: 1000,
    AD_MIN_CTR: 0.01, // 1%
    QUALITY_SCORE_MIN: 5,
    MAX_COST_PER_CLICK: 5.00, // EUR
    MAX_COST_PER_CONVERSION: 100.00 // EUR
  };

  /**
   * Analyze and optimize campaign performance
   * @param {string} campaignId - Campaign ID
   * @param {string} customerId - Optional customer ID
   * @param {Date} startDate - Start date for analysis
   * @param {Date} endDate - End date for analysis
   * @returns {Promise<Object>} Optimization results
   */
  static async optimizeCampaign(campaignId, customerId = null, startDate = null, endDate = null) {
    try {
      const customer = await GoogleAdsClient.getCustomer(customerId);
      if (!customer) {
        throw new Error('Google Ads API client not initialized');
      }

      const targetCustomerId = customerId || GoogleAdsClient.customerId;
      
      // Default to last 30 days if not specified
      if (!startDate) {
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
      }

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      logger.info(`🔍 Analyzing campaign ${campaignId} from ${startDateStr} to ${endDateStr}`);

      // 1. Get keyword performance
      const keywordPerformance = await this.getKeywordPerformance(
        customer,
        campaignId,
        targetCustomerId,
        startDateStr,
        endDateStr
      );

      // 2. Get ad performance
      const adPerformance = await this.getAdPerformance(
        customer,
        campaignId,
        targetCustomerId,
        startDateStr,
        endDateStr
      );

      // 3. Get Quality Scores
      const qualityScores = await this.getQualityScores(
        customer,
        campaignId,
        targetCustomerId
      );

      // 4. Analyze and generate recommendations
      const recommendations = this.analyzePerformance(
        keywordPerformance,
        adPerformance,
        qualityScores
      );

      // 5. Apply optimizations
      const optimizations = await this.applyOptimizations(
        customer,
        campaignId,
        recommendations,
        targetCustomerId
      );

      // 6. Log results
      await this.logOptimizationResults(campaignId, recommendations, optimizations);

      return {
        success: true,
        campaignId: campaignId,
        period: { startDate: startDateStr, endDate: endDateStr },
        keywordPerformance: keywordPerformance,
        adPerformance: adPerformance,
        qualityScores: qualityScores,
        recommendations: recommendations,
        optimizations: optimizations,
        message: 'Campaign optimization completed'
      };
    } catch (error) {
      logger.error('❌ Error optimizing campaign:', error);
      return {
        success: false,
        error: error.message || 'Failed to optimize campaign'
      };
    }
  }

  /**
   * Get keyword performance metrics
   */
  static async getKeywordPerformance(customer, campaignId, customerId, startDate, endDate) {
    try {
      const query = `
        SELECT
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.quality_info.quality_score,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversion_value,
          ad_group_criterion.status
        FROM keyword_view
        WHERE campaign.id = ${campaignId}
          AND segments.date BETWEEN '${startDate}' AND '${endDate}'
          AND ad_group_criterion.type = 'KEYWORD'
      `;

      const results = await customer.query(query);

      return results.map(row => ({
        keyword: row.ad_group_criterion.keyword.text,
        matchType: row.ad_group_criterion.keyword.match_type,
        qualityScore: row.ad_group_criterion.quality_info?.quality_score || 0,
        impressions: row.metrics?.impressions || 0,
        clicks: row.metrics?.clicks || 0,
        cost: (row.metrics?.cost_micros || 0) / 1000000,
        conversions: row.metrics?.conversions || 0,
        conversionValue: (row.metrics?.conversion_value || 0) / 1000000,
        status: row.ad_group_criterion.status,
        ctr: row.metrics?.clicks && row.metrics?.impressions 
          ? (row.metrics.clicks / row.metrics.impressions) 
          : 0,
        cpc: row.metrics?.clicks && row.metrics?.cost_micros
          ? ((row.metrics.cost_micros / 1000000) / row.metrics.clicks)
          : 0,
        cpa: row.metrics?.conversions && row.metrics?.cost_micros
          ? ((row.metrics.cost_micros / 1000000) / row.metrics.conversions)
          : null
      }));
    } catch (error) {
      logger.error('Error getting keyword performance:', error);
      return [];
    }
  }

  /**
   * Get ad performance metrics
   */
  static async getAdPerformance(customer, campaignId, customerId, startDate, endDate) {
    try {
      const query = `
        SELECT
          ad_group_ad.ad.id,
          ad_group_ad.ad.type,
          ad_group_ad.ad.responsive_search_ad.headlines,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          ad_group_ad.status
        FROM ad_group_ad
        WHERE campaign.id = ${campaignId}
          AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      `;

      const results = await customer.query(query);

      return results.map(row => ({
        adId: row.ad_group_ad.ad.id,
        adType: row.ad_group_ad.ad.type,
        impressions: row.metrics?.impressions || 0,
        clicks: row.metrics?.clicks || 0,
        cost: (row.metrics?.cost_micros || 0) / 1000000,
        conversions: row.metrics?.conversions || 0,
        status: row.ad_group_ad.status,
        ctr: row.metrics?.clicks && row.metrics?.impressions 
          ? (row.metrics.clicks / row.metrics.impressions) 
          : 0
      }));
    } catch (error) {
      logger.error('Error getting ad performance:', error);
      return [];
    }
  }

  /**
   * Get Quality Scores for keywords
   */
  static async getQualityScores(customer, campaignId, customerId) {
    try {
      const query = `
        SELECT
          ad_group_criterion.keyword.text,
          ad_group_criterion.quality_info.quality_score,
          ad_group_criterion.quality_info.creative_quality_score,
          ad_group_criterion.quality_info.post_click_quality_score,
          ad_group_criterion.quality_info.search_predicted_ctr
        FROM keyword_view
        WHERE campaign.id = ${campaignId}
          AND ad_group_criterion.type = 'KEYWORD'
      `;

      const results = await customer.query(query);

      return results.map(row => ({
        keyword: row.ad_group_criterion.keyword.text,
        qualityScore: row.ad_group_criterion.quality_info?.quality_score || 0,
        creativeQuality: row.ad_group_criterion.quality_info?.creative_quality_score || 'UNKNOWN',
        postClickQuality: row.ad_group_criterion.quality_info?.post_click_quality_score || 'UNKNOWN',
        predictedCtr: row.ad_group_criterion.quality_info?.search_predicted_ctr || 'UNKNOWN'
      }));
    } catch (error) {
      logger.error('Error getting quality scores:', error);
      return [];
    }
  }

  /**
   * Analyze performance and generate recommendations
   */
  static analyzePerformance(keywordPerformance, adPerformance, qualityScores) {
    const recommendations = {
      pauseKeywords: [],
      pauseAds: [],
      improveQualityScore: [],
      adjustBids: [],
      alerts: []
    };

    // Analyze keywords
    keywordPerformance.forEach(kw => {
      // Rule 1: Pause keywords with 0 conversions after threshold clicks
      if (kw.clicks >= this.PERFORMANCE_THRESHOLDS.KEYWORD_MIN_CLICKS && 
          kw.conversions === 0 && 
          kw.status === 'ENABLED') {
        recommendations.pauseKeywords.push({
          keyword: kw.keyword,
          matchType: kw.matchType,
          reason: `0 conversions after ${kw.clicks} clicks`,
          clicks: kw.clicks,
          cost: kw.cost
        });
      }

      // Rule 2: Alert on high CPC
      if (kw.cpc > this.PERFORMANCE_THRESHOLDS.MAX_COST_PER_CLICK) {
        recommendations.alerts.push({
          type: 'HIGH_CPC',
          keyword: kw.keyword,
          cpc: kw.cpc,
          message: `High CPC: €${kw.cpc.toFixed(2)}`
        });
      }

      // Rule 3: Alert on high CPA
      if (kw.cpa && kw.cpa > this.PERFORMANCE_THRESHOLDS.MAX_COST_PER_CONVERSION) {
        recommendations.alerts.push({
          type: 'HIGH_CPA',
          keyword: kw.keyword,
          cpa: kw.cpa,
          message: `High CPA: €${kw.cpa.toFixed(2)}`
        });
      }
    });

    // Analyze ads
    adPerformance.forEach(ad => {
      // Rule 4: Pause ads with low CTR after threshold impressions
      if (ad.impressions >= this.PERFORMANCE_THRESHOLDS.AD_MIN_IMPRESSIONS &&
          ad.ctr < this.PERFORMANCE_THRESHOLDS.AD_MIN_CTR &&
          ad.status === 'ENABLED') {
        recommendations.pauseAds.push({
          adId: ad.adId,
          adType: ad.adType,
          reason: `Low CTR: ${(ad.ctr * 100).toFixed(2)}% after ${ad.impressions} impressions`,
          impressions: ad.impressions,
          ctr: ad.ctr
        });
      }
    });

    // Analyze Quality Scores
    qualityScores.forEach(qs => {
      // Rule 5: Alert on low Quality Score
      if (qs.qualityScore < this.PERFORMANCE_THRESHOLDS.QUALITY_SCORE_MIN) {
        recommendations.improveQualityScore.push({
          keyword: qs.keyword,
          qualityScore: qs.qualityScore,
          creativeQuality: qs.creativeQuality,
          postClickQuality: qs.postClickQuality,
          predictedCtr: qs.predictedCtr,
          message: `Low Quality Score: ${qs.qualityScore}/10`
        });
      }
    });

    return recommendations;
  }

  /**
   * Apply optimizations (pause keywords/ads, adjust bids, etc.)
   */
  static async applyOptimizations(customer, campaignId, recommendations, customerId) {
    const applied = {
      pausedKeywords: 0,
      pausedAds: 0,
      alerts: recommendations.alerts.length
    };

    try {
      // Pause underperforming keywords
      if (recommendations.pauseKeywords.length > 0) {
        // Note: In production, you'd batch these operations
        for (const kw of recommendations.pauseKeywords.slice(0, 10)) { // Limit to 10 per run
          try {
            // Find keyword criterion resource name
            const query = `
              SELECT ad_group_criterion.resource_name
              FROM keyword_view
              WHERE campaign.id = ${campaignId}
                AND ad_group_criterion.keyword.text = '${kw.keyword.replace(/'/g, "''")}'
                AND ad_group_criterion.type = 'KEYWORD'
            `;
            
            const results = await customer.query(query);
            if (results.length > 0) {
              const resourceName = results[0].ad_group_criterion.resource_name;
              await customer.adGroupCriteria.update({
                resource_name: resourceName,
                status: 'PAUSED'
              });
              applied.pausedKeywords++;
              logger.info(`⏸️ Paused keyword: ${kw.keyword} (${kw.reason})`);
            }
          } catch (error) {
            logger.warn(`⚠️ Could not pause keyword ${kw.keyword}:`, error.message);
          }
        }
      }

      // Pause underperforming ads
      if (recommendations.pauseAds.length > 0) {
        for (const ad of recommendations.pauseAds.slice(0, 10)) { // Limit to 10 per run
          try {
            const adGroupAdResourceName = `customers/${customerId}/adGroupAds/${ad.adId}`;
            await customer.adGroupAds.update({
              resource_name: adGroupAdResourceName,
              status: 'PAUSED'
            });
            applied.pausedAds++;
            logger.info(`⏸️ Paused ad: ${ad.adId} (${ad.reason})`);
          } catch (error) {
            logger.warn(`⚠️ Could not pause ad ${ad.adId}:`, error.message);
          }
        }
      }

      return applied;
    } catch (error) {
      logger.error('Error applying optimizations:', error);
      return applied;
    }
  }

  /**
   * Log optimization results to database
   */
  static async logOptimizationResults(campaignId, recommendations, optimizations) {
    try {
      // Store in a new table or existing logging table
      // For now, just log to console
      logger.info(`📊 Optimization Summary for campaign ${campaignId}:`, {
        pausedKeywords: optimizations.pausedKeywords,
        pausedAds: optimizations.pausedAds,
        alerts: optimizations.alerts,
        totalRecommendations: recommendations.pauseKeywords.length + recommendations.pauseAds.length
      });
    } catch (error) {
      logger.error('Error logging optimization results:', error);
    }
  }

  /**
   * Run optimization for all active campaigns
   */
  static async optimizeAllCampaigns(customerId = null) {
    try {
      const campaigns = await GoogleAdsClient.getActiveCampaigns(customerId);
      const results = [];

      for (const campaign of campaigns.filter(c => c.status === 'ENABLED')) {
        try {
          const result = await this.optimizeCampaign(campaign.id, customerId);
          results.push(result);
        } catch (error) {
          logger.error(`Error optimizing campaign ${campaign.id}:`, error);
          results.push({
            success: false,
            campaignId: campaign.id,
            error: error.message
          });
        }
      }

      return {
        success: true,
        campaignsOptimized: results.filter(r => r.success).length,
        totalCampaigns: campaigns.length,
        results: results
      };
    } catch (error) {
      logger.error('Error optimizing all campaigns:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = GoogleAdsOptimizationService;

