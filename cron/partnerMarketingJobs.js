const cron = require('node-cron');
const calculatePartnerLeadStatsDaily = require('./calculatePartnerLeadStatsDaily');
const runPartnerDemandPlanningDaily = require('./runPartnerDemandPlanningDaily');
const generateAiPartnerRecommendationsDaily = require('./generateAiPartnerRecommendationsDaily');
const syncPartnerCampaignsDaily = require('./syncPartnerCampaignsDaily');
const syncSegmentsFromUserPreferences = require('./syncSegmentsFromUserPreferences');
const syncSegmentsFromCapacity = require('./syncSegmentsFromCapacity');
const logger = require('../utils/logger');

/**
 * Partner Marketing Cron Jobs
 * 
 * Dagelijkse jobs voor partner marketing systeem
 */

// Dagelijks om 01:30 - Partner stats aggregatie (na lead stats)
cron.schedule('30 1 * * *', async () => {
  logger.info('Starting daily partner lead stats aggregation...');
  try {
    await calculatePartnerLeadStatsDaily();
  } catch (error) {
    logger.error('Error in partner stats aggregation:', error);
  }
});

// Dagelijks om 02:30 - Partner demand planning (na partner stats)
cron.schedule('30 2 * * *', async () => {
  logger.info('Starting daily partner demand planning...');
  try {
    await runPartnerDemandPlanningDaily();
  } catch (error) {
    logger.error('Error in partner demand planning:', error);
  }
});

// AI recommendations generatie - Meerdere keren per dag voor real-time updates
// Schema: Elke 3 uur (00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00)
// Dit zorgt voor snelle reactie op veranderende gaps zonder server overbelasting
cron.schedule('0 */3 * * *', async () => {
  logger.info('Starting AI partner recommendations generation (every 3 hours)...');
  try {
    await generateAiPartnerRecommendationsDaily();
  } catch (error) {
    logger.error('Error in AI recommendations generation:', error);
  }
});

// Optioneel: Als je liever 4x per dag hebt (elke 6 uur), gebruik dan:
// cron.schedule('0 */6 * * *', ...)  // 00:00, 06:00, 12:00, 18:00

// Optioneel: Als je liever elk uur hebt (meer real-time, maar zwaarder):
// cron.schedule('0 * * * *', ...)  // Elk uur op het hele uur

// Dagelijks om 03:00 - Capacity-based segment sync (voor AI recommendations)
// NOTE: capacity-based segment sync — we only create/keep segments where capacity > 0.
// This keeps the system scalable and avoids thousands of unused segments.
cron.schedule('0 3 * * *', async () => {
  logger.info('Starting daily capacity-based segment sync...');
  try {
    await syncSegmentsFromCapacity();
  } catch (error) {
    logger.error('Error in capacity-based segment sync:', error);
  }
});

// Dagelijks om 04:00 - Campaign sync met externe APIs
cron.schedule('0 4 * * *', async () => {
  logger.info('Starting daily partner campaigns sync...');
  try {
    await syncPartnerCampaignsDaily();
  } catch (error) {
    logger.error('Error in partner campaigns sync:', error);
  }
});

logger.info('Partner Marketing cron jobs initialized.');

