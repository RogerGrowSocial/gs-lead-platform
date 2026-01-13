const PartnerMarketingOrchestratorService = require('../services/partnerMarketingOrchestratorService');
const logger = require('../utils/logger');

/**
 * Generate AI Partner Recommendations Daily
 * 
 * Genereer marketing acties op basis van gaps
 * Wordt dagelijks uitgevoerd na gap berekening
 * 
 * PLATFORM-FIRST: Gebruikt nu generatePlatformMarketingActions() voor site+segment iteratie
 * Legacy: generateMarketingActions() blijft beschikbaar voor partner-centric flow
 */
async function generateAiPartnerRecommendationsDaily() {
  try {
    logger.info('Starting daily AI partner recommendations generation...');
    
    const today = new Date();
    
    // Run platform-first orchestrator (site + segment based)
    const platformActions = await PartnerMarketingOrchestratorService.generatePlatformMarketingActions(today);
    
    logger.info(`Platform recommendations generation completed: ${platformActions.length} actions generated`);
    
    // Optioneel: Run legacy partner-centric orchestrator (als backup of voor legacy partners)
    // Uncomment de volgende regels als je ook legacy recommendations wilt genereren:
    // const legacyActions = await PartnerMarketingOrchestratorService.generateMarketingActions(today);
    // logger.info(`Legacy recommendations generation completed: ${legacyActions.length} actions generated`);
    
    const totalActions = platformActions.length; // + (legacyActions?.length || 0);
    
    logger.info(`Total AI recommendations generation completed: ${totalActions} actions generated`);
    
    // Log summary by type
    const actionTypes = {};
    platformActions.forEach(action => {
      const type = action.action_type || action.type;
      actionTypes[type] = (actionTypes[type] || 0) + 1;
    });
    
    logger.info('Action types:', actionTypes);
    
  } catch (error) {
    logger.error('Error in generateAiPartnerRecommendationsDaily:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateAiPartnerRecommendationsDaily()
    .then(() => {
      logger.info('AI recommendations generation job completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('AI recommendations generation job failed:', error);
      process.exit(1);
    });
}

module.exports = generateAiPartnerRecommendationsDaily;

