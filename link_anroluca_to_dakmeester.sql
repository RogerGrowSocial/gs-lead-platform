-- =====================================================
-- LINK ANROLUCA TO DAKMEESTER NEDERLAND
-- =====================================================
-- Update alle facturen/records van "Anroluca" naar "Dakmeester Nederland"
-- =====================================================

BEGIN;

-- =====================================================
-- STAP 1: Check welke klanten er zijn
-- =====================================================
-- (Uncomment om te zien welke klanten gevonden worden)
-- SELECT id, name, company_name, email
-- FROM public.customers
-- WHERE name ILIKE '%anroluca%' OR company_name ILIKE '%anroluca%'
--    OR name ILIKE '%dakmeester%' OR company_name ILIKE '%dakmeester%';

-- =====================================================
-- STAP 2: Update alle facturen van Anroluca naar Dakmeester Nederland
-- =====================================================
UPDATE public.customer_invoices
SET 
  customer_id = (
    SELECT id FROM public.customers 
    WHERE (company_name ILIKE '%dakmeester nederland%' OR name ILIKE '%dakmeester nederland%')
    LIMIT 1
  ),
  updated_at = NOW()
WHERE customer_id IN (
  SELECT id FROM public.customers 
  WHERE (name ILIKE '%anroluca%' OR company_name ILIKE '%anroluca%')
    AND id != (SELECT id FROM public.customers WHERE company_name ILIKE '%dakmeester nederland%' LIMIT 1)
);

-- =====================================================
-- STAP 3: Update klantnaam Anroluca naar Dakmeester Nederland
-- =====================================================
UPDATE public.customers
SET 
  name = 'Dakmeester Nederland',
  company_name = 'Dakmeester Nederland',
  updated_at = NOW()
WHERE (name ILIKE '%anroluca%' OR company_name ILIKE '%anroluca%')
  AND id != (SELECT id FROM public.customers WHERE company_name ILIKE '%dakmeester nederland%' LIMIT 1);

-- =====================================================
-- STAP 4: (Optioneel) Verwijder duplicaat Anroluca klant
-- =====================================================
-- Uncomment als je de oude Anroluca klant wilt verwijderen na merge
-- DELETE FROM public.customers 
-- WHERE (name ILIKE '%anroluca%' OR company_name ILIKE '%anroluca%')
--   AND id != (SELECT id FROM public.customers WHERE company_name ILIKE '%dakmeester nederland%' LIMIT 1);

COMMIT;

-- Verificatie: Check of alle Anroluca facturen nu bij Dakmeester Nederland staan
SELECT 
  ci.invoice_number,
  ci.amount,
  c.name,
  c.company_name
FROM public.customer_invoices ci
JOIN public.customers c ON ci.customer_id = c.id
WHERE c.name ILIKE '%dakmeester%' OR c.company_name ILIKE '%dakmeester%'
ORDER BY ci.invoice_date DESC;
