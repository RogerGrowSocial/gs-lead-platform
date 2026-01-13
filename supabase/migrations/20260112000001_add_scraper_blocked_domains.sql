-- =====================================================
-- SCRAPER BLOCKED DOMAINS (Zwarte Lijst)
-- =====================================================
-- Companies/domains that should never be scraped again
-- =====================================================

CREATE TABLE IF NOT EXISTS public.scraper_blocked_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  domain TEXT,
  company_name TEXT,
  reason TEXT,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scraper_blocked_domains_domain ON public.scraper_blocked_domains(domain);
CREATE INDEX IF NOT EXISTS idx_scraper_blocked_domains_company_name ON public.scraper_blocked_domains(company_name);
CREATE INDEX IF NOT EXISTS idx_scraper_blocked_domains_opportunity_id ON public.scraper_blocked_domains(opportunity_id);

-- Comments
COMMENT ON TABLE public.scraper_blocked_domains IS 'Zwarte lijst: bedrijven/domeinen die nooit meer gescraped mogen worden';
COMMENT ON COLUMN public.scraper_blocked_domains.domain IS 'Domein om te blokkeren (optioneel)';
COMMENT ON COLUMN public.scraper_blocked_domains.company_name IS 'Bedrijfsnaam om te blokkeren (optioneel)';
COMMENT ON COLUMN public.scraper_blocked_domains.reason IS 'Reden voor blokkering';
COMMENT ON COLUMN public.scraper_blocked_domains.opportunity_id IS 'Gelinkte opportunity (als van daaruit geblokkeerd)';

-- RLS
ALTER TABLE public.scraper_blocked_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can manage blocked domains"
  ON public.scraper_blocked_domains
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

-- Add column to scraper_results to track if blocked
ALTER TABLE public.scraper_results
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;

-- Add index
CREATE INDEX IF NOT EXISTS idx_scraper_results_is_blocked ON public.scraper_results(is_blocked);

