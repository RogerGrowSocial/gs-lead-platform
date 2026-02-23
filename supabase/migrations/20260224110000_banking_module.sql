-- =====================================================
-- AI Bankier / Banking module
-- Tables: bank_accounts, bank_transactions, bank_transaction_suggestions,
--         bank_transaction_matches, finance_post_catalog, counterparty_rules
-- RLS: organization-scoped; access enforced by app (isManagerOrAdmin)
-- =====================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE bank_transaction_direction AS ENUM ('in', 'out');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bank_transaction_status AS ENUM ('new', 'suggested', 'linked', 'posted', 'exception');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bank_suggested_type AS ENUM ('invoice_match', 'ledger_post', 'transfer', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bank_vat_type AS ENUM ('vat_21', 'vat_9', 'vat_0', 'reverse_charge', 'exempt', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE counterparty_match_type AS ENUM ('iban', 'name_contains', 'regex');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE finance_post_direction AS ENUM ('both', 'in', 'out');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- BANK_ACCOUNTS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  name TEXT NOT NULL,
  iban TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  provider TEXT,
  provider_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_organization ON public.bank_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_iban ON public.bank_accounts(iban);

COMMENT ON TABLE public.bank_accounts IS 'Bank accounts used for importing and matching transactions.';

-- =====================================================
-- BANK_TRANSACTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  booked_at TIMESTAMPTZ NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  direction bank_transaction_direction NOT NULL,
  counterparty_name TEXT,
  counterparty_iban TEXT,
  description TEXT,
  remittance_info TEXT,
  end_to_end_id TEXT,
  reference_hash TEXT,
  raw_json JSONB,
  status bank_transaction_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_bank_transactions_reference_hash UNIQUE (bank_account_id, reference_hash)
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_organization_booked ON public.bank_transactions(organization_id, booked_at DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON public.bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_bank_account ON public.bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_reference_hash ON public.bank_transactions(reference_hash) WHERE reference_hash IS NOT NULL;

COMMENT ON TABLE public.bank_transactions IS 'Imported bank transactions; status: new → suggested → linked/posted/exception.';
COMMENT ON COLUMN public.bank_transactions.reference_hash IS 'Deduplication key (e.g. hash of account+date+amount+ref).';

-- =====================================================
-- BANK_TRANSACTION_SUGGESTIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bank_transaction_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  model_version TEXT,
  suggested_type bank_suggested_type NOT NULL,
  suggested_invoice_ids UUID[],
  suggested_invoice_scores JSONB,
  suggested_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  suggested_deal_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  suggested_post_code TEXT,
  suggested_vat_type bank_vat_type,
  suggested_split JSONB,
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reasons JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transaction_suggestions_transaction ON public.bank_transaction_suggestions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_bank_transaction_suggestions_type ON public.bank_transaction_suggestions(suggested_type);

COMMENT ON TABLE public.bank_transaction_suggestions IS 'AI/rule-based suggestions for matching or posting a transaction.';

-- =====================================================
-- BANK_TRANSACTION_MATCHES (allocations to invoices)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bank_transaction_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.customer_invoices(id) ON DELETE SET NULL,
  allocated_cents INTEGER NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_transaction_matches_transaction ON public.bank_transaction_matches(transaction_id);
CREATE INDEX IF NOT EXISTS idx_bank_transaction_matches_invoice ON public.bank_transaction_matches(invoice_id) WHERE invoice_id IS NOT NULL;

COMMENT ON TABLE public.bank_transaction_matches IS 'Links bank transactions to invoices (supports split/partial).';

-- =====================================================
-- BANK_TRANSACTION_POSTINGS (ledger post when not invoice match)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.bank_transaction_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.bank_transactions(id) ON DELETE CASCADE,
  post_code TEXT NOT NULL REFERENCES public.finance_post_catalog(code) ON DELETE RESTRICT,
  vat_type bank_vat_type,
  amount_cents INTEGER NOT NULL,
  attachment_url TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_transaction_postings_transaction ON public.bank_transaction_postings(transaction_id);
COMMENT ON TABLE public.bank_transaction_postings IS 'Ledger post when transaction is booked as expense/income (not invoice match).';

-- =====================================================
-- FINANCE_POST_CATALOG (posten / chart of accounts)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.finance_post_catalog (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  direction finance_post_direction NOT NULL DEFAULT 'both',
  default_vat_type bank_vat_type,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.finance_post_catalog IS 'Ledger posts (posten); RGS-ready via stable code.';

-- Seed default posten
INSERT INTO public.finance_post_catalog (code, name, direction, default_vat_type, is_system) VALUES
  ('omzet', 'Omzet', 'in', 'vat_21', true),
  ('interne-overboeking', 'Interne overboeking', 'both', 'unknown', true),
  ('marketing', 'Marketingkosten', 'out', 'vat_21', true),
  ('software', 'Software / abonnementen', 'out', 'vat_21', true),
  ('loon', 'Lonen', 'out', 'exempt', true),
  ('belasting', 'Belastingen', 'out', 'unknown', true),
  ('kantoor', 'Kantoor / algemeen', 'out', 'vat_21', true),
  ('verzekering', 'Verzekeringen', 'out', 'vat_0', true),
  ('bankkosten', 'Bankkosten', 'out', 'vat_0', true),
  ('processor-payout', 'Betaalprovider uitbetaling', 'in', 'vat_0', true)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- COUNTERPARTY_RULES (learning: IBAN/name → post/customer/deal)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.counterparty_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  match_type counterparty_match_type NOT NULL,
  match_value TEXT NOT NULL,
  default_post_code TEXT REFERENCES public.finance_post_catalog(code) ON DELETE SET NULL,
  default_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  default_deal_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  auto_accept BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counterparty_rules_organization ON public.counterparty_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_counterparty_rules_match_value ON public.counterparty_rules(match_value);

COMMENT ON TABLE public.counterparty_rules IS 'Learned rules: counterparty IBAN/name → default post, customer, deal.';

-- =====================================================
-- CUSTOMER_INVOICES: add open_amount_cents and deal_id if missing
-- =====================================================
ALTER TABLE public.customer_invoices
  ADD COLUMN IF NOT EXISTS open_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_invoices_deal_id ON public.customer_invoices(deal_id) WHERE deal_id IS NOT NULL;

-- Backfill open_amount_cents from outstanding_amount (cents)
UPDATE public.customer_invoices
SET open_amount_cents = ROUND(COALESCE(outstanding_amount, 0) * 100)::INTEGER
WHERE open_amount_cents IS NULL;

-- Trigger to keep open_amount_cents in sync with outstanding_amount
CREATE OR REPLACE FUNCTION public.sync_customer_invoices_open_amount_cents()
RETURNS TRIGGER AS $$
BEGIN
  NEW.open_amount_cents := ROUND(COALESCE(NEW.outstanding_amount, 0) * 100)::INTEGER;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_open_amount_cents ON public.customer_invoices;
CREATE TRIGGER trigger_sync_open_amount_cents
  BEFORE INSERT OR UPDATE OF outstanding_amount ON public.customer_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_invoices_open_amount_cents();

-- =====================================================
-- RLS (application enforces isManagerOrAdmin; RLS for direct client)
-- =====================================================
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transaction_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transaction_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transaction_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_post_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counterparty_rules ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can do all (app middleware restricts to manager/admin/finance)
CREATE POLICY "bank_accounts_authenticated" ON public.bank_accounts
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "bank_transactions_authenticated" ON public.bank_transactions
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "bank_transaction_suggestions_authenticated" ON public.bank_transaction_suggestions
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "bank_transaction_matches_authenticated" ON public.bank_transaction_matches
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "bank_transaction_postings_authenticated" ON public.bank_transaction_postings
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "finance_post_catalog_read" ON public.finance_post_catalog
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "counterparty_rules_authenticated" ON public.counterparty_rules
  FOR ALL USING (auth.uid() IS NOT NULL);

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_bank_accounts_updated_at ON public.bank_accounts;
CREATE TRIGGER trigger_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_bank_transactions_updated_at ON public.bank_transactions;
CREATE TRIGGER trigger_bank_transactions_updated_at
  BEFORE UPDATE ON public.bank_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
