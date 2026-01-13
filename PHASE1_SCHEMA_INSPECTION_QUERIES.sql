-- =====================================================
-- FASE 1: DATABASE SCHEMA INSPECTIE (ALLEEN LEZEN)
-- =====================================================
-- Deze queries zijn VOORSTELLEN om het schema te inspecteren
-- Ze worden NIET uitgevoerd in deze fase - alleen getoond
-- =====================================================

-- 1. Overzicht van alle publieke tabellen
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Gedetailleerde kolommen van de leads tabel
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leads'
ORDER BY ordinal_position;

-- 3. Gedetailleerde kolommen van de profiles tabel
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. Check op bestaande stats/analytics/segment tabellen
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%stats%' 
    OR table_name ILIKE '%analytics%' 
    OR table_name ILIKE '%segment%'
    OR table_name ILIKE '%plan%'
    OR table_name ILIKE '%target%'
  )
ORDER BY table_name;

-- 5. Check op industries tabel (voor segment-relatie)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'industries'
ORDER BY ordinal_position;

-- 6. Foreign keys van leads tabel (om relaties te begrijpen)
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'leads'
  AND tc.table_schema = 'public';

-- 7. Indexen op leads tabel (voor performance begrip)
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'leads'
ORDER BY indexname;

-- 8. Check op subscriptions tabel (voor capaciteit begrip)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
ORDER BY ordinal_position;

-- 9. Sample data van leads (om te zien welke velden gebruikt worden)
-- LIMIT 5 om alleen structuur te zien, geen grote datasets
SELECT *
FROM leads
ORDER BY created_at DESC
LIMIT 5;

-- 10. Check op bestaande views (bijv. v_monthly_lead_usage)
SELECT 
  table_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

