// Use console for logging in scripts (logger may require file system setup)
const logger = {
  info: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args)
};
const RSAAssetEngine = require('./rsaAssetEngine');
const QualityGate = require('./qualityGate');

/**
 * RSA Asset Service
 * Orchestrates asset generation with quality gate and auto-iteration
 */
class RSAAssetService {
  /**
   * Generate RSA assets with quality gate
   * Auto-iterates up to 5 times to fix failing dimensions
   * 
   * @param {Object} params - Input parameters
   * @param {string} params.businessName - Business name
   * @param {string} params.service - Service/branch name
   * @param {string} params.location - Location/region
   * @param {string[]} params.keywordList - Array of keywords
   * @param {string[]} params.uspList - Array of USPs
   * @param {string} [params.offer] - Optional offer
   * @param {string} params.finalUrl - Final URL
   * @param {string} [params.tone="direct"] - Tone
   * @param {number} [params.maxIterations=5] - Maximum iterations
   * @returns {Object} {assets, score, iterations, passed}
   */
  static generateWithQualityGate(params, maxIterations = 5) {
    let assets = null;
    let score = null;
    let iterations = 0;
    let passed = false;

    for (let i = 0; i < maxIterations; i++) {
      iterations = i + 1;

      try {
        // Generate assets
        assets = RSAAssetEngine.generateAssets(params);

        // Score assets
        score = QualityGate.score({
          headlines: assets.headlines,
          descriptions: assets.descriptions,
          service: params.service,
          location: params.location,
          keywordList: params.keywordList || []
        });

        // Check if passes
        passed = QualityGate.passes(score);

        if (passed) {
          logger.info(`✅ RSA assets passed quality gate on iteration ${iterations}`, {
            totalScore: score.totalScore,
            keywordCoverage: score.keywordCoverageScore,
            diversity: score.diversityScore
          });
          break;
        } else {
          logger.warn(`⚠️ RSA assets failed quality gate on iteration ${iterations}`, {
            totalScore: score.totalScore,
            keywordCoverage: score.keywordCoverageScore,
            diversity: score.diversityScore,
            errors: score.errors.length
          });

          // Get suggestions for fixes
          const suggestions = QualityGate.suggestFixes(score, assets);

          // Apply fixes if possible (for now, just log - engine should handle better generation)
          if (i < maxIterations - 1) {
            logger.info(`🔄 Attempting to fix issues:`, suggestions);
            // The engine will generate different variations on each iteration due to randomization
            // In a more sophisticated implementation, we could pass hints to the engine
          }
        }
      } catch (error) {
        logger.error(`❌ Error generating RSA assets on iteration ${iterations}:`, error);
        throw error;
      }
    }

    if (!passed) {
      logger.error(`❌ Failed to generate passing RSA assets after ${iterations} iterations`, {
        score,
        errors: score?.errors || []
      });
    }

    return {
      assets,
      score,
      iterations,
      passed
    };
  }

  /**
   * Generate preview assets (for testing/manual review)
   * 
   * @param {Object} params - Input parameters
   * @returns {Object} Generated assets with score
   */
  static generatePreview(params) {
    const result = this.generateWithQualityGate(params, 1); // Single iteration for preview
    
    return {
      ...result.assets,
      qualityScore: result.score,
      passed: result.passed
    };
  }
}

module.exports = RSAAssetService;
