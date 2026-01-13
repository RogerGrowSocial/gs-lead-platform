# Deployment Guide

**Last Updated:** 2025-01-28

---

## Overview

This guide covers deploying the GS Lead Platform to production.

**⚠️ NIEUW: Voor uitgebreide Vercel + Supabase + GitHub deployment, zie:**
- **[DEPLOYMENT_GUIDE.md](../../DEPLOYMENT_GUIDE.md)** - Complete stap-voor-stap guide voor Vercel deployment
- **[DEPLOYMENT_CHECKLIST.md](../../DEPLOYMENT_CHECKLIST.md)** - Deployment checklist

**Current Status:** 
- ✅ Vercel deployment guide beschikbaar
- ✅ Automatische deployments via GitHub
- ✅ Supabase integratie gedocumenteerd

---

## Pre-Deployment Checklist

### Code
- [ ] All migrations tested locally
- [ ] Environment variables documented
- [ ] No debug code or console.logs in production paths
- [ ] Error handling tested

### Database
- [ ] All migrations applied to production database
- [ ] RLS policies verified
- [ ] Indexes created
- [ ] Backup created (if updating existing database)

### Environment
- [ ] Production environment variables set
- [ ] API keys configured (Supabase, Mollie, OpenAI, etc.)
- [ ] HTTPS configured
- [ ] Domain configured

### Testing
- [ ] Local testing passed
- [ ] Authentication flow tested
- [ ] Payment flow tested (test mode)
- [ ] Critical user flows tested

---

## Deployment Steps

### Step 1: Prepare Code

```bash
# Ensure you're on the correct branch
git checkout main  # or production branch

# Pull latest changes
git pull origin main

# Verify no uncommitted changes
git status
```

### Step 2: Run Database Migrations

**Option A: Supabase CLI (Recommended)**

```bash
# Link to production project (if not already)
supabase link --project-ref your-production-project-ref

# Push migrations
supabase db push
```

**Option B: Supabase Dashboard**

1. Go to Supabase Dashboard → SQL Editor
2. Run migrations in chronological order
3. Verify each migration succeeds

**Option C: Manual SQL**

1. Copy migration SQL files
2. Paste into SQL Editor
3. Execute one by one

---

### Step 3: Set Environment Variables

**Where to set (depends on hosting):**

#### Heroku
```bash
heroku config:set SUPABASE_URL=...
heroku config:set SUPABASE_SERVICE_ROLE_KEY=...
# etc.
```

#### Vercel
- Project Settings → Environment Variables
- Add each variable

#### Server (PM2/Docker)
- Add to `.env` file (keep secure!)
- Or system environment variables

#### Required Variables
See `/docs/05-runbooks/local_setup.md` for full list.

**Critical:**
- `SUPABASE_URL` (production)
- `SUPABASE_SERVICE_ROLE_KEY` (production)
- `SESSION_SECRET` (strong random string)
- `APP_URL` (production domain)
- `BASE_URL` (production domain)

---

### Step 4: Deploy Application

#### Option A: Git Push (if using Heroku/Vercel)

```bash
git push heroku main
# or
git push vercel main
```

#### Option B: Server Deployment

```bash
# SSH to server
ssh user@server

# Navigate to app directory
cd /path/to/gs-lead-platform

# Pull latest code
git pull origin main

# Install dependencies (if needed)
npm install --production

# Restart application
pm2 restart gs-lead-platform
# or
systemctl restart gs-lead-platform
# or
docker-compose restart
```

---

### Step 5: Verify Deployment

### Check Server Status
```bash
# Check if server is running
curl https://your-domain.com/api/health
# or
curl https://your-domain.com
```

### Test Authentication
1. Visit production URL
2. Try to sign up
3. Verify user created in Supabase

### Test Database
```sql
-- In Supabase Dashboard → SQL Editor
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM leads;
```

### Check Logs
```bash
# Server logs
pm2 logs gs-lead-platform
# or
docker logs gs-lead-platform
# or
heroku logs --tail
```

---

## Post-Deployment

### Verify Critical Features
- [ ] User signup works
- [ ] User login works
- [ ] Lead creation works
- [ ] Payment processing works (test mode)
- [ ] Admin dashboard accessible
- [ ] Email sending works (if configured)

### Monitor
- Check error logs for first 24 hours
- Monitor Supabase dashboard for errors
- Check payment processing (Mollie dashboard)

---

## HTTPS Setup

### Option A: Automatic (Heroku/Vercel)
- HTTPS enabled automatically
- SSL certificate managed by platform

### Option B: Manual (Server)
See `HTTPS_SETUP.md` in root directory for detailed instructions.

**Quick steps:**
1. Obtain SSL certificate (Let's Encrypt)
2. Configure Nginx/Apache
3. Update `APP_URL` and `BASE_URL` to HTTPS

---

## Rollback Procedure

### If Deployment Fails

#### Rollback Code
```bash
# Revert to previous commit
git revert HEAD
git push origin main
# Redeploy
```

#### Rollback Database
```sql
-- In Supabase SQL Editor
-- Run rollback SQL (if migration included rollback)
-- Or manually reverse changes
```

#### Restart Previous Version
```bash
# If using PM2
pm2 restart gs-lead-platform --update-env

# If using Docker
docker-compose down
docker-compose up -d
```

---

## Environment-Specific Notes

### Production
- Use production Supabase project
- Use production API keys (Mollie, Google Ads, etc.)
- Enable error logging
- Disable debug mode

### Staging
- Use separate Supabase project
- Use test API keys
- Can enable debug mode
- Test new features here first

---

## Security Checklist

- [ ] `SESSION_SECRET` is strong random string
- [ ] Service role key never exposed to client
- [ ] HTTPS enabled
- [ ] Environment variables not in code
- [ ] `.env` file in `.gitignore`
- [ ] RLS policies enabled on all tables
- [ ] Admin routes protected

---

## Related Documentation

- **Local Setup:** `/docs/05-runbooks/local_setup.md`
- **Troubleshooting:** `/docs/05-runbooks/troubleshooting.md`
- **Architecture:** `/docs/00-context/architecture.md`

