-- Allow 'partial' status on customer_invoices for banking (deelbetalingen)
ALTER TABLE public.customer_invoices DROP CONSTRAINT IF EXISTS customer_invoices_status_check;
ALTER TABLE public.customer_invoices ADD CONSTRAINT customer_invoices_status_check
  CHECK (status IN ('paid', 'overdue', 'pending', 'partial', 'draft', 'invalid', 'cancelled'));
