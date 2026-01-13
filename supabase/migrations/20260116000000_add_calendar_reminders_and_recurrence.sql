-- =====================================================
-- ADD REMINDERS AND RECURRENCE TO CALENDAR EVENTS
-- =====================================================
-- Extends calendar_events table with reminder recipients and recurrence details
-- =====================================================

-- Add reminder recipient fields
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS reminder_recipients UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE[] DEFAULT '{}';

-- Add recurrence details
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS recurrence_frequency VARCHAR(20) CHECK (recurrence_frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1, -- Every X days/weeks/months
  ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS recurrence_count INTEGER, -- Number of occurrences
  ADD COLUMN IF NOT EXISTS recurrence_days_of_week INTEGER[], -- For weekly: [1,3,5] = Mon, Wed, Fri
  ADD COLUMN IF NOT EXISTS recurrence_day_of_month INTEGER, -- For monthly: day 15
  ADD COLUMN IF NOT EXISTS parent_event_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE; -- For recurring series

-- Add comments
COMMENT ON COLUMN public.calendar_events.reminder_recipients IS 'Array of user IDs who should receive reminders';
COMMENT ON COLUMN public.calendar_events.reminder_sent_at IS 'Array of timestamps when reminders were sent';
COMMENT ON COLUMN public.calendar_events.recurrence_frequency IS 'Frequency: daily, weekly, monthly, yearly';
COMMENT ON COLUMN public.calendar_events.recurrence_interval IS 'Interval: every X days/weeks/months';
COMMENT ON COLUMN public.calendar_events.recurrence_end_date IS 'End date for recurring events';
COMMENT ON COLUMN public.calendar_events.recurrence_count IS 'Number of occurrences (alternative to end_date)';
COMMENT ON COLUMN public.calendar_events.recurrence_days_of_week IS 'Days of week for weekly recurrence (1=Monday, 7=Sunday)';
COMMENT ON COLUMN public.calendar_events.recurrence_day_of_month IS 'Day of month for monthly recurrence';
COMMENT ON COLUMN public.calendar_events.parent_event_id IS 'Reference to parent event in recurring series';

-- Create index for recurring events
CREATE INDEX IF NOT EXISTS idx_calendar_events_parent_event_id ON public.calendar_events(parent_event_id) WHERE parent_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_is_recurring ON public.calendar_events(is_recurring) WHERE is_recurring = TRUE;

-- Update view
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
  ce.is_recurring,
  ce.recurrence_frequency,
  ce.recurrence_interval,
  ce.recurrence_end_date,
  ce.recurrence_count,
  ce.recurrence_days_of_week,
  ce.recurrence_day_of_month,
  ce.parent_event_id,
  ce.reminder_minutes,
  ce.reminder_recipients,
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
