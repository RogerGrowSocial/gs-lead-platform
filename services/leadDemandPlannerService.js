'use strict'

const { supabaseAdmin } = require('../config/supabase')
const LeadSegmentService = require('./leadSegmentService')

/**
 * Lead Demand Planner Service
 * 
 * Berekent target leads per segment op basis van capaciteit
 * en berekent gaps (target - actual)
 * 
 * DESIGN DECISIONS:
 * - Targets zijn gebaseerd op BESCHIKBARE capaciteit (total - open), niet totale capaciteit
 * - Real-time updates: targets worden herberekend bij dashboard load en slider wijziging
 * - Cron fallback: dagelijkse herberekening om consistentie te garanderen
 * 
 * 🔖 DESIGN DECISION: Eén Centrale Functie voor Targets
 * 
 * Alle targets worden altijd berekend via: planSegment(segmentId, date)
 * Cron, slider-wijzigingen en dashboards roepen ALLEMAAL deze functie aan.
 * Geen losse rekenlogica eromheen.
 * 
 * Er is maar één plek waar de rekensom voor targets staat.
 */
class LeadDemandPlannerService {
  // Configuratie
  static TARGET_UTILIZATION = 0.8 // 80% van capaciteit als target
  static MIN_TARGET_LEADS = 5 // Minimum aantal leads per dag

  /**
   * Berekent target leads per dag voor een segment
   * 
   * IMPORTANT: Target is gebaseerd op BESCHIKBARE capaciteit (niet totale capaciteit).
   * Als partners al leads hebben ontvangen, wordt target automatisch verlaagd.
   * 
   * Formule: beschikbare_capaciteit = capacity_total_leads - current_open_leads
   * Target = beschikbare_capaciteit * TARGET_UTILIZATION
   * 
   * Voorbeelden:
   * - Partner heeft slider op 10, heeft al 5 leads → beschikbaar = 5, target = 4
   * - Partner zet slider van 10 naar 0 → beschikbaar = 0, target = 0
   * 
   * @param {string} segmentId - UUID van het segment
   * @param {Date} date - Datum
   * @returns {Promise<number>} Target aantal leads
   */
  static async calculateTargetLeads(segmentId, date) {
    try {
      // Haal capaciteit op (inclusief current_open_leads)
      const capacity = await LeadSegmentService.getSegmentCapacity(segmentId)
      
      // Bereken beschikbare capaciteit: totale capaciteit minus huidige open leads
      // Als partners al leads hebben ontvangen, is er minder capaciteit beschikbaar
      const availableCapacity = Math.max(0, 
        capacity.capacity_total_leads - (capacity.current_open_leads || 0)
      )
      
      // Berekent target: 80% van BESCHIKBARE capaciteit (niet totale capaciteit)
      const targetLeads = Math.floor(
        availableCapacity * this.TARGET_UTILIZATION
      )

      // Minimum target (alleen als er capaciteit is)
      // Als beschikbare capaciteit 0 is, moet target ook 0 zijn
      if (availableCapacity === 0) {
        return 0
      }

      return Math.max(this.MIN_TARGET_LEADS, targetLeads)
    } catch (error) {
      console.error('Error in calculateTargetLeads:', error)
      throw error
    }
  }

  /**
   * Berekent lead gap voor een segment
   * @param {string} segmentId - UUID van het segment
   * @param {Date} date - Datum
   * @returns {Promise<Object>} Gap analysis
   */
  static async calculateLeadGap(segmentId, date) {
    try {
      const dateStr = date.toISOString().split('T')[0]

      // Haal stats op
      const { data: stats } = await supabaseAdmin
        .from('lead_generation_stats')
        .select('leads_generated')
        .eq('segment_id', segmentId)
        .eq('date', dateStr)
        .single()

      // Haal plan op (of bereken target)
      const { data: plan } = await supabaseAdmin
        .from('lead_segment_plans')
        .select('target_leads_per_day')
        .eq('segment_id', segmentId)
        .eq('date', dateStr)
        .single()

      const target = plan?.target_leads_per_day || await this.calculateTargetLeads(segmentId, date)
      const actual = stats?.leads_generated || 0
      const gap = target - actual
      const gapPercentage = target > 0 ? (gap / target) * 100 : 0

      return {
        target,
        actual,
        gap,
        gapPercentage: Math.round(gapPercentage * 100) / 100
      }
    } catch (error) {
      console.error('Error in calculateLeadGap:', error)
      throw error
    }
  }

  /**
   * Plan een segment voor een datum
   * 
   * CENTRALE FUNCTIE: Dit is de enige functie die targets opslaat in de database.
   * Alle target recalculation (cron, on-demand, slider-change) gebruikt deze functie.
   * 
   * @param {string} segmentId - UUID van het segment
   * @param {Date} date - Datum
   * @returns {Promise<Object>} Plan object
   */
  static async planSegment(segmentId, date) {
    try {
      const dateStr = date.toISOString().split('T')[0]

      // Bereken target
      const target = await this.calculateTargetLeads(segmentId, date)

      // Bereken gap
      const gapAnalysis = await this.calculateLeadGap(segmentId, date)

      // Upsert plan
      const { data: plan, error } = await supabaseAdmin
        .from('lead_segment_plans')
        .upsert({
          segment_id: segmentId,
          date: dateStr,
          target_leads_per_day: target,
          lead_gap: gapAnalysis.gap,
          lead_gap_percentage: gapAnalysis.gapPercentage,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'segment_id,date'
        })
        .select()
        .single()

      if (error) {
        throw new Error(`Error planning segment: ${error.message}`)
      }

      return plan
    } catch (error) {
      console.error('Error in planSegment:', error)
      throw error
    }
  }

  /**
   * Plan alle actieve segmenten voor een datum
   * @param {Date} date - Datum (default: vandaag)
   */
  static async planAllSegments(date = new Date()) {
    try {
      console.log(`📊 Starting demand planning for ${date.toISOString().split('T')[0]}...`)

      // Haal alle actieve segmenten op
      const segments = await LeadSegmentService.getAllActiveSegments()

      if (segments.length === 0) {
        console.log('⚠️ No active segments found')
        return {
          success: true,
          segmentsPlanned: 0,
          message: 'No active segments to plan'
        }
      }

      // Plan elk segment
      const results = []
      for (const segment of segments) {
        try {
          await this.planSegment(segment.id, date)
          results.push({ segmentId: segment.id, success: true })
        } catch (error) {
          console.error(`❌ Error planning segment ${segment.id}:`, error)
          results.push({ segmentId: segment.id, success: false, error: error.message })
        }
      }

      const successCount = results.filter(r => r.success).length

      console.log(`✅ Demand planning completed: ${successCount}/${segments.length} segments planned`)

      return {
        success: true,
        segmentsPlanned: successCount,
        totalSegments: segments.length,
        results
      }
    } catch (error) {
      console.error('Error in planAllSegments:', error)
      throw error
    }
  }

  /**
   * Update gap voor een bestaand plan (na stats update)
   * @param {string} segmentId - UUID van het segment
   * @param {Date} date - Datum
   */
  static async updateGap(segmentId, date) {
    try {
      const dateStr = date.toISOString().split('T')[0]

      // Gebruik database function voor gap update
      const { error } = await supabaseAdmin.rpc('update_lead_gap', {
        p_segment_id: segmentId,
        p_date: dateStr
      })

      if (error) {
        throw new Error(`Error updating gap: ${error.message}`)
      }
    } catch (error) {
      console.error('Error in updateGap:', error)
      throw error
    }
  }
}

module.exports = LeadDemandPlannerService

