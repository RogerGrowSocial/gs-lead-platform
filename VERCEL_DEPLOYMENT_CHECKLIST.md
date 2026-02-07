# Vercel Deployment Checklist

**Laatste update:** 2026-02-07

Deze checklist bevat alle fixes en verificaties die zijn toegepast voor Vercel deployment.

---

## ✅ Toegepaste Fixes (2026-02-07 Production Parity)

### Session & Uploads
- ✅ **cookie-session** op Vercel i.p.v. express-session MemoryStore (auth werkt nu serverless)
- ✅ **trust proxy** voor cookies achter Vercel
- ✅ **Alle uploads** (profile, signature, contact-photo, contracts) → Supabase Storage op Vercel
- ✅ **DELETE handlers** voor contracten verwijderen ook uit Supabase Storage

### Overige
- ✅ Tailwind CDN in production (admin layout)
- ✅ FontAwesome CDN in users.ejs
- ✅ SITE_URL/DASHBOARD_URL fallback naar APP_URL
- ✅ Node engines 18.x, .nvmrc

---

## ✅ Toegepaste Fixes (Eerder)

### 1. Serverless Function Configuration
- ✅ `api/index.js` entrypoint aangemaakt
- ✅ `vercel.json` geconfigureerd met correcte routes
- ✅ `next.config.js` toegevoegd om Next.js auto-detectie uit te schakelen
- ✅ `includeFiles` geconfigureerd voor alle source directories

### 2. Module Bundling Fixes
- ✅ `express`, `express-session`, `bcrypt`, `ejs` statisch ge-require'd op Vercel
- ✅ Alle routes statisch ge-require'd op Vercel
- ✅ `config/supabase`, `middleware/auth` statisch ge-require'd
- ✅ Lazy-loaded routes (`leads`, `internalCampaigns`) pre-loaded op Vercel
- ✅ Veelgebruikte services pre-loaded voor bundling

### 3. Cookie & Session Configuration
- ✅ Cookie domain verwijderd op Vercel (werkt nu op `app.growsocialmedia.nl`)
- ✅ `sameSite` aangepast van `'none'` naar `'lax'` voor betere compatibiliteit
- ✅ Session cookie domain aangepast voor Vercel

### 4. Cron Jobs
- ✅ Cron jobs worden overgeslagen op Vercel (serverless functions ondersteunen geen cron)
- ✅ Dummy `billingCron` object aangemaakt om errors te voorkomen

### 5. TypeScript Conflicts
- ✅ `lib/supabase.ts` hernoemd naar `lib/supabase-next.ts` om conflicten te voorkomen

### 6. File System Issues
- ✅ Winston logger file writes uitgeschakeld op Vercel (read-only filesystem)
- ✅ Alleen console logging op Vercel

### 7. Prisma Configuration
- ✅ Prisma heeft graceful error handling als `DATABASE_URL` niet is gezet
- ✅ Prisma is legacy - meeste code gebruikt Supabase client

---

## 🔍 Verificatie Checklist

### Environment Variables (Vercel Dashboard → Settings → Environment Variables)

**VERPLICHT:**
- [ ] `SUPABASE_URL` - Supabase project URL
- [ ] `SUPABASE_ANON_KEY` - Supabase anonymous key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (GEHEIM!)
- [ ] `APP_URL` - Basis URL van applicatie (bijv. `https://app.growsocialmedia.nl`)
- [ ] `BASE_URL` - Zelfde als APP_URL
- [ ] `SESSION_SECRET` - Willekeurige geheime string voor session encryption

**OPTIONEEL (maar aanbevolen):**
- [ ] `MOLLIE_API_KEY` - Voor betalingen
- [ ] `MOLLIE_PROFILE_ID` - Mollie profile ID
- [ ] `OPENAI_API_KEY` - Voor AI functionaliteit
- [ ] `GOOGLE_ADS_CLIENT_ID` - Voor Google Ads integratie
- [ ] `GOOGLE_ADS_CLIENT_SECRET` - Voor Google Ads integratie
- [ ] `GOOGLE_ADS_REFRESH_TOKEN` - Voor Google Ads integratie
- [ ] `GOOGLE_ADS_DEVELOPER_TOKEN` - Voor Google Ads integratie
- [ ] `GOOGLE_MAPS_API_KEY` - Voor Google Maps
- [ ] `KVK_API_KEY` - Voor KVK verificatie
- [ ] `RABOBANK_CLIENT_ID` - Voor Rabobank API
- [ ] `RABOBANK_CLIENT_SECRET` - Voor Rabobank API
- [ ] `RABOBANK_SANDBOX_MODE` - `true` of `false`
- [ ] `TWILIO_ACCOUNT_SID` - Voor SMS (als gebruikt)
- [ ] `TWILIO_AUTH_TOKEN` - Voor SMS (als gebruikt)
- [ ] `NODE_ENV` - `production` voor productie

**LEGACY (niet meer gebruikt, maar kan nodig zijn voor Prisma):**
- [ ] `DATABASE_URL` - PostgreSQL connection string (Prisma gebruikt dit, maar meeste code gebruikt Supabase)

---

## 🧪 Test Checklist

Na deployment, test de volgende functionaliteiten:

### Authentication
- [ ] Login werkt
- [ ] Redirect naar `/dashboard` na login
- [ ] Redirect naar `/admin` voor admin users
- [ ] Logout werkt
- [ ] Session blijft behouden bij page refresh

### Routes
- [ ] `/dashboard` - Laadt correct
- [ ] `/admin` - Laadt correct (alleen voor admins)
- [ ] `/onboarding` - Laadt correct
- [ ] `/api/*` - API endpoints werken
- [ ] `/leads/*` - Leads routes werken
- [ ] Public forms (`/form/:slug`) - Werken

### Database
- [ ] Supabase connectie werkt
- [ ] Database queries werken
- [ ] RLS (Row Level Security) werkt correct

### Uploads
- [ ] Profile picture upload werkt
- [ ] Contract upload (employee/customer) werkt
- [ ] Contact photo upload werkt

### Integrations
- [ ] Mollie betalingen (als geconfigureerd)
- [ ] Google Ads API (als geconfigureerd)
- [ ] Email verzending (als geconfigureerd)
- [ ] SMS/WhatsApp (als geconfigureerd)

---

## 🐛 Bekende Issues & Workarounds

### 1. Cron Jobs
**Probleem:** Cron jobs draaien niet op Vercel serverless functions  
**Oplossing:** Gebruik Vercel Cron Jobs of externe cron service (bijv. cron-job.org)

### 2. File Writes
**Probleem:** Vercel heeft read-only filesystem  
**Oplossing:** Winston logger → console. Alle uploads → Supabase Storage (memoryStorage + .upload())

### 3. Supabase Storage
**Vereiste:** Bucket `uploads` moet bestaan in Supabase (Dashboard → Storage). Maak publiek voor profile/logo/photo URLs. Zie `docs/SUPABASE_STORAGE_SETUP.md`.

### 4. Long-Running Processes
**Probleem:** Serverless functions hebben max duration (30s in config)  
**Oplossing:** Zware operaties moeten worden opgesplitst of naar background jobs

### 5. Memory Limits
**Probleem:** Serverless functions hebben memory limits  
**Oplossing:** Vercel Active CPU billing negeert memory setting; default limits gelden

---

## 📝 Notes

- Alle source directories zijn geïncludeerd in `includeFiles` in `vercel.json`
- Services worden pre-loaded op Vercel om bundling te garanderen
- TypeScript bestanden zijn hernoemd om conflicten te voorkomen
- Cookie domain is dynamisch gebaseerd op environment

---

## 🔄 Deployment Process

1. Push naar `main` branch
2. Vercel detecteert automatisch de push
3. Build proces start
4. Check build logs voor errors
5. Check runtime logs na deployment
6. Test kritieke functionaliteiten

---

## 📞 Troubleshooting

Als er nog errors zijn:

1. **Check Vercel Runtime Logs** - Kijk naar de exacte error message
2. **Check Environment Variables** - Zorg dat alle vereiste vars zijn gezet
3. **Check Build Logs** - Kijk of de build succesvol was
4. **Check Function Size** - Zorg dat de bundle onder 250MB blijft
