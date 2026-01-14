/**
 * Filter API routes based on area (dashboard vs admin)
 * This prevents dashboard function from loading admin routes
 * @param {Express.Router} apiRouter - The full API router
 * @param {string} area - 'dashboard' or 'admin'
 * @returns {Express.Router} Filtered router
 */
function filterApiRoutes(apiRouter, area) {
  const express = require('express')
  const filteredRouter = express.Router()
  
  if (area === 'dashboard') {
    // Dashboard function: only mount user-specific routes
    // Filter out admin-only routes via middleware
    filteredRouter.use((req, res, next) => {
      const path = req.path
      const method = req.method
      
      // Block admin-only routes
      const isAdminRoute = 
        path.startsWith('/admin/') ||
        path.startsWith('/admin/api/') ||
        path.startsWith('/profiles/bulk/') ||
        path.startsWith('/leads/bulk/') ||
        path.startsWith('/users/bulk/') ||
        // Admin profile operations (POST, PUT, DELETE on /profiles/:id without /current or /profile/check)
        (path.startsWith('/profiles/') && method !== 'GET' && !path.includes('/current') && !path.includes('/profile/check') && !path.match(/^\/profiles\/[^\/]+$/)) ||
        // Admin user operations (not /users/current or /user/)
        (path.startsWith('/users/') && !path.startsWith('/users/current') && !path.startsWith('/user/')) ||
        // Admin lead operations (DELETE, approve, assign)
        (path.startsWith('/leads/') && (method === 'DELETE' || path.includes('/approve') || path.includes('/assign'))) ||
        // Admin payment operations (POST, PUT, DELETE on /payments/:id, not /payments/methods)
        (path.startsWith('/payments/') && method !== 'GET' && !path.startsWith('/payments/methods'))
      
      if (isAdminRoute) {
        console.log(`🚫 Dashboard function blocking admin route: ${method} ${path}`)
        return res.status(404).json({ error: 'Not found' })
      }
      
      // Allow user-specific and public routes
      apiRouter(req, res, next)
    })
  } else if (area === 'admin') {
    // Admin function: mount all routes (no filtering needed)
    filteredRouter.use(apiRouter)
  } else {
    // Full app: mount all routes
    filteredRouter.use(apiRouter)
  }
  
  return filteredRouter
}

module.exports = filterApiRoutes
