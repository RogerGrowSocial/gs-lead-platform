-- =====================================================
-- ADD SOURCE FIELD TO CONTACTS TABLE
-- =====================================================
-- This migration adds a source field to track where contacts come from
-- Used for analytics and understanding contact origins

-- Add source column to contacts table
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' 
    CHECK (source IN ('manual', 'mail', 'form', 'import', 'scraper', 'api', 'other'));

-- Add mail_id to link contact to the email it came from
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS source_mail_id UUID REFERENCES public.mail_inbox(id) ON DELETE SET NULL;

-- Add opportunity_id to link contact to opportunity (reverse of converted_to_opportunity_id)
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_source ON public.contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_source_mail_id ON public.contacts(source_mail_id) WHERE source_mail_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_opportunity_id ON public.contacts(opportunity_id) WHERE opportunity_id IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.contacts.source IS 'Source of the contact: manual, mail, form, import, scraper, api, other';
COMMENT ON COLUMN public.contacts.source_mail_id IS 'Link to the email that created this contact (if source is mail)';
COMMENT ON COLUMN public.contacts.opportunity_id IS 'Link to the opportunity this contact is associated with';
