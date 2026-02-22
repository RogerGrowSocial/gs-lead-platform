const cron = require('node-cron')
const opportunityFollowUpReminderService = require('../services/opportunityFollowUpReminderService')
const logger = require('../utils/logger')

// Run every 15 minutes: send day1/day3/day7_escalation reminders for unhandled opportunities
cron.schedule('*/15 * * * *', async () => {
  try {
    const result = await opportunityFollowUpReminderService.runReminders()
    if (result.day1 || result.day3 || result.day7_escalation) {
      logger.info('Opportunity follow-up reminders', {
        day1: result.day1,
        day3: result.day3,
        day7_escalation: result.day7_escalation
      })
    }
    if (result.errors?.length) {
      logger.warn('Opportunity reminder errors', { errors: result.errors })
    }
  } catch (error) {
    logger.error('Opportunity follow-up reminder cron failed', error)
  }
})

logger.info('Opportunity follow-up reminder cron initialized (every 15 min)')

module.exports = { runReminders: opportunityFollowUpReminderService.runReminders }
