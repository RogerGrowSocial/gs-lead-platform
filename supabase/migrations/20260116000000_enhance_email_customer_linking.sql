-- =====================================================
-- ENHANCE EMAIL CUSTOMER LINKING SYSTEM
-- =====================================================
-- This migration adds support for:
-- 1. Email-to-customer mappings (confirmed links)
-- 2. Auto-detected customer links
-- 3. Manual confirmation tracking
-- =====================================================

-- =====================================================
-- 1. ADD COLUMNS TO mail_inbox TABLE
-- =====================================================

-- Add customer linking fields if they don't exist
ALTER TABLE public.mail_inbox
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_linked_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_link_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS customer_link_confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_link_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suggested_ticket_priority TEXT CHECK (suggested_ticket_priority IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS should_create_ticket BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ticket_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mail_inbox_customer_id ON public.mail_inbox(customer_id);
CREATE INDEX IF NOT EXISTS idx_mail_inbox_auto_linked_customer_id ON public.mail_inbox(auto_linked_customer_id);
CREATE INDEX IF NOT EXISTS idx_mail_inbox_customer_link_confirmed ON public.mail_inbox(customer_link_confirmed);
CREATE INDEX IF NOT EXISTS idx_mail_inbox_should_create_ticket ON public.mail_inbox(should_create_ticket);
CREATE INDEX IF NOT EXISTS idx_mail_inbox_ticket_id ON public.mail_inbox(ticket_id);

-- =====================================================
-- 2. CREATE email_customer_mappings TABLE
-- =====================================================
-- This table stores confirmed mappings between email addresses/domains and customers
-- Used for automatic customer linking in future emails

CREATE TABLE IF NOT EXISTS public.email_customer_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Mapping type: 'email' (exact email) or 'domain' (all emails from domain)
  mapping_type TEXT NOT NULL CHECK (mapping_type IN ('email', 'domain')),
  
  -- The email address or domain to match
  email_or_domain TEXT NOT NULL,
  
  -- The customer this maps to
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- Confirmation tracking
  confirmed BOOLEAN DEFAULT TRUE, -- All entries are confirmed by default
  confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate mappings
  CONSTRAINT email_customer_mappings_unique UNIQUE (mapping_type, email_or_domain, customer_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_customer_mappings_email_or_domain ON public.email_customer_mappings(email_or_domain);
CREATE INDEX IF NOT EXISTS idx_email_customer_mappings_customer_id ON public.email_customer_mappings(customer_id);
CREATE INDEX IF NOT EXISTS idx_email_customer_mappings_type ON public.email_customer_mappings(mapping_type);
CREATE INDEX IF NOT EXISTS idx_email_customer_mappings_confirmed ON public.email_customer_mappings(confirmed);

-- Add comments
COMMENT ON TABLE public.email_customer_mappings IS 'Stores confirmed mappings between email addresses/domains and customers for automatic linking';
COMMENT ON COLUMN public.email_customer_mappings.mapping_type IS 'Type of mapping: email (exact match) or domain (all emails from this domain)';
COMMENT ON COLUMN public.email_customer_mappings.email_or_domain IS 'The email address or domain to match (e.g., "john@example.com" or "example.com")';

-- =====================================================
-- 3. CREATE FUNCTION TO AUTO-LINK CUSTOMER
-- =====================================================
-- This function can be called to automatically link an email to a customer
-- based on confirmed mappings

CREATE OR REPLACE FUNCTION public.auto_link_email_to_customer(
  p_mail_id UUID,
  p_from_email TEXT
) RETURNS UUID AS $$
DECLARE
  v_customer_id UUID;
  v_email_domain TEXT;
BEGIN
  -- Extract domain from email
  v_email_domain := lower(split_part(p_from_email, '@', 2));
  
  -- First, try exact email match
  SELECT customer_id INTO v_customer_id
  FROM public.email_customer_mappings
  WHERE mapping_type = 'email'
    AND lower(email_or_domain) = lower(p_from_email)
    AND confirmed = TRUE
  LIMIT 1;
  
  -- If no exact match, try domain match
  IF v_customer_id IS NULL AND v_email_domain IS NOT NULL THEN
    SELECT customer_id INTO v_customer_id
    FROM public.email_customer_mappings
    WHERE mapping_type = 'domain'
      AND lower(email_or_domain) = v_email_domain
      AND confirmed = TRUE
    LIMIT 1;
  END IF;
  
  -- If found, update the mail
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.mail_inbox
    SET 
      auto_linked_customer_id = v_customer_id,
      updated_at = NOW()
    WHERE id = p_mail_id;
  END IF;
  
  RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. CREATE FUNCTION TO CHECK CUSTOMER BY DOMAIN
-- =====================================================
-- This function checks if a domain matches a customer's domain field

CREATE OR REPLACE FUNCTION public.find_customer_by_domain(
  p_email TEXT
) RETURNS UUID AS $$
DECLARE
  v_domain TEXT;
  v_customer_id UUID;
BEGIN
  -- Extract domain from email
  v_domain := lower(split_part(p_email, '@', 2));
  
  -- Skip common email providers
  IF v_domain IN ('gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'live.com', 'icloud.com', 'me.com', 'protonmail.com', 'mail.com') THEN
    RETURN NULL;
  END IF;
  
  -- Try to find customer by domain
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE lower(domain) = v_domain
  LIMIT 1;
  
  RETURN v_customer_id;
END;
$$ LANGUAGE plpgsql;
