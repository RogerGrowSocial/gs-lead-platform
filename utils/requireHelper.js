// Helper for dynamic requires that works on both local and Vercel
// On Vercel, use static require to ensure bundling
// Locally, can use requireWithRetry for ECANCELED error handling

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

/**
 * Require a module - uses static require on Vercel, requireWithRetry locally
 * This ensures proper bundling on Vercel while maintaining retry logic locally
 */
function safeRequire(modulePath) {
  if (isVercel) {
    return require(modulePath);
  } else {
    // Use requireWithRetry if available, otherwise regular require
    if (typeof requireWithRetry === 'function') {
      return requireWithRetry(modulePath);
    }
    return require(modulePath);
  }
}

module.exports = { safeRequire };
