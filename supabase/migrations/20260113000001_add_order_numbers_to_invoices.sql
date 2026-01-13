-- =====================================================
-- ADD ORDER NUMBERS TO INVOICES
-- =====================================================
-- Generate order numbers for invoices based on invoice date
-- Format: ORD-YYYYMMDD (e.g., ORD-20251220 for invoice dated 20-12-2025)
-- =====================================================

UPDATE public.customer_invoices
SET 
  order_number = 'ORD-' || TO_CHAR(invoice_date, 'YYYYMMDD'),
  updated_at = NOW()
WHERE 
  invoice_number IN (
    'GS-0822', 'GS-0810', 'GS-0801', 'GS-0783', 'GS-0772', 'GS-0760', 'GS-0747', 'GS-0729', 
    'GS-0710', 'GS-0698', 'GS-0686', 'GS-0672', 'GS-0660', 'GS-0647', 'GS-0626', 'GS-0598', 
    'GS-0571', 'GS-0558', 'GS-0544', 'GS-0530', 'GS-0510', 'GS-0502', 'GS-0495', 'GS-0459', 
    'GS-0485', 'GS-0477', 'GS-0471', 'GS-0462', 'GS-0456', 'GS-0442', 'GS-0434', 'GS-0432', 
    'GS-0429', 'GS-0422', 'GS-0419', 'GS-0417', 'GS-0416', 'ST1410', 'ST1407'
  )
  AND (order_number IS NULL OR order_number = '' OR order_number = '-');

-- Show count of updated invoices
SELECT 
  COUNT(*) as updated_count,
  MIN(order_number) as first_order_number,
  MAX(order_number) as last_order_number
FROM public.customer_invoices 
WHERE invoice_number IN (
  'GS-0822', 'GS-0810', 'GS-0801', 'GS-0783', 'GS-0772', 'GS-0760', 'GS-0747', 'GS-0729', 
  'GS-0710', 'GS-0698', 'GS-0686', 'GS-0672', 'GS-0660', 'GS-0647', 'GS-0626', 'GS-0598', 
  'GS-0571', 'GS-0558', 'GS-0544', 'GS-0530', 'GS-0510', 'GS-0502', 'GS-0495', 'GS-0459', 
  'GS-0485', 'GS-0477', 'GS-0471', 'GS-0462', 'GS-0456', 'GS-0442', 'GS-0434', 'GS-0432', 
  'GS-0429', 'GS-0422', 'GS-0419', 'GS-0417', 'GS-0416', 'ST1410', 'ST1407'
) AND order_number IS NOT NULL;

