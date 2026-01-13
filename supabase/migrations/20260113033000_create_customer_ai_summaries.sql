-- =====================================================
-- CUSTOMER AI SUMMARIES (CACHE)
-- =====================================================
-- Stores the latest AI-generated summary per customer for fast display in the UI.
-- The summary is derived data; it is safe to regenerate at any time.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.customer_ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  model TEXT,
  prompt_version TEXT DEFAULT 'v1',
  source_snapshot JSONB,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_ai_summaries_unique_customer UNIQUE (customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_ai_summaries_customer_id
  ON public.customer_ai_summaries(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_ai_summaries_updated_at
  ON public.customer_ai_summaries(updated_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_customer_ai_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_ai_summaries_updated_at ON public.customer_ai_summaries;
CREATE TRIGGER trigger_update_customer_ai_summaries_updated_at
  BEFORE UPDATE ON public.customer_ai_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_ai_summaries_updated_at();

COMMENT ON TABLE public.customer_ai_summaries IS 'Cached AI summaries per customer (derived, regeneratable).';
COMMENT ON COLUMN public.customer_ai_summaries.source_snapshot IS 'Optional JSON snapshot of the inputs used to generate the summary (for debugging).';

