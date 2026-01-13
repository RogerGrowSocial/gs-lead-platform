-- Migration: Add AI Task Router settings
-- This adds settings for the AI Task Router system (separate from Lead Router)

-- =====================================================
-- AI TASK ROUTER SETTINGS
-- =====================================================

-- Insert default settings for Task Router (idempotent)
INSERT INTO public.ai_router_settings (setting_key, setting_value, description)
VALUES 
  ('task_auto_assign_enabled', 'true', 'Automatisch toewijzen van nieuwe taken'),
  ('task_skills_weight', '50', 'Belang van skills matching (0-100)'),
  ('task_workload_weight', '30', 'Belang van workload/ beschikbaarheid (0-100)'),
  ('task_completion_weight', '20', 'Belang van completion rate (0-100)'),
  ('task_auto_assign_threshold', '60', 'Minimum score voor automatische toewijzing (0-100)')
ON CONFLICT (setting_key) DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.ai_router_settings IS 'Configuration settings for AI Lead Router and AI Task Router systems';

