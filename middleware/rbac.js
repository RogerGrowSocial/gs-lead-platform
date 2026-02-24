/**
 * RBAC middleware: resolve role key from user, requirePageAccess(pageKey), buildAdminNav.
 * Use after requireAuth + isEmployeeOrAdmin on /admin.
 */

const platformSettingsService = require('../services/platformSettingsService')
const pageRegistry = require('../config/pageRegistry')

/**
 * Derive role_key from req.user (is_admin + role name).
 * @returns { 'admin' | 'manager' | 'employee' | 'partner' }
 */
function getRoleKeyFromUser (req) {
  if (!req.user) return 'partner'
  if (req.user.is_admin === true || req.user.user_metadata?.is_admin === true) return 'admin'
  const roleName = (req.user.role || req.user.user_metadata?.role || '').toLowerCase()
  if (roleName.includes('manager')) return 'manager'
  if (roleName.includes('employee') || roleName.includes('werknemer') || roleName.includes('admin')) return 'employee'
  return 'partner'
}

/**
 * Middleware: resolve pageKey from req.path, then ensure current user's role has can_access.
 * On deny: redirect to /admin with flash. Skip if path is /admin/platform-settings (guarded by isAdmin on route).
 */
function requirePageAccess (pageKey) {
  return async (req, res, next) => {
    if (!pageKey) return next()
    if (req.path === '/platform-settings' || req.path === '/platform-settings/') return next()
    const roleKey = getRoleKeyFromUser(req)
    const perms = await platformSettingsService.getEffectivePermissionsForRole(roleKey)
    const perm = perms[pageKey]
    if (perm && perm.can_access) return next()
    req.flash?.('error', 'Je hebt geen toegang tot deze pagina.')
    return res.redirect('/admin')
  }
}

/**
 * Middleware: resolve pageKey from req.path and call requirePageAccess(resolvedKey).
 * Use this on the admin router so every GET (and non-API) request gets checked.
 */
function resolvePageKeyAndRequireAccess () {
  return async (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    const fullPath = (req.baseUrl || '') + (req.path || '') || (req.originalUrl && req.originalUrl.split('?')[0]) || ''
    const pageKey = pageRegistry.resolvePageKey(fullPath, 'admin')
    return requirePageAccess(pageKey)(req, res, next)
  }
}

/**
 * Build res.locals.adminNav from page registry + effective permissions for current user's role.
 * adminNav = { sections: [ { section, items: [ { label, path, page_key } ] } ] }, sorted by section order and sidebar_order.
 */
async function buildAdminNav (req, res, next) {
  try {
    const roleKey = getRoleKeyFromUser(req)
    const perms = await platformSettingsService.getEffectivePermissionsForRole(roleKey)
    const sections = {}
    for (const [key, p] of Object.entries(perms)) {
      if (!p.in_sidebar || !p.can_access) continue
      const section = p.section || 'Overig'
      if (!sections[section]) sections[section] = []
      sections[section].push({
        page_key: key,
        label: p.label,
        path: p.path,
        sidebar_order: p.sidebar_order
      })
    }
    const sectionOrder = ['Overzicht', 'Leads', 'Sales', 'CRM', 'Uitvoering', 'Tickets', 'Communicatie', 'Diensten', 'Team', 'Facturatie', 'Tools', 'Intern', 'Instellingen']
    res.locals.adminNav = {
      sections: sectionOrder
        .filter(s => sections[s]?.length)
        .map(s => ({
          section: s,
          items: sections[s].sort((a, b) => (a.sidebar_order - b.sidebar_order))
        }))
        .concat(
          Object.keys(sections)
            .filter(s => !sectionOrder.includes(s))
            .map(s => ({ section: s, items: sections[s].sort((a, b) => a.sidebar_order - b.sidebar_order) }))
        )
    }
    res.locals.userRoleKey = roleKey
  } catch (err) {
    console.error('[buildAdminNav]', err.message)
    res.locals.adminNav = { sections: [] }
  }
  res.locals.currentPath = req.path ? (req.baseUrl || '') + req.path : (req.originalUrl && req.originalUrl.split('?')[0]) || ''
  next()
}

module.exports = {
  getRoleKeyFromUser,
  requirePageAccess,
  resolvePageKeyAndRequireAccess,
  buildAdminNav
}
