const { supabaseAdmin } = require('../config/supabase');

/**
 * Check if user has admin access (simplified version using existing is_admin field)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authenticatie vereist'
    });
  }

  const isAdmin = req.user.user_metadata?.is_admin === true;
  
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin toegang vereist'
    });
  }

  next();
}

/**
 * Check if user has specific permission (simplified version)
 * @param {string} permission - Permission name (e.g., 'leads.delete', 'users.create')
 * @returns {Function} Express middleware function
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authenticatie vereist'
        });
      }

      const isAdmin = req.user.user_metadata?.is_admin === true;
      
      // For now, only admins have permissions
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Onvoldoende rechten voor deze actie',
          required_permission: permission
        });
      }

      next();
    } catch (err) {
      console.error('Permission middleware error:', err);
      return res.status(500).json({
        success: false,
        error: 'Er is een fout opgetreden bij het controleren van rechten'
      });
    }
  };
}

/**
 * Check if user has any of the specified permissions (simplified version)
 * @param {string[]} permissions - Array of permission names
 * @returns {Function} Express middleware function
 */
function requireAnyPermission(permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authenticatie vereist'
        });
      }

      const isAdmin = req.user.user_metadata?.is_admin === true;
      
      // For now, only admins have permissions
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Onvoldoende rechten voor deze actie',
          required_permissions: permissions
        });
      }

      next();
    } catch (err) {
      console.error('Permission middleware error:', err);
      return res.status(500).json({
        success: false,
        error: 'Er is een fout opgetreden bij het controleren van rechten'
      });
    }
  };
}

/**
 * Get user permissions for frontend (simplified version)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUserPermissions(req, res) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authenticatie vereist'
      });
    }

    const isAdmin = req.user.user_metadata?.is_admin === true;
    
    // For now, return basic permissions based on admin status
    const permissions = isAdmin ? [
      { permission_name: 'leads.create', resource: 'leads', action: 'create' },
      { permission_name: 'leads.read', resource: 'leads', action: 'read' },
      { permission_name: 'leads.update', resource: 'leads', action: 'update' },
      { permission_name: 'leads.delete', resource: 'leads', action: 'delete' },
      { permission_name: 'leads.bulk_delete', resource: 'leads', action: 'bulk_delete' },
      { permission_name: 'users.create', resource: 'users', action: 'create' },
      { permission_name: 'users.read', resource: 'users', action: 'read' },
      { permission_name: 'users.update', resource: 'users', action: 'update' },
      { permission_name: 'users.delete', resource: 'users', action: 'delete' },
      { permission_name: 'admin.access', resource: 'admin', action: 'access' }
    ] : [
      { permission_name: 'leads.read', resource: 'leads', action: 'read' },
      { permission_name: 'leads.create', resource: 'leads', action: 'create' }
    ];

    res.json({
      success: true,
      permissions: permissions,
      is_admin: isAdmin
    });
  } catch (err) {
    console.error('Get permissions error:', err);
    res.status(500).json({
      success: false,
      error: 'Er is een fout opgetreden bij het ophalen van rechten'
    });
  }
}

/**
 * Check if user has admin access or specific permission (backward compatibility)
 * @param {string} permission - Optional permission name
 * @returns {Function} Express middleware function
 */
function isAdminOrHasPermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authenticatie vereist'
        });
      }

      const isAdmin = req.user.user_metadata?.is_admin === true;
      
      if (isAdmin) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: 'Admin toegang vereist'
      });
    } catch (err) {
      console.error('Admin/permission check error:', err);
      return res.status(500).json({
        success: false,
        error: 'Er is een fout opgetreden bij het controleren van rechten'
      });
    }
  };
}

module.exports = {
  requirePermission,
  requireAnyPermission,
  getUserPermissions,
  isAdminOrHasPermission,
  requireAdmin
};
