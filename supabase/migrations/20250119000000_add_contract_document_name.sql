-- Migration: Add contract document name field to profiles table
-- This stores the original filename of the uploaded contract document

-- =====================================================
-- ADD CONTRACT DOCUMENT NAME FIELD
-- =====================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contract_document_name TEXT;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN public.profiles.contract_document_name IS 'Original filename of the uploaded contract/overeenkomst document';

