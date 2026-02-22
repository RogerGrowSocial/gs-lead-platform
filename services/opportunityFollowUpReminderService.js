'use strict'

const { supabaseAdmin } = require('../config/supabase')
const NotificationService = require('./notificationService')
const EmailService = require('./emailService')

const notificationService = new NotificationService()
const emailService = new EmailService()

const REMINDER_TYPES = ['day1', 'day3', 'day7_escalation']
const ONE_DAY_MS = 24 * 60 * 60 * 1000

/**
 * Get assignment timestamp for an opportunity: assigned_at or latest opportunity_assignment_actions.created_at.
 */
async function getAssignmentTime(opportunity) {
  if (opportunity.assigned_at) return new Date(opportunity.assigned_at).getTime()
  const { data: actions } = await supabaseAdmin
    .from('opportunity_assignment_actions')
    .select('created_at')
    .eq('opportunity_id', opportunity.id)
    .order('created_at', { ascending: false })
    .limit(1)
  return actions?.[0]?.created_at ? new Date(actions[0].created_at).getTime() : null
}

/**
 * Check if opportunity is "handled" (no reminders needed): sales_status != 'new' or follow-up task completed.
 */
async function isHandled(opportunityId, assigneeUserId) {
  const { data: opp } = await supabaseAdmin
    .from('opportunities')
    .select('sales_status')
    .eq('id', opportunityId)
    .single()
  if (opp && opp.sales_status !== 'new') return true
  const { data: task } = await supabaseAdmin
    .from('employee_tasks')
    .select('id, status')
    .eq('opportunity_id', opportunityId)
    .eq('employee_id', assigneeUserId)
    .limit(1)
    .maybeSingle()
  return task?.status === 'done'
}

/**
 * Get user IDs and emails for manager and admin roles (escalation recipients).
 */
async function getManagerAndAdminUserIds() {
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, is_admin, role_id')
  if (!profiles?.length) return []
  const roleIds = [...new Set(profiles.map(p => p.role_id).filter(Boolean))]
  const { data: roles } = await supabaseAdmin
    .from('roles')
    .select('id, name')
    .in('id', roleIds)
  const roleNameById = (roles || []).reduce((acc, r) => { acc[r.id] = (r.name || '').toLowerCase(); return acc }, {})
  const managerOrAdminIds = profiles
    .filter(p => p.is_admin === true || (roleNameById[p.role_id] || '').includes('manager'))
    .map(p => p.id)
  return managerOrAdminIds
}

/**
 * Send reminder email to assignee (day1 or day3). Uses a simple inline template for MVP.
 */
async function sendReminderToAssignee(userId, opportunityId, payload, reminderType) {
  const subject = reminderType === 'day3'
    ? `Herinnering: kans nog niet bijgewerkt – ${payload.company_name || 'Kans'}`
    : `Herinnering: volg kans – ${payload.company_name || 'Kans'}`
  const days = reminderType === 'day3' ? '3' : '1'
  const baseUrl = process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000'
  const url = `${baseUrl.replace(/\/$/, '')}/admin/opportunities/${opportunityId}#status`
  const html = `
    <p>Deze kans is ${days} dag(en) geleden aan jou toegewezen en heeft nog status "Nieuw".</p>
    <p><strong>${payload.company_name || 'Onbekend'}</strong> – ${payload.contact_name || ''}</p>
    <p><a href="${url}">Update de status van deze kans</a></p>
  `
  try {
    const { data: profile } = await supabaseAdmin.from('profiles').select('email, first_name').eq('id', userId).single()
    if (!profile?.email) return false
    return await emailService.sendEmail({ to: profile.email, subject, html })
  } catch (e) {
    console.error('Reminder email failed:', e)
    return false
  }
}

/**
 * Send escalation email to manager/admin list. Concise summary + link.
 */
async function sendEscalationToManagers(recipientUserIds, opportunityId, payload, assigneeName, daysStale) {
  const baseUrl = process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000'
  const url = `${baseUrl.replace(/\/$/, '')}/admin/opportunities/${opportunityId}`
  const subject = `Escalatie: kans niet bijgewerkt na ${daysStale} dagen – ${payload.company_name || 'Kans'}`
  const html = `
    <p>Deze kans is na ${daysStale} dagen nog niet bijgewerkt.</p>
    <p><strong>Toegewezen aan:</strong> ${assigneeName || 'Onbekend'}</p>
    <p><strong>Kans:</strong> ${payload.company_name || 'Onbekend'} – ${payload.contact_name || ''}</p>
    <p><a href="${url}">Bekijk kans</a></p>
  `
  let sent = 0
  for (const userId of recipientUserIds) {
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('id', userId).single()
      if (profile?.email && await emailService.sendEmail({ to: profile.email, subject, html })) sent++
    } catch (e) {
      console.error('Escalation email failed for', userId, e)
    }
  }
  return sent
}

/**
 * Run reminder logic: find assigned opportunities with sales_status='new', not handled,
 * and send day1/day3/day7_escalation once per type, recording in opportunity_followup_reminders.
 */
async function runReminders() {
  const now = Date.now()
  const results = { day1: 0, day3: 0, day7_escalation: 0, errors: [] }

  const { data: opportunities, error: oppErr } = await supabaseAdmin
    .from('opportunities')
    .select('id, assigned_to, assigned_to_name, company_name, contact_name, assigned_at')
    .not('assigned_to', 'is', null)
    .eq('sales_status', 'new')

  if (oppErr || !opportunities?.length) return results

  const managerAdminIds = await getManagerAndAdminUserIds()

  for (const opp of opportunities) {
    const assigneeUserId = opp.assigned_to
    if (!assigneeUserId) continue
    const handled = await isHandled(opp.id, assigneeUserId)
    if (handled) continue

    const assignedAt = await getAssignmentTime(opp)
    if (!assignedAt) continue
    const ageDays = (now - assignedAt) / ONE_DAY_MS

    const payload = { company_name: opp.company_name || 'Onbekend', contact_name: opp.contact_name || '' }

    for (const reminderType of REMINDER_TYPES) {
      const threshold = reminderType === 'day1' ? 1 : reminderType === 'day3' ? 3 : 7
      if (ageDays < threshold) continue

      const { data: existing } = await supabaseAdmin
        .from('opportunity_followup_reminders')
        .select('id')
        .eq('opportunity_id', opp.id)
        .eq('reminder_type', reminderType)
        .limit(1)
      if (existing?.length) continue

      try {
        if (reminderType === 'day7_escalation') {
          await sendEscalationToManagers(managerAdminIds, opp.id, payload, opp.assigned_to_name, 7)
          await sendReminderToAssignee(assigneeUserId, opp.id, payload, 'day7_escalation')
        } else {
          await sendReminderToAssignee(assigneeUserId, opp.id, payload, reminderType)
        }
        await supabaseAdmin.from('opportunity_followup_reminders').insert({
          opportunity_id: opp.id,
          assignee_user_id: assigneeUserId,
          reminder_type: reminderType
        })
        results[reminderType]++
      } catch (e) {
        results.errors.push({ opportunityId: opp.id, reminderType, message: e.message })
      }
    }
  }

  return results
}

module.exports = {
  runReminders,
  getAssignmentTime,
  isHandled,
  getManagerAndAdminUserIds
}
