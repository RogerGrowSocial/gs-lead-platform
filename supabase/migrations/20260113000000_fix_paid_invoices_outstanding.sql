-- =====================================================
-- FIX PAID INVOICES OUTSTANDING AMOUNT
-- =====================================================
-- This migration corrects invoices with status 'paid' 
-- but outstanding_amount > 0 by setting outstanding_amount to 0
-- =====================================================

-- Update all invoices with status 'paid' to have outstanding_amount = 0
UPDATE public.customer_invoices
SET 
  outstanding_amount = 0,
  updated_at = NOW()
WHERE 
  status = 'paid' 
  AND outstanding_amount > 0;

-- Log how many invoices were corrected
DO $$
DECLARE
  corrected_count INTEGER;
BEGIN
  GET DIAGNOSTICS corrected_count = ROW_COUNT;
  RAISE NOTICE 'Corrected % invoices with status paid but outstanding_amount > 0', corrected_count;
END $$;

