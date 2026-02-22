'use strict'

const { supabaseAdmin } = require('../config/supabase')
const opportunityAssignmentFollowUpService = require('./opportunityAssignmentFollowUpService')

const ROUTER_NAME = 'ai_kansen_router'
const ROUTER_VERSION = '1.0'

/**
 * AI Kansen Router: assignment + decision logging for opportunities.
 * Mirrors Lead router pattern (leadAssignmentService + lead_assignment_logs).
 */

/**
 * Get Kansen router settings from ai_router_settings (keys kansen_*).
 */
async function getKansenSettings() {
  const { data: settings, error } = await supabaseAdmin
    .from('ai_router_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [
      'kansen_auto_assign_enabled',
      'kansen_auto_assign_threshold',
      'kansen_region_weight',
      'kansen_performance_weight',
      'kansen_fairness_weight'
    ])

  if (error) {
    console.warn('⚠️ Error fetching Kansen router settings:', error.message)
    return {
      autoAssignEnabled: true,
      autoAssignThreshold: 60,
      regionWeight: 40,
      performanceWeight: 50,
      fairnessWeight: 30
    }
  }

  const map = {}
  if (settings) {
    settings.forEach(s => { map[s.setting_key] = s.setting_value })
  }
  return {
    autoAssignEnabled: map.kansen_auto_assign_enabled !== 'false',
    autoAssignThreshold: Math.max(0, Math.min(100, parseInt(map.kansen_auto_assign_threshold || '60', 10))),
    regionWeight: Math.max(0, Math.min(100, parseInt(map.kansen_region_weight || '40', 10))),
    performanceWeight: Math.max(0, Math.min(100, parseInt(map.kansen_performance_weight || '50', 10))),
    fairnessWeight: Math.max(0, Math.min(100, parseInt(map.kansen_fairness_weight || '30', 10)))
  }
}

/**
 * Score reps for an opportunity (same logic as current autoAssignOpportunity).
 */
function scoreReps(opportunity, salesReps, repStats) {
  return salesReps.map(rep => {
    const stats = repStats[rep.id] || { successRate: 50, dealCount: 0, wonCount: 0, totalValue: 0 }
    let score = 0
    score += (stats.successRate / 100) * 50
    const experienceScore = Math.min(30, (stats.dealCount / 10) * 30)
    score += experienceScore
    const oppValue = opportunity.value || opportunity.value_eur || 0
    if (stats.totalValue > 0 && stats.dealCount > 0) {
      const avgDealValue = stats.totalValue / stats.dealCount
      const valueDiff = Math.abs(avgDealValue - oppValue)
      const maxValue = Math.max(avgDealValue, oppValue)
      if (maxValue > 0) score += (1 - (valueDiff / maxValue)) * 20
    }
    return { rep_id: rep.id, rep_name: rep.name, score: Math.round(score) }
  })
}

/**
 * Check if we already logged a decision for this opportunity in the last 60s with same assignee (idempotency).
 */
async function recentDecisionExists(opportunityId, appliedAssigneeUserId) {
  const since = new Date(Date.now() - 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('opportunity_routing_decisions')
    .select('id')
    .eq('opportunity_id', opportunityId)
    .eq('applied_assignee_user_id', appliedAssigneeUserId)
    .gte('created_at', since)
    .limit(1)
  if (error || !data || data.length === 0) return false
  return true
}

/**
 * Insert a routing decision row. Skip if duplicate within 60s for same assignee (idempotency).
 */
async function logRoutingDecision(decision) {
  if (decision.applied && decision.applied_assignee_user_id) {
    const exists = await recentDecisionExists(decision.opportunity_id, decision.applied_assignee_user_id)
    if (exists) return null
  }
  const { data, error } = await supabaseAdmin
    .from('opportunity_routing_decisions')
    .insert({
      opportunity_id: decision.opportunity_id,
      stream_id: decision.stream_id || null,
      router_name: decision.router_name || ROUTER_NAME,
      router_version: decision.router_version || ROUTER_VERSION,
      model: decision.model || null,
      confidence: decision.confidence != null ? decision.confidence : null,
      decision_summary: decision.decision_summary || null,
      input_snapshot: decision.input_snapshot || null,
      output_snapshot: decision.output_snapshot || null,
      explanation: decision.explanation || null,
      applied: decision.applied !== false,
      applied_assignee_user_id: decision.applied_assignee_user_id || null,
      fallback_used: decision.fallback_used === true,
      error_message: decision.error_message || null,
      is_manual_override: decision.is_manual_override === true,
      override_by_user_id: decision.override_by_user_id || null
    })
    .select()
    .single()
  if (error) {
    console.warn('⚠️ Error logging opportunity routing decision:', error.message)
    return null
  }
  return data
}

/**
 * Assign opportunity to best matching rep and log decision.
 * Returns { rep_id, rep_name, score, confidence, decision_id } or null.
 */
async function assignOpportunity(opportunityId, options = {}) {
  const { assignedBy = 'auto', streamId = null } = options
  try {
    const { data: opportunity, error: oppErr } = await supabaseAdmin
      .from('opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single()

    if (oppErr || !opportunity) return null
    if (opportunity.assigned_to) return null

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .order('first_name', { ascending: true })

    const salesReps = (profiles || []).map(p => ({
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Onbekend'
    }))
    if (!salesReps.length) return null

    const { data: allDeals } = await supabaseAdmin
      .from('deals')
      .select('sales_rep_id, status, value_eur')

    const repStats = {}
    salesReps.forEach(rep => {
      const repDeals = (allDeals || []).filter(d => d.sales_rep_id === rep.id)
      const wonDeals = repDeals.filter(d => d.status === 'won')
      const totalValue = repDeals.reduce((sum, d) => sum + (d.value_eur || 0), 0)
      const successRate = repDeals.length > 0 ? Math.round((wonDeals.length / repDeals.length) * 100) : 50
      repStats[rep.id] = {
        id: rep.id,
        name: rep.name,
        dealCount: repDeals.length,
        wonCount: wonDeals.length,
        successRate,
        totalValue
      }
    })

    const scores = scoreReps(opportunity, salesReps, repStats)
    scores.sort((a, b) => b.score - a.score)
    const topMatch = scores[0]
    if (!topMatch || topMatch.score <= 0) {
      await logRoutingDecision({
        opportunity_id: opportunityId,
        stream_id: streamId,
        confidence: 0,
        decision_summary: 'Geen geschikte rep gevonden',
        input_snapshot: { opportunity_id: opportunityId, rep_count: salesReps.length },
        output_snapshot: {},
        explanation: 'Geen rep met score > 0.',
        applied: false,
        fallback_used: true,
        error_message: null
      })
      return null
    }

    const settings = await getKansenSettings()
    const confidence = topMatch.score / 100
    const useFallback = confidence < (settings.autoAssignThreshold / 100)
    let applied = true
    let appliedAssigneeUserId = topMatch.rep_id
    let assigned_to_name = topMatch.rep_name

    if (useFallback) {
      // Same pattern as Leads: do not auto-assign below threshold; leave unassigned (or could set default queue)
      applied = false
      appliedAssigneeUserId = null
      assigned_to_name = null
    }

    if (applied) {
      const { data: rep } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('id', topMatch.rep_id)
        .single()
      if (rep) {
        assigned_to_name = [rep.first_name, rep.last_name].filter(Boolean).join(' ') || 'Onbekend'
        const updateData = {
          assigned_to: topMatch.rep_id,
          assigned_to_name,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        const { data: updated, error: assignErr } = await supabaseAdmin
          .from('opportunities')
          .update(updateData)
          .eq('id', opportunityId)
          .select()
        if (assignErr || !updated || updated.length === 0) {
          applied = false
          appliedAssigneeUserId = null
          await logRoutingDecision({
            opportunity_id: opportunityId,
            stream_id: streamId,
            confidence,
            decision_summary: `Toewijzing aan ${assigned_to_name} mislukt`,
            input_snapshot: { opportunity_id: opportunityId, top_rep_id: topMatch.rep_id, score: topMatch.score },
            output_snapshot: { assignee_id: topMatch.rep_id, assignee_name: assigned_to_name },
            explanation: `Beste match: ${topMatch.rep_name} (${topMatch.score}%). ${assignErr?.message || 'Update failed'}.`,
            applied: false,
            fallback_used: useFallback,
            error_message: assignErr?.message || null
          })
          return null
        }
        try {
          await opportunityAssignmentFollowUpService.recordAssignmentAndNotify(opportunityId, topMatch.rep_id, null, 'ai')
        } catch (followErr) {
          console.warn('Opportunity follow-up (email/task) failed:', followErr.message)
        }
      }
    }

    const decisionSummary = applied
      ? `Toegewezen aan ${assigned_to_name} (${topMatch.score}%)`
      : `Score onder drempel (${topMatch.score}% < ${settings.autoAssignThreshold}%); niet toegewezen`
    const explanation = applied
      ? `Beste match op basis van succesratio, ervaring en waarde: ${topMatch.rep_name}.`
      : `Score ${topMatch.score}% onder drempel ${settings.autoAssignThreshold}%. Handmatig toewijzen of drempel verlagen.`

    const decision = await logRoutingDecision({
      opportunity_id: opportunityId,
      stream_id: streamId,
      confidence,
      decision_summary: decisionSummary,
      input_snapshot: {
        opportunity_id: opportunityId,
        value: opportunity.value || opportunity.value_eur,
        rep_count: salesReps.length,
        scores: scores.slice(0, 5).map(s => ({ rep_id: s.rep_id, rep_name: s.rep_name, score: s.score }))
      },
      output_snapshot: {
        assignee_id: appliedAssigneeUserId,
        assignee_name: assigned_to_name,
        priority: opportunity.priority,
        applied,
        fallback_used: useFallback
      },
      explanation,
      applied,
      applied_assignee_user_id: appliedAssigneeUserId,
      fallback_used: useFallback,
      error_message: null
    })

    if (applied) {
      return {
        rep_id: topMatch.rep_id,
        rep_name: assigned_to_name,
        score: topMatch.score,
        confidence,
        decision_id: decision?.id || null
      }
    }
    return null
  } catch (e) {
    console.error('Error in assignOpportunity:', e)
    try {
      await logRoutingDecision({
        opportunity_id: opportunityId,
        stream_id: options.streamId || null,
        applied: false,
        fallback_used: true,
        error_message: e.message
      })
    } catch (logErr) {
      console.warn('Failed to log error decision:', logErr.message)
    }
    return null
  }
}

/**
 * Log a manual override (manager/admin reassigned the opportunity).
 */
async function logManualOverride(opportunityId, assignedToUserId, overrideByUserId) {
  const { data: rep } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('id', assignedToUserId)
    .single()
  const assigneeName = rep ? [rep.first_name, rep.last_name].filter(Boolean).join(' ') || 'Onbekend' : 'Onbekend'
  return logRoutingDecision({
    opportunity_id: opportunityId,
    router_name: 'manual_override',
    decision_summary: `Handmatig toegewezen aan ${assigneeName}`,
    input_snapshot: { manual_override: true, assigned_to: assignedToUserId },
    output_snapshot: { assignee_id: assignedToUserId, assignee_name: assigneeName },
    explanation: 'Toewijzing door beheerder/manager.',
    applied: true,
    applied_assignee_user_id: assignedToUserId,
    fallback_used: false,
    is_manual_override: true,
    override_by_user_id: overrideByUserId || null
  })
}

module.exports = {
  getKansenSettings,
  assignOpportunity,
  logManualOverride,
  logRoutingDecision
}
