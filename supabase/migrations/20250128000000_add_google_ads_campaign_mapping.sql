-- =====================================================
-- GOOGLE ADS CAMPAIGN MAPPING
-- =====================================================
-- Migration: 20250128000000_add_google_ads_campaign_mapping.sql
-- Doel: Koppel Google Ads campagnes aan segmenten
-- =====================================================

-- Voeg Google Ads campaign mapping toe aan lead_segments
ALTER TABLE public.lead_segments
  ADD COLUMN IF NOT EXISTS google_ads_campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS google_ads_campaign_name TEXT,
  ADD COLUMN IF NOT EXISTS google_ads_budget_id TEXT,
  ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT, -- Voor multi-account support
  ADD COLUMN IF NOT EXISTS google_ads_last_synced_at TIMESTAMPTZ;

-- Index voor snelle lookups
CREATE INDEX IF NOT EXISTS idx_lead_segments_google_ads_campaign_id 
  ON public.lead_segments (google_ads_campaign_id) 
  WHERE google_ads_campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_segments_google_ads_customer_id 
  ON public.lead_segments (google_ads_customer_id) 
  WHERE google_ads_customer_id IS NOT NULL;

-- Tabel voor Google Ads account configuratie (voor multi-account support)
CREATE TABLE IF NOT EXISTS public.google_ads_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Account identificatie
  customer_id TEXT UNIQUE NOT NULL, -- Google Ads Customer ID (zonder streepjes)
  account_name TEXT NOT NULL,
  
  -- OAuth credentials (encrypted in production)
  refresh_token TEXT, -- Voor OAuth refresh
  
  -- Account status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_manager_account BOOLEAN NOT NULL DEFAULT FALSE, -- MCC account
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_google_ads_accounts_customer_id 
  ON public.google_ads_accounts (customer_id) 
  WHERE is_active = TRUE;

-- RLS policies voor google_ads_accounts
ALTER TABLE public.google_ads_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'google_ads_accounts' 
    AND policyname = 'google_ads_accounts_select'
  ) THEN
    CREATE POLICY "google_ads_accounts_select" ON public.google_ads_accounts
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'google_ads_accounts' 
    AND policyname = 'google_ads_accounts_insert'
  ) THEN
    CREATE POLICY "google_ads_accounts_insert" ON public.google_ads_accounts
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'google_ads_accounts' 
    AND policyname = 'google_ads_accounts_update'
  ) THEN
    CREATE POLICY "google_ads_accounts_update" ON public.google_ads_accounts
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
      );
  END IF;
END $$;

