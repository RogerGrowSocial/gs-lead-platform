-- =====================================================
-- COMPANY SETTINGS TABLE
-- =====================================================
-- Migration: Create company_settings table
-- This table stores company information used across the platform (invoices, communications, etc.)

CREATE TABLE IF NOT EXISTS public.company_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'Netherlands',
  kvk_number TEXT,
  vat_number TEXT,
  iban TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT company_settings_single_row CHECK (id = 1)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_company_settings_id 
  ON public.company_settings(id);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.company_settings IS 'Company information used across the platform (invoices, communications, etc.)';
COMMENT ON COLUMN public.company_settings.id IS 'Always 1 - single row table for company settings';
COMMENT ON COLUMN public.company_settings.company_name IS 'Company name';
COMMENT ON COLUMN public.company_settings.email IS 'Company email address';
COMMENT ON COLUMN public.company_settings.phone IS 'Company phone number';
COMMENT ON COLUMN public.company_settings.website IS 'Company website URL';
COMMENT ON COLUMN public.company_settings.address IS 'Street address';
COMMENT ON COLUMN public.company_settings.postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN public.company_settings.city IS 'City';
COMMENT ON COLUMN public.company_settings.country IS 'Country';
COMMENT ON COLUMN public.company_settings.kvk_number IS 'KVK (Chamber of Commerce) number';
COMMENT ON COLUMN public.company_settings.vat_number IS 'VAT number';
COMMENT ON COLUMN public.company_settings.iban IS 'IBAN for payments';
COMMENT ON COLUMN public.company_settings.logo_url IS 'URL to company logo';

-- =====================================================
-- DEFAULT DATA (optional - can be inserted via admin panel)
-- =====================================================

-- Insert default values if table is empty
INSERT INTO public.company_settings (id, company_name, email, phone, address, postal_code, city, country, website, kvk_number, vat_number, iban)
VALUES (
  1,
  'GrowSocial',
  'info@growsocialmedia.nl',
  '0132340434',
  'Monseigneur Bekkersplein 2',
  '5076 AV',
  'Haaren Noord-Brabant',
  'Netherlands',
  'growsocialmedia.nl',
  '76478793',
  'NL860638285B01',
  'NL42RABO0357384644'
)
ON CONFLICT (id) DO NOTHING;

