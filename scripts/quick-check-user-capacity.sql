-- Quick check: Waarom is target 5 voor user 465341c4-aea3-41e1-aba9-9c3b5d621602?

-- 1. Check subscription
SELECT 
  'Subscription' as check_type,
  s.leads_per_month,
  s.status,
  s.is_paused,
  p.company_name
FROM subscriptions s
JOIN profiles p ON p.id = s.user_id
WHERE s.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND s.status = 'active'
  AND s.is_paused = false
ORDER BY s.created_at DESC
LIMIT 1;

-- 2. Check profile
SELECT 
  'Profile' as check_type,
  p.company_name,
  p.primary_branch,
  p.lead_industries,
  p.regions,
  p.lead_locations,
  p.is_active_for_routing,
  p.max_open_leads
FROM profiles p
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 3. Check in welke segmenten deze user zou moeten zitten
SELECT 
  'Segment Match' as check_type,
  ls.branch,
  ls.region,
  ls.id as segment_id,
  CASE 
    WHEN p.primary_branch = ls.branch OR ls.branch = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[])) THEN '✅ Branch match'
    ELSE '❌ Geen branch match'
  END as branch_match,
  CASE 
    WHEN ls.region = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
         OR ls.region = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[])) THEN '✅ Region match'
    ELSE '❌ Geen region match'
  END as region_match
FROM profiles p
CROSS JOIN lead_segments ls
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND ls.is_active = true
  AND (
    (p.primary_branch = ls.branch OR ls.branch = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[])))
    AND (
      ls.region = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
      OR ls.region = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[]))
    )
  );

-- 4. Check capaciteit voor elk segment waar user in zit
WITH user_segments AS (
  SELECT ls.id as segment_id, ls.branch, ls.region
  FROM profiles p
  CROSS JOIN lead_segments ls
  WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
    AND ls.is_active = true
    AND (
      (p.primary_branch = ls.branch OR ls.branch = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[])))
      AND (
        ls.region = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
        OR ls.region = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[]))
      )
    )
)
SELECT 
  'Capacity' as check_type,
  us.branch,
  us.region,
  cap.*,
  -- Calculate expected target
  GREATEST(5, FLOOR(cap.capacity_total_leads * 0.8)) as expected_target
FROM user_segments us
CROSS JOIN LATERAL get_segment_capacity(us.segment_id) cap;

-- 5. Check of migration is gedraaid (check functie definitie)
SELECT 
  'Migration Check' as check_type,
  CASE 
    WHEN pg_get_functiondef(oid)::text LIKE '%subscriptions%' THEN '✅ Migration gedraaid'
    ELSE '❌ Migration NIET gedraaid'
  END as migration_status
FROM pg_proc 
WHERE proname = 'get_segment_capacity' 
LIMIT 1;

