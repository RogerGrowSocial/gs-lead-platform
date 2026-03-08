/**
 * RBAC middleware stubs so admin.js loads when full RBAC is not deployed.
 * buildAdminNav: attach admin nav to req; resolvePageKeyAndRequireAccess: allow access by path.
 */
function buildAdminNav(req, res, next) {
  req.adminNav = req.adminNav || []
  next()
}

function resolvePageKeyAndRequireAccess(req, res, next) {
  next()
}

module.exports = { buildAdminNav, resolvePageKeyAndRequireAccess }
