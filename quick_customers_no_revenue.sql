-- =====================================================
-- SNELLE QUERY: Klanten zonder facturen/omzet
-- =====================================================

SELECT 
  c.id,
  c.name,
  c.company_name,
  c.email,
  c.status
FROM public.customers c
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.customer_invoices ci 
  WHERE ci.customer_id = c.id
)
ORDER BY c.created_at DESC;
