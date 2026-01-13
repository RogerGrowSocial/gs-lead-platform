-- =====================================================
-- FORM OPTIMIZATION SUGGESTIONS
-- =====================================================
-- Migration: 20250121000002_form_optimization.sql
-- Doel: AI-gebaseerde optimalisatiesuggesties voor formulieren
-- =====================================================

-- =====================================================
-- 1. FORM_OPTIMIZATION_SUGGESTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.form_optimization_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referenties
  industry_id INTEGER REFERENCES public.industries(id),
  form_template_id UUID REFERENCES public.lead_form_templates(id),
  
  -- Suggestion type
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN (
    'remove_step', 
    'reorder_steps', 
    'modify_field', 
    'add_field', 
    'change_options',
    'simplify_step',
    'split_step',
    'merge_steps'
  )),
  
  -- Target
  target_step_id TEXT, -- Welke stap wordt aangepast
  target_field_id TEXT, -- Welke veld wordt aangepast
  
  -- Current vs Suggested
  current_config JSONB, -- Huidige config (snapshot)
  suggested_config JSONB, -- Voorgestelde config
  suggested_changes JSONB, -- Specifieke wijzigingen (diff)
  
  -- Reasoning
  reasoning TEXT, -- Waarom deze suggestie
  expected_impact JSONB, -- Verwacht effect (bijv. {"completion_rate": "+5%", "drop_off_rate": "-3%"}
  
  -- Analytics basis
  analytics_period_days INTEGER DEFAULT 30, -- Op basis van hoeveel dagen data
  data_points_count INTEGER, -- Aantal data points gebruikt
  baseline_metrics JSONB, -- Baseline metrics voor vergelijking
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'implemented', 'dismissed')),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  implemented_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Priority
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  estimated_effort TEXT CHECK (estimated_effort IN ('low', 'medium', 'high')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes voor performance
CREATE INDEX IF NOT EXISTS idx_form_optimization_industry_id 
  ON public.form_optimization_suggestions (industry_id)
  WHERE industry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_optimization_form_template_id 
  ON public.form_optimization_suggestions (form_template_id)
  WHERE form_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_form_optimization_status 
  ON public.form_optimization_suggestions (status);

CREATE INDEX IF NOT EXISTS idx_form_optimization_priority 
  ON public.form_optimization_suggestions (priority, status);

CREATE INDEX IF NOT EXISTS idx_form_optimization_created_at 
  ON public.form_optimization_suggestions (created_at DESC);

-- Composite index voor common queries
CREATE INDEX IF NOT EXISTS idx_form_optimization_industry_status 
  ON public.form_optimization_suggestions (industry_id, status, created_at DESC)
  WHERE industry_id IS NOT NULL;

-- =====================================================
-- 2. FUNCTION: Update suggestion status
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_optimization_suggestion_status(
  p_suggestion_id UUID,
  p_status TEXT,
  p_user_id UUID DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.form_optimization_suggestions
  SET
    status = p_status,
    approved_by = CASE WHEN p_status = 'approved' THEN p_user_id ELSE approved_by END,
    approved_at = CASE WHEN p_status = 'approved' THEN NOW() ELSE approved_at END,
    implemented_at = CASE WHEN p_status = 'implemented' THEN NOW() ELSE implemented_at END,
    rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE rejection_reason END,
    updated_at = NOW()
  WHERE id = p_suggestion_id;
END;
$$;

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.form_optimization_suggestions ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access on form_optimization_suggestions"
  ON public.form_optimization_suggestions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can view suggestions for their industry
CREATE POLICY "Users can view suggestions for their industry"
  ON public.form_optimization_suggestions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND (
        p.is_admin = true
        OR EXISTS (
          SELECT 1 
          FROM public.industries i
          WHERE i.id = form_optimization_suggestions.industry_id
          AND (
            i.id::TEXT = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[]))
            OR EXISTS (
              SELECT 1 
              FROM unnest(COALESCE(p.lead_industries, ARRAY[]::TEXT[])) AS industry_name
              WHERE LOWER(industry_name) = LOWER(i.name)
            )
          )
        )
      )
    )
  );

-- Policy: Admins can update suggestions
CREATE POLICY "Admins can update suggestions"
  ON public.form_optimization_suggestions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

-- =====================================================
-- 4. COMMENTS
-- =====================================================

COMMENT ON TABLE public.form_optimization_suggestions IS 'AI-generated optimization suggestions for form templates';
COMMENT ON COLUMN public.form_optimization_suggestions.suggestion_type IS 'Type of optimization: remove_step, reorder_steps, modify_field, add_field, change_options, etc.';
COMMENT ON COLUMN public.form_optimization_suggestions.expected_impact IS 'JSONB with expected impact metrics (e.g. {"completion_rate": "+5%", "drop_off_rate": "-3%"})';
COMMENT ON COLUMN public.form_optimization_suggestions.baseline_metrics IS 'JSONB with baseline metrics used for comparison';

