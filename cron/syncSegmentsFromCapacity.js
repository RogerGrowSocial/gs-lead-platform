const SegmentSyncService = require('../services/segmentSyncService');
const logger = require('../utils/logger');

/**
 * Sync Segments from Capacity
 * 
 * Dagelijkse job om alle segmenten te syncen op basis van capacity (actieve partners met leads).
 * Zorgt ervoor dat alleen segmenten bestaan waar daadwerkelijk capacity is.
 * 
 * NOTE: capacity-based segment sync — we only create/keep segments where capacity > 0.
 * This keeps the system scalable and avoids thousands of unused segments.
 */
async function syncSegmentsFromCapacity() {
  try {
    logger.info('🔄 Starting daily capacity-based segment sync...');
    
    const result = await SegmentSyncService.syncSegmentsFromCapacity();
    
    logger.info(`✅ Capacity-based segment sync completed:`, {
      totalCombinations: result.totalCombinations,
      segmentsCreated: result.segmentsCreated,
      segmentsActivated: result.segmentsActivated,
      segmentsDeactivated: result.segmentsDeactivated,
      segmentsExisting: result.segmentsExisting,
      errors: result.errors ? Object.keys(result.errors).length : 0
    });
    
    return result;
  } catch (error) {
    logger.error('❌ Error in capacity-based segment sync:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  syncSegmentsFromCapacity()
    .then(() => {
      console.log('Capacity-based segment sync completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Capacity-based segment sync failed:', error);
      process.exit(1);
    });
}

module.exports = syncSegmentsFromCapacity;

