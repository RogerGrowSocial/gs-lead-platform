/**
 * Platform Settings Service — RBAC matrix, sync registry to DB, save/reset permissions, audit, cache.
 * Uses supabaseAdmin (service role) so RLS is bypassed when called from backend.
 */

const { supabaseAdmin } = require('../config/supabase')
const { getAdminPages, getRoleKeys } = require('../config/pageRegistry')

const RBAC_CACHE_TTL_MS = 60 * 1000 // 60s
let rbacCache = null
let rbacCacheTs = 0

function invalidateRbacCache () {
  rbacCache = null
  rbacCacheTs = 0
}

/**
 * Sync page registry to app_pages (upsert by page_key).
 * Call on server start or periodically.
 */
async function syncPagesRegistryToDb () {
  const pages = getAdminPages()
  for (const p of pages) {
    const row = {
      page_key: p.key,
      label: p.label,
      path: p.path,
      area: p.area,
      section: p.section,
      default_access_roles: p.defaultAccessRoles || [],
      default_sidebar_roles: p.defaultSidebarRoles || [],
      default_sidebar_order: p.defaultSidebarOrder ?? 1000,
      updated_at: new Date().toISOString()
    }
    const { error } = await supabaseAdmin
      .from('app_pages')
      .upsert(row, { onConflict: 'page_key', ignoreDuplicates: false })
    if (error) {
      console.error('[platformSettingsService] syncPagesRegistryToDb upsert error:', p.key, error.message)
      throw error
    }
  }
  invalidateRbacCache()
  return { synced: pages.length }
}

/**
 * Get effective permission for a role/page from defaults + overrides.
 */
function effectivePermission (page, roleKey, overridesByRole) {
  const override = overridesByRole[roleKey]?.find(o => o.page_key === page.page_key)
  const canAccess = override !== undefined ? override.can_access : page.default_access_roles.includes(roleKey)
  const inSidebar = override !== undefined ? override.in_sidebar : page.default_sidebar_roles.includes(roleKey)
  const sidebarOrder = override !== undefined ? override.sidebar_order : page.default_sidebar_order
  return { can_access: canAccess, in_sidebar: inSidebar, sidebar_order: sidebarOrder }
}

/**
 * Get RBAC matrix for UI: roles, pages grouped by section, effective settings per role.
 * Cached 60s; invalidated on save/reset.
 * If DB tables don't exist yet, returns matrix from in-memory registry (defaults only).
 */
async function getRbacMatrix (useCache = true) {
  const now = Date.now()
  if (useCache && rbacCache && (now - rbacCacheTs) < RBAC_CACHE_TTL_MS) {
    return rbacCache
  }

  let dbPages = null
  let perms = null
  try {
    await syncPagesRegistryToDb()
    const [pagesRes, permsRes] = await Promise.all([
      supabaseAdmin.from('app_pages').select('*').order('section').order('default_sidebar_order'),
      supabaseAdmin.from('role_page_permissions').select('*')
    ])
    if (pagesRes.error) throw pagesRes.error
    if (permsRes.error) throw permsRes.error
    dbPages = pagesRes.data
    perms = permsRes.data
  } catch (err) {
    console.warn('[platformSettingsService] getRbacMatrix DB/sync failed, using registry defaults:', err.message)
    dbPages = getAdminPages().map(p => ({
      page_key: p.key,
      label: p.label,
      path: p.path,
      section: p.section,
      default_access_roles: p.defaultAccessRoles || [],
      default_sidebar_roles: p.defaultSidebarRoles || [],
      default_sidebar_order: p.defaultSidebarOrder ?? 1000
    }))
    perms = []
  }

  const overridesByRole = {}
  for (const r of getRoleKeys()) {
    overridesByRole[r] = (perms || []).filter(p => p.role_key === r)
  }

  const bySection = {}
  for (const p of dbPages || []) {
    const section = p.section || 'Overig'
    if (!bySection[section]) bySection[section] = []
    const roles = {}
    for (const r of getRoleKeys()) {
      const eff = effectivePermission(p, r, overridesByRole)
      roles[r] = {
        can_access: eff.can_access,
        in_sidebar: eff.in_sidebar,
        sidebar_order: eff.sidebar_order
      }
    }
    bySection[section].push({
      page_key: p.page_key,
      label: p.label,
      path: p.path,
      section,
      default_access_roles: p.default_access_roles || [],
      default_sidebar_roles: p.default_sidebar_roles || [],
      default_sidebar_order: p.default_sidebar_order ?? 1000,
      roles
    })
  }

  const result = {
    roles: getRoleKeys(),
    sections: Object.keys(bySection).sort(),
    bySection,
    pages: dbPages || []
  }
  rbacCache = result
  rbacCacheTs = now
  return result
}

/**
 * Save permission overrides for a role. Writes to role_page_permissions and audit.
 * @param { string } roleKey - admin | manager | employee | partner
 * @param { Array<{ page_key: string, can_access: boolean, in_sidebar: boolean, sidebar_order: number }> } updates
 * @param { string } actorUserId - auth user id
 * @param { { ip?: string, userAgent?: string } } reqMeta
 */
async function saveRolePermissions (roleKey, updates, actorUserId, reqMeta = {}) {
  if (!getRoleKeys().includes(roleKey)) {
    throw new Error('Invalid role_key')
  }

  const { data: existingPages } = await supabaseAdmin.from('app_pages').select('page_key')
  const pageKeys = new Set((existingPages || []).map(p => p.page_key))

  for (const u of updates) {
    if (!u.page_key || !pageKeys.has(u.page_key)) throw new Error(`Unknown page_key: ${u.page_key}`)
    const can_access = Boolean(u.can_access)
    const in_sidebar = can_access ? Boolean(u.in_sidebar) : false
    const sidebar_order = Number(u.sidebar_order) || 0

    const { data: oldRow } = await supabaseAdmin
      .from('role_page_permissions')
      .select('can_access, in_sidebar, sidebar_order')
      .eq('role_key', roleKey)
      .eq('page_key', u.page_key)
      .maybeSingle()

    const newRow = {
      role_key: roleKey,
      page_key: u.page_key,
      can_access,
      in_sidebar,
      sidebar_order,
      updated_by: actorUserId || null,
      updated_at: new Date().toISOString()
    }

    await supabaseAdmin
      .from('role_page_permissions')
      .upsert(newRow, { onConflict: 'role_key,page_key' })

    await supabaseAdmin.from('role_page_permission_audit').insert({
      role_key: roleKey,
      page_key: u.page_key,
      old_value: oldRow || null,
      new_value: newRow,
      changed_by: actorUserId || null,
      ip: reqMeta.ip || null,
      user_agent: reqMeta.user_agent || null
    })
  }

  invalidateRbacCache()
  return { saved: updates.length }
}

/**
 * Reset a role to default permissions (delete overrides, audit as bulk reset).
 */
async function resetRoleToDefaults (roleKey, actorUserId, reqMeta = {}) {
  if (!getRoleKeys().includes(roleKey)) {
    throw new Error('Invalid role_key')
  }

  const { data: deleted } = await supabaseAdmin
    .from('role_page_permissions')
    .delete()
    .eq('role_key', roleKey)
    .select('page_key')

  const pageKeys = (deleted || []).map(r => r.page_key)
  if (pageKeys.length > 0) {
    await supabaseAdmin.from('role_page_permission_audit').insert({
      role_key: roleKey,
      page_key: '_reset',
      old_value: { bulk_reset_pages: pageKeys },
      new_value: { action: 'reset_to_defaults' },
      changed_by: actorUserId || null,
      ip: reqMeta.ip || null,
      user_agent: reqMeta.user_agent || null
    })
  }

  invalidateRbacCache()
  return { reset: pageKeys.length }
}

/**
 * Get effective permissions for a single role (for buildAdminNav and requirePageAccess).
 * Not heavily cached here; caller (middleware) may cache per request.
 */
async function getEffectivePermissionsForRole (roleKey) {
  const matrix = await getRbacMatrix(true)
  const result = {}
  for (const section of matrix.sections || []) {
    for (const p of matrix.bySection[section] || []) {
      const r = p.roles?.[roleKey]
      if (r) {
        result[p.page_key] = {
          can_access: r.can_access,
          in_sidebar: r.in_sidebar,
          sidebar_order: r.sidebar_order,
          label: p.label,
          path: p.path,
          section: p.section
        }
      }
    }
  }
  return result
}

module.exports = {
  syncPagesRegistryToDb,
  getRbacMatrix,
  saveRolePermissions,
  resetRoleToDefaults,
  getEffectivePermissionsForRole,
  invalidateRbacCache
}
