'use strict'

const { supabaseAdmin } = require('../config/supabase')

/**
 * Slim systeem om kansen om te zetten in deals.
 * - Idempotent: als er al een deal is voor deze opportunity, return die.
 * - Zet opportunity.sales_status op 'customer' en status/stage op won/converted.
 * - Deal krijgt: opportunity_id, title, value_eur, sales_rep_id (= assignee of opgegeven rep), status open, stage proposal.
 */
async function getDealForOpportunity(opportunityId) {
  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('id, title, value_eur, status, stage, sales_rep_id, created_at')
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data
}

/**
 * Converteer een kans naar een deal. Idempotent: bij bestaande deal wordt die teruggegeven.
 *
 * @param {string} opportunityId - UUID van de kans
 * @param {object} options - { value_eur?, sales_rep_id?, actorId }
 * @returns {Promise<{ deal: object, alreadyConverted: boolean }>}
 */
async function convertToDeal(opportunityId, options = {}) {
  const { value_eur: overrideValue, sales_rep_id: overrideSalesRepId, actorId } = options

  const { data: opp, error: oppErr } = await supabaseAdmin
    .from('opportunities')
    .select('id, title, company_name, contact_name, value, value_eur, assigned_to')
    .eq('id', opportunityId)
    .single()

  if (oppErr || !opp) {
    throw new Error('Kans niet gevonden')
  }

  const existingDeal = await getDealForOpportunity(opportunityId)
  if (existingDeal) {
    return { deal: existingDeal, alreadyConverted: true }
  }

  const title = opp.title || opp.company_name || `Deal: ${opp.company_name || 'Onbekend'}`.slice(0, 255)
  const valueEur = overrideValue != null ? Number(overrideValue) : (opp.value_eur ?? opp.value ?? 0)
  const salesRepId = overrideSalesRepId || opp.assigned_to || actorId

  const { data: deal, error: dealErr } = await supabaseAdmin
    .from('deals')
    .insert({
      opportunity_id: opportunityId,
      title: String(title).slice(0, 255),
      value_eur: valueEur,
      status: 'open',
      stage: 'proposal',
      sales_rep_id: salesRepId || null
    })
    .select()
    .single()

  if (dealErr) {
    throw new Error(dealErr.message || 'Fout bij aanmaken deal')
  }

  const now = new Date().toISOString()
  await supabaseAdmin
    .from('opportunities')
    .update({
      sales_status: 'customer',
      sales_status_updated_at: now,
      status: 'won',
      stage: 'converted',
      updated_at: now
    })
    .eq('id', opportunityId)

  await supabaseAdmin.from('opportunity_sales_status_history').insert({
    opportunity_id: opportunityId,
    old_status: opp.sales_status || 'new',
    new_status: 'customer',
    reason: 'Omgezet naar deal',
    changed_by: actorId || null
  })

  return { deal, alreadyConverted: false }
}

module.exports = {
  convertToDeal,
  getDealForOpportunity
}
