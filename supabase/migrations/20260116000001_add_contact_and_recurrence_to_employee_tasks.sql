-- =====================================================
-- ADD CONTACT_ID AND RECURRENCE TO EMPLOYEE_TASKS
-- =====================================================
-- Extends employee_tasks table with contact_id and recurrence fields
-- =====================================================

-- Add contact_id field
ALTER TABLE public.employee_tasks
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Add recurrence fields (similar to calendar_events)
ALTER TABLE public.employee_tasks
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurrence_frequency VARCHAR(20) CHECK (recurrence_frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS recurrence_count INTEGER,
  ADD COLUMN IF NOT EXISTS recurrence_days_of_week INTEGER[],
  ADD COLUMN IF NOT EXISTS recurrence_day_of_month INTEGER,
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.employee_tasks(id) ON DELETE CASCADE;

-- Add comments
COMMENT ON COLUMN public.employee_tasks.contact_id IS 'Optional link to contact person (alternative to customer_id)';
COMMENT ON COLUMN public.employee_tasks.is_recurring IS 'Whether this task is part of a recurring series';
COMMENT ON COLUMN public.employee_tasks.recurrence_frequency IS 'Frequency: daily, weekly, monthly, yearly';
COMMENT ON COLUMN public.employee_tasks.recurrence_interval IS 'Interval: every X days/weeks/months';
COMMENT ON COLUMN public.employee_tasks.recurrence_end_date IS 'End date for recurring tasks';
COMMENT ON COLUMN public.employee_tasks.recurrence_count IS 'Number of occurrences (alternative to end_date)';
COMMENT ON COLUMN public.employee_tasks.recurrence_days_of_week IS 'Days of week for weekly recurrence (1=Monday, 7=Sunday)';
COMMENT ON COLUMN public.employee_tasks.recurrence_day_of_month IS 'Day of month for monthly recurrence';
COMMENT ON COLUMN public.employee_tasks.parent_task_id IS 'Reference to parent task in recurring series';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_tasks_contact_id ON public.employee_tasks(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_employee_tasks_is_recurring ON public.employee_tasks(is_recurring) WHERE is_recurring = TRUE;
CREATE INDEX IF NOT EXISTS idx_employee_tasks_parent_task_id ON public.employee_tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;

-- Add constraint: task must have either customer_id OR contact_id (but not necessarily both)
-- Note: This is enforced at application level, not database level, to allow flexibility
