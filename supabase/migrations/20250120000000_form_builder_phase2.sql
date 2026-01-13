-- =====================================================
-- PHASE 2: FORM BUILDER SYSTEM - MIGRATIONS
-- =====================================================
-- Date: 2025-01-20
-- Purpose: Add B2C consumer role, form templates table, and industry slugs
-- =====================================================

-- =====================================================
-- A) ADD CONSUMER ROLE FOR B2C CUSTOMERS
-- =====================================================

-- Insert consumer role only if it doesn't exist
INSERT INTO roles (id, name, description, is_system_role, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    'consumer',
    'B2C Consumer - End customer who submits job requests via public forms',
    true,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE name = 'consumer'
);

-- =====================================================
-- B) CREATE LEAD_FORM_TEMPLATES TABLE
-- =====================================================

-- Create the form templates table
CREATE TABLE IF NOT EXISTS lead_form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry_id INTEGER NOT NULL,
    config_json JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    
    -- Foreign key constraints
    CONSTRAINT lead_form_templates_industry_id_fkey 
        FOREIGN KEY (industry_id) 
        REFERENCES industries(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT lead_form_templates_created_by_fkey 
        FOREIGN KEY (created_by) 
        REFERENCES profiles(id) 
        ON DELETE SET NULL,
    
    -- Ensure config_json is a valid JSON object
    CONSTRAINT lead_form_templates_config_json_check 
        CHECK (config_json IS NOT NULL AND jsonb_typeof(config_json) = 'object'),
    
    -- Ensure version is positive
    CONSTRAINT lead_form_templates_version_check 
        CHECK (version > 0)
);

-- Create index on industry_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_lead_form_templates_industry_id 
    ON lead_form_templates(industry_id);

-- Create unique partial index: only one active template per industry
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_form_templates_one_active_per_industry 
    ON lead_form_templates(industry_id) 
    WHERE is_active = TRUE;

-- Create index on is_active for filtering active templates
CREATE INDEX IF NOT EXISTS idx_lead_form_templates_is_active 
    ON lead_form_templates(is_active) 
    WHERE is_active = TRUE;

-- =====================================================
-- C) CREATE UPDATED_AT TRIGGER FOR lead_form_templates
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lead_form_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS lead_form_templates_updated_at ON lead_form_templates;
CREATE TRIGGER lead_form_templates_updated_at
    BEFORE UPDATE ON lead_form_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_form_templates_updated_at();

-- =====================================================
-- D) ADD SLUG COLUMN TO INDUSTRIES (OPTIONAL BUT RECOMMENDED)
-- =====================================================

-- Add slug column (nullable initially)
ALTER TABLE industries 
    ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index on slug (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_industries_slug_unique 
    ON industries(slug) 
    WHERE slug IS NOT NULL;

-- =====================================================
-- E) ENABLE RLS ON NEW TABLE
-- =====================================================

-- Enable RLS on lead_form_templates
ALTER TABLE lead_form_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage all form templates
CREATE POLICY "Admins can manage form templates"
    ON lead_form_templates
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Policy: Public can read active form templates (for form rendering)
CREATE POLICY "Public can read active form templates"
    ON lead_form_templates
    FOR SELECT
    TO anon, authenticated
    USING (is_active = TRUE);

-- =====================================================
-- F) ENABLE RLS ON INDUSTRIES (if not already enabled)
-- =====================================================

-- Enable RLS on industries
ALTER TABLE industries ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage industries
CREATE POLICY "Admins can manage industries"
    ON industries
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Policy: Public can read active industries (for form lookup by slug)
CREATE POLICY "Public can read active industries"
    ON industries
    FOR SELECT
    TO anon, authenticated
    USING (is_active = TRUE);

