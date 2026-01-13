const { supabaseAdmin } = require('../config/supabase');
const PartnerCampaignService = require('../services/partnerCampaignService');
const logger = require('../utils/logger');

/**
 * Sync Partner Campaigns Daily
 * 
 * Sync partner campagnes met externe APIs (Google Ads, Meta, etc.)
 * Wordt dagelijks uitgevoerd
 */
async function syncPartnerCampaignsDaily() {
  try {
    logger.info('Starting daily partner campaigns sync...');
    
    // Haal alle actieve campagnes op met external_campaign_id
    const { data: campaigns, error } = await supabaseAdmin
      .from('partner_marketing_campaigns')
      .select('*')
      .eq('status', 'active')
      .not('external_campaign_id', 'is', null);
    
    if (error) throw error;
    
    logger.info(`Syncing ${campaigns.length} active campaigns`);
    
    let synced = 0;
    let errors = 0;
    
    for (const campaign of campaigns) {
      try {
        // Sync based on channel
        if (campaign.channel === 'google_ads') {
          await PartnerCampaignService.syncWithGoogleAds(campaign.id);
          synced++;
        } else if (campaign.channel === 'meta_ads') {
          // TODO: Implementeer Meta Ads sync
          logger.debug(`Meta Ads sync not yet implemented for campaign ${campaign.id}`);
        } else {
          logger.debug(`Channel ${campaign.channel} sync not yet implemented`);
        }
        
      } catch (campaignError) {
        logger.error(`Error syncing campaign ${campaign.id}:`, campaignError);
        errors++;
        continue;
      }
    }
    
    logger.info(`Campaign sync completed: ${synced} synced, ${errors} errors`);
    
  } catch (error) {
    logger.error('Error in syncPartnerCampaignsDaily:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  syncPartnerCampaignsDaily()
    .then(() => {
      logger.info('Partner campaigns sync job completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Partner campaigns sync job failed:', error);
      process.exit(1);
    });
}

module.exports = syncPartnerCampaignsDaily;

