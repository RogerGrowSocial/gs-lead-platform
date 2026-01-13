-- Migration: Add contract document fields to customers table
-- This allows storing the contract/overeenkomst document URL and name for customers

-- =====================================================
-- ADD CONTRACT DOCUMENT FIELDS
-- =====================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS contract_document_url TEXT;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS contract_document_name TEXT;

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_customers_contract_document_url 
  ON public.customers(contract_document_url) 
  WHERE contract_document_url IS NOT NULL;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON COLUMN public.customers.contract_document_url IS 'URL to the uploaded contract/overeenkomst document for this customer';
COMMENT ON COLUMN public.customers.contract_document_name IS 'Original filename of the uploaded contract/overeenkomst document';

