-- =====================================================
-- KLANTEN ZONDER OMZET OF FACTUREN
-- =====================================================
-- Toont alle klanten die geen facturen hebben
-- =====================================================

SELECT 
  c.id,
  c.name,
  c.company_name,
  c.email,
  c.status,
  c.created_at,
  c.updated_at,
  COUNT(ci.id) as invoice_count,
  COALESCE(SUM(ci.amount), 0) as total_revenue
FROM public.customers c
LEFT JOIN public.customer_invoices ci ON c.id = ci.customer_id
GROUP BY c.id, c.name, c.company_name, c.email, c.status, c.created_at, c.updated_at
HAVING COUNT(ci.id) = 0
ORDER BY c.created_at DESC;

-- =====================================================
-- ALTERNATIEF: Klanten met 0 omzet (ook als ze facturen hebben maar totaal = 0)
-- =====================================================

SELECT 
  c.id,
  c.name,
  c.company_name,
  c.email,
  c.status,
  c.created_at,
  COUNT(ci.id) as invoice_count,
  COALESCE(SUM(ci.amount), 0) as total_revenue
FROM public.customers c
LEFT JOIN public.customer_invoices ci ON c.id = ci.customer_id
GROUP BY c.id, c.name, c.company_name, c.email, c.status, c.created_at
HAVING COALESCE(SUM(ci.amount), 0) = 0
ORDER BY c.created_at DESC;

-- =====================================================
-- SAMENVATTING: Aantal klanten zonder omzet (CORRECTE VERSIE)
-- =====================================================

WITH customers_revenue AS (
  SELECT 
    c.id,
    c.status,
    COALESCE(SUM(ci.amount), 0) as total_revenue
  FROM public.customers c
  LEFT JOIN public.customer_invoices ci ON c.id = ci.customer_id
  GROUP BY c.id, c.status
)
SELECT 
  COUNT(*) as customers_without_revenue,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_without_revenue,
  COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_without_revenue
FROM customers_revenue
WHERE total_revenue = 0;
