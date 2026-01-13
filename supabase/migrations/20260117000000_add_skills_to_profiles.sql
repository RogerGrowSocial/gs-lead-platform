-- =====================================================
-- ADD SKILLS COLUMN TO PROFILES TABLE
-- =====================================================
-- This migration adds a skills column to profiles for employee skill tracking
-- Used for intelligent ticket assignment based on required skills

-- Add skills column as TEXT array (can store array of skill names)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.skills IS 'Array of skill names for employees (e.g., ["Web Development", "WordPress", "SEO", "Technical Support"])';

-- Create GIN index for efficient skill searching
CREATE INDEX IF NOT EXISTS idx_profiles_skills ON public.profiles USING GIN (skills);

-- Add is_employee flag if it doesn't exist (to distinguish employees from customers)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_employee BOOLEAN DEFAULT FALSE;

-- Create index for employee filtering
CREATE INDEX IF NOT EXISTS idx_profiles_is_employee ON public.profiles(is_employee) WHERE is_employee = TRUE;

COMMENT ON COLUMN public.profiles.is_employee IS 'Flag to indicate if this profile is an employee (true) or customer (false)';
