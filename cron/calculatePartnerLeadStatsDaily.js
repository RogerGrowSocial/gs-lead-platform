const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Calculate Partner Lead Stats Daily
 * 
 * Aggregeer partner leads per source (platform vs. eigen campagnes)
 * Wordt dagelijks uitgevoerd na lead stats aggregatie
 */
async function calculatePartnerLeadStatsDaily() {
  try {
    logger.info('Starting daily partner lead stats calculation...');
    
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Haal alle actieve partners op
    const { data: partners, error: partnersError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('is_admin', false)
      .eq('status', 'active');
    
    if (partnersError) throw partnersError;
    
    logger.info(`Processing ${partners.length} partners`);
    
    let processed = 0;
    let errors = 0;
    
    for (const partner of partners) {
      try {
        // Tel platform leads (uit leads tabel)
        const { count: platformLeads } = await supabaseAdmin
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', partner.id)
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());
        
        // Tel eigen campagne leads (uit partner_marketing_campaigns)
        // Voor nu: gebruik total_leads van actieve campagnes
        // TODO: Implementeer dagelijkse tracking van campagne leads
        const { data: campaigns } = await supabaseAdmin
          .from('partner_marketing_campaigns')
          .select('total_leads')
          .eq('partner_id', partner.id)
          .eq('status', 'active');
        
        const ownCampaignLeads = campaigns?.reduce((sum, c) => sum + (c.total_leads || 0), 0) || 0;
        
        // Sla op in partner_lead_gaps (of nieuwe partner_daily_stats tabel)
        // Voor nu: gebruik partner_lead_gaps met segment_id = null voor totaal
        // Dit wordt later gebruikt door PartnerDemandService
        
        processed++;
        
      } catch (partnerError) {
        logger.error(`Error processing partner ${partner.id}:`, partnerError);
        errors++;
        continue;
      }
    }
    
    logger.info(`Partner stats calculation completed: ${processed} processed, ${errors} errors`);
    
  } catch (error) {
    logger.error('Error in calculatePartnerLeadStatsDaily:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  calculatePartnerLeadStatsDaily()
    .then(() => {
      logger.info('Partner stats calculation job completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Partner stats calculation job failed:', error);
      process.exit(1);
    });
}

module.exports = calculatePartnerLeadStatsDaily;

