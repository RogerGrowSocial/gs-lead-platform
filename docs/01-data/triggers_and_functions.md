# Database Triggers & Functions

**Last Updated:** 2025-01-28

---

## Overview

PostgreSQL functions and triggers handle complex logic, data integrity, and automated processes.

**Principle:** Business logic in database functions ensures consistency and performance.

---

## All Functions

**Source:** Extracted from `schema.sql` and migrations.

### Profile Management
- `ensure_profile(uid UUID, p_email TEXT)` - Safely creates or updates profile for user (migration: `001_ensure_profile.sql`)
- `create_profile_for_new_user()` - Automatically creates profile when auth user is created (migration: `20250909215240_profiles_trigger.sql`)

### Capacity & Segments
- `get_segment_capacity(segment_id UUID)` - Calculates total capacity for a segment (only paying partners) (migration: `20250117000001_update_capacity_for_paying_partners_only.sql`)
- `get_branch_region_capacity_combos()` - Finds all active (branch, region) combinations with capacity > 0 (migration: `20250117000000_add_get_branch_region_capacity_combos.sql`)
- `normalize_branch_name(industry_name TEXT)` - Normalizes branch/industry names for matching (migration: `20250116000000_fix_segment_capacity_from_subscriptions.sql`)
- `recalculate_targets_for_user_segments(p_user_id UUID)` - Recalculates targets for all segments of a user (migration: `20250116000000_fix_segment_capacity_from_subscriptions.sql`)

### Billing
- `get_billing_snapshot(p_user UUID)` - Returns billing status (quota, usage, balance, payment method) (migration: `20250110000000_billing_functions.sql`)
- `can_allocate_lead(p_user UUID, p_price NUMERIC)` - Validates if lead can be allocated (returns 'OK', 'QUOTA_REACHED', or 'INSUFFICIENT_FUNDS') (migration: `20250110000000_billing_functions.sql`)

### Lead Flow Intelligence
- `calculate_lead_gap(...)` - Calculates lead gap for segment (migration: `20250115000000_lead_flow_intelligence.sql`)
- `update_lead_gap(...)` - Updates lead gap statistics (migration: `20250115000000_lead_flow_intelligence.sql`)

### Location Preferences
- `sync_lead_locations_from_preferences()` - Syncs lead_locations array from user_location_preferences (migration: `20250115000002_user_location_preferences.sql`)

### Risk Assessment
- `notify_risk_assessment_needed()` - Notifies risk assessment worker when profile changes (migration: `20250113000002_add_risk_assessment_trigger.sql`)

### Performance System
- `set_first_contact_at()` - Sets first_contact_at timestamp on lead acceptance (migration: `20250120000000_performance_system_phase1.sql`)
- `refresh_partner_performance_stats()` - Refreshes materialized view partner_performance_stats (migration: `20250120000001_performance_system_phase2_view.sql`)

### Form Analytics
- `refresh_form_step_performance()` - Refreshes form step performance metrics (migration: `20250121000000_form_analytics.sql`)
- `update_lead_prediction_outcome(...)` - Updates lead value prediction with actual outcome (migration: `20250121000001_lead_value_predictions.sql`)
- `trigger_update_prediction_on_lead_status()` - Trigger function to update prediction on lead status change (migration: `20250121000001_lead_value_predictions.sql`)
- `update_optimization_suggestion_status(...)` - Updates form optimization suggestion status (migration: `20250121000002_form_optimization.sql`)
- `update_partner_customization_performance(...)` - Updates partner form customization performance metrics (migration: `20250121000003_partner_form_customizations.sql`)
- `refresh_form_benchmarks()` - Refreshes form benchmark statistics (migration: `20250121000004_form_benchmarks.sql`)

### Utility Functions
- `update_updated_at_column()` - Automatically updates updated_at timestamp (used by multiple triggers) (migrations: `20250115000003_partner_marketing.sql`, `20250115000004_add_sites_table.sql`, `20240320000000_create_profile_completion_status.sql`)

---

## All Triggers

**Source:** Extracted from `schema.sql` and migrations.

### Profile Management
- `on_auth_user_created` - AFTER INSERT ON auth.users → Creates profile automatically (migration: `20250909215240_profiles_trigger.sql`)

### Updated At Triggers
- `update_sites_updated_at` - BEFORE UPDATE ON sites → Updates updated_at (migration: `20250115000004_add_sites_table.sql`)
- `update_partner_segments_updated_at` - BEFORE UPDATE ON partner_segments → Updates updated_at (migration: `20250115000003_partner_marketing.sql`)
- `update_partner_landing_pages_updated_at` - BEFORE UPDATE ON partner_landing_pages → Updates updated_at (migration: `20250115000003_partner_marketing.sql`)
- `update_partner_marketing_campaigns_updated_at` - BEFORE UPDATE ON partner_marketing_campaigns → Updates updated_at (migration: `20250115000003_partner_marketing.sql`)
- `lead_form_templates_updated_at` - BEFORE UPDATE ON lead_form_templates → Updates updated_at (migration: `20250120000000_form_builder_phase2.sql`)
- `update_profile_completion_status_updated_at` - BEFORE UPDATE ON profile_completion_status → Updates updated_at (migration: `20240320000000_create_profile_completion_status.sql`)

### Risk Assessment
- `trigger_risk_assessment_on_profile_insert` - AFTER INSERT ON profiles → Triggers risk assessment (migration: `20250113000002_add_risk_assessment_trigger.sql`)
- `trigger_risk_assessment_on_profile_update` - AFTER UPDATE ON profiles → Triggers risk assessment on changes (migration: `20250113000002_add_risk_assessment_trigger.sql`)

### Location Preferences
- `sync_lead_locations_trigger` - AFTER INSERT OR UPDATE ON user_location_preferences → Syncs lead_locations array (migration: `20250115000002_user_location_preferences.sql`)

### Performance System
- `trigger_set_first_contact_at` - AFTER UPDATE ON leads → Sets first_contact_at when status changes to accepted (migration: `20250120000000_performance_system_phase1.sql`)

### Lead Value Predictions
- `trigger_update_prediction_on_lead_status` - AFTER UPDATE ON leads → Updates prediction outcome on status change (migration: `20250121000001_lead_value_predictions.sql`)

### Subscription Changes
- `trigger_subscription_change_recalculate_targets` - AFTER UPDATE ON subscriptions → Recalculates targets (commented out in migration: `20250116000000_fix_segment_capacity_from_subscriptions.sql`)

---

## Key Triggers

### Profile Creation

#### `on_auth_user_created()`
**Purpose:** Creates `profiles` record when Supabase auth user is created.

**Trigger:** `AFTER INSERT ON auth.users`

**Action:** Inserts into `profiles` table with default values.

**Location:** `supabase/migrations/20250909215240_profiles_trigger.sql`

**Note:** Auth Hook is disabled; trigger handles profile creation.

---

### Updated At

#### `update_updated_at_column()`
**Purpose:** Automatically updates `updated_at` timestamp.

**Trigger:** `BEFORE UPDATE ON [table]`

**Action:** Sets `NEW.updated_at = NOW()`.

**Applied to:** Most tables with `updated_at` column.

---

### Risk Assessment

#### `trigger_user_risk_assessment()`
**Purpose:** Automatically assesses user risk on profile changes.

**Trigger:** `AFTER INSERT OR UPDATE ON profiles`

**Action:** Calls risk assessment logic, updates `ai_risk_score`, `ai_risk_level`.

**Location:** `supabase/migrations/20250113000002_add_risk_assessment_trigger.sql`

---

### Lead Usage Tracking

#### Lead usage triggers (if exists)
**Purpose:** Track lead usage for billing.

**Trigger:** `AFTER UPDATE ON leads` (when status changes to 'accepted')

**Action:** Records usage in `v_monthly_lead_usage` or usage table.

**Location:** Check billing migrations

---

## Function Patterns

### Pattern 1: Capacity Calculation
```sql
CREATE OR REPLACE FUNCTION get_segment_capacity(p_segment_id UUID)
RETURNS JSONB AS $$
  -- Aggregate capacity from partners
  -- Filter on payment method
  -- Return JSONB
$$ LANGUAGE plpgsql;
```

### Pattern 2: Validation Function
```sql
CREATE OR REPLACE FUNCTION can_allocate_lead(p_user UUID, p_price NUMERIC)
RETURNS TEXT AS $$
  -- Check quota
  -- Check balance
  -- Return 'OK' or error code
$$ LANGUAGE plpgsql;
```

### Pattern 3: Snapshot Function
```sql
CREATE OR REPLACE FUNCTION get_billing_snapshot(p_user UUID)
RETURNS JSONB AS $$
  -- Aggregate billing data
  -- Return JSONB object
$$ LANGUAGE plpgsql;
```

---

## Calling Functions from Code

### Using Supabase Client
```javascript
const { data, error } = await supabase.rpc('get_segment_capacity', {
  p_segment_id: segmentId
})
```

### Using Service Role (Admin)
```javascript
const { data, error } = await supabaseAdmin.rpc('get_segment_capacity', {
  p_segment_id: segmentId
})
```

---

## Performance Considerations

### Materialized Views
- **Refresh Strategy:** Daily via cron (not real-time)
- **Trade-off:** Slightly stale data for better performance
- **Example:** `partner_performance_stats`

### Function Caching
- PostgreSQL caches execution plans
- Functions with stable/immutable are cached
- Use `STABLE` or `IMMUTABLE` keywords when possible

### Index Usage
- Functions that query tables should use indexes
- Check `EXPLAIN ANALYZE` for query plans

---

## Testing Functions

### Test in SQL Editor
```sql
-- Test capacity function
SELECT get_segment_capacity('segment-uuid-here');

-- Test billing snapshot
SELECT get_billing_snapshot('user-uuid-here');

-- Test allocation check
SELECT can_allocate_lead('user-uuid-here', 5.50);
```

---

## Related Documentation

- **Schema:** `/docs/01-data/schema.sql` (canonical source)
- **RLS Policies:** `/docs/01-data/rls_policies.md`
- **Migrations:** `supabase/migrations/`

