-- Migration: Create AI Router settings table
-- This table stores configuration for the AI Lead Router system

-- =====================================================
-- AI ROUTER SETTINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_router_settings (
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
INSERT INTO public.ai_router_settings (setting_key, setting_value, description)
VALUES 
  ('region_weight', '50', 'Belang van regio matching (0-100)'),
  ('performance_weight', '50', 'Belang van prestaties/conversieratio (0-100)'),
  ('fairness_weight', '50', 'Belang van eerlijke verdeling (0-100)'),
  ('auto_assign_enabled', 'true', 'Automatisch toewijzen van nieuwe leads'),
  ('auto_assign_threshold', '70', 'Minimum score voor automatische toewijzing (0-100)')
ON CONFLICT (setting_key) DO NOTHING;

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ai_router_settings_key 
  ON public.ai_router_settings(setting_key);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.ai_router_settings IS 'Configuration settings for AI Lead Router system';
COMMENT ON COLUMN public.ai_router_settings.setting_key IS 'Unique key identifier for the setting';
COMMENT ON COLUMN public.ai_router_settings.setting_value IS 'Value of the setting (stored as text, parse as needed)';
COMMENT ON COLUMN public.ai_router_settings.description IS 'Human-readable description of what this setting controls';

