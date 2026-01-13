-- =====================================================
-- CREATE CALENDAR EVENTS TABLE
-- =====================================================
-- This table stores calendar events/appointments (afspraken)
-- Events can be linked to customers, contacts, or tasks
-- =====================================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Date and time
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Event category
  category VARCHAR(50) NOT NULL DEFAULT 'appointment' CHECK (category IN ('meeting', 'call', 'appointment', 'task')),
  
  -- Relationships (optional)
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.employee_tasks(id) ON DELETE SET NULL,
  
  -- Additional information
  location TEXT, -- Meeting location, address, etc.
  client_name VARCHAR(255), -- Client/customer name (for quick reference)
  
  -- Recurrence (future feature)
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT, -- JSON string for recurrence rules
  
  -- Status
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  
  -- Reminders (future feature)
  reminder_minutes INTEGER[], -- Array of minutes before event to send reminders
  
  -- Metadata
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON public.calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_time ON public.calendar_events(end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_category ON public.calendar_events(category);
CREATE INDEX IF NOT EXISTS idx_calendar_events_customer_id ON public.calendar_events(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_contact_id ON public.calendar_events(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_by ON public.calendar_events(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_deleted_at ON public.calendar_events(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_date_range ON public.calendar_events USING GIST (tstzrange(start_time, end_time));

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_active ON public.calendar_events(start_time, end_time, category, deleted_at) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE public.calendar_events IS 'Calendar events and appointments for the CRM system';
COMMENT ON COLUMN public.calendar_events.title IS 'Event title/subject';
COMMENT ON COLUMN public.calendar_events.description IS 'Event description/notes';
COMMENT ON COLUMN public.calendar_events.start_time IS 'Event start date and time';
COMMENT ON COLUMN public.calendar_events.end_time IS 'Event end date and time';
COMMENT ON COLUMN public.calendar_events.category IS 'Event category: meeting, call, appointment, or task';
COMMENT ON COLUMN public.calendar_events.customer_id IS 'Optional link to customer';
COMMENT ON COLUMN public.calendar_events.contact_id IS 'Optional link to contact person';
COMMENT ON COLUMN public.calendar_events.task_id IS 'Optional link to employee task';
COMMENT ON COLUMN public.calendar_events.location IS 'Event location (meeting room, address, etc.)';
COMMENT ON COLUMN public.calendar_events.client_name IS 'Client/customer name for quick reference';
COMMENT ON COLUMN public.calendar_events.status IS 'Event status: scheduled, confirmed, completed, cancelled, or no_show';
COMMENT ON COLUMN public.calendar_events.deleted_at IS 'Soft delete timestamp';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_updated_at();

-- =====================================================
-- CREATE CALENDAR EVENTS VIEW (for easier querying)
-- =====================================================

CREATE OR REPLACE VIEW public.calendar_events_view AS
SELECT 
  ce.id,
  ce.title,
  ce.description,
  ce.start_time,
  ce.end_time,
  ce.category,
  ce.location,
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
