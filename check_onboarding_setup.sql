-- =====================================================
-- ONBOARDING SETUP CHECK SCRIPT
-- =====================================================
-- Run dit script in Supabase SQL Editor om te controleren
-- of alle benodigde kolommen en functies bestaan

-- =====================================================
-- 1. CHECK COLUMNS IN PROFILES TABLE
-- =====================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND table_schema = 'public'
  AND column_name IN (
    -- Basis informatie
    'first_name', 
    'last_name', 
    'company_name', 
    'phone',
    -- Adres informatie
    'street',
    'postal_code',
    'city',
    'country',
    'coc_number',
    -- Referral informatie
    'referral_source',
    'referral_note',
    -- Lead voorkeuren
    'lead_industries',
    'lead_locations',
    'lead_types',
    -- Budget voorkeuren
    'lead_budget_min',
    'lead_budget_max',
    -- Notificatie voorkeuren
    'notify_channels',
    -- Onboarding tracking
    'onboarding_step',
    'onboarding_completed_at'
  )
ORDER BY column_name;

-- =====================================================
-- 2. CHECK MISSING COLUMNS
-- =====================================================

-- Deze query toont welke kolommen ONTBREKEN
WITH required_columns AS (
  SELECT unnest(ARRAY[
    'first_name', 'last_name', 'company_name', 'phone',
    'street', 'postal_code', 'city', 'country', 'coc_number',
    'referral_source', 'referral_note',
    'lead_industries', 'lead_locations', 'lead_types',
    'lead_budget_min', 'lead_budget_max',
    'notify_channels',
    'onboarding_step', 'onboarding_completed_at'
  ]) AS col_name
),
existing_columns AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'profiles'
    AND table_schema = 'public'
)
SELECT 
  rc.col_name AS missing_column,
  'MISSING - Run ALTER TABLE to add' AS status
FROM required_columns rc
LEFT JOIN existing_columns ec ON rc.col_name = ec.column_name
WHERE ec.column_name IS NULL
ORDER BY rc.col_name;

-- =====================================================
-- 3. CHECK FUNCTIONS
-- =====================================================

SELECT 
  routine_name,
  routine_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_onboarding_status',
    'complete_onboarding',
    'update_onboarding_step'
  )
ORDER BY routine_name;

-- =====================================================
-- 4. CHECK RLS POLICIES
-- =====================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'profiles'
  AND schemaname = 'public'
ORDER BY policyname;

-- =====================================================
-- 5. CHECK INDEXES
-- =====================================================

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'profiles'
  AND schemaname = 'public'
  AND indexname LIKE '%onboarding%'
ORDER BY indexname;

-- =====================================================
-- 6. SAMPLE DATA CHECK (voor test user)
-- =====================================================

-- Vervang 'USER_ID_HIER' met een echte user ID om te testen
-- SELECT 
--   id,
--   email,
--   first_name,
--   last_name,
--   company_name,
--   phone,
--   street,
--   postal_code,
--   city,
--   country,
--   coc_number,
--   referral_source,
--   referral_note,
--   lead_industries,
--   lead_locations,
--   lead_types,
--   onboarding_step,
--   onboarding_completed_at
-- FROM profiles
-- WHERE id = 'USER_ID_HIER';

-- =====================================================
-- 7. QUICK FIX SCRIPT (als kolommen ontbreken)
-- =====================================================

-- Uncomment en run deze als kolommen ontbreken:

-- ALTER TABLE profiles
-- ADD COLUMN IF NOT EXISTS first_name TEXT,
-- ADD COLUMN IF NOT EXISTS last_name TEXT,
-- ADD COLUMN IF NOT EXISTS company_name TEXT,
-- ADD COLUMN IF NOT EXISTS phone TEXT,
-- ADD COLUMN IF NOT EXISTS street TEXT,
-- ADD COLUMN IF NOT EXISTS postal_code TEXT,
-- ADD COLUMN IF NOT EXISTS city TEXT,
-- ADD COLUMN IF NOT EXISTS country TEXT,
-- ADD COLUMN IF NOT EXISTS coc_number TEXT,
-- ADD COLUMN IF NOT EXISTS referral_source TEXT,
-- ADD COLUMN IF NOT EXISTS referral_note TEXT,
-- ADD COLUMN IF NOT EXISTS lead_industries TEXT[] DEFAULT '{}',
-- ADD COLUMN IF NOT EXISTS lead_locations TEXT[] DEFAULT '{}',
-- ADD COLUMN IF NOT EXISTS lead_types TEXT[] DEFAULT '{}',
-- ADD COLUMN IF NOT EXISTS lead_budget_min NUMERIC(10,2),
-- ADD COLUMN IF NOT EXISTS lead_budget_max NUMERIC(10,2),
-- ADD COLUMN IF NOT EXISTS notify_channels TEXT[] DEFAULT '{inapp}',
-- ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0,
-- ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- =====================================================
-- 8. SUMMARY REPORT
-- =====================================================

SELECT 
  'Profiles table exists' AS check_item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public')
    THEN '✅ PASS'
    ELSE '❌ FAIL - Table does not exist'
  END AS status
UNION ALL
SELECT 
  'Required columns count' AS check_item,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.columns 
          WHERE table_name = 'profiles' 
          AND table_schema = 'public'
          AND column_name IN (
            'first_name', 'last_name', 'company_name', 'phone',
            'street', 'postal_code', 'city', 'country', 'coc_number',
            'referral_source', 'referral_note',
            'lead_industries', 'lead_locations', 'lead_types',
            'lead_budget_min', 'lead_budget_max',
            'notify_channels',
            'onboarding_step', 'onboarding_completed_at'
          )) >= 19
    THEN '✅ PASS - All columns exist'
    ELSE '❌ FAIL - Some columns missing (see section 2)'
  END AS status
UNION ALL
SELECT 
  'Onboarding functions exist' AS check_item,
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.routines 
          WHERE routine_schema = 'public'
          AND routine_name IN ('get_onboarding_status', 'complete_onboarding', 'update_onboarding_step')) = 3
    THEN '✅ PASS'
    ELSE '❌ FAIL - Functions missing (see section 3)'
  END AS status
UNION ALL
SELECT 
  'RLS policies exist' AS check_item,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies 
          WHERE tablename = 'profiles' 
          AND schemaname = 'public') > 0
    THEN '✅ PASS'
    ELSE '❌ FAIL - No RLS policies found'
  END AS status;

