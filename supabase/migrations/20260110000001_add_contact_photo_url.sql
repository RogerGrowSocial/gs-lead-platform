-- =====================================================
-- ADD PHOTO_URL TO CONTACTS TABLE
-- =====================================================
-- This adds a photo_url field to the contacts table
-- for storing profile photos of contact persons
-- =====================================================

-- Add photo_url column to contacts table
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_contacts_photo_url ON public.contacts(photo_url) WHERE photo_url IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.contacts.photo_url IS 'URL to the profile photo of this contact person';

-- Update contact_stats view to include photo_url
-- Drop and recreate to avoid column rename conflicts
DROP VIEW IF EXISTS public.contact_stats;

CREATE VIEW public.contact_stats AS
SELECT 
  c.id,
  c.name,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.company_name,
  c.job_title,
  c.department,
  c.address,
  c.city,
  c.postal_code,
  c.country,
  c.customer_id,
  c.status,
  c.priority,
  c.customer_branch_id,
  c.notes,
  c.website,
  c.linkedin_url,
  c.photo_url,
  c.converted_to_opportunity_id,
  c.converted_at,
  c.created_by,
  c.created_at,
  c.updated_at,
  c.sort_order,
  -- Stats
  COALESCE(ticket_stats.open_tickets, 0) as open_tickets,
  COALESCE(ticket_stats.total_tickets, 0) as total_tickets,
  COALESCE(email_stats.total_emails, 0) as total_emails,
  COALESCE(email_stats.unread_emails, 0) as unread_emails,
  -- Last activity
  GREATEST(
    c.updated_at,
    ticket_stats.last_ticket_activity,
    email_stats.last_email_activity
  ) as last_activity
FROM public.contacts c
LEFT JOIN (
  SELECT 
    customer_id,
    COUNT(*) FILTER (WHERE status IN ('new', 'open', 'waiting_on_customer')) as open_tickets,
    COUNT(*) as total_tickets,
    MAX(updated_at) as last_ticket_activity
  FROM public.tickets
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
) ticket_stats ON ticket_stats.customer_id = c.customer_id
LEFT JOIN (
  SELECT 
    customer_id,
    COUNT(*) as total_emails,
    COUNT(*) FILTER (WHERE read_at IS NULL) as unread_emails,
    MAX(created_at) as last_email_activity
  FROM public.mail_inbox
  WHERE customer_id IS NOT NULL
  GROUP BY customer_id
) email_stats ON email_stats.customer_id = c.customer_id;
