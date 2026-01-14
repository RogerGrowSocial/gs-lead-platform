const express = require("express")
const router = express.Router()
const { createBaseClient } = require('../lib/supabase')
const { supabaseAdmin } = require('../config/supabase')
const { setAuthCookies, clearSession } = require('../middleware/auth')
const logger = require('../utils/logger')
const speakeasy = require('speakeasy')
const crypto = require('crypto')
const { logLoginHistory } = require('../utils/loginHistory')

// Determine where to send the user after login.
// OPTIMIZED: Parallel queries instead of sequential for maximum speed
async function getPostLoginRedirect(userId, requestedPath = '/dashboard') {
  const target = requestedPath || '/dashboard'

  try {
    // OPTIMIZED: Fetch profile with role_id (role column doesn't exist in profiles table)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, role_id')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('Error fetching profile for redirect:', profileError)
      return target || '/dashboard'
    }

    // Fetch role name from roles table if role_id exists
    let roleName = null
    if (profile?.role_id) {
      const { data: role, error: roleError } = await supabaseAdmin
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .maybeSingle()

      if (!roleError && role?.name) {
        roleName = role.name
      }
    }

    const normalizedRole = typeof roleName === 'string' ? roleName.toLowerCase() : ''
    const isAdmin = profile?.is_admin === true || profile?.is_admin === 1
    const isManager = normalizedRole.includes('manager')

    if (isAdmin || isManager) {
      // Respect explicit admin destinations; otherwise force admin dashboard
      if (target && target.startsWith('/admin')) {
        return target
      }
      return '/admin/dashboard'
    }
  } catch (redirectError) {
    console.error('Error determining post-login redirect:', redirectError)
  }

  return target || '/dashboard'
}

// Append standard login success params to a redirect path
function withLoginSuccess(path) {
  const base = path || '/dashboard'
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}login=success&message=${encodeURIComponent('Je bent succesvol ingelogd')}`
}

// Login page
router.get("/login", (req, res) => {
  const error = req.query.error || null;
  const success = req.query.reset === 'success' 
    ? 'Je wachtwoord is succesvol gereset. Je kunt nu inloggen.' 
    : req.query.logout === 'success'
    ? 'Je bent succesvol uitgelogd.'
    : null;
  const values = { email: req.query.email || '' };
  const returnTo = req.query.returnTo || '/dashboard';

  res.render('auth/login', { error, success, values, returnTo });
});

// Login processing
router.post("/login", async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const returnTo = req.body.returnTo || req.query.returnTo || '/dashboard';

  try {
    const supabase = createBaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      const msg = (error && error.message) || 'Inloggen mislukt. Controleer je gegevens.';
      return res.status(400).render('auth/login', {
        error: msg,
        success: null,
        values: { email },
        returnTo
      });
    }

    // OPTIMIZED: Run status check and 2FA check in parallel for maximum speed
    // Also ensure profile exists (upsert) to prevent "No profile found" errors
    const [profileResult, settingsResult] = await Promise.all([
      // Check user status and ensure profile exists
      supabaseAdmin
        .from('profiles')
        .select('status, email, company_name, first_name, last_name')
        .eq('id', data.user.id)
        .maybeSingle()
        .then(async ({ data: profile, error: profileError }) => {
          // If profile doesn't exist, create it (upsert)
          if (profileError && profileError.code === 'PGRST116' || !profile) {
            console.log(`📝 Creating missing profile for user ${data.user.id}`);
            const { data: newProfile, error: createError } = await supabaseAdmin
              .from('profiles')
              .upsert({
                id: data.user.id,
                email: data.user.email,
                company_name: data.user.user_metadata?.company_name || null,
                first_name: data.user.user_metadata?.first_name || null,
                last_name: data.user.user_metadata?.last_name || null,
                role_id: null, // Will be set by admin if needed
                status: 'active',
                balance: 0,
                is_admin: data.user.user_metadata?.is_admin === true || false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'id'
              })
              .select('status')
              .single();
            
            if (createError) {
              console.error('Error creating profile:', createError);
              return { data: null, error: createError };
            }
            
            return { data: newProfile || { status: 'active' }, error: null };
          }
          
          if (profileError) {
            console.error('Error checking user status:', profileError);
            return { data: null, error: profileError };
          }
          
          return { data: profile, error: null };
        })
        .catch(err => {
          console.error('Error in profile check/ensure:', err);
          return { data: null, error: err };
        }),
      // Check if 2FA is enabled
      supabaseAdmin
        .from('settings')
        .select('two_factor_enabled, two_factor_secret')
        .eq('user_id', data.user.id)
        .maybeSingle()
        .catch(err => {
          console.error('Error checking 2FA settings:', err);
          return { data: null, error: err };
        })
    ]);

    // Check user status
    const { data: profile, error: profileError } = profileResult;
    if (!profileError && profile) {
      if (profile.status === 'inactive') {
        await supabase.auth.signOut();
        return res.status(400).render('auth/login', {
          error: 'Je account is gedeactiveerd. Neem contact op met de beheerder.',
          success: null,
          values: { email },
          returnTo
        });
      }

      if (profile.status === 'pending') {
        await supabase.auth.signOut();
        return res.status(400).render('auth/login', {
          error: 'Je account is nog in afwachting van goedkeuring. Neem contact op met de beheerder.',
          success: null,
          values: { email },
          returnTo
        });
      }
    }

    // Check 2FA
    const { data: settings, error: settingsError } = settingsResult;
    const twoFactorEnabled = settings?.two_factor_enabled === 1 || settings?.two_factor_enabled === true;

    if (twoFactorEnabled && settings?.two_factor_secret) {
      // Check if user has "remember device" cookie
      const rememberToken = req.cookies?.[`2fa_remember_${data.user.id}`];
      const rememberExpiry = req.cookies?.[`2fa_remember_exp_${data.user.id}`];

      if (rememberToken && rememberExpiry) {
        const now = Date.now();
        const expiry = parseInt(rememberExpiry, 10);

        if (now < expiry) {
          // Valid remember token, skip 2FA
          console.log('[2FA] Remember device token valid, skipping 2FA');
          setAuthCookies(res, data.session);
          // OPTIMIZED: Run redirect and login history in parallel
          const [redirectPath] = await Promise.all([
            getPostLoginRedirect(data.user.id, returnTo),
            logLoginHistory({
              userId: data.user.id,
              req,
              status: 'success',
              loginMethod: '2fa'
            }).catch(err => console.error('Login history logging failed (non-blocking):', err))
          ]);
          return res.redirect(withLoginSuccess(redirectPath));
        } else {
          // Token expired, clear cookies
          res.clearCookie(`2fa_remember_${data.user.id}`);
          res.clearCookie(`2fa_remember_exp_${data.user.id}`);
        }
      }

      // 2FA is enabled and no valid remember token - redirect to 2FA verification
      // Store session temporarily in cookies for 2FA verification
      // IMPORTANT: Don't sign out - just store the tokens temporarily
      const sessionData = data.session;
      
      // Set temporary cookies for 2FA verification
      res.cookie('2fa_pending_user_id', data.user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000 // 10 minutes
      });
      res.cookie('2fa_pending_access_token', sessionData.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000 // 10 minutes
      });
      res.cookie('2fa_pending_refresh_token', sessionData.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000 // 10 minutes
      });
      res.cookie('2fa_pending_return_to', returnTo || '/dashboard', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000 // 10 minutes
      });

      // Clear the main session cookies so user isn't fully logged in yet
      // But DON'T call supabase.auth.signOut() - that invalidates the tokens
      res.clearCookie('sb-access-token');
      res.clearCookie('sb-refresh-token');

      // Redirect to 2FA verification page
      return res.redirect('/verify-2fa');
    }

    // Set cookies and redirect with success message
    setAuthCookies(res, data.session);
    
    // OPTIMIZED: Run redirect determination and login history logging in parallel
    // Don't wait for login history - it's non-critical and can happen async
    const [redirectPath] = await Promise.all([
      getPostLoginRedirect(data.user.id, returnTo),
      // Log login history in background (non-blocking)
      logLoginHistory({
        userId: data.user.id,
        req,
        status: 'success',
        loginMethod: 'password'
      }).catch(err => console.error('Login history logging failed (non-blocking):', err))
    ]);
    
    return res.redirect(withLoginSuccess(redirectPath));

  } catch (err) {
    const msg = err?.message || 'Er ging iets mis bij inloggen.';
    return res.status(500).render('auth/login', {
      error: msg,
      success: null,
      values: { email },
      returnTo
    });
  }
});

// 2FA Verification page - support both /verify-2fa and /auth/verify-2fa
const verify2FAHandler = (req, res) => {
  const userId = req.cookies?.['2fa_pending_user_id'];
  const returnTo = req.cookies?.['2fa_pending_return_to'] || '/dashboard';

  if (!userId) {
    return res.redirect('/login?error=Geen actieve login sessie. Log opnieuw in.');
  }
  
  res.render('auth/verify-2fa', {
    layout: false,
    error: null,
    returnTo
  });
};

router.get("/verify-2fa", verify2FAHandler);
router.get("/auth/verify-2fa", verify2FAHandler);

// 2FA Verification processing - support both /verify-2fa and /auth/verify-2fa
const verify2FAPostHandler = async (req, res) => {
  const { code, rememberDevice } = req.body;
  const userId = req.cookies?.['2fa_pending_user_id'];
  const accessToken = req.cookies?.['2fa_pending_access_token'];
  const refreshToken = req.cookies?.['2fa_pending_refresh_token'];
  const returnTo = req.cookies?.['2fa_pending_return_to'] || '/dashboard';

  if (!userId || !accessToken || !refreshToken) {
    // Clear invalid cookies
    res.clearCookie('2fa_pending_user_id');
    res.clearCookie('2fa_pending_access_token');
    res.clearCookie('2fa_pending_refresh_token');
    res.clearCookie('2fa_pending_return_to');
    
    return res.status(400).render('auth/verify-2fa', {
      layout: false,
      error: 'Geen actieve login sessie',
      returnTo
    });
  }

  if (!code || code.replace(/\D/g, '').length !== 6) {
    return res.status(400).render('auth/verify-2fa', {
      layout: false,
      error: 'Voer een geldige 6-cijferige code in',
      returnTo
    });
  }

  try {
    // Get user's 2FA secret
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('settings')
      .select('two_factor_secret')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings?.two_factor_secret) {
      console.error('[2FA] Error fetching secret:', settingsError);
      return res.status(400).render('auth/verify-2fa', {
        layout: false,
        error: 'Fout bij ophalen 2FA instellingen',
        returnTo
      });
    }

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: settings.two_factor_secret,
      encoding: 'base32',
      token: code.replace(/\D/g, ''), // Only numbers
      window: 2 // Allow 2 time steps before/after
    });

    if (!verified) {
      return res.status(400).render('auth/verify-2fa', {
        layout: false,
        error: 'Ongeldige verificatiecode',
        returnTo
      });
    }

    // Valid code - restore session using the stored tokens
    // First verify the tokens are still valid by creating a Supabase client with them
    const { createBaseClient } = require('../lib/supabase');
    const testClient = createBaseClient();
    
    // Set the session in the client to verify it works
    const { data: sessionData, error: sessionError } = await testClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    
    if (sessionError || !sessionData?.session) {
      console.error('[2FA] Error restoring session:', sessionError);
      // Try refreshing the session
      const { data: refreshData, error: refreshError } = await testClient.auth.refreshSession({
        refresh_token: refreshToken
      });
      
      if (refreshError || !refreshData?.session) {
        return res.status(400).render('auth/verify-2fa', {
          layout: false,
          error: 'Je sessie is verlopen. Log opnieuw in.',
          returnTo
        });
      }
      
      // Use refreshed session
      setAuthCookies(res, refreshData.session);
    } else {
      // Use the original session
      setAuthCookies(res, sessionData.session);
    }

    // If "remember device" is checked, set cookie for 14 days
    if (rememberDevice === 'on' || rememberDevice === true) {
      const rememberToken = crypto.randomBytes(32).toString('hex');
      const expiry = Date.now() + (14 * 24 * 60 * 60 * 1000); // 14 days

      res.cookie(`2fa_remember_${userId}`, rememberToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
      });
      res.cookie(`2fa_remember_exp_${userId}`, expiry.toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
      });
    }

    // Clear temporary cookies
    res.clearCookie('2fa_pending_user_id');
    res.clearCookie('2fa_pending_access_token');
    res.clearCookie('2fa_pending_refresh_token');
    res.clearCookie('2fa_pending_return_to');

    // OPTIMIZED: Run redirect and login history in parallel
    const [redirectPath] = await Promise.all([
      getPostLoginRedirect(userId, returnTo),
      logLoginHistory({
        userId: userId,
        req,
        status: 'success',
        loginMethod: '2fa'
      }).catch(err => console.error('Login history logging failed (non-blocking):', err))
    ]);
    
    return res.redirect(withLoginSuccess(redirectPath));

  } catch (err) {
    console.error('[2FA] Error during verification:', err);
    return res.status(500).render('auth/verify-2fa', {
      layout: false,
      error: 'Er is een fout opgetreden bij de verificatie',
      returnTo
    });
  }
};

router.post("/verify-2fa", verify2FAPostHandler);
router.post("/auth/verify-2fa", verify2FAPostHandler);

// Registration page
router.get("/register", (req, res) => {
  // Check if there's a pending verification email in session
  const pendingEmail = req.session?.pendingVerificationEmail || null;
  const successMessage = pendingEmail 
    ? "Registratie succesvol! Controleer je e-mail (en spam folder) om je account te verifiëren."
    : null;
  
  res.render("auth/register", { 
    layout: false, 
    error: null, 
    success: successMessage, 
    // Prefill the form with the pending email so the resend script can read it
    formData: pendingEmail ? { email: pendingEmail } : {},
    userEmail: pendingEmail // Use email from session if available
  })
})

// Registration processing
router.post("/register", async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body
    const supabase = createBaseClient();

    if (!email || !password || !confirmPassword) {
      return res.render("auth/register", {
        layout: false,
        error: "Vul alle verplichte velden in",
        success: null,
        formData: { email },
        userEmail: null
      })
    }

    if (password !== confirmPassword) {
      return res.render("auth/register", {
        layout: false,
        error: "Wachtwoorden komen niet overeen",
        success: null,
        formData: { email },
        userEmail: null
      })
    }

    if (password.length < 8) {
      return res.render("auth/register", {
        layout: false,
        error: "Wachtwoord moet minimaal 8 tekens lang zijn",
        success: null,
        formData: { email },
        userEmail: null
      })
    }

    const emailRedirectTo = `${req.protocol}://${req.get('host')}/auth/verify-email`;
    
    logger.info('Attempting user registration:', {
      email: email,
      emailRedirectTo: emailRedirectTo,
      protocol: req.protocol,
      host: req.get('host')
    });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailRedirectTo,
        data: {
          // Optional: add any metadata here
        }
      }
    })

    // Log response details for debugging
    logger.info('Signup response:', {
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      userConfirmed: data?.user?.email_confirmed_at ? 'yes' : 'no',
      userCreated: data?.user?.created_at,
      error: error ? {
        code: error.code,
        message: error.message,
        status: error.status
      } : null
    });

    if (error) {
      logger.error('Registration error:', error);
      
      // Check if error is specifically about email sending
      // Sometimes Supabase creates the user but fails to send email
      const isEmailError = error.code === 'unexpected_failure' && 
                          error.message?.toLowerCase().includes('email');
      
      if (isEmailError && data?.user) {
        // User was created but email failed - still show success but warn about email
        logger.warn('User created but email confirmation failed:', {
          userId: data.user.id,
          email: email,
          error: error.message
        });
        
        // Store email in session for resend functionality
        req.session.pendingVerificationEmail = email;
        
        return res.render("auth/register", {
          layout: false,
          error: null,
          success: "Je account is aangemaakt, maar er was een probleem met het versturen van de verificatie-e-mail. Probeer in te loggen of neem contact op met de beheerder.",
          formData: {},
          userEmail: email
        })
      }
      
      // Handle other registration errors
      let errorMessage = "Er is een fout opgetreden bij registratie";
      
      if (error.message) {
        // Translate common error messages
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          errorMessage = "Dit e-mailadres is al geregistreerd";
        } else if (error.message.includes('invalid email')) {
          errorMessage = "Ongeldig e-mailadres";
        } else if (error.message.includes('password')) {
          errorMessage = "Wachtwoord voldoet niet aan de vereisten";
        } else if (error.message.toLowerCase().includes('rate limit') || error.message.toLowerCase().includes('exceeded')) {
          errorMessage = "Er is een tijdelijke limiet bereikt voor het versturen van e-mails. Probeer het later opnieuw.";
        } else {
          errorMessage = error.message;
        }
      }
      
      return res.render("auth/register", {
        layout: false,
        error: errorMessage,
        success: null,
        formData: { email },
        userEmail: null
      })
    }

    // Check if user was created
    if (!data?.user) {
      logger.error('No user returned from signup');
      return res.render("auth/register", {
        layout: false,
        error: "Er is een fout opgetreden bij het aanmaken van je account",
        success: null,
        formData: { email },
        userEmail: null
      })
    }

    // Send welcome email with password setup link (non-blocking)
    // This runs in background so it doesn't delay the registration response
    (async () => {
      try {
        console.log(`📧 Attempting to send welcome email to: ${email}`);
        
        // Generate password reset link for welcome email
          const redirectBase = process.env.APP_URL || process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
          const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: {
              redirectTo: `${redirectBase}/auth/reset-password`
            }
          });
        
        if (resetError) {
          console.error("❌ Error generating password reset link for welcome email:", resetError);
          logger.error('Welcome email password reset link generation failed:', resetError);
        } else if (!resetData || !resetData.properties?.action_link) {
          console.error("❌ No reset link generated for welcome email");
          logger.error('Welcome email: No reset link generated');
        } else {
          console.log("✅ Password reset link generated for welcome email:", email);
          
          // Get user profile data for welcome email
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', data.user.id)
            .maybeSingle();
          
          // Send welcome email
          const EmailService = require('../services/emailService');
          const emailService = new EmailService();
          
          const emailSent = await emailService.sendWelcomeEmail({
            email,
            first_name: profile?.first_name || '',
            last_name: profile?.last_name || ''
          }, resetData.properties?.action_link);
          
          if (emailSent) {
            console.log("✅ Welcome email sent successfully to:", email);
            logger.info('Welcome email sent successfully after registration', { email, userId: data.user.id });
          } else {
            console.error("❌ Failed to send welcome email to:", email);
            logger.error('Welcome email failed to send after registration', { email, userId: data.user.id });
          }
        }
      } catch (emailErr) {
        console.error("❌ Exception while sending welcome email after registration:", emailErr);
        logger.error('Welcome email exception after registration', { email, error: emailErr.message });
      }
    })();

    // Check email confirmation status
    const isEmailConfirmed = !!data.user.email_confirmed_at;
    const hasSession = !!data.session;
    
    logger.info('Registration result:', {
      userId: data.user.id,
      email: email,
      emailConfirmed: isEmailConfirmed,
      hasSession: hasSession,
      confirmationRequired: !isEmailConfirmed && !hasSession
    });
    
    if (isEmailConfirmed) {
      // Email is already confirmed (email confirmation disabled in Supabase)
      logger.info('User created with email already confirmed (email confirmation disabled):', {
        userId: data.user.id,
        email: email
      });
      
      // Set session if available, otherwise redirect to login
      if (hasSession && data.session) {
        setAuthCookies(res, data.session);
        // Redirect to onboarding for new users (dashboard will check and redirect if needed)
        return res.redirect('/onboarding');
      } else {
        // Email confirmed but no session - redirect to login
        return res.render("auth/register", {
          layout: false,
          error: null,
          success: "Registratie succesvol! Je kunt nu direct inloggen.",
          formData: {},
          userEmail: null
        })
      }
    } else if (hasSession && data.session) {
      // Session exists but email not confirmed - set cookies and redirect
      logger.info('User created with session but email not confirmed - setting session:', {
        userId: data.user.id,
        email: email
      });
      
      setAuthCookies(res, data.session);
      req.session.pendingVerificationEmail = email;
      
      // Redirect to onboarding for new users
      return res.redirect('/onboarding');
    } else {
      // Email confirmation required - email should be sent
      logger.info('User created, email confirmation email should be sent:', {
        userId: data.user.id,
        email: email,
        emailSent: 'Supabase should send confirmation email',
        checkSupabaseConfig: 'Verify email confirmation is enabled in Supabase Auth settings'
      });
    }

    // Store email in session for resend functionality (even if user refreshes page)
    req.session.pendingVerificationEmail = email;
    
    // Log for debugging - check what we're passing
    logger.info('Rendering register page with resend option:', {
      email: email,
      hasUserEmail: !!email,
      userEmailValue: email,
      successMessage: "Registratie succesvol! Controleer je e-mail (en spam folder) om je account te verifiëren."
    });
    
    res.render("auth/register", {
      layout: false,
      error: null,
      success: "Registratie succesvol! Controleer je e-mail (en spam folder) voor verificatie en welkomstemail met wachtwoord setup link.",
      formData: { email: email }, // Also include email in formData as fallback
      userEmail: email // Pass email for resend functionality
    })
  } catch (error) {
    logger.error("Registration error:", error)
    res.render("auth/register", {
      layout: false,
      error: "Er is een fout opgetreden bij registratie",
      success: null,
      formData: { email: req.body.email },
      userEmail: null
    })
  }
})

// Resend email verification
const resendVerificationHandler = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'E-mailadres is verplicht' 
      });
    }

    logger.info('Attempting to resend verification email:', { email });

    // Local cooldown: allow immediately the first time; enforce 15s between requests per session
    const now = Date.now();
    const minIntervalMs = 15 * 1000;
    const lastSentAt = req.session?.lastVerificationEmailSentAt || 0;
    if (lastSentAt && (now - lastSentAt) < minIntervalMs) {
      const seconds = Math.ceil((minIntervalMs - (now - lastSentAt)) / 1000);
      return res.status(400).json({
        success: false,
        code: 'cooldown',
        cooldownSeconds: seconds,
        error: `Om misbruik te voorkomen kun je dit over ${seconds} seconden opnieuw proberen.`
      });
    }

    // Prefer admin-generated link + own SMTP to avoid Supabase short cooldowns
    try {
      const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: email,
        options: {
          redirectTo: `${req.protocol}://${req.get('host')}/auth/verify-email`
        }
      });

      if (adminError) {
        logger.warn('Admin API generateLink failed, will try regular resend:', adminError);
        throw adminError;
      }

      const actionLink = adminData?.properties?.action_link;
      if (!actionLink) {
        throw new Error('Geen verificatielink ontvangen van admin.generateLink');
      }

      const EmailService = require('../services/emailService');
      const emailService = new EmailService();

      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a">
          <h2 style="margin:0 0 16px">Bevestig je e‑mailadres</h2>
          <p>Bedankt voor je registratie bij GrowSocial. Klik op de knop hieronder om je account te verifiëren.</p>
          <p style="margin:20px 0">
            <a href="${actionLink}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:600">E‑mailadres bevestigen</a>
          </p>
          <p>Werkt de knop niet? Kopieer en plak deze link in je browser:</p>
          <p style="word-break:break-all;color:#2563eb">${actionLink}</p>
        </div>`;

      const sent = await emailService.sendEmail({
        to: email,
        subject: 'Bevestig je e‑mailadres',
        html
      });

      if (!sent) {
        throw new Error('Verificatie e‑mail kon niet worden verzonden via SMTP');
      }

      // Mark timestamp for cooldown
      if (req.session) {
        req.session.lastVerificationEmailSentAt = now;
      }

      logger.info('Verification email sent via SMTP with admin link:', { email });
      return res.json({
        success: true,
        message: 'Verificatie e‑mail is opnieuw verzonden. Controleer je inbox (en spam folder).'
      });
    } catch (smtpOrAdminErr) {
      // Fallback to regular resend method
      const supabase = createBaseClient();
      const { data, error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${req.protocol}://${req.get('host')}/auth/verify-email`
        }
      });

      if (error) {
        logger.error('Resend verification error:', error);
      
      // Friendly handling of short security cooldowns
      if (typeof error.message === 'string' && /security purposes/i.test(error.message)) {
        const match = error.message.match(/after\s+(\d+)\s+seconds?/i) || error.message.match(/(\d+)\s+seconds?/i);
        const seconds = match ? parseInt(match[1], 10) : 60;
        return res.status(400).json({
          success: false,
          code: 'cooldown',
          cooldownSeconds: seconds,
          error: `Om misbruik te voorkomen kun je dit over ${seconds} seconden opnieuw proberen.`
        });
      }

      // Check if user is already confirmed
      if (error.message?.includes('already confirmed') || error.message?.includes('already verified') || error.code === 'email_already_confirmed') {
        return res.status(400).json({ 
          success: false, 
          error: 'Dit e-mailadres is al geverifieerd. Je kunt direct inloggen.' 
        });
      }
      
      // Check if user doesn't exist
      if (error.message?.includes('not found') || error.message?.includes('does not exist') || error.code === 'user_not_found') {
        return res.status(400).json({ 
          success: false, 
          error: 'Geen account gevonden met dit e-mailadres.' 
        });
      }
      
      return res.status(400).json({ 
        success: false, 
        error: error.message || 'Er is een fout opgetreden bij het opnieuw verzenden van de verificatie e-mail.' 
      });
      }

      logger.info('Verification email resent successfully via Supabase:', { email });
      if (req.session) {
        req.session.lastVerificationEmailSentAt = now;
      }
      return res.json({ 
        success: true, 
        message: 'Verificatie e‑mail is opnieuw verzonden. Controleer je inbox (en spam folder).' 
      });
    }
  } catch (error) {
    logger.error('Resend verification error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Er is een fout opgetreden bij het opnieuw verzenden van de verificatie e-mail.' 
    });
  }
};

router.post("/resend-verification", resendVerificationHandler);
router.post("/auth/resend-verification", resendVerificationHandler);

// Password reset request page
router.get("/forgot-password", (req, res) => {
  res.render("auth/forgot-password", {
    layout: false,
    error: null,
    success: null
  })
})

// Process password reset request
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body
    const supabase = createBaseClient();
    const redirectBase = process.env.APP_URL || process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    if (!email) {
      return res.render("auth/forgot-password", {
        layout: false,
        error: "Vul je e-mailadres in",
        success: null
      })
    }

    // Check if email is internal (same domain) - use dual SMTP for internal emails
    const EmailService = require('../services/emailService');
    const emailService = new EmailService();
    const isInternal = emailService.isInternalEmail(email);

    if (isInternal) {
      // For internal emails, use our own emailService with dual SMTP
      console.log(`📧 Internal email detected (${email}), using dual SMTP...`);
      
      try {
        // Generate recovery link via Supabase admin API
        const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: email,
          options: {
            redirectTo: `${redirectBase}/reset-password`
          }
        });

        if (resetError) {
          console.error("❌ Error generating password reset link:", resetError);
          logger.error('Password reset link generation failed:', resetError);
          return res.render("auth/forgot-password", {
            layout: false,
            error: resetError.message || "Er is een fout opgetreden bij het genereren van de reset link",
            success: null
          });
        }

        if (!resetData || !resetData.properties?.action_link) {
          console.error("❌ No reset link generated");
          logger.error('Password reset: No reset link generated');
          return res.render("auth/forgot-password", {
            layout: false,
            error: "Er is een fout opgetreden bij het genereren van de reset link",
            success: null
          });
        }

        // Get user profile for personalization
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', resetData.user.id)
          .maybeSingle();

        // Render password reset email template
        const htmlContent = emailService.renderTemplate('supabase-reset-password', {
          email: email,
          first_name: profile?.first_name || '',
          last_name: profile?.last_name || '',
          reset_link: resetData.properties.action_link
        });

        // Send via our emailService (uses dual SMTP - Mijndomein for internal)
        const emailSent = await emailService.sendEmail({
          to: email,
          subject: 'Reset je wachtwoord',
          html: htmlContent
        });

        if (!emailSent) {
          console.error("❌ Failed to send password reset email via emailService");
          logger.error('Password reset email failed to send', { email });
          return res.render("auth/forgot-password", {
            layout: false,
            error: "Er is een fout opgetreden bij het versturen van de email. Controleer of de interne SMTP gegevens (Mijndomein) correct zijn en probeer het opnieuw.",
            success: null
          });
        }

        console.log(`✅ Password reset email sent via emailService (dual SMTP) to: ${email}`);
        logger.info('Password reset email sent via emailService', { email, isInternal: true });

        return res.render("auth/forgot-password", {
          layout: false,
          error: null,
          success: "Als dit e-mailadres bestaat, ontvang je een e-mail met instructies om je wachtwoord te resetten."
        });
      } catch (emailErr) {
        console.error("❌ Exception while sending password reset email:", emailErr);
        logger.error('Password reset email exception', { email, error: emailErr.message });
        return res.render("auth/forgot-password", {
          layout: false,
          error: "Er is een fout opgetreden bij het versturen van de email. Probeer het later opnieuw.",
          success: null
        });
      }
    } else {
      // For external emails, use Supabase's built-in resetPasswordForEmail (uses Mailgun)
      console.log(`📧 External email detected (${email}), using Supabase SMTP...`);
      
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectBase}/reset-password`
    });

      if (error) {
        logger.error('Password reset request error:', error);
        return res.render("auth/forgot-password", {
          layout: false,
          error: error.message || "Er is een fout opgetreden",
          success: null
        });
      }

      res.render("auth/forgot-password", {
        layout: false,
        error: null,
        success: "Als dit e-mailadres bestaat, ontvang je een e-mail met instructies om je wachtwoord te resetten."
      });
    }
  } catch (error) {
    logger.error("Password reset request error:", error)
    res.render("auth/forgot-password", {
      layout: false,
      error: "Er is een fout opgetreden",
      success: null
    })
  }
})

// Password reset page
router.get("/reset-password", (req, res) => {
  res.render("auth/reset-password", {
    layout: false,
    error: null,
    token: req.query.token
  })
})

// Process password reset
router.post("/reset-password", async (req, res) => {
  try {
    const { access_token, refresh_token, password } = req.body
    const supabase = createBaseClient();

    if (!access_token || !password) {
      return res.render("auth/reset-password", {
        layout: false,
        error: "Vul alle verplichte velden in",
        access_token,
        refresh_token
      })
    }

    // If we have refresh_token, set session directly. Otherwise, try verifyOtp recovery with the token.
    if (refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token
      });
      if (sessionError) {
        logger.error('Password reset setSession error:', sessionError);
        return res.render("auth/reset-password", {
          layout: false,
          error: "Er is een fout opgetreden bij het resetten van het wachtwoord",
          access_token,
          refresh_token
        })
      }
    } else {
      // Attempt to exchange token for session using verifyOtp (recovery)
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: access_token,
        type: 'recovery'
      });
      if (verifyError || !data?.session?.refresh_token || !data?.session?.access_token) {
        logger.error('Password reset verifyOtp error:', verifyError);
        return res.render("auth/reset-password", {
          layout: false,
          error: "De reset link is ongeldig of verlopen. Vraag een nieuwe link aan.",
          access_token: '',
          refresh_token: ''
        })
      }
      const { access_token: at, refresh_token: rt } = data.session;
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: at,
        refresh_token: rt
      });
      if (sessionError) {
        logger.error('Password reset setSession (after verifyOtp) error:', sessionError);
        return res.render("auth/reset-password", {
          layout: false,
          error: "Er is een fout opgetreden bij het resetten van het wachtwoord",
          access_token: '',
          refresh_token: ''
        })
      }
    }

    // Update password via Supabase Auth
    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      logger.error('Password update error:', error);
      return res.render("auth/reset-password", {
        layout: false,
        error: "Er is een fout opgetreden bij het resetten van het wachtwoord",
        access_token,
        refresh_token
      })
    }

    res.redirect("/login?reset=success")
  } catch (error) {
    logger.error("Password reset error:", error)
    res.render("auth/reset-password", {
      layout: false,
      error: "Er is een fout opgetreden bij het resetten van het wachtwoord",
      token: req.body.token
    })
  }
})

// Logout confirmation page
router.get("/logout", (req, res) => {
  // Check if user is logged in
  const accessToken = req.cookies?.['sb-access-token'];
  if (!accessToken) {
    // Already logged out, redirect to login
    return res.redirect('/login');
  }
  
  res.render('auth/logout-confirm', {
    layout: false,
    error: null
  });
});

// Logout processing
router.post("/logout", async (req, res) => {
  try {
    // Try to get user ID from cookies before clearing them
    const accessToken = req.cookies?.['sb-access-token'];
    let userId = null;
    
    if (accessToken) {
      try {
        const { createRequestClient } = require('../lib/supabase');
        const scoped = createRequestClient(req);
        const { data: userData } = await scoped.auth.getUser();
        if (userData?.user?.id) {
          userId = userData.user.id;
        }
      } catch (err) {
        // Ignore errors when getting user
      }
    }
    
    const supabase = createBaseClient();
    
    // Sign out from Supabase
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out from Supabase:', err);
    }
    
    // Clear all auth cookies
    clearSession(req, res);
    
    // Clear 2FA remember device cookies if user ID was found
    if (userId) {
      res.clearCookie(`2fa_remember_${userId}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      res.clearCookie(`2fa_remember_exp_${userId}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    }
    
    // Clear any pending 2FA cookies
    res.clearCookie('2fa_pending_user_id', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.clearCookie('2fa_pending_access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.clearCookie('2fa_pending_refresh_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    res.clearCookie('2fa_pending_return_to', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    // Redirect to login page with success message
    res.redirect('/login?logout=success');
  } catch (err) {
    console.error('Error during logout:', err);
    // Even if there's an error, clear cookies and redirect
    try {
      clearSession(req, res);
    } catch (clearErr) {
      console.error('Error clearing session:', clearErr);
    }
    res.redirect('/login');
  }
});

// Email verification page handler (client-side processing of hash fragment)
const verifyEmailPageHandler = (req, res) => {
  res.render("auth/verify-email", {
    layout: false,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
  });
};

// Support both /verify-email and /auth/verify-email
router.get("/verify-email", verifyEmailPageHandler);
router.get("/auth/verify-email", verifyEmailPageHandler);

// Server-side callback to set cookies after client-side verification
const verifyEmailCallbackHandler = async (req, res) => {
  try {
    const { access_token, refresh_token } = req.body;
    
    if (!access_token || !refresh_token) {
      return res.status(400).json({ error: 'Missing tokens' });
    }

    const supabase = createBaseClient();
    
    // Set session using the tokens
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token
    });

    if (error) {
      logger.error('Email verification callback error:', error);
      return res.status(400).json({ error: error.message });
    }

    if (!data?.session) {
      return res.status(400).json({ error: 'No session created' });
    }

    // Set cookies
    setAuthCookies(res, data.session);
    
    // Clear pending verification email from session (user is now verified)
    if (req.session) {
      delete req.session.pendingVerificationEmail;
    }
    
    logger.info('Email verified successfully via callback:', {
      userId: data.user.id,
      email: data.user.email
    });

    res.json({ success: true, user: data.user });
  } catch (error) {
    logger.error('Email verification callback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Support both /verify-email-callback and /auth/verify-email-callback
router.post("/verify-email-callback", verifyEmailCallbackHandler);
router.post("/auth/verify-email-callback", verifyEmailCallbackHandler);

// Google OAuth sign-in route
router.get("/google", async (req, res) => {
    try {
        const supabase = createBaseClient();
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${req.protocol}://${req.get('host')}/auth/callback`
            }
        });

        if (error) throw error;
        return res.redirect(data.url);
    } catch (error) {
        console.error('Google OAuth error:', error);
        return res.redirect('/auth/login?error=Er is een fout opgetreden bij Google inloggen');
    }
});

// Support prefixed path used in views: /auth/google
router.get("/auth/google", async (req, res) => {
    try {
        const supabase = createBaseClient();
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${req.protocol}://${req.get('host')}/auth/callback`
            }
        });

        if (error) throw error;
        return res.redirect(data.url);
    } catch (error) {
        console.error('Google OAuth error:', error);
        return res.redirect('/auth/login?error=Er is een fout opgetreden bij Google inloggen');
    }
});

// OAuth callback route
router.get('/callback', async (req, res) => {
    try {
        const { code } = req.query;
        const supabase = createBaseClient();
        
        if (!code) {
            return res.redirect('/auth/login?error=Geen autorisatiecode ontvangen');
        }

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) throw error;

        // Get user data from profiles table (created by trigger)
        const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (userError || !userData) {
            logger.error('Error fetching user after OAuth:', userError);
            return res.redirect('/auth/login?error=Er is een fout opgetreden bij het inloggen. Probeer het later opnieuw.');
        }

        // Set cookies and redirect
        setAuthCookies(res, data.session);
        // OPTIMIZED: Run redirect and login history in parallel
        const [redirectPath] = await Promise.all([
          getPostLoginRedirect(data.user.id, '/dashboard'),
          logLoginHistory({
            userId: data.user.id,
            req,
            status: 'success',
            loginMethod: 'oauth'
          }).catch(err => console.error('Login history logging failed (non-blocking):', err))
        ]);
        res.redirect(redirectPath);
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect('/auth/login?error=Er is een fout opgetreden bij het inloggen');
    }
});

// Support prefixed path used by Supabase redirect: /auth/callback
router.get('/auth/callback', async (req, res) => {
    try {
        const { code } = req.query;
        const supabase = createBaseClient();
        
        if (!code) {
            return res.redirect('/auth/login?error=Geen autorisatiecode ontvangen');
        }

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) throw error;

        // Get user data from profiles table (created by trigger)
        const { data: userData, error: userError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (userError || !userData) {
            logger.error('Error fetching user after OAuth:', userError);
            return res.redirect('/auth/login?error=Er is een fout opgetreden bij het inloggen. Probeer het later opnieuw.');
        }

        // Set cookies and redirect
        setAuthCookies(res, data.session);
        // OPTIMIZED: Run redirect and login history in parallel
        const [redirectPath] = await Promise.all([
          getPostLoginRedirect(data.user.id, '/dashboard'),
          logLoginHistory({
            userId: data.user.id,
            req,
            status: 'success',
            loginMethod: 'oauth'
          }).catch(err => console.error('Login history logging failed (non-blocking):', err))
        ]);
        res.redirect(redirectPath);
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect('/auth/login?error=Er is een fout opgetreden bij het inloggen');
    }
});

// =====================================================
// RABOBANK API OAUTH ROUTES
// =====================================================

const RabobankApiService = require('../services/rabobankApiService')
const { requireAuth } = require('../middleware/auth')

/**
 * GET /auth/rabobank/connect
 * Initiates OAuth 2.0 flow to connect Rabobank account
 */
router.get('/rabobank/connect', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id
    
    if (!userId) {
      return res.redirect('/dashboard?error=Je moet ingelogd zijn om je bankrekening te koppelen')
    }

    // Check if Rabobank API is configured
    if (!RabobankApiService.isAvailable()) {
      console.error('[Rabobank] API credentials not configured')
      return res.redirect('/dashboard?error=Rabobank API is niet geconfigureerd')
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex')
    
    // Store state in session for verification
    if (!req.session) {
      req.session = {}
    }
    req.session.rabobank_oauth_state = state
    req.session.rabobank_oauth_user_id = userId

    // Build redirect URI
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`
    const redirectUri = `${baseUrl}/auth/rabobank/callback`

    // Request account information scope (aisp = Account Information Service Provider)
    const scopes = ['aisp']

    // Generate authorization URL
    const authUrl = RabobankApiService.getAuthorizationUrl(redirectUri, state, scopes)

    console.log(`[Rabobank] Redirecting user ${userId} to authorization URL`)
    res.redirect(authUrl)

  } catch (error) {
    console.error('[Rabobank] Error initiating OAuth flow:', error)
    res.redirect('/dashboard?error=Er is een fout opgetreden bij het verbinden met Rabobank')
  }
})

/**
 * GET /auth/rabobank/callback
 * Handles OAuth callback from Rabobank
 */
router.get('/rabobank/callback', requireAuth, async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query
    const userId = req.user?.id

    // Check for OAuth errors
    if (error) {
      console.error(`[Rabobank] OAuth error: ${error} - ${error_description}`)
      return res.redirect(`/dashboard?error=Autorisatie geweigerd: ${error_description || error}`)
    }

    // Verify state parameter (CSRF protection)
    if (!req.session || !req.session.rabobank_oauth_state) {
      console.error('[Rabobank] No state found in session')
      return res.redirect('/dashboard?error=Ongeldige sessie. Probeer opnieuw.')
    }

    if (state !== req.session.rabobank_oauth_state) {
      console.error('[Rabobank] State mismatch - possible CSRF attack')
      return res.redirect('/dashboard?error=Ongeldige autorisatie. Probeer opnieuw.')
    }

    // Verify user ID matches
    if (req.session.rabobank_oauth_user_id !== userId) {
      console.error('[Rabobank] User ID mismatch')
      return res.redirect('/dashboard?error=Ongeldige gebruiker. Probeer opnieuw.')
    }

    if (!code) {
      return res.redirect('/dashboard?error=Geen autorisatiecode ontvangen van Rabobank')
    }

    // Build redirect URI (must match the one used in authorization)
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`
    const redirectUri = `${baseUrl}/auth/rabobank/callback`

    // Exchange authorization code for access token
    console.log(`[Rabobank] Exchanging code for token for user ${userId}`)
    const tokenData = await RabobankApiService.exchangeCodeForToken(code, redirectUri)

    // Calculate token expiration time
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600))

    // Fetch account information to get IBAN and account details
    let accountInfo = null
    let accountIban = null
    let accountName = null

    try {
      console.log(`[Rabobank] Fetching account information for user ${userId}`)
      accountInfo = await RabobankApiService.getAccountInformation(tokenData.access_token)
      
      // Extract account details from response
      // Rabobank API returns accounts in different formats, adjust based on actual response
      if (accountInfo.accounts && accountInfo.accounts.length > 0) {
        const firstAccount = accountInfo.accounts[0]
        accountIban = firstAccount.iban || firstAccount.accountId
        accountName = firstAccount.name || firstAccount.accountName || 'Rabobank Rekening'
      } else if (accountInfo.iban) {
        accountIban = accountInfo.iban
        accountName = accountInfo.name || 'Rabobank Rekening'
      }
    } catch (accountError) {
      console.error('[Rabobank] Error fetching account information:', accountError)
      // Continue anyway - we can fetch account info later
    }

    // Store connection in database
    const { data: connection, error: dbError } = await supabaseAdmin
      .from('bank_connections')
      .upsert({
        user_id: userId,
        provider: 'rabobank',
        provider_account_id: accountIban || null,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: expiresAt.toISOString(),
        token_type: tokenData.token_type || 'Bearer',
        scope: tokenData.scope || 'aisp',
        account_iban: accountIban,
        account_name: accountName,
        account_type: 'current', // Default, can be updated later
        account_currency: 'EUR',
        account_status: 'enabled',
        connection_status: 'active',
        last_synced_at: new Date().toISOString(),
        error_count: 0
      }, {
        onConflict: 'user_id,provider,account_iban',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (dbError) {
      console.error('[Rabobank] Database error storing connection:', dbError)
      throw new Error(`Database error: ${dbError.message}`)
    }

    // Clear OAuth state from session
    if (req.session) {
      delete req.session.rabobank_oauth_state
      delete req.session.rabobank_oauth_user_id
    }

    console.log(`[Rabobank] Successfully connected account for user ${userId}`)
    res.redirect('/dashboard?success=Rabobank rekening succesvol gekoppeld')

  } catch (error) {
    console.error('[Rabobank] Error in OAuth callback:', error)
    
    // Clear session state on error
    if (req.session) {
      delete req.session.rabobank_oauth_state
      delete req.session.rabobank_oauth_user_id
    }

    res.redirect(`/dashboard?error=Er is een fout opgetreden bij het koppelen van je Rabobank rekening: ${error.message}`)
  }
})

/**
 * GET /auth/rabobank/disconnect
 * Disconnects Rabobank account
 */
router.get('/rabobank/disconnect', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id
    const { connection_id } = req.query

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Delete bank connection
    const { error: deleteError } = await supabaseAdmin
      .from('bank_connections')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'rabobank')
      .eq('id', connection_id || '') // If connection_id provided, only delete that one

    if (deleteError) {
      console.error('[Rabobank] Error disconnecting:', deleteError)
      return res.redirect('/dashboard?error=Kon rekening niet ontkoppelen')
    }

    console.log(`[Rabobank] Disconnected account for user ${userId}`)
    res.redirect('/dashboard?success=Rabobank rekening succesvol ontkoppeld')

  } catch (error) {
    console.error('[Rabobank] Error disconnecting:', error)
    res.redirect('/dashboard?error=Er is een fout opgetreden bij het ontkoppelen')
  }
})

module.exports = router
