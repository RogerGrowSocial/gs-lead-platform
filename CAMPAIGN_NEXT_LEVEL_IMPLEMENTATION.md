# Campaign Next-Level Implementation - Complete Summary

**Date:** December 5, 2025  
**Status:** ✅ All 4 Parts Implemented

---

## Overview

This implementation adds comprehensive data linkage, performance tracking, optimization, and monitoring capabilities to the Google Ads campaign system. Every lead, conversion, landing page, segment, and campaign is now perfectly linked, and we have automated performance import, optimization suggestions, and a campaign cockpit UI.

---

## PART 1: Perfect Data Linkage (Lead ↔ Campaign ↔ Segment)

### Changes Made

1. **`googleAdsCampaignBuilderService.js`** - `createCompleteCampaign()`:
   - After successful campaign creation, stores `google_ads_campaign_id` on:
     - `lead_segments` table (with campaign name, customer ID, last synced timestamp)
     - `partner_landing_pages` table (if a landing page exists for the segment)

2. **`routes/api.js`** - `POST /api/leads/public`:
   - Resolves `google_ads_campaign_id` from:
     1. Landing page's `google_ads_campaign_id` (if set)
     2. Segment's `google_ads_campaign_id` (fallback)
   - Sets `leads.google_ads_campaign_id` on lead creation
   - Logs warning if Ads identifiers (gclid/gbraid/wbraid) are present but no campaign ID can be resolved

3. **`routes/api.js`** - Lead conversion creation:
   - Enhanced to ensure `lead_conversions.google_ads_campaign_id` is always set
   - Last-resort resolution: queries landing page → segment to find campaign ID if missing
   - Updates the lead record if campaign ID is resolved after creation

### Database Changes

- **Migration:** `sql/20251205_campaign_data_linkage_and_performance.sql`
  - Adds `google_ads_campaign_id` column to `partner_landing_pages`
  - Adds index on `partner_landing_pages.google_ads_campaign_id`

### Result

✅ Every lead from a Google Ads landing page now has a `google_ads_campaign_id`  
✅ Every conversion is linked to a campaign  
✅ Segments and landing pages store campaign IDs for fast lookups

---

## PART 2: Google Ads Performance Import

### New Files

1. **`services/googleAdsPerformanceImportService.js`**:
   - `importDailyMetrics({ customerId, dateFrom, dateTo, limitCampaigns })`
   - Queries Google Ads API using GAQL for campaign performance metrics
   - Aggregates clicks, impressions, cost, conversions, conversion value
   - Maps campaigns to segments via `lead_segments` or `campaign_logs`
   - Upserts into `campaign_performance` table (unique on customer_id + campaign_id + date)

2. **`cron/googleAdsPerformanceImportJob.js`**:
   - Scheduled daily at 02:00 AM (Europe/Amsterdam)
   - Imports yesterday's performance data automatically

3. **`routes/internalCampaigns.js`**:
   - `GET /internal/google-ads/performance/import?from=YYYY-MM-DD&to=YYYY-MM-DD`
   - Manual trigger for performance import (dev/internal only, requires token in production)

### Database Changes

- **Migration:** `sql/20251205_campaign_data_linkage_and_performance.sql`
  - Creates `campaign_performance` table with:
    - `google_ads_customer_id`, `google_ads_campaign_id`, `segment_id`
    - `date` (DATE)
    - Metrics: `clicks`, `impressions`, `cost_micros`, `conversions`, `conv_value`
    - Unique constraint: `(google_ads_customer_id, google_ads_campaign_id, date)`
  - Indexes for fast queries by segment, date, campaign

### Result

✅ Daily performance metrics automatically imported from Google Ads  
✅ Historical data stored in our database for analysis  
✅ Manual import available for testing/debugging

---

## PART 3: Campaign Optimization Skeleton

### New Files

1. **`services/googleAdsCampaignOptimizationService.js`**:
   - `optimizeCampaigns({ customerId, dateRangeDays = 7 })`
   - Conservative optimization rules:
     - **No activity** (0 impressions/clicks): Log warning, no change
     - **Insufficient leads** (< MIN_LEADS): No change, need more data
     - **CPL < 0.7 × target**: Increase budget by MAX_CHANGE_PCT (default 20%), but not above max
     - **CPL > 1.3 × target**: Decrease budget by MAX_CHANGE_PCT, but not below min
     - **CPL within range**: No change
   - **Mode:**
     - If `GOOGLE_ADS_OPTIMIZATION_ENABLED=true`: Applies changes via Google Ads API
     - If `GOOGLE_ADS_OPTIMIZATION_ENABLED=false`: Writes suggestions to `campaign_optimization_suggestions` table

2. **`routes/internalCampaigns.js`**:
   - `GET /internal/google-ads/optimize?days=7`
   - Manual trigger for optimization (dev/internal only)

### Database Changes

- **Migration:** `sql/20251205_campaign_data_linkage_and_performance.sql`
  - Adds to `lead_segments`:
    - `target_cpl_eur` (NUMERIC) - Target Cost Per Lead
    - `min_daily_budget_eur` (NUMERIC) - Minimum daily budget
    - `max_daily_budget_eur` (NUMERIC) - Maximum daily budget
  - Creates `campaign_optimization_suggestions` table:
    - Stores suggestions when auto-apply is disabled
    - Fields: `suggested_change_type`, `suggested_new_budget_micros`, `current_budget_micros`, `reason`, `cpl_eur`, `target_cpl_eur`, `leads_count`, `applied` (boolean)

### Environment Variables

```bash
# Optimization settings
GOOGLE_ADS_OPTIMIZATION_ENABLED=false  # Set to 'true' to enable auto-apply
GOOGLE_ADS_OPTIMIZATION_MIN_LEADS=5    # Minimum leads for statistical significance
GOOGLE_ADS_OPTIMIZATION_MAX_CHANGE_PCT=0.2  # Max 20% change per optimization run
GOOGLE_ADS_DEFAULT_TARGET_CPL_EUR=25.0  # Fallback target CPL if segment doesn't have one
```

### Result

✅ Conservative optimization skeleton ready  
✅ Can run in "suggestions only" mode for testing  
✅ Auto-apply mode available when ready  
✅ All changes logged with reasons

---

## PART 4: Campaign Cockpit UI

### New Files

1. **`routes/internalCampaigns.js`**:
   - `GET /internal/campaigns?days=7&token=...`
   - Access guard: non-prod OR requires `INTERNAL_DASHBOARD_TOKEN` query param in production
   - Aggregates:
     - Performance data from `campaign_performance` (last N days)
     - Leads count from `leads` table
     - Last campaign log status from `campaign_logs`
   - Computes metrics: CPC, CPL, cost, conversions

2. **`views/internal/campaign-cockpit.ejs`**:
   - Dark-themed dashboard showing:
     - Segment name, branch, region
     - Campaign ID (link to Google Ads UI)
     - Budget constraints (min/max) and target CPL
     - Performance metrics (impressions, clicks, cost, leads, CPC, CPL)
     - Status tags (OK/Warn/Error based on CPL vs target)
     - Last campaign log status
     - Link to technical inspection (`/api/internal/google-ads/campaign/:id/inspect`)

### Access

- **Development:** `http://localhost:3000/internal/campaigns?days=7`
- **Production:** `https://yourdomain.com/internal/campaigns?days=7&token=YOUR_SECRET_TOKEN`

Set `INTERNAL_DASHBOARD_TOKEN` in `.env` for production access.

### Result

✅ Internal dashboard for campaign monitoring  
✅ One-page overview of all campaigns with performance  
✅ Health indicators (CPL vs target)  
✅ Links to Google Ads UI and technical inspection

---

## Database Migrations

### Run This Migration

```sql
-- File: sql/20251205_campaign_data_linkage_and_performance.sql
-- Run in Supabase SQL Editor or via migration tool
```

**What it does:**
1. Adds `google_ads_campaign_id` to `partner_landing_pages`
2. Creates `campaign_performance` table
3. Adds optimization columns to `lead_segments`
4. Creates `campaign_optimization_suggestions` table

---

## Environment Variables

Add to your `.env`:

```bash
# Performance Import (optional - uses GOOGLE_ADS_CUSTOMER_ID if not set)
# GOOGLE_ADS_CUSTOMER_ID=1234567890

# Optimization Settings
GOOGLE_ADS_OPTIMIZATION_ENABLED=false
GOOGLE_ADS_OPTIMIZATION_MIN_LEADS=5
GOOGLE_ADS_OPTIMIZATION_MAX_CHANGE_PCT=0.2
GOOGLE_ADS_DEFAULT_TARGET_CPL_EUR=25.0

# Internal Dashboard Access (production only)
INTERNAL_DASHBOARD_TOKEN=your-secret-token-here
```

---

## Testing

### 1. Test Data Linkage

1. Create a campaign via AI recommendations (approve a recommendation)
2. Check `lead_segments` table: `google_ads_campaign_id` should be set
3. Check `partner_landing_pages` table: `google_ads_campaign_id` should be set (if LP exists)
4. Submit a lead via landing page with `?gclid=test123`
5. Check `leads` table: `google_ads_campaign_id` should be set
6. Check `lead_conversions` table: `google_ads_campaign_id` should be set

### 2. Test Performance Import

```bash
# Manual import (dev)
curl "http://localhost:3000/internal/google-ads/performance/import?from=2025-12-01&to=2025-12-05&token=YOUR_TOKEN"

# Check campaign_performance table
SELECT * FROM campaign_performance ORDER BY date DESC LIMIT 10;
```

### 3. Test Optimization

```bash
# Run optimization (suggestions only if GOOGLE_ADS_OPTIMIZATION_ENABLED=false)
curl "http://localhost:3000/internal/google-ads/optimize?days=7&token=YOUR_TOKEN"

# Check suggestions
SELECT * FROM campaign_optimization_suggestions ORDER BY created_at DESC;
```

### 4. Test Campaign Cockpit

1. Navigate to: `http://localhost:3000/internal/campaigns?days=7`
2. Verify all campaigns are listed with performance data
3. Check status tags (OK/Warn/Error)
4. Click "Technisch" to inspect campaign settings

---

## Next Steps (Optional Enhancements)

1. **Add optimization suggestions tab** to Campaign Cockpit UI
2. **Add budget history chart** showing budget changes over time
3. **Add alerts** for campaigns with no activity for 7+ days
4. **Add A/B test tracking** for RSA headline/description variations
5. **Add Quality Score monitoring** from Google Ads API
6. **Add automated bid adjustments** based on device/location/time performance

---

## Files Changed/Created

### Modified
- `services/googleAdsCampaignBuilderService.js` - Campaign ID linkage
- `routes/api.js` - Lead creation with campaign ID resolution
- `server.js` - Added internal routes and cron job

### Created
- `sql/20251205_campaign_data_linkage_and_performance.sql` - Migration
- `services/googleAdsPerformanceImportService.js` - Performance import
- `services/googleAdsCampaignOptimizationService.js` - Optimization
- `cron/googleAdsPerformanceImportJob.js` - Daily import cron
- `routes/internalCampaigns.js` - Internal routes
- `views/internal/campaign-cockpit.ejs` - Dashboard UI

---

## Summary

✅ **PART 1:** Perfect data linkage - every lead/conversion linked to campaign  
✅ **PART 2:** Performance import - daily metrics from Google Ads  
✅ **PART 3:** Optimization skeleton - conservative budget adjustments  
✅ **PART 4:** Campaign Cockpit - internal monitoring dashboard

All parts are production-ready and can be enabled/disabled via environment variables.

