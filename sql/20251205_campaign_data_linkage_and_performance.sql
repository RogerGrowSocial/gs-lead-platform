-- =====================================================
-- CAMPAIGN DATA LINKAGE & PERFORMANCE
-- =====================================================
-- Migration: 20251205_campaign_data_linkage_and_performance.sql
-- Doel: Perfect data linkage + performance tracking + optimization
-- =====================================================

-- =====================================================
-- PART 1: Add google_ads_campaign_id to landing pages
-- =====================================================
ALTER TABLE public.partner_landing_pages
  ADD COLUMN IF NOT EXISTS google_ads_campaign_id TEXT;

CREATE INDEX IF NOT EXISTS idx_partner_landing_pages_google_ads_campaign_id
  ON public.partner_landing_pages (google_ads_campaign_id)
  WHERE google_ads_campaign_id IS NOT NULL;

-- =====================================================
-- PART 2: Campaign performance table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.campaign_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  google_ads_customer_id TEXT NOT NULL,
  google_ads_campaign_id TEXT NOT NULL,
  segment_id UUID REFERENCES public.lead_segments (id) ON DELETE SET NULL,
  
  date DATE NOT NULL,
  
  -- Metrics from Google Ads
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  conversions NUMERIC DEFAULT 0,
  conv_value NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one row per campaign per day
  UNIQUE (google_ads_customer_id, google_ads_campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_performance_segment_id
  ON public.campaign_performance (segment_id)
  WHERE segment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_performance_date
  ON public.campaign_performance (date DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_performance_campaign_date
  ON public.campaign_performance (google_ads_campaign_id, date DESC);

-- =====================================================
-- PART 3: Add optimization targets to lead_segments
-- =====================================================
ALTER TABLE public.lead_segments
  ADD COLUMN IF NOT EXISTS target_cpl_eur NUMERIC,
  ADD COLUMN IF NOT EXISTS min_daily_budget_eur NUMERIC,
  ADD COLUMN IF NOT EXISTS max_daily_budget_eur NUMERIC;

-- =====================================================
-- PART 4: Campaign optimization suggestions table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.campaign_optimization_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  segment_id UUID REFERENCES public.lead_segments (id) ON DELETE SET NULL,
  google_ads_campaign_id TEXT NOT NULL,
  
  suggested_change_type TEXT NOT NULL, -- 'BUDGET_INCREASE' | 'BUDGET_DECREASE' | 'NO_CHANGE'
  suggested_new_budget_micros BIGINT,
  current_budget_micros BIGINT,
  
  reason TEXT,
  cpl_eur NUMERIC,
  target_cpl_eur NUMERIC,
  leads_count INTEGER,
  
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_optimization_suggestions_campaign
  ON public.campaign_optimization_suggestions (google_ads_campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_optimization_suggestions_applied
  ON public.campaign_optimization_suggestions (applied, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_optimization_suggestions_segment
  ON public.campaign_optimization_suggestions (segment_id)
  WHERE segment_id IS NOT NULL;

