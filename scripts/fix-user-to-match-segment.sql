-- Fix the expected user to match the segment

-- 1. First, get the exact segment values
SELECT 
  'Segment Exact Values' as check_type,
  ls.id,
  ls.branch,
  LOWER(ls.branch) as branch_lower,
  ls.region,
  LOWER(ls.region) as region_lower
FROM lead_segments ls
WHERE ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e';

-- 2. Check current user state
SELECT 
  'Current User State' as check_type,
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

-- 3. Check user_industry_preferences
SELECT 
  'User Industry Preferences' as check_type,
  uip.user_id,
  uip.industry_id,
  i.name as industry_name,
  LOWER(i.name) as industry_lower,
  public.normalize_branch_name(i.name) as normalized,
  uip.is_enabled
FROM user_industry_preferences uip
JOIN industries i ON i.id = uip.industry_id
WHERE uip.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND uip.is_enabled = true;

-- 4. Test match with exact segment values
SELECT 
  'Match Test' as check_type,
  p.id,
  CASE 
    WHEN ls.region = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
         OR ls.region = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[])) THEN '✅ REGION MATCH'
    ELSE '❌ NO REGION MATCH'
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
    OR ls.branch = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[])) THEN '✅ BRANCH MATCH'
    ELSE '❌ NO BRANCH MATCH'
  END as branch_match
FROM profiles p
CROSS JOIN lead_segments ls
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e';

-- 5. FIX: Ensure user matches (if needed)
-- This will ensure lead_locations contains the segment region
UPDATE profiles
SET 
  lead_locations = ARRAY['zuid-holland', 'noord-brabant']::TEXT[]
WHERE id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND NOT ('noord-brabant' = ANY(COALESCE(lead_locations, ARRAY[]::TEXT[])));

-- 6. Verify after fix
SELECT 
  'After Fix - Region Match' as check_type,
  p.id,
  p.lead_locations,
  CASE 
    WHEN 'noord-brabant' = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[])) THEN '✅ MATCH'
    ELSE '❌ NO MATCH'
  END as region_match
FROM profiles p
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 7. Test capacity after fix
SELECT 
  'Capacity After Fix' as check_type,
  public.get_segment_capacity('f204bcab-a89f-42a0-b499-0a9add824c5e'::UUID) as capacity_result;

