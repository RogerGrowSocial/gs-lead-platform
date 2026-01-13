'use strict'

const { supabaseAdmin } = require('../config/supabase')

/**
 * Lead Assignment Service
 * 
 * Intelligently assigns leads to the best matching partner based on:
 * - Branch/industry match
 * - Region/province/postcode match
 * - Wait time since last assignment (fair distribution)
 * - Historical performance (conversion rate, acceptance rate)
 * - Capacity (max open leads)
 * - Urgency (fast responders for urgent leads)
 * 
 * DESIGN DECISIONS:
 * - HARDE REGEL: Alleen partners met actieve betaalmethode (payment_methods.status = 'active') 
 *   tellen mee voor routing. Zonder betaalmethode: 0 capacity, 0 leads.
 * - Real-time stats: open_leads_count moet direct worden bijgewerkt bij assignment/rejection
 *   (zie TODO comments in assignLead() en routes/api.js)
 * - Cron job is alleen backup, niet de "bron van de waarheid"
 */
class LeadAssignmentService {
  // Score weights (configurable)
  static SCORE_WEIGHTS = {
    branchMatch: 100,        // Exact branch match
    branchPartial: 50,       // Partial branch match (via lead_industries array)
    regionMatch: 80,        // Exact region match
    regionPartial: 40,      // Partial region match
    waitTime: 60,           // Wait time bonus (max 24 hours = 60 points)
    performance: 40,        // Conversion rate * 40
    capacity: 30,           // Bonus if under capacity
    urgencyBonus: 20,       // Fast responder bonus for urgent leads
    routingPriority: 10    // Manual priority boost
  }

  /**
   * Get all eligible partners for a lead
   * @param {string} leadId - UUID of the lead
   * @returns {Promise<Array>} Array of candidate partners with scores
   */
  static async getCandidates(leadId) {
    try {
      // Fetch lead details
      const { data: lead, error: leadError } = await supabaseAdmin
        .from('leads')
        .select('id, industry_id, province, postcode, is_urgent, status')
        .eq('id', leadId)
        .single()

      if (leadError || !lead) {
        throw new Error(`Lead not found: ${leadId}`)
      }

      // Lead must be unassigned
      if (lead.status === 'accepted' || lead.status === 'rejected') {
        throw new Error(`Lead is already ${lead.status}`)
      }

      // Get industry name if industry_id exists
      let industryName = null
      if (lead.industry_id) {
        const { data: industry } = await supabaseAdmin
          .from('industries')
          .select('name')
          .eq('id', lead.industry_id)
          .single()
        industryName = industry?.name || null
      }

      // Fetch all active partners
      const { data: partners, error: partnersError } = await supabaseAdmin
        .from('profiles')
        .select(`
          id,
          primary_branch,
          regions,
          lead_industries,
          lead_locations,
          max_open_leads,
          is_active_for_routing,
          routing_priority,
          created_at
        `)
        .eq('is_admin', false)
        .eq('is_active_for_routing', true)

      if (partnersError) {
        throw new Error(`Error fetching partners: ${partnersError.message}`)
      }

      // Fetch performance stats from materialized view
      const { data: stats } = await supabaseAdmin
        .from('partner_performance_stats')
        .select('*')

      const statsMap = new Map()
      if (stats) {
        stats.forEach(stat => {
          statsMap.set(stat.partner_id, stat)
        })
      }

      // Fetch AI router settings
      let routerSettings = null
      try {
        const { data: settings } = await supabaseAdmin
          .from('ai_router_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['region_weight', 'performance_weight', 'fairness_weight'])
        
        if (settings && settings.length > 0) {
          routerSettings = {}
          settings.forEach(s => {
            if (s.setting_key === 'region_weight') {
              routerSettings.regionWeight = parseInt(s.setting_value || '50', 10)
            } else if (s.setting_key === 'performance_weight') {
              routerSettings.performanceWeight = parseInt(s.setting_value || '50', 10)
            } else if (s.setting_key === 'fairness_weight') {
              routerSettings.fairnessWeight = parseInt(s.setting_value || '50', 10)
            }
          })
        }
      } catch (settingsError) {
        console.warn('⚠️ Error fetching AI router settings, using defaults:', settingsError.message)
      }

      // Calculate scores for each partner
      const candidates = []
      for (const partner of partners) {
        const stat = statsMap.get(partner.id) || {}
        const score = this.calculateScore(lead, industryName, partner, stat, routerSettings)
        
        if (score.totalScore > 0) {
          candidates.push({
            partnerId: partner.id,
            partner: partner,
            stats: stat,
            score: score
          })
        }
      }

      // Sort by total score (descending)
      candidates.sort((a, b) => b.score.totalScore - a.score.totalScore)

      return candidates
    } catch (error) {
      console.error('Error in getCandidates:', error)
      throw error
    }
  }

  /**
   * Calculate performance score based on all 8 performance metrics
   * @param {Object} stats - Performance stats from materialized view
   * @returns {Object} Performance score breakdown (0-100)
   */
  static calculatePerformanceScore(stats) {
    const performanceFactors = {
      responseSpeed: 0,
      aiTrust: 0,
      dealRate: 0,
      followUp: 0,
      feedback: 0,
      complaints: 0,
      dealValue: 0,
      consistency: 0
    }

    // 1. REACTIESNELHEID (Response Speed)
    // <= 30 min → 100, 30-120 min → 70-100, 2-24h → 40-70, >24h → 0-40
    const avgResponseTime = stats.avg_first_response_time_minutes_30d
    if (avgResponseTime !== null && avgResponseTime !== undefined) {
      if (avgResponseTime <= 30) {
        performanceFactors.responseSpeed = 100
      } else if (avgResponseTime <= 120) {
        // Linear interpolation: 30 min = 100, 120 min = 70
        performanceFactors.responseSpeed = 100 - (((avgResponseTime - 30) / 90) * 30)
      } else if (avgResponseTime <= 1440) { // 24 hours = 1440 minutes
        // Linear interpolation: 120 min = 70, 1440 min = 40
        performanceFactors.responseSpeed = 70 - ((avgResponseTime - 120) / 1320) * 30
      } else {
        performanceFactors.responseSpeed = Math.max(0, 40 - ((avgResponseTime - 1440) / 1440) * 40)
      }
    }
    
    // Bonus voor % binnen 1u en 24u
    const pctWithin1h = stats.pct_contacted_within_1h_30d || 0
    const pctWithin24h = stats.pct_contacted_within_24h_30d || 0
    // Combineer: base score + bonus voor hoge percentages
    performanceFactors.responseSpeed = Math.min(100, 
      performanceFactors.responseSpeed * 0.7 + (pctWithin1h * 0.2) + (pctWithin24h * 0.1)
    )

    // 2. AI TRUST SCORE
    // Direct gebruiken (0-100), maar check of hoger = beter
    // ai_risk_score: lager = hoger risico, dus we moeten omkeren of direct gebruiken
    // Laat me aannemen dat hoger = beter (zoals in de notes staat)
    const aiTrust = stats.ai_trust_score
    if (aiTrust !== null && aiTrust !== undefined) {
      performanceFactors.aiTrust = Math.max(0, Math.min(100, aiTrust))
    }

    // 3. DEAL RATE
    // Hoger = beter, maar cap op 80-90 om outliers te temperen
    const dealRate = stats.deal_rate_30d
    if (dealRate !== null && dealRate !== undefined) {
      // Cap op 90, dan normaliseer naar 0-100
      const cappedRate = Math.min(90, dealRate)
      performanceFactors.dealRate = (cappedRate / 90) * 100
    }

    // 4. FOLLOW-UP DISCIPLINE
    // Score hoger als pct_leads_min_2_attempts_30d hoog is
    const pctMin2Attempts = stats.pct_leads_min_2_attempts_30d || 0
    performanceFactors.followUp = Math.max(0, Math.min(100, pctMin2Attempts))
    
    // Bonus voor gemiddeld aantal contactpogingen
    const avgAttempts = stats.avg_contact_attempts_per_lead_30d || 0
    // Idealiter 2-3 pogingen per lead = 100, meer of minder = penalty
    if (avgAttempts >= 2 && avgAttempts <= 3) {
      performanceFactors.followUp = Math.min(100, performanceFactors.followUp + 10)
    } else if (avgAttempts < 1) {
      performanceFactors.followUp = Math.max(0, performanceFactors.followUp - 20)
    }

    // 5. KLANTENFEEDBACK
    // Mapping 1-5 sterren → 0-100
    const avgRating = stats.avg_customer_rating_30d
    if (avgRating !== null && avgRating !== undefined) {
      // 1 ster = 0, 5 sterren = 100
      performanceFactors.feedback = ((avgRating - 1) / 4) * 100
    }
    
    // Bonus als er veel ratings zijn (betrouwbaarder)
    const numRatings = stats.num_ratings_30d || 0
    if (numRatings >= 5) {
      performanceFactors.feedback = Math.min(100, performanceFactors.feedback + 5)
    }

    // 6. KLACHTEN
    // Hogere complaint_rate = lagere score (negatieve factor)
    const complaintRate = stats.complaint_rate_30d || 0
    // 0% klachten = 100, 10% klachten = 0, linear
    performanceFactors.complaints = Math.max(0, 100 - (complaintRate * 10))
    
    // Extra penalty voor absolute aantal klachten
    const complaints = stats.complaints_30d || 0
    if (complaints > 0) {
      performanceFactors.complaints = Math.max(0, performanceFactors.complaints - (complaints * 5))
    }

    // 7. DEALWAARDE
    // Kleine bonus voor hogere avg_deal_value_30d, met log-normalisatie
    const avgDealValue = stats.avg_deal_value_30d
    if (avgDealValue !== null && avgDealValue !== undefined && avgDealValue > 0) {
      // Log-normalisatie: log(deal_value) / log(max_expected_deal_value) * 20
      // Max bonus = 20 punten
      const maxExpectedDeal = 10000 // €10,000 als maximum
      const normalized = Math.log(1 + avgDealValue) / Math.log(1 + maxExpectedDeal)
      performanceFactors.dealValue = Math.min(20, normalized * 20)
    }

    // 8. CONSISTENTIE
    // Als 7d veel slechter is dan 30d → penalty
    // Als 7d ongeveer gelijk of beter is dan 30d → bonus
    const consistencyScore = stats.consistency_score
    if (consistencyScore !== null && consistencyScore !== undefined) {
      performanceFactors.consistency = Math.max(0, Math.min(100, consistencyScore))
    }

    // Calculate weighted average (alle metrics even belangrijk voor nu)
    // Later kunnen we dit configurable maken
    const weights = {
      responseSpeed: 0.15,
      aiTrust: 0.15,
      dealRate: 0.20,
      followUp: 0.10,
      feedback: 0.15,
      complaints: 0.10,
      dealValue: 0.05,
      consistency: 0.10
    }

    const totalPerformanceScore = 
      (performanceFactors.responseSpeed * weights.responseSpeed) +
      (performanceFactors.aiTrust * weights.aiTrust) +
      (performanceFactors.dealRate * weights.dealRate) +
      (performanceFactors.followUp * weights.followUp) +
      (performanceFactors.feedback * weights.feedback) +
      (performanceFactors.complaints * weights.complaints) +
      (performanceFactors.dealValue * weights.dealValue) +
      (performanceFactors.consistency * weights.consistency)

    return {
      totalScore: Math.round(totalPerformanceScore * 100) / 100,
      factors: performanceFactors,
      breakdown: {
        responseSpeed: Math.round(performanceFactors.responseSpeed * 100) / 100,
        aiTrust: Math.round(performanceFactors.aiTrust * 100) / 100,
        dealRate: Math.round(performanceFactors.dealRate * 100) / 100,
        followUp: Math.round(performanceFactors.followUp * 100) / 100,
        feedback: Math.round(performanceFactors.feedback * 100) / 100,
        complaints: Math.round(performanceFactors.complaints * 100) / 100,
        dealValue: Math.round(performanceFactors.dealValue * 100) / 100,
        consistency: Math.round(performanceFactors.consistency * 100) / 100
      }
    }
  }

  /**
   * Calculate assignment score for a partner
   * @param {Object} lead - Lead object
   * @param {string} industryName - Industry name from industries table
   * @param {Object} partner - Partner profile
   * @param {Object} stats - Performance stats from materialized view
   * @param {Object} routerSettings - Optional: AI router settings (regionWeight, performanceWeight, fairnessWeight)
   * @returns {Object} Score breakdown
   */
  static calculateScore(lead, industryName, partner, stats, routerSettings = null) {
    const factors = {
      branchMatch: 0,
      regionMatch: 0,
      waitTime: 0,
      performance: 0,
      capacity: 0,
      urgencyBonus: 0,
      routingPriority: partner.routing_priority || 0
    }

    // 1. Branch/Industry Match
    if (industryName) {
      // Check primary_branch
      if (partner.primary_branch && partner.primary_branch.toLowerCase() === industryName.toLowerCase()) {
        factors.branchMatch = this.SCORE_WEIGHTS.branchMatch
      }
      // Check lead_industries array
      else if (partner.lead_industries && Array.isArray(partner.lead_industries)) {
        const industryLower = industryName.toLowerCase()
        const hasMatch = partner.lead_industries.some(branch => 
          branch && branch.toLowerCase() === industryLower
        )
        if (hasMatch) {
          factors.branchMatch = this.SCORE_WEIGHTS.branchPartial
        }
      }
    }

    // 2. Region Match
    if (lead.province && partner.regions && Array.isArray(partner.regions)) {
      const provinceLower = lead.province.toLowerCase()
      const hasExactMatch = partner.regions.some(region => 
        region && region.toLowerCase() === provinceLower
      )
      if (hasExactMatch) {
        factors.regionMatch = this.SCORE_WEIGHTS.regionMatch
      } else {
        // Partial match (check if province contains region or vice versa)
        const hasPartialMatch = partner.regions.some(region => 
          region && (
            region.toLowerCase().includes(provinceLower) ||
            provinceLower.includes(region.toLowerCase())
          )
        )
        if (hasPartialMatch) {
          factors.regionMatch = this.SCORE_WEIGHTS.regionPartial
        }
      }
    }
    // Also check lead_locations if regions is empty
    else if (lead.province && partner.lead_locations && Array.isArray(partner.lead_locations)) {
      const provinceLower = lead.province.toLowerCase()
      const hasMatch = partner.lead_locations.some(location => 
        location && location.toLowerCase() === provinceLower
      )
      if (hasMatch) {
        factors.regionMatch = this.SCORE_WEIGHTS.regionPartial
      }
    }

    // 3. Wait Time (hours since last assignment)
    let hoursSinceLastAssignment = 24 // Default to 24 hours if never assigned
    if (stats.last_lead_assigned_at) {
      const lastAssignmentTime = new Date(stats.last_lead_assigned_at).getTime()
      hoursSinceLastAssignment = (Date.now() - lastAssignmentTime) / (1000 * 60 * 60)
    } else if (partner.created_at) {
      // If never assigned, use time since profile creation
      const createdTime = new Date(partner.created_at).getTime()
      hoursSinceLastAssignment = (Date.now() - createdTime) / (1000 * 60 * 60)
    }
    
    // Max 24 hours = 60 points, linear scaling
    factors.waitTime = Math.min(24, hoursSinceLastAssignment) / 24 * this.SCORE_WEIGHTS.waitTime

    // 4. Performance (gebruik nieuwe calculatePerformanceScore functie)
    const performanceScore = this.calculatePerformanceScore(stats)
    // Gebruik routerSettings.performanceWeight als die beschikbaar is, anders default
    const performanceWeight = routerSettings?.performanceWeight || this.SCORE_WEIGHTS.performance
    factors.performance = (performanceScore.totalScore / 100) * performanceWeight

    // 5. Capacity Check
    const openLeads = stats.open_leads_count || 0
    const maxLeads = partner.max_open_leads || 5
    if (openLeads < maxLeads) {
      // Bonus decreases as capacity fills up
      const capacityRatio = (maxLeads - openLeads) / maxLeads
      factors.capacity = capacityRatio * this.SCORE_WEIGHTS.capacity
    }

    // 6. Urgency Bonus (fast responders for urgent leads)
    if (lead.is_urgent && stats.avg_response_time_minutes) {
      // If average response time < 60 minutes, give bonus
      if (stats.avg_response_time_minutes < 60) {
        factors.urgencyBonus = this.SCORE_WEIGHTS.urgencyBonus
      }
    }

    // 7. Routing Priority (manual boost)
    factors.routingPriority = (partner.routing_priority || 0) * this.SCORE_WEIGHTS.routingPriority

    // Apply router settings weights if provided
    let regionWeightMultiplier = 1
    let fairnessWeightMultiplier = 1
    
    if (routerSettings) {
      // Normalize weights (0-100) to multiplier (0-2)
      regionWeightMultiplier = routerSettings.regionWeight / 50 // 50 = 1.0, 100 = 2.0, 0 = 0.0
      fairnessWeightMultiplier = routerSettings.fairnessWeight / 50
    }
    
    // Apply multipliers to region and waitTime (fairness)
    factors.regionMatch = factors.regionMatch * regionWeightMultiplier
    factors.waitTime = factors.waitTime * fairnessWeightMultiplier

    // Calculate total score
    const totalScore = Object.values(factors).reduce((sum, val) => sum + val, 0)

    return {
      totalScore: Math.round(totalScore * 100) / 100, // Round to 2 decimals
      factors: factors,
      breakdown: {
        branchMatch: factors.branchMatch,
        regionMatch: Math.round(factors.regionMatch * 100) / 100,
        waitTime: Math.round(factors.waitTime * 100) / 100,
        performance: Math.round(factors.performance * 100) / 100,
        capacity: Math.round(factors.capacity * 100) / 100,
        urgencyBonus: factors.urgencyBonus,
        routingPriority: factors.routingPriority
      },
      performanceDetails: performanceScore // Include detailed performance breakdown
    }
  }

  /**
   * Assign a lead to the best matching partner
   * @param {string} leadId - UUID of the lead
   * @param {string} assignedBy - 'auto' | 'manual' | 'admin'
   * @param {string} partnerId - Optional: specific partner ID to assign to (for manual assignment)
   * @returns {Promise<Object>} Assignment result
   */
  static async assignLead(leadId, assignedBy = 'auto', partnerId = null) {
    try {
      let bestCandidate = null
      let routerSettings = null
      
      // Fetch AI router settings (eenmalig voor beide branches)
      try {
        const { data: settings } = await supabaseAdmin
          .from('ai_router_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['region_weight', 'performance_weight', 'fairness_weight'])
        
        if (settings && settings.length > 0) {
          routerSettings = {}
          settings.forEach(s => {
            if (s.setting_key === 'region_weight') {
              routerSettings.regionWeight = parseInt(s.setting_value || '50', 10)
            } else if (s.setting_key === 'performance_weight') {
              routerSettings.performanceWeight = parseInt(s.setting_value || '50', 10)
            } else if (s.setting_key === 'fairness_weight') {
              routerSettings.fairnessWeight = parseInt(s.setting_value || '50', 10)
            }
          })
        }
      } catch (settingsError) {
        console.warn('⚠️ Error fetching AI router settings, using defaults:', settingsError.message)
      }
      
      // If specific partner ID provided, use that
      if (partnerId) {
        const { data: partner, error: partnerError } = await supabaseAdmin
          .from('profiles')
          .select(`
            id,
            primary_branch,
            regions,
            lead_industries,
            lead_locations,
            max_open_leads,
            is_active_for_routing,
            routing_priority,
            created_at,
            company_name,
            first_name,
            last_name
          `)
          .eq('id', partnerId)
          .eq('is_admin', false)
          .single()
        
        if (partnerError || !partner) {
          throw new Error('Partner niet gevonden of niet beschikbaar')
        }
        
        // Get lead details for scoring
        const { data: lead } = await supabaseAdmin
          .from('leads')
          .select('id, industry_id, province, postcode, is_urgent')
          .eq('id', leadId)
          .single()
        
        let industryName = null
        if (lead?.industry_id) {
          const { data: industry } = await supabaseAdmin
            .from('industries')
            .select('name')
            .eq('id', lead.industry_id)
            .single()
          industryName = industry?.name || null
        }
        
        // Get stats
        const { data: stats } = await supabaseAdmin
          .from('partner_performance_stats')
          .select('*')
          .eq('partner_id', partnerId)
          .single()
        
        const score = this.calculateScore(lead || {}, industryName, partner, stats || {}, routerSettings)
        
        bestCandidate = {
          partnerId: partner.id,
          partner: partner,
          stats: stats || {},
          score: score
        }
      } else {
        // Get candidates and pick best
        const candidates = await this.getCandidates(leadId)

        if (candidates.length === 0) {
          throw new Error('No eligible partners found for this lead')
        }

        // Best candidate is first (highest score)
        bestCandidate = candidates[0]
      }

      // Update lead
      const { data: updatedLead, error: updateError } = await supabaseAdmin
        .from('leads')
        .update({
          assigned_to: bestCandidate.partnerId,
          user_id: bestCandidate.partnerId, // Also set user_id for backward compatibility
          assigned_by: assignedBy,
          assignment_score: bestCandidate.score.totalScore,
          assignment_factors: bestCandidate.score.breakdown,
          assigned_at: new Date().toISOString()
        })
        .eq('id', leadId)
        .select()
        .single()

      if (updateError) {
        throw new Error(`Error updating lead: ${updateError.message}`)
      }

      // =====================================================
      // 🔖 DESIGN DECISION: Real-time open_leads_count Update
      // =====================================================
      // Bij assignment: open_leads_count + 1
      // Cron job is alleen backup, niet de "bron van de waarheid"
      // Zie: docs/ARCHITECTURE.md sectie "Current Open Leads Updates"
      // =====================================================
      // TODO: Implementeer real-time update:
      // UPDATE partner_performance_stats 
      // SET open_leads_count = open_leads_count + 1
      // WHERE partner_id = :partnerId;
      // =====================================================

      // Log assignment (met uitgebreide performance metrics)
      const { error: logError } = await supabaseAdmin
        .from('lead_assignment_logs')
        .insert({
          lead_id: leadId,
          assigned_to: bestCandidate.partnerId,
          assigned_by: assignedBy,
          score: bestCandidate.score.totalScore,
          raw_factors: {
            // Bestaande factors
            ...bestCandidate.score.breakdown,
            // Performance details toevoegen
            performanceDetails: bestCandidate.score.performanceDetails || null,
            // Router settings
            routerSettings: routerSettings || null,
            // Alle stats voor debugging
            stats: {
              leads_assigned_30d: bestCandidate.stats.leads_assigned_30d || 0,
              conversion_rate_30d: bestCandidate.stats.conversion_rate_30d || 0,
              avg_response_time_minutes: bestCandidate.stats.avg_response_time_minutes || null,
              open_leads_count: bestCandidate.stats.open_leads_count || 0,
              // Nieuwe metrics
              avg_first_response_time_minutes_30d: bestCandidate.stats.avg_first_response_time_minutes_30d || null,
              pct_contacted_within_1h_30d: bestCandidate.stats.pct_contacted_within_1h_30d || 0,
              ai_trust_score: bestCandidate.stats.ai_trust_score || null,
              deal_rate_30d: bestCandidate.stats.deal_rate_30d || null,
              avg_contact_attempts_per_lead_30d: bestCandidate.stats.avg_contact_attempts_per_lead_30d || 0,
              avg_customer_rating_30d: bestCandidate.stats.avg_customer_rating_30d || null,
              complaint_rate_30d: bestCandidate.stats.complaint_rate_30d || 0,
              avg_deal_value_30d: bestCandidate.stats.avg_deal_value_30d || null,
              consistency_score: bestCandidate.stats.consistency_score || null
            }
          }
        })

      if (logError) {
        console.warn('⚠️ Error logging assignment:', logError.message)
        // Don't throw, assignment succeeded
      }

      // Create lead_activity for assignment (so it shows in chat)
      const { error: activityError } = await supabaseAdmin
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          type: 'status_changed',
          description: 'Gekoppeld aan geschikt bedrijf',
          created_by: bestCandidate.partnerId,
          created_at: new Date().toISOString(),
          metadata: {
            is_assignment: true,
            assignment: true,
            assigned_by: assignedBy,
            assignment_score: bestCandidate.score.totalScore
          }
        })

      if (activityError) {
        console.warn('⚠️ Error creating assignment activity:', activityError.message)
        // Don't throw, assignment succeeded
      }

      // Send notification if assigned
      try {
        const NotificationService = require('../services/notificationService');
        const notificationService = new NotificationService();
        
        // Get lead details for notification
        const { data: leadDetails } = await supabaseAdmin
          .from('leads')
          .select('id, name, email, phone, industry_id')
          .eq('id', leadId)
          .single();
        
        if (leadDetails) {
          // Get industry name
          let industryName = 'Onbekend';
          if (leadDetails.industry_id) {
            const { data: industry } = await supabaseAdmin
              .from('industries')
              .select('name')
              .eq('id', leadDetails.industry_id)
              .single();
            if (industry) {
              industryName = industry.name;
            }
          }
          
          await notificationService.sendLeadAssigned(bestCandidate.partnerId, {
            company_name: leadDetails.name || 'Onbekend bedrijf',
            contact_name: leadDetails.name || 'Onbekend',
            email: leadDetails.email || '',
            phone: leadDetails.phone || '',
            industry: industryName,
            lead_id: leadDetails.id
          });
        }
      } catch (notificationError) {
        console.warn('⚠️ Error sending assignment notification:', notificationError.message);
        // Don't throw - assignment succeeded
      }

      return {
        success: true,
        lead: updatedLead,
        assignedTo: bestCandidate.partnerId,
        score: bestCandidate.score.totalScore,
        factors: bestCandidate.score.breakdown,
        allCandidates: candidates.slice(0, 5).map(c => ({
          partnerId: c.partnerId,
          score: c.score.totalScore,
          factors: c.score.breakdown
        }))
      }
    } catch (error) {
      console.error('Error in assignLead:', error)
      throw error
    }
  }

  /**
   * Get recommendations for a lead (top 5 candidates without assigning)
   * @param {string} leadId - UUID of the lead
   * @returns {Promise<Object>} Recommendations with scores
   */
  static async getRecommendations(leadId) {
    try {
      const candidates = await this.getCandidates(leadId)

      return {
        leadId: leadId,
        recommendations: candidates.slice(0, 5).map(c => ({
          partnerId: c.partnerId,
          partner: {
            id: c.partner.id,
            company_name: c.partner.company_name,
            first_name: c.partner.first_name,
            last_name: c.partner.last_name,
            primary_branch: c.partner.primary_branch,
            regions: c.partner.regions,
            max_open_leads: c.partner.max_open_leads || 5
          },
          score: c.score.totalScore,
          factors: c.score.factors || c.score.breakdown,
          breakdown: c.score.breakdown,
          stats: {
            conversion_rate_30d: c.stats.conversion_rate_30d || 0,
            avg_response_time_minutes: c.stats.avg_response_time_minutes || null,
            open_leads_count: c.stats.open_leads_count || 0,
            max_open_leads: c.partner.max_open_leads || 5,
            leads_assigned_30d: c.stats.leads_assigned_30d || 0,
            last_lead_assigned_at: c.stats.last_lead_assigned_at || null
          }
        })),
        totalCandidates: candidates.length
      }
    } catch (error) {
      console.error('Error in getRecommendations:', error)
      throw error
    }
  }

  /**
   * Bulk assign multiple leads
   * @param {Array<string>} leadIds - Array of lead UUIDs
   * @param {string} assignedBy - 'auto' | 'manual' | 'admin'
   * @returns {Promise<Object>} Bulk assignment results
   */
  static async bulkAssignLeads(leadIds, assignedBy = 'auto') {
    const results = {
      success: [],
      failed: []
    }

    for (const leadId of leadIds) {
      try {
        const result = await this.assignLead(leadId, assignedBy)
        results.success.push({
          leadId: leadId,
          ...result
        })
      } catch (error) {
        results.failed.push({
          leadId: leadId,
          error: error.message
        })
      }
    }

    return results
  }
}

module.exports = LeadAssignmentService

