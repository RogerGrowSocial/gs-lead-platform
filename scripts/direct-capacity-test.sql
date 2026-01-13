-- Direct test: Wat is de capaciteit voor het schilder/noord-brabant segment?

-- 1. Vind het segment
SELECT 
  'Segment' as check_type,
  ls.id,
  ls.branch,
  ls.region,
  ls.code
FROM lead_segments ls
WHERE ls.branch = 'schilder'
  AND ls.region = 'noord-brabant'
  AND ls.is_active = true;

-- 2. Test de capaciteit functie direct
SELECT 
  'Capacity Direct' as check_type,
  cap.*,
  GREATEST(5, FLOOR(cap.capacity_total_leads * 0.8)) as expected_target
FROM get_segment_capacity('f204bcab-a89f-42a0-b499-0a9add824c5e') cap;

-- 3. Check welke partners gevonden worden
SELECT 
  'Partners Found' as check_type,
  p.id,
  p.company_name,
  p.is_active_for_routing,
  LOWER(i.name) as industry_name,
  normalize_branch_name(i.name) as normalized_industry,
  ls.branch as segment_branch,
  CASE 
    WHEN normalize_branch_name(i.name) = LOWER(ls.branch) THEN '✅ MATCH'
    ELSE '❌ NO MATCH'
  END as branch_match,
  CASE 
    WHEN 'noord-brabant' = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
         OR 'noord-brabant' = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[])) THEN '✅ MATCH'
    ELSE '❌ NO MATCH'
  END as region_match,
  s.leads_per_month,
  p.max_open_leads
FROM profiles p
CROSS JOIN lead_segments ls
LEFT JOIN user_industry_preferences uip ON uip.user_id = p.id AND uip.is_enabled = true
LEFT JOIN industries i ON i.id = uip.industry_id
LEFT JOIN subscriptions s ON s.user_id = p.id AND s.status = 'active' AND s.is_paused = false
WHERE ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e'
  AND p.is_active_for_routing = true
  AND p.is_admin = false
  AND (
    'noord-brabant' = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
    OR 'noord-brabant' = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[]))
  )
  AND (
    EXISTS (
      SELECT 1
      FROM user_industry_preferences uip2
      JOIN industries i2 ON i2.id = uip2.industry_id
      WHERE uip2.user_id = p.id
        AND uip2.is_enabled = true
        AND (
          LOWER(i2.name) = LOWER(ls.branch)
          OR normalize_branch_name(i2.name) = LOWER(ls.branch)
        )
    )
    OR p.primary_branch = ls.branch 
    OR ls.branch = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[]))
  );

-- 4. Check specifiek voor user 465341c4-aea3-41e1-aba9-9c3b5d621602
SELECT 
  'User Specific' as check_type,
  p.id,
  p.company_name,
  p.is_active_for_routing,
  p.lead_locations,
  uip.industry_id,
  i.name as industry_name,
  normalize_branch_name(i.name) as normalized,
  ls.branch as segment_branch,
  CASE 
    WHEN normalize_branch_name(i.name) = LOWER(ls.branch) THEN '✅ MATCH'
    ELSE '❌ NO MATCH'
  END as match,
  s.leads_per_month
FROM profiles p
CROSS JOIN lead_segments ls
LEFT JOIN user_industry_preferences uip ON uip.user_id = p.id AND uip.is_enabled = true
LEFT JOIN industries i ON i.id = uip.industry_id
LEFT JOIN subscriptions s ON s.user_id = p.id AND s.status = 'active' AND s.is_paused = false
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e';

