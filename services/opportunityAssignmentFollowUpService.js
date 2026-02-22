'use strict'

const crypto = require('crypto')
const { supabaseAdmin } = require('../config/supabase')
const NotificationService = require('./notificationService')
const opportunityTaskService = require('./opportunityTaskService')

const notificationService = new NotificationService()

/** Day bucket for idempotency: same assignee same day = one email + one task */
function assignmentHash(opportunityId, assigneeUserId) {
  const day = new Date().toISOString().slice(0, 10)
  return crypto.createHash('sha256').update(`${opportunityId}|${assigneeUserId}|${day}`).digest('hex')
}

/**
 * Create initial opportunity tasks: Eerste contact (1h) + Status bijwerken (24h). Idempotent.
 */
async function createFollowUpTasksIfNeeded(opportunityId, assigneeUserId, assignedByUserId, payload) {
  const payloadWithContact = {
    ...payload,
    companyContact: [payload.company_name, payload.contact_name].filter(Boolean).join(' – ') || 'Onbekend'
  }
  const { contactTaskId, statusTaskId } = await opportunityTaskService.createInitialOpportunityTasks(
    opportunityId,
    assigneeUserId,
    assignedByUserId,
    payloadWithContact
  )
  return contactTaskId
}

/**
 * Send assignment email via NotificationService (opportunity_assigned template).
 */
async function sendAssignmentEmail(assigneeUserId, opportunityId, payload) {
  try {
    return await notificationService.sendOpportunityAssigned(assigneeUserId, {
      opportunity_id: opportunityId,
      company_name: payload.company_name || 'Onbekend',
      contact_name: payload.contact_name ? ` – ${payload.contact_name}` : '',
      email: payload.email || '',
      phone: payload.phone || '',
      location: payload.location || '',
      message_summary: (payload.message_summary || '').slice(0, 300),
      stream_name: payload.stream_name || 'Kans'
    })
  } catch (e) {
    console.error('Opportunity assignment email failed:', e)
    return false
  }
}

/**
 * Single entry point: record assignment and run side-effects (email + task) idempotently.
 * Call after opportunity.assigned_to (and assigned_to_name) are set.
 *
 * @param {string} opportunityId - UUID
 * @param {string} assigneeUserId - profile/employee id
 * @param {string|null} assignedByUserId - who assigned (manual) or null for AI
 * @param {'ai'|'manual'} source
 * @returns {Promise<{ actionId?: string, emailSent?: boolean, taskId?: string }>}
 */
async function recordAssignmentAndNotify(opportunityId, assigneeUserId, assignedByUserId, source = 'manual') {
  if (!opportunityId || !assigneeUserId) return {}

  const hash = assignmentHash(opportunityId, assigneeUserId)

  const { data: existingAction } = await supabaseAdmin
    .from('opportunity_assignment_actions')
    .select('id, email_sent_at, task_id')
    .eq('assignment_hash', hash)
    .limit(1)
    .maybeSingle()

  if (existingAction && existingAction.email_sent_at) {
    return { actionId: existingAction.id, emailSent: true, taskId: existingAction.task_id || undefined }
  }

  const { data: opportunity } = await supabaseAdmin
    .from('opportunities')
    .select('id, company_name, contact_name, email, phone, address, city, postcode, message, assigned_to_name, meta')
    .eq('id', opportunityId)
    .single()

  if (!opportunity) return {}

  const location = [opportunity.address, opportunity.city, opportunity.postcode].filter(Boolean).join(', ') || ''
  const messageSummary = (opportunity.message || (opportunity.meta && opportunity.meta.message) || '').slice(0, 300)

  const payload = {
    company_name: opportunity.company_name || 'Onbekend',
    contact_name: opportunity.contact_name ? ` – ${opportunity.contact_name}` : '',
    email: opportunity.email || '',
    phone: opportunity.phone || '',
    location,
    message_summary: messageSummary,
    stream_name: (opportunity.meta && opportunity.meta.stream_name) || 'Kans'
  }

  let actionRow = existingAction
  if (!actionRow) {
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('opportunity_assignment_actions')
      .insert({
        opportunity_id: opportunityId,
        assignee_user_id: assigneeUserId,
        assignment_hash: hash,
        assigned_by_user_id: assignedByUserId || null,
        source
      })
      .select()
      .single()
    if (insertErr) {
      if (insertErr.code === '23505') return {}
      console.error('opportunity_assignment_actions insert error:', insertErr)
      return {}
    }
    actionRow = inserted
  }

  const emailSent = await sendAssignmentEmail(assigneeUserId, opportunityId, payload)
  const taskId = await createFollowUpTasksIfNeeded(opportunityId, assigneeUserId, assignedByUserId, payload)

  if (actionRow) {
    await supabaseAdmin
      .from('opportunity_assignment_actions')
      .update({
        email_sent_at: emailSent ? new Date().toISOString() : null,
        task_id: taskId
      })
      .eq('id', actionRow.id)
  }

  // Close any open follow-up task for this opportunity assigned to someone else (reassignment)
  await supabaseAdmin
    .from('employee_tasks')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('opportunity_id', opportunityId)
    .neq('employee_id', assigneeUserId)
    .in('status', ['open', 'in_progress'])

  return { actionId: actionRow?.id, emailSent, taskId: taskId || undefined }
}

module.exports = {
  recordAssignmentAndNotify,
  assignmentHash,
  createFollowUpTasksIfNeeded,
  sendAssignmentEmail
}
