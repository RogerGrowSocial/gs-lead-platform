/**
 * Roles Cache Utility
 * Caches roles data to reduce database queries
 */

const { supabaseAdmin } = require('../config/supabase');

// Cache for all roles
let allRolesCache = null;
let allRolesCacheTimestamp = null;
const ROLES_CACHE_TTL = 300000; // 5 minutes

// Cache for individual roles
const roleCache = new Map(); // roleId -> { role, timestamp }
const ROLE_CACHE_TTL = 300000; // 5 minutes

/**
 * Get all roles (cached)
 */
async function getAllRoles(forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && allRolesCache && allRolesCacheTimestamp && (now - allRolesCacheTimestamp) < ROLES_CACHE_TTL) {
    return allRolesCache;
  }
  
  const { data: roles, error } = await supabaseAdmin
    .from('roles')
    .select('id, name, description, display_name')
    .order('name');
  
  if (error) {
    console.error('Error fetching all roles:', error);
    // Return cached data if available, even if stale
    return allRolesCache || [];
  }
  
  allRolesCache = roles || [];
  allRolesCacheTimestamp = now;
  
  // Also update individual role cache
  if (roles) {
    roles.forEach(role => {
      roleCache.set(role.id, {
        role: role,
        timestamp: now
      });
    });
  }
  
  return allRolesCache;
}

/**
 * Get a single role by ID (cached)
 */
async function getRoleById(roleId, forceRefresh = false) {
  const now = Date.now();
  const cached = roleCache.get(roleId);
  
  if (!forceRefresh && cached && (now - cached.timestamp) < ROLE_CACHE_TTL) {
    return cached.role;
  }
  
  // Try to get from all roles cache first
  if (allRolesCache) {
    const role = allRolesCache.find(r => r.id === roleId);
    if (role) {
      roleCache.set(roleId, {
        role: role,
        timestamp: now
      });
      return role;
    }
  }
  
  // Fetch from database
  const { data: role, error } = await supabaseAdmin
    .from('roles')
    .select('id, name, description, display_name')
    .eq('id', roleId)
    .single();
  
  if (error) {
    console.error(`Error fetching role ${roleId}:`, error);
    return null;
  }
  
  if (role) {
    roleCache.set(roleId, {
      role: role,
      timestamp: now
    });
  }
  
  return role;
}

/**
 * Create a role map (roleId -> role name) from cached roles
 */
async function getRoleMap() {
  const roles = await getAllRoles();
  const roleMap = {};
  const roleDisplayMap = {};
  
  roles.forEach(role => {
    const roleIdStr = String(role.id);
    roleMap[roleIdStr] = role.name?.toLowerCase() || '';
    roleDisplayMap[roleIdStr] = role.display_name || role.name || null;
  });
  
  return { roleMap, roleDisplayMap, roles };
}

/**
 * Clear the cache (useful for testing or when roles are updated)
 */
function clearCache() {
  allRolesCache = null;
  allRolesCacheTimestamp = null;
  roleCache.clear();
}

module.exports = {
  getAllRoles,
  getRoleById,
  getRoleMap,
  clearCache
};
