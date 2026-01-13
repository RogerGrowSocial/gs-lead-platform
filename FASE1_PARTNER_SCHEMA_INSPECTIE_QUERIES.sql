-- =====================================================
-- FASE 1: PARTNER SCHEMA INSPECTIE QUERIES
-- =====================================================
-- BELANGRIJK: Deze queries zijn ALLEEN voor inspectie
-- Voer ze uit in Supabase SQL Editor om het schema te verifiëren
-- Geen wijzigingen worden uitgevoerd
-- =====================================================

-- =====================================================
-- Query 1: Overzicht Partner-gerelateerde Tabellen
-- =====================================================
-- Zoekt naar tabellen die partners/bedrijven voorstellen
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%profile%' 
    OR table_name ILIKE '%partner%' 
    OR table_name ILIKE '%company%'
    OR table_name ILIKE '%user%'
  )
ORDER BY table_name;

-- =====================================================
-- Query 2: Kolommen van profiles Tabel (Partner Tabel)
-- =====================================================
-- Toont alle kolommen van de belangrijkste partner/bedrijfstabel
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- =====================================================
-- Query 3: Bestaande Koppeling met Segmenten/Branches/Regio's
-- =====================================================
-- Zoekt naar tabellen die segmenten/branches/regio's bevatten
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%segment%' 
    OR table_name ILIKE '%branch%' 
    OR table_name ILIKE '%region%'
    OR table_name ILIKE '%industry%'
  )
ORDER BY table_name;

-- =====================================================
-- Query 4: Foreign Keys en Constraints op profiles
-- =====================================================
-- Toont alle constraints (PK, FK, checks) op profiles tabel
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'profiles'
ORDER BY tc.constraint_type, tc.constraint_name;

-- =====================================================
-- Query 5: Bestaande Partner-Segment Koppeling
-- =====================================================
-- Check of er al een koppeltabel bestaat tussen partners en segmenten
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%partner%segment%'
    OR table_name ILIKE '%segment%partner%'
    OR table_name ILIKE '%profile%segment%'
  )
ORDER BY table_name;

-- =====================================================
-- Query 6: Kolommen van lead_segments Tabel
-- =====================================================
-- Toont structuur van lead_segments (bestaat al uit eerdere implementatie)
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lead_segments'
ORDER BY ordinal_position;

-- =====================================================
-- Query 7: Materialized View partner_performance_stats Structuur
-- =====================================================
-- Toont kolommen van partner_performance_stats view
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partner_performance_stats'
ORDER BY ordinal_position;

-- =====================================================
-- Query 8: Sample Data - Partners met Branches/Regio's
-- =====================================================
-- Toont voorbeelden van hoe partners momenteel zijn geconfigureerd
SELECT 
  id,
  company_name,
  primary_branch,
  regions,
  lead_industries,
  lead_locations,
  max_open_leads,
  is_active_for_routing,
  is_admin,
  status
FROM public.profiles
WHERE is_admin = false
  AND (primary_branch IS NOT NULL OR lead_industries IS NOT NULL)
LIMIT 10;

-- =====================================================
-- Query 9: Check of lead_segments al data bevat
-- =====================================================
-- Toont aantal segmenten en voorbeelden
SELECT 
  COUNT(*) AS total_segments,
  COUNT(*) FILTER (WHERE is_active = true) AS active_segments
FROM public.lead_segments;

SELECT 
  code,
  branch,
  region,
  country,
  is_active,
  created_at
FROM public.lead_segments
ORDER BY created_at DESC
LIMIT 10;

-- =====================================================
-- Query 10: Check voor bestaande marketing-gerelateerde velden
-- =====================================================
-- Zoekt naar kolommen die mogelijk marketing-gerelateerd zijn
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND (
    column_name ILIKE '%marketing%'
    OR column_name ILIKE '%campaign%'
    OR column_name ILIKE '%budget%'
    OR column_name ILIKE '%landing%'
    OR column_name ILIKE '%brand%'
    OR column_name ILIKE '%logo%'
  )
ORDER BY column_name;

