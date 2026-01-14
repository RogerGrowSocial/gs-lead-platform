/**
 * Dashboard serverless function entrypoint for Vercel
 * Handles /dashboard/* and user-specific /api/* routes
 */
const createApp = require('../lib/createApp')

const app = createApp({ area: 'dashboard' })

module.exports = app
