-- =====================================================
-- PRICING REFACTOR: Packages as Single Source of Truth
-- =====================================================
-- Migration: 20260109000000_refactor_pricing_packages.sql
-- Goal: Enforce that every service has packages (tiers).
--       "Fixed price" = exactly 1 package.
--       Remove confusing pricing_mode logic.
-- =====================================================

-- =====================================================
-- 1. ADD archived_at TO service_price_tiers
-- =====================================================
ALTER TABLE public.service_price_tiers
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

-- Index for active packages (non-archived)
CREATE INDEX IF NOT EXISTS idx_service_price_tiers_active 
  ON public.service_price_tiers(service_id, is_active, archived_at) 
  WHERE archived_at IS NULL AND is_active = true;

-- =====================================================
-- 2. CREATE PRICING AUDIT TABLE (if not exists)
-- =====================================================
-- Note: service_audit_log already exists, but we'll add a specific
-- pricing_audit table for detailed before/after tracking
CREATE TABLE IF NOT EXISTS public.service_pricing_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'pricing_updated', 'package_added', 'package_updated', 'package_archived'
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_pricing_audit_service_id 
  ON public.service_pricing_audit(service_id);
CREATE INDEX IF NOT EXISTS idx_service_pricing_audit_created_at 
  ON public.service_pricing_audit(service_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_pricing_audit_actor 
  ON public.service_pricing_audit(actor_user_id) WHERE actor_user_id IS NOT NULL;

-- Comments
COMMENT ON TABLE public.service_pricing_audit IS 'Detailed audit log for service pricing and package changes';
COMMENT ON COLUMN public.service_pricing_audit.before_state IS 'JSONB snapshot of packages before change';
COMMENT ON COLUMN public.service_pricing_audit.after_state IS 'JSONB snapshot of packages after change';

-- =====================================================
-- 3. MIGRATION: Ensure all services have at least 1 package
-- =====================================================
-- For services without packages, create a default "Standaard" package
-- using base_price_cents or price_cents as fallback
INSERT INTO public.service_price_tiers (
  service_id,
  name,
  description,
  billing_model,
  price_cents,
  cost_cents,
  unit_label,
  is_active,
  sort_order
)
SELECT 
  s.id,
  'Standaard',
  'Standaard pakket',
  COALESCE(s.billing_model, 'one_time'),
  COALESCE(s.base_price_cents, s.price_cents, 0),
  COALESCE(s.base_cost_cents, s.cost_cents, 0),
  COALESCE(s.base_unit_label, s.unit_label),
  true,
  0
FROM public.services s
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.service_price_tiers t 
  WHERE t.service_id = s.id 
    AND t.archived_at IS NULL
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. ADD CONSTRAINT: Service must have at least 1 active package
-- =====================================================
-- Note: This is enforced at application level, not DB level,
-- because we need to allow temporary states during updates.
-- But we add a check function for validation.

CREATE OR REPLACE FUNCTION check_service_has_active_package(service_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM public.service_price_tiers
  WHERE service_id = service_uuid
    AND is_active = true
    AND archived_at IS NULL;
  
  RETURN active_count >= 1;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.service_pricing_audit ENABLE ROW LEVEL SECURITY;

-- Admins and managers can read pricing audit
CREATE POLICY "Admins and managers can read pricing audit"
  ON public.service_pricing_audit
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR EXISTS (
          SELECT 1 FROM public.roles r
          WHERE r.id = p.role_id
            AND LOWER(r.name) LIKE '%manager%'
        ))
    )
  );

-- Only system can insert (via service account)
CREATE POLICY "System can insert pricing audit"
  ON public.service_pricing_audit
  FOR INSERT
  WITH CHECK (true); -- Application-level check via service account

