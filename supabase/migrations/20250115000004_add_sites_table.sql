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
    NULLIF(current_setting('app.primary_site_domain', true), ''),
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

