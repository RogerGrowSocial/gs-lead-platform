// middleware/auth.js
const { createBaseClient, createRequestClient } = require('../lib/supabase');
const SystemLogService = require('../services/systemLogService');

// Rate limiting for authentication logging
const authLogCache = new Map();
const AUTH_LOG_COOLDOWN = 30000; // 30 seconds cooldown between same user auth logs

/**
 * Check if we should log authentication for this user
 * @param {string} userId - User ID
 * @param {string} action - Authentication action
 * @returns {boolean} - Whether to log this action
 */
function shouldLogAuth(userId, action) {
  if (!userId) return true; // Always log for anonymous actions
  
  const key = `${userId}-${action}`;
  const now = Date.now();
  const lastLog = authLogCache.get(key);
  
  if (!lastLog || (now - lastLog) > AUTH_LOG_COOLDOWN) {
    authLogCache.set(key, now);
    return true;
  }
  
  return false;
}

/**
 * Try to ensure a valid user session on the request.
 * If access token is invalid/expired but a refresh token exists, refresh and re-set cookies.
 */
async function refreshIfNeeded(req, res, next) {
  try {
    const base = createBaseClient();
    const access = req.cookies?.['sb-access-token'];
    const refresh = req.cookies?.['sb-refresh-token'];

    if (!access) return next(); // no session, nothing to refresh

    // Try to get user with current access token
    const scoped = createRequestClient(req);
    let { data: userData, error: userErr } = await scoped.auth.getUser();

    if (!userErr && userData?.user) {
      req.user = userData.user;
      
      // Log successful authentication (with rate limiting)
      if (shouldLogAuth(userData.user.id, 'authenticated')) {
        SystemLogService.logAuth(
          userData.user.id,
          'authenticated',
          'Gebruiker succesvol geauthenticeerd',
          req.ip,
          req.get('User-Agent')
        ).catch(err => console.log('Auth logging failed:', err));
      }
      
      return next();
    }

    // If there is a refresh token, try refreshing the session
    if (refresh) {
      const { data: refreshData, error: refreshErr } = await base.auth.refreshSession({ refresh_token: refresh });
      if (!refreshErr && refreshData?.session) {
        // Set new cookies
        setAuthCookies(res, refreshData.session);
        // Recreate a scoped client with fresh access token
        req.cookies['sb-access-token'] = refreshData.session.access_token;
        const scopedRefreshed = createRequestClient(req);
        const { data: userData2, error: userErr2 } = await scopedRefreshed.auth.getUser();
        if (!userErr2 && userData2?.user) {
          req.user = userData2.user;
          
          // Log successful token refresh (with rate limiting)
          if (shouldLogAuth(userData2.user.id, 'token_refreshed')) {
            SystemLogService.logAuth(
              userData2.user.id,
              'token_refreshed',
              'Gebruiker token succesvol ververst',
              req.ip,
              req.get('User-Agent')
            ).catch(err => console.log('Auth logging failed:', err));
          }
          
          return next();
        }
      }
    }

    // Fallthrough: no valid user
    return next();
  } catch (e) {
    // Do not crash the request; just proceed unauthenticated
    return next();
  }
}

/**
 * Protect routes that require authentication.
 */
async function requireAuth(req, res, next) {
  if (!req.user) {
    // Log authentication failure
    SystemLogService.logAuth(
      null,
      'authentication_failed',
      'Authenticatie gefaald - geen geldige sessie',
      req.ip,
      req.get('User-Agent')
    ).catch(err => console.log('Auth logging failed:', err));
    
    const returnTo = encodeURIComponent(req.originalUrl || '/dashboard');
    return res.redirect(`/login?returnTo=${returnTo}`);
  }

  // ✅ Check if user account is active
  try {
    const { createBaseClient } = require('../lib/supabase');
    const supabase = createBaseClient();
    
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', req.user.id);

    if (error) {
      console.error('Error checking user status:', error);
      // Continue if we can't check status (don't block user)
      return next();
    }

    const profile = profiles?.[0];
    if (!profile) {
      // Only log for non-polling endpoints to reduce noise
      const isPollingEndpoint = req.path.includes('/progress') || req.path.includes('/poll');
      if (!isPollingEndpoint) {
        console.error('No profile found for user:', req.user.id);
      }
      // Continue if no profile found (don't block user)
      return next();
    }

    if (profile?.status === 'inactive') {
      // Log account deactivation access attempt
      SystemLogService.logAuth(
        req.user.id,
        'account_deactivated_access',
        'Gedeactiveerd account probeerde toegang te krijgen',
        req.ip,
        req.get('User-Agent')
      ).catch(err => console.log('Auth logging failed:', err));
      
      // Clear session and redirect to login with message
      await clearSession(req, res);
      return res.redirect('/login?error=Je account is gedeactiveerd. Neem contact op met de beheerder.');
    }

    if (profile?.status === 'pending') {
      // Log pending account access attempt
      SystemLogService.logAuth(
        req.user.id,
        'account_pending_access',
        'Account in afwachting probeerde toegang te krijgen',
        req.ip,
        req.get('User-Agent')
      ).catch(err => console.log('Auth logging failed:', err));
      
      // Clear session and redirect to login with message
      await clearSession(req, res);
      return res.redirect('/login?error=Je account is nog in afwachting van goedkeuring. Neem contact op met de beheerder.');
    }

  } catch (err) {
    console.error('Error in user status check:', err);
    // Continue if there's an error (don't block user)
  }

  return next();
}

/**
 * Protect routes that require admin access.
 * Checks both Supabase Auth user_metadata and database profile as fallback.
 */
async function isAdmin(req, res, next) {
  if (!req.user) {
    // Log admin access denied - no user
    SystemLogService.logAuth(
      null,
      'admin_access_denied',
      'Admin toegang geweigerd - geen gebruiker',
      req.ip,
      req.get('User-Agent')
    ).catch(err => console.log('Auth logging failed:', err));
    
    return res.status(403).render('errors/403', { 
      message: 'Geen toegang tot deze pagina',
      error: 'Authenticatie vereist'
    });
  }

  // First check Supabase Auth user_metadata
  if (req.user.user_metadata?.is_admin === true) {
    // Log successful admin access - fully async in next tick, don't block request
    setImmediate(() => {
      SystemLogService.logAdmin(
        'accessed admin area',
        'Admin toegang verleend via user_metadata',
        req.user.id,
        null,
        { 
          user_id: req.user.id,
          email: req.user.email,
          access_method: 'user_metadata'
        }
      ).catch(() => {}); // Silently fail
    });
    
    return next();
  }

  // Fallback: Check database profile
  try {
    const { createBaseClient } = require('../lib/supabase');
    const supabase = createBaseClient();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();

    if (!error && profile?.is_admin === true) {
      // Log successful admin access via database (with rate limiting) - fully async in next tick
      if (shouldLogAuth(req.user.id, 'admin_access')) {
        setImmediate(() => {
          SystemLogService.logAdmin(
            'accessed admin area',
            'Admin toegang verleend via database check',
            req.user.id,
            null,
            { 
              user_id: req.user.id,
              email: req.user.email,
              access_method: 'database_profile'
            }
          ).catch(() => {}); // Silently fail
        });
      }
      
      // Sync the admin status to user_metadata for future requests
      const { createClient } = require('@supabase/supabase-js');
      const adminSupabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );
      
      // Update user_metadata in background (don't wait for it)
      adminSupabase.auth.admin.updateUserById(req.user.id, {
        user_metadata: { 
          ...req.user.user_metadata,
          is_admin: true
        }
      }).catch(err => console.log('Background sync failed:', err));

      return next();
    }
  } catch (err) {
    console.log('Database admin check failed:', err);
    
    // Log admin access denied - database error
    SystemLogService.logAuth(
      req.user?.id,
      'admin_access_denied',
      'Admin toegang geweigerd - database fout',
      req.ip,
      req.get('User-Agent')
    ).catch(logErr => console.log('Auth logging failed:', logErr));
  }

  // Log admin access denied - not admin
  SystemLogService.logAuth(
    req.user?.id,
    'admin_access_denied',
    'Admin toegang geweigerd - geen admin rechten',
    req.ip,
    req.get('User-Agent')
  ).catch(err => console.log('Auth logging failed:', err));

  return res.status(403).render('errors/403', { 
    message: 'Geen toegang tot deze pagina',
    error: 'Admin toegang vereist'
  });
}

/**
 * Protect routes that require employee access (not customer/consumer roles).
 * Allows access to admin area for employees and admins, but blocks customers.
 */
async function isEmployeeOrAdmin(req, res, next) {
  if (!req.user) {
    SystemLogService.logAuth(
      null,
      'employee_access_denied',
      'Werknemer toegang geweigerd - geen gebruiker',
      req.ip,
      req.get('User-Agent')
    ).catch(err => console.log('Auth logging failed:', err));
    
    return res.status(403).render('errors/403', { 
      message: 'Geen toegang tot deze pagina',
      error: 'Authenticatie vereist'
    });
  }

  // First check if user is admin (admins always have access)
  if (req.user.user_metadata?.is_admin === true) {
    return next();
  }

  // Check database profile for admin status
  try {
    const { createBaseClient } = require('../lib/supabase');
    const supabase = createBaseClient();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_admin, role_id')
      .eq('id', req.user.id)
      .single();

    if (error) {
      console.log('Error checking profile for employee access:', error);
      return res.status(403).render('errors/403', { 
        message: 'Geen toegang tot deze pagina',
        error: 'Kon gebruikersgegevens niet ophalen'
      });
    }

    // Admins always have access
    if (profile?.is_admin === true) {
      return next();
    }

    // Check role - if role_id exists, fetch the role to check if it's an employee role
    if (profile?.role_id) {
      const { supabaseAdmin } = require('../config/supabase');
      const { data: role, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('id, name')
        .eq('id', profile.role_id)
        .maybeSingle();

      if (!roleError && role) {
        const roleName = role.name?.toLowerCase() || '';
        // Block customer/consumer roles
        if (roleName === 'consumer' || roleName === 'customer' || roleName === 'klant') {
          SystemLogService.logAuth(
            req.user.id,
            'employee_access_denied',
            'Klant rol probeerde toegang te krijgen tot admin gebied',
            req.ip,
            req.get('User-Agent')
          ).catch(err => console.log('Auth logging failed:', err));
          
          return res.status(403).render('errors/403', { 
            message: 'Geen toegang tot deze pagina',
            error: 'Klanten hebben geen toegang tot het admin gebied'
          });
        }
        // Allow employee roles and admin roles
        return next();
      }
    }

    // If no role_id but user exists, allow access (backward compatibility)
    // This allows existing users without roles to still access
    return next();

  } catch (err) {
    console.log('Error checking employee access:', err);
    return res.status(403).render('errors/403', { 
      message: 'Geen toegang tot deze pagina',
      error: 'Fout bij het controleren van toegang'
    });
  }
}

/**
 * Protect routes that require manager or admin access.
 * Checks if user is admin OR has a manager role.
 */
async function isManagerOrAdmin(req, res, next) {
  if (!req.user) {
    SystemLogService.logAuth(
      null,
      'manager_access_denied',
      'Manager toegang geweigerd - geen gebruiker',
      req.ip,
      req.get('User-Agent')
    ).catch(err => console.log('Auth logging failed:', err));
    
    return res.status(403).json({
      success: false,
      error: 'Authenticatie vereist'
    });
  }

  // First check if user is admin (admins always have access)
  if (req.user.user_metadata?.is_admin === true) {
    return next();
  }

  try {
    const { createBaseClient } = require('../lib/supabase');
    const supabase = createBaseClient();
    const { supabaseAdmin } = require('../config/supabase');
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('is_admin, role_id')
      .eq('id', req.user.id)
      .single();

    if (error) {
      console.log('Error checking profile for manager access:', error);
      return res.status(403).json({
        success: false,
        error: 'Kon gebruikersgegevens niet ophalen'
      });
    }

    // Admins always have access
    if (profile?.is_admin === true) {
      return next();
    }

    // Check if user has a manager role
    if (profile?.role_id) {
      const { data: role, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .maybeSingle();

      if (!roleError && role) {
        const roleName = role.name?.toLowerCase() || '';
        // Check if role name contains 'manager'
        if (roleName.includes('manager')) {
          return next();
        }
      }
    }

    // Log access denied
    SystemLogService.logAuth(
      req.user.id,
      'manager_access_denied',
      'Manager toegang geweigerd - geen manager of admin rechten',
      req.ip,
      req.get('User-Agent')
    ).catch(err => console.log('Auth logging failed:', err));

    return res.status(403).json({
      success: false,
      error: 'Manager of admin toegang vereist'
    });

  } catch (err) {
    console.log('Error checking manager access:', err);
    return res.status(403).json({
      success: false,
      error: 'Fout bij het controleren van toegang'
    });
  }
}

/**
 * Clear auth cookies and (optionally) sign out on Supabase (not required server-side).
 */
async function clearSession(req, res) {
  const cookieOptions = {
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
    path: '/',
    domain: process.env.NODE_ENV === "production" ? '.growsocial.nl' : undefined
  };
  res.clearCookie('sb-access-token', cookieOptions);
  res.clearCookie('sb-refresh-token', cookieOptions);
}

function setAuthCookies(res, session) {
  const access = session?.access_token;
  const refresh = session?.refresh_token;
  const exp = session?.expires_in ? Number(session.expires_in) * 1000 : 60 * 60 * 1000;

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
    path: '/',
    domain: process.env.NODE_ENV === "production" ? '.growsocial.nl' : undefined
  };

  if (access) {
    res.cookie('sb-access-token', access, {
      ...cookieOptions,
      maxAge: exp,
    });
  }
  if (refresh) {
    // Typical refresh validity is long-lived; set a sensible max age (e.g., 14 days)
    res.cookie('sb-refresh-token', refresh, {
      ...cookieOptions,
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });
  }
}

module.exports = { refreshIfNeeded, requireAuth, isAdmin, isEmployeeOrAdmin, isManagerOrAdmin, clearSession, setAuthCookies };