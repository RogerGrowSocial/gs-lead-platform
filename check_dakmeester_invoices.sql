-- =====================================================
-- CHECK DAKMEESTER NEDERLAND FACTUREN
-- =====================================================
-- Controleer of Dakmeester Nederland facturen heeft
-- en of er mogelijk een andere klant is (Anroluca?)
-- =====================================================

-- Check Dakmeester Nederland facturen
SELECT 
  ci.id,
  ci.invoice_number,
  ci.invoice_date,
  ci.amount,
  ci.status,
  c.id as customer_id,
  c.name,
  c.company_name
FROM public.customer_invoices ci
JOIN public.customers c ON ci.customer_id = c.id
WHERE c.name ILIKE '%dakmeester%' 
   OR c.company_name ILIKE '%dakmeester%'
ORDER BY ci.invoice_date DESC;

-- Check Anroluca facturen
SELECT 
  ci.id,
  ci.invoice_number,
  ci.invoice_date,
  ci.amount,
  ci.status,
  c.id as customer_id,
  c.name,
  c.company_name
FROM public.customer_invoices ci
JOIN public.customers c ON ci.customer_id = c.id
WHERE c.name ILIKE '%anroluca%' 
   OR c.company_name ILIKE '%anroluca%'
ORDER BY ci.invoice_date DESC;

-- Check alle klanten met "dak" in de naam
SELECT 
  c.id,
  c.name,
  c.company_name,
  c.status,
  COUNT(ci.id) as invoice_count,
  COALESCE(SUM(ci.amount), 0) as total_revenue
FROM public.customers c
LEFT JOIN public.customer_invoices ci ON c.id = ci.customer_id
WHERE c.name ILIKE '%dak%' 
   OR c.company_name ILIKE '%dak%'
GROUP BY c.id, c.name, c.company_name, c.status
ORDER BY total_revenue DESC;
