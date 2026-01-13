# Deployment Quick Start

**Snelle start voor deployment naar Vercel met Supabase en GitHub.**

---

## ⚡ 5-Minuten Setup

### 1. Supabase Project
```bash
# 1. Ga naar supabase.com → New Project
# 2. Kopieer: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### 2. Vercel Deployment
```bash
# 1. Ga naar vercel.com → Add New Project
# 2. Importeer GitHub repository
# 3. Klik "Deploy"
```

### 3. Environment Variables
```bash
# In Vercel Dashboard → Settings → Environment Variables
# Voeg toe:
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
APP_URL=https://jouw-project.vercel.app
BASE_URL=https://jouw-project.vercel.app
NODE_ENV=production
SESSION_SECRET=$(openssl rand -hex 32)
```

### 4. Database Migrations
```bash
# In Supabase Dashboard → SQL Editor
# Run alle files uit: supabase/migrations/
```

### 5. Redeploy
```bash
# In Vercel → Deployments → Redeploy
```

---

## ✅ Test

1. Ga naar: `https://jouw-project.vercel.app`
2. Test signup
3. Check Supabase → Auth → Users

---

## 📚 Volledige Guide

Voor uitgebreide instructies, zie: **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**

---

## 🔗 Handige Links

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Dashboard:** https://supabase.com/dashboard
- **GitHub:** https://github.com/jouw-username/gs-lead-platform
