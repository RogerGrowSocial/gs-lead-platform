-- =====================================================
-- ADD INACTIVE FIELDS TO CUSTOMERS TABLE
-- =====================================================
-- This adds fields to track when a customer was inactive
-- and the reason for inactivity
-- =====================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS inactive_from DATE,
  ADD COLUMN IF NOT EXISTS inactive_to DATE,
  ADD COLUMN IF NOT EXISTS inactive_reason VARCHAR(100),
  ADD COLUMN IF NOT EXISTS inactive_reason_other TEXT;

-- Add index for inactive customers
CREATE INDEX IF NOT EXISTS idx_customers_inactive_from ON public.customers(inactive_from) WHERE inactive_from IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_inactive_to ON public.customers(inactive_to) WHERE inactive_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_inactive_reason ON public.customers(inactive_reason) WHERE inactive_reason IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.customers.inactive_from IS 'Start date when customer became inactive';
COMMENT ON COLUMN public.customers.inactive_to IS 'End date when customer became active again (NULL if still inactive)';
COMMENT ON COLUMN public.customers.inactive_reason IS 'Reason for inactivity: temporary_pause, too_expensive, insufficient_results, not_matching_customer, no_capacity, switch, conflict, non_payment, other';
COMMENT ON COLUMN public.customers.inactive_reason_other IS 'Additional explanation when inactive_reason is "other"';

