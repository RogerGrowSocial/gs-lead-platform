const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');
const PartnerDemandService = require('./partnerDemandService');
const SiteService = require('./siteService');
const LeadSegmentService = require('./leadSegmentService');
const PartnerLandingPageService = require('./partnerLandingPageService');

/**
 * GUARDRAILS - Hard caps voor SEO en platform-first constraints
 * Deze constants voorkomen mass domain explosion en doorway pages
 */
const MAX_SITES = 10; // Maximum aantal actieve sites
const MAX_PAGES_PER_CLUSTER = 6; // Maximum aantal pagina's per (site, segment) cluster
const MIN_GAP_FOR_NEW_PAGE = 3; // Minimum lead gap voordat nieuwe pagina wordt voorgesteld

/**
 * PartnerMarketingOrchestratorService
 * 
 * Genereer marketing acties op basis van lead gaps
 * Regel-gebaseerde eerste versie (geen black box AI)
 * 
 * PLATFORM-FIRST FLOW:
 * - Nieuwe methode generatePlatformMarketingActions() itereert over (site, segment)
 * - Legacy methode generateMarketingActions() blijft voor partner-centric flow
 * 
 * GUARDRAILS:
 * - MAX_SITES: Max 10 actieve sites
 * - MAX_PAGES_PER_CLUSTER: Max 6 pagina's per cluster
 * - MIN_GAP_FOR_NEW_PAGE: Min gap van 3 voordat nieuwe pagina wordt voorgesteld
 */
class PartnerMarketingOrchestratorService {
  /**
   * @deprecated Use generatePlatformMarketingActions instead for platform-first flow
   * Genereer marketing acties voor partners met gaps (LEGACY - partner-centric)
   * @param {Date} date - Datum voor berekening
   * @returns {Array} Array van actie voorstellen
   */
  static async generateMarketingActions(date = new Date()) {
    try {
      logger.info('Generating marketing actions for partners');
      
      // 1. Haal partner gaps op
      const gaps = await PartnerDemandService.calculatePartnerLeadGaps(date);
      
      // 2. Filter partners met auto_marketing_enabled
      const { data: autoMarketingPartners } = await supabaseAdmin
        .from('profiles')
        .select('id, auto_marketing_enabled, marketing_mode, monthly_marketing_budget')
        .eq('auto_marketing_enabled', true)
        .in('marketing_mode', ['hybrid', 'full_marketing']);
      
      const partnerIds = new Set((autoMarketingPartners || []).map(p => p.id));
      const relevantGaps = gaps.filter(gap => partnerIds.has(gap.partner_id));
      
      logger.info(`Found ${relevantGaps.length} gaps for auto-marketing partners`);
      
      // 3. Voor elke partner met gap:
      const actions = [];
      for (const gap of relevantGaps) {
        try {
          // 3a. Haal partner details op
          const { data: partner } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', gap.partner_id)
            .single();
          
          if (!partner) continue;
          
          // 3b. Check budget ruimte
          const budgetStatus = await this.checkBudgetStatus(partner, date);
          
          // 3c. Genereer acties op basis van gap
          if (gap.lead_gap > 0) {
            // Positieve gap: meer leads nodig
            const increaseActions = await this.generateIncreaseActions(gap, partner, budgetStatus);
            actions.push(...increaseActions);
          } else if (gap.lead_gap < -2) {
            // Negatieve gap: te veel leads of verspilling
            const decreaseActions = await this.generateDecreaseActions(gap, partner, budgetStatus);
            actions.push(...decreaseActions);
          }
        } catch (gapError) {
          logger.error(`Error processing gap for partner ${gap.partner_id}:`, gapError);
          continue;
        }
      }
      
      // 4. Sla acties op als 'concept' (niet direct uitvoeren)
      await this.saveActionsAsConcepts(actions);
      
      logger.info(`Generated ${actions.length} marketing actions`);
      return actions;
      
    } catch (error) {
      logger.error('Error in generateMarketingActions:', error);
      throw error;
    }
  }
  
  /**
   * Check budget status voor partner
   */
  static async checkBudgetStatus(partner, date) {
    const monthlyBudget = parseFloat(partner.monthly_marketing_budget) || 0;
    
    if (monthlyBudget === 0) {
      return {
        hasBudget: false,
        monthlyBudget: 0,
        currentSpend: 0,
        remainingBudget: 0,
        percentageUsed: 0
      };
    }
    
    // Bereken huidige spend deze maand
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    
    const { data: campaigns } = await supabaseAdmin
      .from('partner_marketing_campaigns')
      .select('total_spend')
      .eq('partner_id', partner.id)
      .eq('status', 'active')
      .gte('started_at', startOfMonth.toISOString())
      .lte('started_at', endOfMonth.toISOString());
    
    const currentSpend = campaigns?.reduce((sum, c) => sum + parseFloat(c.total_spend || 0), 0) || 0;
    const remainingBudget = monthlyBudget - currentSpend;
    const percentageUsed = (currentSpend / monthlyBudget) * 100;
    
    return {
      hasBudget: remainingBudget > 0,
      monthlyBudget,
      currentSpend,
      remainingBudget,
      percentageUsed
    };
  }
  
  /**
   * Genereer acties om leads te verhogen
   */
  static async generateIncreaseActions(gap, partner, budgetStatus) {
    const actions = [];
    
    // Haal segment op (alleen actieve segmenten)
    const { data: segment } = await supabaseAdmin
      .from('lead_segments')
      .select('*')
      .eq('id', gap.segment_id)
      .eq('is_active', true)
      .single();
    
    if (!segment) return actions;
    
    // Actie 1: Check of LP bestaat
    const { data: existingLP } = await supabaseAdmin
      .from('partner_landing_pages')
      .select('*')
      .eq('partner_id', partner.id)
      .eq('segment_id', gap.segment_id)
      .single();
    
    if (!existingLP) {
      // Geen LP: stel voor om LP aan te maken
      actions.push({
        type: 'create_landing_page',
        partner_id: partner.id,
        segment_id: gap.segment_id,
        priority: gap.lead_gap > 5 ? 'high' : 'medium',
        reason: `Geen LP voor segment ${segment.code}, gap=${gap.lead_gap.toFixed(1)}`,
        status: 'concept',
        action_details: {
          segment_code: segment.code,
          segment_branch: segment.branch,
          segment_region: segment.region,
          lead_gap: gap.lead_gap
        }
      });
    } else if (existingLP.status === 'concept') {
      // LP in concept: stel voor om te publiceren
      actions.push({
        type: 'publish_landing_page',
        partner_id: partner.id,
        segment_id: gap.segment_id,
        landing_page_id: existingLP.id,
        priority: 'medium',
        reason: `LP in concept, kan gepubliceerd worden`,
        status: 'concept',
        action_details: {
          landing_page_path: existingLP.path,
          landing_page_title: existingLP.title
        }
      });
    }
    
    // Actie 2: Check of campagne bestaat
    const { data: existingCampaign } = await supabaseAdmin
      .from('partner_marketing_campaigns')
      .select('*')
      .eq('partner_id', partner.id)
      .eq('segment_id', gap.segment_id)
      .eq('channel', 'google_ads')
      .single();
    
    if (!existingCampaign) {
      // Geen campagne: stel voor om campagne aan te maken (als budget beschikbaar)
      if (budgetStatus.hasBudget) {
        const suggestedBudget = this.calculateSuggestedBudget(gap, budgetStatus);
        actions.push({
          type: 'create_campaign',
          partner_id: partner.id,
          segment_id: gap.segment_id,
          channel: 'google_ads',
          priority: gap.lead_gap > 5 ? 'high' : 'medium',
          reason: `Geen campagne, gap=${gap.lead_gap.toFixed(1)}`,
          status: 'concept',
          action_details: {
            suggested_daily_budget: suggestedBudget,
            segment_code: segment.code,
            lead_gap: gap.lead_gap
          }
        });
      }
    } else if (existingCampaign.status === 'active') {
      // Actieve campagne: verhoog budget (binnen limieten)
      const suggestedIncrease = this.calculateBudgetIncrease(gap, existingCampaign, budgetStatus);
      if (suggestedIncrease > 0 && budgetStatus.hasBudget) {
        actions.push({
          type: 'increase_campaign_budget',
          partner_id: partner.id,
          segment_id: gap.segment_id,
          campaign_id: existingCampaign.id,
          priority: 'medium',
          reason: `Gap=${gap.lead_gap.toFixed(1)}, kan budget verhogen`,
          status: 'concept',
          action_details: {
            current_budget: existingCampaign.daily_budget,
            suggested_budget: parseFloat(existingCampaign.daily_budget || 0) + suggestedIncrease,
            budget_increase: suggestedIncrease,
            lead_gap: gap.lead_gap
          }
        });
      }
    } else if (existingCampaign.status === 'planned') {
      // Geplande campagne: stel voor om te activeren
      actions.push({
        type: 'activate_campaign',
        partner_id: partner.id,
        segment_id: gap.segment_id,
        campaign_id: existingCampaign.id,
        priority: 'medium',
        reason: `Campagne is gepland, kan geactiveerd worden`,
        status: 'concept',
        action_details: {
          campaign_channel: existingCampaign.channel,
          campaign_daily_budget: existingCampaign.daily_budget
        }
      });
    }
    
    return actions;
  }
  
  /**
   * Genereer acties om leads/budget te verlagen
   */
  static async generateDecreaseActions(gap, partner, budgetStatus) {
    const actions = [];
    
    // Haal actieve campagnes op
    const { data: campaigns } = await supabaseAdmin
      .from('partner_marketing_campaigns')
      .select('*')
      .eq('partner_id', partner.id)
      .eq('segment_id', gap.segment_id)
      .eq('status', 'active');
    
    if (!campaigns || campaigns.length === 0) return actions;
    
    // Voor elke campagne: check CPL
    for (const campaign of campaigns) {
      const avgCpl = parseFloat(campaign.avg_cpl || 0);
      const cplTarget = parseFloat(campaign.cpl_target || 0);
      
      // Als CPL te hoog is (> 1.5x target), stel voor om budget te verlagen
      if (cplTarget > 0 && avgCpl > cplTarget * 1.5) {
        const suggestedDecrease = parseFloat(campaign.daily_budget || 0) * 0.2; // 20% verlagen
        actions.push({
          type: 'decrease_campaign_budget',
          partner_id: partner.id,
          segment_id: gap.segment_id,
          campaign_id: campaign.id,
          priority: 'medium',
          reason: `CPL (${avgCpl.toFixed(2)}) is te hoog vs target (${cplTarget.toFixed(2)})`,
          status: 'concept',
          action_details: {
            current_budget: campaign.daily_budget,
            suggested_budget: Math.max(5, parseFloat(campaign.daily_budget || 0) - suggestedDecrease),
            budget_decrease: suggestedDecrease,
            current_cpl: avgCpl,
            target_cpl: cplTarget
          }
        });
      }
    }
    
    return actions;
  }
  
  /**
   * Bereken suggested budget voor nieuwe campagne
   */
  static calculateSuggestedBudget(gap, budgetStatus) {
    // Basis: €10 per lead gap (vereenvoudigd)
    const baseBudget = gap.lead_gap * 10;
    
    // Max: 30% van resterend maandelijks budget (per dag)
    const maxBudget = (budgetStatus.remainingBudget * 0.3) / 30;
    
    // Min: €5 per dag
    const minBudget = 5;
    
    return Math.max(minBudget, Math.min(baseBudget, maxBudget));
  }
  
  /**
   * Bereken budget increase voor bestaande campagne
   */
  static calculateBudgetIncrease(gap, campaign, budgetStatus) {
    // Basis: €5 per lead gap
    const baseIncrease = gap.lead_gap * 5;
    
    // Max: 50% van huidige budget, of 10% van resterend maandelijks budget (per dag)
    const currentBudget = parseFloat(campaign.daily_budget || 0);
    const maxIncreaseFromBudget = currentBudget * 0.5;
    const maxIncreaseFromMonthly = (budgetStatus.remainingBudget * 0.1) / 30;
    const maxIncrease = Math.min(maxIncreaseFromBudget, maxIncreaseFromMonthly);
    
    // Min: €2
    const minIncrease = 2;
    
    return Math.max(minIncrease, Math.min(baseIncrease, maxIncrease));
  }
  
  /**
   * Sla acties op als concept (voor review)
   * @deprecated Use savePlatformActionsAsConcepts for platform-first flow
   */
  static async saveActionsAsConcepts(actions) {
    if (actions.length === 0) return;
    
    // Sla op in ai_marketing_recommendations tabel
    const recommendations = actions.map(action => ({
      partner_id: action.partner_id,
      segment_id: action.segment_id,
      action_type: action.type,
      action_details: action.action_details || {},
      priority: action.priority || 'medium',
      status: 'pending',
      reason: action.reason,
      lead_gap: action.action_details?.lead_gap || null
    }));
    
    const { error } = await supabaseAdmin
      .from('ai_marketing_recommendations')
      .insert(recommendations);
    
    if (error) {
      logger.error('Error saving recommendations:', error);
      throw error;
    }
    
    logger.info(`Saved ${recommendations.length} recommendations`);
  }

  // =====================================================
  // PLATFORM-FIRST METHODS (NEW)
  // =====================================================

  /**
   * Genereer platform marketing acties op basis van site + segment gaps
   * @param {Date} date - Datum voor berekening
   * @returns {Promise<Array>} Array van actie voorstellen
   */
  static async generatePlatformMarketingActions(date = new Date()) {
    try {
      logger.info('Generating platform marketing actions (site+segment based)');
      
      // 1. Haal actieve sites op
      const sites = await SiteService.listActiveSites();
      if (!sites || sites.length === 0) {
        logger.warn('No active sites found');
        return [];
      }

      // GUARDRAIL: Max sites check
      if (sites.length > MAX_SITES) {
        logger.warn(`MAX_SITES guardrail: Found ${sites.length} active sites, limiting to ${MAX_SITES}`);
        sites.splice(MAX_SITES); // Keep only first MAX_SITES
      }

      // 2. Haal actieve segments op
      const segments = await LeadSegmentService.getAllActiveSegments();
      if (!segments || segments.length === 0) {
        logger.warn('No active segments found');
        return [];
      }

      logger.info(`Processing ${sites.length} sites × ${segments.length} segments`);

      // 3. Voor elk (site, segment) combinatie:
      const actions = [];
      let segmentsProcessed = 0;
      let segmentsSkipped = 0;
      let segmentsWithActions = 0;
      
      for (const site of sites) {
        for (const segment of segments) {
          try {
            // 3a. Check eerst of segment capacity heeft (anders geen zin om LP te maken)
            const LeadSegmentService = require('./leadSegmentService');
            const capacity = await LeadSegmentService.getSegmentCapacity(segment.id);
            
            // Skip segmenten zonder capacity (geen partners die leads willen)
            if (!capacity || capacity.capacity_total_leads === 0 || capacity.capacity_partners === 0) {
              logger.debug(`Skipping segment ${segment.code}: no capacity (${capacity?.capacity_partners || 0} partners, ${capacity?.capacity_total_leads || 0} leads/month)`);
              segmentsSkipped++;
              continue;
            }
            
            segmentsProcessed++;
            
            // 3b. Bereken segment gap (dit maakt nu ook een plan aan als die er niet is)
            const segmentGap = await this.calculateSegmentGap(segment.id, date);
            logger.debug(`Segment ${segment.code} (${segment.branch} • ${segment.region}): gap=${segmentGap.toFixed(1)}, capacity=${capacity.capacity_total_leads}/month`);
            
            // 3c. Haal cluster op
            const cluster = await PartnerLandingPageService.getLandingPageCluster(site.id, segment.id);
            const existingPages = [cluster.main, cluster.cost, cluster.quote, cluster.spoed, ...(cluster.others || [])].filter(Boolean).length;
            logger.info(`Segment ${segment.code} (${segment.branch} • ${segment.region}): gap=${segmentGap.toFixed(1)}, capacity=${capacity.capacity_total_leads}/month, ${existingPages} existing pages (main: ${!!cluster.main ? cluster.main.status : 'none'}, cost: ${!!cluster.cost}, quote: ${!!cluster.quote}, spoed: ${!!cluster.spoed})`);
            
            // 3d. Genereer acties op basis van gap en cluster status
            // Genereer altijd acties als er geen main page is, ongeacht gap
            const segmentActions = await this.generatePlatformActionsForSegment(
              site,
              segment,
              segmentGap,
              cluster
            );
            
            if (segmentActions.length > 0) {
              segmentsWithActions++;
              logger.info(`✅ Generated ${segmentActions.length} actions for segment ${segment.code}: ${segmentActions.map(a => `${a.action_type}${a.action_details?.page_type ? ` (${a.action_details.page_type})` : ''}`).join(', ')}`);
            } else {
              logger.warn(`⚠️ No actions generated for segment ${segment.code} - check cluster status and gap`);
            }
            
            actions.push(...segmentActions);
          } catch (segmentError) {
            logger.error(`Error processing site ${site.id}, segment ${segment.id}:`, segmentError);
            continue;
          }
        }
      }
      
      logger.info(`Summary: ${segmentsProcessed} segments processed, ${segmentsSkipped} skipped (no capacity), ${segmentsWithActions} segments generated actions, total ${actions.length} actions`);

      if (actions.length === 0) {
        logger.warn('⚠️ No actions generated! Possible reasons:');
        logger.warn(`  - ${segmentsSkipped} segments skipped (no capacity)`);
        logger.warn(`  - ${segmentsProcessed} segments processed but no actions generated`);
        logger.warn('  - All segments may already have main pages');
        logger.warn('  - All segments may have reached MAX_PAGES_PER_CLUSTER');
        return [];
      }

      // 4. Sla acties op als 'pending' recommendations
      await this.savePlatformActionsAsConcepts(actions);

      logger.info(`✅ Generated ${actions.length} platform marketing actions`);
      return actions;

    } catch (error) {
      logger.error('Error in generatePlatformMarketingActions:', error);
      throw error;
    }
  }

  /**
   * Bereken lead gap voor segment (niet per partner)
   * @param {string} segmentId - Segment ID
   * @param {Date} date - Datum
   * @returns {Promise<number>} Lead gap (target - actual)
   */
  static async calculateSegmentGap(segmentId, date) {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const LeadDemandPlannerService = require('./leadDemandPlannerService');

      // Haal plan op (target)
      const { data: plan, error: planError } = await supabaseAdmin
        .from('lead_segment_plans')
        .select('target_leads_per_day')
        .eq('segment_id', segmentId)
        .eq('date', dateStr)
        .maybeSingle(); // Use maybeSingle to avoid error if no plan exists

      let target = plan?.target_leads_per_day || 0;

      // Als er geen plan is, bereken target op basis van capacity
      if (!plan && target === 0) {
        try {
          target = await LeadDemandPlannerService.calculateTargetLeads(segmentId, date);
          // Optioneel: sla plan op voor volgende keer
          if (target > 0) {
            await LeadDemandPlannerService.planSegment(segmentId, date);
          }
        } catch (calcError) {
          logger.warn(`Could not calculate target for segment ${segmentId}:`, calcError);
          // Fallback: check capacity directly
          const LeadSegmentService = require('./leadSegmentService');
          const capacity = await LeadSegmentService.getSegmentCapacity(segmentId);
          target = capacity.capacity_total_leads / 30; // Convert monthly to daily
        }
      }

      // Haal stats op (actual)
      const { data: stats, error: statsError } = await supabaseAdmin
        .from('lead_generation_stats')
        .select('leads_generated')
        .eq('segment_id', segmentId)
        .eq('date', dateStr)
        .maybeSingle(); // Use maybeSingle to avoid error if no stats exist

      const actual = stats?.leads_generated || 0;

      const gap = target - actual;
      return gap;

    } catch (error) {
      logger.error(`Error calculating segment gap for ${segmentId}:`, error);
      return 0; // Default: geen gap
    }
  }

  /**
   * Genereer acties voor een (site, segment) combinatie
   * @param {Object} site - Site object
   * @param {Object} segment - Segment object
   * @param {number} gap - Lead gap
   * @param {Object} cluster - Landing page cluster
   * @returns {Promise<Array>} Array van acties
   */
  static async generatePlatformActionsForSegment(site, segment, gap, cluster) {
    const actions = [];

    // GUARDRAIL: Check max pages per cluster
    const existingPagesCount = [
      cluster.main,
      cluster.cost,
      cluster.quote,
      cluster.spoed,
      ...(cluster.others || [])
    ].filter(Boolean).length;

    logger.debug(`Segment ${segment.code}: existingPagesCount=${existingPagesCount}, cluster.main=${!!cluster.main}, cluster.cost=${!!cluster.cost}, cluster.quote=${!!cluster.quote}, cluster.spoed=${!!cluster.spoed}`);

    if (existingPagesCount >= MAX_PAGES_PER_CLUSTER) {
      logger.warn(`MAX_PAGES_PER_CLUSTER guardrail: Cluster for site ${site.id}, segment ${segment.code} already has ${existingPagesCount} pages (max: ${MAX_PAGES_PER_CLUSTER})`);
      return actions; // Stop - cluster is vol
    }

    // Regel 1: Geen main page → maak main page recommendation
    // Genereer ALTIJD een main page recommendation als die er niet is, ongeacht gap
    // (gap kan 0 zijn als er nog geen plan is, maar we willen toch een LP voor het segment)
    if (!cluster.main) {
      logger.info(`Segment ${segment.code}: No main page found, generating main page recommendation`);
      const path = PartnerLandingPageService.generatePathFromSegment(segment, 'main');
      actions.push({
        site_id: site.id,
        partner_id: null, // PLATFORM-FIRST
        segment_id: segment.id,
        action_type: 'create_landing_page',
        action_details: {
          site_id: site.id,
          segment_id: segment.id,
          page_type: 'main',
          source_type: 'platform',
          suggested_path: path,
          lead_gap: gap
        },
        priority: gap > 5 ? 'high' : gap > 0 ? 'medium' : 'low',
        status: 'pending',
        reason: `Geen main page voor segment ${segment.code}${gap > 0 ? `, gap=${gap.toFixed(1)}` : ''}`,
        reasoning: `Er is nog geen hoofdpagina voor het segment ${segment.branch} in ${segment.region}. ${gap > 0 ? `Er is een lead gap van ${gap.toFixed(1)} leads per dag.` : 'Er is capacity beschikbaar voor dit segment.'}`
      });
      // Continue - maak ook andere pagina's als gap groot genoeg is
      // (niet meer return, zodat we ook cost/quote kunnen maken als gap groot is)
    } else {
      logger.debug(`Segment ${segment.code}: Main page already exists (status: ${cluster.main?.status || 'unknown'}), skipping main page recommendation`);
    }

    // Regel 2: Main bestaat, gap > MIN_GAP_FOR_NEW_PAGE, geen cost → maak cost page
    if (gap > MIN_GAP_FOR_NEW_PAGE && !cluster.cost && existingPagesCount < MAX_PAGES_PER_CLUSTER) {
      logger.debug(`Segment ${segment.code}: Gap=${gap.toFixed(1)} > ${MIN_GAP_FOR_NEW_PAGE}, no cost page, generating cost page recommendation`);
      const path = PartnerLandingPageService.generatePathFromSegment(segment, 'cost');
      actions.push({
        site_id: site.id,
        partner_id: null,
        segment_id: segment.id,
        action_type: 'create_landing_page',
        action_details: {
          site_id: site.id,
          segment_id: segment.id,
          page_type: 'cost',
          source_type: 'platform',
          suggested_path: path,
          lead_gap: gap
        },
        priority: gap > 8 ? 'high' : 'medium',
        status: 'pending',
        reason: `Gap=${gap.toFixed(1)}, geen cost page voor segment ${segment.code}`
      });
    }

    // Regel 3: Main bestaat, gap > MIN_GAP_FOR_NEW_PAGE + 2, geen quote → maak quote page
    if (gap > (MIN_GAP_FOR_NEW_PAGE + 2) && !cluster.quote && existingPagesCount < MAX_PAGES_PER_CLUSTER) {
      const path = PartnerLandingPageService.generatePathFromSegment(segment, 'quote');
      actions.push({
        site_id: site.id,
        partner_id: null,
        segment_id: segment.id,
        action_type: 'create_landing_page',
        action_details: {
          site_id: site.id,
          segment_id: segment.id,
          page_type: 'quote',
          source_type: 'platform',
          suggested_path: path,
          lead_gap: gap
        },
        priority: gap > 10 ? 'high' : 'medium',
        status: 'pending',
        reason: `Gap=${gap.toFixed(1)}, geen quote page voor segment ${segment.code}`
      });
    }

    // Regel 4: Spoed pagina alleen als segment daarop duidt
    // TODO: Implementeer logica om te bepalen of segment 'spoed' nodig heeft
    // Bijv. check segment.code bevat 'spoed' of segment metadata
    if (gap > (MIN_GAP_FOR_NEW_PAGE + 4) && !cluster.spoed && existingPagesCount < MAX_PAGES_PER_CLUSTER && 
        (segment.code?.includes('spoed') || segment.description?.includes('spoed'))) {
      const path = PartnerLandingPageService.generatePathFromSegment(segment, 'spoed');
      actions.push({
        site_id: site.id,
        partner_id: null,
        segment_id: segment.id,
        action_type: 'create_landing_page',
        action_details: {
          site_id: site.id,
          segment_id: segment.id,
          page_type: 'spoed',
          source_type: 'platform',
          suggested_path: path,
          lead_gap: gap
        },
        priority: 'high',
        status: 'pending',
        reason: `Gap=${gap.toFixed(1)}, spoed pagina nodig voor segment ${segment.code}`
      });
    }

    // Regel 5: Concept pages kunnen gepubliceerd worden
    if (cluster.main && cluster.main.status === 'concept') {
      actions.push({
        site_id: site.id,
        partner_id: null,
        segment_id: segment.id,
        action_type: 'publish_landing_page',
        action_details: {
          landing_page_id: cluster.main.id,
          landing_page_path: cluster.main.path,
          landing_page_title: cluster.main.title
        },
        priority: gap > 0 ? 'medium' : 'low',
        status: 'pending',
        reason: `Main page in concept kan gepubliceerd worden voor segment ${segment.code}`
      });
    }

    // Regel 6: Geen Google Ads campagne maar wel gap → stel voor om campagne aan te maken
    // Check of er al een Google Ads campagne is gekoppeld aan dit segment
    if (gap > 3 && !segment.google_ads_campaign_id) {
      // Calculate suggested budget based on gap and CPL
      const DEFAULT_CPL = 25.00 // Default Cost Per Lead
      const suggestedDailyBudget = Math.max(10, Math.min(100, Math.round(gap * DEFAULT_CPL / 30))) // Spread over month, min €10, max €100
      
      // Get landing page URL if main page exists
      const landingPageUrl = cluster.main && cluster.main.status === 'live' 
        ? `${process.env.PLATFORM_URL || 'https://growsocialmedia.nl'}${cluster.main.path}`
        : null

      actions.push({
        site_id: site.id,
        partner_id: null,
        segment_id: segment.id,
        action_type: 'create_campaign',
        action_details: {
          site_id: site.id,
          segment_id: segment.id,
          segment_code: segment.code,
          campaign_name: `${segment.branch} - ${segment.region} (${segment.code})`,
          daily_budget: suggestedDailyBudget,
          advertising_channel_type: 'SEARCH',
          target_locations: [segment.region], // Use specific region (e.g. 'gelderland')
          landing_page_url: landingPageUrl,
          lead_gap: gap
        },
        priority: gap > 10 ? 'high' : gap > 5 ? 'medium' : 'low',
        status: 'pending',
        reason: `Geen Google Ads campagne voor segment ${segment.code}, gap=${gap.toFixed(1)}`,
        reasoning: `Er is een lead gap van ${gap.toFixed(1)} leads per dag voor het segment ${segment.branch} in ${segment.region}, maar er is nog geen Google Ads campagne gekoppeld. Een nieuwe campagne met een dagelijks budget van €${suggestedDailyBudget} kan helpen om deze gap te dichten.`
      });
    }

    return actions;
  }

  /**
   * Sla platform acties op als recommendations (PLATFORM-FIRST)
   * @param {Array} actions - Array van actie objecten
   */
  static async savePlatformActionsAsConcepts(actions) {
    if (actions.length === 0) {
      logger.warn('No actions to save as recommendations');
      return;
    }
    
    logger.info(`Saving ${actions.length} actions as recommendations...`);
    
    // OPTIMALISATIE: Haal alle bestaande recommendations in één keer op (batch check)
    // Dit voorkomt N queries en reduceert database belasting significant
    // Check alleen pending en approved - executed betekent dat de actie al is uitgevoerd
    // en we kunnen een nieuwe recommendation maken als de LP is verwijderd of als we een andere page_type willen
    const { data: existingRecs, error: existingError } = await supabaseAdmin
      .from('ai_marketing_recommendations')
      .select('site_id, segment_id, action_type, action_details')
      .is('partner_id', null)
      .in('status', ['pending', 'approved']); // Alleen pending/approved zijn actieve duplicates
    
    if (existingError) {
      logger.error('Error checking existing recommendations:', existingError);
      // Fallback: probeer door te gaan zonder duplicate check
    }
    
    logger.debug(`Found ${(existingRecs || []).length} existing recommendations`);
    
    // Maak een Set voor snelle lookup (O(1) in plaats van O(n))
    // Check op site_id, segment_id, action_type EN page_type (voor create_landing_page)
    const existingSet = new Set();
    (existingRecs || []).forEach(rec => {
      const key = `${rec.site_id}|${rec.segment_id}|${rec.action_type}`;
      existingSet.add(key);
      
      // Voor create_landing_page: check ook page_type in action_details
      if (rec.action_type === 'create_landing_page' && rec.action_details?.page_type) {
        const pageTypeKey = `${rec.site_id}|${rec.segment_id}|${rec.action_type}|${rec.action_details.page_type}`;
        existingSet.add(pageTypeKey);
      }
    });
    
    // Filter duplicates in-memory (veel sneller dan per actie een query)
    const uniqueActions = actions.filter(action => {
      // Check basic duplicate
      const key = `${action.site_id}|${action.segment_id}|${action.action_type}`;
      
      // Voor create_landing_page: check ook page_type
      if (action.action_type === 'create_landing_page' && action.action_details?.page_type) {
        const pageTypeKey = `${action.site_id}|${action.segment_id}|${action.action_type}|${action.action_details.page_type}`;
        if (existingSet.has(pageTypeKey)) {
          logger.debug(`Skipping duplicate: ${action.action_type} (${action.action_details.page_type}) for site ${action.site_id}, segment ${action.segment_id}`);
          return false;
        }
      }
      
      if (existingSet.has(key)) {
        logger.debug(`Skipping duplicate: ${action.action_type} for site ${action.site_id}, segment ${action.segment_id}`);
        return false;
      }
      return true;
    });
    
    if (uniqueActions.length === 0) {
      logger.warn(`No new recommendations to save - all ${actions.length} actions were duplicates`);
      return;
    }
    
    logger.info(`Filtered ${actions.length} actions to ${uniqueActions.length} unique recommendations (${actions.length - uniqueActions.length} duplicates)`);
    
    // Sla op in ai_marketing_recommendations tabel
    const recommendations = uniqueActions.map(action => ({
      site_id: action.site_id,
      partner_id: null, // PLATFORM-FIRST: altijd null
      segment_id: action.segment_id,
      action_type: action.action_type,
      action_details: action.action_details || {},
      priority: action.priority || 'medium',
      status: 'pending',
      reason: action.reason,
      reasoning: action.reasoning || action.reason || '', // Voor display in UI
      lead_gap: action.action_details?.lead_gap || null
    }));
    
    const { data: inserted, error } = await supabaseAdmin
      .from('ai_marketing_recommendations')
      .insert(recommendations)
      .select();
    
    if (error) {
      logger.error('Error saving platform recommendations:', error);
      throw error;
    }
    
    logger.info(`✅ Saved ${inserted?.length || recommendations.length} new platform recommendations (${actions.length - uniqueActions.length} duplicates skipped)`);
  }
}

module.exports = PartnerMarketingOrchestratorService;

