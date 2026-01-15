/**
 * Factory function to create Express app with conditional route mounting
 * @param {Object} options - Configuration options
 * @param {string} options.area - 'dashboard', 'admin', or undefined (all routes)
 * @returns {Express.Application} Express app instance
 */
function createApp({ area } = {}) {
  const express = require('express')
  const app = express()
  
  // Log which area is being initialized
  if (area) {
    console.log(`🚀 BOOT: ${area} function`)
  } else {
    console.log('🚀 BOOT: full app (all routes)')
  }
  
  // Import shared dependencies
  const path = require('path')
  const fs = require('fs')
  const session = require('express-session')
  const cookieParser = require('cookie-parser')
  const morgan = require('morgan')
  const multer = require('multer')
  const ejs = require('ejs')
  const bcrypt = require('bcrypt')
  
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
  
  // Multer configuration for profile picture uploads
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'profiles')
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }
      cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      const ext = path.extname(file.originalname)
      cb(null, 'profile-' + (req.user?.id || 'unknown') + '-' + uniqueSuffix + ext)
    }
  })
  
  const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    fileFilter: function (req, file, cb) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(new Error('Ongeldig bestandstype. Alleen JPG en PNG toegestaan.'))
      }
    }
  })
  
  // Import supabase
  const { supabase, supabaseAdmin } = require('../config/supabase')
  
  // Configure view engine
  ejs.fileLoader = (filePath) => {
    let lastErr = null
    for (let i = 0; i < 3; i++) {
      try {
        return fs.readFileSync(filePath, 'utf8')
      } catch (err) {
        if (err.code === 'ECANCELED') {
          lastErr = err
          continue
        }
        throw err
      }
    }
    if (lastErr) throw lastErr
    throw new Error('Unknown EJS fileLoader error')
  }
  
  app.set("view engine", "ejs")
  app.set("views", path.join(__dirname, "..", "views"))
  
  if (app.get('env') !== 'production') {
    app.set('view cache', false)
  } else if (process.env.DISABLE_VIEW_CACHE === 'true') {
    app.set('view cache', false)
  }
  
  // Performance logging middleware
  const { performanceLog } = require('../middleware/performance')
  app.use(performanceLog)
  
  // Shared middleware
  app.use(morgan("dev"))
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))
  app.use(express.static(path.join(__dirname, "..", "public")))
  
  // Handle favicon - serve the actual favicon file
  const faviconPath = path.join(__dirname, '..', 'public', 'img', 'favicon-growsocial.webp')
  app.get('/favicon.ico', (req, res) => {
    if (fs.existsSync(faviconPath)) {
      res.type('image/webp')
      res.sendFile(faviconPath)
    } else {
      res.status(204).end()
    }
  })
  
  app.use(cookieParser())
  
  // Mail HTML no-cache middleware
  const mailHtmlNoCache = (req, res, next) => {
    if (req.method === 'GET') {
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        'Vary': 'Cookie, Authorization'
      })
    }
    next()
  }
  
  if (area !== 'dashboard') {
    // Only mount admin mail cache control if not dashboard-only
    app.use('/admin/mail', mailHtmlNoCache)
  }
  
  // Session configuration
  const isVercelForCookies = process.env.VERCEL === '1' || process.env.VERCEL_ENV
  const sessionCookieDomain = isVercelForCookies ? undefined : (process.env.NODE_ENV === "production" ? '.growsocial.nl' : undefined)
  
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "gs-lead-platform-secret",
      resave: false,
      saveUninitialized: false,
      name: 'gs.sid',
      cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1 dag
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? 'lax' : 'lax',
        domain: sessionCookieDomain
      },
    }),
  )
  
  // Auth middleware
  const { refreshIfNeeded, requireAuth, isAdmin } = require('../middleware/auth')
  app.use(refreshIfNeeded)
  
  // Profile cache and loadUserProfile middleware (shared)
  const profileCache = new Map()
  const PROFILE_CACHE_TTL = 5000
  const rolesCache = new Map()
  const ROLES_CACHE_TTL = 300000
  let allRolesCache = null
  let allRolesCacheTimestamp = null
  
  if (!isVercel) {
    setInterval(() => {
      const now = Date.now()
      for (const [userId, cached] of profileCache.entries()) {
        if (now - cached.timestamp > PROFILE_CACHE_TTL) {
          profileCache.delete(userId)
        }
      }
      for (const [roleId, cached] of rolesCache.entries()) {
        if (now - cached.timestamp > ROLES_CACHE_TTL) {
          rolesCache.delete(roleId)
        }
      }
      if (allRolesCacheTimestamp && (now - allRolesCacheTimestamp) > ROLES_CACHE_TTL) {
        allRolesCache = null
        allRolesCacheTimestamp = null
      }
    }, 60000)
  }
  
  // Load user profile middleware (shared)
  app.use(async (req, res, next) => {
    if (req.path.startsWith('/css/') || 
        req.path.startsWith('/js/') || 
        req.path.startsWith('/images/') || 
        req.path.startsWith('/uploads/') ||
        (req.path.startsWith('/api/') && !req.path.includes('/admin'))) {
      return next()
    }
    
    try {
      if (req.user) {
        const userId = req.user.id
        const now = Date.now()
        const start = req.performanceTimings ? process.hrtime.bigint() : null
        
        let profile = null
        let roleName = null
        const cached = profileCache.get(userId)
        
        if (cached && (now - cached.timestamp) < PROFILE_CACHE_TTL) {
          profile = cached.profile
          roleName = cached.roleName
        } else {
          const { supabaseAdmin } = require('../config/supabase')
          const { data: fetchedProfile, error } = await supabaseAdmin
            .from('profiles')
            .select('profile_picture, company_name, first_name, last_name, is_admin, role_id')
            .eq('id', userId)
            .maybeSingle()
          
          if (error && error.code !== 'PGRST116') {
            console.error('❌ Error fetching profile:', error)
          } else if (error && error.code === 'PGRST116' || !fetchedProfile) {
            console.log(`📝 Creating missing profile for user ${userId} in loadUserProfile middleware`)
            const { data: newProfile, error: upsertError } = await supabaseAdmin
              .from('profiles')
              .upsert({
                id: userId,
                email: req.user.email,
                company_name: req.user.user_metadata?.company_name || null,
                first_name: req.user.user_metadata?.first_name || null,
                last_name: req.user.user_metadata?.last_name || null,
                role_id: null,
                status: 'active',
                balance: 0,
                is_admin: req.user.user_metadata?.is_admin === true || false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'id'
              })
              .select('profile_picture, company_name, first_name, last_name, is_admin, role_id')
              .single()
            
            if (upsertError) {
              console.error('❌ Error creating profile in loadUserProfile middleware:', upsertError)
              profile = null
            } else {
              console.log('✅ Profile created for user:', userId)
              profile = newProfile
            }
          } else {
            profile = fetchedProfile
          }
          
          if (profile?.role_id) {
            const roleId = profile.role_id
            const cachedRole = rolesCache.get(roleId)
            
            if (cachedRole && (now - cachedRole.timestamp) < ROLES_CACHE_TTL) {
              roleName = cachedRole.role.name
            } else {
              const { getRoleById } = require('../utils/roleCache')
              const role = await getRoleById(roleId)
              if (role) {
                roleName = role.name
              }
            }
          }
          
          profileCache.set(userId, {
            profile,
            roleName,
            timestamp: now
          })
        }
        
        if (start && req.performanceTimings) {
          const end = process.hrtime.bigint()
          const time = Number(end - start) / 1000000
          req.performanceTimings.middleware['loadUserProfile'] = time
        }
        
        res.locals.user = {
          ...req.user,
          profile_picture: profile?.profile_picture || null,
          company_name: profile?.company_name || req.user.user_metadata?.company_name || '',
          first_name: profile?.first_name || req.user.user_metadata?.first_name || '',
          last_name: profile?.last_name || req.user.user_metadata?.last_name || '',
          is_admin: profile?.is_admin || req.user.user_metadata?.is_admin || false,
          role_id: profile?.role_id || null,
          role: roleName || null
        }
        
        req.user.role_id = profile?.role_id || null
        req.user.role = roleName || null
        req.user.is_admin = profile?.is_admin || req.user.user_metadata?.is_admin || false
      } else {
        res.locals.user = req.session.user || null
      }
      
      res.locals.isAdmin = req.user ? req.user.user_metadata?.is_admin === true : (req.session.user ? req.session.user.is_admin === 1 : false)
      res.locals.mollieProfileId = process.env.MOLLIE_PROFILE_ID || 'pfl_PN78N3V8Ka'
      next()
    } catch (err) {
      console.error('Error loading user profile:', err)
      res.locals.user = req.user || req.session.user || null
      res.locals.isAdmin = req.user ? req.user.user_metadata?.is_admin === true : (req.session.user ? req.session.user.is_admin === 1 : false)
      res.locals.mollieProfileId = process.env.MOLLIE_PROFILE_ID || 'pfl_PN78N3V8Ka'
      next()
    }
  })
  
  // SSR timestamp middleware
  app.use((req, res, next) => {
    const renderedAt = new Date().toISOString()
    res.locals.ssrRenderedAt = renderedAt
    res.set('X-SSR-Rendered-At', renderedAt)
    next()
  })
  
  // Caching headers middleware
  app.use((req, res, next) => {
    if (req.path.match(/\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot|webp)$/)) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable')
    } else if (req.path.startsWith('/api/') && req.method === 'GET') {
      if (!req.path.includes('/dashboard') && !req.path.includes('/user') && !req.path.includes('/profile') && !req.path.includes('/admin')) {
        res.set('Cache-Control', 'public, max-age=60, s-maxage=300')
      }
    }
    next()
  })
  
  // Client-side router support
  app.use((req, res, next) => {
    const isAjax = req.get('X-Requested-With') === 'XMLHttpRequest'
    
    if (isAjax) {
      const originalRender = res.render.bind(res)
      res.render = function(view, data, callback) {
        if (data && typeof data === 'object') {
          data._skipLayout = true
        }
        return originalRender(view, data, (err, html) => {
          if (err) {
            if (callback) return callback(err)
            return res.status(500).send('Error rendering view')
          }
          if (callback) {
            callback(null, html)
          } else {
            res.send(html)
          }
        })
      }
    }
    next()
  })
  
  // Conditionally load and mount routes based on area
  if (area === 'dashboard') {
    // Dashboard-only routes
    console.log('📦 Loading dashboard routes...')
    const authRoutes = require('../routes/auth')
    const dashboardRoutes = require('../routes/dashboard')
    const onboardingRoutes = require('../routes/onboarding')
    const formsRoutes = require('../routes/forms')
    
    // Load leads routes (public forms)
    let leadsRoutes = null
    const getLeadsRoutes = () => {
      if (!leadsRoutes) {
        leadsRoutes = require('../routes/leads')
      }
      return leadsRoutes
    }
    if (isVercel) {
      leadsRoutes = require('../routes/leads')
    }
    
    // Load API routes and filter for dashboard
    const apiRoutes = require('../routes/api')
    const filterApiRoutes = require('./filterApiRoutes')
    const filteredApiRoutes = filterApiRoutes(apiRoutes, 'dashboard')
    
    // Mount routes
    app.use("/", authRoutes)
    app.get("/payments", requireAuth, (req, res) => {
      res.redirect('/dashboard/payments')
    })
    app.use("/dashboard", requireAuth, dashboardRoutes)
    app.use("/onboarding", requireAuth, onboardingRoutes)
    app.use("/", formsRoutes)
    app.use("/leads", (req, res, next) => {
      getLeadsRoutes()(req, res, next)
    })
    
    // Mount filtered API routes
    app.use("/api", filteredApiRoutes)
    
    // Profile picture upload (user-specific, so dashboard)
    app.post("/api/upload-profile-picture", requireAuth, upload.single('profilePicture'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ 
            success: false, 
            message: 'Geen bestand geüpload' 
          })
        }
        
        const imageUrl = '/uploads/profiles/' + req.file.filename
        
        const { supabaseAdmin } = require('../config/supabase')
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .update({ profile_picture: imageUrl })
          .eq('id', req.user.id)
          .select()
          .single()
        
        if (error) {
          fs.unlinkSync(req.file.path)
          return res.status(500).json({ 
            success: false, 
            message: 'Fout bij opslaan in database: ' + error.message 
          })
        }
        
        res.json({ 
          success: true, 
          imageUrl: imageUrl,
          message: 'Profielfoto succesvol geüpload' 
        })
      } catch (error) {
        console.error('Upload error:', error)
        if (req.file) {
          fs.unlinkSync(req.file.path)
        }
        res.status(500).json({ 
          success: false, 
          message: 'Er is een fout opgetreden bij het uploaden' 
        })
      }
    })
    
    // Root redirect
    app.get("/", (req, res) => {
      if (req.user || req.session.user) {
        return res.redirect("/dashboard")
      }
      return res.redirect("/login")
    })
    
    console.log('✅ Dashboard routes mounted')
    
  } else if (area === 'admin') {
    // Admin-only routes
    console.log('📦 Loading admin routes...')
    const authRoutes = require('../routes/auth')
    const adminRoutes = require('../routes/admin')
    const apiRoutes = require('../routes/api')
    
    // Load internal campaigns (admin tool)
    let internalCampaignsRoutes = null
    const getInternalCampaignsRoutes = () => {
      if (!internalCampaignsRoutes) {
        internalCampaignsRoutes = require('../routes/internalCampaigns')
      }
      return internalCampaignsRoutes
    }
    if (isVercel) {
      internalCampaignsRoutes = require('../routes/internalCampaigns')
    }
    
    // Load and filter API routes for admin
    const filterApiRoutes = require('./filterApiRoutes')
    const filteredApiRoutes = filterApiRoutes(apiRoutes, 'admin')
    
    // CRITICAL: Skip static files - let Vercel serve them directly
    // This middleware must come BEFORE routes to prevent static files from being processed
    app.use((req, res, next) => {
      const path = req.path;
      // Skip static file requests - let express.static or Vercel handle them
      if (
        path.startsWith('/css/') ||
        path.startsWith('/js/') ||
        path.startsWith('/img/') ||
        path.startsWith('/assets/') ||
        path.startsWith('/uploads/') ||
        path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/i)
      ) {
        // Let express.static handle it (already mounted earlier)
        return next();
      }
      // Continue to routes for non-static files
      next();
    });
    
    // Mount routes
    app.use("/", authRoutes)
    app.use("/admin", requireAuth, adminRoutes)
    
    // Mount API routes (admin gets all routes)
    app.use("/api", filteredApiRoutes)
    
    // Profile picture upload (also available in admin)
    app.post("/api/upload-profile-picture", requireAuth, upload.single('profilePicture'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ 
            success: false, 
            message: 'Geen bestand geüpload' 
          })
        }
        
        const imageUrl = '/uploads/profiles/' + req.file.filename
        
        const { supabaseAdmin } = require('../config/supabase')
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .update({ profile_picture: imageUrl })
          .eq('id', req.user.id)
          .select()
          .single()
        
        if (error) {
          fs.unlinkSync(req.file.path)
          return res.status(500).json({ 
            success: false, 
            message: 'Fout bij opslaan in database: ' + error.message 
          })
        }
        
        res.json({ 
          success: true, 
          imageUrl: imageUrl,
          message: 'Profielfoto succesvol geüpload' 
        })
      } catch (error) {
        console.error('Upload error:', error)
        if (req.file) {
          fs.unlinkSync(req.file.path)
        }
        res.status(500).json({ 
          success: false, 
          message: 'Er is een fout opgetreden bij het uploaden' 
        })
      }
    })
    
    // Mount internal campaigns
    app.use("/", (req, res, next) => {
      getInternalCampaignsRoutes()(req, res, next)
    })
    
    console.log('✅ Admin routes mounted')
    
  } else {
    // Full app (all routes) - for local development
    console.log('📦 Loading all routes...')
    const authRoutes = require('../routes/auth')
    const dashboardRoutes = require('../routes/dashboard')
    const onboardingRoutes = require('../routes/onboarding')
    const adminRoutes = require('../routes/admin')
    const apiRoutes = require('../routes/api')
    const formsRoutes = require('../routes/forms')
    
    let leadsRoutes = null
    const getLeadsRoutes = () => {
      if (!leadsRoutes) {
        leadsRoutes = require('../routes/leads')
      }
      return leadsRoutes
    }
    if (isVercel) {
      leadsRoutes = require('../routes/leads')
    }
    
    let internalCampaignsRoutes = null
    const getInternalCampaignsRoutes = () => {
      if (!internalCampaignsRoutes) {
        internalCampaignsRoutes = require('../routes/internalCampaigns')
      }
      return internalCampaignsRoutes
    }
    if (isVercel) {
      internalCampaignsRoutes = require('../routes/internalCampaigns')
    }
    
    // Mount all routes
    app.use("/", authRoutes)
    app.get("/payments", requireAuth, (req, res) => {
      res.redirect('/dashboard/payments')
    })
    app.use("/dashboard", requireAuth, dashboardRoutes)
    app.use("/onboarding", requireAuth, onboardingRoutes)
    app.use("/admin", requireAuth, adminRoutes)
    app.use("/api", apiRoutes)
    app.use("/leads", (req, res, next) => {
      getLeadsRoutes()(req, res, next)
    })
    app.use("/", formsRoutes)
    app.use("/", (req, res, next) => {
      getInternalCampaignsRoutes()(req, res, next)
    })
    
    // Sidebar test
    app.get("/sidebar", (req, res) => {
      res.render("sidebar-test", { layout: false })
    })
    
    // Support page
    app.get("/support", (req, res) => {
      res.render("support", {
        layout: false,
        user: res.locals.user || null
      })
    })
    
    // Root redirect
    app.get("/", (req, res) => {
      if (req.user || req.session.user) {
        return res.redirect("/dashboard")
      }
      return res.redirect("/login")
    })
    
    // Public landing pages (catch-all before 404)
    app.get('*', async (req, res, next) => {
      try {
        const path = req.path
        if (
          path.startsWith('/api/') ||
          path.startsWith('/admin/') ||
          path.startsWith('/dashboard/') ||
          path.startsWith('/onboarding/') ||
          path.startsWith('/css/') ||
          path.startsWith('/js/') ||
          path.startsWith('/assets/') ||
          path.startsWith('/uploads/') ||
          path === '/' ||
          path === '/support' ||
          path === '/sidebar' ||
          path.startsWith('/auth/')
        ) {
          return next()
        }
        
        const SiteService = require('../services/siteService')
        const host = req.hostname || req.headers.host
        const site = await SiteService.getSiteByDomain(host)
        
        if (!site) {
          return next()
        }
        
        let normalizedPath = path
        if (!normalizedPath.endsWith('/') && !normalizedPath.includes('.')) {
          normalizedPath = normalizedPath + '/'
        }
        
        const PartnerLandingPageService = require('../services/partnerLandingPageService')
        const landingPage = await PartnerLandingPageService.getLandingPageByPath(site.id, normalizedPath)
        
        if (!landingPage || landingPage.status !== 'live') {
          return next()
        }
        
        await PartnerLandingPageService.trackView(landingPage.id)
        const cluster = await PartnerLandingPageService.getLandingPageCluster(site.id, landingPage.segment_id)
        
        let industry = null
        let formSlug = null
        if (landingPage.segment_id) {
          const { supabaseAdmin } = require('../config/supabase')
          const { data: segment } = await supabaseAdmin
            .from('lead_segments')
            .select('branch')
            .eq('id', landingPage.segment_id)
            .single()
          
          if (segment && segment.branch) {
            const { data: industries } = await supabaseAdmin
              .from('industries')
              .select('id, name, slug')
              .eq('name', segment.branch)
              .eq('is_active', true)
              .limit(1)
              .single()
            
            if (industries) {
              industry = industries
              formSlug = industries.slug
            }
          }
        }
        
        res.render('public/landing-page', {
          site,
          landingPage,
          cluster,
          industry: industry,
          formSlug: formSlug,
          googleAdsTagId: process.env.GOOGLE_ADS_TAG_ID || null,
          ga4MeasurementId: process.env.GA4_MEASUREMENT_ID || null,
          googleAdsConversionId: process.env.GOOGLE_ADS_CONVERSION_ID || null,
          googleAdsConversionLabel: process.env.GOOGLE_ADS_CONVERSION_LABEL || null,
          layout: false
        })
      } catch (error) {
        console.error('Error rendering landing page:', error)
        next()
      }
    })
    
    console.log('✅ All routes mounted')
  }
  
  // 404 handler
  app.use((req, res, next) => {
    res.status(404).render("errors/404", { layout: false })
  })
  
  // Error handler
  app.use((err, req, res, next) => {
    console.error('❌ Error:', err.message)
    console.error(err.stack)
    try {
      res.status(500).render("errors/500", { layout: false })
    } catch (renderError) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
      })
    }
  })
  
  return app
}

module.exports = createApp
