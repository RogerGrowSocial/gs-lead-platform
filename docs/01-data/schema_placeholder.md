# Database Schema

**Last Updated:** 2025-01-28  
**Status:** Schema exported - `schema.sql` is the canonical source

---

## Schema Source of Truth

**`docs/01-data/schema.sql` is the canonical database schema.**

This file contains the complete, exported schema from Supabase including:
- **public schema:** All application tables, functions, triggers, policies
- **auth schema:** Supabase authentication tables (if included)
- **storage schema:** Supabase storage tables (if included)

**Always refer to `schema.sql` when:**
- Verifying table/column existence
- Checking data types and constraints
- Understanding relationships and foreign keys
- Reviewing indexes and performance structures

---

## How to Refresh Schema

### Option 1: Supabase CLI (Recommended)
```bash
supabase db dump --schema public > docs/01-data/schema.sql
```

### Option 2: pg_dump
```bash
pg_dump --schema-only -h [host] -U [user] -d [db] > docs/01-data/schema.sql
```

### Option 3: Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Run: `\d+` to list all tables
3. Export schema manually or use SQL to generate DDL

**Refresh frequency:** After major migrations or schema changes.

---

## Included Schemas

The exported `schema.sql` includes:
- **`public` schema:** All application tables, functions, triggers, policies, indexes
- **`auth` schema:** Supabase authentication tables (if exported)
- **`storage` schema:** Supabase storage tables (if exported)

**Note:** Most migrations only modify the `public` schema. Auth and storage schemas are managed by Supabase.

---

## Schema Location

**Migrations:** `supabase/migrations/` (chronological order)

**Key Migration Files:**
- `001_ensure_profile.sql` - Base profile setup
- `20250115000003_partner_marketing.sql` - Partner marketing tables
- `20250115000004_add_sites_table.sql` - Multi-site support
- `20250115000000_lead_flow_intelligence.sql` - Lead segments, capacity
- `20250110000000_billing_functions.sql` - Billing functions
- `20250113000000_add_user_risk_assessment.sql` - Risk assessment
- `20250120000000_form_builder_phase2.sql` - Form builder tables
- `20250121000000_form_analytics.sql` - Form analytics

---

## Core Tables (Summary)

### `profiles`
- **Purpose:** Users/partners (extends Supabase auth.users)
- **Key Fields:** `id`, `email`, `company_name`, `primary_branch`, `regions[]`, `max_open_leads`, `balance`, `is_admin`, `role_id`
- **Relations:** One-to-many with `leads`, `subscriptions`, `payment_methods`

### `leads`
- **Purpose:** Lead records
- **Key Fields:** `id`, `name`, `email`, `phone`, `message`, `user_id` (partner), `industry_id`, `status`, `price_at_purchase`
- **Relations:** Many-to-one with `profiles`, `industries`, `lead_segments`

### `lead_segments`
- **Purpose:** Industry + region combinations
- **Key Fields:** `id`, `branch`, `region`, `country`, `is_active`
- **Relations:** One-to-many with `leads`, `lead_segment_plans`

### `sites`
- **Purpose:** Multi-site domains/brands
- **Key Fields:** `id`, `name`, `domain`, `theme_key`, `is_active`
- **Relations:** One-to-many with `partner_landing_pages`

### `partner_landing_pages`
- **Purpose:** Platform-first landing pages
- **Key Fields:** `id`, `site_id`, `segment_id`, `path`, `page_type`, `status`, `content_json`
- **Note:** `partner_id` is nullable (platform-first)

### `subscriptions`
- **Purpose:** Lead quotas per user
- **Key Fields:** `id`, `user_id`, `leads_per_month`, `status`
- **Relations:** Many-to-one with `profiles`

### `payment_methods`
- **Purpose:** SEPA/Card payment methods
- **Key Fields:** `id`, `user_id`, `type` (sepa/card), `status` (active/pending/failed)
- **Relations:** Many-to-one with `profiles`

### `partner_performance_stats` (Materialized View)
- **Purpose:** Performance metrics per partner
- **Key Fields:** `partner_id`, `conversion_rate_30d`, `open_leads_count`, `avg_response_time_minutes`
- **Refresh:** Via cron job

---

## Key Functions

### `get_segment_capacity(segment_id UUID)`
- Returns capacity per segment (only paying partners)

### `get_branch_region_capacity_combos()`
- Returns active (branch, region) combinations with capacity > 0

### `can_allocate_lead(p_user UUID, p_price NUMERIC)`
- Validates if lead can be allocated (quota, balance check)

### `get_billing_snapshot(p_user UUID)`
- Returns billing status (quota, usage, balance, payment method)

---

## RLS Policies

All tables have RLS enabled. Key policies:
- **Profiles:** Users can only see their own profile
- **Leads:** Partners can only see their assigned leads; admins see all
- **Sites:** Public can view active sites; admins can manage
- **Payment Methods:** Users can only see their own payment methods

See `/docs/01-data/rls_policies.md` for details.

---

## Indexes

Key indexes:
- `idx_payment_methods_user_status` - Payment method lookups
- `idx_lead_segments_active_branch_region` - Segment queries
- `idx_sites_domain` - Domain resolution
- `idx_partner_landing_pages_site_path` - Landing page lookups

---

## Related Documentation

- **RLS Policies:** `/docs/01-data/rls_policies.md`
- **Triggers & Functions:** `/docs/01-data/triggers_and_functions.md`
- **Migrations:** `supabase/migrations/`

