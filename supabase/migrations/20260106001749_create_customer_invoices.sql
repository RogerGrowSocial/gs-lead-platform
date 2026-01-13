-- =====================================================
-- CREATE CUSTOMER_INVOICES TABLE
-- =====================================================
-- This table stores invoices for customers
-- Supports importing from Zoho Books and other systems
-- =====================================================

CREATE TABLE IF NOT EXISTS public.customer_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- Invoice details
  invoice_number VARCHAR(255) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  order_number VARCHAR(255),
  
  -- Financial fields
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  outstanding_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  -- Status (mapped from Zoho: Betaald, Achterstallig, Concept, Ongeldig)
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'overdue', 'pending', 'draft', 'invalid', 'cancelled')),
  
  -- External system reference (e.g., Zoho Books INVOICE_ID)
  external_id VARCHAR(255),
  external_system VARCHAR(50) DEFAULT 'zoho_books',
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_invoices_customer_id ON public.customer_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_invoice_number ON public.customer_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_status ON public.customer_invoices(status);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_invoice_date ON public.customer_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_external_id ON public.customer_invoices(external_id, external_system);
CREATE INDEX IF NOT EXISTS idx_customer_invoices_due_date ON public.customer_invoices(due_date);

-- Unique constraint on invoice_number per customer (optional, but recommended)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_invoices_customer_invoice_number 
  ON public.customer_invoices(customer_id, invoice_number);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_customer_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_customer_invoices_updated_at
  BEFORE UPDATE ON public.customer_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_invoices_updated_at();

-- Comments
COMMENT ON TABLE public.customer_invoices IS 'Invoices for customers. Supports importing from external systems like Zoho Books.';
COMMENT ON COLUMN public.customer_invoices.invoice_number IS 'Invoice number (e.g., GS-0828)';
COMMENT ON COLUMN public.customer_invoices.invoice_date IS 'Date when invoice was issued';
COMMENT ON COLUMN public.customer_invoices.due_date IS 'Date when invoice is due';
COMMENT ON COLUMN public.customer_invoices.order_number IS 'Related order number (optional)';
COMMENT ON COLUMN public.customer_invoices.amount IS 'Total invoice amount in EUR';
COMMENT ON COLUMN public.customer_invoices.outstanding_amount IS 'Outstanding/remaining amount to be paid';
COMMENT ON COLUMN public.customer_invoices.status IS 'Invoice status: paid, overdue, pending, draft, invalid, cancelled';
COMMENT ON COLUMN public.customer_invoices.external_id IS 'External system invoice ID (e.g., Zoho Books INVOICE_ID)';
COMMENT ON COLUMN public.customer_invoices.external_system IS 'Source system (e.g., zoho_books)';

