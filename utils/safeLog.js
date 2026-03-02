/**
 * Safe logging: never blocks the request. In production no localhost/ingest calls.
 * - NODE_ENV !== 'development': no external log ingest (only console if needed).
 * - All logging runs with max 250ms timeout so it can never hang the request.
 */
const LOG_TIMEOUT_MS = 250;
const isDev = process.env.NODE_ENV === 'development';

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('log_timeout')), ms))
  ]).catch(err => {
    if (err.message === 'log_timeout' && isDev) console.warn('[safeLog] timeout');
    return fallback;
  });
}

/**
 * Fire-and-forget: run fn() with 250ms timeout. Never throws, never blocks caller.
 * In production we never call external ingest (fn can still do console.log or internal log).
 */
function fireAndForget(fn) {
  if (!isDev) return; // no debug ingest in production
  const p = withTimeout(Promise.resolve().then(fn), LOG_TIMEOUT_MS, null);
  p.catch(() => {});
}

/**
 * Run an async logging operation (e.g. DB write) with 250ms timeout.
 * Returns a promise that resolves to the result or null on timeout; never throws to caller.
 */
function runWithTimeout(promise) {
  return withTimeout(promise, LOG_TIMEOUT_MS, null).catch(() => null);
}

module.exports = { fireAndForget, runWithTimeout, LOG_TIMEOUT_MS, isDev };
