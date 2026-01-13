-- Migration: Extend time_entries table for comprehensive time tracking
-- Adds customer_id, project_name, and active_timer tracking

-- Add customer_id (can link directly to client, not just through task)
ALTER TABLE public.time_entries 
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add project_name for project tracking
ALTER TABLE public.time_entries 
  ADD COLUMN IF NOT EXISTS project_name TEXT;

-- Add index for customer_id
CREATE INDEX IF NOT EXISTS idx_time_entries_customer_id 
  ON public.time_entries (customer_id) 
  WHERE customer_id IS NOT NULL;

-- Add index for project_name (for filtering)
CREATE INDEX IF NOT EXISTS idx_time_entries_project_name 
  ON public.time_entries (project_name) 
  WHERE project_name IS NOT NULL;

-- Add active_timer flag to track if employee is currently clocked in
-- This will be managed by the application, but we add it for querying
ALTER TABLE public.time_entries 
  ADD COLUMN IF NOT EXISTS is_active_timer BOOLEAN DEFAULT FALSE;

-- Add index for active timers (for quick lookup of who's clocked in)
CREATE INDEX IF NOT EXISTS idx_time_entries_active_timer 
  ON public.time_entries (employee_id, is_active_timer) 
  WHERE is_active_timer = TRUE;

-- Add constraint: only one active timer per employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_one_active_per_employee 
  ON public.time_entries (employee_id) 
  WHERE is_active_timer = TRUE;

COMMENT ON COLUMN public.time_entries.customer_id IS 'Direct link to client/customer (can be set independently of task)';
COMMENT ON COLUMN public.time_entries.project_name IS 'Project name for this time entry';
COMMENT ON COLUMN public.time_entries.is_active_timer IS 'True if this is an active running timer (clocked in)';

