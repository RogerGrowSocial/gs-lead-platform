'use strict'

const { supabaseAdmin } = require('../config/supabase')
const GoogleAdsClient = require('../integrations/googleAdsClient')

/**
 * Channel Orchestrator Service
 * 
 * Past budgets aan op basis van lead gaps
 * Begint met Google Ads, later uitbreidbaar naar andere kanalen
 */
class ChannelOrchestratorService {
  // Configuratie
  static MAX_DAILY_BUDGET_CHANGE = 0.20 // 20% max wijziging per dag
  static MIN_BUDGET = 5.00 // Minimum budget in EUR
  static MAX_BUDGET = 1000.00 // Maximum budget in EUR
  static DEFAULT_CPL = 25.00 // Default Cost Per Lead (kan later uit stats komen)

  /**
   * Orchestreer Google Ads budget voor een segment
   * @param {string} segmentId - UUID van het segment
   * @param {Date} date - Datum
   */
  static async orchestrateGoogleAds(segmentId, date) {
    try {
      const dateStr = date.toISOString().split('T')[0]

      // Haal plan op
      const { data: plan, error: planError } = await supabaseAdmin
        .from('lead_segment_plans')
        .select('*')
        .eq('segment_id', segmentId)
        .eq('date', dateStr)
        .single()

      if (planError || !plan) {
        console.log(`⚠️ No plan found for segment ${segmentId} on ${dateStr}`)
        return { success: false, message: 'No plan found' }
      }

      if (!plan.lead_gap || plan.lead_gap === 0) {
        return { success: true, message: 'No gap to address' }
      }

      // Update orchestration status
      await supabaseAdmin
        .from('lead_segment_plans')
        .update({
          orchestration_status: 'processing',
          last_orchestration_at: new Date().toISOString()
        })
        .eq('id', plan.id)

      // Bepaal gewenste budget wijziging
      const budgetAdjustment = this.calculateBudgetAdjustment(plan)

      if (Math.abs(budgetAdjustment) < 0.01) {
        // Te kleine wijziging, skip
        await supabaseAdmin
          .from('lead_segment_plans')
          .update({
            orchestration_status: 'completed',
            orchestration_notes: 'Budget adjustment too small to apply'
          })
          .eq('id', plan.id)
        return { success: true, message: 'Adjustment too small' }
      }

      // Haal huidige budget op
      const currentBudget = plan.actual_daily_budget_google_ads || plan.target_daily_budget_google_ads || 0
      const newBudget = this.applySafetyLimits(
        currentBudget + budgetAdjustment,
        currentBudget
      )

      // Voer wijziging uit (via Google Ads API of placeholder)
      const result = await this.updateGoogleAdsBudget(segmentId, newBudget, plan)

      // Log wijziging
      await this.logOrchestration(segmentId, plan.id, {
        channel: 'google_ads',
        action_type: budgetAdjustment > 0 ? 'budget_increase' : 'budget_decrease',
        old_value: currentBudget,
        new_value: newBudget,
        status: result.success ? 'success' : 'failed',
        error_message: result.error,
        date: dateStr
      })

      // Update plan
      await supabaseAdmin
        .from('lead_segment_plans')
        .update({
          actual_daily_budget_google_ads: newBudget,
          orchestration_status: result.success ? 'completed' : 'error',
          orchestration_notes: result.error || 'Budget adjusted successfully',
          last_orchestration_at: new Date().toISOString()
        })
        .eq('id', plan.id)

      return result
    } catch (error) {
      console.error('Error in orchestrateGoogleAds:', error)
      
      // Update plan met error status
      try {
        await supabaseAdmin
          .from('lead_segment_plans')
          .update({
            orchestration_status: 'error',
            orchestration_notes: error.message
          })
          .eq('segment_id', segmentId)
          .eq('date', date.toISOString().split('T')[0])
      } catch (updateError) {
        console.error('Error updating plan status:', updateError)
      }

      throw error
    }
  }

  /**
   * Berekent budget aanpassing op basis van gap
   * @param {Object} plan - Plan object
   * @returns {number} Budget adjustment in EUR
   */
  static calculateBudgetAdjustment(plan) {
    const gap = plan.lead_gap || 0
    const avgCpl = this.DEFAULT_CPL // TODO: Haal uit stats of config per segment

    if (gap > 0) {
      // Te weinig leads: verhoog budget
      // Bijv: gap van 10 leads × €25 CPL = €250 extra budget
      return gap * avgCpl
    } else {
      // Te veel leads: verlaag budget (voorzichtig)
      // Bijv: gap van -5 leads × €25 CPL = -€125 budget reductie
      return gap * avgCpl
    }
  }

  /**
   * Past safety limits toe op budget wijziging
   * @param {number} newBudget - Gewenst nieuw budget
   * @param {number} currentBudget - Huidig budget
   * @returns {number} Veilig budget binnen limits
   */
  static applySafetyLimits(newBudget, currentBudget) {
    // Max 20% wijziging per dag
    const maxChange = currentBudget * this.MAX_DAILY_BUDGET_CHANGE
    const change = newBudget - currentBudget

    if (Math.abs(change) > maxChange) {
      newBudget = currentBudget + (change > 0 ? maxChange : -maxChange)
    }

    // Min/max absolute grenzen
    newBudget = Math.max(this.MIN_BUDGET, Math.min(this.MAX_BUDGET, newBudget))

    return Math.round(newBudget * 100) / 100 // Round to 2 decimals
  }

  /**
   * Update Google Ads budget via Google Ads API
   * @param {string} segmentId - UUID van het segment
   * @param {number} newBudget - Nieuw budget in EUR
   * @param {Object} plan - Plan object
   * @returns {Promise<Object>} Result met success/error
   */
  static async updateGoogleAdsBudget(segmentId, newBudget, plan) {
    try {
      // Haal segment op voor campaign mapping (alleen actieve segmenten)
      const { data: segment } = await supabaseAdmin
        .from('lead_segments')
        .select('code, branch, region')
        .eq('id', segmentId)
        .eq('is_active', true)
        .single()

      if (!segment) {
        return { success: false, error: 'Segment not found' }
      }

      // Echte Google Ads API call (gebruik segmentId voor betere mapping)
      const result = await GoogleAdsClient.updateCampaignBudget(segmentId, newBudget, segment.code)

      if (result.success) {
        console.log(`✅ Google Ads budget updated successfully:`)
        console.log(`   Segment: ${segment.code}`)
        console.log(`   New budget: €${newBudget.toFixed(2)}`)
      } else {
        console.warn(`⚠️ Google Ads budget update failed:`)
        console.warn(`   Segment: ${segment.code}`)
        console.warn(`   Error: ${result.error}`)
      }

      return result
    } catch (error) {
      console.error('Error updating Google Ads budget:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Log orchestration actie
   * @param {string} segmentId - UUID van het segment
   * @param {string} planId - UUID van het plan (optioneel)
   * @param {Object} logData - Log data
   */
  static async logOrchestration(segmentId, planId, logData) {
    try {
      await supabaseAdmin
        .from('channel_orchestration_log')
        .insert({
          segment_id: segmentId,
          plan_id: planId,
          date: logData.date || new Date().toISOString().split('T')[0],
          channel: logData.channel,
          action_type: logData.action_type,
          old_value: logData.old_value,
          new_value: logData.new_value,
          status: logData.status,
          error_message: logData.error_message,
          executed_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Error logging orchestration:', error)
      // Don't throw - logging errors shouldn't break the flow
    }
  }

  /**
   * Orchestreer alle segmenten met gaps voor een datum
   * @param {Date} date - Datum (default: vandaag)
   */
  static async orchestrateAllSegments(date = new Date()) {
    try {
      const dateStr = date.toISOString().split('T')[0]

      console.log(`🎯 Starting orchestration for ${dateStr}...`)

      // Haal alle plannen op met gaps
      const { data: plans, error } = await supabaseAdmin
        .from('lead_segment_plans')
        .select('segment_id, lead_gap')
        .eq('date', dateStr)
        .not('lead_gap', 'is', null)

      if (error) {
        throw new Error(`Error fetching plans: ${error.message}`)
      }

      if (!plans || plans.length === 0) {
        console.log('⚠️ No plans with gaps found')
        return {
          success: true,
          segmentsOrchestrated: 0,
          message: 'No plans with gaps to orchestrate'
        }
      }

      // Orchestreer elk segment
      const results = []
      for (const plan of plans) {
        try {
          const result = await this.orchestrateGoogleAds(plan.segment_id, date)
          results.push({
            segmentId: plan.segment_id,
            success: result.success,
            message: result.message
          })
        } catch (error) {
          console.error(`❌ Error orchestrating segment ${plan.segment_id}:`, error)
          results.push({
            segmentId: plan.segment_id,
            success: false,
            error: error.message
          })
        }
      }

      const successCount = results.filter(r => r.success).length

      console.log(`✅ Orchestration completed: ${successCount}/${plans.length} segments orchestrated`)

      return {
        success: true,
        segmentsOrchestrated: successCount,
        totalSegments: plans.length,
        results
      }
    } catch (error) {
      console.error('Error in orchestrateAllSegments:', error)
      throw error
    }
  }
}

module.exports = ChannelOrchestratorService

