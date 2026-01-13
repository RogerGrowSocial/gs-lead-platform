-- =====================================================
-- LINK MISSING INVOICE CUSTOMERS TO EXISTING CUSTOMERS
-- =====================================================
-- Koppel klanten uit de missing invoices CSV aan bestaande klanten
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Best Bottles B.V. → Jouwgeboortewijn
-- =====================================================
UPDATE public.customer_invoices
SET 
  customer_id = (
    SELECT id FROM public.customers 
    WHERE name ILIKE '%jouwgeboortewijn%' OR company_name ILIKE '%jouwgeboortewijn%'
    LIMIT 1
  ),
  updated_at = NOW()
WHERE customer_id IN (
  SELECT id FROM public.customers 
  WHERE name ILIKE '%best bottles%' OR company_name ILIKE '%best bottles%'
)
AND invoice_number IN ('GS-0450', 'GS-0451', 'GS-0463', 'GS-0464', 'GS-0474', 'GS-0475', 'GS-0501', 'GS-0507', 'GS-0513');

-- Update klantnaam Best Bottles naar Jouwgeboortewijn
UPDATE public.customers
SET 
  name = 'Jouwgeboortewijn',
  company_name = 'Jouwgeboortewijn',
  updated_at = NOW()
WHERE (name ILIKE '%best bottles%' OR company_name ILIKE '%best bottles%')
  AND id != (SELECT id FROM public.customers WHERE name ILIKE '%jouwgeboortewijn%' LIMIT 1);

-- =====================================================
-- 2. Werken bij The Workspot → The Workspot
-- =====================================================
UPDATE public.customer_invoices
SET 
  customer_id = (
    SELECT id FROM public.customers 
    WHERE name ILIKE '%workspot%' OR company_name ILIKE '%workspot%'
    LIMIT 1
  ),
  updated_at = NOW()
WHERE customer_id IN (
  SELECT id FROM public.customers 
  WHERE name ILIKE '%werken bij the workspot%' OR company_name ILIKE '%werken bij the workspot%'
)
AND invoice_number IN ('GS-0455', 'GS-0460', 'GS-0478', 'GS-0508');

-- Update klantnaam
UPDATE public.customers
SET 
  name = 'The Workspot',
  company_name = 'The Workspot',
  updated_at = NOW()
WHERE (name ILIKE '%werken bij the workspot%' OR company_name ILIKE '%werken bij the workspot%')
  AND id != (SELECT id FROM public.customers WHERE name ILIKE '%workspot%' LIMIT 1);

-- =====================================================
-- 3. Klusbedrijf Sluijter → Dakbeheer Acuut / Klusbedrijf Sluijter
-- =====================================================
UPDATE public.customer_invoices
SET 
  customer_id = (
    SELECT id FROM public.customers 
    WHERE name ILIKE '%dakbeheer acuut%' OR company_name ILIKE '%dakbeheer acuut%'
    LIMIT 1
  ),
  updated_at = NOW()
WHERE customer_id IN (
  SELECT id FROM public.customers 
  WHERE name ILIKE '%klusbedrijf sluijter%' OR company_name ILIKE '%klusbedrijf sluijter%'
)
AND invoice_number IN ('GS-0482', 'GS-0488', 'GS-0506');

-- Update klantnaam (of merge naar Dakbeheer Acuut)
UPDATE public.customers
SET 
  name = 'Dakbeheer Acuut',
  company_name = 'Dakbeheer Acuut',
  updated_at = NOW()
WHERE (name ILIKE '%klusbedrijf sluijter%' OR company_name ILIKE '%klusbedrijf sluijter%')
  AND id != (SELECT id FROM public.customers WHERE name ILIKE '%dakbeheer acuut%' LIMIT 1);

-- =====================================================
-- 4. Tofiek → Amsterdam Design
-- =====================================================
UPDATE public.customer_invoices
SET 
  customer_id = (
    SELECT id FROM public.customers 
    WHERE name ILIKE '%amsterdam design%' OR company_name ILIKE '%amsterdam design%'
    LIMIT 1
  ),
  updated_at = NOW()
WHERE customer_id IN (
  SELECT id FROM public.customers 
  WHERE name ILIKE '%tofiek%' OR company_name ILIKE '%tofiek%'
)
AND invoice_number IN ('GS-0489', 'GS-0509');

-- Update klantnaam
UPDATE public.customers
SET 
  name = 'Amsterdam Design',
  company_name = 'Amsterdam Design',
  updated_at = NOW()
WHERE (name ILIKE '%tofiek%' OR company_name ILIKE '%tofiek%')
  AND id != (SELECT id FROM public.customers WHERE name ILIKE '%amsterdam design%' LIMIT 1);

COMMIT;

-- =====================================================
-- VERIFICATIE
-- =====================================================
-- Check of alle koppelingen gelukt zijn
SELECT 
  c.name,
  c.company_name,
  COUNT(ci.id) as invoice_count,
  COALESCE(SUM(ci.amount), 0) as total_revenue
FROM public.customers c
LEFT JOIN public.customer_invoices ci ON c.id = ci.customer_id
WHERE c.name ILIKE '%jouwgeboortewijn%'
   OR c.name ILIKE '%workspot%'
   OR c.name ILIKE '%dakbeheer acuut%'
   OR c.name ILIKE '%amsterdam design%'
GROUP BY c.id, c.name, c.company_name
ORDER BY c.name;
