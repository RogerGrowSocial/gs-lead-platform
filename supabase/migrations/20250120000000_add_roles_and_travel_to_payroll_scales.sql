-- Migration: Add roles and travel expense fields to payroll_scales table
-- This enables role-based filtering and travel expense configuration per scale

-- =====================================================
-- ADD ROLES FIELD
-- =====================================================

ALTER TABLE public.payroll_scales
  ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- =====================================================
-- ADD TRAVEL EXPENSE FIELDS
-- =====================================================

-- Travel type: 'per_km', 'per_day', 'monthly' (required, no 'none' option)
-- For existing records, we'll set a default temporarily, but new records must have a valid type
ALTER TABLE public.payroll_scales
  ADD COLUMN IF NOT EXISTS travel_type VARCHAR(20);
  
-- Set default for existing records (will be updated when they are edited)
UPDATE public.payroll_scales 
SET travel_type = 'per_km' 
WHERE travel_type IS NULL;

-- Now make it NOT NULL
ALTER TABLE public.payroll_scales
  ALTER COLUMN travel_type SET NOT NULL;

-- Travel amount in cents (varies by type)
ALTER TABLE public.payroll_scales
  ADD COLUMN IF NOT EXISTS travel_amount_cents INTEGER NOT NULL DEFAULT 0;

-- Max km per day (only for per_km type)
ALTER TABLE public.payroll_scales
  ADD COLUMN IF NOT EXISTS travel_max_km_per_day INTEGER;

-- Round trip (only for per_km type, default true)
ALTER TABLE public.payroll_scales
  ADD COLUMN IF NOT EXISTS travel_roundtrip BOOLEAN NOT NULL DEFAULT true;

-- =====================================================
-- CONSTRAINTS
-- =====================================================

-- Ensure travel_type is valid (no 'none' option - travel is required)
ALTER TABLE public.payroll_scales
  ADD CONSTRAINT check_travel_type 
  CHECK (travel_type IN ('per_km', 'per_day', 'monthly'));

-- Ensure travel_amount_cents >= 0
ALTER TABLE public.payroll_scales
  ADD CONSTRAINT check_travel_amount 
  CHECK (travel_amount_cents >= 0);

-- Ensure travel_max_km_per_day > 0 if set
ALTER TABLE public.payroll_scales
  ADD CONSTRAINT check_travel_max_km 
  CHECK (travel_max_km_per_day IS NULL OR travel_max_km_per_day > 0);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN public.payroll_scales.roles IS 'Array of roles/functions for this scale (e.g., ["SEO", "Web", "Sales"])';
COMMENT ON COLUMN public.payroll_scales.travel_type IS 'Type of travel expense: per_km, per_day, monthly (required)';
COMMENT ON COLUMN public.payroll_scales.travel_amount_cents IS 'Travel expense amount in cents (varies by type)';
COMMENT ON COLUMN public.payroll_scales.travel_max_km_per_day IS 'Maximum kilometers per day (only for per_km type)';
COMMENT ON COLUMN public.payroll_scales.travel_roundtrip IS 'Whether travel is round trip (only for per_km type)';

