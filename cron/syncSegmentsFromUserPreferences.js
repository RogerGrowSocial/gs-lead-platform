const SegmentSyncService = require('../services/segmentSyncService');
const logger = require('../utils/logger');

/**
 * Sync Segments from User Preferences
 * 
 * Dagelijkse job om alle segmenten te syncen op basis van user preferences.
 * Zorgt ervoor dat alle (branche, regio) combinaties die nodig zijn bestaan.
 */
async function syncSegmentsFromUserPreferences() {
  try {
    logger.info('🔄 Starting daily segment sync from user preferences...');
    
    const result = await SegmentSyncService.syncSegmentsFromUserPreferences();
    
    logger.info(`✅ Segment sync completed:`, {
      usersProcessed: result.usersProcessed,
      totalCombinations: result.totalCombinations,
      segmentsExisting: result.segmentsExisting,
      errors: result.errors?.length || 0
    });
    
    return result;
  } catch (error) {
    logger.error('❌ Error in segment sync:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  syncSegmentsFromUserPreferences()
    .then(() => {
      console.log('Segment sync completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Segment sync failed:', error);
      process.exit(1);
    });
}

module.exports = syncSegmentsFromUserPreferences;

