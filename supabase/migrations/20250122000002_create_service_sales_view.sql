-- =====================================================
-- CREATE SERVICE_SALES_VIEW
-- =====================================================
-- This view aggregates service sales from multiple sources:
-- 1. service_sales table (manual entries)
-- 2. Future: customer_invoices line items (when implemented)
-- 3. Future: payment line items (when implemented)
-- 
-- Currently only uses service_sales, but structured to allow
-- UNION with invoice/payment sources later
-- =====================================================

-- Create view that aggregates service sales
CREATE OR REPLACE VIEW public.service_sales_view AS
SELECT 
  id,
  service_id,
  sold_at,
  quantity,
  revenue_cents,
  cost_cents,
  customer_id,
  source,
  external_ref,
  created_at
FROM public.service_sales

-- TODO: When invoice line items are implemented, UNION with:
-- UNION ALL
-- SELECT 
--   ili.id,
--   ili.service_id,
--   inv.invoice_date::TIMESTAMPTZ as sold_at,
--   ili.quantity,
--   ili.revenue_cents,
--   ili.cost_cents,
--   inv.customer_id,
--   'invoice' as source,
--   inv.id::TEXT as external_ref,
--   inv.created_at
-- FROM public.invoice_line_items ili
-- JOIN public.customer_invoices inv ON ili.invoice_id = inv.id
-- WHERE inv.status IN ('paid', 'pending')

-- TODO: When payment line items are implemented, UNION with:
-- UNION ALL
-- SELECT 
--   pli.id,
--   pli.service_id,
--   p.paid_at as sold_at,
--   pli.quantity,
--   pli.revenue_cents,
--   pli.cost_cents,
--   p.customer_id,
--   'payment' as source,
--   p.id::TEXT as external_ref,
--   p.created_at
-- FROM public.payment_line_items pli
-- JOIN public.payments p ON pli.payment_id = p.id
-- WHERE p.status = 'paid'

;

-- Comments
COMMENT ON VIEW public.service_sales_view IS 'Unified view of service sales from all sources (service_sales, invoices, payments). Currently only uses service_sales. TODO: Add invoice_line_items and payment_line_items tables, then uncomment UNION statements above.';

-- Grant access
GRANT SELECT ON public.service_sales_view TO authenticated;

