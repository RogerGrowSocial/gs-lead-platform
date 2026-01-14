# Routing Map voor Vercel Runtime Split

## Dashboard Routes (api/dashboard.js)
- `/dashboard/*` - Alle dashboard pagina's
- `/onboarding/*` - Onboarding flow
- `/api/users/current/*` - User-specific API endpoints
- `/api/dashboard/bootstrap` - Dashboard bootstrap data
- `/api/user/*` - User-specific settings
- `/api/profile/*` - User profile operations
- `/api/payments/methods/*` - User payment methods
- `/api/leads` - User-specific lead reads (niet admin operations)
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
- `/api/leads/:id` - Lead details (user)
- `/api/payments/methods/*` - Payment methods (user)
- `/api/webhooks/mollie/mandate` - Mollie webhook (public)
- `/` - Root redirect naar /dashboard
- `/login`, `/logout` - Auth routes
- `/payments` - Redirect naar /dashboard/payments
- `/forms/*` - Public form routes
- `/leads/*` - Public lead routes (forms)

## Admin Routes (api/admin.js)
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
- `/api/admin/api/profiles/*` - Admin profile API
- `/api/internal/*` - Internal tools (Google Ads, etc.)

## Shared Routes (beide functions)
- `/auth/*` - Authentication routes (login, logout, etc.)
- `/forms/*` - Public form submission
- `/webhooks/*` - Webhook endpoints
- `/api/webhooks/*` - Webhook API

## Notitie
- `/api` routes moeten gesplit worden: user-specific naar dashboard, admin naar admin
- Dashboard function mag GEEN admin routes importeren
- Admin function mag dashboard routes importeren (optioneel, maar niet nodig)
