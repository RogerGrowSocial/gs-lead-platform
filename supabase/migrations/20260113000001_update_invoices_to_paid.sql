-- =====================================================
-- UPDATE INVOICES TO PAID WITH CORRECT AMOUNTS AND BTW
-- =====================================================
-- Updates all invoices with invoice numbers listed below
-- Sets status to 'paid', outstanding_amount to 0
-- Sets due_date = invoice_date + 14 days
-- Updates amount to €133.10 (incl. BTW)
-- Calculates and stores line items with correct BTW
-- =====================================================

-- Invoice numbers to update
WITH invoice_numbers AS (
  SELECT unnest(ARRAY[
    'GS-0822', 'GS-0810', 'GS-0801', 'GS-0783', 'GS-0772', 'GS-0760', 'GS-0747', 'GS-0729', 
    'GS-0710', 'GS-0698', 'GS-0686', 'GS-0672', 'GS-0660', 'GS-0647', 'GS-0626', 'GS-0598', 
    'GS-0571', 'GS-0558', 'GS-0544', 'GS-0530', 'GS-0510', 'GS-0502', 'GS-0495', 'GS-0459', 
    'GS-0485', 'GS-0477', 'GS-0471', 'GS-0462', 'GS-0456', 'GS-0442', 'GS-0434', 'GS-0432', 
    'GS-0429', 'GS-0422', 'GS-0419', 'GS-0417', 'GS-0416', 'ST1410', 'ST1407'
  ]) AS inv_num
),
-- Calculate amounts: €133.10 incl. BTW
amounts AS (
  SELECT 
    133.10 AS amount_incl_btw,
    ROUND(133.10 / 1.21, 2) AS amount_excl_btw,  -- €109.92
    133.10 - ROUND(133.10 / 1.21, 2) AS btw_amount  -- €23.18
)
UPDATE public.customer_invoices
SET 
  status = 'paid',
  outstanding_amount = 0,
  amount = (SELECT amount_incl_btw FROM amounts),
  due_date = invoice_date + INTERVAL '14 days',
  line_items = jsonb_build_array(
    jsonb_build_object(
      'description', 'Maandelijkse dienstverlening',
      'quantity', 1,
      'unit_price', (SELECT amount_excl_btw FROM amounts),
      'has_vat', true,
      'subtotal', (SELECT amount_excl_btw FROM amounts),
      'vat_amount', (SELECT btw_amount FROM amounts),
      'total', (SELECT amount_incl_btw FROM amounts)
    )
  ),
  updated_at = NOW()
WHERE invoice_number IN (SELECT inv_num FROM invoice_numbers)
  AND status != 'paid';  -- Only update if not already paid

-- Show results
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % invoices to paid status with amount €133.10', updated_count;
END $$;

