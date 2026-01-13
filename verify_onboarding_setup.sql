-- =====================================================
-- ONBOARDING SYSTEM - Verification Queries
-- =====================================================
-- Run deze queries om te controleren of alles correct is geïnstalleerd

-- 1. Check alle kolommen
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN (
    'first_name', 'last_name', 'company_name', 'phone',
    'referral_source', 'referral_note',
    'lead_industries', 'lead_locations', 'lead_types',
    'lead_budget_min', 'lead_budget_max',
    'notify_channels',
    'onboarding_step', 'onboarding_completed_at'
  )
ORDER BY column_name;

-- 2. Check functies
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_onboarding_status',
    'complete_onboarding',
    'update_onboarding_step',
    'set_default_onboarding_step'
  )
ORDER BY routine_name;

-- 3. Check view
SELECT 
  table_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'v_onboarding_progress';

-- 4. Check triggers
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'trigger_set_default_onboarding';

-- 5. Check indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
  AND indexname LIKE '%onboarding%';

-- 6. Test functie (vervang USER_ID met een echte user ID)
-- SELECT get_onboarding_status('USER_ID_HIER');

-- 7. Check bestaande users (voorbeeld)
SELECT 
  id,
  email,
  onboarding_step,
  onboarding_completed_at,
  CASE 
    WHEN onboarding_completed_at IS NOT NULL THEN 'Voltooid'
    WHEN onboarding_step > 0 THEN 'Bezig'
    ELSE 'Niet gestart'
  END as status
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

