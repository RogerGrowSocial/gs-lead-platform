# Testing Guide - Campaign Next-Level Implementation

## Prerequisites

1. **Run the migration first:**
   ```sql
   -- In Supabase SQL Editor, run:
   -- sql/20251205_campaign_data_linkage_and_performance.sql
   ```

2. **Set environment variables** (if not already set):
   ```bash
   # In .env file
   GOOGLE_ADS_CUSTOMER_ID=your-customer-id
   INTERNAL_DASHBOARD_TOKEN=test-token-123  # For production access
   GOOGLE_ADS_OPTIMIZATION_ENABLED=false   # Start with suggestions only
   ```

3. **Restart your server** to load new routes and cron jobs:
   ```bash
   npm start
   ```

---

## Test 1: Data Linkage (Campaign → Segment → Landing Page → Lead)

### Step 1.1: Create a Campaign

1. Go to your AI recommendations page (e.g., `/admin/leads/engine/ai-actions`)
2. Approve a campaign recommendation (or create one manually)
3. The campaign should be created in Google Ads with status `ENABLED`

### Step 1.2: Verify Segment Linkage

```sql
-- Check that segment has campaign ID
SELECT 
  id, 
  name, 
  branch, 
  region, 
  google_ads_campaign_id,
  google_ads_campaign_name,
  google_ads_customer_id,
  google_ads_last_synced_at
FROM lead_segments
WHERE google_ads_campaign_id IS NOT NULL
ORDER BY google_ads_last_synced_at DESC
LIMIT 5;
```

**Expected:** You should see the campaign ID, name, and customer ID populated.

### Step 1.3: Verify Landing Page Linkage

```sql
-- Check that landing page has campaign ID
SELECT 
  id,
  title,
  segment_id,
  google_ads_campaign_id,
  updated_at
FROM partner_landing_pages
WHERE google_ads_campaign_id IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;
```

**Expected:** Landing pages linked to segments with campaigns should have `google_ads_campaign_id` set.

### Step 1.4: Test Lead Creation with Campaign ID

1. **Get a landing page URL** that has a campaign ID:
   ```sql
   SELECT id, path, google_ads_campaign_id 
   FROM partner_landing_pages 
   WHERE google_ads_campaign_id IS NOT NULL 
   LIMIT 1;
   ```

2. **Visit the landing page** with Google Ads parameters:
   ```
   http://localhost:3000/[landing-page-slug]?gclid=test123&gbraid=test456
   ```

3. **Submit a test lead** via the form on the landing page

4. **Verify the lead has campaign ID**:
   ```sql
   SELECT 
     id,
     name,
     email,
     google_ads_campaign_id,
     gclid,
     gbraid,
     wbraid,
     source,
     landing_page_id,
     created_at
   FROM leads
   WHERE google_ads_campaign_id IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 5;
   ```

   **Expected:** 
   - `google_ads_campaign_id` should be set
   - `gclid`, `gbraid` should be captured
   - `source` should be `'google_ads'`

5. **Verify conversion record**:
   ```sql
   SELECT 
     id,
     lead_id,
     google_ads_campaign_id,
     event_type,
     gclid,
     gbraid,
     wbraid
   FROM lead_conversions
   WHERE google_ads_campaign_id IS NOT NULL
   ORDER BY occurred_at DESC
   LIMIT 5;
   ```

   **Expected:** Conversion should have the same `google_ads_campaign_id` as the lead.

---

## Test 2: Performance Import

### Step 2.1: Manual Import (Recommended for Testing)

```bash
# Replace YOUR_TOKEN with your INTERNAL_DASHBOARD_TOKEN or omit in dev
curl "http://localhost:3000/internal/google-ads/performance/import?from=2025-12-01&to=2025-12-05&token=YOUR_TOKEN"
```

**Or use browser:**
```
http://localhost:3000/internal/google-ads/performance/import?from=2025-12-01&to=2025-12-05
```

**Expected Response:**
```json
{
  "success": true,
  "imported": 15,
  "dateRange": {
    "from": "2025-12-01",
    "to": "2025-12-05"
  },
  "campaignsProcessed": 3
}
```

### Step 2.2: Verify Imported Data

```sql
-- Check imported performance data
SELECT 
  google_ads_campaign_id,
  date,
  clicks,
  impressions,
  cost_micros / 1000000.0 as cost_eur,
  conversions,
  conv_value,
  segment_id
FROM campaign_performance
ORDER BY date DESC, google_ads_campaign_id
LIMIT 20;
```

**Expected:** You should see performance metrics for each campaign per day.

### Step 2.3: Check Segment Mapping

```sql
-- Verify campaigns are mapped to segments
SELECT 
  cp.google_ads_campaign_id,
  cp.date,
  cp.clicks,
  cp.cost_micros / 1000000.0 as cost_eur,
  ls.name as segment_name,
  ls.branch,
  ls.region
FROM campaign_performance cp
LEFT JOIN lead_segments ls ON cp.segment_id = ls.id
ORDER BY cp.date DESC
LIMIT 10;
```

**Expected:** Most campaigns should have a `segment_id` mapped.

---

## Test 3: Campaign Optimization

### Step 3.1: Set Target CPL on a Segment

```sql
-- Set target CPL for a segment (adjust segment ID)
UPDATE lead_segments
SET 
  target_cpl_eur = 25.0,
  min_daily_budget_eur = 10.0,
  max_daily_budget_eur = 100.0
WHERE id = 'your-segment-id-here';
```

### Step 3.2: Run Optimization (Suggestions Mode)

```bash
# Since GOOGLE_ADS_OPTIMIZATION_ENABLED=false, this will only create suggestions
curl "http://localhost:3000/internal/google-ads/optimize?days=7&token=YOUR_TOKEN"
```

**Or use browser:**
```
http://localhost:3000/internal/google-ads/optimize?days=7
```

**Expected Response:**
```json
{
  "success": true,
  "optimized": 0,
  "suggestions": 2,
  "mode": "suggestions_only"
}
```

### Step 3.3: Check Optimization Suggestions

```sql
-- View optimization suggestions
SELECT 
  id,
  segment_id,
  google_ads_campaign_id,
  suggested_change_type,
  suggested_new_budget_micros / 1000000.0 as suggested_budget_eur,
  current_budget_micros / 1000000.0 as current_budget_eur,
  cpl_eur,
  target_cpl_eur,
  leads_count,
  reason,
  applied,
  created_at
FROM campaign_optimization_suggestions
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** You should see suggestions like:
- `BUDGET_INCREASE` if CPL < 0.7 × target
- `BUDGET_DECREASE` if CPL > 1.3 × target
- `NO_CHANGE` if within range or insufficient data

### Step 3.4: Test Auto-Apply (Optional - Be Careful!)

**⚠️ Only test this if you want to actually change budgets in Google Ads!**

1. **Set environment variable:**
   ```bash
   GOOGLE_ADS_OPTIMIZATION_ENABLED=true
   ```

2. **Restart server**

3. **Run optimization again:**
   ```bash
   curl "http://localhost:3000/internal/google-ads/optimize?days=7"
   ```

4. **Check Google Ads UI** to verify budgets were actually updated

5. **Set back to false** when done testing:
   ```bash
   GOOGLE_ADS_OPTIMIZATION_ENABLED=false
   ```

---

## Test 4: Campaign Cockpit UI

### Step 4.1: Access the Dashboard

**Development:**
```
http://localhost:3000/internal/campaigns?days=7
```

**Production (requires token):**
```
https://yourdomain.com/internal/campaigns?days=7&token=YOUR_SECRET_TOKEN
```

### Step 4.2: Verify Dashboard Shows Data

**Expected:**
- Table with all segments that have Google Ads campaigns
- Columns:
  - Segment name, branch, region
  - Campaign ID (link to Google Ads)
  - Budget constraints and target CPL
  - Performance metrics (impressions, clicks, cost, leads, CPC, CPL)
  - Status tags (OK/Warn/Error based on CPL vs target)
  - Last campaign log status
  - "Technisch" link for inspection

### Step 4.3: Test Different Date Ranges

```
http://localhost:3000/internal/campaigns?days=7
http://localhost:3000/internal/campaigns?days=30
```

**Expected:** Metrics should aggregate over the selected date range.

### Step 4.4: Test Technical Inspection Link

1. Click "Technisch" link for any campaign
2. Should navigate to: `/api/internal/google-ads/campaign/[ID]/inspect?customerId=...`
3. **Expected Response:**
   ```json
   {
     "success": true,
     "data": {
       "campaign": {
         "id": "123456789",
         "name": "Campaign Name",
         "networkSettings": {
           "targetGoogleSearch": true,
           "targetSearchNetwork": true,
           "targetSearchPartner": false,
           "targetContentNetwork": false
         },
         "geoTargetTypeSetting": {
           "positiveGeoTargetType": "PRESENCE",
           "negativeGeoTargetType": "PRESENCE"
         }
       },
       "locations": [
         {
           "code": "1005655",
           "name": "Noord-Brabant"
         }
       ],
       "languages": [
         {
           "code": "1010",
           "name": "Dutch"
         }
       ]
     }
   }
   ```

---

## Test 5: End-to-End Flow

### Complete Flow Test

1. **Create a campaign** via AI recommendations
   - ✅ Campaign created in Google Ads
   - ✅ Segment has `google_ads_campaign_id`
   - ✅ Landing page has `google_ads_campaign_id` (if exists)

2. **Wait for performance data** (or import manually)
   - ✅ Run manual import for last 7 days
   - ✅ Check `campaign_performance` table has data

3. **Submit a lead** via landing page with `?gclid=test123`
   - ✅ Lead has `google_ads_campaign_id`
   - ✅ Conversion record created with campaign ID

4. **View Campaign Cockpit**
   - ✅ Dashboard shows campaign with performance
   - ✅ CPL calculated correctly
   - ✅ Status tag shows OK/Warn/Error

5. **Run optimization**
   - ✅ Suggestions created (or budgets updated if enabled)
   - ✅ Suggestions visible in `campaign_optimization_suggestions`

---

## Troubleshooting

### Issue: Campaign ID not set on segment

**Check:**
```sql
-- Verify campaign_logs entry exists
SELECT * FROM campaign_logs 
WHERE segment_id = 'your-segment-id'
ORDER BY created_at DESC LIMIT 1;
```

**Fix:** Campaign creation might have failed. Check server logs for errors.

### Issue: Performance import returns 0 records

**Possible causes:**
1. No campaigns exist in Google Ads for the date range
2. Campaigns are `REMOVED` status
3. API query syntax issue

**Debug:**
- Check Google Ads UI to verify campaigns exist
- Verify `GOOGLE_ADS_CUSTOMER_ID` is correct
- Check server logs for API errors

### Issue: Campaign Cockpit shows no data

**Check:**
1. Do segments have `google_ads_campaign_id`?
   ```sql
   SELECT COUNT(*) FROM lead_segments WHERE google_ads_campaign_id IS NOT NULL;
   ```

2. Is performance data imported?
   ```sql
   SELECT COUNT(*) FROM campaign_performance;
   ```

### Issue: Optimization returns no suggestions

**Check:**
1. Do campaigns have performance data?
2. Do segments have `target_cpl_eur` set?
3. Are there enough leads? (default minimum is 5)

**Debug query:**
```sql
-- Check if optimization would have data
SELECT 
  ls.id as segment_id,
  ls.name,
  ls.target_cpl_eur,
  COUNT(DISTINCT cp.date) as days_with_data,
  SUM(cp.clicks) as total_clicks,
  SUM(cp.cost_micros) / 1000000.0 as total_cost_eur,
  COUNT(DISTINCT l.id) as leads_count
FROM lead_segments ls
LEFT JOIN campaign_performance cp ON cp.segment_id = ls.id AND cp.date >= CURRENT_DATE - INTERVAL '7 days'
LEFT JOIN leads l ON l.google_ads_campaign_id = ls.google_ads_campaign_id AND l.created_at >= CURRENT_DATE - INTERVAL '7 days'
WHERE ls.google_ads_campaign_id IS NOT NULL
GROUP BY ls.id, ls.name, ls.target_cpl_eur
HAVING COUNT(DISTINCT cp.date) > 0;
```

---

## Quick Test Checklist

- [ ] Migration run successfully
- [ ] Campaign created → segment has campaign ID
- [ ] Landing page has campaign ID (if exists)
- [ ] Lead submitted → lead has campaign ID
- [ ] Conversion record has campaign ID
- [ ] Performance import works (manual)
- [ ] Performance data visible in `campaign_performance`
- [ ] Campaign Cockpit shows campaigns
- [ ] Optimization creates suggestions
- [ ] Suggestions visible in `campaign_optimization_suggestions`
- [ ] Technical inspection link works

---

## Next Steps After Testing

1. **Enable daily performance import** (cron runs automatically at 02:00 AM)
2. **Set target CPLs** on segments that matter
3. **Review optimization suggestions** regularly
4. **Enable auto-apply** when you're confident (set `GOOGLE_ADS_OPTIMIZATION_ENABLED=true`)
5. **Monitor Campaign Cockpit** daily for campaign health

---

## Support

If you encounter issues:
1. Check server logs for detailed error messages
2. Verify environment variables are set correctly
3. Check database tables for expected data
4. Review the implementation docs: `CAMPAIGN_NEXT_LEVEL_IMPLEMENTATION.md`
