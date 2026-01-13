# Deployment Guide - Vercel, Supabase & GitHub

**Laatste update:** 2025-01-28

Deze guide legt stap-voor-stap uit hoe je het GS Lead Platform deployt naar Vercel met Supabase als database, en hoe je dit koppelt aan GitHub voor automatische deployments.

---

## 📋 Overzicht

### Wat wordt er gedeployed?
- **Frontend & Backend:** Express.js applicatie op Vercel
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel (serverless functions)
- **CI/CD:** GitHub Actions (optioneel)

### Domeinen
- **Tijdelijk domein:** `jouw-project.vercel.app` (automatisch)
- **Eigen domein:** `jouw-domein.nl` (configureerbaar)

---

## 🚀 Stap 1: Supabase Setup

### 1.1 Supabase Project Aanmaken

1. Ga naar [supabase.com](https://supabase.com)
2. Maak een account aan of log in
3. Klik op "New Project"
4. Vul in:
   - **Project Name:** `gs-lead-platform-prod` (of staging)
   - **Database Password:** Genereer een sterk wachtwoord (bewaar dit!)
   - **Region:** Kies dichtstbijzijnde (bijv. `West Europe`)
5. Klik "Create new project"
6. Wacht 2-3 minuten tot project klaar is

### 1.2 Database Migrations Uitvoeren

1. Ga naar Supabase Dashboard → **SQL Editor**
2. Open alle migration files in `supabase/migrations/` in chronologische volgorde
3. Kopieer en plak elke migration één voor één in SQL Editor
4. Klik "Run" voor elke migration
5. Controleer of alle migrations succesvol zijn

**Of via Supabase CLI:**
```bash
# Installeer Supabase CLI
npm install -g supabase

# Link naar project
supabase link --project-ref jouw-project-ref

# Push migrations
supabase db push
```

### 1.3 API Keys Ophalen

1. Ga naar Supabase Dashboard → **Project Settings** → **API**
2. Kopieer de volgende waarden (bewaar ze veilig!):
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon/public key:** `eyJhbGc...` (anon key)
   - **service_role key:** `eyJhbGc...` (service role key - GEHEIM!)

⚠️ **BELANGRIJK:** De service_role key geeft volledige database toegang. Deel deze NOOIT publiekelijk!

---

## 🔧 Stap 2: GitHub Repository Setup

### 2.1 Repository Voorbereiden

```bash
# Zorg dat je code op GitHub staat
git remote -v  # Check of GitHub remote bestaat

# Als nog niet gekoppeld:
git remote add origin https://github.com/jouw-username/gs-lead-platform.git
git push -u origin main
```

### 2.2 .gitignore Controleren

Zorg dat `.gitignore` deze bestanden bevat:
```
.env
.env.local
.env.production
node_modules/
.DS_Store
*.log
```

### 2.3 Environment Variables Template

Maak een `.env.example` bestand (zonder echte keys):
```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Application
APP_URL=https://jouw-domein.nl
BASE_URL=https://jouw-domein.nl
NODE_ENV=production

# Session
SESSION_SECRET=genereer-random-string-hier

# Optional Integrations
OPENAI_API_KEY=sk-...
MOLLIE_API_KEY=live_...
GOOGLE_ADS_DEVELOPER_TOKEN=...
KVK_API_KEY=...
TWILIO_ACCOUNT_SID=...
```

---

## 🌐 Stap 3: Vercel Setup

### 3.1 Vercel Account & Project

1. Ga naar [vercel.com](https://vercel.com)
2. Maak account aan of log in (gebruik GitHub account voor beste integratie)
3. Klik "Add New Project"
4. Importeer je GitHub repository:
   - Selecteer `gs-lead-platform`
   - Klik "Import"

### 3.2 Project Configuratie

Vercel detecteert automatisch:
- **Framework Preset:** Other (Express.js)
- **Root Directory:** `./` (root)
- **Build Command:** (leeg laten, Express heeft geen build)
- **Output Directory:** (leeg laten)
- **Install Command:** `npm install`

**Klik "Deploy"** - eerste deployment start automatisch!

### 3.3 Environment Variables Instellen

Na eerste deployment:

1. Ga naar **Project Settings** → **Environment Variables**
2. Voeg alle environment variables toe (zie lijst hieronder)
3. Selecteer voor elke variable:
   - ✅ **Production**
   - ✅ **Preview** (optioneel, voor staging)
   - ✅ **Development** (optioneel)

**Vereiste Environment Variables:**

```env
# Supabase (VERPLICHT)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Application (VERPLICHT)
APP_URL=https://jouw-project.vercel.app
BASE_URL=https://jouw-project.vercel.app
NODE_ENV=production

# Session (VERPLICHT)
SESSION_SECRET=genereer-met-openssl-rand-hex-32

# Optioneel (afhankelijk van features)
OPENAI_API_KEY=sk-...
MOLLIE_API_KEY=live_...
MOLLIE_PROFILE_ID=pfl_...
GOOGLE_ADS_DEVELOPER_TOKEN=...
GOOGLE_ADS_CLIENT_ID=...
GOOGLE_ADS_CLIENT_SECRET=...
GOOGLE_ADS_REFRESH_TOKEN=...
GOOGLE_ADS_CUSTOMER_ID=...
KVK_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TAVILY_API_KEY=...
```

**Session Secret genereren:**
```bash
openssl rand -hex 32
```

### 3.4 Redeploy Na Environment Variables

1. Ga naar **Deployments** tab
2. Klik op de 3 dots (⋯) naast laatste deployment
3. Klik "Redeploy"
4. Wacht tot deployment klaar is

---

## 🔗 Stap 4: Domein Configureren

### 4.1 Tijdelijk Domein (Vercel)

Na deployment krijg je automatisch:
- `jouw-project.vercel.app`
- Dit werkt direct, geen configuratie nodig!

### 4.2 Eigen Domein Toevoegen

1. Ga naar **Project Settings** → **Domains**
2. Klik "Add Domain"
3. Voer je domein in: `jouw-domein.nl` of `www.jouw-domein.nl`
4. Volg de DNS instructies:

**DNS Records Toevoegen:**

Voor root domain (`jouw-domein.nl`):
```
Type: A
Name: @
Value: 76.76.21.21
```

Voor subdomain (`www.jouw-domein.nl`):
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

**Of gebruik Vercel's automatische DNS:**
- Klik "Configure" bij je domein
- Vercel geeft je specifieke DNS records
- Voeg deze toe bij je DNS provider (bijv. TransIP, Cloudflare)

### 4.3 SSL Certificaat

- Vercel regelt automatisch SSL certificaten via Let's Encrypt
- Wacht 1-24 uur tot DNS is gepropageerd
- SSL wordt automatisch geactiveerd

### 4.4 Environment Variables Bijwerken

Na domein configuratie, update:
```env
APP_URL=https://jouw-domein.nl
BASE_URL=https://jouw-domein.nl
```

Redeploy na wijziging!

---

## 🔄 Stap 5: Automatische Deployments (GitHub)

### 5.1 Vercel GitHub Integration

Vercel is automatisch gekoppeld aan GitHub:
- Elke push naar `main` branch → automatische deployment
- Elke pull request → preview deployment

### 5.2 Deployment Workflow

```bash
# 1. Maak wijzigingen lokaal
git add .
git commit -m "Feature: nieuwe functionaliteit"

# 2. Push naar GitHub
git push origin main

# 3. Vercel deployt automatisch!
# Check status op: vercel.com/dashboard
```

### 5.3 Preview Deployments

- Elke pull request krijgt eigen preview URL
- Test features voordat je merge naar main
- Preview URL: `jouw-project-git-branch-naam.vercel.app`

---

## ✅ Stap 6: Verificatie & Testing

### 6.1 Basis Checks

1. **Homepage:**
   ```
   https://jouw-domein.nl
   ```
   - Moet laden zonder errors

2. **Health Check:**
   ```bash
   curl https://jouw-domein.nl
   ```

3. **API Test:**
   ```bash
   curl https://jouw-domein.nl/api/health
   # Of check in browser console
   ```

### 6.2 Authentication Test

1. Ga naar: `https://jouw-domein.nl`
2. Test signup flow
3. Check Supabase Dashboard → **Auth** → **Users**
4. Verifieer dat nieuwe user is aangemaakt

### 6.3 Database Connectie Test

1. Ga naar Supabase Dashboard → **SQL Editor**
2. Run:
   ```sql
   SELECT COUNT(*) FROM profiles;
   SELECT COUNT(*) FROM leads;
   ```
3. Moet resultaten tonen (ook als 0)

### 6.4 Logs Checken

**Vercel Logs:**
1. Ga naar Vercel Dashboard → **Deployments**
2. Klik op laatste deployment
3. Klik "Functions" tab
4. Check voor errors

**Supabase Logs:**
1. Ga naar Supabase Dashboard → **Logs**
2. Check voor database errors

---

## 🔐 Stap 7: Security Checklist

- [ ] `SESSION_SECRET` is sterk random string
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is alleen in Vercel environment variables (niet in code!)
- [ ] `.env` staat in `.gitignore`
- [ ] HTTPS is actief (automatisch via Vercel)
- [ ] RLS policies zijn actief in Supabase
- [ ] Admin routes zijn beschermd
- [ ] API keys zijn niet gecommit naar GitHub

---

## 🐛 Troubleshooting

### Probleem: Deployment faalt

**Oplossing:**
1. Check Vercel logs voor error message
2. Check of alle environment variables zijn ingesteld
3. Check `vercel.json` configuratie
4. Test lokaal: `npm start`

### Probleem: Database connectie errors

**Oplossing:**
1. Verifieer `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` in Vercel
2. Check Supabase project is actief (niet paused)
3. Check database migrations zijn uitgevoerd
4. Test connectie lokaal met zelfde credentials

### Probleem: Domein werkt niet

**Oplossing:**
1. Check DNS records zijn correct toegevoegd
2. Wacht 24-48 uur voor DNS propagation
3. Gebruik [dnschecker.org](https://dnschecker.org) om te checken
4. Verifieer SSL certificaat is actief in Vercel

### Probleem: Session/cookie errors

**Oplossing:**
1. Check `SESSION_SECRET` is ingesteld
2. Check `APP_URL` en `BASE_URL` zijn correct (met https://)
3. Check cookie settings in `server.js` (secure: true voor production)

### Probleem: Static files laden niet

**Oplossing:**
1. Check `public/` folder bestaat
2. Check `vercel.json` routes configuratie
3. Verifieer file paths in code (gebruik absolute paths)

---

## 📊 Monitoring & Maintenance

### Vercel Analytics

1. Ga naar **Analytics** tab in Vercel dashboard
2. Activeer Vercel Analytics (optioneel, betaalt)
3. Monitor:
   - Page views
   - Response times
   - Error rates

### Supabase Monitoring

1. Ga naar Supabase Dashboard → **Database** → **Usage**
2. Monitor:
   - Database size
   - API requests
   - Bandwidth usage

### Logs Monitoring

**Vercel:**
- Real-time function logs
- Error tracking
- Performance metrics

**Supabase:**
- Database query logs
- Auth logs
- API logs

---

## 🔄 Updates & Redeployments

### Normale Update

```bash
# 1. Maak wijzigingen
git add .
git commit -m "Update: beschrijving"
git push origin main

# 2. Vercel deployt automatisch
# 3. Check deployment status
```

### Database Migrations

1. Maak nieuwe migration file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Test lokaal
3. Run in Supabase Dashboard → SQL Editor
4. Commit en push code
5. Vercel redeployt automatisch

### Environment Variables Wijzigen

1. Ga naar Vercel → **Settings** → **Environment Variables**
2. Wijzig waarde
3. Ga naar **Deployments**
4. Klik "Redeploy" op laatste deployment

---

## 🎯 Production vs Staging

### Staging Setup

1. Maak apart Supabase project: `gs-lead-platform-staging`
2. Maak apart Vercel project: `gs-lead-platform-staging`
3. Koppel aan `staging` branch in GitHub
4. Gebruik test API keys (Mollie test mode, etc.)

### Production Setup

1. Gebruik productie Supabase project
2. Gebruik productie Vercel project
3. Koppel aan `main` branch
4. Gebruik live API keys

---

## 📚 Handige Links

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard
- **GitHub Repository:** https://github.com/jouw-username/gs-lead-platform
- **Vercel Docs:** https://vercel.com/docs
- **Supabase Docs:** https://supabase.com/docs

---

## 🆘 Support

### Vercel Support
- Docs: https://vercel.com/docs
- Community: https://github.com/vercel/vercel/discussions

### Supabase Support
- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com

---

**Laatste update:** 2025-01-28
**Versie:** 1.0
