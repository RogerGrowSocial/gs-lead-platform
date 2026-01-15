// middleware/auth.js
const { createBaseClient, createRequestClient } = require('../lib/supabase');
const SystemLogService = require('../services/systemLogService');

// Rate limiting for authentication logging
const authLogCache = new Map();
const AUTH_LOG_COOLDOWN = 30000; // 30 seconds cooldown between same user auth logs

// Profile status cache to reduce database queries
const profileStatusCache = new Map();
const PROFILE_STATUS_CACHE_TTL = 60000; // 1 minute cache for profile status

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
 * OPTIMIZED: Skip Supabase client creation if no cookies exist.
 */
async function refreshIfNeeded(req, res, next) {
  const start = req.performanceTimings ? process.hrtime.bigint() : null;
  try {
    // OPTIMIZED: Check cookies first before creating Supabase client
    const access = req.cookies?.['sb-access-token'];
    const refresh = req.cookies?.['sb-refresh-token'];

    if (!access && !refresh) {
      // No cookies at all - skip all Supabase calls (fast path)
      if (start && req.performanceTimings) {
        const end = process.hrtime.bigint();
        const time = Number(end - start) / 1000000;
        req.performanceTimings.middleware['refreshIfNeeded'] = time;
      }
      return next();
    }

    // Only create Supabase client if we have cookies
    const base = createBaseClient();
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
      
      if (start && req.performanceTimings) {
        const end = process.hrtime.bigint();
        const time = Number(end - start) / 1000000;
        req.performanceTimings.middleware['refreshIfNeeded'] = time;
      }
      return next();
    }

    // Try refresh if we have refresh token
    if (refresh && userErr) {
      const { data: refreshData, error: refreshErr } = await base.auth.refreshSession({
        refresh_token: refresh
      });

      if (!refreshErr && refreshData?.session) {
        // Set new cookies
        res.cookie('sb-access-token', refreshData.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
        });
        res.cookie('sb-refresh-token', refreshData.session.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
        });

        req.user = refreshData.session.user;
        
        if (shouldLogAuth(refreshData.session.user.id, 'refreshed')) {
          SystemLogService.logAuth(
            refreshData.session.user.id,
            'refreshed',
            'Sessie vernieuwd',
            req.ip,
            req.get('User-Agent')
          ).catch(err => console.log('Auth logging failed:', err));
        }
        
        if (start && req.performanceTimings) {
          const end = process.hrtime.bigint();
          const time = Number(end - start) / 1000000;
          req.performanceTimings.middleware['refreshIfNeeded'] = time;
        }
        
        return next();
      }
    }

    // Fallthrough: no valid user
    if (start && req.performanceTimings) {
      const end = process.hrtime.bigint();
      const time = Number(end - start) / 1000000;
      req.performanceTimings.middleware['refreshIfNeeded'] = time;
    }
    return next();
  } catch (e) {
    // Do not crash the request; just proceed unauthenticated
    if (start && req.performanceTimings) {
      const end = process.hrtime.bigint();
      const time = Number(end - start) / 1000000;
      req.performanceTimings.middleware['refreshIfNeeded'] = time;
    }
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

  // ✅ Check if user account is active (with caching to reduce DB queries)
  try {
    // Check cache first
    const cacheKey = `profile_status_${req.user.id}`;
    const cached = profileStatusCache.get(cacheKey);
    const now = Date.now();
    
    let profile = null;
    
    if (cached && (now - cached.timestamp) < PROFILE_STATUS_CACHE_TTL) {
      // Use cached profile status
      profile = cached.profile;
    } else {
      // Fetch from database - use supabaseAdmin to bypass RLS
      const { supabaseAdmin } = require('../config/supabase');
      
      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('status')
        .eq('id', req.user.id)
        .maybeSingle(); // Use maybeSingle for cleaner result

      if (error) {
        // Only log non-critical errors (don't spam logs)
        const isPollingEndpoint = req.path.includes('/progress') || req.path.includes('/poll') || req.path.includes('/unread-messages-count') || req.path.includes('/onboarding/status');
        if (!isPollingEndpoint) {
          console.error('Error checking user status:', error.message);
        }
        // Continue if we can't check status (don't block user)
        return next();
      }

      profile = profiles;
      
      // Cache the result
      if (profile) {
        profileStatusCache.set(cacheKey, {
          profile: profile,
          timestamp: now
        });
      }
      
      // Clean old cache entries (keep cache size reasonable)
      if (profileStatusCache.size > 1000) {
        const entriesToDelete = [];
        for (const [key, value] of profileStatusCache.entries()) {
          if ((now - value.timestamp) > PROFILE_STATUS_CACHE_TTL) {
            entriesToDelete.push(key);
          }
        }
        entriesToDelete.forEach(key => profileStatusCache.delete(key));
      }
    }
    if (!profile) {
      // Only log for non-polling endpoints to reduce noise
      const isPollingEndpoint = req.path.includes('/progress') || req.path.includes('/poll') || req.path.includes('/unread-messages-count') || req.path.includes('/onboarding/status');
      if (!isPollingEndpoint) {
        console.warn('⚠️ No profile found for user:', req.user.id, '- attempting to create profile');
        
        // Ensure profile exists (upsert) - WAIT for it to complete
        try {
          const { supabaseAdmin } = require('../config/supabase');
          // First check if profile exists to preserve role_id (which has NOT NULL constraint)
          const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
            .from('profiles')
            .select('role_id, status')
            .eq('id', req.user.id)
            .maybeSingle();
          
          if (existingProfileError) {
            console.error('Error checking existing profile:', existingProfileError);
          }
          
          // Build upsert data - preserve existing role_id if profile exists
          const upsertData = {
            id: req.user.id,
            email: req.user.email,
            company_name: req.user.user_metadata?.company_name || null,
            first_name: req.user.user_metadata?.first_name || null,
            last_name: req.user.user_metadata?.last_name || null,
            status: existingProfile?.status || 'active',
            balance: 0,
            is_admin: req.user.user_metadata?.is_admin === true || false,
            updated_at: new Date().toISOString()
          };
          
          // CRITICAL: role_id has NOT NULL constraint - must always be set
          // If profile exists, preserve its role_id. If not, we need a default role_id
          if (existingProfile?.role_id) {
            upsertData.role_id = existingProfile.role_id;
            console.log(`[requireAuth] Preserving existing role_id: ${existingProfile.role_id}`);
          } else {
            // Profile doesn't exist or has no role_id - we need to set one
            // Try to get a default "customer" role or use the first available role
            // For now, if we can't find a role, we'll let the upsert fail and handle it in the error handler
            console.warn(`[requireAuth] No existing role_id found for user ${req.user.id}, profile creation may fail if role_id is required`);
            // Don't set role_id - let the database error tell us if it's required
          }
          
          // Only set created_at if profile doesn't exist
          if (!existingProfile) {
            upsertData.created_at = new Date().toISOString();
          }
          
          const { data: newProfile, error: upsertError } = await supabaseAdmin
            .from('profiles')
            .upsert(upsertData, {
              onConflict: 'id'
            })
            .select()
            .single();
          
          if (upsertError) {
            console.error('Error creating profile in middleware:', upsertError);
            // If error is due to role_id constraint, try to fetch existing profile instead
            if (upsertError.code === '23502' && upsertError.message?.includes('role_id')) {
              console.log('⚠️ role_id constraint error, attempting to fetch existing profile');
              const { data: fetchedProfile } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .eq('id', req.user.id)
                .single();
              
              if (fetchedProfile) {
                profile = fetchedProfile;
                profileStatusCache.set(cacheKey, {
                  profile: profile,
                  timestamp: Date.now()
                });
                console.log('✅ Using existing profile after role_id constraint error');
              }
            }
          } else {
            console.log('✅ Profile created/updated for user:', req.user.id);
            // Update profile variable so it's available for the rest of the middleware
            profile = newProfile;
            // Cache it
            profileStatusCache.set(cacheKey, {
              profile: profile,
              timestamp: Date.now()
            });
          }
        } catch (err) {
          console.error('Exception creating profile in middleware:', err);
        }
      }
      // Continue even if profile creation failed (don't block user)
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
    // Use supabaseAdmin to bypass RLS and ensure we can always read the profile
    const { supabaseAdmin } = require('../config/supabase');
    
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, role_id')
      .eq('id', req.user.id)
      .single();

    if (error) {
      console.log('[isEmployeeOrAdmin] Error checking profile for employee access:', error);
      console.log('[isEmployeeOrAdmin] User ID:', req.user.id, 'Email:', req.user.email);
      console.log('[isEmployeeOrAdmin] Error code:', error.code, 'Error message:', error.message);
      return res.status(403).render('errors/403', { 
        message: 'Geen toegang tot deze pagina',
        error: 'Kon gebruikersgegevens niet ophalen'
      });
    }

    console.log(`[isEmployeeOrAdmin] Checking access for user ${req.user.id} (${req.user.email}):`, {
      is_admin: profile?.is_admin,
      role_id: profile?.role_id
    });

    // Admins always have access
    if (profile?.is_admin === true) {
      console.log(`[isEmployeeOrAdmin] Access granted: user is admin`);
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

      if (roleError) {
        console.log('Error fetching role for employee access check:', roleError);
        console.log('Role ID:', profile.role_id);
        // If we can't fetch the role, allow access (fail open for backward compatibility)
        console.log(`[isEmployeeOrAdmin] Access granted: role fetch error (fail open)`);
        return next();
      }

      if (role) {
        const roleName = role.name?.toLowerCase() || '';
        console.log(`[isEmployeeOrAdmin] Checking role access for user ${req.user.id}: role_id="${profile.role_id}", role_name="${roleName}"`);
        
        // Block customer/consumer roles
        if (roleName === 'consumer' || roleName === 'customer' || roleName === 'klant') {
          console.log(`[isEmployeeOrAdmin] Access DENIED: user has customer role "${roleName}"`);
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
        
        // Explicitly allow manager, employee, admin, and werknemer roles
        const allowedRoles = ['manager', 'employee', 'admin', 'administrator', 'werknemer', 'employee'];
        const isAllowedRole = allowedRoles.some(allowed => roleName.includes(allowed));
        
        if (isAllowedRole) {
          console.log(`[isEmployeeOrAdmin] Access granted: role "${roleName}" is an allowed role (manager/employee/admin)`);
          return next();
        }
        
        // Allow all other non-customer roles (fail open for backward compatibility)
        console.log(`[isEmployeeOrAdmin] Access granted: role "${roleName}" is not a customer role (fail open)`);
        return next();
      } else {
        console.log(`[isEmployeeOrAdmin] No role found for role_id: ${profile.role_id}`);
        // If role doesn't exist, allow access (fail open for backward compatibility)
        console.log(`[isEmployeeOrAdmin] Access granted: role not found (fail open)`);
        return next();
      }
    }

    // If no role_id but user exists, allow access (backward compatibility)
    // This allows existing users without roles to still access
    console.log(`[isEmployeeOrAdmin] Access granted: no role_id (backward compatibility)`);
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
  // Determine cookie domain dynamically based on host
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
  const cookieDomain = isVercel ? undefined : (process.env.NODE_ENV === "production" ? '.growsocial.nl' : undefined);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? 'lax' : 'lax', // Changed from 'none' to 'lax'
    path: '/',
    domain: cookieDomain
  };
  res.clearCookie('sb-access-token', cookieOptions);
  res.clearCookie('sb-refresh-token', cookieOptions);
}

function setAuthCookies(res, session) {
  const access = session?.access_token;
  const refresh = session?.refresh_token;
  const exp = session?.expires_in ? Number(session.expires_in) * 1000 : 60 * 60 * 1000;

  // Determine cookie domain dynamically based on host
  // On Vercel, don't set domain to allow cookies to work across subdomains
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
  const cookieDomain = isVercel ? undefined : (process.env.NODE_ENV === "production" ? '.growsocial.nl' : undefined);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? 'lax' : 'lax', // Changed from 'none' to 'lax' for better compatibility
    path: '/',
    domain: cookieDomain
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