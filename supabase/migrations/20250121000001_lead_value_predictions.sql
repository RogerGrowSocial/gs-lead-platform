-- =====================================================
-- LEAD VALUE PREDICTIONS
-- =====================================================
-- Migration: 20250121000001_lead_value_predictions.sql
-- Doel: AI-gebaseerde voorspellingen voor lead value en win probability
-- =====================================================

-- =====================================================
-- 1. LEAD_VALUE_PREDICTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lead_value_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referenties
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  industry_id INTEGER REFERENCES public.industries(id),
  
  -- Predictions
  predicted_deal_value NUMERIC(10,2), -- Voorspelde dealwaarde in euro's
  predicted_win_probability NUMERIC(5,2), -- 0-100%
  predicted_response_time_hours NUMERIC(5,2), -- Verwacht aantal uren tot eerste contact
  
  -- Model metadata
  model_version TEXT DEFAULT 'v1.0', -- e.g. "v1.0"
  prediction_confidence NUMERIC(5,2), -- 0-100%
  prediction_factors JSONB, -- Welke factoren droegen bij aan voorspelling
  
  -- Actual outcomes (voor model training/validatie)
  actual_deal_value NUMERIC(10,2),
  actual_win BOOLEAN,
  actual_response_time_hours NUMERIC(5,2),
  
  -- Accuracy metrics (calculated after outcome is known)
  deal_value_error_pct NUMERIC(5,2), -- Percentage error: |actual - predicted| / actual * 100
  win_probability_error_pct NUMERIC(5,2), -- Error in win probability prediction
  
  -- Timestamps
  predicted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualized_at TIMESTAMPTZ -- Wanneer outcome bekend werd
);

-- Indexes voor performance
CREATE INDEX IF NOT EXISTS idx_lead_value_predictions_lead_id 
  ON public.lead_value_predictions (lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_value_predictions_industry_id 
  ON public.lead_value_predictions (industry_id)
  WHERE industry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_value_predictions_predicted_at 
  ON public.lead_value_predictions (predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_value_predictions_actualized_at 
  ON public.lead_value_predictions (actualized_at DESC)
  WHERE actualized_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_value_predictions_model_version 
  ON public.lead_value_predictions (model_version);

-- Composite index voor common queries
CREATE INDEX IF NOT EXISTS idx_lead_value_predictions_industry_predicted 
  ON public.lead_value_predictions (industry_id, predicted_at DESC)
  WHERE industry_id IS NOT NULL;

-- =====================================================
-- 2. FUNCTION: Update actual outcomes
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_lead_prediction_outcome(
  p_lead_id UUID,
  p_actual_deal_value NUMERIC DEFAULT NULL,
  p_actual_win BOOLEAN DEFAULT NULL,
  p_actual_response_time_hours NUMERIC DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prediction RECORD;
  v_deal_value_error NUMERIC;
  v_win_prob_error NUMERIC;
BEGIN
  -- Get the prediction
  SELECT * INTO v_prediction
  FROM public.lead_value_predictions
  WHERE lead_id = p_lead_id
  ORDER BY predicted_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN; -- No prediction found, nothing to update
  END IF;
  
  -- Calculate errors if we have actual values
  IF p_actual_deal_value IS NOT NULL AND v_prediction.predicted_deal_value IS NOT NULL THEN
    v_deal_value_error := ABS(p_actual_deal_value - v_prediction.predicted_deal_value) / 
                         NULLIF(p_actual_deal_value, 0) * 100;
  END IF;
  
  IF p_actual_win IS NOT NULL AND v_prediction.predicted_win_probability IS NOT NULL THEN
    -- Error is difference between predicted probability and actual (0 or 100)
    v_win_prob_error := ABS(
      CASE WHEN p_actual_win THEN 100 ELSE 0 END - v_prediction.predicted_win_probability
    );
  END IF;
  
  -- Update prediction with actual outcomes
  UPDATE public.lead_value_predictions
  SET
    actual_deal_value = COALESCE(p_actual_deal_value, actual_deal_value),
    actual_win = COALESCE(p_actual_win, actual_win),
    actual_response_time_hours = COALESCE(p_actual_response_time_hours, actual_response_time_hours),
    deal_value_error_pct = COALESCE(v_deal_value_error, deal_value_error_pct),
    win_probability_error_pct = COALESCE(v_win_prob_error, win_probability_error_pct),
    actualized_at = COALESCE(actualized_at, NOW())
  WHERE id = v_prediction.id;
END;
$$;

-- =====================================================
-- 3. TRIGGER: Auto-update prediction when lead status changes
-- =====================================================

CREATE OR REPLACE FUNCTION public.trigger_update_prediction_on_lead_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update prediction when lead is marked as won or lost
  IF NEW.status IN ('won', 'lost') AND (OLD.status IS NULL OR OLD.status NOT IN ('won', 'lost')) THEN
    PERFORM public.update_lead_prediction_outcome(
      NEW.id,
      CASE WHEN NEW.status = 'won' THEN NEW.deal_value ELSE NULL END,
      NEW.status = 'won',
      CASE 
        WHEN NEW.first_contact_at IS NOT NULL AND NEW.created_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (NEW.first_contact_at - NEW.created_at)) / 3600
        ELSE NULL
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_prediction_on_lead_status ON public.leads;

-- Create trigger
CREATE TRIGGER trigger_update_prediction_on_lead_status
  AFTER UPDATE OF status, deal_value, first_contact_at ON public.leads
  FOR EACH ROW
  WHEN (NEW.status IN ('won', 'lost') OR NEW.deal_value IS NOT NULL)
  EXECUTE FUNCTION public.trigger_update_prediction_on_lead_status();

-- =====================================================
-- 4. RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.lead_value_predictions ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access on lead_value_predictions"
  ON public.lead_value_predictions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can view predictions for their leads
CREATE POLICY "Users can view predictions for their leads"
  ON public.lead_value_predictions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_value_predictions.lead_id
      AND (
        l.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
          AND p.is_admin = true
        )
      )
    )
  );

-- Policy: Service role can insert/update predictions
CREATE POLICY "Service role can insert predictions"
  ON public.lead_value_predictions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =====================================================
-- 5. COMMENTS
-- =====================================================

COMMENT ON TABLE public.lead_value_predictions IS 'AI predictions for lead value, win probability, and response time';
COMMENT ON COLUMN public.lead_value_predictions.predicted_deal_value IS 'Predicted deal value in euros';
COMMENT ON COLUMN public.lead_value_predictions.predicted_win_probability IS 'Predicted win probability (0-100%)';
COMMENT ON COLUMN public.lead_value_predictions.prediction_factors IS 'JSONB with factors that influenced the prediction';
COMMENT ON COLUMN public.lead_value_predictions.deal_value_error_pct IS 'Percentage error: |actual - predicted| / actual * 100';
COMMENT ON FUNCTION public.update_lead_prediction_outcome IS 'Updates prediction with actual outcomes and calculates error metrics';

