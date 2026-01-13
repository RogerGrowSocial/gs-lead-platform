'use strict'

const { supabaseAdmin } = require('../config/supabase')
const SystemLogService = require('./systemLogService')

/**
 * Employee Service
 * 
 * Handles employee profile operations, KPI calculations, and role-based metrics
 */
class EmployeeService {
  /**
   * Get employee summary with role-based KPIs
   * @param {string} employeeId - UUID of employee
   * @returns {Promise<Object>} Employee summary with KPIs
   */
  static async getEmployeeSummary(employeeId) {
    try {
      // Get employee profile
      const { data: employee, error: empError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, first_name, last_name, role_id, manager_id, hourly_rate_cents, employee_status, is_admin, status')
        .eq('id', employeeId)
        .single()

      if (empError || !employee) {
        throw new Error(`Employee not found: ${employeeId}`)
      }

      // Get role name
      let roleName = 'employee'
      if (employee.role_id) {
        const { data: role } = await supabaseAdmin
          .from('roles')
          .select('name, display_name')
          .eq('id', employee.role_id)
          .maybeSingle()
        
        if (role) {
          roleName = role.name || 'employee'
        }
      }

      // Get manager info if exists
      let manager = null
      if (employee.manager_id) {
        const { data: mgr } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, email')
          .eq('id', employee.manager_id)
          .maybeSingle()
        
        if (mgr) {
          manager = {
            id: mgr.id,
            name: `${mgr.first_name || ''} ${mgr.last_name || ''}`.trim() || mgr.email
          }
        }
      }

      // Calculate role-based KPIs
      const kpis = await this.calculateRoleBasedKPIs(employeeId, roleName)

      // Get quick counts
      const quickCounts = await this.getQuickCounts(employeeId)

      return {
        employee: {
          ...employee,
          role_name: roleName,
          manager
        },
        kpis,
        quickCounts
      }
    } catch (error) {
      console.error('Error in getEmployeeSummary:', error)
      throw error
    }
  }

  /**
   * Calculate role-based KPIs
   * @param {string} employeeId - UUID of employee
   * @param {string} roleName - Role name (ops, sales, support)
   * @returns {Promise<Object>} Role-specific KPIs
   */
  static async calculateRoleBasedKPIs(employeeId, roleName) {
    const role = roleName.toLowerCase()

    // Ops medewerker KPIs
    if (role === 'ops' || role === 'operations' || role === 'employee') {
      const { data: tasks } = await supabaseAdmin
        .from('employee_tasks')
        .select('status, value_cents')
        .eq('employee_id', employeeId)

      const openTasks = tasks?.filter(t => ['open', 'in_progress'].includes(t.status)).length || 0
      const inReview = tasks?.filter(t => t.status === 'in_review').length || 0
      
      // Hours this week
      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      weekStart.setHours(0, 0, 0, 0)

      const { data: timeEntries } = await supabaseAdmin
        .from('time_entries')
        .select('duration_minutes, status')
        .eq('employee_id', employeeId)
        .gte('start_at', weekStart.toISOString())

      const hoursThisWeek = (timeEntries?.reduce((sum, te) => {
        if (['submitted', 'approved'].includes(te.status)) {
          return sum + (te.duration_minutes || 0)
        }
        return sum
      }, 0) || 0) / 60

      // Value delivered (approved tasks)
      const valueDelivered = tasks?.filter(t => t.status === 'done' && t.approved_at)
        .reduce((sum, t) => sum + (t.value_cents || 0), 0) || 0

      return {
        open_tasks: openTasks,
        in_review: inReview,
        hours_this_week: Math.round(hoursThisWeek * 10) / 10,
        value_delivered_cents: valueDelivered
      }
    }

    // Sales medewerker KPIs
    if (role === 'sales' || role === 'account_manager') {
      // Get deals/opportunities (assuming they're in leads table with status)
      const { data: leads } = await supabaseAdmin
        .from('leads')
        .select('status, price_at_purchase, created_at, accepted_at')
        .eq('user_id', employeeId)

      const dealsWon = leads?.filter(l => ['won', 'completed', 'converted'].includes(l.status)).length || 0
      const totalDeals = leads?.length || 0
      const winRate = totalDeals > 0 ? Math.round((dealsWon / totalDeals) * 100) : 0

      // Deal cycle (average days from creation to acceptance)
      const wonLeads = leads?.filter(l => l.accepted_at && ['won', 'completed'].includes(l.status)) || []
      const avgCycleDays = wonLeads.length > 0
        ? Math.round(wonLeads.reduce((sum, l) => {
            const days = (new Date(l.accepted_at) - new Date(l.created_at)) / (1000 * 60 * 60 * 24)
            return sum + days
          }, 0) / wonLeads.length)
        : 0

      // Active prospects (leads in progress)
      const activeProspects = leads?.filter(l => ['new', 'contacted', 'qualified', 'proposal'].includes(l.status)).length || 0

      return {
        deals_won: dealsWon,
        win_rate: winRate,
        deal_cycle_days: avgCycleDays,
        active_prospects: activeProspects
      }
    }

    // Support medewerker KPIs (placeholder for now)
    if (role === 'support' || role === 'customer_support') {
      // TODO: Implement when support tickets table exists
      return {
        open_tickets: 0,
        first_response_time_minutes: 0,
        csat_score: 0
      }
    }

    // Default: return ops KPIs
    return this.calculateRoleBasedKPIs(employeeId, 'ops')
  }

  /**
   * Get quick counts for employee
   * @param {string} employeeId - UUID of employee
   * @returns {Promise<Object>} Quick counts
   */
  static async getQuickCounts(employeeId) {
    // Open tasks
    const { count: openTasks } = await supabaseAdmin
      .from('employee_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', employeeId)
      .in('status', ['open', 'in_progress'])

    // Hours this week (submitted + approved)
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const { data: timeEntries } = await supabaseAdmin
      .from('time_entries')
      .select('duration_minutes, status')
      .eq('employee_id', employeeId)
      .gte('start_at', weekStart.toISOString())
      .in('status', ['submitted', 'approved'])

    const hoursThisWeek = (timeEntries?.reduce((sum, te) => sum + (te.duration_minutes || 0), 0) || 0) / 60

    // Unpaid balance (using helper function)
    const { data: balanceData, error: balanceError } = await supabaseAdmin
      .rpc('get_employee_unpaid_balance', { p_employee_id: employeeId })

    const unpaidBalanceCents = balanceError ? 0 : (balanceData || 0)

    return {
      open_tasks: openTasks || 0,
      hours_this_week: Math.round(hoursThisWeek * 10) / 10,
      unpaid_balance_cents: unpaidBalanceCents
    }
  }

  /**
   * Update employee status
   * @param {string} employeeId - UUID of employee
   * @param {string} status - 'active', 'paused', 'inactive'
   * @param {string} actorId - UUID of user making the change
   * @returns {Promise<Object>} Updated employee
   */
  static async updateEmployeeStatus(employeeId, status, actorId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({ 
          employee_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', employeeId)
        .select()
        .single()

      if (error) throw error

      // Log audit
      await SystemLogService.logAPI(
        'info',
        `/api/employees/${employeeId}/status`,
        'Employee status updated',
        `Status changed to ${status}`,
        actorId
      )

      return data
    } catch (error) {
      console.error('Error updating employee status:', error)
      throw error
    }
  }
}

module.exports = EmployeeService

