# Vercel Runtime Split - Dashboard vs Admin

## Overzicht

De runtime is gesplitst in twee aparte serverless functions op Vercel:
- **`api/dashboard.js`**: Handelt `/dashboard/*` en user-specific `/api/*` routes af
- **`api/admin.js`**: Handelt `/admin/*` en admin-specific `/api/*` routes af

Dit voorkomt dat dashboard requests admin code moeten laden (en vice versa), wat de performance significant verbetert.

## Routing Map

### Dashboard Function (`api/dashboard.js`)
- `/dashboard/*` - Alle dashboard pagina's
- `/onboarding/*` - Onboarding flow
- `/api/users/current/*` - User-specific API endpoints
- `/api/dashboard/bootstrap` - Dashboard bootstrap data
- `/api/user/*` - User settings
- `/api/profile/*` - User profile operations
- `/api/payments/methods/*` - User payment methods
- `/api/leads` - User-specific lead reads
- `/api/onboarding/*` - Onboarding API
- `/api/industries` - Industries list (user access)
- `/api/users/current/industry-preferences` - User industry preferences
- `/api/users/current/location-preferences` - User location preferences
- `/api/permissions` - User permissions check
- `/api/profile/check` - Profile check
- `/api/profile` - Profile update (user)
- `/api/user/lead-limit` - User lead limit
- `/api/user/lead-pause` - User lead pause
- `/api/user/lead-settings` - User lead settings
- `/api/leads/:id/activities` - Lead activities (user)
- `/api/leads/:id` - Lead details (user, read-only)
- `/api/upload-profile-picture` - Profile picture upload
- `/login`, `/logout` - Auth routes
- `/payments` - Redirect naar /dashboard/payments
- `/forms/*` - Public form routes
- `/leads/*` - Public lead routes (forms)
- `/` - Root redirect naar /dashboard

### Admin Function (`api/admin.js`)
- `/admin/*` - Alle admin pagina's
- `/admin/api/*` - Admin API endpoints
- `/api/admin/*` - Admin API endpoints
- `/api/profiles/*` - Admin profile operations
- `/api/users/*` - Admin user operations (niet /api/users/current/*)
- `/api/leads` - Admin lead operations (bulk, delete, etc.)
- `/api/payments` - Admin payment operations
- `/api/profiles/bulk/*` - Bulk profile operations
- `/api/leads/bulk/*` - Bulk lead operations
- `/api/admin/bootstrap` - Admin bootstrap data
- `/api/admin/dashboard-*` - Admin dashboard APIs
- `/api/internal/*` - Internal tools (Google Ads, etc.)
- `/api/upload-profile-picture` - Profile picture upload (ook in admin)

## Architectuur

### Factory Pattern
- `lib/createApp.js` - Factory functie die een Express app maakt op basis van `area` parameter
- Shared middleware (auth, session, etc.) wordt altijd geladen
- Routes worden conditioneel gemount op basis van `area`

### Route Filtering
- `lib/filterApiRoutes.js` - Filtert API routes om admin-only routes te blokkeren in dashboard function
- Dashboard function krijgt alleen user-specific routes
- Admin function krijgt alle routes

### Entrypoints
- `api/dashboard.js` - Exporteert `createApp({ area: 'dashboard' })`
- `api/admin.js` - Exporteert `createApp({ area: 'admin' })`
- `api/index.js` - Legacy entrypoint (gebruikt nog steeds volledige server.js voor backward compatibility)

## Vercel Routing

Routes in `vercel.json`:
- `/dashboard/*` → `api/dashboard.js`
- `/dashboard/api/*` → `api/dashboard.js`
- `/onboarding/*` → `api/dashboard.js`
- `/admin/*` → `api/admin.js`
- `/admin/api/*` → `api/admin.js`
- `/api/admin/*` → `api/admin.js`
- `/api/*` → `api/dashboard.js` (user-specific APIs)
- `/login`, `/logout`, `/` → `api/dashboard.js`

## Testing

### Lokaal Testen
```bash
# Start normale server (gebruikt volledige app)
npm start

# Test dashboard routes
curl http://localhost:3000/dashboard
curl http://localhost:3000/api/users/current/industry-preferences

# Test admin routes
curl http://localhost:3000/admin
curl http://localhost:3000/api/admin/bootstrap
```

### Vercel Preview Testen
1. Push naar branch
2. Check Vercel logs:
   - Dashboard requests moeten "BOOT: dashboard function" loggen
   - Admin requests moeten "BOOT: admin function" loggen
3. Verify dat routes correct werken:
   - `/dashboard` → dashboard function
   - `/admin` → admin function
   - `/api/users/current/*` → dashboard function
   - `/api/admin/*` → admin function

## Performance Voordelen

1. **Kleinere Bundles**: Dashboard function laadt geen admin routes
2. **Snellere Cold Starts**: Minder code = snellere initialisatie
3. **Betere Scaling**: Admin en dashboard kunnen onafhankelijk schalen
4. **Minder Memory**: Elke function gebruikt alleen wat nodig is

## Backward Compatibility

- `server.js` blijft werken voor lokale ontwikkeling
- `api/index.js` blijft bestaan voor legacy support
- Alle URLs blijven hetzelfde (geen breaking changes)
- Auth en sessions werken identiek in beide functions

## Troubleshooting

### Routes werken niet
- Check Vercel logs voor "BOOT: dashboard function" of "BOOT: admin function"
- Verify routing rules in `vercel.json`
- Check dat `includeFiles` alle benodigde directories bevat

### Admin routes in dashboard function
- Check `lib/filterApiRoutes.js` filtering logic
- Verify dat admin routes correct geblokkeerd worden

### Missing files op Vercel
- Check `includeFiles` in `vercel.json`
- Verify dat alle benodigde directories in `includeFiles` staan
