-- =====================================================
-- SERVICES MODULE - Database Schema
-- =====================================================
-- This module manages services (what we sell), pricing, costs, and sales analytics
-- Future-proof schema to support mapping to invoices/payments later
-- =====================================================

-- =====================================================
-- TABLE 1: services
-- =====================================================
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  service_type TEXT NOT NULL CHECK (service_type IN ('one_time', 'recurring', 'per_lead', 'hourly')),
  pricing_model TEXT NOT NULL DEFAULT 'fixed' CHECK (pricing_model IN ('fixed', 'per_unit', 'hourly', 'recurring')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  default_currency TEXT NOT NULL DEFAULT 'EUR',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
  unit_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for services
CREATE INDEX IF NOT EXISTS idx_services_slug ON public.services(slug);
CREATE INDEX IF NOT EXISTS idx_services_status ON public.services(status);
CREATE INDEX IF NOT EXISTS idx_services_service_type ON public.services(service_type);
CREATE INDEX IF NOT EXISTS idx_services_sort_order ON public.services(sort_order);

-- Comments
COMMENT ON TABLE public.services IS 'Services catalog - what we sell, pricing, and costs';
COMMENT ON COLUMN public.services.name IS 'Service name (e.g., "Website Development", "SEO")';
COMMENT ON COLUMN public.services.slug IS 'URL-friendly unique identifier';
COMMENT ON COLUMN public.services.service_type IS 'Service type: one_time, recurring, per_lead, hourly';
COMMENT ON COLUMN public.services.pricing_model IS 'Pricing model for future billing integration: fixed, per_unit, hourly, recurring';
COMMENT ON COLUMN public.services.price_cents IS 'Selling price in cents (e.g., 7500 = €75.00)';
COMMENT ON COLUMN public.services.cost_cents IS 'Cost baseline in cents (e.g., 5000 = €50.00)';
COMMENT ON COLUMN public.services.unit_label IS 'Unit label (e.g., "lead", "maand", "uur", "project")';

-- =====================================================
-- TABLE 2: service_sales
-- =====================================================
CREATE TABLE IF NOT EXISTS public.service_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
  revenue_cents INTEGER NOT NULL CHECK (revenue_cents >= 0),
  cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  source TEXT CHECK (source IN ('manual', 'invoice', 'lead_platform')),
  external_ref TEXT, -- Future: invoice_id, payment_id, lead_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for service_sales
CREATE INDEX IF NOT EXISTS idx_service_sales_sold_at ON public.service_sales(sold_at);
CREATE INDEX IF NOT EXISTS idx_service_sales_service_id ON public.service_sales(service_id);
CREATE INDEX IF NOT EXISTS idx_service_sales_customer_id ON public.service_sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_sales_external_ref ON public.service_sales(external_ref);

-- Comments
COMMENT ON TABLE public.service_sales IS 'Service sales records - source of truth for KPI analytics';
COMMENT ON COLUMN public.service_sales.revenue_cents IS 'Revenue from this sale in cents';
COMMENT ON COLUMN public.service_sales.cost_cents IS 'Cost for this sale in cents';
COMMENT ON COLUMN public.service_sales.source IS 'Source: manual, invoice, lead_platform';
COMMENT ON COLUMN public.service_sales.external_ref IS 'Future: reference to invoice_id, payment_id, or lead_id';

-- =====================================================
-- TRIGGERS
-- =====================================================
-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_services_updated_at ON public.services;
CREATE TRIGGER trigger_update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION update_services_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_sales ENABLE ROW LEVEL SECURITY;

-- Services: Admin/Manager can do everything, Employee can only view active/inactive (not archived)
CREATE POLICY "Admins and managers can manage all services"
  ON public.services
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.is_admin = true
        OR EXISTS (
          SELECT 1 FROM public.roles
          WHERE roles.id = profiles.role_id
          AND LOWER(roles.name) LIKE '%manager%'
        )
      )
    )
  );

CREATE POLICY "Employees can view active and inactive services"
  ON public.services
  FOR SELECT
  USING (
    status IN ('active', 'inactive')
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.employee_status = 'active'
    )
  );

-- Service sales: Admin/Manager can do everything, Employee can view aggregated data only (cost hidden at API level)
CREATE POLICY "Admins and managers can manage service sales"
  ON public.service_sales
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.is_admin = true
        OR EXISTS (
          SELECT 1 FROM public.roles
          WHERE roles.id = profiles.role_id
          AND LOWER(roles.name) LIKE '%manager%'
        )
      )
    )
  );

CREATE POLICY "Employees can view service sales (for aggregated KPIs)"
  ON public.service_sales
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.employee_status = 'active'
    )
  );

