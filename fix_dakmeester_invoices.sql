-- =====================================================
-- FIX DAKMEESTER NEDERLAND FACTUREN
-- =====================================================
-- Deze query zoekt facturen die mogelijk bij de verkeerde klant staan
-- en koppelt ze aan Dakmeester Nederland
-- =====================================================

BEGIN;

-- =====================================================
-- STAP 1: Check welke facturen mogelijk bij Dakmeester Nederland horen
-- =====================================================
-- Zoek facturen met "Dakmeester" in external_id, notes, of gekoppeld aan Anroluca
SELECT 
  ci.id,
  ci.invoice_number,
  ci.invoice_date,
  ci.amount,
  ci.external_id,
  ci.notes,
  c.id as current_customer_id,
  c.name as current_customer_name,
  c.company_name as current_company_name
FROM public.customer_invoices ci
JOIN public.customers c ON ci.customer_id = c.id
WHERE ci.external_id ILIKE '%GS-046%'  -- Dakmeester facturen beginnen vaak met GS-046
   OR ci.external_id ILIKE '%GS-047%'
   OR ci.external_id ILIKE '%GS-048%'
   OR ci.external_id ILIKE '%GS-049%'
   OR ci.external_id ILIKE '%GS-050%'
   OR ci.external_id ILIKE '%GS-051%'
   OR ci.external_id ILIKE '%GS-053%'
   OR ci.external_id ILIKE '%GS-054%'
   OR ci.external_id ILIKE '%GS-055%'
   OR ci.notes ILIKE '%dakmeester%'
   OR c.name ILIKE '%anroluca%'
   OR c.company_name ILIKE '%anroluca%'
ORDER BY ci.invoice_date DESC;

-- =====================================================
-- STAP 2: Update facturen van Anroluca naar Dakmeester Nederland
-- =====================================================
UPDATE public.customer_invoices
SET 
  customer_id = '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid,  -- Dakmeester Nederland ID
  updated_at = NOW()
WHERE customer_id IN (
  SELECT id FROM public.customers 
  WHERE (name ILIKE '%anroluca%' OR company_name ILIKE '%anroluca%')
)
AND customer_id != '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid;

-- =====================================================
-- STAP 3: Update facturen die "Dakmeester" in notes hebben maar bij andere klant staan
-- =====================================================
UPDATE public.customer_invoices
SET 
  customer_id = '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid,  -- Dakmeester Nederland ID
  updated_at = NOW()
WHERE notes ILIKE '%dakmeester%'
  AND customer_id != '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid;

-- =====================================================
-- STAP 4: Update specifieke factuurnummers die we weten dat bij Dakmeester horen
-- =====================================================
-- Deze factuurnummers komen uit de CSV voor Dakmeester Nederland:
-- GS-0466, GS-0473, GS-0480, GS-0487, GS-0497, GS-0504, GS-0512, GS-0531, GS-0545
UPDATE public.customer_invoices
SET 
  customer_id = '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid,  -- Dakmeester Nederland ID
  updated_at = NOW()
WHERE invoice_number IN (
  'GS-0466', 'GS-0473', 'GS-0480', 'GS-0487', 
  'GS-0497', 'GS-0504', 'GS-0512', 'GS-0531', 'GS-0545'
)
AND customer_id != '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid;

-- =====================================================
-- STAP 5: Verificatie - Check of Dakmeester Nederland nu facturen heeft
-- =====================================================
SELECT 
  c.name,
  c.company_name,
  COUNT(ci.id) as invoice_count,
  COALESCE(SUM(ci.amount), 0) as total_revenue
FROM public.customers c
LEFT JOIN public.customer_invoices ci ON c.id = ci.customer_id
WHERE c.id = '78962f95-0e96-48c8-a30f-85c8c0e530b7'::uuid
GROUP BY c.id, c.name, c.company_name;

COMMIT;
