-- Migration: Add contract document field to profiles table
-- This allows storing the contract/overeenkomst document URL for employees

-- =====================================================
-- ADD CONTRACT DOCUMENT FIELD
-- =====================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contract_document_url TEXT;

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_contract_document_url 
  ON public.profiles(contract_document_url) 
  WHERE contract_document_url IS NOT NULL;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN public.profiles.contract_document_url IS 'URL to the uploaded contract/overeenkomst document for this employee';


