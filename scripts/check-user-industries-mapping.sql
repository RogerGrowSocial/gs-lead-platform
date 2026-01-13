-- Check: Welke industries heeft user 465341c4-aea3-41e1-aba9-9c3b5d621602 en matchen ze met segmenten?

-- 1. Check user industry preferences
SELECT 
  'User Industries' as check_type,
  uip.industry_id,
  uip.is_enabled,
  i.name as industry_name,
  LOWER(i.name) as industry_name_lower
FROM user_industry_preferences uip
JOIN industries i ON i.id = uip.industry_id
WHERE uip.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND uip.is_enabled = true
ORDER BY i.name;

-- 2. Check welke segmenten er zijn
SELECT 
  'Segments' as check_type,
  ls.branch,
  ls.region,
  ls.id as segment_id,
  LOWER(ls.branch) as branch_lower
FROM lead_segments ls
WHERE ls.is_active = true
ORDER BY ls.branch, ls.region;

-- 3. Check of user industries matchen met segment branches
SELECT 
  'Match Check' as check_type,
  i.name as industry_name,
  LOWER(i.name) as industry_lower,
  ls.branch as segment_branch,
  LOWER(ls.branch) as segment_branch_lower,
  CASE 
    WHEN LOWER(i.name) = LOWER(ls.branch) THEN '✅ MATCH'
    ELSE '❌ NO MATCH'
  END as match_status,
  ls.region,
  ls.id as segment_id
FROM user_industry_preferences uip
JOIN industries i ON i.id = uip.industry_id
CROSS JOIN lead_segments ls
WHERE uip.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND uip.is_enabled = true
  AND ls.is_active = true
  AND (
    ls.region = ANY(ARRAY['zuid-holland', 'noord-brabant']::TEXT[])
  )
ORDER BY i.name, ls.branch, ls.region;

-- 4. Check capaciteit voor segmenten waar user in zou moeten zitten
WITH user_industry_branches AS (
  SELECT DISTINCT LOWER(i.name) as branch_name
  FROM user_industry_preferences uip
  JOIN industries i ON i.id = uip.industry_id
  WHERE uip.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
    AND uip.is_enabled = true
)
SELECT 
  'Capacity Check' as check_type,
  ls.branch,
  ls.region,
  ls.id as segment_id,
  cap.*,
  GREATEST(5, FLOOR(cap.capacity_total_leads * 0.8)) as expected_target
FROM lead_segments ls
CROSS JOIN LATERAL get_segment_capacity(ls.id) cap
JOIN user_industry_branches uib ON LOWER(ls.branch) = uib.branch_name
WHERE ls.is_active = true
  AND (
    ls.region = ANY(ARRAY['zuid-holland', 'noord-brabant']::TEXT[])
  )
ORDER BY ls.branch, ls.region;

