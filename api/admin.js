/**
 * Admin serverless function entrypoint for Vercel
 * Handles /admin/* and admin-specific /api/* routes.
 * Lazy-init: app is created on first request to avoid cold-start timeout.
 */
let _app

module.exports = function adminHandler (req, res) {
  if (!_app) {
    console.log('[ADMIN] handler loaded')
    const createApp = require('../lib/createApp')
    _app = createApp({ area: 'admin' })
  }
  return _app(req, res)
}
