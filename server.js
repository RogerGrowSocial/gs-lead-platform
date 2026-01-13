console.log('🚀 Server.js starting...')

// Check if running on Vercel (serverless) or locally
// Must be defined early so it can be used throughout the file
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV

// Only load dotenv locally (Vercel uses environment variables directly)
if (!isVercel) {
  console.log('📦 Loading dotenv...')
  const dotenvStart = Date.now()
  // Use dotenv with explicit path to avoid searching
  require("dotenv").config({ path: '.env' })
  const dotenvTime = Date.now() - dotenvStart
  if (dotenvTime > 500) {
    console.log(`⚠️  dotenv loaded (${dotenvTime}ms - slow! Check .env file size)`)
  } else {
    console.log(`✅ dotenv loaded (${dotenvTime}ms)`)
  }
  process.stdout.write('✅ dotenv loaded\n')
} else {
  console.log('✅ Running on Vercel - using environment variables directly')
}

console.log('📝 About to define requireWithRetry function...')

// Helper function to retry require() calls that fail with ECANCELED (Node.js 22/macOS issue)
// SIMPLIFIED: Removed excessive logging that might be slowing things down
function requireWithRetry(modulePath, maxRetries = 3) {
  let lastError = null
  for (let i = 0; i < maxRetries; i++) {
    try {
      return require(modulePath)
    } catch (err) {
      if (err.code === 'ECANCELED') {
        lastError = err
        if (i < maxRetries - 1) {
          // Small delay before retry
          const delay = Math.min(50 * (i + 1), 200)
          const start = Date.now()
          while (Date.now() - start < delay) {
            // Busy wait
          }
          continue
        }
      }
      throw err
    }
  }
  if (lastError) throw lastError
  throw new Error(`Failed to load ${modulePath} after ${maxRetries} retries`)
}

const expressStart = Date.now()
const express = requireWithRetry("express")
const expressTime = Date.now() - expressStart
if (expressTime > 1000) {
  console.log(`⚠️ express loaded (${expressTime}ms - very slow! Disk might be full or slow)`)
} else {
  console.log(`✅ express loaded (${expressTime}ms)`)
}
console.log('📦 Loading core modules...')
const pathStart = Date.now()
const path = require("path")
console.log(`  ✅ path (${Date.now() - pathStart}ms)`)

const sessionStart = Date.now()
const session = requireWithRetry("express-session")
console.log(`  ✅ express-session (${Date.now() - sessionStart}ms)`)

const cookieParserStart = Date.now()
const cookieParser = require("cookie-parser")
console.log(`  ✅ cookie-parser (${Date.now() - cookieParserStart}ms)`)

const morganStart = Date.now()
const morgan = require("morgan")
console.log(`  ✅ morgan (${Date.now() - morganStart}ms)`)

const bcryptStart = Date.now()
console.log('  ⏳ Loading bcrypt (this can be slow on first load)...')
const bcrypt = requireWithRetry("bcrypt")
console.log(`  ✅ bcrypt (${Date.now() - bcryptStart}ms)`)

const multerStart = Date.now()
const multer = require("multer")
console.log(`  ✅ multer (${Date.now() - multerStart}ms)`)

const fsStart = Date.now()
const fs = require("fs")
console.log(`  ✅ fs (${Date.now() - fsStart}ms)`)

console.log(`✅ All core modules loaded (total: ${Date.now() - pathStart}ms)`)
// Load routes/leads lazily to avoid blocking startup
// (It was hanging during require, possibly due to ECANCELED errors or file system issues)
let leadsRoutes = null
const getLeadsRoutes = () => {
  if (!leadsRoutes) {
    console.log('📦 Loading routes/leads (lazy load)...')
    const startTime = Date.now()
    leadsRoutes = requireWithRetry("./routes/leads")
    const loadTime = Date.now() - startTime
    console.log(`✅ routes/leads loaded (${loadTime}ms)`)
  }
  return leadsRoutes
}
console.log('✅ routes/leads will be loaded lazily')
console.log('📂 Loading config/supabase...')
const startSupabase = Date.now()
const supabase = requireWithRetry('./config/supabase')
console.log(`✅ config/supabase loaded (${Date.now() - startSupabase}ms)`)
console.log('📂 Loading middleware/auth...')
const startAuth = Date.now()
const { requireAuth, isAdmin } = requireWithRetry("./middleware/auth")
console.log(`✅ middleware/auth (requireAuth, isAdmin) loaded (${Date.now() - startAuth}ms)`)
const startRefresh = Date.now()
const { refreshIfNeeded } = require("./middleware/auth")
console.log(`✅ middleware/auth (refreshIfNeeded) loaded (${Date.now() - startRefresh}ms)`)

// Multer configuration for profile picture uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'profiles')
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + ext)
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

// Initialize cron jobs for invoice automation
console.log('📅 Loading cron jobs...')
requireWithRetry('./cron/invoiceJobs')
console.log('✅ invoiceJobs loaded')

// Initialize billing cron job
console.log('💰 Loading BillingCronJob...')
const BillingCronJob = requireWithRetry('./services/billingCronJob')
const billingCron = new BillingCronJob()
console.log('✅ BillingCronJob created')

// Initialize risk assessment worker (listens to database triggers)
// NOTE: Loading this lazily in app.listen() to avoid blocking server startup
// The require() call takes ~65 seconds, so we delay it until after server starts
let startRiskAssessmentWorker, stopRiskAssessmentWorker
startRiskAssessmentWorker = async () => {
  try {
    const riskWorker = require('./services/riskAssessmentWorker')
    return await riskWorker.startWorker()
  } catch (error) {
    console.error('⚠️ Failed to start risk assessment worker:', error.message)
    return false
  }
}
stopRiskAssessmentWorker = async () => {
  try {
    const riskWorker = require('./services/riskAssessmentWorker')
    return await riskWorker.stopWorker()
  } catch (error) {
    console.error('⚠️ Failed to stop risk assessment worker:', error.message)
  }
}
console.log('✅ riskAssessmentWorker will be loaded lazily after server starts')

// Billing cron job will be started lazily after server starts to avoid blocking startup
// (it makes a database query which can timeout if network isn't ready)
console.log('✅ BillingCronJob will be started lazily after server starts')

// Initialize mail sync cron jobs (runs every 2 minutes for real-time sync)
// Lazy load to avoid blocking server startup
console.log('📬 mailSyncJobs will be loaded lazily after server starts')

// Initialize subscription notification cron jobs (lazy load)
console.log('🔔 subscriptionNotifications will be loaded lazily after server starts')

// Initialize Lead Flow Intelligence cron jobs (lazy load)
console.log('🧠 leadFlowIntelligenceJobs will be loaded lazily after server starts')

// Initialize Partner Marketing cron jobs (lazy load)
console.log('📢 partnerMarketingJobs will be loaded lazily after server starts')

// Initialize Google Ads performance import cron job (lazy load)
console.log('📊 Google Ads performance import cron job will be loaded lazily after server starts')

// App initialiseren
console.log('📦 Creating Express app...')
const app = express()
const PORT = process.env.PORT || 3000
console.log('📦 Express app initialized, PORT:', PORT)

if (app.get('env') !== 'production') {
  app.set('view cache', false)
} else if (process.env.DISABLE_VIEW_CACHE === 'true') {
  app.set('view cache', false)
}

// Configureer view engine
// Harden EJS file loading against transient ECANCELED read errors (Node 22/macOS)
const ejs = requireWithRetry('ejs')
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
app.set("views", path.join(__dirname, "views"))

// Middleware
app.use(morgan("dev"))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "public")))

// Handle favicon requests gracefully
app.get('/favicon.ico', (req, res) => {
  res.status(204).end()
})
app.use(cookieParser())

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

app.use('/admin/mail', mailHtmlNoCache)

// Sessie configuratie
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
      sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax', // 'none' for cross-domain redirects
      domain: process.env.NODE_ENV === "production" ? '.growsocial.nl' : undefined // Adjust domain as needed
    },
  }),
)

// Attach req.user if session valid or refreshable
app.use(refreshIfNeeded)

// Profile cache to reduce database queries during progress polling
const profileCache = new Map(); // userId -> { profile, roleName, timestamp }
const PROFILE_CACHE_TTL = 5000; // 5 seconds cache

// Cleanup old cache entries every minute (only in non-serverless environments)
// In serverless, cache is cleared on each invocation anyway
if (!isVercel) {
  setInterval(() => {
    const now = Date.now();
    for (const [userId, cached] of profileCache.entries()) {
      if (now - cached.timestamp > PROFILE_CACHE_TTL) {
        profileCache.delete(userId);
      }
    }
  }, 60000);
}

// Middleware om gebruiker beschikbaar te maken in alle views
app.use(async (req, res, next) => {
  try {
    if (req.user) {
      const userId = req.user.id;
      const now = Date.now();
      
      // Check cache first
      let profile = null;
      let roleName = null;
      const cached = profileCache.get(userId);
      
      if (cached && (now - cached.timestamp) < PROFILE_CACHE_TTL) {
        // Use cached profile
        profile = cached.profile;
        roleName = cached.roleName;
      } else {
        // Fetch profile data including profile_picture using admin client to bypass RLS
        const { supabaseAdmin } = require('./config/supabase')
        const { data: fetchedProfile, error } = await supabaseAdmin
          .from('profiles')
          .select('profile_picture, company_name, first_name, last_name, is_admin, role_id')
          .eq('id', userId)
          .maybeSingle()
        
        if (error) {
          console.error('❌ Error fetching profile:', error)
        } else {
          profile = fetchedProfile;
          // Only log on cache miss to reduce noise
          if (!cached) {
            console.log('👤 Loaded profile for user:', userId, '- Profile picture:', profile?.profile_picture)
          }
        }
        
        // Get role name if role_id exists
        if (profile?.role_id) {
          const { data: role } = await supabaseAdmin
            .from('roles')
            .select('name')
            .eq('id', profile.role_id)
            .single()
          if (role) {
            roleName = role.name
          }
        }
        
        // Cache the profile
        profileCache.set(userId, {
          profile,
          roleName,
          timestamp: now
        });
      }
      
      // Merge profile data with auth user
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
      
      // Also set on req.user for backend routes
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

app.use((req, res, next) => {
  const renderedAt = new Date().toISOString()
  res.locals.ssrRenderedAt = renderedAt
  res.set('X-SSR-Rendered-At', renderedAt)
  next()
})

// Routes importeren (load all routes directly like before)
console.log('📂 Loading routes...')
const startAuthRoutes = Date.now()
const authRoutes = requireWithRetry("./routes/auth")
console.log(`✅ authRoutes loaded (${Date.now() - startAuthRoutes}ms)`)
const startOnboarding = Date.now()
const onboardingRoutes = requireWithRetry("./routes/onboarding")
console.log(`✅ onboardingRoutes loaded (${Date.now() - startOnboarding}ms)`)
const startDashboard = Date.now()
const dashboardRoutes = requireWithRetry("./routes/dashboard")
console.log(`✅ dashboardRoutes loaded (${Date.now() - startDashboard}ms)`)
const startAdmin = Date.now()
const adminRoutes = requireWithRetry("./routes/admin")
console.log(`✅ adminRoutes loaded (${Date.now() - startAdmin}ms)`)
console.log('📂 Loading routes/api (this is a large file, may take a moment)...')
console.log('   ⏳ Parsing 11,456 lines...')
const startApi = Date.now()
const apiRoutes = requireWithRetry("./routes/api")
const apiLoadTime = Date.now() - startApi
if (apiLoadTime > 3000) {
  console.log(`⚠️  apiRoutes loaded (${apiLoadTime}ms - very slow! This is a large file)`)
} else {
  console.log(`✅ apiRoutes loaded (${apiLoadTime}ms)`)
}
const startForms = Date.now()
const formsRoutes = requireWithRetry("./routes/forms")
console.log(`✅ formsRoutes loaded (${Date.now() - startForms}ms)`)
// internalCampaignsRoutes loads heavy Google Ads services - load lazily
let internalCampaignsRoutes = null
const getInternalCampaignsRoutes = () => {
  if (!internalCampaignsRoutes) {
    console.log('📦 Loading internalCampaignsRoutes...')
    const startTime = Date.now()
    internalCampaignsRoutes = requireWithRetry("./routes/internalCampaigns")
    const loadTime = Date.now() - startTime
    console.log(`✅ internalCampaignsRoutes loaded (${loadTime}ms)`)
  }
  return internalCampaignsRoutes
}
console.log('✅ internalCampaignsRoutes will be loaded lazily')

console.log('📋 Registering routes...')
const routeRegStart = Date.now()
// Routes
app.use("/", authRoutes)
app.use("/dashboard", requireAuth, dashboardRoutes)
app.use("/onboarding", requireAuth, onboardingRoutes)
app.use("/admin", requireAuth, isAdmin, adminRoutes)
app.use("/api", apiRoutes)
app.use("/leads", (req, res, next) => {
  getLeadsRoutes()(req, res, next)
})
app.use("/", formsRoutes) // Public form routes (must be after auth routes to allow public access)
app.use("/", (req, res, next) => {
  getInternalCampaignsRoutes()(req, res, next)
}) // Internal campaign cockpit and tools
console.log(`✅ Routes registered (${Date.now() - routeRegStart}ms)`)

// Sidebar test page
app.get("/sidebar", (req, res) => {
  res.render("sidebar-test", { layout: false })
})

// Support page - accessible to everyone
app.get("/support", (req, res) => {
  res.render("support", { 
    layout: false,
    user: req.user || null
  })
})

// Homepage route
app.get("/", (req, res) => {
  if (req.user || req.session.user) {
    return res.redirect("/dashboard")
  }
  res.render("index", { layout: false })
})

// API Routes

// Profile picture upload
app.post("/api/upload-profile-picture", requireAuth, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Geen bestand geüpload' 
      })
    }
    
    const imageUrl = '/uploads/profiles/' + req.file.filename
    
    console.log('📸 Uploading profile picture for user:', req.user.id)
    console.log('📸 Image URL:', imageUrl)
    
    // Update profile in database
    const { supabaseAdmin } = require('./config/supabase')
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ profile_picture: imageUrl })
      .eq('id', req.user.id)
      .select()
      .single()
    
    if (error) {
      console.error('❌ Database update error:', error)
      // Delete uploaded file if database update fails
      fs.unlinkSync(req.file.path)
      return res.status(500).json({ 
        success: false, 
        message: 'Fout bij opslaan in database: ' + error.message 
      })
    }
    
    console.log('✅ Profile picture saved to database:', data)
    
    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      message: 'Profielfoto succesvol geüpload' 
    })
  } catch (error) {
    console.error('Upload error:', error)
    // Clean up file if error occurs
    if (req.file) {
      fs.unlinkSync(req.file.path)
    }
    res.status(500).json({ 
      success: false, 
      message: 'Er is een fout opgetreden bij het uploaden' 
    })
  }
})

// Gebruiker API routes
app.get("/api/profiles/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.params.id

    // Alleen admins of de gebruiker zelf mag gegevens ophalen
    if (!req.user.user_metadata?.is_admin && req.user.id != userId) {
      return res.status(403).json({ error: "Geen toegang" })
    }

    const user = await supabase.from('profiles').select().eq('id', userId).single()

    if (!user) {
      return res.status(404).json({ error: "Gebruiker niet gevonden" })
    }

    // Verwijder wachtwoord uit response
    delete user.password

    res.json(user)
  } catch (err) {
    console.error("Fout bij ophalen gebruiker:", err)
    res.status(500).json({ error: "Er is een fout opgetreden" })
  }
})

app.post("/api/profiles", requireAuth, isAdmin, async (req, res) => {
  try {
    const { companyName, email, password, balance, isAdmin } = req.body

    // Valideer input
    if (!companyName || !email || !password) {
      return res.status(400).json({ error: "Bedrijfsnaam, email en wachtwoord zijn verplicht" })
    }

    // Controleer of email al bestaat
    const existingUser = await supabase.from('profiles').select().eq('email', email).single()
    if (existingUser) {
      return res.status(400).json({ error: "Email is al in gebruik" })
    }

    // Hash wachtwoord
    const hashedPassword = await bcrypt.hash(password, 10)

    // Gebruiker toevoegen
    const result = await supabase.from('profiles').insert({
      company_name: companyName,
      email: email,
      password: hashedPassword,
      balance: balance || 0,
      is_admin: isAdmin || 0,
      created_at: new Date().toISOString()
    }).select().single()

    res.json({
      success: true,
      message: "Gebruiker succesvol aangemaakt",
      userId: result.id,
    })
  } catch (err) {
    console.error("Fout bij aanmaken gebruiker:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het aanmaken" })
  }
})

// Wijzig de PUT route voor /api/profiles/:id om alle velden te ondersteunen
app.put("/api/profiles/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const { companyName, email, first_name, last_name, phone, balance, isAdmin, status } = req.body;

    // Log de ontvangen data
    console.log("Update verzoek ontvangen:", { userId, ...req.body });

    // Alleen admins of de gebruiker zelf mag gegevens bijwerken
    if (!req.user.user_metadata?.is_admin && req.user.id != userId) {
      return res.status(403).json({ 
        success: false,
        message: "Geen toegang tot deze functionaliteit" 
      });
    }

    // Valideer input
    if (!companyName || !email) {
      return res.status(400).json({ 
        success: false,
        message: "Bedrijfsnaam en email zijn verplicht" 
      });
    }

    // Controleer of gebruiker bestaat
    const { data: existingUser, error: userError } = await supabase
      .from('profiles')
      .select()
      .eq('id', userId)
      .single();

    if (userError || !existingUser) {
      return res.status(404).json({ 
        success: false,
        message: "Gebruiker niet gevonden" 
      });
    }

    // Controleer of email al in gebruik is door een andere gebruiker
    const { data: emailUser, error: emailError } = await supabase
      .from('profiles')
      .select()
      .eq('email', email)
      .neq('id', userId)
      .single();

    if (emailUser) {
      return res.status(400).json({ 
        success: false,
        message: "Email is al in gebruik door een andere gebruiker" 
      });
    }

    // Bouw update object
    const updateData = {
      company_name: companyName,
      email: email,
      first_name: first_name || "",
      last_name: last_name || "",
      phone: phone || "",
    };

    // Alleen admins mogen admin status en saldo wijzigen
    if (req.user.user_metadata?.is_admin) {
      updateData.balance = balance;
      updateData.is_admin = isAdmin;
      updateData.status = status || "active";
    }

    // Update gebruiker
    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error("Database update error:", updateError);
      throw new Error("Fout bij het bijwerken van de gebruiker in de database");
    }

    // Log het resultaat
    console.log("Gebruiker bijgewerkt:", updatedUser);

    res.json({ 
      success: true, 
      message: "Gebruiker succesvol bijgewerkt",
      data: updatedUser
    });

  } catch (err) {
    console.error("Fout bij bijwerken gebruiker:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message || "Er is een fout opgetreden bij het bijwerken" 
    });
  }
});

// Replace the individual delete endpoint with proper transaction handling
// Find this code: app.delete("/api/profiles/:id", requireAuth, isAdmin, async (req, res) => {

// Consolidated delete endpoint with transaction support
app.delete("/api/profiles/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    const cascade = req.query.cascade === "true" || req.body.cascade === true

    console.log(`Attempting to delete user ${userId} with cascade=${cascade}`)

    // Controleer of gebruiker bestaat
    const user = await supabase.from('profiles').select().eq('id', userId).single()
    if (!user) {
      console.log(`User ${userId} not found`)
      return res.status(404).json({
        success: false,
        message: "Gebruiker niet gevonden",
      })
    }

    // Begin transaction
    await supabase.from('profiles').update({
      status: "deleted"
    }).eq('id', userId)

    // Commit transaction
    console.log(`Successfully deleted user ${userId}`)

    return res.json({
      success: true,
      message: cascade ? "Gebruiker en gerelateerde gegevens succesvol verwijderd" : "Gebruiker succesvol verwijderd",
    })
  } catch (err) {
    console.error("Fout bij verwijderen gebruiker:", err)
    res.status(500).json({
      success: false,
      message: "Er is een fout opgetreden bij het verwijderen",
      details: err.message,
    })
  }
})

// Replace the bulk delete endpoint with proper transaction handling
// Find this code: app.post("/api/profiles/bulk/delete", requireAuth, isAdmin, async (req, res) => {

// Bulk delete endpoint with transaction support
app.post("/api/profiles/bulk/delete", requireAuth, isAdmin, async (req, res) => {
  try {
    const { ids, cascade = true } = req.body
    console.log(`Bulk delete request for profiles: ${ids} with cascade=${cascade}`)

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Gebruiker IDs zijn verplicht",
      })
    }

    const results = []
    let successCount = 0

    // Process each user one by one with transaction
    for (const userId of ids) {
      try {
        console.log(`Processing user ${userId}`)

        // Check if user exists
        const user = await supabase.from('profiles').select().eq('id', userId).single()
        if (!user) {
          console.log(`User ${userId} not found`)
          results.push({
            userId,
            success: false,
            message: "Gebruiker niet gevonden",
          })
          continue
        }

        // Begin transaction
        await supabase.from('profiles').update({
          status: "deleted"
        }).eq('id', userId)

        // Commit transaction
        console.log(`Successfully deleted user ${userId}`)

        results.push({ userId, success: true })
        successCount++
      } catch (err) {
        console.error(`Error processing user ${userId}:`, err.stack)
        results.push({ userId, success: false, message: err.message })
      }
    }

    return res.json({
      success: successCount > 0,
      message: `${successCount} van ${ids.length} gebruiker(s) succesvol verwijderd`,
      results,
    })
  } catch (err) {
    console.error("Error in bulk delete:", err.stack)
    res.status(500).json({
      success: false,
      message: "Er is een fout opgetreden bij het verwijderen van de gebruikers",
      details: err.message,
    })
  }
})

// Admin API routes voor gebruikersbeheer - redirect to main API
app.delete("/admin/api/profiles/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    const cascade = req.body && req.body.cascade === true

    // Redirect to the main API endpoint
    req.query.cascade = cascade ? "true" : "false"

    // Forward to the main delete endpoint
    const mainDeleteEndpoint = app._router.stack
      .filter((layer) => layer.route && layer.route.path === "/api/profiles/:id" && layer.route.methods.delete)
      .pop()

    if (mainDeleteEndpoint) {
      console.log(`Forwarding admin delete request to main API endpoint for user ${userId}`)
      mainDeleteEndpoint.handle(req, res)
    } else {
      throw new Error("Main delete endpoint not found")
    }
  } catch (err) {
    console.error("Admin API: Fout bij verwijderen gebruiker:", err)
    res.status(500).json({
      success: false,
      message: "Er is een fout opgetreden bij het verwijderen",
      details: err.message,
    })
  }
})

// Admin API bulk delete - redirect to main API
app.post("/admin/api/profiles/bulk/delete", requireAuth, isAdmin, async (req, res) => {
  try {
    // Forward to the main bulk delete endpoint
    const mainBulkDeleteEndpoint = app._router.stack
      .filter((layer) => layer.route && layer.route.path === "/api/profiles/bulk/delete" && layer.route.methods.post)
      .pop()

    if (mainBulkDeleteEndpoint) {
      console.log("Forwarding admin bulk delete request to main API endpoint")
      mainBulkDeleteEndpoint.handle(req, res)
    } else {
      throw new Error("Main bulk delete endpoint not found")
    }
  } catch (err) {
    console.error("Admin API: Fout bij bulk delete:", err)
    res.status(500).json({
      success: false,
      message: "Er is een fout opgetreden bij het verwijderen van de gebruikers",
      details: err.message,
    })
  }
})

// Lead API routes
app.get("/api/leads/:id", requireAuth, async (req, res) => {
  try {
    const leadId = req.params.id
    const lead = await supabase.from('leads').select().eq('id', leadId).single()

    if (!lead) {
      return res.status(404).json({ error: "Lead niet gevonden" })
    }

    // Controleer of gebruiker toegang heeft tot deze lead
    if (!req.user.user_metadata?.is_admin && lead.user_id != req.user.id) {
      return res.status(403).json({ error: "Geen toegang tot deze lead" })
    }

    res.json(lead)
  } catch (err) {
    console.error("Fout bij ophalen lead:", err)
    res.status(500).json({ error: "Er is een fout opgetreden" })
  }
})

app.post("/api/leads", requireAuth, isAdmin, async (req, res) => {
  try {
    const { name, email, phone, message, assignedTo, status } = req.body

    // Valideer input
    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Naam, email en telefoon zijn verplicht" })
    }

    // Lead toevoegen
    const result = await supabase.from('leads').insert({
      name: name,
      email: email,
      phone: phone,
      message: message,
      user_id: assignedTo || null,
      status: status || "new",
      created_at: new Date().toISOString()
    }).select().single()

    // Log lead creation in system logs
    try {
      const SystemLogService = require('./services/systemLogService');
      
      // Get assigned user name if available
      let assignedUserName = 'Niet toegewezen';
      if (assignedTo) {
        const { data: user } = await supabase
          .from('profiles')
          .select('first_name, last_name, company_name')
          .eq('id', assignedTo)
          .single();
        if (user) {
          assignedUserName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.company_name || 'Onbekende gebruiker';
        }
      }

      await SystemLogService.log({
        type: 'success',
        category: 'admin',
        title: 'Nieuwe Lead Aangemaakt',
        message: `Nieuwe lead aangemaakt: ${name} (${email})`,
        details: `Lead ID: ${result.id}, Toegewezen aan: ${assignedUserName}, Status: ${status || 'new'}`,
        source: 'Server API',
        userId: assignedTo,
        adminId: req.user?.id,
        metadata: {
          lead_id: result.id,
          lead_name: name,
          lead_email: email,
          lead_phone: phone,
          assigned_user_id: assignedTo,
          assigned_user_name: assignedUserName,
          status: status || 'new',
          message: message
        },
        severity: 'medium'
      });
    } catch (logError) {
      console.error("Error logging lead creation:", logError);
      // Don't throw error here, as the lead was created successfully
    }

    res.json({
      success: true,
      message: "Lead succesvol aangemaakt",
      leadId: result.id,
    })
  } catch (err) {
    console.error("Fout bij aanmaken lead:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het aanmaken" })
  }
})

app.put("/api/leads/:id", requireAuth, async (req, res) => {
  try {
    const leadId = req.params.id
    const { name, email, phone, message, assignedTo, status } = req.body

    // Valideer input
    if (!name || !email || !phone) {
      return res.status(400).json({ error: "Naam, email en telefoon zijn verplicht" })
    }

    // Controleer of lead bestaat
    const lead = await supabase.from('leads').select().eq('id', leadId).single()
    if (!lead) {
      return res.status(404).json({ error: "Lead niet gevonden" })
    }

    // Controleer of gebruiker toegang heeft tot deze lead
    if (!req.user.user_metadata?.is_admin && lead.user_id != req.user.id) {
      return res.status(403).json({ error: "Geen toegang tot deze lead" })
    }

    // Lead bijwerken
    if (req.user.user_metadata?.is_admin) {
      // Admin kan alles bijwerken
      await supabase.from('leads').update({
        name: name,
        email: email,
        phone: phone,
        message: message,
        user_id: assignedTo || null,
        status: status,
      }).eq('id', leadId)
    } else {
      // Gebruiker kan alleen status bijwerken
      await supabase.from('leads').update({
        status: status,
      }).eq('id', leadId).eq('user_id', req.user.id)
    }

    res.json({ success: true, message: "Lead succesvol bijgewerkt" })
  } catch (err) {
    console.error("Fout bij bijwerken lead:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken" })
  }
})

app.put("/api/leads/:id/status", requireAuth, async (req, res) => {
  try {
    const leadId = req.params.id
    const { status } = req.body

    // Valideer status
    if (!["new", "accepted", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Ongeldige status" })
    }

    // Controleer of lead bestaat en aan deze gebruiker is toegewezen
    const lead = await supabase.from('leads').select().eq('id', leadId).eq('user_id', req.user.id).single()

    if (!lead) {
      return res.status(404).json({ error: "Lead niet gevonden of niet toegewezen aan jouw account" })
    }

    // Update lead status
    await supabase.from('leads').update({
      status: status,
    }).eq('id', leadId)

    // Als lead geaccepteerd is, voeg kosten toe aan gebruikerssaldo
    if (status === "accepted") {
      // Haal lead prijs op uit instellingen of gebruik standaardwaarde
      const leadPrice = 10.0 // Standaard prijs per lead

      // Controleer of gebruiker voldoende saldo heeft
      const user = await supabase.from('profiles').select().eq('id', req.user.id).single()
      if (user.balance < leadPrice) {
        return res.status(400).json({ error: "Onvoldoende saldo om deze lead te accepteren" })
      }

      // Trek kosten af van gebruikerssaldo
      await supabase.from('profiles').update({
        balance: user.balance - leadPrice,
      }).eq('id', req.user.id)

      // Registreer betaling
      await supabase.from('payments').insert({
        user_id: req.user.id,
        amount: -leadPrice,
        description: `Lead #${leadId} geaccepteerd`,
        status: "completed",
        created_at: new Date().toISOString()
      }).select().single()
    }

    res.json({
      success: true,
      message: `Lead status bijgewerkt naar ${status}`,
    })
  } catch (err) {
    console.error("Fout bij bijwerken lead status:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken van de lead status" })
  }
})

app.delete("/api/leads/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const leadId = req.params.id

    // Controleer of lead bestaat
    const lead = await supabase.from('leads').select().eq('id', leadId).single()
    if (!lead) {
      return res.status(404).json({ error: "Lead niet gevonden" })
    }

    // Lead verwijderen
    await supabase.from('leads').delete().eq('id', leadId)

    res.json({ success: true, message: "Lead succesvol verwijderd" })
  } catch (err) {
    console.error("Fout bij verwijderen lead:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het verwijderen" })
  }
})

// Betalingen API routes
app.get("/api/payments/:id", requireAuth, async (req, res) => {
  try {
    const paymentId = req.params.id
    const payment = await supabase.from('payments').select().eq('id', paymentId).single()

    if (!payment) {
      return res.status(404).json({ error: "Betaling niet gevonden" })
    }

    // Controleer of gebruiker toegang heeft tot deze betaling
    if (!req.user.user_metadata?.is_admin && payment.user_id != req.user.id) {
      return res.status(403).json({ error: "Geen toegang tot deze betaling" })
    }

    res.json(payment)
  } catch (err) {
    console.error("Fout bij ophalen betaling:", err)
    res.status(500).json({ error: "Er is een fout opgetreden" })
  }
})

app.post("/api/payments", requireAuth, isAdmin, async (req, res) => {
  try {
    const { userId, amount, description, status } = req.body

    // Valideer input
    if (!userId || !amount || !description) {
      return res.status(400).json({ error: "Gebruiker, bedrag en beschrijving zijn verplicht" })
    }

    // Controleer of gebruiker bestaat
    const user = await supabase.from('profiles').select().eq('id', userId).single()
    if (!user) {
      return res.status(404).json({ error: "Gebruiker niet gevonden" })
    }

    // Betaling toevoegen
    const result = await supabase.from('payments').insert({
      user_id: userId,
      amount: amount,
      description: description,
      status: status || "completed",
      created_at: new Date().toISOString()
    }).select().single()

    // Als betaling voltooid is, update gebruikerssaldo
    if (status === "completed") {
      await supabase.from('profiles').update({
        balance: user.balance + amount,
      }).eq('id', userId)
    }

    res.json({
      success: true,
      message: "Betaling succesvol aangemaakt",
      paymentId: result.id,
    })
  } catch (err) {
    console.error("Fout bij aanmaken betaling:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het aanmaken" })
  }
})

app.put("/api/payments/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const paymentId = req.params.id
    const { userId, amount, description, status } = req.body

    // Valideer input
    if (!userId || !amount || !description) {
      return res.status(400).json({ error: "Gebruiker, bedrag en beschrijving zijn verplicht" })
    }

    // Controleer of betaling bestaat
    const payment = await supabase.from('payments').select().eq('id', paymentId).single()
    if (!payment) {
      return res.status(404).json({ error: "Betaling niet gevonden" })
    }

    // Betaling bijwerken
    await supabase.from('payments').update({
      user_id: userId,
      amount: amount,
      description: description,
      status: status,
    }).eq('id', paymentId)

    // Als status is gewijzigd, update gebruikerssaldo
    if (payment.status !== status) {
      if (payment.status !== "completed" && status === "completed") {
        // Voeg bedrag toe aan saldo
        await supabase.from('profiles').update({
          balance: user.balance + amount,
        }).eq('id', userId)
      } else if (payment.status === "completed" && status !== "completed") {
        // Trek bedrag af van saldo
        await supabase.from('profiles').update({
          balance: user.balance - amount,
        }).eq('id', payment.user_id)
      }
    }

    res.json({ success: true, message: "Betaling succesvol bijgewerkt" })
  } catch (err) {
    console.error("Fout bij bijwerken betaling:", err)
    res.status(500).json({ error: "Er is een fout opgetreden bij het bijwerken" })
  }
})

app.delete("/api/payments/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const paymentId = req.params.id

    // Controleer of betaling bestaat
    const payment = await supabase.from('payments').select().eq('id', paymentId).single()
    if (!payment) {
      return res.status(404).json({ error: "Betaling niet gevonden" })
    }

    // Als betaling voltooid was, pas gebruikerssaldo aan
    if (payment.status === "completed") {
      await supabase.from('profiles').update({
        balance: user.balance - payment.amount,
      }).eq('id', payment.user_id)
    }

    // Betaling verwijderen
    await supabase.from('payments').delete().eq('id', paymentId)

    res.json({ success: true, message: "Betaling succesvol verwijderd" })
  } catch (err) {
    console.error("Fout bij verwijderen betaling:", err)
    res.status(500).json({
      error: "Er is een fout opgetreden bij het verwijderen",
    })
  }
})

// Admin API routes voor gebruikersbeheer
app.get("/admin/api/profiles/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    const user = await supabase.from('profiles').select().eq('id', userId).single()

    if (!user) {
      return res.status(404).json({ success: false, message: "Gebruiker niet gevonden" })
    }

    res.json({ success: true, user })
  } catch (err) {
    console.error("Fout bij ophalen gebruiker:", err)
    res.status(500).json({ success: false, message: "Er is een fout opgetreden" })
  }
})

app.put("/admin/api/profiles/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { company_name, first_name, last_name, email, phone, is_admin, status } = req.body;

    // Log de ontvangen data
    console.log("Admin update verzoek ontvangen:", { userId, ...req.body });

    // Valideer input
    if (!company_name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: "Bedrijfsnaam en email zijn verplicht" 
      });
    }

    // Controleer of gebruiker bestaat
    const { data: existingUser, error: userError } = await supabase
      .from('profiles')
      .select()
      .eq('id', userId)
      .single();

    if (userError || !existingUser) {
      return res.status(404).json({ 
        success: false, 
        message: "Gebruiker niet gevonden" 
      });
    }

    // Controleer of email al in gebruik is door een andere gebruiker
    const { data: emailUser, error: emailError } = await supabase
      .from('profiles')
      .select()
      .eq('email', email)
      .neq('id', userId)
      .single();

    if (emailUser) {
      return res.status(400).json({ 
        success: false, 
        message: "Email is al in gebruik door een andere gebruiker" 
      });
    }

    // Update gebruiker
    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update({
        company_name,
        first_name: first_name || "",
        last_name: last_name || "",
        email,
        phone: phone || "",
        is_admin,
        status,
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error("Database update error:", updateError);
      throw new Error("Fout bij het bijwerken van de gebruiker in de database");
    }

    // Log het resultaat
    console.log("Gebruiker bijgewerkt (admin):", updatedUser);

    res.json({ 
      success: true, 
      message: "Gebruiker succesvol bijgewerkt",
      data: updatedUser
    });

  } catch (err) {
    console.error("Fout bij bijwerken gebruiker:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message || "Er is een fout opgetreden bij het bijwerken" 
    });
  }
});

// Voeg een nieuwe POST route toe voor /admin/api/profiles/:id om compatibiliteit met de frontend te garanderen
app.post("/admin/api/profiles/:id", requireAuth, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { company_name, first_name, last_name, email, phone, is_admin, status } = req.body;

    // Log de ontvangen data
    console.log("Admin POST update verzoek ontvangen:", { userId, ...req.body });

    // Valideer input
    if (!company_name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: "Bedrijfsnaam en email zijn verplicht" 
      });
    }

    // Controleer of gebruiker bestaat
    const { data: existingUser, error: userError } = await supabase
      .from('profiles')
      .select()
      .eq('id', userId)
      .single();

    if (userError || !existingUser) {
      return res.status(404).json({ 
        success: false, 
        message: "Gebruiker niet gevonden" 
      });
    }

    // Controleer of email al in gebruik is door een andere gebruiker
    const { data: emailUser, error: emailError } = await supabase
      .from('profiles')
      .select()
      .eq('email', email)
      .neq('id', userId)
      .single();

    if (emailUser) {
      return res.status(400).json({ 
        success: false, 
        message: "Email is al in gebruik door een andere gebruiker" 
      });
    }

    // Update gebruiker
    const { data: updatedUser, error: updateError } = await supabase
      .from('profiles')
      .update({
        company_name,
        first_name: first_name || "",
        last_name: last_name || "",
        email,
        phone: phone || "",
        is_admin,
        status,
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error("Database update error:", updateError);
      throw new Error("Fout bij het bijwerken van de gebruiker in de database");
    }

    // Log het resultaat
    console.log("Gebruiker bijgewerkt (admin POST):", updatedUser);

    res.json({ 
      success: true, 
      message: "Gebruiker succesvol bijgewerkt",
      data: updatedUser
    });

  } catch (err) {
    console.error("Fout bij bijwerken gebruiker:", err);
    res.status(500).json({ 
      success: false, 
      message: err.message || "Er is een fout opgetreden bij het bijwerken" 
    });
  }
});

// Bulk user operations
app.post("/api/profiles/bulk/status", requireAuth, isAdmin, async (req, res) => {
  try {
    const { status, ids } = req.body

    if (!status || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Status en gebruiker IDs zijn verplicht",
      })
    }

    // Update status for all profiles
    const placeholders = ids.map(() => "?").join(",")
    await supabase.from('profiles').update({
      status: status,
    }).eq('id', ids)

    res.json({
      success: true,
      message: `Status van ${ids.length} gebruiker(s) bijgewerkt naar ${status}`,
    })
  } catch (err) {
    console.error("Fout bij bulk status update:", err)
    res.status(500).json({
      success: false,
      message: "Er is een fout opgetreden bij het bijwerken van de gebruikers",
    })
  }
})

// Admin API endpoints for bulk operations
app.post("/admin/api/profiles/bulk/status", requireAuth, isAdmin, async (req, res) => {
  try {
    // Forward to the main bulk status endpoint
    const mainBulkStatusEndpoint = app._router.stack
      .filter((layer) => layer.route && layer.route.path === "/api/profiles/bulk/status" && layer.route.methods.post)
      .pop()

    if (mainBulkStatusEndpoint) {
      console.log("Forwarding admin bulk status request to main API endpoint")
      mainBulkStatusEndpoint.handle(req, res)
    } else {
      throw new Error("Main bulk status endpoint not found")
    }
  } catch (err) {
    console.error("Fout bij bulk status update:", err)
    res.status(500).json({
      success: false,
      message: "Er is een fout opgetreden bij het bijwerken van de gebruikers",
    })
  }
})

// Public Landing Page Rendering (catch-all, but before 404)
// This route handles public landing pages based on domain + path
app.get('*', async (req, res, next) => {
  try {
    const path = req.path;
    
    // Skip API routes, admin routes, static files, and known routes
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
      return next(); // Pass to next middleware (404 handler)
    }
    
    // Get site by domain
    const SiteService = require('./services/siteService');
    const host = req.hostname || req.headers.host;
    const site = await SiteService.getSiteByDomain(host);
    
    if (!site) {
      return next(); // No site found, pass to 404
    }
    
    // Normalize path (ensure trailing slash consistency)
    let normalizedPath = path;
    if (!normalizedPath.endsWith('/') && !normalizedPath.includes('.')) {
      normalizedPath = normalizedPath + '/';
    }
    
    // Get landing page
    const PartnerLandingPageService = require('./services/partnerLandingPageService');
    const landingPage = await PartnerLandingPageService.getLandingPageByPath(site.id, normalizedPath);
    
    if (!landingPage || landingPage.status !== 'live') {
      return next(); // No LP found or not live, pass to 404
    }
    
    // Track view
    await PartnerLandingPageService.trackView(landingPage.id);
    
    // Get cluster for internal linking
    const cluster = await PartnerLandingPageService.getLandingPageCluster(site.id, landingPage.segment_id);
    
    // Get industry by segment branch for form template
    let industry = null;
    let formSlug = null;
    if (landingPage.segment_id) {
      const { data: segment } = await supabaseAdmin
        .from('lead_segments')
        .select('branch')
        .eq('id', landingPage.segment_id)
        .single();
      
      if (segment && segment.branch) {
        const { data: industries } = await supabaseAdmin
          .from('industries')
          .select('id, name, slug')
          .eq('name', segment.branch)
          .eq('is_active', true)
          .limit(1)
          .single();
        
        if (industries) {
          industry = industries;
          formSlug = industries.slug;
        }
      }
    }
    
    // Render landing page
    res.render('public/landing-page', {
      site,
      landingPage,
      cluster,
      industry: industry,
      formSlug: formSlug,
      // Tracking / gtag config (Consent Mode aware)
      googleAdsTagId: process.env.GOOGLE_ADS_TAG_ID || null,
      ga4MeasurementId: process.env.GA4_MEASUREMENT_ID || null,
      googleAdsConversionId: process.env.GOOGLE_ADS_CONVERSION_ID || null,
      googleAdsConversionLabel: process.env.GOOGLE_ADS_CONVERSION_LABEL || null,
      layout: false
    });
    
  } catch (error) {
    console.error('Error rendering landing page:', error);
    next(); // Pass to 404 handler on error
  }
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).render("errors/404", { layout: false })
})

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message)
  console.error(err.stack)
  // Try to render error page, but don't crash if it fails
  try {
    res.status(500).render("errors/500", { layout: false })
  } catch (renderError) {
    // Fallback to JSON if render fails
    res.status(500).json({ 
      error: 'Internal Server Error',
      message: err.message 
    })
  }
})

console.log('✅ All middleware and routes configured')

// Check if running on Vercel (serverless) or locally
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV

// Export app for Vercel serverless functions
// ALWAYS export app - Vercel needs this, local dev uses app.listen()
module.exports = app

if (!isVercel) {
  // Local development: start server with app.listen()
  console.log(`🚀 Starting server on port ${PORT}...`)
  console.log(`📝 About to call app.listen()...`)
  const listenStart = Date.now()
  app.listen(PORT, async () => {
    const listenTime = Date.now() - listenStart
    console.log(`⏱️  app.listen() took ${listenTime}ms to complete`)
    console.log(`✅ Server draait op http://localhost:${PORT}`)
    console.log(`🚀 Server is ready to accept connections!`)
    
    // Start background services asynchronously (non-blocking)
    // These will start in the background and won't block server startup
    
    // Start risk assessment worker (listens to database triggers) - non-blocking
    // Add timeout to prevent hanging if database connection is slow
    Promise.race([
      startRiskAssessmentWorker(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Risk assessment worker start timeout after 15s')), 15000)
      )
    ]).catch(error => {
      console.error('⚠️ Failed to start risk assessment worker:', error.message)
      console.error('   Risk assessments will still work via route handlers')
      console.error('   This is normal if database is not yet reachable')
    })
    
    // Start billing cron job (non-blocking, after server starts)
    // This was moved here because it makes a database query which can timeout
    // if network isn't ready (especially after laptop wake)
    // Add timeout to prevent hanging forever
    Promise.race([
      billingCron.start(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Billing cron start timeout after 10s')), 10000)
      )
    ]).catch(error => {
      console.error('⚠️ Failed to start billing cron job:', error.message)
      console.error('   Billing cron job will retry on next server restart')
      console.error('   This is normal if database is not yet reachable')
    })
    
    // Load all cron jobs lazily after server starts (non-blocking, skip heavy ones)
    const loadCronJobs = async () => {
      // Load lightweight cron jobs first
      const lightweightJobs = [
        { name: 'mailSyncJobs', path: './cron/mailSyncJobs' },
        { name: 'subscriptionNotifications', path: './cron/subscriptionNotifications' }
      ]
      
      for (const job of lightweightJobs) {
        try {
          console.log(`📦 Loading ${job.name}...`)
          const startTime = Date.now()
          requireWithRetry(job.path)
          const loadTime = Date.now() - startTime
          if (loadTime > 500) {
            console.log(`✅ ${job.name} loaded (${loadTime}ms - slow!)`)
          } else {
            console.log(`✅ ${job.name} loaded`)
          }
        } catch (error) {
          console.error(`⚠️ Failed to load ${job.name}:`, error.message)
        }
      }
      
      // Load heavy cron jobs later with delays (they require Google Ads client)
      const heavyJobs = [
        { name: 'leadFlowIntelligenceJobs', path: './cron/leadFlowIntelligenceJobs', delay: 5000 },
        { name: 'partnerMarketingJobs', path: './cron/partnerMarketingJobs', delay: 10000 },
        { name: 'googleAdsPerformanceImportJob', path: './cron/googleAdsPerformanceImportJob', delay: 15000 }
      ]
      
      // Load heavy jobs with delays to avoid blocking
      for (const job of heavyJobs) {
        try {
          await new Promise(resolve => setTimeout(resolve, job.delay))
          console.log(`📦 Loading ${job.name}...`)
          const startTime = Date.now()
          requireWithRetry(job.path)
          const loadTime = Date.now() - startTime
          if (loadTime > 500) {
            console.log(`✅ ${job.name} loaded (${loadTime}ms - slow!)`)
          } else {
            console.log(`✅ ${job.name} loaded`)
          }
        } catch (error) {
          console.error(`⚠️ Failed to load ${job.name}:`, error.message)
        }
      }
    }
    
    // Load cron jobs asynchronously (don't block server startup)
    const cronJobsPromise = loadCronJobs().catch(err => {
      console.error('⚠️ Error loading cron jobs:', err.message)
    })
    
    // Pre-load internalCampaignsRoutes in background (non-blocking)
    const internalCampaignsPromise = new Promise(resolve => {
      setTimeout(() => {
        try {
          getInternalCampaignsRoutes()
        } catch (error) {
          console.error('⚠️ Error pre-loading internalCampaignsRoutes:', error.message)
        } finally {
          resolve()
        }
      }, 2000)
    })
    
    // Emit a final boot-up note once all background initializers completed
    Promise.allSettled([cronJobsPromise, internalCampaignsPromise]).then(() => {
      console.log('✅ Finalized full server bootup')
    })
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is al in gebruik. Probeer een andere poort.`)
    } else {
      console.error('❌ Server error:', err)
    }
    process.exit(1)
  })
}

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
})

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  process.exit(1)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  await stopRiskAssessmentWorker()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  await stopRiskAssessmentWorker()
  process.exit(0)
})

// Authenticatie middleware exporteren voor gebruik in andere modules
// Alleen exporteren als dit bestand wordt geïmporteerd (zoals server-https.js)
// Voor Vercel: app is al geëxporteerd, deze export wordt niet gebruikt
if (require.main !== module && !isVercel) {
  // Als geïmporteerd door ander bestand, exporteer helpers
  // Maar app blijft de hoofd export voor Vercel
  module.exports.app = app
  module.exports.supabase = supabase
  module.exports.requireAuth = requireAuth
  module.exports.isAdmin = isAdmin
}
