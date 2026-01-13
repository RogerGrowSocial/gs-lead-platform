-- =====================================================
-- FORM BENCHMARKS & INSIGHTS
-- =====================================================
-- Migration: 20250121000004_form_benchmarks.sql
-- Doel: Benchmark & Insights materialized view voor formulier performance
-- =====================================================

-- =====================================================
-- 1. FORM_BENCHMARKS MATERIALIZED VIEW
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.form_benchmarks AS
WITH session_metrics AS (
  SELECT 
    fa.industry_id,
    fa.session_id,
    -- Check if session is completed (last step has completed_at)
    CASE 
      WHEN EXISTS (
        SELECT 1 
        FROM form_analytics fa2 
        WHERE fa2.session_id = fa.session_id 
          AND fa2.completed_at IS NOT NULL
          AND fa2.step_id = (
            SELECT MAX(step_id) 
            FROM form_analytics fa3 
            WHERE fa3.session_id = fa.session_id
          )
      ) THEN 1 
      ELSE 0 
    END AS is_completed,
    -- Check if session dropped off
    MAX(CASE WHEN fa.dropped_off = true THEN 1 ELSE 0 END) AS is_dropped_off,
    -- Calculate completion time
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM form_analytics fa2 
        WHERE fa2.session_id = fa.session_id AND fa2.completed_at IS NOT NULL
      ) THEN
        EXTRACT(EPOCH FROM (
          (SELECT MAX(fa2.completed_at) FROM form_analytics fa2 WHERE fa2.session_id = fa.session_id AND fa2.completed_at IS NOT NULL) - 
          (SELECT MIN(fa2.started_at) FROM form_analytics fa2 WHERE fa2.session_id = fa.session_id)
        ))
      ELSE NULL
    END AS completion_time_seconds
  FROM form_analytics fa
  WHERE fa.industry_id IS NOT NULL
  GROUP BY fa.industry_id, fa.session_id
)
SELECT 
  -- Industry level
  i.id AS industry_id,
  i.name AS industry_name,
  
  -- Aggregated metrics
  COUNT(DISTINCT fa.form_template_id) AS total_templates,
  COUNT(DISTINCT fa.session_id) AS total_sessions,
  COUNT(DISTINCT fa.lead_id) FILTER (WHERE fa.lead_id IS NOT NULL) AS total_leads,
  
  -- Completion metrics
  SUM(sm.is_completed) AS completed_sessions,
  ROUND(
    SUM(sm.is_completed)::NUMERIC / NULLIF(COUNT(DISTINCT fa.session_id), 0) * 100,
    2
  ) AS overall_completion_rate_pct,
  
  -- Drop-off metrics
  SUM(sm.is_dropped_off) AS drop_off_sessions,
  ROUND(
    SUM(sm.is_dropped_off)::NUMERIC / NULLIF(COUNT(DISTINCT fa.session_id), 0) * 100,
    2
  ) AS overall_drop_off_rate_pct,
  
  -- Time metrics
  AVG(sm.completion_time_seconds) AS avg_form_completion_time_seconds,
  
  -- Lead quality metrics
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won') AS won_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status IN ('won', 'lost')) AS closed_leads,
  ROUND(
    COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won')::NUMERIC / 
    NULLIF(COUNT(DISTINCT l.id) FILTER (WHERE l.status IN ('won', 'lost')), 0) * 100,
    2
  ) AS win_rate_pct,
  AVG(l.deal_value) FILTER (WHERE l.status = 'won' AND l.deal_value IS NOT NULL) AS avg_deal_value,
  
  -- Response time metrics
  AVG(
    EXTRACT(EPOCH FROM (l.first_contact_at - l.created_at)) / 3600
  ) FILTER (WHERE l.first_contact_at IS NOT NULL) AS avg_response_time_hours,
  
  -- Timestamps
  MIN(fa.created_at) AS first_seen_at,
  MAX(fa.created_at) AS last_seen_at,
  NOW() AS last_calculated_at

FROM public.form_analytics fa
LEFT JOIN public.industries i ON i.id = fa.industry_id
LEFT JOIN public.leads l ON l.id = fa.lead_id
LEFT JOIN session_metrics sm ON sm.session_id = fa.session_id AND sm.industry_id = fa.industry_id
WHERE fa.industry_id IS NOT NULL
GROUP BY i.id, i.name;

-- Index for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_form_benchmarks_industry_id 
  ON public.form_benchmarks (industry_id);

-- =====================================================
-- 2. FUNCTION: Refresh form_benchmarks
-- =====================================================

CREATE OR REPLACE FUNCTION public.refresh_form_benchmarks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.form_benchmarks;
END;
$$;

-- =====================================================
-- 3. COMMENTS
-- =====================================================

COMMENT ON MATERIALIZED VIEW public.form_benchmarks IS 'Aggregated form performance benchmarks per industry';
COMMENT ON COLUMN public.form_benchmarks.overall_completion_rate_pct IS 'Overall form completion rate percentage';
COMMENT ON COLUMN public.form_benchmarks.overall_drop_off_rate_pct IS 'Overall form drop-off rate percentage';
COMMENT ON COLUMN public.form_benchmarks.avg_form_completion_time_seconds IS 'Average time to complete form in seconds';
COMMENT ON COLUMN public.form_benchmarks.win_rate_pct IS 'Win rate percentage for leads from forms';
COMMENT ON COLUMN public.form_benchmarks.avg_deal_value IS 'Average deal value for won leads';

