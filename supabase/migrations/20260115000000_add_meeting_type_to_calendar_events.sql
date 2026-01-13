-- =====================================================
-- ADD MEETING TYPE TO CALENDAR EVENTS
-- =====================================================
-- Adds meeting_type field to distinguish between physical and online meetings
-- =====================================================

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS meeting_type VARCHAR(20) CHECK (meeting_type IN ('physical', 'online'));

-- Add comment
COMMENT ON COLUMN public.calendar_events.meeting_type IS 'Type of meeting: physical (fysiek) or online. Only relevant for meeting and appointment categories.';

-- Update view if it exists
DROP VIEW IF EXISTS public.calendar_events_view;

CREATE OR REPLACE VIEW public.calendar_events_view AS
SELECT 
  ce.id,
  ce.title,
  ce.description,
  ce.start_time,
  ce.end_time,
  ce.category,
  ce.location,
  ce.meeting_type,
  ce.client_name,
  ce.status,
  ce.created_by,
  ce.created_at,
  ce.updated_at,
  -- Related entities
  ce.customer_id,
  c.name as customer_name,
  c.company_name as customer_company_name,
  ce.contact_id,
  ct.name as contact_name,
  ce.task_id,
  -- Creator info
  creator.first_name as creator_first_name,
  creator.last_name as creator_last_name,
  creator.email as creator_email
FROM public.calendar_events ce
LEFT JOIN public.customers c ON ce.customer_id = c.id
LEFT JOIN public.contacts ct ON ce.contact_id = ct.id
LEFT JOIN public.profiles creator ON ce.created_by = creator.id
WHERE ce.deleted_at IS NULL;

COMMENT ON VIEW public.calendar_events_view IS 'Enhanced view of calendar events with related entity information';
