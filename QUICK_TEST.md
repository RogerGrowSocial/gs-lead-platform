# Quick Test Guide - 5 Minute Test

## 🚀 Fastest Way to Test Everything

### Step 1: Run Migration (1 min)

In Supabase SQL Editor, run:
```sql
-- Copy and paste the entire file:
-- sql/20251205_campaign_data_linkage_and_performance.sql
```

### Step 2: Test Campaign Cockpit UI (30 sec)

1. **Start your server** (if not running):
   ```bash
   npm start
   ```

2. **Open browser:**
   ```
   http://localhost:3000/internal/campaigns?days=7
   ```

3. **Expected:** You should see a table with campaigns (or empty state if no campaigns exist yet)

### Step 3: Test Data Linkage (2 min)

1. **Check if you have any campaigns:**
   ```sql
   SELECT id, name, google_ads_campaign_id 
   FROM lead_segments 
   WHERE google_ads_campaign_id IS NOT NULL 
   LIMIT 5;
   ```

2. **If you have campaigns, check a lead:**
   ```sql
   SELECT id, name, email, google_ads_campaign_id, gclid
   FROM leads 
   WHERE google_ads_campaign_id IS NOT NULL 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

3. **If no campaigns yet:** Create one via AI recommendations page

### Step 4: Test Performance Import (1 min)

**In browser or terminal:**
```
http://localhost:3000/internal/google-ads/performance/import?from=2025-12-01&to=2025-12-05
```

**Check response:** Should return JSON with `success: true` and `imported: X`

**Verify in database:**
```sql
SELECT COUNT(*) as imported_records 
FROM campaign_performance;
```

### Step 5: Test Optimization (30 sec)

```
http://localhost:3000/internal/google-ads/optimize?days=7
```

**Check response:** Should return JSON with `suggestions: X`

**View suggestions:**
```sql
SELECT suggested_change_type, reason, cpl_eur, target_cpl_eur
FROM campaign_optimization_suggestions
ORDER BY created_at DESC
LIMIT 5;
```

---

## ✅ All Tests Passed?

If all 5 steps work, you're good to go! 🎉

For detailed testing, see: `TESTING_GUIDE.md`

