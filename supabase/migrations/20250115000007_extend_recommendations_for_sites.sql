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
  
  -- If no default site exists, create it
  IF default_site_id IS NULL THEN
    INSERT INTO public.sites (name, domain, theme_key, positioning, is_active)
    VALUES ('Main Platform', 'example.com', 'main', 'Professional and reliable lead generation platform', TRUE)
    RETURNING id INTO default_site_id;
  END IF;
  
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

