-- =====================================================
-- ADD INDUSTRY_ID TO CUSTOMERS TABLE
-- =====================================================
-- This adds industry_id to the customers table for customer branch classification
-- NOTE: This is SEPARATE from the lead industries system (leads.industry_id)
-- This is specifically for categorizing customers by their business branch/industry
-- =====================================================

-- Add industry_id column to customers table
-- References industries.id (INTEGER) - same table as used for leads, but different purpose
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS industry_id INTEGER REFERENCES industries(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_customers_industry_id ON customers(industry_id);

-- Add comment to clarify this is for customer branch classification, not lead industries
COMMENT ON COLUMN customers.industry_id IS 'Customer business branch/industry classification. Separate from leads.industry_id which is for lead request categories.';

