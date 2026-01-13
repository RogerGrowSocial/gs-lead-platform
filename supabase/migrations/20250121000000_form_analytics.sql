-- =====================================================
-- FORM ANALYTICS & DROP-OFF TRACKING
-- =====================================================
-- Migration: 20250121000000_form_analytics.sql
-- Doel: Tracking van formulier interacties en drop-offs
-- =====================================================

-- =====================================================
-- 1. FORM_ANALYTICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.form_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referenties
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  industry_id INTEGER REFERENCES public.industries(id),
  form_template_id UUID REFERENCES public.lead_form_templates(id),
  
  -- Step tracking
  step_id TEXT NOT NULL, -- e.g. "step-2", "step-3", "step-urgency"
  step_order INTEGER NOT NULL,
  step_title TEXT,
  
  -- Field tracking
  field_id TEXT, -- e.g. "job_category", "budget"
  field_type TEXT, -- "select", "text", etc.
  
  -- Analytics data
  started_at TIMESTAMPTZ NOT NULL, -- Wanneer gebruiker deze stap startte
  completed_at TIMESTAMPTZ, -- Wanneer stap voltooid werd (NULL = drop-off)
  time_spent_seconds INTEGER, -- calculated: completed_at - started_at
  
  -- Drop-off tracking
  dropped_off BOOLEAN DEFAULT false, -- true als gebruiker niet verder ging
  drop_off_reason TEXT, -- "timeout", "back_button", "close_tab", etc.
  
  -- Field values (voor analyse)
  field_value TEXT, -- Wat gebruiker invulde (voor select: gekozen optie)
  field_value_metadata JSONB, -- Extra data (bijv. welke opties werden bekeken maar niet gekozen)
  
  -- Session tracking
  session_id TEXT NOT NULL, -- Unieke sessie ID (client-side generated)
  user_agent TEXT,
  referrer TEXT,
  source_keyword TEXT, -- Van landing page / campaign
  source_campaign_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes voor performance
CREATE INDEX IF NOT EXISTS idx_form_analytics_lead_id 
  ON public.form_analytics (lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_analytics_industry_id 
  ON public.form_analytics (industry_id)
  WHERE industry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_analytics_form_template_id 
  ON public.form_analytics (form_template_id)
  WHERE form_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_analytics_step_id 
  ON public.form_analytics (step_id);

CREATE INDEX IF NOT EXISTS idx_form_analytics_dropped_off 
  ON public.form_analytics (dropped_off)
  WHERE dropped_off = true;

CREATE INDEX IF NOT EXISTS idx_form_analytics_session_id 
  ON public.form_analytics (session_id);

CREATE INDEX IF NOT EXISTS idx_form_analytics_created_at 
  ON public.form_analytics (created_at DESC);

-- Composite index voor common queries
CREATE INDEX IF NOT EXISTS idx_form_analytics_industry_step 
  ON public.form_analytics (industry_id, step_id, created_at DESC)
  WHERE industry_id IS NOT NULL;

-- =====================================================
-- 2. FORM_STEP_PERFORMANCE MATERIALIZED VIEW
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.form_step_performance AS
SELECT 
  fa.industry_id,
  fa.form_template_id,
  fa.step_id,
  fa.step_order,
  fa.step_title,
  
  -- Volume metrics
  COUNT(*) as total_starts,
  COUNT(fa.completed_at) as total_completions,
  COUNT(*) FILTER (WHERE fa.dropped_off = true) as total_drop_offs,
  
  -- Conversion metrics
  ROUND(
    COUNT(fa.completed_at)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 
    2
  ) as completion_rate_pct,
  
  ROUND(
    COUNT(*) FILTER (WHERE fa.dropped_off = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
    2
  ) as drop_off_rate_pct,
  
  -- Time metrics
  AVG(fa.time_spent_seconds) as avg_time_spent_seconds,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fa.time_spent_seconds) as median_time_spent_seconds,
  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY fa.time_spent_seconds) as p25_time_spent_seconds,
  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY fa.time_spent_seconds) as p75_time_spent_seconds,
  
  -- Lead quality (correlatie met won/lost)
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won') as leads_won,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'lost') as leads_lost,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status IN ('won', 'lost')) as leads_with_outcome,
  ROUND(
    COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won')::NUMERIC / 
    NULLIF(COUNT(DISTINCT l.id) FILTER (WHERE l.status IN ('won', 'lost')), 0) * 100,
    2
  ) as win_rate_pct,
  
  -- Average deal value for won leads
  AVG(l.deal_value) FILTER (WHERE l.status = 'won') as avg_deal_value,
  
  -- Date range
  MIN(fa.created_at) as first_seen_at,
  MAX(fa.created_at) as last_seen_at,
  
  -- Last refresh
  NOW() as last_refreshed_at
  
FROM public.form_analytics fa
LEFT JOIN public.leads l ON fa.lead_id = l.id
GROUP BY fa.industry_id, fa.form_template_id, fa.step_id, fa.step_order, fa.step_title;

-- Indexes voor materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_step_performance_unique 
  ON public.form_step_performance (industry_id, form_template_id, step_id)
  WHERE industry_id IS NOT NULL AND form_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_step_performance_industry 
  ON public.form_step_performance (industry_id, step_order);

-- =====================================================
-- 3. REFRESH FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.refresh_form_step_performance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.form_step_performance;
END;
$$;

-- =====================================================
-- 4. RLS POLICIES (if needed)
-- =====================================================

-- Enable RLS
ALTER TABLE public.form_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access on form_analytics"
  ON public.form_analytics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Public can insert (for form tracking)
CREATE POLICY "Public can insert form analytics"
  ON public.form_analytics
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Authenticated users can view analytics for their industry
-- Admins can see all, regular users can see analytics for industries they have access to
CREATE POLICY "Users can view analytics for their industry"
  ON public.form_analytics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        -- Admins can see everything
        p.is_admin = true
        OR
        -- Regular users: check if industry name or id matches their lead_industries
        EXISTS (
          SELECT 1 
          FROM public.industries i
          WHERE i.id = form_analytics.industry_id
          AND (
            -- Match by industry id (as text, for backward compatibility)
            i.id::TEXT = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[]))
            OR
            -- Match by industry name (case-insensitive) - check if any array element matches
            EXISTS (
              SELECT 1 
              FROM unnest(COALESCE(p.lead_industries, ARRAY[]::TEXT[])) AS industry_name
              WHERE LOWER(industry_name) = LOWER(i.name)
            )
          )
        )
      )
    )
  );

-- =====================================================
-- 5. COMMENTS
-- =====================================================

COMMENT ON TABLE public.form_analytics IS 'Tracks user interactions with form steps and fields for analytics';
COMMENT ON COLUMN public.form_analytics.session_id IS 'Client-side generated unique session ID';
COMMENT ON COLUMN public.form_analytics.field_value_metadata IS 'JSONB with additional field interaction data (e.g. options viewed but not selected)';
COMMENT ON MATERIALIZED VIEW public.form_step_performance IS 'Aggregated performance metrics per form step';

