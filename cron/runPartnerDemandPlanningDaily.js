const PartnerDemandService = require('../services/partnerDemandService');
const logger = require('../utils/logger');

/**
 * Run Partner Demand Planning Daily
 * 
 * Bereken lead gaps per partner per segment
 * Wordt dagelijks uitgevoerd na partner stats aggregatie
 */
async function runPartnerDemandPlanningDaily() {
  try {
    logger.info('Starting daily partner demand planning...');
    
    const today = new Date();
    
    // Run PartnerDemandService
    const gaps = await PartnerDemandService.calculatePartnerLeadGaps(today);
    
    logger.info(`Partner demand planning completed: ${gaps.length} gaps calculated`);
    
    // Log summary
    const positiveGaps = gaps.filter(g => g.lead_gap > 0).length;
    const negativeGaps = gaps.filter(g => g.lead_gap < 0).length;
    const zeroGaps = gaps.filter(g => g.lead_gap === 0).length;
    
    logger.info(`Gap summary: ${positiveGaps} positive, ${negativeGaps} negative, ${zeroGaps} zero`);
    
  } catch (error) {
    logger.error('Error in runPartnerDemandPlanningDaily:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runPartnerDemandPlanningDaily()
    .then(() => {
      logger.info('Partner demand planning job completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Partner demand planning job failed:', error);
      process.exit(1);
    });
}

module.exports = runPartnerDemandPlanningDaily;

