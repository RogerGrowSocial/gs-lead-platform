-- =====================================================
-- SCRAPER MODULE - Database Schema
-- =====================================================
-- This module manages web scraping jobs for finding potential customers (kansen)
-- Uses Tavily API for search + OpenAI for enrichment
-- =====================================================

-- =====================================================
-- TABLE 1: scraper_jobs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.scraper_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  location_text TEXT NOT NULL,
  radius_km INTEGER NOT NULL DEFAULT 20,
  branches JSONB NOT NULL DEFAULT '[]'::jsonb,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  desired_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_results INTEGER NOT NULL DEFAULT 50,
  only_nl BOOLEAN NOT NULL DEFAULT true,
  max_pages_per_domain INTEGER NOT NULL DEFAULT 2,
  progress_total INTEGER NOT NULL DEFAULT 0,
  progress_done INTEGER NOT NULL DEFAULT 0,
  progress_found INTEGER NOT NULL DEFAULT 0,
  progress_enriched INTEGER NOT NULL DEFAULT 0,
  progress_errors INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes for scraper_jobs
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_created_at ON public.scraper_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_status ON public.scraper_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_created_by ON public.scraper_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_scraper_jobs_service_id ON public.scraper_jobs(service_id);

-- Comments
COMMENT ON TABLE public.scraper_jobs IS 'Scraping jobs for finding potential customers';
COMMENT ON COLUMN public.scraper_jobs.branches IS 'Array of branch names (strings)';
COMMENT ON COLUMN public.scraper_jobs.desired_fields IS 'Array of field names to extract (e.g., ["company_name", "phone", "email"])';
COMMENT ON COLUMN public.scraper_jobs.meta IS 'Additional metadata (search queries, etc.)';

-- =====================================================
-- TABLE 2: scraper_results
-- =====================================================
CREATE TABLE IF NOT EXISTS public.scraper_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.scraper_jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_url TEXT,
  source_domain TEXT,
  company_name TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  postcode TEXT,
  country TEXT NOT NULL DEFAULT 'NL',
  contact_person TEXT,
  branch TEXT,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  fit_score INTEGER NOT NULL DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
  fit_reason TEXT,
  confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_snippets JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  dedupe_key TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'created_as_kans', 'discarded')),
  opportunity_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes for scraper_results
CREATE INDEX IF NOT EXISTS idx_scraper_results_job_id ON public.scraper_results(job_id);
CREATE INDEX IF NOT EXISTS idx_scraper_results_dedupe_key ON public.scraper_results(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_scraper_results_source_domain ON public.scraper_results(source_domain);
CREATE INDEX IF NOT EXISTS idx_scraper_results_email ON public.scraper_results(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scraper_results_phone ON public.scraper_results(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scraper_results_status ON public.scraper_results(status);
CREATE INDEX IF NOT EXISTS idx_scraper_results_fit_score ON public.scraper_results(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_scraper_results_created_at ON public.scraper_results(created_at DESC);

-- Comments
COMMENT ON TABLE public.scraper_results IS 'Scraped results (potential customers/kansen)';
COMMENT ON COLUMN public.scraper_results.confidence IS 'Per-field confidence scores (0-1)';
COMMENT ON COLUMN public.scraper_results.raw_snippets IS 'Raw text snippets from source pages';
COMMENT ON COLUMN public.scraper_results.dedupe_key IS 'Normalized key for deduplication (domain or name+city)';
COMMENT ON COLUMN public.scraper_results.opportunity_id IS 'Linked opportunity ID when converted to kans';

-- =====================================================
-- TABLE 3: scraper_call_scripts
-- =====================================================
CREATE TABLE IF NOT EXISTS public.scraper_call_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Standaard belscript',
  script_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for scraper_call_scripts
CREATE INDEX IF NOT EXISTS idx_scraper_call_scripts_service_id ON public.scraper_call_scripts(service_id);
CREATE INDEX IF NOT EXISTS idx_scraper_call_scripts_is_active ON public.scraper_call_scripts(service_id, is_active) WHERE is_active = true;

-- Unique constraint: one active script per service (optional, but recommended)
-- We allow multiple scripts per service but only one active
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_scraper_call_scripts_service_active 
--   ON public.scraper_call_scripts(service_id) WHERE is_active = true;

-- Comments
COMMENT ON TABLE public.scraper_call_scripts IS 'Call scripts for different services';
COMMENT ON COLUMN public.scraper_call_scripts.script_text IS 'The actual script text (Dutch)';

-- =====================================================
-- TRIGGERS: updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_scraper_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_scraper_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_scraper_call_scripts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_scraper_jobs_updated_at ON public.scraper_jobs;
CREATE TRIGGER trigger_update_scraper_jobs_updated_at
  BEFORE UPDATE ON public.scraper_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_scraper_jobs_updated_at();

DROP TRIGGER IF EXISTS trigger_update_scraper_results_updated_at ON public.scraper_results;
CREATE TRIGGER trigger_update_scraper_results_updated_at
  BEFORE UPDATE ON public.scraper_results
  FOR EACH ROW
  EXECUTE FUNCTION update_scraper_results_updated_at();

DROP TRIGGER IF EXISTS trigger_update_scraper_call_scripts_updated_at ON public.scraper_call_scripts;
CREATE TRIGGER trigger_update_scraper_call_scripts_updated_at
  BEFORE UPDATE ON public.scraper_call_scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_scraper_call_scripts_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE public.scraper_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_call_scripts ENABLE ROW LEVEL SECURITY;

-- scraper_jobs: Admin/Manager full CRUD, Employee no access
CREATE POLICY "Admins and managers can manage scraper jobs"
  ON public.scraper_jobs
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

-- scraper_results: Admin/Manager full CRUD, Employee no access
CREATE POLICY "Admins and managers can manage scraper results"
  ON public.scraper_results
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

-- scraper_call_scripts: Admin/Manager full CRUD, Employee no access
CREATE POLICY "Admins and managers can manage call scripts"
  ON public.scraper_call_scripts
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

