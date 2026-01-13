-- =====================================================
-- EXTEND SERVICES MODULE - Enterprise Features
-- =====================================================
-- This migration extends the services module with:
-- - Advanced pricing (tiers, addons, discount rules)
-- - Delivery templates
-- - Canonical line items table
-- - Audit logging
-- =====================================================

-- =====================================================
-- 1. EXTEND services TABLE
-- =====================================================
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS pricing_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (pricing_mode IN ('fixed', 'tiers', 'recurring', 'usage', 'hybrid')),
  ADD COLUMN IF NOT EXISTS billing_model TEXT NOT NULL DEFAULT 'one_time' CHECK (billing_model IN ('one_time', 'monthly', 'yearly', 'custom')),
  ADD COLUMN IF NOT EXISTS tax_profile TEXT,
  ADD COLUMN IF NOT EXISTS base_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (base_price_cents >= 0),
  ADD COLUMN IF NOT EXISTS base_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (base_cost_cents >= 0),
  ADD COLUMN IF NOT EXISTS base_unit_label TEXT,
  ADD COLUMN IF NOT EXISTS base_min_qty NUMERIC NOT NULL DEFAULT 1 CHECK (base_min_qty > 0),
  ADD COLUMN IF NOT EXISTS base_max_qty NUMERIC CHECK (base_max_qty IS NULL OR base_max_qty > 0),
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'manual' CHECK (delivery_mode IN ('manual', 'task_template', 'automated')),
  ADD COLUMN IF NOT EXISTS default_sla_hours INTEGER CHECK (default_sla_hours IS NULL OR default_sla_hours > 0),
  ADD COLUMN IF NOT EXISTS default_priority TEXT CHECK (default_priority IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_visible_to_customers BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_employee_fulfillment BOOLEAN NOT NULL DEFAULT true;

-- Migrate existing price_cents to base_price_cents if not already set
UPDATE public.services
SET base_price_cents = price_cents
WHERE base_price_cents = 0 AND price_cents > 0;

-- Migrate existing cost_cents to base_cost_cents if not already set
UPDATE public.services
SET base_cost_cents = cost_cents
WHERE base_cost_cents = 0 AND cost_cents > 0;

-- Migrate existing unit_label to base_unit_label if not already set
UPDATE public.services
SET base_unit_label = unit_label
WHERE base_unit_label IS NULL AND unit_label IS NOT NULL;

-- Indexes for new fields
CREATE INDEX IF NOT EXISTS idx_services_pricing_mode ON public.services(pricing_mode);
CREATE INDEX IF NOT EXISTS idx_services_billing_model ON public.services(billing_model);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_is_sellable ON public.services(is_sellable);

-- =====================================================
-- 2. TABLE: service_price_tiers
-- =====================================================
CREATE TABLE IF NOT EXISTS public.service_price_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  billing_model TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_model IN ('one_time', 'monthly', 'yearly', 'custom')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
  unit_label TEXT,
  included_units NUMERIC CHECK (included_units IS NULL OR included_units > 0),
  overage_price_cents INTEGER CHECK (overage_price_cents IS NULL OR overage_price_cents >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_price_tiers_service_id ON public.service_price_tiers(service_id);
CREATE INDEX IF NOT EXISTS idx_service_price_tiers_sort_order ON public.service_price_tiers(service_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_service_price_tiers_is_active ON public.service_price_tiers(service_id, is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE public.service_price_tiers IS 'Pricing tiers/packages for services (e.g., Basic/Pro/Enterprise)';
COMMENT ON COLUMN public.service_price_tiers.included_units IS 'Units included in this tier (e.g., 10 leads/month)';
COMMENT ON COLUMN public.service_price_tiers.overage_price_cents IS 'Price per unit for overage (usage-based pricing)';

-- =====================================================
-- 3. TABLE: service_addons
-- =====================================================
CREATE TABLE IF NOT EXISTS public.service_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  tier_id UUID REFERENCES public.service_price_tiers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  billing_model TEXT NOT NULL DEFAULT 'one_time' CHECK (billing_model IN ('one_time', 'monthly', 'yearly', 'custom')),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
  unit_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_addons_service_id ON public.service_addons(service_id);
CREATE INDEX IF NOT EXISTS idx_service_addons_tier_id ON public.service_addons(tier_id) WHERE tier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_addons_sort_order ON public.service_addons(service_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_service_addons_is_active ON public.service_addons(service_id, is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE public.service_addons IS 'Add-ons/upsells attachable to services or tiers';

-- =====================================================
-- 4. TABLE: service_discount_rules
-- =====================================================
CREATE TABLE IF NOT EXISTS public.service_discount_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('percentage', 'fixed_amount', 'volume', 'coupon', 'bundle')),
  applies_to TEXT NOT NULL CHECK (applies_to IN ('base', 'tier', 'addon', 'total')),
  target_tier_id UUID REFERENCES public.service_price_tiers(id) ON DELETE CASCADE,
  target_addon_id UUID REFERENCES public.service_addons(id) ON DELETE CASCADE,
  value_numeric NUMERIC NOT NULL CHECK (value_numeric >= 0),
  min_qty NUMERIC CHECK (min_qty IS NULL OR min_qty > 0),
  max_qty NUMERIC CHECK (max_qty IS NULL OR max_qty > 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_discount_rules_service_id ON public.service_discount_rules(service_id);
CREATE INDEX IF NOT EXISTS idx_service_discount_rules_is_active ON public.service_discount_rules(service_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_service_discount_rules_dates ON public.service_discount_rules(service_id, starts_at, ends_at) WHERE is_active = true;

-- Comments
COMMENT ON TABLE public.service_discount_rules IS 'Pricing rules and discounts for services';
COMMENT ON COLUMN public.service_discount_rules.value_numeric IS 'Discount value: percentage (0-100) or fixed amount in cents, depending on rule_type';

-- =====================================================
-- 5. TABLE: service_delivery_templates
-- =====================================================
CREATE TABLE IF NOT EXISTS public.service_delivery_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL CHECK (template_type IN ('task', 'checklist', 'workflow')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  auto_create_on_sale BOOLEAN NOT NULL DEFAULT false,
  default_assignee_role TEXT,
  approval_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_delivery_templates_service_id ON public.service_delivery_templates(service_id);
CREATE INDEX IF NOT EXISTS idx_service_delivery_templates_auto_create ON public.service_delivery_templates(service_id, auto_create_on_sale) WHERE auto_create_on_sale = true;

-- Comments
COMMENT ON TABLE public.service_delivery_templates IS 'Delivery templates linking services to operational delivery (tasks, checklists, workflows)';
COMMENT ON COLUMN public.service_delivery_templates.config IS 'JSONB storing task steps, required fields, workflow configuration';

-- =====================================================
-- 6. TABLE: service_line_items (canonical sales table)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.service_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  tier_id UUID REFERENCES public.service_price_tiers(id) ON DELETE SET NULL,
  addon_id UUID REFERENCES public.service_addons(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  deal_id UUID, -- Future: references deals table if exists
  invoice_id UUID, -- Future: references invoices table if exists
  payment_id UUID, -- Future: references payments table if exists
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
  revenue_cents INTEGER NOT NULL CHECK (revenue_cents >= 0),
  cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
  payout_cents INTEGER CHECK (payout_cents IS NULL OR payout_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT CHECK (source IN ('manual', 'invoice', 'checkout', 'lead_platform')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_line_items_service_id ON public.service_line_items(service_id);
CREATE INDEX IF NOT EXISTS idx_service_line_items_occurred_at ON public.service_line_items(occurred_at);
CREATE INDEX IF NOT EXISTS idx_service_line_items_customer_id ON public.service_line_items(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_line_items_invoice_id ON public.service_line_items(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_line_items_payment_id ON public.service_line_items(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_line_items_tier_id ON public.service_line_items(tier_id) WHERE tier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_line_items_addon_id ON public.service_line_items(addon_id) WHERE addon_id IS NOT NULL;

-- Comments
COMMENT ON TABLE public.service_line_items IS 'Canonical service sales/line items - source of truth for analytics and mapping to invoices/payments';
COMMENT ON COLUMN public.service_line_items.payout_cents IS 'Payout amount if platform pays workers per delivery';
COMMENT ON COLUMN public.service_line_items.meta IS 'Additional metadata (discounts applied, custom fields, etc.)';

-- =====================================================
-- 7. TABLE: service_audit_log
-- =====================================================
CREATE TABLE IF NOT EXISTS public.service_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'price_changed', 'tier_added', 'tier_updated', 'tier_removed', 'addon_added', 'addon_updated', 'addon_removed', 'rule_added', 'rule_updated', 'rule_removed', 'rule_enabled', 'rule_disabled', 'template_added', 'template_updated', 'template_removed', 'status_changed', 'archived', 'restored')),
  diff JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_audit_log_service_id ON public.service_audit_log(service_id);
CREATE INDEX IF NOT EXISTS idx_service_audit_log_created_at ON public.service_audit_log(service_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_audit_log_actor ON public.service_audit_log(actor_user_id) WHERE actor_user_id IS NOT NULL;

-- Comments
COMMENT ON TABLE public.service_audit_log IS 'Audit log for service configuration and pricing changes';
COMMENT ON COLUMN public.service_audit_log.diff IS 'JSONB storing before/after values for changes';

-- =====================================================
-- 8. TRIGGERS
-- =====================================================

-- Generic updated_at trigger function (reuse if exists, otherwise create)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_update_service_price_tiers_updated_at ON public.service_price_tiers;
CREATE TRIGGER trigger_update_service_price_tiers_updated_at
  BEFORE UPDATE ON public.service_price_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_service_addons_updated_at ON public.service_addons;
CREATE TRIGGER trigger_update_service_addons_updated_at
  BEFORE UPDATE ON public.service_addons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_service_discount_rules_updated_at ON public.service_discount_rules;
CREATE TRIGGER trigger_update_service_discount_rules_updated_at
  BEFORE UPDATE ON public.service_discount_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_service_delivery_templates_updated_at ON public.service_delivery_templates;
CREATE TRIGGER trigger_update_service_delivery_templates_updated_at
  BEFORE UPDATE ON public.service_delivery_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE public.service_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_discount_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_delivery_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_audit_log ENABLE ROW LEVEL SECURITY;

-- Service price tiers: Admin/Manager full access, Employee read-only
CREATE POLICY "Admins and managers can manage service price tiers"
  ON public.service_price_tiers
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

CREATE POLICY "Employees can view active service price tiers"
  ON public.service_price_tiers
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.employee_status = 'active'
    )
  );

-- Service addons: Admin/Manager full access, Employee read-only
CREATE POLICY "Admins and managers can manage service addons"
  ON public.service_addons
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

CREATE POLICY "Employees can view active service addons"
  ON public.service_addons
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.employee_status = 'active'
    )
  );

-- Service discount rules: Admin/Manager full access, Employee read-only
CREATE POLICY "Admins and managers can manage service discount rules"
  ON public.service_discount_rules
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

CREATE POLICY "Employees can view active service discount rules"
  ON public.service_discount_rules
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.employee_status = 'active'
    )
  );

-- Service delivery templates: Admin/Manager full access, Employee read-only
CREATE POLICY "Admins and managers can manage service delivery templates"
  ON public.service_delivery_templates
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

CREATE POLICY "Employees can view service delivery templates"
  ON public.service_delivery_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.employee_status = 'active'
    )
  );

-- Service line items: Admin/Manager full access, Employee read-only (cost hidden at API level)
CREATE POLICY "Admins and managers can manage service line items"
  ON public.service_line_items
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

CREATE POLICY "Employees can view service line items (for aggregated KPIs)"
  ON public.service_line_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.employee_status = 'active'
    )
  );

-- Service audit log: Admin/Manager full access, Employee read-only
CREATE POLICY "Admins and managers can view service audit log"
  ON public.service_audit_log
  FOR SELECT
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

CREATE POLICY "Employees can view service audit log"
  ON public.service_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.employee_status = 'active'
    )
  );

-- =====================================================
-- 10. MIGRATION NOTES
-- =====================================================
-- This migration extends the services module with enterprise features.
-- Existing service_sales table remains for backward compatibility.
-- service_line_items is the new canonical table for analytics.
-- Future: migrate service_sales data to service_line_items if needed.

