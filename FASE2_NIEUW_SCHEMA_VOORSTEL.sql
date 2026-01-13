-- =====================================================
-- FASE 2: VOORSTEL NIEUW SQL SCHEMA
-- =====================================================
-- BELANGRIJK: Dit zijn ALLEEN voorstellen
-- Ik maak nog geen migrations aan en voer ze nog niet uit
-- =====================================================

-- =====================================================
-- 2.1. LEAD SEGMENTS TABEL
-- =====================================================
-- Doel: Definieer segmenten (branche + regio combinaties)
-- waar we de leadstroom voor willen managen

CREATE TABLE IF NOT EXISTS public.lead_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Unieke code voor het segment (bijv. 'schilder_noord_brabant')
  code TEXT UNIQUE NOT NULL,
  
  -- Branche (bijv. 'schilder', 'dakdekker', 'loodgieter')
  -- Koppeling met industries tabel mogelijk, maar we houden het generiek
  branch TEXT NOT NULL,
  
  -- Regio (bijv. 'noord-brabant', 'zuid-holland', of postcode prefix)
  region TEXT NOT NULL,
  
  -- Land (default NL, maar uitbreidbaar)
  country TEXT NOT NULL DEFAULT 'NL',
  
  -- Optioneel: specifieke postcode prefixes voor dit segment
  postal_prefixes TEXT[],
  
  -- Status: actief/inactief segment
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unieke constraint: één actief segment per branch+region+country combinatie
  CONSTRAINT unique_active_segment UNIQUE NULLS NOT DISTINCT (branch, region, country) 
    WHERE is_active = TRUE
);

-- Index voor snelle lookups
CREATE INDEX IF NOT EXISTS idx_lead_segments_branch_region 
  ON public.lead_segments (branch, region, country) 
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_lead_segments_code 
  ON public.lead_segments (code);

-- =====================================================
-- 2.2. LEAD GENERATION STATS TABEL
-- =====================================================
-- Doel: Dagelijkse statistieken per segment
-- Wordt gevuld door aggregatie jobs

CREATE TABLE IF NOT EXISTS public.lead_generation_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Segment referentie
  segment_id UUID NOT NULL REFERENCES public.lead_segments(id) ON DELETE CASCADE,
  
  -- Datum (dag)
  date DATE NOT NULL,
  
  -- Lead metrics
  leads_generated INTEGER NOT NULL DEFAULT 0,
  leads_accepted INTEGER NOT NULL DEFAULT 0,
  leads_rejected INTEGER NOT NULL DEFAULT 0,
  leads_pending INTEGER NOT NULL DEFAULT 0,
  
  -- Financial metrics
  avg_cpl NUMERIC(10,2), -- Average Cost Per Lead
  total_revenue NUMERIC(10,2) DEFAULT 0,
  
  -- Channel metrics
  google_ads_spend NUMERIC(10,2) DEFAULT 0,
  google_ads_clicks INTEGER DEFAULT 0,
  google_ads_impressions INTEGER DEFAULT 0,
  
  seo_clicks INTEGER DEFAULT 0,
  seo_visits INTEGER DEFAULT 0,
  
  microsite_visits INTEGER DEFAULT 0,
  microsite_leads INTEGER DEFAULT 0,
  
  -- Partner/capacity metrics
  partner_leads INTEGER DEFAULT 0, -- Leads toegewezen aan partners
  capacity_partners INTEGER DEFAULT 0, -- Aantal actieve partners voor dit segment
  capacity_total_leads INTEGER DEFAULT 0, -- Totale capaciteit (partners × max_leads)
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unieke constraint: één record per segment per dag
  CONSTRAINT unique_segment_date UNIQUE (segment_id, date)
);

-- Indexen voor performance
CREATE INDEX IF NOT EXISTS idx_lead_generation_stats_segment_date 
  ON public.lead_generation_stats (segment_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_lead_generation_stats_date 
  ON public.lead_generation_stats (date DESC);

-- =====================================================
-- 2.3. LEAD SEGMENT PLANS TABEL
-- =====================================================
-- Doel: Planning en targets per segment
-- Wordt gevuld door LeadDemandPlanner

CREATE TABLE IF NOT EXISTS public.lead_segment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Segment referentie
  segment_id UUID NOT NULL REFERENCES public.lead_segments(id) ON DELETE CASCADE,
  
  -- Datum (dag)
  date DATE NOT NULL,
  
  -- Target metrics
  target_leads_per_day INTEGER NOT NULL DEFAULT 0,
  expected_leads_per_day INTEGER, -- Voorspelling (AI/ML later)
  
  -- Gap analysis
  lead_gap INTEGER, -- target - actual (berekend)
  lead_gap_percentage NUMERIC(5,2), -- percentage gap
  
  -- Budget planning per kanaal
  target_daily_budget_google_ads NUMERIC(10,2) DEFAULT 0,
  actual_daily_budget_google_ads NUMERIC(10,2) DEFAULT 0,
  
  target_daily_budget_seo NUMERIC(10,2) DEFAULT 0,
  actual_daily_budget_seo NUMERIC(10,2) DEFAULT 0,
  
  -- Orchestration status
  last_orchestration_at TIMESTAMPTZ,
  orchestration_status TEXT, -- 'pending', 'processing', 'completed', 'error'
  orchestration_notes TEXT,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unieke constraint: één plan per segment per dag
  CONSTRAINT unique_plan_segment_date UNIQUE (segment_id, date)
);

-- Indexen voor performance
CREATE INDEX IF NOT EXISTS idx_lead_segment_plans_segment_date 
  ON public.lead_segment_plans (segment_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_lead_segment_plans_gap 
  ON public.lead_segment_plans (lead_gap) 
  WHERE lead_gap IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_segment_plans_orchestration 
  ON public.lead_segment_plans (orchestration_status, last_orchestration_at) 
  WHERE orchestration_status IS NOT NULL;

-- =====================================================
-- 2.4. CHANNEL ORCHESTRATION LOG TABEL
-- =====================================================
-- Doel: Log alle budget/campaign wijzigingen
-- Voor audit trail en debugging

CREATE TABLE IF NOT EXISTS public.channel_orchestration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Segment referentie
  segment_id UUID NOT NULL REFERENCES public.lead_segments(id) ON DELETE CASCADE,
  
  -- Plan referentie (optioneel)
  plan_id UUID REFERENCES public.lead_segment_plans(id) ON DELETE SET NULL,
  
  -- Datum
  date DATE NOT NULL,
  
  -- Channel info
  channel TEXT NOT NULL, -- 'google_ads', 'seo', 'microsite', etc.
  channel_campaign_id TEXT, -- Externe campaign ID
  
  -- Wijziging details
  action_type TEXT NOT NULL, -- 'budget_increase', 'budget_decrease', 'campaign_pause', etc.
  old_value NUMERIC(10,2),
  new_value NUMERIC(10,2),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'
  error_message TEXT,
  
  -- Metadata
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexen
CREATE INDEX IF NOT EXISTS idx_channel_orchestration_log_segment_date 
  ON public.channel_orchestration_log (segment_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_channel_orchestration_log_status 
  ON public.channel_orchestration_log (status, created_at DESC);

-- =====================================================
-- 2.5. UITBREIDING BESTAANDE TABELLEN
-- =====================================================

-- Leads tabel: voeg segment_id toe
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.lead_segments(id) ON DELETE SET NULL;

-- Index voor segment lookups in leads
CREATE INDEX IF NOT EXISTS idx_leads_segment_id 
  ON public.leads (segment_id) 
  WHERE segment_id IS NOT NULL;

-- Optioneel: voeg channel tracking toe aan leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source_channel TEXT, -- 'google_ads', 'seo', 'microsite', 'direct', etc.
  ADD COLUMN IF NOT EXISTS source_campaign_id TEXT, -- Externe campaign ID
  ADD COLUMN IF NOT EXISTS source_keyword TEXT; -- Voor SEO/keyword tracking

-- Index voor channel analysis
CREATE INDEX IF NOT EXISTS idx_leads_source_channel 
  ON public.leads (source_channel, created_at DESC) 
  WHERE source_channel IS NOT NULL;

-- =====================================================
-- 2.6. HELPER FUNCTIONS
-- =====================================================

-- Function: Berekent lead gap voor een segment op een datum
CREATE OR REPLACE FUNCTION public.calculate_lead_gap(
  p_segment_id UUID,
  p_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target INTEGER;
  v_actual INTEGER;
  v_gap INTEGER;
BEGIN
  -- Haal target op
  SELECT target_leads_per_day INTO v_target
  FROM lead_segment_plans
  WHERE segment_id = p_segment_id AND date = p_date;
  
  -- Haal actual op
  SELECT leads_generated INTO v_actual
  FROM lead_generation_stats
  WHERE segment_id = p_segment_id AND date = p_date;
  
  -- Bereken gap
  v_gap := COALESCE(v_target, 0) - COALESCE(v_actual, 0);
  
  RETURN v_gap;
END;
$$;

-- Function: Update lead gap in plans tabel
CREATE OR REPLACE FUNCTION public.update_lead_gap(
  p_segment_id UUID,
  p_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gap INTEGER;
  v_gap_percentage NUMERIC(5,2);
  v_target INTEGER;
BEGIN
  -- Bereken gap
  v_gap := public.calculate_lead_gap(p_segment_id, p_date);
  
  -- Haal target op voor percentage berekening
  SELECT target_leads_per_day INTO v_target
  FROM lead_segment_plans
  WHERE segment_id = p_segment_id AND date = p_date;
  
  -- Bereken percentage
  IF v_target > 0 THEN
    v_gap_percentage := (v_gap::NUMERIC / v_target::NUMERIC) * 100;
  ELSE
    v_gap_percentage := NULL;
  END IF;
  
  -- Update plan
  UPDATE lead_segment_plans
  SET 
    lead_gap = v_gap,
    lead_gap_percentage = v_gap_percentage,
    updated_at = NOW()
  WHERE segment_id = p_segment_id AND date = p_date;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.calculate_lead_gap(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_lead_gap(UUID, DATE) TO authenticated;

-- =====================================================
-- 2.7. RLS POLICIES (Row Level Security)
-- =====================================================

-- Enable RLS op nieuwe tabellen
ALTER TABLE public.lead_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_generation_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_segment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_orchestration_log ENABLE ROW LEVEL SECURITY;

-- Policies: Admins kunnen alles, normale users alleen lezen
-- (Pas aan op basis van jullie security requirements)

-- Lead segments: iedereen kan lezen, alleen admins kunnen schrijven
CREATE POLICY "lead_segments_select" ON public.lead_segments
  FOR SELECT USING (true);

CREATE POLICY "lead_segments_insert" ON public.lead_segments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Lead generation stats: iedereen kan lezen
CREATE POLICY "lead_generation_stats_select" ON public.lead_generation_stats
  FOR SELECT USING (true);

-- Lead segment plans: iedereen kan lezen
CREATE POLICY "lead_segment_plans_select" ON public.lead_segment_plans
  FOR SELECT USING (true);

-- Channel orchestration log: alleen lezen
CREATE POLICY "channel_orchestration_log_select" ON public.channel_orchestration_log
  FOR SELECT USING (true);

-- =====================================================
-- EINDE VOORSTEL
-- =====================================================
-- Dit zijn alleen voorstellen; ik maak nog geen migrations aan 
-- en voer ze nog niet uit.

