'use strict'

const { supabaseAdmin } = require('../config/supabase')
const TaskService = require('./taskService')

/**
 * Slim taaksysteem voor kansen: per fase een duidelijke taak, geen duplicaten.
 *
 * Taaktypes:
 * - opportunity_contact   Bij toewijzing: eerste contact (due 1u)
 * - opportunity_status   Bij toewijzing: status bijwerken (due 24u)
 * - opportunity_next_step  Bij status=contacted: volgende stap / afspraak inplannen (due +3d)
 * - opportunity_appointment  Bij status=appointment_set: afspraak voorbereiden (due +2d)
 */
const TASK_CONFIG = {
  opportunity_contact: {
    titleKey: 'Eerste contact',
    dueHours: 1,
    priority: 'high'
  },
  opportunity_status: {
    titleKey: 'Status bijwerken',
    dueHours: 24,
    priority: 'high'
  },
  opportunity_next_step: {
    titleKey: 'Volgende stap (afspraak/offerte)',
    dueHours: 24 * 3,
    priority: 'medium'
  },
  opportunity_appointment: {
    titleKey: 'Afspraak voorbereiden',
    dueHours: 24 * 2,
    priority: 'high'
  }
}

async function getOpportunityPayload(opportunityId) {
  const { data: opp } = await supabaseAdmin
    .from('opportunities')
    .select('id, company_name, contact_name, email, phone, message, assigned_to, meta')
    .eq('id', opportunityId)
    .single()
  if (!opp) return null
  const companyContact = [opp.company_name, opp.contact_name].filter(Boolean).join(' – ') || 'Onbekend'
  const baseUrl = process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000'
  const oppUrl = `${baseUrl.replace(/\/$/, '')}/admin/opportunities/${opportunityId}`
  const messageSummary = (opp.message || (opp.meta && opp.meta.message) || '').slice(0, 300)
  return {
    companyContact,
    oppUrl,
    messageSummary,
    phone: opp.phone || '',
    email: opp.email || ''
  }
}

/**
 * Create one task of the given type for this opportunity + assignee if it doesn't exist yet.
 * @param {string} opportunityId
 * @param {string} assigneeUserId
 * @param {keyof TASK_CONFIG} taskType
 * @param {string} [actorId] Created_by
 * @returns {Promise<string|null>} Task id or null
 */
async function ensureOpportunityTask(opportunityId, assigneeUserId, taskType, actorId = null) {
  const config = TASK_CONFIG[taskType]
  if (!config) return null

  const { data: existing } = await supabaseAdmin
    .from('employee_tasks')
    .select('id')
    .eq('opportunity_id', opportunityId)
    .eq('employee_id', assigneeUserId)
    .eq('task_type', taskType)
    .in('status', ['open', 'in_progress', 'in_review'])
    .limit(1)
  if (existing && existing.length > 0) return existing[0].id

  const payload = await getOpportunityPayload(opportunityId)
  if (!payload) return null

  const dueAt = new Date(Date.now() + config.dueHours * 60 * 60 * 1000)
  const title = `${config.titleKey}: ${payload.companyContact}`
  const description = [
    payload.messageSummary ? `Bericht: ${payload.messageSummary}` : null,
    payload.phone ? `Tel: ${payload.phone}` : null,
    payload.email ? `Email: ${payload.email}` : null,
    `\nOpen kans: ${payload.oppUrl}`
  ].filter(Boolean).join('\n')

  const task = await TaskService.createTask({
    employee_id: assigneeUserId,
    title,
    description,
    priority: config.priority,
    due_at: dueAt.toISOString(),
    opportunity_id: opportunityId,
    task_type: taskType
  }, actorId || assigneeUserId)

  return task?.id || null
}

/**
 * Create initial task pair on assignment: contact (1h) + status (24h).
 * Idempotent: if open opportunity_contact already exists for (opp, assignee), skip and return existing ids.
 * Returns { contactTaskId, statusTaskId }.
 */
async function createInitialOpportunityTasks(opportunityId, assigneeUserId, actorId, payload) {
  const { data: existingContact } = await supabaseAdmin
    .from('employee_tasks')
    .select('id')
    .eq('opportunity_id', opportunityId)
    .eq('employee_id', assigneeUserId)
    .eq('task_type', 'opportunity_contact')
    .in('status', ['open', 'in_progress', 'in_review'])
    .limit(1)
  if (existingContact?.length) {
    const contactId = existingContact[0].id
    const { data: existingStatus } = await supabaseAdmin
      .from('employee_tasks')
      .select('id')
      .eq('opportunity_id', opportunityId)
      .eq('employee_id', assigneeUserId)
      .eq('task_type', 'opportunity_status')
      .in('status', ['open', 'in_progress', 'in_review'])
      .limit(1)
    return {
      contactTaskId: contactId,
      statusTaskId: existingStatus?.length ? existingStatus[0].id : null
    }
  }

  const companyContact = payload.companyContact || [payload.company_name, payload.contact_name].filter(Boolean).join(' – ') || 'Onbekend'
  const baseUrl = process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000'
  const oppUrl = `${baseUrl.replace(/\/$/, '')}/admin/opportunities/${opportunityId}`

  const contactDue = new Date(Date.now() + 60 * 60 * 1000)
  const contactTask = await TaskService.createTask({
    employee_id: assigneeUserId,
    title: `Eerste contact: ${companyContact}`,
    description: [
      payload.message_summary ? `Bericht: ${payload.message_summary}` : null,
      payload.phone ? `Tel: ${payload.phone}` : null,
      payload.email ? `Email: ${payload.email}` : null,
      `\nOpen kans: ${oppUrl}`
    ].filter(Boolean).join('\n'),
    priority: 'high',
    due_at: contactDue.toISOString(),
    opportunity_id: opportunityId,
    task_type: 'opportunity_contact'
  }, actorId || assigneeUserId)

  const statusDue = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const statusTask = await TaskService.createTask({
    employee_id: assigneeUserId,
    title: `Status bijwerken: ${companyContact}`,
    description: `Zet de sales status na eerste contact.\n\nOpen kans: ${oppUrl}`,
    priority: 'high',
    due_at: statusDue.toISOString(),
    opportunity_id: opportunityId,
    task_type: 'opportunity_status'
  }, actorId || assigneeUserId)

  return {
    contactTaskId: contactTask?.id || null,
    statusTaskId: statusTask?.id || null
  }
}

module.exports = {
  ensureOpportunityTask,
  createInitialOpportunityTasks,
  getOpportunityPayload,
  TASK_CONFIG
}
