# PHASE 2: Database Design & Migrations (PROPOSAL)
## Multi-Site AI Landing Page Engine

**Status:** ⏳ PROPOSAL - Awaiting Approval  
**Date:** January 2025

---

## 📋 Overview

This document contains **proposed SQL migrations** for Phase 2. These migrations will:
1. Create the `sites` table
2. Extend `partner_landing_pages` for multi-site support
3. Extend `leads` for landing page tracking
4. Extend `ai_marketing_recommendations` for site support
5. Backfill existing data
6. Update RLS policies

**⚠️ IMPORTANT:** These are **PROPOSALS**. They will NOT be applied until you reply with "go".

---

## 🗂️ Migration Files Structure

We will create **4 migration files** (in order):

1. `20250115000004_add_sites_table.sql` - New sites table + default site
2. `20250115000005_extend_landing_pages_for_multi_site.sql` - LP extensions
3. `20250115000006_extend_leads_for_lp_tracking.sql` - Leads extensions
4. `20250115000007_extend_recommendations_for_sites.sql` - Recommendations extensions

---

## 📄 Migration 1: Add Sites Table

**File:** `supabase/migrations/20250115000004_add_sites_table.sql`

```sql
-- =====================================================
-- MULTI-SITE SUPPORT - Sites Table
-- =====================================================
-- Migration: 20250115000004_add_sites_table.sql
-- Doel: Ondersteuning voor meerdere domeinen/brands
-- =====================================================

-- =====================================================
-- 1. SITES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Site identificatie
  name TEXT NOT NULL,  -- e.g., "Main Platform", "Spoed.nl", "DuurzaamSchilders.nl"
  domain TEXT NOT NULL UNIQUE,  -- e.g., "growsocialmedia.nl", "spoed.nl"
  
  -- Theming & positioning
  theme_key TEXT NOT NULL DEFAULT 'main',  -- e.g., 'main', 'spoed', 'duurzaam'
  positioning TEXT,  -- AI copy hints: "fast/spoed", "sustainable", "premium"
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexen
CREATE INDEX IF NOT EXISTS idx_sites_domain 
  ON public.sites (domain);

CREATE INDEX IF NOT EXISTS idx_sites_active 
  ON public.sites (is_active) 
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_sites_theme_key 
  ON public.sites (theme_key);

-- =====================================================
-- 2. DEFAULT SITE CREATION
-- =====================================================

-- Create default "Main Platform" site
-- Domain will be placeholder 'example.com' if PRIMARY_SITE_DOMAIN env var not available
-- Admin can update this manually after migration
INSERT INTO public.sites (name, domain, theme_key, positioning, is_active)
VALUES (
  'Main Platform',
  COALESCE(
    current_setting('app.primary_site_domain', true),
    'example.com'  -- Placeholder - update manually after migration
  ),
  'main',
  'Professional and reliable lead generation platform',
  TRUE
)
ON CONFLICT (domain) DO NOTHING;

-- =====================================================
-- 3. HELPER FUNCTION: Update updated_at
-- =====================================================

-- Reuse existing function if it exists, otherwise create
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Trigger voor updated_at
DROP TRIGGER IF EXISTS update_sites_updated_at ON public.sites;
CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view active sites (needed for public LP rendering)
DROP POLICY IF EXISTS "Anyone can view active sites" ON public.sites;
CREATE POLICY "Anyone can view active sites"
  ON public.sites FOR SELECT
  USING (is_active = TRUE);

-- Policy: Only admins can manage sites
DROP POLICY IF EXISTS "Admins can manage sites" ON public.sites;
CREATE POLICY "Admins can manage sites"
  ON public.sites FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- =====================================================
-- END OF MIGRATION
-- =====================================================
```

**Notes:**
- Default site domain uses PostgreSQL `current_setting()` to read from env/config
- Falls back to `'example.com'` placeholder if not set
- Admin can update domain manually after migration
- RLS allows public read for active sites (needed for LP rendering)

---

## 📄 Migration 2: Extend Landing Pages for Multi-Site

**File:** `supabase/migrations/20250115000005_extend_landing_pages_for_multi_site.sql`

```sql
-- =====================================================
-- MULTI-SITE SUPPORT - Landing Pages Extensions
-- =====================================================
-- Migration: 20250115000005_extend_landing_pages_for_multi_site.sql
-- Doel: Platform-first landing pages met site support
-- =====================================================

-- =====================================================
-- 1. MAKE partner_id OPTIONAL (Legacy Support)
-- =====================================================

-- First, drop the NOT NULL constraint
ALTER TABLE public.partner_landing_pages
  ALTER COLUMN partner_id DROP NOT NULL;

-- Update constraint to allow NULL
-- Note: Foreign key constraint remains, but now allows NULL values

-- =====================================================
-- 2. ADD NEW COLUMNS
-- =====================================================

-- Add site_id (will be NOT NULL after backfill)
ALTER TABLE public.partner_landing_pages
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE;

-- Add page_type
ALTER TABLE public.partner_landing_pages
  ADD COLUMN IF NOT EXISTS page_type TEXT DEFAULT 'main'
    CHECK (page_type IN ('main', 'cost', 'quote', 'spoed', 'service_variant', 'info'));

-- Add parent_page_id (for clusters)
ALTER TABLE public.partner_landing_pages
  ADD COLUMN IF NOT EXISTS parent_page_id UUID REFERENCES public.partner_landing_pages(id) ON DELETE SET NULL;

-- Add source_type
ALTER TABLE public.partner_landing_pages
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'platform'
    CHECK (source_type IN ('platform', 'partner_exclusive'));

-- =====================================================
-- 3. BACKFILL EXISTING DATA
-- =====================================================

-- Get default site ID
DO $$
DECLARE
  default_site_id UUID;
BEGIN
  -- Get the default "Main Platform" site
  SELECT id INTO default_site_id
  FROM public.sites
  WHERE name = 'Main Platform'
  LIMIT 1;
  
  -- If no default site exists, create it
  IF default_site_id IS NULL THEN
    INSERT INTO public.sites (name, domain, theme_key, positioning, is_active)
    VALUES ('Main Platform', 'example.com', 'main', 'Professional and reliable lead generation platform', TRUE)
    RETURNING id INTO default_site_id;
  END IF;
  
  -- Backfill all existing landing pages
  UPDATE public.partner_landing_pages
  SET 
    site_id = default_site_id,
    page_type = 'main',
    source_type = 'platform'
  WHERE site_id IS NULL;
  
  RAISE NOTICE 'Backfilled % landing pages with default site', (SELECT COUNT(*) FROM public.partner_landing_pages WHERE site_id = default_site_id);
END $$;

-- =====================================================
-- 4. MAKE site_id NOT NULL (After Backfill)
-- =====================================================

-- Now that all rows have site_id, make it NOT NULL
ALTER TABLE public.partner_landing_pages
  ALTER COLUMN site_id SET NOT NULL;

-- =====================================================
-- 5. UPDATE UNIQUENESS CONSTRAINTS
-- =====================================================

-- Drop old unique constraint (partner_id, path)
DROP INDEX IF EXISTS idx_partner_landing_pages_unique_path;

-- Create new unique constraint: path is unique per site
CREATE UNIQUE INDEX idx_partner_landing_pages_unique_path 
  ON public.partner_landing_pages (site_id, path) 
  WHERE site_id IS NOT NULL;

-- Optional: One main page per site+segment (enforces cluster structure)
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_landing_pages_unique_main 
  ON public.partner_landing_pages (site_id, segment_id, page_type) 
  WHERE page_type = 'main' 
    AND site_id IS NOT NULL 
    AND segment_id IS NOT NULL;

-- =====================================================
-- 6. NEW INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_partner_landing_pages_site_id 
  ON public.partner_landing_pages (site_id);

CREATE INDEX IF NOT EXISTS idx_partner_landing_pages_page_type 
  ON public.partner_landing_pages (page_type);

CREATE INDEX IF NOT EXISTS idx_partner_landing_pages_parent 
  ON public.partner_landing_pages (parent_page_id) 
  WHERE parent_page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_landing_pages_source_type 
  ON public.partner_landing_pages (source_type);

-- Composite index for cluster queries (site + segment + page_type)
CREATE INDEX IF NOT EXISTS idx_partner_landing_pages_cluster 
  ON public.partner_landing_pages (site_id, segment_id, page_type, status)
  WHERE status IN ('live', 'concept', 'review');

-- =====================================================
-- 7. UPDATE RLS POLICIES
-- =====================================================

-- Drop old partner-centric policies
DROP POLICY IF EXISTS "Partners can view own landing pages" ON public.partner_landing_pages;
DROP POLICY IF EXISTS "Partners can manage own landing pages" ON public.partner_landing_pages;

-- New policy: Platform LPs (partner_id IS NULL) are viewable by everyone (for public rendering)
-- Legacy LPs (partner_id IS NOT NULL) follow old rules
CREATE POLICY "Public can view platform landing pages"
  ON public.partner_landing_pages FOR SELECT
  USING (
    (partner_id IS NULL AND status = 'live')  -- Platform LPs: public if live
    OR 
    (partner_id = auth.uid())  -- Legacy: partners can view own
    OR 
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Admins can view all
  );

-- Policy: Only admins can manage platform LPs (partner_id IS NULL)
CREATE POLICY "Admins can manage platform landing pages"
  ON public.partner_landing_pages FOR ALL
  USING (
    (partner_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    OR
    (partner_id = auth.uid())  -- Legacy: partners can manage own
    OR
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Admins can manage all
  )
  WITH CHECK (
    (partner_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
    OR
    (partner_id = auth.uid())  -- Legacy: partners can manage own
    OR
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Admins can manage all
  );

-- =====================================================
-- END OF MIGRATION
-- =====================================================
```

**Notes:**
- `partner_id` becomes nullable (legacy support)
- `site_id` added, backfilled with default site, then made NOT NULL
- New uniqueness: `(site_id, path)` instead of `(partner_id, path)`
- Optional uniqueness: one main page per `(site_id, segment_id)`
- RLS updated: platform LPs (partner_id NULL) are public if live, legacy LPs keep old rules

---

## 📄 Migration 3: Extend Leads for LP Tracking

**File:** `supabase/migrations/20250115000006_extend_leads_for_lp_tracking.sql`

```sql
-- =====================================================
-- MULTI-SITE SUPPORT - Leads Extensions
-- =====================================================
-- Migration: 20250115000006_extend_leads_for_lp_tracking.sql
-- Doel: Track welke landing page een lead heeft gegenereerd
-- =====================================================

-- =====================================================
-- 1. ADD NEW COLUMNS
-- =====================================================

-- Add landing_page_id (tracks which LP generated this lead)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS landing_page_id UUID REFERENCES public.partner_landing_pages(id) ON DELETE SET NULL;

-- Add source_type (platform vs partner_exclusive)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'platform'
    CHECK (source_type IN ('platform', 'partner_exclusive'));

-- Add routing_mode (how was this lead routed?)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS routing_mode TEXT
    CHECK (routing_mode IN ('ai_segment_routing', 'direct_partner'));

-- =====================================================
-- 2. BACKFILL EXISTING DATA
-- =====================================================

-- Existing leads: set defaults
UPDATE public.leads
SET 
  source_type = 'platform',
  routing_mode = NULL  -- Historic leads: unknown routing mode
WHERE source_type IS NULL;

-- =====================================================
-- 3. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_leads_landing_page_id 
  ON public.leads (landing_page_id)
  WHERE landing_page_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_source_type 
  ON public.leads (source_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_routing_mode 
  ON public.leads (routing_mode, created_at DESC)
  WHERE routing_mode IS NOT NULL;

-- Composite index for analytics (landing_page + source_type + routing_mode)
CREATE INDEX IF NOT EXISTS idx_leads_lp_analytics 
  ON public.leads (landing_page_id, source_type, routing_mode, created_at DESC)
  WHERE landing_page_id IS NOT NULL;

-- =====================================================
-- END OF MIGRATION
-- =====================================================
```

**Notes:**
- `landing_page_id` nullable (historic leads won't have it)
- `source_type` defaults to 'platform' for existing leads
- `routing_mode` nullable (historic leads unknown)
- Indexes optimized for analytics queries

---

## 📄 Migration 4: Extend Recommendations for Sites

**File:** `supabase/migrations/20250115000007_extend_recommendations_for_sites.sql`

```sql
-- =====================================================
-- MULTI-SITE SUPPORT - Recommendations Extensions
-- =====================================================
-- Migration: 20250115000007_extend_recommendations_for_sites.sql
-- Doel: Site-aware marketing recommendations
-- =====================================================

-- =====================================================
-- 1. MAKE partner_id OPTIONAL
-- =====================================================

-- Make partner_id nullable (platform recommendations don't need partner)
ALTER TABLE public.ai_marketing_recommendations
  ALTER COLUMN partner_id DROP NOT NULL;

-- =====================================================
-- 2. ADD site_id
-- =====================================================

ALTER TABLE public.ai_marketing_recommendations
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE;

-- =====================================================
-- 3. BACKFILL EXISTING DATA
-- =====================================================

-- Get default site ID
DO $$
DECLARE
  default_site_id UUID;
BEGIN
  SELECT id INTO default_site_id
  FROM public.sites
  WHERE name = 'Main Platform'
  LIMIT 1;
  
  -- Backfill existing recommendations with default site
  UPDATE public.ai_marketing_recommendations
  SET site_id = default_site_id
  WHERE site_id IS NULL;
  
  RAISE NOTICE 'Backfilled % recommendations with default site', (SELECT COUNT(*) FROM public.ai_marketing_recommendations WHERE site_id = default_site_id);
END $$;

-- =====================================================
-- 4. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ai_marketing_recommendations_site_id 
  ON public.ai_marketing_recommendations (site_id, status);

-- Composite index for site+segment queries
CREATE INDEX IF NOT EXISTS idx_ai_marketing_recommendations_site_segment 
  ON public.ai_marketing_recommendations (site_id, segment_id, status, priority)
  WHERE status = 'pending';

-- =====================================================
-- 5. UPDATE RLS POLICIES
-- =====================================================

-- Drop old partner-centric policies
DROP POLICY IF EXISTS "Partners can view own recommendations" ON public.ai_marketing_recommendations;
DROP POLICY IF EXISTS "Partners can update own recommendations" ON public.ai_marketing_recommendations;

-- New policy: Platform recommendations (partner_id IS NULL) are admin-only
-- Legacy recommendations (partner_id IS NOT NULL) follow old rules
CREATE POLICY "View recommendations"
  ON public.ai_marketing_recommendations FOR SELECT
  USING (
    (partner_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Platform: admin only
    OR
    (partner_id = auth.uid())  -- Legacy: partners can view own
    OR
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Admins can view all
  );

CREATE POLICY "Update recommendations"
  ON public.ai_marketing_recommendations FOR UPDATE
  USING (
    (partner_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Platform: admin only
    OR
    (partner_id = auth.uid())  -- Legacy: partners can update own
    OR
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Admins can update all
  )
  WITH CHECK (
    (partner_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Platform: admin only
    OR
    (partner_id = auth.uid())  -- Legacy: partners can update own
    OR
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Admins can update all
  );

-- =====================================================
-- END OF MIGRATION
-- =====================================================
```

**Notes:**
- `partner_id` becomes nullable (platform recommendations don't need partner)
- `site_id` added and backfilled
- RLS updated: platform recommendations (partner_id NULL) are admin-only, legacy recommendations keep old rules

---

## 🔄 Backfill Strategy Summary

### Sites Table
- ✅ Create default "Main Platform" site
- ✅ Domain: Uses `current_setting('app.primary_site_domain')` or falls back to `'example.com'`
- ✅ Admin can update domain manually after migration

### Landing Pages
- ✅ All existing `partner_landing_pages` get:
  - `site_id = default_site.id`
  - `page_type = 'main'`
  - `source_type = 'platform'`
  - `partner_id` remains (legacy, not used in new flow)

### Leads
- ✅ All existing `leads` get:
  - `landing_page_id = NULL` (historic, unknown)
  - `source_type = 'platform'`
  - `routing_mode = NULL` (historic, unknown)

### Recommendations
- ✅ All existing `ai_marketing_recommendations` get:
  - `site_id = default_site.id`
  - `partner_id` remains (legacy support)

---

## ⚠️ Important Notes

### 1. Domain Configuration
- Migration uses PostgreSQL `current_setting('app.primary_site_domain')` to read from env
- If not set, uses placeholder `'example.com'`
- **Action required:** Admin must update domain manually after migration:
  ```sql
  UPDATE sites SET domain = 'growsocialmedia.nl' WHERE name = 'Main Platform';
  ```

### 2. Constraint Changes
- **Breaking change:** Uniqueness changes from `(partner_id, path)` to `(site_id, path)`
- This means: same path can now exist for different partners (if they have different sites)
- For platform LPs: path is unique per site (as intended)

### 3. RLS Policy Updates
- Platform LPs (`partner_id IS NULL`): Public can view if `status = 'live'`
- Legacy LPs (`partner_id IS NOT NULL`): Keep old partner-scoped rules
- Only admins can create/manage platform LPs

### 4. Data Integrity
- All backfills use `DO $$` blocks to ensure atomicity
- Foreign keys ensure referential integrity
- Existing data is preserved (no data loss)

---

## 📊 Migration Order & Dependencies

```
Migration 1: sites table
    ↓
Migration 2: landing_pages (depends on sites)
    ↓
Migration 3: leads (depends on landing_pages)
    ↓
Migration 4: recommendations (depends on sites)
```

**Execution order is critical** - migrations must run in sequence.

---

## ✅ Validation Queries (After Migration)

Run these queries to verify the migrations:

```sql
-- 1. Check sites table
SELECT * FROM sites;

-- 2. Check landing pages backfill
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE site_id IS NOT NULL) as with_site,
  COUNT(*) FILTER (WHERE page_type = 'main') as main_pages,
  COUNT(*) FILTER (WHERE source_type = 'platform') as platform_pages,
  COUNT(*) FILTER (WHERE partner_id IS NULL) as platform_only
FROM partner_landing_pages;

-- 3. Check leads backfill
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE source_type = 'platform') as platform_leads,
  COUNT(*) FILTER (WHERE landing_page_id IS NOT NULL) as with_lp
FROM leads;

-- 4. Check recommendations backfill
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE site_id IS NOT NULL) as with_site,
  COUNT(*) FILTER (WHERE partner_id IS NULL) as platform_only
FROM ai_marketing_recommendations;
```

---

## 🛡️ Guardrails Enforced

### Database Level
- ✅ Unique constraint: `(site_id, path)` prevents duplicate paths per site
- ✅ Optional unique: `(site_id, segment_id, page_type = 'main')` enforces one main page per cluster
- ✅ Foreign keys ensure referential integrity
- ✅ CHECK constraints enforce valid enum values

### Application Level (Phase 3)
- ✅ `MAX_SITES = 10` (constant in code)
- ✅ `MAX_PAGES_PER_CLUSTER = 6 (constant in code)
- ✅ `MIN_GAP_FOR_NEW_PAGE = 3` (configurable constant)

---

## 📝 Next Steps (After Approval)

1. Generate actual migration files in `supabase/migrations/`
2. Test migrations in development environment
3. Verify backfill data
4. Proceed to Phase 3 (Services & Routing Logic)

---

**Phase 2 migrations are designed. Reply 'go' to generate/apply them, or give adjustments.**

