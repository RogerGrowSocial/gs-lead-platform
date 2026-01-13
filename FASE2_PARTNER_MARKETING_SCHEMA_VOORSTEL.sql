-- =====================================================
-- FASE 2: PARTNER MARKETING SCHEMA VOORSTEL
-- =====================================================
-- BELANGRIJK: Dit zijn ALLEEN voorstellen
-- Ik maak nog geen migrations aan en voer ze nog niet uit
-- =====================================================

-- =====================================================
-- 2.1. PARTNER MARKETING PROFIEL
-- =====================================================
-- Uitbreiding van profiles tabel met marketing-gerelateerde velden
-- Doel: Partners kunnen eigen marketingprofiel configureren

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
-- 2.2. PARTNER SEGMENTS KOPPELTABEL
-- =====================================================
-- Expliciete koppeling tussen partners en segmenten
-- Doel: Weet precies in welke segmenten een partner actief is

CREATE TABLE IF NOT EXISTS public.partner_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Partner referentie (FK naar profiles)
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Segment referentie (FK naar lead_segments)
  segment_id UUID NOT NULL REFERENCES public.lead_segments(id) ON DELETE CASCADE,
  
  -- Is dit het primaire segment voor deze partner?
  -- Een partner kan meerdere segmenten hebben, maar 1 primair
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Prioriteit voor dit segment (bij meerdere segmenten)
  -- Lagere nummer = hogere prioriteit
  priority INTEGER DEFAULT 100,
  
  -- Status: actief/inactief voor dit segment
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
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
-- 2.3. PARTNER LANDINGSPAGINA'S
-- =====================================================
-- Tabel voor partner-specifieke landingspagina's
-- Doel: Partners kunnen eigen (of co-branded) LP's hebben per segment

CREATE TABLE IF NOT EXISTS public.partner_landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Partner referentie (FK naar profiles)
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Segment referentie (FK naar lead_segments)
  -- Optioneel: LP kan segment-specifiek zijn, of generiek
  segment_id UUID REFERENCES public.lead_segments(id) ON DELETE SET NULL,
  
  -- URL path/slug (bijv. '/partners/jansen-schilderwerken/tilburg')
  path TEXT NOT NULL,
  
  -- Status workflow
  -- 'concept': nog in ontwikkeling
  -- 'review': klaar voor review
  -- 'live': actief en live
  -- 'archived': niet meer actief
  status TEXT NOT NULL DEFAULT 'concept' 
    CHECK (status IN ('concept', 'review', 'live', 'archived')),
  
  -- Source: wie/wat heeft deze LP gemaakt?
  -- 'ai_generated': door AI gegenereerd
  -- 'manual': handmatig aangemaakt
  -- 'template': van template
  source TEXT NOT NULL DEFAULT 'ai_generated' 
    CHECK (source IN ('ai_generated', 'manual', 'template')),
  
  -- Content velden
  title TEXT NOT NULL, -- H1 titel
  subtitle TEXT, -- Subtitle/lead text
  seo_title TEXT, -- SEO meta title
  seo_description TEXT, -- SEO meta description
  
  -- Gestructureerde content (JSONB)
  -- Bevat blokken zoals: hero, features, testimonials, CTA, etc.
  content_json JSONB DEFAULT '{}',
  
  -- Performance tracking (optioneel)
  views_count INTEGER DEFAULT 0,
  conversions_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ -- Wanneer is deze LP live gegaan?
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
-- 2.4. PARTNER MARKETING CAMPAGNES
-- =====================================================
-- Tabel voor partner marketing campagnes (Google Ads, Meta Ads, etc.)
-- Doel: Tracken van partner campagnes en AI-gestuurde budget aanpassingen

CREATE TABLE IF NOT EXISTS public.partner_marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Partner referentie (FK naar profiles)
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Segment referentie (FK naar lead_segments)
  -- Optioneel: campagne kan segment-specifiek zijn, of generiek
  segment_id UUID REFERENCES public.lead_segments(id) ON DELETE SET NULL,
  
  -- Kanaal (bijv. 'google_ads', 'meta_ads', 'linkedin_ads')
  channel TEXT NOT NULL 
    CHECK (channel IN ('google_ads', 'meta_ads', 'linkedin_ads', 'seo', 'email', 'other')),
  
  -- Externe campagne ID (van Google Ads API, Meta API, etc.)
  external_campaign_id TEXT,
  
  -- Status workflow
  -- 'planned': gepland maar nog niet actief
  -- 'active': actief en draaiend
  -- 'paused': tijdelijk gepauzeerd
  -- 'archived': niet meer actief
  status TEXT NOT NULL DEFAULT 'planned' 
    CHECK (status IN ('planned', 'active', 'paused', 'archived')),
  
  -- Budget en targets
  daily_budget NUMERIC(10,2), -- Dagelijks budget in EUR
  monthly_budget NUMERIC(10,2), -- Maandelijks budget in EUR (optioneel)
  cpl_target NUMERIC(10,2), -- Target Cost Per Lead in EUR
  
  -- AI management
  ai_managed BOOLEAN NOT NULL DEFAULT TRUE, -- Wordt deze campagne door AI beheerd?
  ai_last_adjusted_at TIMESTAMPTZ, -- Laatste AI-aanpassing
  
  -- Performance tracking (optioneel, kan ook uit externe API komen)
  total_spend NUMERIC(10,2) DEFAULT 0, -- Totale spend tot nu toe
  total_clicks INTEGER DEFAULT 0,
  total_impressions INTEGER DEFAULT 0,
  total_leads INTEGER DEFAULT 0, -- Leads gegenereerd door deze campagne
  avg_cpl NUMERIC(10,2), -- Gemiddelde CPL (calculated)
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ, -- Wanneer is campagne gestart?
  ended_at TIMESTAMPTZ -- Wanneer is campagne beëindigd?
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

-- Unique constraint: één externe campagne ID per kanaal (als opgegeven)
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_marketing_campaigns_unique_external 
  ON public.partner_marketing_campaigns (channel, external_campaign_id) 
  WHERE external_campaign_id IS NOT NULL;

-- =====================================================
-- 2.5. HELPER FUNCTIONS (Optioneel, voor later)
-- =====================================================
-- Functies voor automatische updates en berekeningen

-- Functie: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers voor updated_at
CREATE TRIGGER update_partner_segments_updated_at
  BEFORE UPDATE ON public.partner_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partner_landing_pages_updated_at
  BEFORE UPDATE ON public.partner_landing_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partner_marketing_campaigns_updated_at
  BEFORE UPDATE ON public.partner_marketing_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2.6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Beveiliging: partners kunnen alleen hun eigen data zien/bewerken

-- Enable RLS op nieuwe tabellen
ALTER TABLE public.partner_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_marketing_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies voor partner_segments
CREATE POLICY "Partners can view own segments"
  ON public.partner_segments FOR SELECT
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Partners can insert own segments"
  ON public.partner_segments FOR INSERT
  WITH CHECK (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Partners can update own segments"
  ON public.partner_segments FOR UPDATE
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- RLS Policies voor partner_landing_pages
CREATE POLICY "Partners can view own landing pages"
  ON public.partner_landing_pages FOR SELECT
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

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
CREATE POLICY "Partners can view own campaigns"
  ON public.partner_marketing_campaigns FOR SELECT
  USING (
    partner_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

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

