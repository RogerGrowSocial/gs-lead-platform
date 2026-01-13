-- =====================================================
-- PERFORMANCE SYSTEM - DATABASE INSPECTIE
-- =====================================================
-- Run deze queries in Supabase SQL Editor om de huidige structuur te begrijpen
-- Voordat we het master prestatie-systeem bouwen

-- =====================================================
-- 1. PROFILES TABLE STRUCTURE
-- =====================================================
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check voor AI trust score kolommen
SELECT 
  column_name, 
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND (
    column_name ILIKE '%trust%' 
    OR column_name ILIKE '%risk%' 
    OR column_name ILIKE '%ai_score%'
  );

-- =====================================================
-- 2. LEADS TABLE STRUCTURE
-- =====================================================
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leads'
ORDER BY ordinal_position;

-- Check voor status kolommen en deal/order velden
SELECT 
  column_name, 
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leads'
  AND (
    column_name ILIKE '%status%'
    OR column_name ILIKE '%deal%'
    OR column_name ILIKE '%order%'
    OR column_name ILIKE '%value%'
    OR column_name ILIKE '%revenue%'
    OR column_name ILIKE '%invoice%'
    OR column_name ILIKE '%first_contact%'
    OR column_name ILIKE '%contacted%'
  );

-- =====================================================
-- 3. LEAD_ACTIVITIES TABLE (als die bestaat)
-- =====================================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'lead_activities';

-- Als lead_activities bestaat, toon structuur
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lead_activities'
ORDER BY ordinal_position;

-- =====================================================
-- 4. PARTNER_PERFORMANCE_STATS VIEW STRUCTURE
-- =====================================================
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partner_performance_stats'
ORDER BY ordinal_position;

-- Check of het een materialized view is
SELECT 
  schemaname,
  matviewname,
  ispopulated
FROM pg_matviews
WHERE matviewname = 'partner_performance_stats';

-- =====================================================
-- 5. DEALS / ORDERS / WON LEADS TABELLEN
-- =====================================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%deal%'
    OR table_name ILIKE '%order%'
    OR table_name ILIKE '%won%'
    OR table_name ILIKE '%completed%'
  )
ORDER BY table_name;

-- =====================================================
-- 6. FEEDBACK / RATINGS / COMPLAINTS TABELLEN
-- =====================================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%feedback%'
    OR table_name ILIKE '%rating%'
    OR table_name ILIKE '%satisfaction%'
    OR table_name ILIKE '%complaint%'
    OR table_name ILIKE '%ticket%'
    OR table_name ILIKE '%support%'
  )
ORDER BY table_name;

-- =====================================================
-- 7. SAMPLE DATA - LEADS STATUS DISTRIBUTIE
-- =====================================================
-- Eerst checken welke kolommen er zijn voor deal/order waarde
SELECT 
  status,
  COUNT(*) as count
FROM leads
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY status
ORDER BY count DESC;

-- Check welke kolommen er zijn die mogelijk deal/order waarde bevatten
-- (Run eerst query 2 hierboven om te zien welke kolommen er zijn)
-- Dan pas deze query aan met de juiste kolomnamen:
-- SELECT 
--   status,
--   COUNT(*) as count,
--   COUNT(CASE WHEN [kolom_naam] IS NOT NULL THEN 1 END) as with_value,
--   AVG([kolom_naam]) as avg_value
-- FROM leads
-- WHERE created_at >= NOW() - INTERVAL '30 days'
-- GROUP BY status
-- ORDER BY count DESC;

-- =====================================================
-- 8. SAMPLE DATA - LEAD ACTIVITIES TYPES
-- =====================================================
-- Check eerst of lead_activities bestaat (zie query 3 hierboven)
-- Als de tabel bestaat, uncomment en run deze query:
/*
SELECT 
  type,
  COUNT(*) as count
FROM lead_activities
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY type
ORDER BY count DESC
LIMIT 20;
*/

-- =====================================================
-- 9. CHECK VOOR REFRESH FUNCTION
-- =====================================================
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name ILIKE '%partner_performance%'
    OR routine_name ILIKE '%refresh%stats%'
  );

-- =====================================================
-- 10. VIEW DEFINITIE: partner_performance_stats
-- =====================================================
-- Toon de SQL definitie van de materialized view
SELECT 
  pg_get_viewdef('public.partner_performance_stats', true) as view_definition;

-- Of als het een materialized view is:
SELECT 
  definition
FROM pg_matviews
WHERE matviewname = 'partner_performance_stats';

