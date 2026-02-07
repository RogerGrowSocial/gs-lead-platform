# TRIAGE RAPPORT — Production Parity (localhost vs Vercel)

**Datum:** 2026-02-07  
**Focus:** Regressies na deploy op Vercel (CSS/layout, API, performance)

---

## FASE 0 — TOP 10 SUSPECTS (Impact + Waarschijnlijkheid)

| # | Suspect | Impact | Waarschijnlijkheid | Prioriteit | Bewijs |
|---|---------|--------|-------------------|------------|--------|
| 1 | **Ontbrekende env vars (SITE_URL, DASHBOARD_URL)** | P0 | Hoog | P0 | Code gebruikt `SITE_URL`, `DASHBOARD_URL`; niet in Vercel env lijst. Fallback = localhost → password reset/email links breken |
| 2 | **MemoryStore session (productie)** | P0 | Hoog | P0 | Runtime logs: "MemoryStore is not designed for a production environment". Sessions gelden niet over serverless instances → auth breken |
| 3 | **views/users.ejs → /fontawesome/ 404** | P1 | Hoog | P1 | `views/users.ejs:13` href="/fontawesome/css/all.min.css" — map bestaat niet in public/. Andere views gebruiken CDN |
| 4 | **admin.ejs: Tailwind CDN alleen in dev** | P1 | Hoog | P1 | `admin.ejs:48` `if (process.env.NODE_ENV !== 'production')` laadt Tailwind CDN. In prod geen Tailwind → layout anders |
| 5 | **Node engines >=18.0.0 instabiel** | P2 | Gemiddeld | P2 | Build log: "engines: >=18.0.0 will automatically upgrade when new major released". Geen vaste versie |
| 6 | **Vercel route / → api/index vs dashboard** | P2 | Gemiddeld | P2 | vercel.json: "/" → dashboard.js, maar runtime logs tonen function: api/index voor /. Mogelijke config mismatch |
| 7 | **Static files (public/) in Vercel output** | P2 | Gemiddeld | P2 | Build command kopieert geen public/. Route `/(.*\.(css|js|...))` → `/$1`; moet verifiëren of public/ correct geserveerd wordt |
| 8 | **Multer uploads naar disk op serverless** | P1 | Gemiddeld | P1 | lib/createApp.js: multer.diskStorage schrijft naar public/uploads. Vercel heeft read-only filesystem |
| 9 | **GOOGLE_MAPS_API_KEY ontbreekt** | P2 | Gemiddeld | P2 | admin/customers.ejs, dashboard/settings.ejs, etc. gebruiken `googleMapsApiKey`; code valt back op ''. Maps werken niet |
| 10 | **APP_URL / BASE_URL domain mismatch** | P1 | Gemiddeld | P1 | Cookies/auth: domain `.growsocial.nl` lokaal; Vercel gebruikt `undefined` (correct). Verify APP_URL = https://app.growsocialmedia.nl |

---

## FASE A — TRIAGE & DIAGNOSE

### 1. ENV VAR DIFF (Vercel vs Code)

**In Vercel (user-provided):** TWILIO_*, SESSION_SECRET, NODE_ENV, BASE_URL, APP_URL, SUPABASE_*

**In code gebruikt, NIET in Vercel-lijst:**

| Env var | Gebruik | Bestand(en) | Fallback |
|---------|---------|-------------|----------|
| SITE_URL | Password reset redirect | routes/admin.js:394, 12903 | localhost:3000 |
| DASHBOARD_URL | Links in emails, WhatsApp | routes/dashboard.js, api.js, whatsappService.js, notificationService.js | localhost:3000/dashboard |
| GOOGLE_MAPS_API_KEY | Maps in admin/dashboard | multiple views | '' |
| GOOGLE_ADS_* | Google Ads integratie | routes/api.js | null / env |
| MAILGUN_* | SMTP/email | routes/admin.js, emailService.js | various |
| MOLLIE_* | Betalingen | routes/api.js | defaults |
| OPENAI_API_KEY | AI | routes/api.js, aiCustomerSummaryService | - |
| MOLLIE_PROFILE_ID | Mollie | lib/createApp.js | pfl_PN78N3V8Ka (hardcoded) |

**server.js:1807** vereist: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `BASE_URL`, `SESSION_SECRET` — alle aanwezig in Vercel ✅

**Ontbrekend voor correcte prod:** `SITE_URL`, `DASHBOARD_URL` (critical voor email/password reset links)

---

### 2. COOKIES & SESSION

| Aspect | Config | Bron |
|--------|--------|------|
| Domain | Vercel: `undefined` (correct) | server.js:312, lib/createApp.js:133 |
| Secure | `NODE_ENV === "production"` | server.js:322 |
| SameSite | `lax` | server.js:324 |
| Store | MemoryStore (default) | server.js session() — **niet geschikt voor serverless** |

**Probleem:** Elke serverless instance heeft eigen geheugen. Request 1 → instance A (session opslaan). Request 2 → instance B (geen session). Auth lijkt te breken.

**Fix:** Redis/session store (bijv. @vercel/kv, Upstash Redis) of JWT-based auth.

---

### 3. CSS / LAYOUT

| Issue | File | Symptoom |
|-------|------|----------|
| Tailwind alleen in dev | views/layouts/admin.ejs:47-62 | In prod geen Tailwind CDN → pagina's die Tailwind classes gebruiken missen styling |
| FontAwesome 404 | views/users.ejs:13 | `/fontawesome/css/all.min.css` — map bestaat niet. 404 |
| Overige layouts | dashboard.ejs, etc. | Gebruiken CDN (cdnjs, fonts.googleapis) — OK |

**Bewijs admin Tailwind:** `admin.ejs:48` `if (process.env.NODE_ENV !== 'production')` — Tailwind CDN wordt NIET geladen in prod.

---

### 4. API / ROUTES

- Build: "Express.js app - no Next.js build needed" — Next.js build wordt overgeslagen
- package.json heeft `next` dependency en `build: "next build"` maar vercel.json overschrijft met `echo '...'`
- Routes: vercel.json routes lijken correct; dashboard en admin worden correct gemapped
- Runtime logs: 200 responses, geen 404/500 in de gegeven logs

---

### 5. STATIC FILES

- vercel.json: `src: "/(.*\\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp))"` → `dest: "/$1"`
- public/ bevat css/, js/, img/, etc.
- Vercel served standaard bestanden uit project root; `public/` wordt typisch gemapped naar `/`
- **Verificatie nodig:** Test of `/css/style.css` correct laadt op production URL

---

### 6. FILE SYSTEM (Vercel Read-Only)

| Gebruik | File | Probleem |
|---------|------|----------|
| Multer uploads | lib/createApp.js:32-37 | Schrijft naar `public/uploads/profiles`. Vercel: read-only |
| Winston logs | (al gefixt per checklist) | Alleen console op Vercel |

---

### 7. NODE VERSIE

- package.json: `"engines": { "node": ">=18.0.0" }`
- Build warning: "will automatically upgrade when new major Node.js Version is released"
- **Aanbeveling:** Pin naar `18.x` of `20.x` voor reproduceerbare builds

---

### 8. OVERIGE OBSERVATIES

- **public/img/codelammy.php:** WordPress PHP code in img folder — verdacht/verkeerde plek; niet gerelateerd aan Node app
- **engines:** Node >=18 — voldoende voor Vercel
- **memory in vercel.json:** Build log: "Provided memory setting is ignored on Active CPU billing" — kan verwijderd worden

---

## FASE B — ISSUE LIJST PER FILE

### Issue #1: SITE_URL / DASHBOARD_URL ontbreken in Vercel

| Veld | Waarde |
|------|--------|
| Files | - |
| Symptoom | Password reset links, email links, WhatsApp links wijzen naar localhost i.p.v. app.growsocialmedia.nl |
| Root cause | Env vars niet geconfigureerd in Vercel |
| Fix | Voeg in Vercel: `SITE_URL=https://app.growsocialmedia.nl`, `DASHBOARD_URL=https://app.growsocialmedia.nl/dashboard` |

---

### Issue #2: MemoryStore session ✅ FIXED

| Veld | Waarde |
|------|--------|
| Files | server.js, lib/createApp.js |
| Symptoom | Auth/session inconsistent; user "uitgelogd" na refresh of bij andere route |
| Root cause | express-session MemoryStore; elke serverless instance heeft eigen geheugen |
| Fix | **Toegepast:** cookie-session op Vercel (stateless, session in cookie); express-session lokaal; trust proxy |

---

### Issue #3: /fontawesome 404

| Veld | Waarde |
|------|--------|
| Files | views/users.ejs:13 |
| Symptoom | Font Awesome icons missen op users-pagina |
| Root cause | href="/fontawesome/css/all.min.css" — map bestaat niet |
| Fix | Vervang door CDN: `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css` (zoals andere layouts) |

---

### Issue #4: Tailwind alleen in dev (admin)

| Veld | Waarde |
|------|--------|
| Files | views/layouts/admin.ejs:47-62 |
| Symptoom | Admin layout anders of kapot in prod; Tailwind classes niet toegepast |
| Root cause | `if (process.env.NODE_ENV !== 'production')` laadt Tailwind CDN alleen in dev |
| Fix | Tailwind altijd laden (CDN) OF alle admin pagina's bouwen met Tailwind build (complexer). Minimale fix: verwijder de if-wrapper en laad Tailwind altijd via CDN voor admin |

---

### Issue #5: Node engines pin

| Veld | Waarde |
|------|--------|
| Files | package.json |
| Symptoom | Mogelijke breakage bij Node upgrade |
| Root cause | `>=18.0.0` is te breed |
| Fix | `"node": "18.x"` of `"20.x"` |

---

### Issue #6: Multer uploads op serverless

| Veld | Waarde |
|------|--------|
| Files | lib/createApp.js:31-44 |
| Symptoom | Profile picture upload faalt mogelijk met EROFS of vergelijkbaar |
| Root cause | multer.diskStorage schrijft naar filesystem; Vercel read-only |
| Fix | **Toegepast:** memoryStorage + Supabase Storage voor alle uploads (profile, signature, contact-photo, employee profile, customer contract, employee contract) |

---

## VALIDATIE STAPPEN

1. **production build lokaal:** `npm run build` (nu echo) is OK; `node server.js` start. Test: `curl http://localhost:3000/dashboard` (met auth)
2. **Vercel env:** Voeg SITE_URL, DASHBOARD_URL toe; redeploy; test password reset link
3. **FontAwesome:** Fix users.ejs; test /admin/users (of waar users.ejs wordt gebruikt)
4. **Tailwind admin:** Fix admin.ejs; test admin pagina's
5. **Clear cache rebuild:** Vercel Dashboard → Deployments → Redeploy with "Clear Build Cache"

---

## PRIORITEITEN (P0 → P3)

- **P0:** SITE_URL, DASHBOARD_URL; MemoryStore session
- **P1:** fontawesome 404; Tailwind admin; Multer uploads
- **P2:** Node engines; static files verificatie; GOOGLE_MAPS_API_KEY
- **P3:** memory setting verwijderen; codelammy.php opruimen

**Opgeruimd:** `public/img/*.php` in .gitignore; `utils/storage.js` met ensureStorageBucket voor auto-create bucket.

---

## FIXES TOEGEPAST (2026-02-07)

| Fix | File(s) | Wijziging |
|-----|---------|-----------|
| 1 | views/users.ejs:13 | `/fontawesome/` → CDN (cdnjs.cloudflare.com) |
| 2 | views/layouts/admin.ejs:47-62 | Tailwind CDN nu ook in production (was alleen dev) |
| 3 | routes/admin.js, dashboard.js, api.js; services/whatsappService.js, notificationService.js | SITE_URL/DASHBOARD_URL fallback naar APP_URL/BASE_URL |
| 4 | package.json | engines: "18.x" (was ">=18.0.0") |
| 5 | vercel.json | memory setting verwijderd (ignored by Vercel Active CPU) |
| 6 | lib/createApp.js, server.js | **Session:** cookie-session op Vercel (geen MemoryStore); trust proxy |
| 7 | lib/createApp.js, server.js | **Multer:** memoryStorage + Supabase Storage op Vercel voor profile pictures |
| 8 | .nvmrc | Node 18 voor CI/local parity |
| 9 | routes/admin.js | Signature, contact-photo, employee profile, customer contract → memoryStorage + Supabase |
| 10 | routes/api.js | Employee contract → memoryStorage + Supabase |
