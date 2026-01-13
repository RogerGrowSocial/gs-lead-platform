# Local Setup Guide

**Last Updated:** 2025-01-28

---

## Prerequisites

### Required Software
- **Node.js:** v18+ (check: `node --version`)
- **npm:** v9+ (comes with Node.js)
- **Git:** For cloning repository
- **Supabase Account:** For database access

### Optional Software
- **Supabase CLI:** For local Supabase (optional, can use cloud)
- **PostgreSQL Client:** For direct database access (optional)

---

## Step 1: Clone Repository

```bash
git clone [repository-url]
cd gs-lead-platform
```

---

## Step 2: Install Dependencies

```bash
npm install
```

**Expected time:** 1-3 minutes depending on internet speed.

---

## Step 3: Environment Variables

### Create `.env` File

Copy `.env.example` to `.env` (if exists), or create new `.env` file:

```bash
cp .env.example .env
# or
touch .env
```

### Required Environment Variables

Add these to `.env`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Application
APP_URL=http://localhost:3000
BASE_URL=http://localhost:3000
NODE_ENV=development

# Session
SESSION_SECRET=your-random-secret-key-here

# Optional: AI Features
OPENAI_API_KEY=sk-... (optional, for AI email features)

# Optional: Payments
MOLLIE_API_KEY=test_... (optional, for payment testing)

# Optional: Other Integrations
KVK_API_KEY=... (optional, for business verification)
GOOGLE_ADS_CLIENT_ID=... (optional, for Google Ads)
GOOGLE_ADS_CLIENT_SECRET=... (optional)
GOOGLE_ADS_REFRESH_TOKEN=... (optional)
```

### Where to Get Values

1. **Supabase:**
   - Go to Supabase Dashboard → Project Settings → API
   - Copy `URL` and `service_role` key (keep secret!)

2. **Session Secret:**
   - Generate random string: `openssl rand -hex 32`

3. **Other APIs:**
   - See setup guides in root: `OPENAI_SETUP.md`, `MOLLIE_SETUP.md`, etc.

---

## Step 4: Database Setup

### Option A: Use Supabase Cloud (Recommended)

1. Create Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run migrations in order:
   ```bash
   # Check supabase/migrations/ directory
   # Run migrations chronologically (by filename)
   ```
4. Or use Supabase CLI:
   ```bash
   supabase db push
   ```

### Option B: Local Supabase (Advanced)

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Link to project (if using cloud)
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

---

## Step 5: Start Development Server

```bash
npm run dev
```

**Expected output:**
```
🚀 Server.js starting...
✅ dotenv loaded
✅ express loaded
...
Server running on http://localhost:3000
```

**If errors:**
- Check `.env` file exists and has correct values
- Check Supabase connection (test URL and keys)
- Check Node.js version: `node --version` (should be 18+)

---

## Step 6: Verify Setup

### Test Authentication
1. Open browser: `http://localhost:3000`
2. Try to sign up (creates test user)
3. Check Supabase Dashboard → Auth → Users (should see new user)

### Test Database Connection
```bash
# In Supabase Dashboard → SQL Editor, run:
SELECT COUNT(*) FROM profiles;
```

### Test API
```bash
# In terminal:
curl http://localhost:3000/api/profiles
# Should return JSON (empty array if no users, or error if not authenticated)
```

---

## Common Issues

### Issue: "Cannot find module"
**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: "Supabase connection error"
**Solution:**
- Check `.env` file has correct `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Test connection in Supabase Dashboard
- Check if Supabase project is active (not paused)

### Issue: "Port 3000 already in use"
**Solution:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port:
PORT=3001 npm run dev
```

### Issue: "Migration errors"
**Solution:**
- Check migration files are in correct order
- Run migrations one by one in Supabase SQL Editor
- Check for syntax errors in SQL

---

## Development Workflow

### Hot Reload
- Server auto-restarts on file changes (nodemon)
- No need to manually restart

### Database Changes
1. Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
2. Test locally
3. Run migration: `supabase db push` or via SQL Editor

### Testing
```bash
# Run signup test
npm run test:signup

# Or run custom test scripts
node scripts/test-[name].js
```

---

## Next Steps

- **Read:** `/docs/00-context/project_snapshot.md` for project overview
- **Explore:** `/docs/03-flows/user_flows.md` for user journeys
- **API:** `/docs/02-api/endpoints.md` for API documentation

---

## Related Documentation

- **Deployment:** `/docs/05-runbooks/deploy.md`
- **Troubleshooting:** `/docs/05-runbooks/troubleshooting.md`
- **Architecture:** `/docs/00-context/architecture.md`

