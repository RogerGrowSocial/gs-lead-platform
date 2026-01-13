'use strict'

const { supabaseAdmin } = require('../config/supabase')
const SystemLogService = require('./systemLogService')

/**
 * Payout Service
 * 
 * Handles payout calculations, creation, and management
 */
class PayoutService {
  /**
   * Calculate earnings for period
   * @param {string} employeeId - UUID of employee
   * @param {Date} periodStart - Start date
   * @param {Date} periodEnd - End date
   * @returns {Promise<Object>} Earnings breakdown
   */
  static async calculateEarnings(employeeId, periodStart, periodEnd) {
    try {
      // Get employee hourly rate
      const { data: employee } = await supabaseAdmin
        .from('profiles')
        .select('hourly_rate_cents')
        .eq('id', employeeId)
        .single()

      const hourlyRateCents = employee?.hourly_rate_cents || 0

      // Get approved time entries in period (not yet paid)
      const { data: timeEntries } = await supabaseAdmin
        .from('time_entries')
        .select('id, duration_minutes, start_at')
        .eq('employee_id', employeeId)
        .eq('status', 'approved')
        .gte('start_at', periodStart.toISOString())
        .lte('start_at', periodEnd.toISOString())

      // Check which entries are already paid
      const { data: paidEntries } = await supabaseAdmin
        .from('payout_items')
        .select('source_id')
        .eq('source_type', 'time_entry')
        .eq('employee_id', employeeId)

      const paidEntryIds = new Set(paidEntries?.map(pi => pi.source_id) || [])
      const unpaidTimeEntries = timeEntries?.filter(te => !paidEntryIds.has(te.id)) || []

      // Calculate time entry earnings
      const timeEntryEarnings = unpaidTimeEntries.reduce((sum, te) => {
        const hours = (te.duration_minutes || 0) / 60
        return sum + (hours * hourlyRateCents)
      }, 0)

      // Get approved tasks in period (not yet paid)
      const { data: tasks } = await supabaseAdmin
        .from('employee_tasks')
        .select('id, value_cents, approved_at')
        .eq('employee_id', employeeId)
        .eq('status', 'done')
        .not('approved_at', 'is', null)
        .gte('approved_at', periodStart.toISOString())
        .lte('approved_at', periodEnd.toISOString())

      // Check which tasks are already paid
      const { data: paidTasks } = await supabaseAdmin
        .from('payout_items')
        .select('source_id')
        .eq('source_type', 'task')
        .eq('employee_id', employeeId)

      const paidTaskIds = new Set(paidTasks?.map(pi => pi.source_id) || [])
      const unpaidTasks = tasks?.filter(t => !paidTaskIds.has(t.id)) || []

      // Calculate task earnings
      const taskEarnings = unpaidTasks.reduce((sum, t) => sum + (t.value_cents || 0), 0)

      const totalEarnings = timeEntryEarnings + taskEarnings

      return {
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        hourly_rate_cents: hourlyRateCents,
        time_entries: {
          count: unpaidTimeEntries.length,
          hours: Math.round((unpaidTimeEntries.reduce((sum, te) => sum + (te.duration_minutes || 0), 0) / 60) * 10) / 10,
          earnings_cents: Math.round(timeEntryEarnings)
        },
        tasks: {
          count: unpaidTasks.length,
          earnings_cents: taskEarnings
        },
        total_earnings_cents: Math.round(totalEarnings),
        breakdown: {
          time_entry_ids: unpaidTimeEntries.map(te => te.id),
          task_ids: unpaidTasks.map(t => t.id)
        }
      }
    } catch (error) {
      console.error('Error calculating earnings:', error)
      throw error
    }
  }

  /**
   * Get payouts for employee
   * @param {string} employeeId - UUID of employee
   * @param {Object} filters - { limit, offset }
   * @returns {Promise<Object>} Payouts with pagination
   */
  static async getPayouts(employeeId, filters = {}) {
    try {
      let query = supabaseAdmin
        .from('payout_items')
        .select(`
          *,
          batch:payout_batches!payout_items_batch_id_fkey(
            id,
            period_start,
            period_end,
            status,
            created_at,
            paid_at
          )
        `, { count: 'exact' })
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
      }

      const { data, error, count } = await query

      if (error) throw error

      // Group by batch
      const batches = {}
      data?.forEach(item => {
        const batchId = item.batch_id
        if (!batches[batchId]) {
          batches[batchId] = {
            batch: item.batch,
            items: [],
            total_cents: 0
          }
        }
        batches[batchId].items.push(item)
        batches[batchId].total_cents += item.amount_cents || 0
      })

      return {
        payouts: Object.values(batches),
        total: count || 0
      }
    } catch (error) {
      console.error('Error in getPayouts:', error)
      throw error
    }
  }

  /**
   * Create payout batch
   * @param {Object} payoutData - Payout data
   * @param {string} actorId - UUID of user creating payout
   * @returns {Promise<Object>} Created payout batch
   */
  static async createPayout(payoutData, actorId) {
    try {
      const periodStart = new Date(payoutData.period_start)
      const periodEnd = new Date(payoutData.period_end)

      // Calculate earnings for employee
      const earnings = await this.calculateEarnings(
        payoutData.employee_id,
        periodStart,
        periodEnd
      )

      if (earnings.total_earnings_cents <= 0) {
        throw new Error('No earnings to payout for this period')
      }

      // Create payout batch
      const { data: batch, error: batchError } = await supabaseAdmin
        .from('payout_batches')
        .insert({
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          status: 'draft',
          created_by: actorId,
          total_amount_cents: earnings.total_earnings_cents,
          note: payoutData.note || null
        })
        .select()
        .single()

      if (batchError) throw batchError

      // Create payout items for time entries
      const timeEntryItems = earnings.breakdown.time_entry_ids.map(teId => ({
        batch_id: batch.id,
        employee_id: payoutData.employee_id,
        amount_cents: Math.round((earnings.time_entries.earnings_cents / earnings.time_entries.count) || 0), // Simplified: equal split
        source_type: 'time_entry',
        source_id: teId,
        note: 'Time entry earnings'
      }))

      // Get task details for payout items
      const { data: tasksData } = await supabaseAdmin
        .from('employee_tasks')
        .select('id, value_cents')
        .in('id', earnings.breakdown.task_ids)

      // Create payout items for tasks
      const taskItems = (tasksData || []).map(task => ({
        batch_id: batch.id,
        employee_id: payoutData.employee_id,
        amount_cents: task.value_cents || 0,
        source_type: 'task',
        source_id: task.id,
        note: 'Task completion payment'
      }))

      // Insert all items
      const allItems = [...timeEntryItems, ...taskItems]
      if (allItems.length > 0) {
        // Recalculate amounts to match total exactly
        const totalCalculated = allItems.reduce((sum, item) => sum + item.amount_cents, 0)
        const adjustment = earnings.total_earnings_cents - totalCalculated
        
        if (adjustment !== 0 && allItems.length > 0) {
          // Add adjustment to first item
          allItems[0].amount_cents += adjustment
        }

        const { error: itemsError } = await supabaseAdmin
          .from('payout_items')
          .insert(allItems)

        if (itemsError) throw itemsError
      }

      // Log audit
      await this.logAudit(actorId, 'payout_batch', batch.id, 'created', {
        employee_id: payoutData.employee_id,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        total_cents: earnings.total_earnings_cents
      })

      // Get full batch with items
      const { data: fullBatch } = await supabaseAdmin
        .from('payout_batches')
        .select(`
          *,
          items:payout_items(*)
        `)
        .eq('id', batch.id)
        .single()

      return fullBatch
    } catch (error) {
      console.error('Error creating payout:', error)
      throw error
    }
  }

  /**
   * Approve payout batch
   * @param {string} batchId - UUID of payout batch
   * @param {string} actorId - UUID of approver
   * @returns {Promise<Object>} Approved payout batch
   */
  static async approvePayout(batchId, actorId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('payout_batches')
        .update({
          status: 'approved',
          approved_by: actorId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', batchId)
        .select()
        .single()

      if (error) throw error

      // Log audit
      await this.logAudit(actorId, 'payout_batch', batchId, 'approved', {
        total_cents: data.total_amount_cents
      })

      return data
    } catch (error) {
      console.error('Error approving payout:', error)
      throw error
    }
  }

  /**
   * Mark payout as paid
   * @param {string} batchId - UUID of payout batch
   * @param {string} actorId - UUID of user marking as paid
   * @returns {Promise<Object>} Updated payout batch
   */
  static async markPayoutPaid(batchId, actorId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('payout_batches')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', batchId)
        .select()
        .single()

      if (error) throw error

      // Log audit
      await this.logAudit(actorId, 'payout_batch', batchId, 'marked_paid', {
        total_cents: data.total_amount_cents
      })

      return data
    } catch (error) {
      console.error('Error marking payout as paid:', error)
      throw error
    }
  }

  /**
   * Log audit entry
   * @private
   */
  static async logAudit(actorId, entityType, entityId, action, meta = {}) {
    try {
      await supabaseAdmin
        .from('audit_log')
        .insert({
          actor_user_id: actorId,
          entity_type: entityType,
          entity_id: entityId,
          action: action,
          meta: meta
        })
    } catch (error) {
      console.error('Error logging audit:', error)
      // Don't throw - audit logging should not break the flow
    }
  }
}

module.exports = PayoutService

