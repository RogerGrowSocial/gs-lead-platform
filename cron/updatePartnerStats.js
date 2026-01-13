'use strict'

const { supabaseAdmin } = require('../config/supabase')

/**
 * Update Partner Performance Stats Cronjob
 * 
 * Refreshes the materialized view with partner performance statistics.
 * Should run daily (e.g., at 2 AM) to keep stats up-to-date.
 */
async function updatePartnerStats() {
  try {
    console.log('🔄 Starting partner performance stats refresh...')

    // Refresh materialized view
    const { error } = await supabaseAdmin.rpc('refresh_partner_performance_stats')

    if (error) {
      throw error
    }

    console.log('✅ Partner performance stats refreshed successfully')

    // Optionally: Update cached values in profiles table
    // This is optional but can speed up queries if needed
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('partner_performance_stats')
      .select('*')

    if (!statsError && stats) {
      // Update profiles with cached stats
      for (const stat of stats) {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            leads_assigned_30d: stat.leads_assigned_30d || 0,
            leads_accepted_30d: stat.leads_accepted_30d || 0,
            leads_rejected_30d: stat.leads_rejected_30d || 0,
            conversion_rate_30d: stat.conversion_rate_30d || 0,
            avg_response_time_minutes: stat.avg_response_time_minutes || null,
            open_leads_count: stat.open_leads_count || 0,
            last_lead_assigned_at: stat.last_lead_assigned_at || null
          })
          .eq('id', stat.partner_id)

        if (updateError) {
          console.warn(`⚠️ Error updating cached stats for partner ${stat.partner_id}:`, updateError.message)
        }
      }

      console.log(`✅ Updated cached stats for ${stats.length} partners`)
    }

    return {
      success: true,
      message: 'Partner performance stats updated successfully',
      partnersUpdated: stats?.length || 0
    }
  } catch (error) {
    console.error('❌ Error updating partner performance stats:', error)
    throw error
  }
}

// If run directly (not as module)
if (require.main === module) {
  updatePartnerStats()
    .then(result => {
      console.log('✅ Cronjob completed:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Cronjob failed:', error)
      process.exit(1)
    })
}

module.exports = updatePartnerStats

