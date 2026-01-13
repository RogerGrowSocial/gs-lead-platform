-- =====================================================
-- PARTNER FORM CUSTOMIZATIONS
-- =====================================================
-- Migration: 20250121000003_partner_form_customizations.sql
-- Doel: Partner-specifieke formulier aanpassingen
-- =====================================================

-- =====================================================
-- 1. PARTNER_FORM_CUSTOMIZATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.partner_form_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referenties
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  industry_id INTEGER NOT NULL REFERENCES public.industries(id),
  form_template_id UUID REFERENCES public.lead_form_templates(id),
  
  -- Customization
  custom_config JSONB NOT NULL, -- Aangepaste form config voor deze partner
  customization_reason TEXT, -- Waarom aangepast (bijv. "verliest vaak op budget")
  
  -- Performance tracking
  leads_count INTEGER DEFAULT 0,
  win_rate_pct NUMERIC(5,2),
  avg_deal_value NUMERIC(10,2),
  avg_response_time_hours NUMERIC(5,2),
  
  -- Loss reasons tracking (voor feedback loop)
  common_loss_reasons JSONB, -- {"budget_too_low": 5, "wrong_job_type": 3, ...}
  common_rejection_feedback TEXT[], -- Array van veelvoorkomende feedback
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  auto_generated BOOLEAN DEFAULT false, -- True als gegenereerd door AI
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(partner_id, industry_id, form_template_id)
);

-- Indexes voor performance
CREATE INDEX IF NOT EXISTS idx_partner_form_customizations_partner_id 
  ON public.partner_form_customizations (partner_id);

CREATE INDEX IF NOT EXISTS idx_partner_form_customizations_industry_id 
  ON public.partner_form_customizations (industry_id);

CREATE INDEX IF NOT EXISTS idx_partner_form_customizations_active 
  ON public.partner_form_customizations (partner_id, industry_id, is_active)
  WHERE is_active = true;

-- =====================================================
-- 2. FUNCTION: Update customization performance
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_partner_customization_performance(
  p_customization_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customization RECORD;
  v_stats RECORD;
BEGIN
  -- Get customization
  SELECT * INTO v_customization
  FROM public.partner_form_customizations
  WHERE id = p_customization_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculate performance stats from leads
  SELECT 
    COUNT(*) as leads_count,
    ROUND(
      COUNT(*) FILTER (WHERE l.status = 'won')::NUMERIC / 
      NULLIF(COUNT(*) FILTER (WHERE l.status IN ('won', 'lost')), 0) * 100,
      2
    ) as win_rate_pct,
    AVG(l.deal_value) FILTER (WHERE l.status = 'won') as avg_deal_value,
    AVG(
      EXTRACT(EPOCH FROM (l.first_contact_at - l.created_at)) / 3600
    ) FILTER (WHERE l.first_contact_at IS NOT NULL) as avg_response_time_hours
  INTO v_stats
  FROM public.leads l
  WHERE l.user_id = v_customization.partner_id
    AND l.industry_id = v_customization.industry_id
    AND l.created_at >= v_customization.created_at;
  
  -- Update customization
  UPDATE public.partner_form_customizations
  SET
    leads_count = COALESCE(v_stats.leads_count, 0),
    win_rate_pct = v_stats.win_rate_pct,
    avg_deal_value = v_stats.avg_deal_value,
    avg_response_time_hours = v_stats.avg_response_time_hours,
    updated_at = NOW()
  WHERE id = p_customization_id;
END;
$$;

-- =====================================================
-- 3. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.partner_form_customizations ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access on partner_form_customizations"
  ON public.partner_form_customizations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Partners can view their own customizations
CREATE POLICY "Partners can view their own customizations"
  ON public.partner_form_customizations
  FOR SELECT
  TO authenticated
  USING (
    partner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

-- Policy: Partners can update their own customizations
CREATE POLICY "Partners can update their own customizations"
  ON public.partner_form_customizations
  FOR UPDATE
  TO authenticated
  USING (partner_id = auth.uid())
  WITH CHECK (partner_id = auth.uid());

-- Policy: Service role can insert customizations
CREATE POLICY "Service role can insert customizations"
  ON public.partner_form_customizations
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =====================================================
-- 4. COMMENTS
-- =====================================================

COMMENT ON TABLE public.partner_form_customizations IS 'Partner-specific form customizations based on performance feedback';
COMMENT ON COLUMN public.partner_form_customizations.custom_config IS 'Customized form config JSON for this partner';
COMMENT ON COLUMN public.partner_form_customizations.common_loss_reasons IS 'JSONB tracking common loss reasons (e.g. {"budget_too_low": 5, "wrong_job_type": 3})';
COMMENT ON COLUMN public.partner_form_customizations.auto_generated IS 'True if customization was auto-generated by AI based on performance';

