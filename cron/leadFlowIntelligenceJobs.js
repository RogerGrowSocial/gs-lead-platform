const cron = require('node-cron');
const aggregateLeadStatsDaily = require('./aggregateLeadStatsDaily');
const runLeadDemandPlanningDaily = require('./runLeadDemandPlanningDaily');
const adjustGoogleAdsBudgetsDaily = require('./adjustGoogleAdsBudgetsDaily');
const optimizeGoogleAdsCampaignsDaily = require('./optimizeGoogleAdsCampaignsDaily');
const logger = require('../utils/logger') || console;

/**
 * Lead Flow Intelligence Cron Jobs
 * 
 * Automatiseert de lead flow intelligence pipeline:
 * 1. Stats aggregatie (01:00) - Aggregeert leads naar stats per segment
 * 2. Demand planning (02:00) - Berekent targets en gaps
 * 3. Budget aanpassingen (03:00) - Past Google Ads budgets aan
 * 4. Campaign optimalisatie (04:00) - Optimaliseert keywords, ads, Quality Scores
 */

// Dagelijks om 01:00 - Aggregeer lead stats per segment
cron.schedule('0 1 * * *', async () => {
  try {
    logger.info('🔄 Starting daily lead stats aggregation...');
    const result = await aggregateLeadStatsDaily();
    logger.info(`✅ Lead stats aggregation completed: ${result.segmentsProcessed}/${result.totalSegments} segments processed`);
  } catch (error) {
    logger.error('❌ Error in aggregateLeadStatsDaily:', error);
  }
}, {
  timezone: 'Europe/Amsterdam'
});

// Dagelijks om 02:00 - Demand planning (na stats aggregatie)
cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('📊 Starting daily demand planning...');
    const result = await runLeadDemandPlanningDaily();
    logger.info(`✅ Demand planning completed: ${result.segmentsPlanned}/${result.totalSegments} segments planned`);
  } catch (error) {
    logger.error('❌ Error in runLeadDemandPlanningDaily:', error);
  }
}, {
  timezone: 'Europe/Amsterdam'
});

// Dagelijks om 03:00 - Budget aanpassingen (na demand planning)
cron.schedule('0 3 * * *', async () => {
  try {
    logger.info('🎯 Starting daily Google Ads budget adjustments...');
    const result = await adjustGoogleAdsBudgetsDaily();
    logger.info(`✅ Budget adjustments completed: ${result.segmentsOrchestrated}/${result.totalSegments} segments orchestrated`);
  } catch (error) {
    logger.error('❌ Error in adjustGoogleAdsBudgetsDaily:', error);
  }
}, {
  timezone: 'Europe/Amsterdam'
});

// Dagelijks om 04:00 - Campaign optimalisatie (na budget adjustments)
cron.schedule('0 4 * * *', async () => {
  try {
    logger.info('🔍 Starting daily Google Ads campaign optimization...');
    const result = await optimizeGoogleAdsCampaignsDaily();
    logger.info(`✅ Campaign optimization completed: ${result.campaignsOptimized}/${result.totalCampaigns} campaigns optimized`);
  } catch (error) {
    logger.error('❌ Error in optimizeGoogleAdsCampaignsDaily:', error);
  }
}, {
  timezone: 'Europe/Amsterdam'
});

// Log when cron jobs are initialized
logger.info('✅ Lead Flow Intelligence cron jobs initialized (01:00, 02:00, 03:00, 04:00 daily)');

module.exports = {
  aggregateLeadStatsDaily,
  runLeadDemandPlanningDaily,
  adjustGoogleAdsBudgetsDaily,
  optimizeGoogleAdsCampaignsDaily
};

