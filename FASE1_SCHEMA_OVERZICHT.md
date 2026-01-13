# FASE 1: Database Schema Inspectie - Samenvatting

## Status: ✅ INSPECTIE ALLEEN (GEEN WIJZIGINGEN)

**Belangrijk:** In deze fase voer ik geen schema-wijzigingen uit, ik inspecteer alleen.

---

## Bestaande Database Structuur (gebaseerd op codebase analyse)

### 1. Hoofdtabellen

#### `profiles` (Supabase auth-gekoppeld)
- **Primary Key:** `id` (UUID, references `auth.users`)
- **Basis velden:**
  - `email` (TEXT)
  - `first_name`, `last_name`, `company_name` (TEXT)
  - `phone`, `street`, `postal_code`, `city`, `country` (TEXT)
  - `coc_number`, `vat_number` (TEXT)
  - `role_id` (UUID, references `roles`)
  - `is_admin` (BOOLEAN)
  - `balance` (NUMERIC, default 0)
  - `status` (TEXT, default 'active')
  - `created_at`, `updated_at`, `last_login` (TIMESTAMPTZ)

- **Lead voorkeuren (arrays):**
  - `lead_industries` (TEXT[])
  - `lead_locations` (TEXT[])
  - `lead_types` (TEXT[])
  - `lead_budget_min`, `lead_budget_max` (NUMERIC)

- **Onboarding:**
  - `onboarding_step` (INTEGER)
  - `onboarding_completed_at` (TIMESTAMPTZ)

#### `leads` (Lead management)
- **Primary Key:** `id` (UUID)
- **Basis velden:**
  - `name`, `email`, `phone`, `message` (TEXT)
  - `user_id` (UUID, references `profiles` of `users`)
  - `status` (TEXT, default 'new')
  - `created_at` (TIMESTAMPTZ)

- **Billing/assignment velden:**
  - `industry_id` (UUID, references `industries`)
  - `price_at_purchase` (DECIMAL(10,2))
  - `approved_at` (TIMESTAMPTZ)
  - `deadline` (TIMESTAMPTZ)
  - `priority` (TEXT, default 'medium')

#### `industries` (Branches)
- **Primary Key:** `id` (UUID of INTEGER - te verifiëren)
- **Velden:**
  - `name` (TEXT)
  - Mogelijk pricing velden (te verifiëren)

#### `subscriptions` (Abonnementen)
- **Primary Key:** `id` (UUID)
- **Velden:**
  - `user_id` (UUID, references `profiles`)
  - `status` (TEXT, default 'active')
  - `leads_per_month` (INTEGER - voor quota)
  - `created_at`, `updated_at` (TIMESTAMPTZ)

### 2. Bestaande Views & Functions

#### Views:
- `v_monthly_lead_usage` - Maandelijkse lead usage per user

#### Functions:
- `get_billing_snapshot(p_user uuid)` - Billing snapshot
- `can_allocate_lead(p_user uuid, p_price numeric)` - Lead allocation check
- `ensure_profile(uid uuid, p_email text)` - Profile creation

### 3. Relevante Relaties

- `leads.user_id` → `profiles.id` (of `users.id`)
- `leads.industry_id` → `industries.id`
- `profiles.role_id` → `roles.id`
- `subscriptions.user_id` → `profiles.id`

---

## Wat ONTBREEKT voor Lead Flow Intelligence

### ❌ Segmenten
- Geen `lead_segments` tabel
- Geen segment-definitie op basis van branche + regio

### ❌ Stats per Segment
- Geen `lead_generation_stats` tabel
- Geen dagelijkse aggregatie per segment

### ❌ Planning/Targets
- Geen `lead_segment_plans` of `lead_segment_targets` tabel
- Geen target vs actual tracking

### ❌ Segment-koppeling in Leads
- `leads` tabel heeft geen `segment_id` veld
- Geen directe koppeling tussen leads en segmenten

### ❌ Channel Orchestration data
- Geen Google Ads campaign mapping
- Geen budget tracking per segment/kanaal

---

## SQL Queries voor Verificatie

De exacte SQL queries die ik **zou** draaien om het schema te verifiëren staan in:
**`PHASE1_SCHEMA_INSPECTION_QUERIES.sql`**

Deze queries:
- ✅ Tonen alle tabellen
- ✅ Tonen kolommen van `leads`, `profiles`, `industries`, `subscriptions`
- ✅ Checken op bestaande stats/segment/plan tabellen
- ✅ Tonen foreign keys en indexen
- ✅ Tonen sample data

**LET OP:** Deze queries zijn alleen voorstellen - ze worden in deze fase NIET uitgevoerd.

---

## Volgende Stap

Na goedkeuring van deze inspectie, ga ik naar **FASE 2**: Voorstel nieuw SQL schema voor Lead Flow Intelligence.

