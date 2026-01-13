-- =====================================================
-- MULTI-SITE SUPPORT - Landing Pages Extensions
-- =====================================================
-- Migration: 20250115000005_extend_landing_pages_for_multi_site.sql
-- Doel: Platform-first landing pages met site support
-- =====================================================
-- BELANGRIJK: 
-- - partner_id wordt NULLABLE (legacy support)
-- - Nieuwe platform LPs hebben partner_id = NULL
-- - Alle nieuwe logica werkt met site_id + segment_id + page_type
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

-- New policy: Platform LPs (partner_id IS NULL) are viewable by everyone if live
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
-- Legacy LPs (partner_id IS NOT NULL) can be managed by their partner
CREATE POLICY "Admins can manage platform landing pages"
  ON public.partner_landing_pages FOR ALL
  USING (
    (partner_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Platform: admin only
    OR
    (partner_id = auth.uid())  -- Legacy: partners can manage own
    OR
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Admins can manage all
  )
  WITH CHECK (
    (partner_id IS NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Platform: admin only
    OR
    (partner_id = auth.uid())  -- Legacy: partners can manage own
    OR
    (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))  -- Admins can manage all
  );

-- =====================================================
-- END OF MIGRATION
-- =====================================================

