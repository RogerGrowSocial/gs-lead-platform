-- =====================================================
-- PARTNER MARKETING SYSTEM - Database Schema
-- =====================================================
-- Migration: 20250115000003_partner_marketing.sql
-- Doel: Partner marketing profiel, segment koppeling, LP's en campagnes
-- =====================================================

-- =====================================================
-- 1. PARTNER MARKETING PROFIEL (ALTER profiles)
-- =====================================================

ALTER TABLE public.profiles
  -- Marketing mode: hoe wil deze partner leads/marketing doen?
  -- 'leads_only': alleen leads kopen via platform
  -- 'hybrid': leads + eigen marketing via platform
  -- 'full_marketing': volledig eigen marketing (toekomstig)
  ADD COLUMN IF NOT EXISTS marketing_mode TEXT DEFAULT 'leads_only' 
    CHECK (marketing_mode IN ('leads_only', 'hybrid', 'full_marketing')),
  
  -- Auto marketing: mag AI automatisch marketing-acties uitvoeren?
  ADD COLUMN IF NOT EXISTS auto_marketing_enabled BOOLEAN DEFAULT FALSE,
  
  -- Maandelijks marketing budget (in EUR)
  ADD COLUMN IF NOT EXISTS monthly_marketing_budget NUMERIC(10,2),
  
  -- Voorkeur kanalen voor marketing (array)
  -- Mogelijke waarden: 'google_ads', 'meta_ads', 'seo', 'email', etc.
  ADD COLUMN IF NOT EXISTS preferred_channels TEXT[] DEFAULT '{}',
  
  -- Branding (optioneel)
  ADD COLUMN IF NOT EXISTS brand_color TEXT, -- Hex color code (bijv. '#FF5733')
  ADD COLUMN IF NOT EXISTS logo_url TEXT, -- URL naar logo image
  
  -- Tone of voice (kort tekstveld voor AI-content generatie)
  ADD COLUMN IF NOT EXISTS tone_of_voice TEXT; -- Bijv. "professioneel maar vriendelijk"

-- Index voor snelle filtering op marketing mode
CREATE INDEX IF NOT EXISTS idx_profiles_marketing_mode 
  ON public.profiles (marketing_mode) 
  WHERE marketing_mode != 'leads_only';

CREATE INDEX IF NOT EXISTS idx_profiles_auto_marketing 
  ON public.profiles (auto_marketing_enabled) 
  WHERE auto_marketing_enabled = TRUE;

-- =====================================================
-- 2. PARTNER SEGMENTS KOPPELTABEL
-- =====================================================

CREATE TABLE IF NOT EXISTS public.partner_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Partner referentie (FK naar profiles)
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Segment referentie (FK naar lead_segments)
  segment_id UUID NOT NULL REFERENCES public.lead_segments(id) ON DELETE CASCADE,
  
  -- Is dit het primaire segment voor deze partner?
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Prioriteit voor dit segment (bij meerdere segmenten)
  -- Lagere nummer = hogere prioriteit
  priority INTEGER DEFAULT 100,
  
  -- Status: actief/inactief voor dit segment
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Target leads per week (optioneel, voor gap berekening)
  target_leads_per_week NUMERIC(10,2),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: één actieve koppeling per partner+segment
  CONSTRAINT unique_partner_segment UNIQUE (partner_id, segment_id)
);

-- Indexen voor snelle queries
CREATE INDEX IF NOT EXISTS idx_partner_segments_partner_id 
  ON public.partner_segments (partner_id) 
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_partner_segments_segment_id 
  ON public.partner_segments (segment_id) 
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_partner_segments_primary 
  ON public.partner_segments (partner_id, is_primary) 
  WHERE is_primary = TRUE AND is_active = TRUE;

-- =====================================================
-- 3. PARTNER LANDINGSPAGINA'S
-- =====================================================

CREATE TABLE IF NOT EXISTS public.partner_landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Partner referentie (FK naar profiles)
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Segment referentie (FK naar lead_segments)
  segment_id UUID REFERENCES public.lead_segments(id) ON DELETE SET NULL,
  
  -- URL path/slug (bijv. '/partners/jansen-schilderwerken/tilburg')
  path TEXT NOT NULL,
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'concept' 
    CHECK (status IN ('concept', 'review', 'live', 'archived')),
  
  -- Source: wie/wat heeft deze LP gemaakt?
  source TEXT NOT NULL DEFAULT 'ai_generated' 
    CHECK (source IN ('ai_generated', 'manual', 'template')),
  
  -- Content velden
  title TEXT NOT NULL,
  subtitle TEXT,
  seo_title TEXT,
  seo_description TEXT,
  
  -- Gestructureerde content (JSONB)
  content_json JSONB DEFAULT '{}',
  
  -- Performance tracking
  views_count INTEGER DEFAULT 0,
  conversions_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Indexen
CREATE INDEX IF NOT EXISTS idx_partner_landing_pages_partner_id 
  ON public.partner_landing_pages (partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_landing_pages_segment_id 
  ON public.partner_landing_pages (segment_id) 
  WHERE segment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_landing_pages_status 
  ON public.partner_landing_pages (status) 
  WHERE status = 'live';

CREATE INDEX IF NOT EXISTS idx_partner_landing_pages_path 
  ON public.partner_landing_pages (path);

-- Unique constraint: één unieke path per partner
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_landing_pages_unique_path 
  ON public.partner_landing_pages (partner_id, path);

-- =====================================================
-- 4. PARTNER MARKETING CAMPAGNES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.partner_marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Partner referentie (FK naar profiles)
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Segment referentie (FK naar lead_segments)
  segment_id UUID REFERENCES public.lead_segments(id) ON DELETE SET NULL,
  
  -- Kanaal
  channel TEXT NOT NULL 
    CHECK (channel IN ('google_ads', 'meta_ads', 'linkedin_ads', 'seo', 'email', 'other')),
  
  -- Externe campagne ID
  external_campaign_id TEXT,
  
  -- Status workflow
  status TEXT NOT NULL DEFAULT 'planned' 
    CHECK (status IN ('planned', 'active', 'paused', 'archived')),
  
  -- Budget en targets
  daily_budget NUMERIC(10,2),
  monthly_budget NUMERIC(10,2),
  cpl_target NUMERIC(10,2),
  
  -- AI management
  ai_managed BOOLEAN NOT NULL DEFAULT TRUE,
  ai_last_adjusted_at TIMESTAMPTZ,
  
  -- Performance tracking
  total_spend NUMERIC(10,2) DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_leads INTEGER DEFAULT 0,
  avg_cpl NUMERIC(10,2),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- Indexen
CREATE INDEX IF NOT EXISTS idx_partner_marketing_campaigns_partner_id 
  ON public.partner_marketing_campaigns (partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_marketing_campaigns_segment_id 
  ON public.partner_marketing_campaigns (segment_id) 
  WHERE segment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_marketing_campaigns_channel 
  ON public.partner_marketing_campaigns (channel, status) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_partner_marketing_campaigns_ai_managed 
  ON public.partner_marketing_campaigns (partner_id, ai_managed) 
  WHERE ai_managed = TRUE AND status = 'active';

-- Unique constraint: één externe campagne ID per kanaal
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_marketing_campaigns_unique_external 
  ON public.partner_marketing_campaigns (channel, external_campaign_id) 
  WHERE external_campaign_id IS NOT NULL;

-- =====================================================
-- 5. PARTNER LEAD GAPS
-- =====================================================
-- Tracken van lead gaps per partner per segment per dag

CREATE TABLE IF NOT EXISTS public.partner_lead_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.lead_segments(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Targets en actuals
  target_leads_per_day NUMERIC(10,2),
  current_leads_per_day NUMERIC(10,2),
  lead_gap NUMERIC(10,2), -- target - current
  
  -- Breakdown per source
  platform_leads INTEGER DEFAULT 0,
  own_campaign_leads INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(partner_id, segment_id, date)
);

-- Indexen
CREATE INDEX IF NOT EXISTS idx_partner_lead_gaps_partner_id 
  ON public.partner_lead_gaps (partner_id, date);

CREATE INDEX IF NOT EXISTS idx_partner_lead_gaps_segment_id 
  ON public.partner_lead_gaps (segment_id, date);

CREATE INDEX IF NOT EXISTS idx_partner_lead_gaps_date 
  ON public.partner_lead_gaps (date);

-- =====================================================
-- 6. AI MARKETING RECOMMENDATIONS (Optioneel)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_marketing_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.lead_segments(id) ON DELETE SET NULL,
  
  -- Actie type
  action_type TEXT NOT NULL, -- 'create_landing_page', 'create_campaign', 'increase_budget', etc.
  
  -- Actie details (JSONB voor flexibiliteit)
  action_details JSONB NOT NULL,
  
  -- Prioriteit en status
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'executed'
  
  -- Reden/context
  reason TEXT,
  lead_gap NUMERIC(10,2),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  executed_at TIMESTAMPTZ
);

-- Indexen
CREATE INDEX IF NOT EXISTS idx_ai_marketing_recommendations_partner_id 
  ON public.ai_marketing_recommendations (partner_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_marketing_recommendations_status 
  ON public.ai_marketing_recommendations (status) 
  WHERE status = 'pending';

-- =====================================================
-- 7. HELPER FUNCTIONS
-- =====================================================

-- Functie: Update updated_at timestamp (als nog niet bestaat)
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

-- Triggers voor updated_at
DROP TRIGGER IF EXISTS update_partner_segments_updated_at ON public.partner_segments;
CREATE TRIGGER update_partner_segments_updated_at
  BEFORE UPDATE ON public.partner_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_partner_landing_pages_updated_at ON public.partner_landing_pages;
CREATE TRIGGER update_partner_landing_pages_updated_at
  BEFORE UPDATE ON public.partner_landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_partner_marketing_campaigns_updated_at ON public.partner_marketing_campaigns;
CREATE TRIGGER update_partner_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.partner_marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS op nieuwe tabellen
ALTER TABLE public.partner_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_lead_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_marketing_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies voor partner_segments
DROP POLICY IF EXISTS "Partners can view own segments" ON public.partner_segments;
CREATE POLICY "Partners can view own segments"
  ON public.partner_segments FOR SELECT
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Partners can insert own segments" ON public.partner_segments;
CREATE POLICY "Partners can insert own segments"
  ON public.partner_segments FOR INSERT
  WITH CHECK (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Partners can update own segments" ON public.partner_segments;
CREATE POLICY "Partners can update own segments"
  ON public.partner_segments FOR UPDATE
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- RLS Policies voor partner_landing_pages
DROP POLICY IF EXISTS "Partners can view own landing pages" ON public.partner_landing_pages;
CREATE POLICY "Partners can view own landing pages"
  ON public.partner_landing_pages FOR SELECT
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Partners can manage own landing pages" ON public.partner_landing_pages;
CREATE POLICY "Partners can manage own landing pages"
  ON public.partner_landing_pages FOR ALL
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- RLS Policies voor partner_marketing_campaigns
DROP POLICY IF EXISTS "Partners can view own campaigns" ON public.partner_marketing_campaigns;
CREATE POLICY "Partners can view own campaigns"
  ON public.partner_marketing_campaigns FOR SELECT
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Partners can manage own campaigns" ON public.partner_marketing_campaigns;
CREATE POLICY "Partners can manage own campaigns"
  ON public.partner_marketing_campaigns FOR ALL
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- RLS Policies voor partner_lead_gaps
DROP POLICY IF EXISTS "Partners can view own lead gaps" ON public.partner_lead_gaps;
CREATE POLICY "Partners can view own lead gaps"
  ON public.partner_lead_gaps FOR SELECT
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- RLS Policies voor ai_marketing_recommendations
DROP POLICY IF EXISTS "Partners can view own recommendations" ON public.ai_marketing_recommendations;
CREATE POLICY "Partners can view own recommendations"
  ON public.ai_marketing_recommendations FOR SELECT
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "Partners can update own recommendations" ON public.ai_marketing_recommendations;
CREATE POLICY "Partners can update own recommendations"
  ON public.ai_marketing_recommendations FOR UPDATE
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

