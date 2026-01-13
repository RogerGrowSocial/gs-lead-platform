# PHASE 1 — CODEBASE INSPECTION REPORT
## Form Builder System Implementation

**Date:** Inspection Complete  
**Status:** ✅ Ready for Phase 2 (Schema Design)

---

## 📋 EXECUTIVE SUMMARY

This inspection covers the codebase structure for implementing a multi-step form builder system for branch-specific lead request forms. The system will integrate with existing admin settings, landing page creation flow, and customer-facing form rendering.

---

## 🔍 A. ROUTING INSPECTION

### 1. Admin Settings → Branch Beheer Routes

**Location:** `routes/admin.js`

**Current Structure:**
- **Main Settings Route:** `GET /admin/settings` (line ~1624)
  - Renders `views/admin/settings.ejs`
  - Contains tabs including "branches" tab

- **Branches Tab UI:** `views/admin/settings.ejs` (lines 1224-1262)
  - Tab ID: `branches-tab`
  - Contains industries table with:
    - Add button: `#addIndustryBtn`
    - Table: `#industriesTable`
    - Table body: `#industriesTableBody`

**Industry/Branch API Routes:** `routes/api.js` (lines 4861-5050)
- `GET /api/admin/industries` - List all industries with pricing
- `POST /api/admin/industries` - Create new industry
- `PUT /api/admin/industries/:id` - Update industry
- `DELETE /api/admin/industries/:id` - Delete industry

**Database Table:** `industries`
- Columns: `id` (UUID), `name`, `price_per_lead`, `description`, `is_active`, `created_at`
- **Note:** No `slug` column exists yet - will need to be added

**Integration Point:**
- Form builder route should be added to `routes/admin.js`
- Should follow pattern: `/admin/settings/industries/:branchId/form`
- Button to access form builder should be added to industries table actions column

---

### 2. Landing Suggestion Routes

**Location:** `routes/api.js` (lines 7423-7622)

**Current Flow:**
1. **Marketing Recommendations Endpoint:**
   - `GET /api/partners/:partnerId/marketing-recommendations` - List recommendations
   - `POST /api/marketing-recommendations/:recId/approve` - Approve & execute

2. **Landing Page Creation Trigger:**
   - Located in `POST /api/marketing-recommendations/:recId/approve` (line ~7460)
   - When `action_type === 'create_landing_page'`:
     - Fetches site and segment
     - Generates AI content via `PartnerLandingPageService.generateAIContentForPage()`
     - Creates landing page via `PartnerLandingPageService.createPlatformLandingPage()`
     - Publishes immediately

3. **Test Landing Page Route:**
   - `POST /api/admin/landing-pages/create-test` (line ~7204)
   - Creates test landing page for default site/segment

**Integration Point:**
- Need to add form template check BEFORE landing page creation
- If `form_template` doesn't exist for branch → redirect to form builder
- Check should happen in `POST /api/marketing-recommendations/:recId/approve` around line 7498

---

## 🎨 B. FRONTEND INSPECTION

### 1. Admin Settings Frontend

**Location:** `views/admin/settings.ejs`

**Branches Tab Structure:**
- Tab container: `#branches-tab` (line 1225)
- Industries table with columns:
  - Branche (name)
  - Prijs per Lead
  - Beschrijving
  - Acties (actions column - where form builder button will go)

**JavaScript:**
- Industries management JS is embedded in `views/admin/settings.ejs`
- Function: `initializeIndustries()` (line ~2210)
- Loads industries via: `GET /api/admin/industries`

**Integration Point:**
- Add "Aanvraagformulier bewerken" button in actions column
- Button should link to: `/admin/settings/industries/{id}/form`
- After creating new industry, show "Configureer formulier" CTA

---

### 2. Landing Suggestion Frontend

**Location:** 
- View: `views/admin/leads/engine-content.ejs`
- Partial: `views/admin/leads/partials/ai-actions-tab.ejs`
- JavaScript: `public/js/admin/lead-engine.js`

**Current UI:**
- AI Actions tab shows marketing recommendations table
- Each recommendation has "Details" button
- Details open drawer: `#ai-recommendation-drawer`
- Approve button triggers: `approveRecommendationFromModal()` (line ~1675)
- Function calls: `POST /api/marketing-recommendations/:recId/approve`

**Integration Point:**
- No changes needed to frontend initially
- Backend will handle redirect logic
- If form missing, backend returns error with redirect URL
- Frontend can show banner/notification with redirect link

---

## 💾 C. DATABASE INSPECTION

### 1. Industries/Branches Table

**Table:** `industries`

**Current Schema:**
```sql
- id (UUID, PRIMARY KEY)
- name (TEXT)
- price_per_lead (DECIMAL(10,2), DEFAULT 10.00)
- description (TEXT, nullable)
- is_active (BOOLEAN, DEFAULT TRUE)
- created_at (TIMESTAMPTZ)
```

**Missing Fields for Form Builder:**
- `slug` (TEXT, UNIQUE) - URL-friendly identifier for public form route
- Relationship to `form_templates` table (to be created)

**RLS Status:** Unknown - needs verification

---

### 2. Leads Table

**Table:** `leads`

**Relevant Fields:**
- `id` (UUID)
- `name`, `email`, `phone`, `message` (TEXT)
- `industry_id` (UUID, references `industries`)
- `user_id` (UUID, references `profiles`)
- `status` (TEXT, default 'new')
- `created_at` (TIMESTAMPTZ)

**Note:** Leads can be created from form submissions, will need to link to `industry_id` via branch slug lookup

---

### 3. Form Templates Table

**Status:** ❌ **DOES NOT EXIST**

**Required Schema (to be created):**
```sql
CREATE TABLE form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry_id UUID REFERENCES industries(id) ON DELETE CASCADE,
  config_json JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Index for active template lookup
CREATE INDEX idx_form_templates_active ON form_templates(industry_id, is_active) 
  WHERE is_active = TRUE;

-- Unique constraint: one active template per industry
CREATE UNIQUE INDEX idx_form_templates_one_active_per_industry 
  ON form_templates(industry_id) 
  WHERE is_active = TRUE;
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
          "placeholder": "Vul uw naam in"
        },
        {
          "id": "email",
          "type": "email",
          "label": "E-mailadres",
          "required": true
        }
      ]
    }
  ]
}
```

---

## 🔎 D. EXISTING FORM BUILDER CODE SEARCH

**Result:** ❌ **NO EXISTING FORM BUILDER CODE FOUND**

**Searched for:**
- "form template"
- "form builder"
- "wizard"
- "steps"
- "multi-step"

**Findings:**
- No existing form builder implementation
- No wizard/multi-step form components
- Landing pages use simple contact forms (single step)
- No form configuration system exists

**Conclusion:** Complete greenfield implementation required

---

## 📊 E. ADDITIONAL FINDINGS

### 1. Slug System

**Current Status:**
- Industries table does NOT have `slug` column
- Landing pages use `path` field (e.g., `/schilder/noord-brabant`)
- Need to add `slug` to industries for public form routes

**Proposed Pattern:**
- Slug format: lowercase, hyphenated (e.g., "schilder", "elektricien")
- Public form route: `/form/:brancheSlug`
- Example: `/form/schilder` → loads form for "Schilder" industry

---

### 2. Customer Account Creation

**Current Flow:**
- Customer accounts created via `profiles` table
- Role system exists: `role_id` references `roles` table
- Email verification handled by Supabase Auth

**Integration Point:**
- Form submission should:
  1. Create lead with customer info
  2. Check if customer account exists (by email)
  3. If not, create new customer account:
     - Email (from form)
     - Phone (from form)
     - Name (from form)
     - Role = "customer" (need to verify role ID)
     - Auto-confirm email/phone
  4. Redirect to `/customer/dashboard`

---

### 3. Authentication & Authorization

**Current System:**
- Supabase Auth for authentication
- RLS (Row Level Security) policies
- Role-based access control via `roles` table
- Admin middleware: `requireAuth, isAdmin`

**RLS Requirements for Form Templates:**
- **Admin:** Full access (SELECT, INSERT, UPDATE, DELETE)
- **Partners:** No access (form templates are platform-only)
- **Customers:** Read-only when retrieving form structures (public route)

---

## ✅ F. INSPECTION CHECKLIST

- [x] Admin settings routes identified
- [x] Branch/industry management routes found
- [x] Landing suggestion routes located
- [x] Landing page creation flow understood
- [x] Frontend structure mapped
- [x] Database schema inspected
- [x] Form templates table confirmed missing
- [x] Existing form builder code search completed
- [x] Slug system requirements identified
- [x] Customer account creation flow understood

---

## 🎯 G. NEXT STEPS (PHASE 2)

1. **Schema Design:**
   - Design `form_templates` table structure
   - Design JSON schema for form config
   - Add `slug` column to `industries` table
   - Plan RLS policies

2. **Migration Planning:**
   - Create Supabase migration file
   - Create rollback migration
   - Plan edge function adjustments (if needed)

3. **API Design:**
   - Design form builder routes
   - Design public form routes
   - Design form submission endpoint

---

## 📝 NOTES

- All routes follow RESTful patterns
- Frontend uses EJS templating
- JavaScript uses modern async/await patterns
- Supabase is the database backend
- RLS policies need careful design for form templates
- No existing form builder code to migrate/refactor

---

**Inspection Complete** ✅  
**Ready for Phase 2: Schema Design**

