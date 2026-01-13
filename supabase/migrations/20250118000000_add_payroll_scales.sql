-- Migration: Add payroll_scales table and scale_id to profiles
-- This enables salary scales management and assignment to employees

-- Create payroll_scales table
CREATE TABLE IF NOT EXISTS public.payroll_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  hourly_rate_cents INTEGER NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT payroll_scales_name_unique UNIQUE(name)
);

-- Add scale_id to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS payroll_scale_id UUID REFERENCES public.payroll_scales(id) ON DELETE SET NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_payroll_scales_active ON public.payroll_scales(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_payroll_scale ON public.profiles(payroll_scale_id);

-- Add comments
COMMENT ON TABLE public.payroll_scales IS 'Salary scales for employees (e.g., Manager, Developer, etc.)';
COMMENT ON COLUMN public.payroll_scales.name IS 'Name of the salary scale (e.g., "Manager", "Developer")';
COMMENT ON COLUMN public.payroll_scales.hourly_rate_cents IS 'Hourly rate in cents (e.g., 750 = €7.50/hour)';
COMMENT ON COLUMN public.profiles.payroll_scale_id IS 'Reference to the assigned payroll scale';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payroll_scales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_payroll_scales_updated_at ON public.payroll_scales;
CREATE TRIGGER trigger_update_payroll_scales_updated_at
  BEFORE UPDATE ON public.payroll_scales
  FOR EACH ROW
  EXECUTE FUNCTION update_payroll_scales_updated_at();

