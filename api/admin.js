/**
 * Admin serverless function entrypoint for Vercel
 * Handles /admin/* and admin-specific /api/* routes.
 * Export app directly so Vercel wraps it correctly; cold-start fix is in createApp (no eager routes/admin or routes/api).
 */
const createApp = require('../lib/createApp')

const app = createApp({ area: 'admin' })

module.exports = app
