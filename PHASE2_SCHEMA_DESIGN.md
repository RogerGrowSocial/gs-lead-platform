# PHASE 2 — SCHEMA DESIGN
## Form Builder System Database Schema

**Date:** Schema Design Complete  
**Status:** ✅ Ready for Phase 3 (Migrations)

---

## 📊 INSPECTION SUMMARY

### Key Findings:

1. **Roles Table:**
   - ✅ "customer" role exists (B2B customers)
   - ❌ No B2C consumer role exists
   - Need to create new role: "consumer" or "b2c_customer"

2. **Industries Table:**
   - Uses `integer` ID (not UUID)
   - Has: `id`, `name`, `price_per_lead`, `description`, `is_active`, `created_at`, `updated_at`
   - ❌ **NO `slug` column** - needs to be added
   - Referenced by: `leads.industry_id`, `user_industry_preferences.industry_id`

3. **Branches Table:**
   - Separate table from industries
   - Uses `uuid` ID
   - Currently empty (no data)
   - Referenced by: `subscriptions.branch_id`
   - **Decision:** We'll use `industries` for form templates (not `branches`)

4. **Leads Table:**
   - Has `industry_id` (integer) FK to industries
   - Has `assignment_factors` (jsonb) - only JSON column
   - ❌ **NO `form_answers` or `meta_json`** - can add if needed
   - RLS enabled

5. **RLS Status:**
   - `leads`: RLS enabled ✅
   - `profiles`: RLS enabled ✅
   - `industries`: RLS disabled ❌ (needs RLS)
   - `branches`: RLS disabled
   - `roles`: RLS disabled

---

## 🗄️ SCHEMA DESIGN

### 1. NEW TABLE: `form_templates`

```sql
CREATE TABLE form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id INTEGER NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
  config_json JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  -- Constraints
  CONSTRAINT form_templates_config_json_check 
    CHECK (config_json IS NOT NULL AND jsonb_typeof(config_json) = 'object')
);

-- Indexes
CREATE INDEX idx_form_templates_industry_id ON form_templates(industry_id);
CREATE INDEX idx_form_templates_active ON form_templates(industry_id, is_active) 
  WHERE is_active = TRUE;

-- Unique constraint: one active template per industry
CREATE UNIQUE INDEX idx_form_templates_one_active_per_industry 
  ON form_templates(industry_id) 
  WHERE is_active = TRUE;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_form_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER form_templates_updated_at
  BEFORE UPDATE ON form_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_form_templates_updated_at();
```

**Config JSON Structure:**
```json
{
  "steps": [
    {
      "id": "step-1",
      "title": "Persoonlijke gegevens",
      "fields": [
        {
          "id": "name",
          "type": "text",
          "label": "Naam",
          "required": true,
          "placeholder": "Vul uw naam in",
          "validation": {
            "minLength": 2,
            "maxLength": 100
          }
        },
        {
          "id": "email",
          "type": "email",
          "label": "E-mailadres",
          "required": true
        },
        {
          "id": "phone",
          "type": "tel",
          "label": "Telefoonnummer",
          "required": false
        }
      ]
    },
    {
      "id": "step-2",
      "title": "Projectdetails",
      "fields": [
        {
          "id": "project_type",
          "type": "select",
          "label": "Type project",
          "required": true,
          "options": [
            { "value": "new", "label": "Nieuw project" },
            { "value": "renovation", "label": "Renovatie" },
            { "value": "repair", "label": "Reparatie" }
          ]
        },
        {
          "id": "budget",
          "type": "radio",
          "label": "Budget",
          "required": true,
          "options": [
            { "value": "low", "label": "€0 - €1.000" },
            { "value": "medium", "label": "€1.000 - €5.000" },
            { "value": "high", "label": "€5.000+" }
          ]
        },
        {
          "id": "message",
          "type": "textarea",
          "label": "Beschrijving",
          "required": false,
          "placeholder": "Vertel ons over uw project...",
          "rows": 4
        }
      ]
    }
  ],
  "settings": {
    "submitButtonText": "Verstuur aanvraag",
    "successMessage": "Bedankt! We nemen zo snel mogelijk contact met u op.",
    "redirectUrl": "/customer/dashboard"
  }
}
```

---

### 2. MODIFY: `industries` Table

**Add `slug` column:**

```sql
-- Add slug column
ALTER TABLE industries 
  ADD COLUMN slug TEXT;

-- Create unique index for slug
CREATE UNIQUE INDEX idx_industries_slug ON industries(slug) 
  WHERE slug IS NOT NULL;

-- Generate slugs for existing industries (if any)
UPDATE industries 
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug NOT NULL after populating
ALTER TABLE industries 
  ALTER COLUMN slug SET NOT NULL;
```

**Slug Generation Rules:**
- Lowercase
- Replace spaces/special chars with hyphens
- Examples: "Schilder" → "schilder", "Dakdekker" → "dakdekker"

---

### 3. NEW ROLE: Consumer (B2C)

**Add to `roles` table:**

```sql
-- Insert new consumer role
INSERT INTO roles (id, name, description, is_system_role)
VALUES (
  gen_random_uuid(),
  'consumer',
  'B2C Consumer - End customer who submits form requests',
  true
);
```

**Role ID:** Will be generated, but we'll reference it in code as `'consumer'` by name.

---

### 4. RLS POLICIES

#### A. `form_templates` Table

```sql
-- Enable RLS
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Admins have full access
CREATE POLICY "Admins can manage form templates"
  ON form_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Partners have no access (explicit deny)
-- (No policy = no access for non-admins)

-- Policy: Public can read active templates (for form rendering)
CREATE POLICY "Public can read active form templates"
  ON form_templates
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);
```

#### B. `industries` Table

```sql
-- Enable RLS
ALTER TABLE industries ENABLE ROW LEVEL SECURITY;

-- Policy: Admins have full access
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
  );

-- Policy: Authenticated users can read industries
CREATE POLICY "Authenticated users can read industries"
  ON industries
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Policy: Public can read active industries (for form lookup by slug)
CREATE POLICY "Public can read active industries"
  ON industries
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);
```

---

## 📋 MIGRATION CHECKLIST

### Phase 3 Migration Steps:

1. ✅ Create `form_templates` table
2. ✅ Add `slug` column to `industries`
3. ✅ Generate slugs for existing industries
4. ✅ Create indexes on `form_templates`
5. ✅ Add `consumer` role to `roles` table
6. ✅ Enable RLS on `form_templates`
7. ✅ Enable RLS on `industries`
8. ✅ Create RLS policies for both tables
9. ✅ Create updated_at trigger for `form_templates`

---

## 🔗 RELATIONSHIPS

```
industries (1) ──< (many) form_templates
industries (1) ──< (many) leads
form_templates (1) ──< (0) profiles (created_by)
```

---

## 📝 NOTES

1. **Slug Uniqueness:** Slug must be unique across all industries
2. **Active Template:** Only one active template per industry (enforced by unique index)
3. **Cascade Delete:** Deleting an industry will cascade delete its form templates
4. **JSON Validation:** Config JSON is validated at application level (PostgreSQL can't validate complex JSON schemas easily)
5. **Public Access:** Form templates are readable by public (anon) for form rendering, but only admins can modify
6. **Consumer Role:** New role for B2C customers who submit forms (different from B2B "customer" role)

---

## ✅ SCHEMA DESIGN COMPLETE

**Next:** Phase 3 - Create migration files with rollback support

