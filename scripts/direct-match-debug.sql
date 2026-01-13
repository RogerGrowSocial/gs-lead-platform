-- Direct debug: Why doesn't the user match?

-- 1. Get segment values
SELECT 
  'Segment' as check_type,
  ls.id,
  ls.branch,
  LOWER(ls.branch) as branch_lower,
  ls.region,
  LOWER(ls.region) as region_lower
FROM lead_segments ls
WHERE ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e';

-- 2. Get user profile
SELECT 
  'User Profile' as check_type,
  p.id,
  p.company_name,
  p.is_active_for_routing,
  p.is_admin,
  p.regions,
  p.lead_locations,
  p.primary_branch,
  p.lead_industries
FROM profiles p
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 3. Test region match with exact segment region
SELECT 
  'Region Match Test' as check_type,
  p.id,
  ls.region as segment_region,
  p.regions as user_regions,
  p.lead_locations as user_lead_locations,
  CASE 
    WHEN ls.region = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) THEN '✅ MATCH (regions)'
    WHEN ls.region = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[])) THEN '✅ MATCH (lead_locations)'
    ELSE '❌ NO MATCH'
  END as region_match,
  CASE 
    WHEN ls.region = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) THEN 'regions'
    WHEN ls.region = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[])) THEN 'lead_locations'
    ELSE 'NONE'
  END as match_source
FROM profiles p
CROSS JOIN lead_segments ls
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e';

-- 4. Test branch match with exact segment branch
SELECT 
  'Branch Match Test' as check_type,
  p.id,
  ls.branch as segment_branch,
  LOWER(ls.branch) as segment_branch_lower,
  p.primary_branch as user_primary_branch,
  p.lead_industries as user_lead_industries,
  CASE 
    WHEN EXISTS (
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
    ) THEN '✅ MATCH (user_industry_preferences)'
    WHEN p.primary_branch = ls.branch THEN '✅ MATCH (primary_branch)'
    WHEN ls.branch = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[])) THEN '✅ MATCH (lead_industries)'
    ELSE '❌ NO MATCH'
  END as branch_match
FROM profiles p
CROSS JOIN lead_segments ls
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e';

-- 5. Show all user industries with normalization
SELECT 
  'User Industries Detail' as check_type,
  uip.user_id,
  uip.industry_id,
  i.name as industry_name,
  LOWER(i.name) as industry_lower,
  public.normalize_branch_name(i.name) as normalized,
  ls.branch as segment_branch,
  LOWER(ls.branch) as segment_branch_lower,
  CASE 
    WHEN LOWER(i.name) = LOWER(ls.branch) THEN '✅ EXACT MATCH'
    WHEN public.normalize_branch_name(i.name) = LOWER(ls.branch) THEN '✅ NORMALIZED MATCH'
    WHEN LOWER(ls.branch) = public.normalize_branch_name(i.name) THEN '✅ REVERSE NORMALIZED MATCH'
    ELSE '❌ NO MATCH'
  END as match_status
FROM user_industry_preferences uip
JOIN industries i ON i.id = uip.industry_id
CROSS JOIN lead_segments ls
WHERE uip.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND uip.is_enabled = true
  AND ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e';

-- 6. Full condition test
SELECT 
  'Full Condition Test' as check_type,
  p.id,
  CASE WHEN p.is_active_for_routing = true THEN '✅' ELSE '❌' END as routing_active,
  CASE WHEN p.is_admin = false THEN '✅' ELSE '❌' END as not_admin,
  CASE 
    WHEN ls.region = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
         OR ls.region = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[])) THEN '✅'
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
          LOWER(i.name) = LOWER(ls.branch)
          OR public.normalize_branch_name(i.name) = LOWER(ls.branch)
          OR LOWER(ls.branch) = public.normalize_branch_name(i.name)
        )
    )
    OR p.primary_branch = ls.branch 
    OR ls.branch = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[])) THEN '✅'
    ELSE '❌'
  END as branch_match,
  CASE 
    WHEN p.is_active_for_routing = true
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
      ) THEN '✅ FULL MATCH'
    ELSE '❌ NO FULL MATCH'
  END as full_match
FROM profiles p
CROSS JOIN lead_segments ls
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e';

