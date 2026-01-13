# Row Level Security (RLS) Policies

**Last Updated:** 2025-01-28

---

## Overview

All tables in the database have RLS enabled. Policies enforce data access based on user role and ownership.

**Principle:** Users can only access data they own or are authorized to see.

---

## Policy Patterns

### 1. User-Owned Data
**Pattern:** Users can only see/modify their own records.

**Example:** `profiles` table
```sql
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);
```

### 2. Admin-Only Access
**Pattern:** Only admins can access all records.

**Example:** `sites` table
```sql
CREATE POLICY "Admins can manage sites"
  ON sites FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

### 3. Public Read, Authenticated Write
**Pattern:** Public can read, authenticated users can write.

**Example:** `sites` table (active sites)
```sql
CREATE POLICY "Anyone can view active sites"
  ON sites FOR SELECT
  USING (is_active = TRUE);
```

### 4. Partner-Assigned Data
**Pattern:** Partners can only see data assigned to them.

**Example:** `leads` table
```sql
CREATE POLICY "Partners can view assigned leads"
  ON leads FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

---

## All Tables with RLS Enabled

**Source:** Extracted from `schema.sql` and migrations. All tables below have `ENABLE ROW LEVEL SECURITY` applied.

### Core Tables

1. **`profiles`** - Users/partners (extends Supabase auth.users)
   - **Policies:** See migration `001_ensure_profile.sql` and `20250909215240_profiles_trigger.sql`
   - Users see own profile; admins see all

2. **`profile_completion_status`** - Onboarding completion tracking
   - **Policies:** See migration `20240320000000_create_profile_completion_status.sql`

### Lead Management

3. **`lead_segments`** - Industry + region combinations
   - **Policies:** See migration `20250115000000_lead_flow_intelligence.sql`
   - Public can view active segments; admins manage all

4. **`lead_generation_stats`** - Daily lead statistics per segment
   - **Policies:** See migration `20250115000000_lead_flow_intelligence.sql`

5. **`lead_segment_plans`** - Target calculations per segment
   - **Policies:** See migration `20250115000000_lead_flow_intelligence.sql`

6. **`channel_orchestration_log`** - Marketing channel orchestration logs
   - **Policies:** See migration `20250115000000_lead_flow_intelligence.sql`

### Partner Marketing

7. **`partner_segments`** - Partner-segment associations
   - **Policies:** See migration `20250115000003_partner_marketing.sql`

8. **`partner_landing_pages`** - Platform-first landing pages
   - **Policies:** See migration `20250115000003_partner_marketing.sql`
   - Public can view live pages; admins manage all

9. **`partner_marketing_campaigns`** - Marketing campaigns
   - **Policies:** See migration `20250115000003_partner_marketing.sql`

10. **`partner_lead_gaps`** - Lead gap tracking
    - **Policies:** See migration `20250115000003_partner_marketing.sql`

11. **`ai_marketing_recommendations`** - AI-generated marketing recommendations
    - **Policies:** See migration `20250115000003_partner_marketing.sql`

### Multi-Site

12. **`sites`** - Multi-site domains/brands
    - **Policies:** See migration `20250115000004_add_sites_table.sql`
    - Public can view active sites; admins manage all

### User Preferences

13. **`user_location_preferences`** - User location preferences
    - **Policies:** See migration `20250115000002_user_location_preferences.sql`

### AI Router

14. **`ai_router_settings`** - AI routing configuration
    - **Policies:** See migration `20250115000001_add_ai_router_settings.sql`

### Risk Assessment

15. **`user_risk_settings`** - User risk assessment settings
    - **Policies:** See migration `20250113000001_add_user_risk_settings.sql`

### Form Builder & Analytics

16. **`form_analytics`** - Form performance analytics
    - **Policies:** See migration `20250121000000_form_analytics.sql`

17. **`lead_value_predictions`** - AI lead value predictions
    - **Policies:** See migration `20250121000001_lead_value_predictions.sql`

18. **`form_optimization_suggestions`** - Form optimization recommendations
    - **Policies:** See migration `20250121000002_form_optimization.sql`

19. **`partner_form_customizations`** - Partner-specific form customizations
    - **Policies:** See migration `20250121000003_partner_form_customizations.sql`

### Integrations

20. **`google_ads_accounts`** - Google Ads account mappings
    - **Policies:** See migration `20250128000000_add_google_ads_campaign_mapping.sql`

### Billing

21. **`subscriptions`** - Lead quotas per user
    - **Policies:** See migration `20250110000000_billing_functions.sql`
    - Users see own subscriptions; admins see all

### Performance System

22. **`lead_feedback`** - Lead feedback (RLS commented out)
    - **Policies:** See migration `20250120000000_performance_system_phase1.sql` (commented)

23. **`support_tickets`** - Support tickets (RLS commented out)
    - **Policies:** See migration `20250120000000_performance_system_phase1.sql` (commented)

---

## Policy Definitions Location

**All RLS policies are defined in:**
- Migration files: `supabase/migrations/*.sql`
- Schema export: `docs/01-data/schema.sql` (if exported)

**To view policies for a specific table:**
1. Check `schema.sql` for `CREATE POLICY` statements
2. Or search migrations: `grep -r "CREATE POLICY.*table_name" supabase/migrations/`

---

## Service Role Bypass

**Important:** The Supabase service role key bypasses RLS.

**When to use:**
- Admin operations in backend code
- Cron jobs that need to access all data
- System operations (not user-initiated)

**How to use:**
```javascript
const { supabaseAdmin } = require('../config/supabase')
// supabaseAdmin uses service role key, bypasses RLS
```

**Security:** Service role key is **never** exposed to client. Only used in backend.

---

## Testing RLS

### Test as Regular User
```sql
-- Set current user context
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-uuid-here';

-- Test query
SELECT * FROM leads;  -- Should only see assigned leads
```

### Test as Admin
```sql
-- Set admin context
SET ROLE authenticated;
SET request.jwt.claim.sub = 'admin-uuid-here';

-- Test query
SELECT * FROM leads;  -- Should see all leads
```

---

## Common Issues

### Issue: "Policy violation" error
**Cause:** RLS policy is too restrictive or user context is missing.

**Solution:**
1. Check if user is authenticated: `auth.uid() IS NOT NULL`
2. Check if user has required role: `is_admin = true`
3. Check if user owns the record: `user_id = auth.uid()`

### Issue: Service role queries fail
**Cause:** Using regular Supabase client instead of admin client.

**Solution:** Use `supabaseAdmin` for admin operations.

### Issue: Public API can't create leads
**Cause:** RLS policy requires authentication.

**Solution:** Create separate policy for public INSERT:
```sql
CREATE POLICY "Public can create leads"
  ON leads FOR INSERT
  WITH CHECK (true);  -- No auth required for public API
```

---

## Related Documentation

- **Schema:** `/docs/01-data/schema.sql` (canonical source)
- **Triggers:** `/docs/01-data/triggers_and_functions.md`

