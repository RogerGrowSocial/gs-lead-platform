-- =====================================================
-- VIND ONTBREKENDE FACTUREN
-- =====================================================
-- Deze query toont welke factuurnummers uit de CSV nog niet in de database staan
-- =====================================================

-- Factuurnummers die bij Dakmeester Nederland horen (uit CSV)
WITH expected_invoices AS (
  SELECT unnest(ARRAY[
    'GS-0466', 'GS-0473', 'GS-0480', 'GS-0487', 
    'GS-0497', 'GS-0504', 'GS-0512', 'GS-0531', 'GS-0545'
  ]) AS invoice_number
)
SELECT 
  ei.invoice_number,
  CASE 
    WHEN ci.id IS NULL THEN '❌ ONTBREEKT'
    ELSE '✅ AANWEZIG'
  END AS status,
  ci.id as invoice_id,
  c.name as customer_name,
  ci.amount
FROM expected_invoices ei
LEFT JOIN public.customer_invoices ci ON ei.invoice_number = ci.invoice_number
LEFT JOIN public.customers c ON ci.customer_id = c.id
ORDER BY ei.invoice_number;

-- Check of deze facturen bij een andere klant staan
SELECT 
  ci.invoice_number,
  ci.amount,
  ci.invoice_date,
  c.name as current_customer,
  c.company_name as current_company
FROM public.customer_invoices ci
JOIN public.customers c ON ci.customer_id = c.id
WHERE ci.invoice_number IN (
  'GS-0466', 'GS-0473', 'GS-0480', 'GS-0487', 
  'GS-0497', 'GS-0504', 'GS-0512', 'GS-0531', 'GS-0545'
)
AND c.id != '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid  -- Niet Dakmeester Nederland
ORDER BY ci.invoice_date DESC;
