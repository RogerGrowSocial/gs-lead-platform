# Troubleshooting Guide

**Last Updated:** 2025-01-28

---

## Common Issues

### Server Won't Start

#### Error: "Cannot find module"
**Symptoms:** `Error: Cannot find module 'express'` or similar

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Error: "Port already in use"
**Symptoms:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

#### Error: "ECANCELED" (macOS/Node.js 22)
**Symptoms:** Module loading fails with ECANCELED error

**Solution:**
- Server.js already has retry logic for this
- If persists, restart terminal/IDE
- Check disk space: `df -h`

---

### Database Connection Issues

#### Error: "Invalid API key"
**Symptoms:** Supabase connection fails

**Solution:**
1. Check `.env` file has correct values:
   ```bash
   cat .env | grep SUPABASE
   ```
2. Verify in Supabase Dashboard → Settings → API
3. Check if project is paused (unpause if needed)

#### Error: "RLS policy violation"
**Symptoms:** Queries fail with permission error

**Solution:**
1. Check RLS policies in Supabase Dashboard
2. Verify user is authenticated: `auth.uid() IS NOT NULL`
3. Use service role for admin operations: `supabaseAdmin`

#### Error: "Relation does not exist"
**Symptoms:** Table not found error

**Solution:**
1. Check if migrations ran: `SELECT * FROM pg_tables WHERE schemaname = 'public';`
2. Run missing migrations
3. Check migration file names are correct format

---

### Authentication Issues

#### Error: "Hook requires authorization token"
**Symptoms:** 500 error on signup/login

**Solution:**
1. **Disable Auth Hook in Supabase Dashboard:**
   - Go to Authentication → Hooks
   - Disable any enabled hooks
2. **Verify trigger exists:**
   ```sql
   -- In Supabase SQL Editor
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```
3. **Run migration if missing:**
   - `supabase/migrations/20250909215240_profiles_trigger.sql`

#### Error: "Session not found"
**Symptoms:** User logged out unexpectedly

**Solution:**
1. Check `SESSION_SECRET` in `.env`
2. Clear browser cookies
3. Check session store configuration in `server.js`

---

### Lead Assignment Issues

#### Error: "No candidates found"
**Symptoms:** AI router can't assign lead

**Possible Causes:**
1. **No partners with capacity:**
   ```sql
   SELECT * FROM get_branch_region_capacity_combos();
   ```
2. **No active payment methods:**
   ```sql
   SELECT * FROM payment_methods WHERE status = 'active';
   ```
3. **Segment doesn't exist:**
   ```sql
   SELECT * FROM lead_segments WHERE is_active = true;
   ```

**Solution:**
- Create segment if missing
- Ensure partners have active payment methods
- Check partner capacity settings

#### Error: "Quota reached"
**Symptoms:** Lead assignment fails with quota error

**Solution:**
1. Check user quota:
   ```sql
   SELECT get_billing_snapshot('user-uuid');
   ```
2. Increase quota or wait for next month
3. Check subscription: `SELECT * FROM subscriptions WHERE user_id = '...';`

---

### Payment Issues

#### Error: "Insufficient funds"
**Symptoms:** Prepaid balance too low

**Solution:**
1. Check balance:
   ```sql
   SELECT balance FROM profiles WHERE id = 'user-uuid';
   ```
2. Add funds via payment
3. Verify payment method is active

#### Error: "Mollie payment failed"
**Symptoms:** Payment creation fails

**Solution:**
1. Check Mollie API key in `.env`
2. Verify API key is for correct environment (test vs live)
3. Check Mollie dashboard for errors
4. Verify webhook URL is correct

---

### Performance Issues

#### Slow Database Queries
**Symptoms:** Pages load slowly

**Solution:**
1. **Check indexes:**
   ```sql
   -- Find missing indexes
   SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;
   ```
2. **Check query performance:**
   ```sql
   EXPLAIN ANALYZE SELECT ...;
   ```
3. **Refresh materialized views:**
   ```sql
   REFRESH MATERIALIZED VIEW partner_performance_stats;
   ```

#### High Memory Usage
**Symptoms:** Server crashes or slows down

**Solution:**
1. Check for memory leaks (long-running processes)
2. Restart server periodically
3. Monitor with: `pm2 monit` or similar

---

### AI Features Not Working

#### Error: "OpenAI API error"
**Symptoms:** AI email labeling/response fails

**Solution:**
1. Check `OPENAI_API_KEY` in `.env`
2. Verify API key is valid and has credits
3. Check API rate limits
4. System falls back to keyword-based labeling if OpenAI fails

---

## Debugging Tools

### Check Logs

#### Server Logs
```bash
# If using PM2
pm2 logs gs-lead-platform

# If using Docker
docker logs gs-lead-platform

# If using nodemon (dev)
# Logs appear in terminal
```

#### Supabase Logs
1. Go to Supabase Dashboard
2. Navigate to Logs → Postgres Logs
3. Filter by error level

#### System Logs (Database)
```sql
-- View system logs
SELECT * FROM system_logs 
ORDER BY created_at DESC 
LIMIT 100;
```

### Database Queries for Debugging

#### Check User Status
```sql
SELECT 
  id, email, company_name, 
  is_admin, status, 
  max_open_leads, balance
FROM profiles 
WHERE id = 'user-uuid';
```

#### Check Lead Status
```sql
SELECT 
  id, name, email, status, 
  user_id, industry_id,
  created_at, accepted_at
FROM leads 
WHERE id = 'lead-uuid';
```

#### Check Capacity
```sql
SELECT * FROM get_segment_capacity('segment-uuid');
SELECT * FROM get_branch_region_capacity_combos();
```

#### Check Billing
```sql
SELECT * FROM get_billing_snapshot('user-uuid');
SELECT * FROM v_monthly_lead_usage WHERE user_id = 'user-uuid';
```

---

## Getting Help

### Check Documentation
1. **Project Snapshot:** `/docs/00-context/project_snapshot.md`
2. **Architecture:** `/docs/00-context/architecture.md`
3. **API:** `/docs/02-api/endpoints.md`

### Check Existing Issues
- Search codebase for similar error messages
- Check migration files for schema changes
- Review recent commits for changes

### Create Issue Report
Include:
- Error message (full stack trace if available)
- Steps to reproduce
- Environment (local/production)
- Relevant logs
- Database queries (if applicable)

---

## Related Documentation

- **Local Setup:** `/docs/05-runbooks/local_setup.md`
- **Deployment:** `/docs/05-runbooks/deploy.md`
- **Architecture:** `/docs/00-context/architecture.md`

