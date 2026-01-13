const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * PartnerDemandService
 * 
 * Bereken lead gaps per partner per segment
 * Input: Segment stats, partner stats, partner configuratie
 * Output: partner_lead_gap per partner per segment
 */
class PartnerDemandService {
  /**
   * Bereken lead gap per partner per segment
   * @param {Date} date - Datum voor berekening (default: vandaag)
   * @returns {Array} Array van partner gap records
   */
  static async calculatePartnerLeadGaps(date = new Date()) {
    try {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      logger.info(`Calculating partner lead gaps for date: ${dateStr}`);
      
      // 1. Haal alle actieve partners op met marketing enabled
      const partners = await this.getActivePartnersWithMarketing();
      logger.info(`Found ${partners.length} active partners with marketing`);
      
      const gaps = [];
      
      // 2. Voor elke partner:
      for (const partner of partners) {
        // 2a. Haal actieve segmenten op voor deze partner
        const segments = await this.getPartnerSegments(partner.id);
        
        if (segments.length === 0) {
          logger.debug(`Partner ${partner.id} has no active segments, skipping`);
          continue;
        }
        
        // 2b. Voor elk segment:
        for (const segment of segments) {
          try {
            // 2c. Bereken target leads
            const targetLeads = await this.calculateTargetLeads(partner, segment);
            
            // 2d. Bereken huidige leads (platform + eigen campagnes)
            const currentLeads = await this.calculateCurrentLeads(partner, segment, date);
            
            // 2e. Bereken gap
            const gap = targetLeads - currentLeads.total;
            
            // 2f. Sla op in partner_lead_gaps tabel
            const gapRecord = {
              partner_id: partner.id,
              segment_id: segment.id,
              date: dateStr,
              target_leads_per_day: targetLeads,
              current_leads_per_day: currentLeads.total,
              lead_gap: gap,
              platform_leads: currentLeads.platform,
              own_campaign_leads: currentLeads.ownCampaigns
            };
            
            // Upsert gap record
            const { error: upsertError } = await supabaseAdmin
              .from('partner_lead_gaps')
              .upsert(gapRecord, {
                onConflict: 'partner_id,segment_id,date'
              });
            
            if (upsertError) {
              logger.error(`Error upserting gap for partner ${partner.id}, segment ${segment.id}:`, upsertError);
              continue;
            }
            
            gaps.push(gapRecord);
            
            logger.debug(`Partner ${partner.id}, segment ${segment.code}: target=${targetLeads}, current=${currentLeads.total}, gap=${gap}`);
            
          } catch (segmentError) {
            logger.error(`Error processing segment ${segment.id} for partner ${partner.id}:`, segmentError);
            continue;
          }
        }
      }
      
      logger.info(`Calculated ${gaps.length} partner lead gaps`);
      return gaps;
      
    } catch (error) {
      logger.error('Error in calculatePartnerLeadGaps:', error);
      throw error;
    }
  }
  
  /**
   * Haal actieve partners op met marketing enabled
   */
  static async getActivePartnersWithMarketing() {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('is_admin', false)
      .eq('status', 'active')
      .in('marketing_mode', ['hybrid', 'full_marketing'])
      .eq('auto_marketing_enabled', true);
    
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Haal actieve segmenten op voor partner
   */
  static async getPartnerSegments(partnerId) {
    const { data, error } = await supabaseAdmin
      .from('partner_segments')
      .select(`
        *,
        lead_segments (*)
      `)
      .eq('partner_id', partnerId)
      .eq('is_active', true);
    
    if (error) throw error;
    
    // Map naar segment objecten met code
    return (data || []).map(ps => ({
      id: ps.segment_id,
      code: ps.lead_segments?.code,
      branch: ps.lead_segments?.branch,
      region: ps.lead_segments?.region,
      is_primary: ps.is_primary,
      priority: ps.priority,
      target_leads_per_week: ps.target_leads_per_week
    }));
  }
  
  /**
   * Bereken target leads voor partner in segment
   */
  static async calculateTargetLeads(partner, segment) {
    // Optie 1: Partner heeft expliciet target ingesteld in partner_segments
    if (segment.target_leads_per_week) {
      return parseFloat(segment.target_leads_per_week) / 7; // per dag
    }
    
    // Optie 2: Gebruik capaciteit (max_open_leads - huidige open leads)
    // Haal huidige open leads op uit partner_performance_stats
    const { data: stats } = await supabaseAdmin
      .from('partner_performance_stats')
      .select('open_leads_count')
      .eq('partner_id', partner.id)
      .single();
    
    const currentOpenLeads = stats?.open_leads_count || 0;
    const maxOpenLeads = partner.max_open_leads || 0;
    const capacity = Math.max(0, maxOpenLeads - currentOpenLeads);
    
    if (capacity > 0) {
      return capacity / 30; // Verdeel over maand (per dag)
    }
    
    // Optie 3: Default target (bijv. 1 lead per dag)
    return 1.0;
  }
  
  /**
   * Bereken huidige leads voor partner in segment
   */
  static async calculateCurrentLeads(partner, segment, date) {
    const dateStr = date.toISOString().split('T')[0];
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    // Platform leads (uit leads tabel waar user_id = partner.id en segment_id = segment.id)
    const { count: platformLeadsCount } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', partner.id)
      .eq('segment_id', segment.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    const platformLeads = platformLeadsCount || 0;
    
    // Eigen campagne leads (uit partner_marketing_campaigns.total_leads)
    // Voor nu: tel leads die zijn gegenereerd door campagnes van deze partner in dit segment
    // TODO: Later koppelen via lead.source_campaign_id of similar
    const { data: campaigns } = await supabaseAdmin
      .from('partner_marketing_campaigns')
      .select('total_leads')
      .eq('partner_id', partner.id)
      .eq('segment_id', segment.id)
      .eq('status', 'active');
    
    const ownCampaignLeads = campaigns?.reduce((sum, c) => sum + (c.total_leads || 0), 0) || 0;
    
    // Voor nu: gebruik total_leads van campagnes (dit is cumulatief, niet per dag)
    // TODO: Implementeer dagelijkse tracking van campagne leads
    
    return {
      total: platformLeads + ownCampaignLeads,
      platform: platformLeads,
      ownCampaigns: ownCampaignLeads
    };
  }
  
  /**
   * Haal lead gaps op voor partner
   */
  static async getPartnerLeadGaps(partnerId, dateRange = { start: null, end: null }) {
    let query = supabaseAdmin
      .from('partner_lead_gaps')
      .select(`
        *,
        lead_segments (code, branch, region)
      `)
      .eq('partner_id', partnerId)
      .order('date', { ascending: false });
    
    if (dateRange.start) {
      query = query.gte('date', dateRange.start);
    }
    if (dateRange.end) {
      query = query.lte('date', dateRange.end);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }
  
  /**
   * Haal lead gaps op voor segment
   */
  static async getSegmentLeadGaps(segmentId, dateRange = { start: null, end: null }) {
    let query = supabaseAdmin
      .from('partner_lead_gaps')
      .select(`
        *,
        profiles (id, company_name, marketing_mode)
      `)
      .eq('segment_id', segmentId)
      .order('date', { ascending: false });
    
    if (dateRange.start) {
      query = query.gte('date', dateRange.start);
    }
    if (dateRange.end) {
      query = query.lte('date', dateRange.end);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }
}

module.exports = PartnerDemandService;

