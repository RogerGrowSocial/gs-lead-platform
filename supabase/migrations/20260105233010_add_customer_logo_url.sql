-- =====================================================
-- ADD LOGO_URL TO CUSTOMERS TABLE
-- =====================================================
-- Migration: 20260105233010_add_customer_logo_url.sql
-- Doel: Logo upload functionaliteit voor klanten
-- =====================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN public.customers.logo_url IS 'URL naar het bedrijfslogo van de klant';

