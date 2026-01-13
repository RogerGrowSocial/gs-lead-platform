-- =====================================================
-- CREATE CONTACTS TABLE
-- =====================================================
-- This table stores contact persons (contactpersonen)
-- These are individuals who can work at companies (customers)
-- Contacts can be converted to opportunities (kansen)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic contact information
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  name VARCHAR(255) NOT NULL, -- Full name (computed or manual)
  email VARCHAR(255),
  phone VARCHAR(50),
  
  -- Company/Organization information
  company_name VARCHAR(255), -- Company they work for
  job_title VARCHAR(255), -- Job title/position
  department VARCHAR(255), -- Department
  
  -- Address information
  address TEXT,
  city VARCHAR(255),
  postal_code VARCHAR(20),
  country VARCHAR(2) DEFAULT 'NL',
  
  -- Link to customer (if contact works at a customer company)
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  
  -- Status and priority
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'lead', 'prospect')),
  priority VARCHAR(50) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'vip')),
  
  -- Branch/Industry classification
  customer_branch_id INTEGER REFERENCES public.customer_branches(id) ON DELETE SET NULL,
  
  -- Additional information
  notes TEXT,
  website VARCHAR(255),
  linkedin_url VARCHAR(255),
  
  -- Source tracking
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'mail', 'form', 'import', 'scraper', 'api', 'other')),
  source_mail_id UUID REFERENCES public.mail_inbox(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  
  -- Conversion tracking
  converted_to_opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  converted_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sort_order INTEGER DEFAULT 0
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_customer_id ON public.contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON public.contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_priority ON public.contacts(priority);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_source ON public.contacts(source);
CREATE INDEX IF NOT EXISTS idx_contacts_source_mail_id ON public.contacts(source_mail_id) WHERE source_mail_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_opportunity_id ON public.contacts(opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_company_name ON public.contacts(company_name) WHERE company_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_customer_branch_id ON public.contacts(customer_branch_id);
CREATE INDEX IF NOT EXISTS idx_contacts_converted_to_opportunity_id ON public.contacts(converted_to_opportunity_id) WHERE converted_to_opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_sort_order ON public.contacts(sort_order);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON public.contacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON public.contacts(updated_at DESC);

-- Full text search index
CREATE INDEX IF NOT EXISTS idx_contacts_search ON public.contacts USING gin(
  to_tsvector('dutch', 
    COALESCE(name, '') || ' ' || 
    COALESCE(first_name, '') || ' ' || 
    COALESCE(last_name, '') || ' ' || 
    COALESCE(email, '') || ' ' || 
    COALESCE(company_name, '') || ' ' || 
    COALESCE(job_title, '')
  )
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Auto-generate name from first_name + last_name if not set
  IF NEW.name IS NULL OR NEW.name = '' THEN
    NEW.name = TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

CREATE TRIGGER trigger_set_contacts_name
  BEFORE INSERT OR UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- Comments
COMMENT ON TABLE public.contacts IS 'Contact persons (contactpersonen). Individuals who can work at companies. Can be converted to opportunities.';
COMMENT ON COLUMN public.contacts.customer_id IS 'Link to customer company if this contact works at a customer';
COMMENT ON COLUMN public.contacts.converted_to_opportunity_id IS 'Link to opportunity if this contact was converted to a kans';
COMMENT ON COLUMN public.contacts.converted_at IS 'Timestamp when contact was converted to opportunity';
COMMENT ON COLUMN public.contacts.status IS 'Contact status: active, inactive, lead, prospect';
COMMENT ON COLUMN public.contacts.priority IS 'Contact priority: low, normal, high, vip';

-- =====================================================
-- CREATE CONTACT_STATS VIEW
-- =====================================================
-- Similar to customer_stats, but for contacts
-- Aggregates stats for faster listing queries
-- =====================================================

CREATE OR REPLACE VIEW public.contact_stats AS
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

-- Add comment
COMMENT ON VIEW public.contact_stats IS 'Contact persons with aggregated stats for faster listing queries';
