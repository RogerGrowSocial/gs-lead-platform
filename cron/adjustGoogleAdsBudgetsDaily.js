'use strict'

const ChannelOrchestratorService = require('../services/channelOrchestratorService')

/**
 * Adjust Google Ads Budgets Daily Cronjob
 * 
 * Past Google Ads budgets aan op basis van lead gaps
 * Moet dagelijks draaien (bijv. om 03:00, na demand planning)
 */
async function adjustGoogleAdsBudgetsDaily() {
  try {
    console.log('🎯 Starting daily Google Ads budget adjustments...')

    // Orchestreer voor vandaag
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const result = await ChannelOrchestratorService.orchestrateAllSegments(today)

    console.log('✅ Budget adjustments completed:', result)

    return result
  } catch (error) {
    console.error('❌ Error in adjustGoogleAdsBudgetsDaily:', error)
    throw error
  }
}

// If run directly (not as module)
if (require.main === module) {
  adjustGoogleAdsBudgetsDaily()
    .then(result => {
      console.log('✅ Cronjob completed:', result)
      process.exit(0)
    })
    .catch(error => {
      console.error('❌ Cronjob failed:', error)
      process.exit(1)
    })
}

module.exports = adjustGoogleAdsBudgetsDaily

