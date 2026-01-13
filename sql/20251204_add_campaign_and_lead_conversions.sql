-- Migration: add campaign_logs, lead_conversions and tracking columns on leads
-- Compatible with Supabase / PostgreSQL

-- 1) campaign_logs table
CREATE TABLE IF NOT EXISTS public.campaign_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id uuid REFERENCES public.lead_segments (id) ON DELETE SET NULL,
  google_ads_campaign_id text,
  google_ads_customer_id text,
  region text,
  daily_budget_micros bigint,
  status text NOT NULL, -- e.g. 'SUCCESS' | 'FAILED'
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_logs_segment_id
  ON public.campaign_logs (segment_id);

CREATE INDEX IF NOT EXISTS idx_campaign_logs_created_at
  ON public.campaign_logs (created_at DESC);

-- 2) Extend leads table with tracking columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS gbraid text,
  ADD COLUMN IF NOT EXISTS wbraid text,
  ADD COLUMN IF NOT EXISTS google_ads_campaign_id text,
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_leads_gclid
  ON public.leads (gclid);

-- 3) lead_conversions table
CREATE TABLE IF NOT EXISTS public.lead_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  google_ads_campaign_id text,
  event_type text NOT NULL, -- e.g. 'form_submit', 'qualified_lead', 'sale'
  value numeric,
  currency text NOT NULL DEFAULT 'EUR',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  gclid text,
  gbraid text,
  wbraid text,
  uploaded_to_google boolean NOT NULL DEFAULT false,
  uploaded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_lead_conversions_lead_id
  ON public.lead_conversions (lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_conversions_gclid
  ON public.lead_conversions (gclid);

CREATE INDEX IF NOT EXISTS idx_lead_conversions_occurred_at
  ON public.lead_conversions (occurred_at DESC);


