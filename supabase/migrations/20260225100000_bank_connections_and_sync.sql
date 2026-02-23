-- =====================================================
-- Bankkoppeling + Auto Sync (org-scoped for Admin Bankieren)
-- New: org_bank_connections, bank_sync_runs; alter bank_accounts
-- Existing bank_connections (user_id) stays for dashboard; this is for admin.
-- =====================================================

DO $$ BEGIN
  CREATE TYPE org_bank_connection_status AS ENUM ('connected', 'action_required', 'error', 'disconnected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bank_sync_run_status AS ENUM ('running', 'success', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- ORG_BANK_CONNECTIONS (one per OAuth consent, org-scoped)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.org_bank_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  provider TEXT NOT NULL DEFAULT 'rabobank',
  status org_bank_connection_status NOT NULL DEFAULT 'connected',
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  consent_id TEXT,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_bank_connections_organization ON public.org_bank_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_bank_connections_status ON public.org_bank_connections(status);
CREATE INDEX IF NOT EXISTS idx_org_bank_connections_provider ON public.org_bank_connections(provider);

COMMENT ON TABLE public.org_bank_connections IS 'Admin Bankieren: OAuth connections per organization (Rabobank). One connection can have multiple bank_accounts.';

-- =====================================================
-- BANK_ACCOUNTS: add connection_id and is_active
-- =====================================================
ALTER TABLE public.bank_accounts
  ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES public.org_bank_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_bank_accounts_connection_id ON public.bank_accounts(connection_id) WHERE connection_id IS NOT NULL;

-- =====================================================
-- BANK_SYNC_RUNS (observability)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bank_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  connection_id UUID NOT NULL REFERENCES public.org_bank_connections(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status bank_sync_run_status NOT NULL DEFAULT 'running',
  new_transactions INT NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_sync_runs_connection ON public.bank_sync_runs(connection_id);
CREATE INDEX IF NOT EXISTS idx_bank_sync_runs_started ON public.bank_sync_runs(started_at DESC);

COMMENT ON TABLE public.bank_sync_runs IS 'Log of each sync run per connection for debug and observability.';

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.org_bank_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_bank_connections_authenticated" ON public.org_bank_connections
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "bank_sync_runs_authenticated" ON public.bank_sync_runs
  FOR ALL USING (auth.uid() IS NOT NULL);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_org_bank_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_org_bank_connections_updated_at ON public.org_bank_connections;
CREATE TRIGGER trigger_org_bank_connections_updated_at
  BEFORE UPDATE ON public.org_bank_connections FOR EACH ROW EXECUTE FUNCTION public.set_org_bank_connections_updated_at();
