'use strict'

const { supabaseAdmin } = require('../config/supabase')
const SystemLogService = require('./systemLogService')

/**
 * Task Service
 * 
 * Handles employee task CRUD operations and inline approvals
 */
class TaskService {
  /**
   * Get tasks for employee with filters
   * @param {string} employeeId - UUID of employee
   * @param {Object} filters - { status, priority, limit, offset }
   * @returns {Promise<Object>} Tasks with pagination
   */
  static async getTasks(employeeId, filters = {}) {
    try {
      let query = supabaseAdmin
        .from('employee_tasks')
        .select('*, customer:profiles!employee_tasks_customer_id_fkey(id, first_name, last_name, company_name, email), contact:contacts!employee_tasks_contact_id_fkey(id, first_name, last_name, email)', { count: 'exact' })
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status)
        } else {
          query = query.eq('status', filters.status)
        }
      }

      if (filters.priority) {
        query = query.eq('priority', filters.priority)
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
        tasks: data || [],
        total: count || 0
      }
    } catch (error) {
      console.error('Error in getTasks:', error)
      throw error
    }
  }

  /**
   * Create task
   * @param {Object} taskData - Task data
   * @param {string} actorId - UUID of user creating task
   * @returns {Promise<Object>} Created task
   */
  static async createTask(taskData, actorId) {
    try {
      const insertData = {
        employee_id: taskData.employee_id,
        customer_id: taskData.customer_id || null,
        contact_id: taskData.contact_id || null,
        title: taskData.title,
        description: taskData.description || null,
        status: 'open',
        priority: taskData.priority || 'medium',
        value_cents: taskData.value_cents || 0,
        due_at: taskData.due_at || null,
        created_by: actorId
      };
      
      // Add recurrence fields if provided (only if table supports them)
      if (taskData.is_recurring) {
        if (taskData.recurrence_frequency) insertData.recurrence_frequency = taskData.recurrence_frequency;
        if (taskData.recurrence_interval) insertData.recurrence_interval = taskData.recurrence_interval;
        if (taskData.recurrence_end_date) insertData.recurrence_end_date = taskData.recurrence_end_date;
        if (taskData.recurrence_count) insertData.recurrence_count = taskData.recurrence_count;
        if (taskData.recurrence_days_of_week) insertData.recurrence_days_of_week = taskData.recurrence_days_of_week;
        insertData.is_recurring = true;
      }
      
      const { data, error } = await supabaseAdmin
        .from('employee_tasks')
        .insert(insertData)
        .select()
        .single()

      if (error) throw error

      // Log audit
      await this.logAudit(actorId, 'employee_task', data.id, 'created', { task_title: data.title })

      return data
    } catch (error) {
      console.error('Error creating task:', error)
      throw error
    }
  }

  /**
   * Update task status
   * @param {string} taskId - UUID of task
   * @param {string} newStatus - New status
   * @param {string} actorId - UUID of user making change
   * @returns {Promise<Object>} Updated task
   */
  static async updateTaskStatus(taskId, newStatus, actorId) {
    try {
      const updateData = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      if (newStatus === 'in_review') {
        // Employee marking as ready for review
        updateData.status = 'in_review'
      }

      const { data, error } = await supabaseAdmin
        .from('employee_tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()
        .single()

      if (error) throw error

      // Log audit
      await this.logAudit(actorId, 'employee_task', taskId, 'status_changed', { 
        old_status: data.status, 
        new_status: newStatus 
      })

      return data
    } catch (error) {
      console.error('Error updating task status:', error)
      throw error
    }
  }

  /**
   * Approve task (inline)
   * @param {string} taskId - UUID of task
   * @param {string} actorId - UUID of approver
   * @returns {Promise<Object>} Approved task
   */
  static async approveTask(taskId, actorId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('employee_tasks')
        .update({
          status: 'done',
          approved_by: actorId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single()

      if (error) throw error

      // Log audit
      await this.logAudit(actorId, 'employee_task', taskId, 'approved', { 
        task_title: data.title,
        value_cents: data.value_cents 
      })

      return data
    } catch (error) {
      console.error('Error approving task:', error)
      throw error
    }
  }

  /**
   * Reject task (inline)
   * @param {string} taskId - UUID of task
   * @param {string} reason - Rejection reason
   * @param {string} actorId - UUID of rejector
   * @returns {Promise<Object>} Rejected task
   */
  static async rejectTask(taskId, reason, actorId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('employee_tasks')
        .update({
          status: 'rejected',
          rejected_by: actorId,
          rejected_at: new Date().toISOString(),
          rejection_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single()

      if (error) throw error

      // Log audit
      await this.logAudit(actorId, 'employee_task', taskId, 'rejected', { 
        task_title: data.title,
        reason 
      })

      return data
    } catch (error) {
      console.error('Error rejecting task:', error)
      throw error
    }
  }

  /**
   * Add note to task
   * @param {string} taskId - UUID of task
   * @param {string} note - Note text
   * @param {string} actorId - UUID of user adding note
   * @returns {Promise<Object>} Updated task
   */
  static async addTaskNote(taskId, note, actorId) {
    try {
      // For now, we'll update the description or create a notes field
      // In future, could have separate task_notes table
      const { data: task } = await supabaseAdmin
        .from('employee_tasks')
        .select('description')
        .eq('id', taskId)
        .single()

      const updatedDescription = (task?.description || '') + `\n\n[${new Date().toLocaleString('nl-NL')}] ${note}`

      const { data, error } = await supabaseAdmin
        .from('employee_tasks')
        .update({
          description: updatedDescription,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single()

      if (error) throw error

      return data
    } catch (error) {
      console.error('Error adding task note:', error)
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

module.exports = TaskService

