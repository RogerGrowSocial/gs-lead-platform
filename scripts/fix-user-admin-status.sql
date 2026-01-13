-- Fix user admin status so they match segment conditions

-- 1. Check current admin status
SELECT 
  'Current Admin Status' as check_type,
  p.id,
  p.company_name,
  p.is_admin,
  p.is_active_for_routing,
  CASE 
    WHEN p.is_admin = true THEN '❌ IS ADMIN'
    WHEN p.is_admin = false THEN '✅ NOT ADMIN'
    WHEN p.is_admin IS NULL THEN '❌ NULL (treated as admin)'
    ELSE '❓ UNKNOWN'
  END as admin_status
FROM profiles p
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 2. FIX: Set is_admin to false if it's not already false
UPDATE profiles
SET is_admin = false
WHERE id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND (is_admin IS NULL OR is_admin = true);

-- 3. Verify after fix
SELECT 
  'After Fix - Admin Status' as check_type,
  p.id,
  p.company_name,
  p.is_admin,
  p.is_active_for_routing,
  CASE 
    WHEN p.is_admin = false THEN '✅ NOT ADMIN'
    ELSE '❌ STILL ADMIN'
  END as admin_status
FROM profiles p
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 4. Test full condition again
SELECT 
  'After Fix - Full Condition Test' as check_type,
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

-- 5. Test capacity after fix
SELECT 
  'Capacity After Admin Fix' as check_type,
  public.get_segment_capacity('f204bcab-a89f-42a0-b499-0a9add824c5e'::UUID) as capacity_result;

