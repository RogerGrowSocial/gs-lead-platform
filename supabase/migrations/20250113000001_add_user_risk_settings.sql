-- Migration: Create settings table for user risk assessment configuration
-- This table stores configurable thresholds and settings for the risk assessment system

-- =====================================================
-- SETTINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_risk_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- =====================================================
-- DEFAULT SETTINGS
-- =====================================================

-- Insert default settings (idempotent)
INSERT INTO public.user_risk_settings (setting_key, setting_value, description)
VALUES 
  ('ai_risk_threshold_low', '40', 'AI risk score below this value requires manual review (0-100 scale)'),
  ('ai_risk_threshold_medium', '70', 'AI risk score between low and medium threshold (0-100 scale)'),
  ('ai_model', 'gpt-4o-mini', 'OpenAI model to use for risk assessment'),
  ('auto_reevaluate_on_update', 'true', 'Automatically re-evaluate risk when relevant profile fields are updated')
ON CONFLICT (setting_key) DO NOTHING;

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_user_risk_settings_key 
  ON public.user_risk_settings(setting_key);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.user_risk_settings IS 'Configuration settings for user risk assessment system';
COMMENT ON COLUMN public.user_risk_settings.setting_key IS 'Unique key identifier for the setting';
COMMENT ON COLUMN public.user_risk_settings.setting_value IS 'Value of the setting (stored as text, parse as needed)';
COMMENT ON COLUMN public.user_risk_settings.description IS 'Human-readable description of what this setting controls';

