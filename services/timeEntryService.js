'use strict'

const { supabaseAdmin } = require('../config/supabase')
const SystemLogService = require('./systemLogService')

/**
 * Time Entry Service
 * 
 * Handles time entry CRUD operations, week submission, and inline approvals
 */
class TimeEntryService {
  /**
   * Get time entries for employee
   * @param {string} employeeId - UUID of employee
   * @param {Object} filters - { status, start_date, end_date, limit, offset }
   * @returns {Promise<Object>} Time entries with pagination
   */
  static async getTimeEntries(employeeId, filters = {}) {
    try {
      let query = supabaseAdmin
        .from('time_entries')
        .select('*, task:employee_tasks!time_entries_task_id_fkey(id, title)', { count: 'exact' })
        .eq('employee_id', employeeId)
        .order('start_at', { ascending: false })

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status)
        } else {
          query = query.eq('status', filters.status)
        }
      }

      if (filters.start_date) {
        query = query.gte('start_at', filters.start_date)
      }

      if (filters.end_date) {
        query = query.lte('start_at', filters.end_date)
      }

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
      }

      const { data, error, count } = await query

      if (error) throw error

      return {
        time_entries: data || [],
        total: count || 0
      }
    } catch (error) {
      console.error('Error in getTimeEntries:', error)
      throw error
    }
  }

  /**
   * Get week overview for employee
   * @param {string} employeeId - UUID of employee
   * @param {Date} weekStart - Start of week (default: current week)
   * @returns {Promise<Object>} Week overview with totals
   */
  static async getWeekOverview(employeeId, weekStart = null) {
    try {
      if (!weekStart) {
        weekStart = new Date()
        // Get Monday of current week (Monday = 1, Sunday = 0)
        const day = weekStart.getDay()
        const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1)
        weekStart.setDate(diff)
        weekStart.setHours(0, 0, 0, 0)
      } else if (typeof weekStart === 'string') {
        weekStart = new Date(weekStart)
        weekStart.setHours(0, 0, 0, 0)
      }

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      const { data, error } = await supabaseAdmin
        .from('time_entries')
        .select('duration_minutes, status, start_at')
        .eq('employee_id', employeeId)
        .gte('start_at', weekStart.toISOString())
        .lte('start_at', weekEnd.toISOString())

      if (error) throw error

      const totals = {
        draft: { minutes: 0, count: 0 },
        submitted: { minutes: 0, count: 0 },
        approved: { minutes: 0, count: 0 },
        rejected: { minutes: 0, count: 0 },
        total: { minutes: 0, count: 0 }
      }

      data?.forEach(entry => {
        const minutes = entry.duration_minutes || 0
        totals[entry.status] = totals[entry.status] || { minutes: 0, count: 0 }
        totals[entry.status].minutes += minutes
        totals[entry.status].count += 1
        totals.total.minutes += minutes
        totals.total.count += 1
      })

      // Convert to hours
      Object.keys(totals).forEach(key => {
        totals[key].hours = Math.round((totals[key].minutes / 60) * 10) / 10
      })

      return {
        week_start: weekStart.toISOString(),
        week_end: weekEnd.toISOString(),
        entries: data || [],
        totals
      }
    } catch (error) {
      console.error('Error in getWeekOverview:', error)
      throw error
    }
  }

  /**
   * Create time entry (draft only for employees)
   * @param {Object} entryData - Time entry data
   * @param {string} actorId - UUID of user creating entry
   * @returns {Promise<Object>} Created time entry
   */
  static async createTimeEntry(entryData, actorId) {
    try {
      // Calculate duration if end_at provided
      let durationMinutes = entryData.duration_minutes || 0
      if (entryData.start_at && entryData.end_at) {
        const start = new Date(entryData.start_at)
        const end = new Date(entryData.end_at)
        durationMinutes = Math.round((end - start) / (1000 * 60))
      }

      const { data, error } = await supabaseAdmin
        .from('time_entries')
        .insert({
          employee_id: entryData.employee_id,
          task_id: entryData.task_id || null,
          customer_id: entryData.customer_id || null,
          contact_id: entryData.contact_id || null,
          project_name: entryData.project_name || null,
          start_at: entryData.start_at,
          end_at: entryData.end_at || null,
          duration_minutes: durationMinutes,
          note: entryData.note || null,
          status: 'draft', // Employees can only create drafts
          is_active_timer: entryData.is_active_timer || false
        })
        .select()
        .single()

      if (error) throw error

      // Log audit
      await this.logAudit(actorId, 'time_entry', data.id, 'created', { 
        duration_minutes: durationMinutes 
      })

      return data
    } catch (error) {
      console.error('Error creating time entry:', error)
      throw error
    }
  }

  /**
   * Update time entry (only draft for employees)
   * @param {string} entryId - UUID of time entry
   * @param {Object} updateData - Update data
   * @param {string} actorId - UUID of user making change
   * @returns {Promise<Object>} Updated time entry
   */
  static async updateTimeEntry(entryId, updateData, actorId) {
    try {
      // Recalculate duration if times changed
      if (updateData.start_at && updateData.end_at) {
        const start = new Date(updateData.start_at)
        const end = new Date(updateData.end_at)
        updateData.duration_minutes = Math.round((end - start) / (1000 * 60))
      }

      const { data, error } = await supabaseAdmin
        .from('time_entries')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', entryId)
        .select()
        .single()

      if (error) throw error

      // Log audit
      await this.logAudit(actorId, 'time_entry', entryId, 'updated', updateData)

      return data
    } catch (error) {
      console.error('Error updating time entry:', error)
      throw error
    }
  }

  /**
   * Submit week (change all draft entries to submitted)
   * @param {string} employeeId - UUID of employee
   * @param {Date} weekStart - Start of week
   * @param {string} actorId - UUID of user submitting
   * @returns {Promise<Object>} Submission result
   */
  static async submitWeek(employeeId, weekStart, actorId) {
    try {
      if (!weekStart) {
        weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        weekStart.setHours(0, 0, 0, 0)
      }

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      const { data, error } = await supabaseAdmin
        .from('time_entries')
        .update({
          status: 'submitted',
          updated_at: new Date().toISOString()
        })
        .eq('employee_id', employeeId)
        .eq('status', 'draft')
        .gte('start_at', weekStart.toISOString())
        .lte('start_at', weekEnd.toISOString())
        .select()

      if (error) throw error

      // Log audit
      await this.logAudit(actorId, 'time_entry', employeeId, 'week_submitted', { 
        week_start: weekStart.toISOString(),
        entries_count: data?.length || 0 
      })

      return {
        submitted_count: data?.length || 0,
        entries: data || []
      }
    } catch (error) {
      console.error('Error submitting week:', error)
      throw error
    }
  }

  /**
   * Approve time entry (inline)
   * @param {string} entryId - UUID of time entry
   * @param {string} actorId - UUID of approver
   * @returns {Promise<Object>} Approved time entry
   */
  static async approveTimeEntry(entryId, actorId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('time_entries')
        .update({
          status: 'approved',
          approved_by: actorId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', entryId)
        .select()
        .single()

      if (error) throw error

      // Log audit
      await this.logAudit(actorId, 'time_entry', entryId, 'approved', { 
        duration_minutes: data.duration_minutes 
      })

      return data
    } catch (error) {
      console.error('Error approving time entry:', error)
      throw error
    }
  }

  /**
   * Reject time entry (inline)
   * @param {string} entryId - UUID of time entry
   * @param {string} reason - Rejection reason
   * @param {string} actorId - UUID of rejector
   * @returns {Promise<Object>} Rejected time entry
   */
  static async rejectTimeEntry(entryId, reason, actorId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('time_entries')
        .update({
          status: 'rejected',
          rejected_by: actorId,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', entryId)
        .select()
        .single()

      if (error) throw error

      // Log audit
      await this.logAudit(actorId, 'time_entry', entryId, 'rejected', { reason })

      return data
    } catch (error) {
      console.error('Error rejecting time entry:', error)
      throw error
    }
  }

  /**
   * Get monthly totals
   * @param {string} employeeId - UUID of employee
   * @param {number} monthsBack - Number of months to look back (default: 3)
   * @returns {Promise<Object>} Monthly totals
   */
  static async getMonthlyTotals(employeeId, monthsBack = 3) {
    try {
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - monthsBack)
      startDate.setDate(1)
      startDate.setHours(0, 0, 0, 0)

      const { data, error } = await supabaseAdmin
        .from('time_entries')
        .select('start_at, duration_minutes, status')
        .eq('employee_id', employeeId)
        .gte('start_at', startDate.toISOString())
        .in('status', ['submitted', 'approved'])

      if (error) throw error

      const monthly = {}
      data?.forEach(entry => {
        const date = new Date(entry.start_at)
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        
        if (!monthly[monthKey]) {
          monthly[monthKey] = { minutes: 0, hours: 0, count: 0 }
        }
        
        monthly[monthKey].minutes += entry.duration_minutes || 0
        monthly[monthKey].count += 1
      })

      // Convert to hours
      Object.keys(monthly).forEach(key => {
        monthly[key].hours = Math.round((monthly[key].minutes / 60) * 10) / 10
      })

      return monthly
    } catch (error) {
      console.error('Error in getMonthlyTotals:', error)
      throw error
    }
  }

  /**
   * Clock in - Start a new active timer
   * @param {string} employeeId - UUID of employee
   * @param {Object} entryData - Initial entry data (project, customer, task, note)
   * @returns {Promise<Object>} Created active time entry
   */
  static async clockIn(employeeId, entryData = {}) {
    try {
      // Check if employee already has an active timer
      const { data: activeTimer } = await supabaseAdmin
        .from('time_entries')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('is_active_timer', true)
        .maybeSingle()

      if (activeTimer) {
        throw new Error('Employee already has an active timer')
      }

      const now = new Date()
      const { data, error } = await supabaseAdmin
        .from('time_entries')
        .insert({
          employee_id: employeeId,
          task_id: entryData.task_id || null,
          customer_id: entryData.customer_id || null,
          contact_id: entryData.contact_id || null,
          project_name: entryData.project_name || null,
          start_at: now.toISOString(),
          end_at: null,
          duration_minutes: 0,
          note: entryData.note || null,
          status: 'draft',
          is_active_timer: true
        })
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error clocking in:', error)
      throw error
    }
  }

  /**
   * Clock out - Stop active timer and calculate duration
   * @param {string} employeeId - UUID of employee
   * @param {Object} updateData - Optional updates (note, project, customer, task)
   * @returns {Promise<Object>} Updated time entry
   */
  static async clockOut(employeeId, updateData = {}) {
    try {
      // Get active timer
      const { data: activeTimer, error: fetchError } = await supabaseAdmin
        .from('time_entries')
        .select('id, start_at')
        .eq('employee_id', employeeId)
        .eq('is_active_timer', true)
        .single()

      if (fetchError || !activeTimer) {
        throw new Error('No active timer found')
      }

      const now = new Date()
      const start = new Date(activeTimer.start_at)
      const durationMinutes = Math.round((now - start) / (1000 * 60))

      // Update timer with end time and duration
      const { data, error } = await supabaseAdmin
        .from('time_entries')
        .update({
          end_at: now.toISOString(),
          duration_minutes: durationMinutes,
          is_active_timer: false,
          ...updateData,
          updated_at: now.toISOString()
        })
        .eq('id', activeTimer.id)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error clocking out:', error)
      throw error
    }
  }

  /**
   * Get active timer for employee
   * @param {string} employeeId - UUID of employee
   * @returns {Promise<Object|null>} Active time entry or null
   */
  static async getActiveTimer(employeeId) {
    try {
      // First try with full joins, but handle errors gracefully
      let query = supabaseAdmin
        .from('time_entries')
        .select('*, task:employee_tasks!time_entries_task_id_fkey(id, title), customer:profiles!time_entries_customer_id_fkey(id, first_name, last_name, company_name, email), contact:contacts!time_entries_contact_id_fkey(id, first_name, last_name, email)')
        .eq('employee_id', employeeId)
        .eq('is_active_timer', true)
        .maybeSingle()

      let { data, error } = await query

      // If foreign key joins fail, try without them
      if (error && (error.message?.includes('relation') || error.message?.includes('foreign key') || error.code === 'PGRST116')) {
        console.warn('Foreign key joins failed, trying without joins:', error.message)
        const simpleQuery = supabaseAdmin
          .from('time_entries')
          .select('*')
          .eq('employee_id', employeeId)
          .eq('is_active_timer', true)
          .maybeSingle()
        
        const result = await simpleQuery
        data = result.data
        error = result.error
      }

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error getting active timer:', error)
      throw error
    }
  }

  /**
   * Update active timer (e.g., change project, customer, task, note)
   * @param {string} employeeId - UUID of employee
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated time entry
   */
  static async updateActiveTimer(employeeId, updateData) {
    try {
      const { data: activeTimer } = await supabaseAdmin
        .from('time_entries')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('is_active_timer', true)
        .maybeSingle()

      if (!activeTimer) {
        throw new Error('No active timer found')
      }

      const { data, error } = await supabaseAdmin
        .from('time_entries')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', activeTimer.id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating active timer:', error)
      throw error
    }
  }

  /**
   * Switch task - Close current active timer and start new one immediately
   * This allows switching tasks without clocking out
   * @param {string} employeeId - UUID of employee
   * @param {Object} newEntryData - New entry data (project, customer, task, note)
   * @returns {Promise<Object>} New active time entry
   */
  static async switchTask(employeeId, newEntryData = {}) {
    try {
      // Get current active timer
      const { data: activeTimer, error: fetchError } = await supabaseAdmin
        .from('time_entries')
        .select('id, start_at')
        .eq('employee_id', employeeId)
        .eq('is_active_timer', true)
        .maybeSingle()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      const now = new Date()

      // If there's an active timer, close it first
      if (activeTimer) {
        const start = new Date(activeTimer.start_at)
        const durationMinutes = Math.round((now - start) / (1000 * 60))

        await supabaseAdmin
          .from('time_entries')
          .update({
            end_at: now.toISOString(),
            duration_minutes: durationMinutes,
            is_active_timer: false,
            updated_at: now.toISOString()
          })
          .eq('id', activeTimer.id)
      }

      // Start new timer immediately
      const { data, error } = await supabaseAdmin
        .from('time_entries')
        .insert({
          employee_id: employeeId,
          task_id: newEntryData.task_id || null,
          customer_id: newEntryData.customer_id || null,
          project_name: newEntryData.project_name || null,
          start_at: now.toISOString(),
          end_at: null,
          duration_minutes: 0,
          note: newEntryData.note || null,
          status: 'draft',
          is_active_timer: true
        })
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error switching task:', error)
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

module.exports = TimeEntryService

