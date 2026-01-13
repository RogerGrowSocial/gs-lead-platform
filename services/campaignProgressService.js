/**
 * CampaignProgressService
 * 
 * In-memory progress tracking for campaign creation.
 * Stores progress updates that can be polled by the frontend.
 */
class CampaignProgressService {
  static progressStore = new Map(); // recId -> progress object

  /**
   * Set progress for a recommendation
   * @param {string} recId - Recommendation ID
   * @param {Object} progress - Progress object
   */
  static setProgress(recId, progress) {
    // Ensure message is always a string (handle objects, null, undefined)
    let message = progress.message;
    if (typeof message !== 'string') {
      if (message && typeof message === 'object') {
        message = message.message || message.text || message.title || String(message);
      } else {
        message = message || '';
      }
    }
    
    // Ensure percentage is a valid number
    let percentage = progress.percentage;
    if (typeof percentage !== 'number' || isNaN(percentage)) {
      percentage = 0;
    }
    percentage = Math.max(0, Math.min(100, percentage));
    
    this.progressStore.set(recId, {
      ...progress,
      message: String(message),
      percentage: percentage,
      timestamp: Date.now()
    });
  }

  /**
   * Get progress for a recommendation
   * @param {string} recId - Recommendation ID
   * @returns {Object|null} Progress object or null
   */
  static getProgress(recId) {
    return this.progressStore.get(recId) || null;
  }

  /**
   * Clear progress (after completion or error)
   * @param {string} recId - Recommendation ID
   */
  static clearProgress(recId) {
    this.progressStore.delete(recId);
  }

  /**
   * Clean up old progress entries (older than 1 hour)
   */
  static cleanup() {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [recId, progress] of this.progressStore.entries()) {
      if (progress.timestamp < oneHourAgo) {
        this.progressStore.delete(recId);
      }
    }
  }
}

// Cleanup every 10 minutes
setInterval(() => {
  CampaignProgressService.cleanup();
}, 10 * 60 * 1000);

module.exports = CampaignProgressService;

