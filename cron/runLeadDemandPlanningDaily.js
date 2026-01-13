'use strict'

const LeadDemandPlannerService = require('../services/leadDemandPlannerService')

/**
 * Run Lead Demand Planning Daily Cronjob
 * 
 * Berekent targets en gaps voor alle segmenten
 * Moet dagelijks draaien (bijv. om 02:00, na aggregatie)
 */
async function runLeadDemandPlanningDaily() {
  try {
    console.log('📊 Starting daily demand planning...')

    // Plan voor vandaag
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const result = await LeadDemandPlannerService.planAllSegments(today)

    console.log('✅ Demand planning completed:', result)

    return result
  } catch (error) {
    console.error('❌ Error in runLeadDemandPlanningDaily:', error)
    throw error
  }
}

// If run directly (not as module)
if (require.main === module) {
  runLeadDemandPlanningDaily()
    .then(result => {
      console.log('✅ Cronjob completed:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Cronjob failed:', error)
      process.exit(1)
    })
}

module.exports = runLeadDemandPlanningDaily

