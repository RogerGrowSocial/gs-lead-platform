-- Migration: Add KVK (Chamber of Commerce) verification fields to profiles table
-- This migration adds columns for storing KVK API verification data
-- Date: 2025-01-27

-- =====================================================
-- PROFILES TABLE EXTENSIONS - KVK VERIFICATION
-- =====================================================

-- Add KVK verification status
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS kvk_verified BOOLEAN DEFAULT false;

-- Add KVK verification timestamp
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS kvk_verified_at TIMESTAMP WITH TIME ZONE;

-- Add official company name from KVK
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS kvk_company_name TEXT;

-- Add company founding date from KVK
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS kvk_founding_date DATE;

-- Add company status from KVK (e.g., "Actief", "Opgeheven")
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS kvk_status TEXT;

-- Add full KVK API response data (JSONB for flexibility)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS kvk_data JSONB;

-- Add flags for data mismatches (for review purposes)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS kvk_name_mismatch BOOLEAN DEFAULT false;

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS kvk_address_mismatch BOOLEAN DEFAULT false;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for filtering verified KVK numbers
CREATE INDEX IF NOT EXISTS idx_profiles_kvk_verified 
  ON public.profiles(kvk_verified) 
  WHERE kvk_verified = true;

-- Index for filtering unverified KVK numbers
CREATE INDEX IF NOT EXISTS idx_profiles_kvk_unverified 
  ON public.profiles(kvk_verified) 
  WHERE kvk_verified = false AND coc_number IS NOT NULL;

-- Index for KVK verification timestamp (for monitoring)
CREATE INDEX IF NOT EXISTS idx_profiles_kvk_verified_at 
  ON public.profiles(kvk_verified_at) 
  WHERE kvk_verified_at IS NOT NULL;

-- Index for KVK status queries
CREATE INDEX IF NOT EXISTS idx_profiles_kvk_status 
  ON public.profiles(kvk_status) 
  WHERE kvk_status IS NOT NULL;

-- Index for KVK data mismatches (for review)
CREATE INDEX IF NOT EXISTS idx_profiles_kvk_mismatches 
  ON public.profiles(kvk_name_mismatch, kvk_address_mismatch) 
  WHERE kvk_name_mismatch = true OR kvk_address_mismatch = true;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN public.profiles.kvk_verified IS 'Indicates if KVK number has been verified via KVK API';
COMMENT ON COLUMN public.profiles.kvk_verified_at IS 'Timestamp when KVK number was last verified';
COMMENT ON COLUMN public.profiles.kvk_company_name IS 'Official company name from KVK API (may differ from user-provided name)';
COMMENT ON COLUMN public.profiles.kvk_founding_date IS 'Company founding date from KVK API';
COMMENT ON COLUMN public.profiles.kvk_status IS 'Company status from KVK API (e.g., "Actief", "Opgeheven")';
COMMENT ON COLUMN public.profiles.kvk_data IS 'Full JSON response from KVK API for reference';
COMMENT ON COLUMN public.profiles.kvk_name_mismatch IS 'Flag indicating if user-provided company name differs from KVK official name';
COMMENT ON COLUMN public.profiles.kvk_address_mismatch IS 'Flag indicating if user-provided address differs from KVK official address';

