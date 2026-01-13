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

