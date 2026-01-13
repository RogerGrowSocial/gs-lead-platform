const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * PartnerCampaignService
 * 
 * CRUD operaties voor partner marketing campagnes
 * Sync met externe APIs (Google Ads, Meta, etc.)
 */
class PartnerCampaignService {
  /**
   * Maak nieuwe campagne aan
   */
  static async createCampaign(partnerId, segmentId, channel, config) {
    try {
      const campaign = {
        partner_id: partnerId,
        segment_id: segmentId || null,
        channel: channel,
        external_campaign_id: config.external_campaign_id || null,
        status: config.status || 'planned',
        daily_budget: config.daily_budget || null,
        monthly_budget: config.monthly_budget || null,
        cpl_target: config.cpl_target || null,
        ai_managed: config.ai_managed !== undefined ? config.ai_managed : true
      };
      
      const { data, error } = await supabaseAdmin
        .from('partner_marketing_campaigns')
        .insert(campaign)
        .select()
        .single();
      
      if (error) throw error;
      
      logger.info(`Created campaign ${data.id} for partner ${partnerId}`);
      return data;
      
    } catch (error) {
      logger.error('Error creating campaign:', error);
      throw error;
    }
  }
  
  /**
   * Update campagne budget
   */
  static async updateCampaignBudget(campaignId, newBudget, aiAdjusted = false) {
    try {
      const update = {
        daily_budget: newBudget,
        updated_at: new Date().toISOString()
      };
      
      if (aiAdjusted) {
        update.ai_last_adjusted_at = new Date().toISOString();
      }
      
      const { data, error } = await supabaseAdmin
        .from('partner_marketing_campaigns')
        .update(update)
        .eq('id', campaignId)
        .select()
        .single();
      
      if (error) throw error;
      
      logger.info(`Updated campaign ${campaignId} budget to ${newBudget}`);
      return data;
      
    } catch (error) {
      logger.error('Error updating campaign budget:', error);
      throw error;
    }
  }
  
  /**
   * Pauzeer campagne
   */
  static async pauseCampaign(campaignId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('partner_marketing_campaigns')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId)
        .select()
        .single();
      
      if (error) throw error;
      
      logger.info(`Paused campaign ${campaignId}`);
      return data;
      
    } catch (error) {
      logger.error('Error pausing campaign:', error);
      throw error;
    }
  }
  
  /**
   * Activeer campagne
   */
  static async activateCampaign(campaignId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('partner_marketing_campaigns')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId)
        .select()
        .single();
      
      if (error) throw error;
      
      logger.info(`Activated campaign ${campaignId}`);
      return data;
      
    } catch (error) {
      logger.error('Error activating campaign:', error);
      throw error;
    }
  }
  
  /**
   * Haal campagnes op voor partner
   */
  static async getPartnerCampaigns(partnerId, filters = {}) {
    try {
      let query = supabaseAdmin
        .from('partner_marketing_campaigns')
        .select(`
          *,
          lead_segments (code, branch, region)
        `)
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      
      if (filters.segment_id) {
        query = query.eq('segment_id', filters.segment_id);
      }
      if (filters.channel) {
        query = query.eq('channel', filters.channel);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
      
    } catch (error) {
      logger.error('Error getting partner campaigns:', error);
      throw error;
    }
  }
  
  /**
   * Haal campagne op
   */
  static async getCampaign(campaignId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('partner_marketing_campaigns')
        .select(`
          *,
          lead_segments (code, branch, region),
          profiles (id, company_name)
        `)
        .eq('id', campaignId)
        .single();
      
      if (error) throw error;
      return data;
      
    } catch (error) {
      logger.error('Error getting campaign:', error);
      throw error;
    }
  }
  
  /**
   * Update campagne performance (van externe API)
   */
  static async updateCampaignPerformance(campaignId, performance) {
    try {
      const update = {
        total_spend: performance.total_spend || 0,
        total_clicks: performance.total_clicks || 0,
        total_impressions: performance.total_impressions || 0,
        total_leads: performance.total_leads || 0,
        updated_at: new Date().toISOString()
      };
      
      // Bereken avg_cpl
      if (update.total_leads > 0 && update.total_spend > 0) {
        update.avg_cpl = update.total_spend / update.total_leads;
      }
      
      const { data, error } = await supabaseAdmin
        .from('partner_marketing_campaigns')
        .update(update)
        .eq('id', campaignId)
        .select()
        .single();
      
      if (error) throw error;
      
      return data;
      
    } catch (error) {
      logger.error('Error updating campaign performance:', error);
      throw error;
    }
  }
  
  /**
   * Sync met externe API (placeholder)
   * TODO: Implementeer Google Ads API integratie
   */
  static async syncWithGoogleAds(campaignId) {
    try {
      const campaign = await this.getCampaign(campaignId);
      
      if (!campaign || campaign.channel !== 'google_ads') {
        throw new Error('Campaign is not a Google Ads campaign');
      }
      
      if (!campaign.external_campaign_id) {
        logger.warn(`Campaign ${campaignId} has no external_campaign_id, skipping sync`);
        return null;
      }
      
      // TODO: Implementeer Google Ads API call
      // const googleAdsClient = require('../integrations/googleAds/googleAdsPartnerClient');
      // const performance = await googleAdsClient.getCampaignPerformance(campaign.external_campaign_id);
      // await this.updateCampaignPerformance(campaignId, performance);
      
      logger.info(`Synced campaign ${campaignId} with Google Ads (placeholder)`);
      return campaign;
      
    } catch (error) {
      logger.error('Error syncing with Google Ads:', error);
      throw error;
    }
  }
}

module.exports = PartnerCampaignService;

