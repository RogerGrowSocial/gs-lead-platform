/**
 * Admin serverless function entrypoint for Vercel
 * Handles /admin/* and admin-specific /api/* routes
 */
const createApp = require('../lib/createApp')

const app = createApp({ area: 'admin' })

module.exports = app
