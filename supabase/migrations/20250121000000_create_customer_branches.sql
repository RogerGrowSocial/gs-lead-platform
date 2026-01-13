-- =====================================================
-- CREATE CUSTOMER_BRANCHES TABLE
-- =====================================================
-- This table stores branches/industries specifically for customer classification
-- This is SEPARATE from the industries table which is used for leads/requests
-- Customer branches are for internal CRM purposes only
-- =====================================================

-- Create customer_branches table
CREATE TABLE IF NOT EXISTS public.customer_branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_customer_branches_name ON public.customer_branches(name);
CREATE INDEX IF NOT EXISTS idx_customer_branches_is_active ON public.customer_branches(is_active);

-- Add comment
COMMENT ON TABLE public.customer_branches IS 'Branches/industries for customer classification (internal CRM only). Separate from industries table which is for leads/requests.';
COMMENT ON COLUMN public.customer_branches.name IS 'Branch name (e.g., "Dakdekkers", "Schilders")';
COMMENT ON COLUMN public.customer_branches.description IS 'Optional description of the branch';
COMMENT ON COLUMN public.customer_branches.is_active IS 'Whether this branch is active and can be selected';

-- =====================================================
-- UPDATE CUSTOMERS TABLE
-- =====================================================
-- Add customer_branch_id column to customers table
-- This replaces the industry_id column for customer classification
-- =====================================================

-- Add customer_branch_id column
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_branch_id INTEGER REFERENCES public.customer_branches(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_customers_customer_branch_id ON public.customers(customer_branch_id);

-- Add comment
COMMENT ON COLUMN public.customers.customer_branch_id IS 'Customer branch classification (internal CRM). References customer_branches.id. Separate from industry_id which is for lead requests.';

-- =====================================================
-- MIGRATE EXISTING DATA (OPTIONAL)
-- =====================================================
-- If customers.industry_id was used for customer classification,
-- we can migrate that data to customer_branches
-- This is optional and can be done manually if needed
-- =====================================================

