-- Check if the expected user matches the segment conditions

-- 1. Segment info
SELECT 
  'Segment Info' as check_type,
  ls.id,
  ls.branch,
  ls.region,
  ls.is_active
FROM lead_segments ls
WHERE ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e';

-- 2. Check if expected user matches region
SELECT 
  'Region Match Check' as check_type,
  p.id,
  p.company_name,
  p.regions,
  p.lead_locations,
  CASE 
    WHEN 'noord-brabant' = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) THEN '✅ MATCH (regions)'
    WHEN 'noord-brabant' = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[])) THEN '✅ MATCH (lead_locations)'
    ELSE '❌ NO MATCH'
  END as region_match
FROM profiles p
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 3. Check if expected user matches branch
SELECT 
  'Branch Match Check' as check_type,
  p.id,
  p.company_name,
  p.primary_branch,
  p.lead_industries,
  CASE 
    WHEN EXISTS (
      SELECT 1
      FROM user_industry_preferences uip
      JOIN industries i ON i.id = uip.industry_id
      WHERE uip.user_id = p.id
        AND uip.is_enabled = true
        AND (
          LOWER(i.name) = 'schilder'
          OR public.normalize_branch_name(i.name) = 'schilder'
        )
    ) THEN '✅ MATCH (user_industry_preferences)'
    WHEN p.primary_branch = 'schilder' THEN '✅ MATCH (primary_branch)'
    WHEN 'schilder' = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[])) THEN '✅ MATCH (lead_industries)'
    ELSE '❌ NO MATCH'
  END as branch_match
FROM profiles p
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 4. Check all conditions together
SELECT 
  'Full Match Check' as check_type,
  p.id,
  p.company_name,
  p.is_active_for_routing,
  p.is_admin,
  CASE 
    WHEN p.is_active_for_routing = true THEN '✅'
    ELSE '❌'
  END as routing_active,
  CASE 
    WHEN p.is_admin = false THEN '✅'
    ELSE '❌'
  END as not_admin,
  CASE 
    WHEN 'noord-brabant' = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
         OR 'noord-brabant' = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[])) THEN '✅'
    ELSE '❌'
  END as region_match,
  CASE 
    WHEN EXISTS (
      SELECT 1
      FROM user_industry_preferences uip
      JOIN industries i ON i.id = uip.industry_id
      WHERE uip.user_id = p.id
        AND uip.is_enabled = true
        AND (
          LOWER(i.name) = 'schilder'
          OR public.normalize_branch_name(i.name) = 'schilder'
        )
    )
    OR p.primary_branch = 'schilder' 
    OR 'schilder' = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[])) THEN '✅'
    ELSE '❌'
  END as branch_match
FROM profiles p
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 5. Check what users DO match
WITH partner_subscriptions AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    leads_per_month
  FROM subscriptions
  WHERE status = 'active' 
    AND is_paused = false
  ORDER BY user_id, created_at DESC
)
SELECT 
  'All Matching Users' as check_type,
  p.id,
  p.company_name,
  ps.leads_per_month as subscription_value,
  p.max_open_leads as profile_fallback,
  COALESCE(ps.leads_per_month, p.max_open_leads, 0) as capacity_value
FROM lead_segments ls
JOIN profiles p ON (
  p.is_active_for_routing = true
  AND p.is_admin = false
  AND (
    ls.region = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
    OR ls.region = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[]))
  )
  AND (
    EXISTS (
      SELECT 1
      FROM user_industry_preferences uip
      JOIN industries i ON i.id = uip.industry_id
      WHERE uip.user_id = p.id
        AND uip.is_enabled = true
        AND (
          LOWER(i.name) = LOWER(ls.branch)
          OR public.normalize_branch_name(i.name) = LOWER(ls.branch)
          OR LOWER(ls.branch) = public.normalize_branch_name(i.name)
        )
    )
    OR p.primary_branch = ls.branch 
    OR ls.branch = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[]))
  )
)
LEFT JOIN partner_subscriptions ps ON ps.user_id = p.id
WHERE ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e'
  AND ls.is_active = true
ORDER BY p.id;

