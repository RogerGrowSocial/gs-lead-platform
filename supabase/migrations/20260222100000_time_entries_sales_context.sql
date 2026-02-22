-- Time entries: Sales activity type + optional context (deal/opportunity/customer/contact)
-- Backwards compatible: all new columns nullable.

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS activity_type TEXT;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS context_type TEXT;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS context_id UUID;

COMMENT ON COLUMN public.time_entries.activity_type IS 'Sales activity: call, meeting, outreach, offerte, research, admin';
COMMENT ON COLUMN public.time_entries.context_type IS 'Link type: deal, opportunity, customer, contact';
COMMENT ON COLUMN public.time_entries.context_id IS 'ID of linked deal/opportunity/customer/contact';

CREATE INDEX IF NOT EXISTS idx_time_entries_context
  ON public.time_entries (context_type, context_id)
  WHERE context_type IS NOT NULL AND context_id IS NOT NULL;
