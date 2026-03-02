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
  const cookieParser = require('cookie-parser')
  const cookieSession = require('cookie-session')
  const session = require('express-session')
  const morgan = require('morgan')
  const multer = require('multer')
  const ejs = require('ejs')
  const bcrypt = require('bcrypt')
  
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
  
  // Multer: memoryStorage for Vercel (read-only FS) + Supabase; diskStorage for localhost
  const storage = isVercel
    ? multer.memoryStorage()
    : multer.diskStorage({
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
    storage,
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
  
  // Trust proxy (required for cookies behind Vercel/rpoxy)
  app.set('trust proxy', 1)
  
  // Session: cookie-session on Vercel (stateless, no MemoryStore); express-session locally
  const isVercelForCookies = process.env.VERCEL === '1' || process.env.VERCEL_ENV
  const sessionCookieDomain = isVercelForCookies ? undefined : (process.env.NODE_ENV === "production" ? '.growsocial.nl' : undefined)
  
  if (isVercelForCookies) {
    app.use(cookieSession({
      name: 'gs.sid',
      keys: [process.env.SESSION_SECRET || 'gs-lead-platform-secret'],
      maxAge: 1000 * 60 * 60 * 24, // 1 dag
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: 'lax',
      domain: sessionCookieDomain
    }))
    // cookie-session compat: add save() no-op for code that awaits req.session.save()
    app.use((req, res, next) => {
      if (!req.session.save) req.session.save = (cb) => { if (cb) cb(); return Promise.resolve() }
      next()
    })
  } else {
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
  }
  
  const { refreshIfNeeded, requireAuth, isAdmin, redirectEmployeesToAdminDashboard } = require('../middleware/auth')
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
    // Root path only needs redirect; skip DB so GET / never times out
    if (req.path === '/') {
      if (req.user) {
        res.locals.user = {
          ...req.user,
          profile_picture: null,
          company_name: req.user.user_metadata?.company_name || '',
          first_name: req.user.user_metadata?.first_name || '',
          last_name: req.user.user_metadata?.last_name || '',
          is_admin: req.user.user_metadata?.is_admin || false,
          role_id: null,
          role: null
        }
      } else {
        res.locals.user = req.session?.user || null
      }
      res.locals.isAdmin = req.user ? req.user.user_metadata?.is_admin === true : (req.session?.user?.is_admin === 1)
      res.locals.mollieProfileId = process.env.MOLLIE_PROFILE_ID || 'pfl_PN78N3V8Ka'
      return next()
    }
    // Vercel admin: skip profile DB to avoid timeout on GET /admin?warm=1 (use auth user only)
    if (process.env.VERCEL && req.path === '/admin') {
      if (req.user) {
        res.locals.user = {
          ...req.user,
          profile_picture: null,
          company_name: req.user.user_metadata?.company_name || '',
          first_name: req.user.user_metadata?.first_name || '',
          last_name: req.user.user_metadata?.last_name || '',
          is_admin: req.user.user_metadata?.is_admin || false,
          role_id: null,
          role: null
        }
      } else {
        res.locals.user = req.session?.user || null
      }
      res.locals.isAdmin = req.user ? req.user.user_metadata?.is_admin === true : (req.session?.user?.is_admin === 1)
      res.locals.mollieProfileId = process.env.MOLLIE_PROFILE_ID || 'pfl_PN78N3V8Ka'
      req.user && (req.user.role_id = null, req.user.role = null, req.user.is_admin = req.user.user_metadata?.is_admin || false)
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
          const loadProfileAndRole = async () => {
            const { supabaseAdmin } = require('../config/supabase')
            let p = null
            let rn = null
            const { data: fetchedProfile, error } = await supabaseAdmin
              .from('profiles')
              .select('profile_picture, company_name, first_name, last_name, is_admin, role_id')
              .eq('id', userId)
              .maybeSingle()

            if (error && error.code !== 'PGRST116') {
              console.error('❌ Error fetching profile:', error)
            } else if ((error && error.code === 'PGRST116') || !fetchedProfile) {
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
                }, { onConflict: 'id' })
                .select('profile_picture, company_name, first_name, last_name, is_admin, role_id')
                .single()
              if (upsertError) {
                console.error('❌ Error creating profile in loadUserProfile middleware:', upsertError)
              } else {
                p = newProfile
              }
            } else {
              p = fetchedProfile
            }

            if (p?.role_id) {
              const roleId = p.role_id
              const cachedRole = rolesCache.get(roleId)
              if (cachedRole && (now - cachedRole.timestamp) < ROLES_CACHE_TTL) {
                rn = cachedRole.role.name
              } else {
                const { getRoleById } = require('../utils/roleCache')
                const role = await getRoleById(roleId)
                if (role) rn = role.name
              }
            }
            return { profile: p, roleName: rn }
          }

          const timeoutMs = (process.env.VERCEL || process.env.NODE_ENV === 'production') ? 5000 : 0
          let loadResult = null
          try {
            loadResult = timeoutMs
              ? await Promise.race([
                  loadProfileAndRole(),
                  new Promise((_, rej) => setTimeout(() => rej(new Error('Profile load timeout')), timeoutMs))
                ])
              : await loadProfileAndRole()
            profile = loadResult.profile
            roleName = loadResult.roleName
          } catch (e) {
            if (e.message === 'Profile load timeout') {
              console.warn('Profile load timeout, using minimal user data')
            }
            profile = null
            roleName = null
          }
          if (loadResult !== null) {
            profileCache.set(userId, { profile, roleName, timestamp: now })
          }
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
    
    // Lazy-load API routes so GET / and GET /login don't wait for the heavy api.js + services (faster cold start)
    const filterApiRoutes = require('./filterApiRoutes')
    let filteredApiRoutes = null
    const getFilteredApiRoutes = () => {
      if (!filteredApiRoutes) {
        const apiRoutes = require('../routes/api')
        filteredApiRoutes = filterApiRoutes(apiRoutes, 'dashboard')
      }
      return filteredApiRoutes
    }
    
    // Mount routes
    app.use("/", authRoutes)
    app.get("/payments", requireAuth, (req, res) => {
      res.redirect('/dashboard/payments')
    })
    app.use("/dashboard", requireAuth, redirectEmployeesToAdminDashboard, dashboardRoutes)
    app.use("/onboarding", requireAuth, onboardingRoutes)
    app.use("/", formsRoutes)
    app.use("/leads", (req, res, next) => {
      getLeadsRoutes()(req, res, next)
    })
    
    // Profile picture upload (mount before /api so it is not swallowed by the API router)
    app.post("/api/upload-profile-picture", requireAuth, upload.single('profilePicture'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ 
            success: false, 
            message: 'Geen bestand geüpload' 
          })
        }
        
        const { supabaseAdmin } = require('../config/supabase')
        let imageUrl
        
        if (isVercel && req.file.buffer) {
          const { ensureStorageBucket } = require('../utils/storage')
          const bucketOk = await ensureStorageBucket('uploads', true)
          if (!bucketOk) return res.status(500).json({ success: false, message: 'Storage niet beschikbaar' })
          const ext = path.extname(req.file.originalname) || '.png'
          const fileName = `profiles/profile-${req.user.id}-${Date.now()}${ext}`
          const { error: uploadErr } = await supabaseAdmin.storage.from('uploads').upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true
          })
          if (uploadErr) {
            console.error('Supabase Storage upload error:', uploadErr)
            return res.status(500).json({ success: false, message: 'Fout bij uploaden: ' + uploadErr.message })
          }
          const { data: { publicUrl } } = supabaseAdmin.storage.from('uploads').getPublicUrl(fileName)
          imageUrl = publicUrl
        } else {
          imageUrl = '/uploads/profiles/' + req.file.filename
        }
        
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ profile_picture: imageUrl })
          .eq('id', req.user.id)
          .select()
          .single()
        
        if (error) {
          if (!isVercel && req.file.path) fs.unlinkSync(req.file.path)
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
        if (!isVercel && req.file?.path) fs.unlinkSync(req.file.path)
        res.status(500).json({ 
          success: false, 
          message: 'Er is een fout opgetreden bij het uploaden' 
        })
      }
    })
    
    // Mount filtered API routes (lazy-loaded on first /api request for faster cold start)
    app.use("/api", (req, res, next) => {
      getFilteredApiRoutes()(req, res, next)
    })
    
    // Root redirect: niet ingelogd -> /login; admin -> /admin; user -> /dashboard
    app.get("/", (req, res) => {
      const user = req.user || req.session?.user
      if (!user) return res.redirect("/login")
      const isAdmin = user.is_admin === true || user.user_metadata?.is_admin === true
      if (isAdmin) return res.redirect("/admin")
      return res.redirect("/dashboard")
    })

    console.log('✅ Dashboard routes mounted')
    
  } else if (area === 'admin') {
    // Admin: no eager require of routes/admin or routes/api (cold start fix)
    console.log('[ADMIN] shell route registered (early GET /admin)')
    const authRoutes = require('../routes/auth')
    const adminApiLite = require('../routes/adminApiLite')

    // Early shell for GET /admin and GET /admin/ – no routes/admin loaded
    const renderAdminShell = (req, res) => {
      res.render('admin/shell', { layout: false, bootstrapUrl: '/api/admin/dashboard-bootstrap' })
    }
    app.get(['/admin', '/admin/'], (req, res, next) => {
      if (req.query.full === '1') return next()
      requireAuth(req, res, () => renderAdminShell(req, res))
    })

    let _adminRoutes
    function lazyLoadAdminRoutes (req, res, next) {
      if (!_adminRoutes) {
        console.log('[ADMIN] lazy-loading routes/admin')
        _adminRoutes = require('../routes/admin')
      }
      return _adminRoutes(req, res, next)
    }
    app.use('/admin', requireAuth, lazyLoadAdminRoutes)

    let _filteredApiRoutes
    function lazyFilteredApi (req, res, next) {
      if (!_filteredApiRoutes) {
        console.log('[ADMIN] lazy-loading routes/api (filtered)')
        const filterApiRoutes = require('./filterApiRoutes')
        const apiRoutes = require('../routes/api')
        _filteredApiRoutes = filterApiRoutes(apiRoutes, 'admin')
      }
      return _filteredApiRoutes(req, res, next)
    }
    app.use("/", authRoutes)
    app.use("/api", requireAuth, adminApiLite)
    app.use("/api", requireAuth, lazyFilteredApi)

    let internalCampaignsRoutes = null
    const getInternalCampaignsRoutes = () => {
      if (!internalCampaignsRoutes) internalCampaignsRoutes = require('../routes/internalCampaigns')
      return internalCampaignsRoutes
    }
    app.use("/", (req, res, next) => getInternalCampaignsRoutes()(req, res, next))

    // Profile picture upload (also available in admin)
    app.post("/api/upload-profile-picture", requireAuth, upload.single('profilePicture'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ 
            success: false, 
            message: 'Geen bestand geüpload' 
          })
        }
        
        const { supabaseAdmin } = require('../config/supabase')
        let imageUrl
        
        if (isVercel && req.file.buffer) {
          const { ensureStorageBucket } = require('../utils/storage')
          const bucketOk = await ensureStorageBucket('uploads', true)
          if (!bucketOk) return res.status(500).json({ success: false, message: 'Storage niet beschikbaar' })
          const ext = path.extname(req.file.originalname) || '.png'
          const fileName = `profiles/profile-${req.user.id}-${Date.now()}${ext}`
          const { error: uploadErr } = await supabaseAdmin.storage.from('uploads').upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true
          })
          if (uploadErr) {
            console.error('Supabase Storage upload error:', uploadErr)
            return res.status(500).json({ success: false, message: 'Fout bij uploaden: ' + uploadErr.message })
          }
          const { data: { publicUrl } } = supabaseAdmin.storage.from('uploads').getPublicUrl(fileName)
          imageUrl = publicUrl
        } else {
          imageUrl = '/uploads/profiles/' + req.file.filename
        }
        
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ profile_picture: imageUrl })
          .eq('id', req.user.id)
          .select()
          .single()
        
        if (error) {
          if (!isVercel && req.file.path) fs.unlinkSync(req.file.path)
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
        if (!isVercel && req.file?.path) fs.unlinkSync(req.file.path)
        res.status(500).json({ 
          success: false, 
          message: 'Er is een fout opgetreden bij het uploaden' 
        })
      }
    })

    console.log('✅ Admin routes mounted (shell + lazy)')
    
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
    app.use("/dashboard", requireAuth, redirectEmployeesToAdminDashboard, dashboardRoutes)
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
    
    // Root redirect: niet ingelogd -> /login; admin -> /admin; user -> /dashboard
    app.get("/", (req, res) => {
      const user = req.user || req.session?.user
      if (!user) {
        return res.redirect("/login")
      }
      const isAdmin = user.is_admin === true || user.user_metadata?.is_admin === true
      if (isAdmin) {
        return res.redirect("/admin")
      }
      // user -> dashboard
      return res.redirect("/dashboard")
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
  
  // Global error handler: always send a response (no silent hang)
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err)
    const isApi = req.path.startsWith('/api/') || req.get('Accept')?.includes('application/json')
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error:', err.message, 'path:', req.path)
    }
    try {
      if (isApi) {
        res.status(500).json({ error: 'Internal Server Error', message: process.env.NODE_ENV === 'production' ? undefined : err.message })
      } else {
        res.status(500).render("errors/500", { layout: false })
      }
    } catch (e) {
      res.status(500).send('Internal Server Error')
    }
  })
  
  return app
}

module.exports = createApp
