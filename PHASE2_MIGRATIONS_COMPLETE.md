# PHASE 2: Migrations Complete ✅

**Status:** ✅ Migrations Generated  
**Date:** January 2025

---

## 📄 Generated Migration Files

### 1. `20250115000004_add_sites_table.sql`
- ✅ Creates `sites` table
- ✅ Creates default "Main Platform" site with placeholder domain `'example.com'`
- ✅ RLS: Public can view active sites, admins can manage
- ✅ Indexes: domain, is_active, theme_key

### 2. `20250115000005_extend_landing_pages_for_multi_site.sql`
- ✅ Makes `partner_id` nullable (legacy support)
- ✅ Adds `site_id` (NOT NULL after backfill)
- ✅ Adds `page_type` (main, cost, quote, spoed, service_variant, info)
- ✅ Adds `parent_page_id` (for clusters)
- ✅ Adds `source_type` (platform, partner_exclusive)
- ✅ Updates uniqueness: `(site_id, path)` instead of `(partner_id, path)`
- ✅ Backfills all existing LPs with default site + page_type='main'
- ✅ RLS: Platform LPs (partner_id NULL) are public if live, legacy LPs keep old rules

### 3. `20250115000006_extend_leads_for_lp_tracking.sql`
- ✅ Adds `landing_page_id` (FK to partner_landing_pages)
- ✅ Adds `source_type` (platform, partner_exclusive)
- ✅ Adds `routing_mode` (ai_segment_routing, direct_partner)
- ✅ Backfills existing leads with source_type='platform'
- ✅ Indexes for analytics queries

### 4. `20250115000007_extend_recommendations_for_sites.sql`
- ✅ Makes `partner_id` nullable (platform recommendations don't need partner)
- ✅ Adds `site_id` (FK to sites)
- ✅ Backfills existing recommendations with default site
- ✅ RLS: Platform recommendations (partner_id NULL) are admin-only, legacy keep old rules

---

## ✅ Key Constraints Implemented

### 1. Platform-First Landing Pages
- ✅ `partner_id` is now **NULLABLE**
- ✅ All new platform LPs will have `partner_id = NULL`
- ✅ Uniqueness changed to `(site_id, path)` - no longer partner-scoped
- ✅ RLS clearly distinguishes platform (partner_id NULL) vs legacy (partner_id NOT NULL)

### 2. No Company Names in URLs
- ⚠️ **Note:** Path validation will be implemented in Phase 3 (service layer)
- Migration doesn't enforce this (would require complex regex/validation)
- Will be enforced in `PartnerLandingPageService.createLandingPage()` in Phase 3

### 3. RLS Policies
- ✅ Platform LPs (`partner_id IS NULL`): Public SELECT if `status = 'live'`
- ✅ Legacy LPs (`partner_id IS NOT NULL`): Partner-scoped (old behavior)
- ✅ Platform recommendations: Admin-only
- ✅ Legacy recommendations: Partner-scoped (old behavior)

---

## 🔍 Validation Queries

Run these queries after applying migrations to verify:

```sql
-- 1. Check sites table
SELECT 
  id,
  name,
  domain,
  theme_key,
  is_active,
  created_at
FROM sites
ORDER BY created_at;

-- Expected: 1 row with name='Main Platform', domain='example.com'

-- 2. Check landing pages backfill
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE site_id IS NOT NULL) as with_site,
  COUNT(*) FILTER (WHERE page_type = 'main') as main_pages,
  COUNT(*) FILTER (WHERE source_type = 'platform') as platform_pages,
  COUNT(*) FILTER (WHERE partner_id IS NULL) as platform_only,
  COUNT(*) FILTER (WHERE partner_id IS NOT NULL) as legacy
FROM partner_landing_pages;

-- Expected: 
-- - with_site = total (all have site_id)
-- - main_pages = total (all backfilled to 'main')
-- - platform_pages = total (all backfilled to 'platform')
-- - platform_only = 0 (existing LPs have partner_id from legacy)
-- - legacy = total (existing LPs are legacy)

-- 3. Check leads backfill
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE source_type = 'platform') as platform_leads,
  COUNT(*) FILTER (WHERE landing_page_id IS NOT NULL) as with_lp,
  COUNT(*) FILTER (WHERE routing_mode IS NOT NULL) as with_routing_mode
FROM leads;

-- Expected:
-- - platform_leads = total (all backfilled)
-- - with_lp = 0 (historic leads don't have LP)
-- - with_routing_mode = 0 (historic leads unknown)

-- 4. Check recommendations backfill
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE site_id IS NOT NULL) as with_site,
  COUNT(*) FILTER (WHERE partner_id IS NULL) as platform_only,
  COUNT(*) FILTER (WHERE partner_id IS NOT NULL) as legacy
FROM ai_marketing_recommendations;

-- Expected:
-- - with_site = total (all have site_id)
-- - platform_only = 0 (existing recommendations have partner_id from legacy)
-- - legacy = total (existing recommendations are legacy)

-- 5. Check constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.partner_landing_pages'::regclass
  AND conname LIKE '%path%' OR conname LIKE '%main%'
ORDER BY conname;

-- Expected: 
-- - idx_partner_landing_pages_unique_path (site_id, path)
-- - idx_partner_landing_pages_unique_main (site_id, segment_id, page_type) WHERE page_type='main'

-- 6. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('sites', 'partner_landing_pages', 'ai_marketing_recommendations')
ORDER BY tablename, policyname;

-- Expected: Policies for platform vs legacy distinction
```

---

## 📋 Next Steps

### Immediate Actions Required:
1. **Update default site domain:**
   ```sql
   UPDATE sites SET domain = 'growsocialmedia.nl' WHERE name = 'Main Platform';
   ```

### Phase 3 Preparation:
- Services need to be updated to work with `site_id + segment_id + page_type`
- Path validation helper needed (no company names in URLs)
- Orchestrator needs to iterate over sites+segments, not partners

---

**Phase 2 migrations complete. Ready to proceed to Phase 3 (Services & Routing Logic).**

