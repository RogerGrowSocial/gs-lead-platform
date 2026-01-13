-- =====================================================
-- ADD LINE ITEMS SUPPORT TO CUSTOMER_INVOICES
-- =====================================================
-- Add JSONB column to store invoice line items
-- =====================================================

-- Add line_items column to store invoice items as JSONB
ALTER TABLE public.customer_invoices 
ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]'::jsonb;

-- Add index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_customer_invoices_line_items 
ON public.customer_invoices USING GIN (line_items);

-- Comment
COMMENT ON COLUMN public.customer_invoices.line_items IS 'Invoice line items stored as JSONB array: [{"description": "...", "quantity": 1, "unit_price": 100.00, "total": 100.00}]';

