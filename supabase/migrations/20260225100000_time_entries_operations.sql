-- Time entries: Operations type – ops_category, ops_area, ops_impact
-- Backwards compatible: all new columns nullable.

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS ops_category TEXT;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS ops_area TEXT;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS ops_impact TEXT;

COMMENT ON COLUMN public.time_entries.ops_category IS 'Operations: processen, automations, data, platform, planning, finance, onboarding, algemeen';
COMMENT ON COLUMN public.time_entries.ops_area IS 'Operations: area/project (Platform, GrowSocial, etc.)';
COMMENT ON COLUMN public.time_entries.ops_impact IS 'Operations: impact type (bespaart tijd, verhoogt omzet, etc.)';

CREATE INDEX IF NOT EXISTS idx_time_entries_ops_category
  ON public.time_entries (ops_category)
  WHERE ops_category IS NOT NULL;
