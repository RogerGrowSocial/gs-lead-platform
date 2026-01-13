-- Find the JOIN problem: Why is subscription not found?

-- 1. Test CTE separately
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
  'CTE Test' as check_type,
  ps.user_id,
  ps.leads_per_month
FROM partner_subscriptions ps
WHERE ps.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 2. Test profile match
SELECT 
  'Profile Match' as check_type,
  p.id,
  p.company_name,
  p.is_active_for_routing,
  p.lead_locations,
  CASE 
    WHEN 'noord-brabant' = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
         OR 'noord-brabant' = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[])) THEN '✅ REGION MATCH'
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
          LOWER(i.name) = 'schilder'
          OR normalize_branch_name(i.name) = 'schilder'
        )
    ) THEN '✅ BRANCH MATCH'
    ELSE '❌ NO BRANCH MATCH'
  END as branch_match
FROM profiles p
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 3. Test the JOIN step by step
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
  'Step 1: Profile' as step,
  p.id,
  p.company_name
FROM lead_segments ls
JOIN profiles p ON (
  p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND p.is_active_for_routing = true
  AND p.is_admin = false
  AND (
    'noord-brabant' = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
    OR 'noord-brabant' = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[]))
  )
  AND (
    EXISTS (
      SELECT 1
      FROM user_industry_preferences uip
      JOIN industries i ON i.id = uip.industry_id
      WHERE uip.user_id = p.id
        AND uip.is_enabled = true
        AND (
          LOWER(i.name) = 'schilder'
          OR normalize_branch_name(i.name) = 'schilder'
        )
    )
  )
)
WHERE ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e'
  AND ls.is_active = true;

-- 4. Test JOIN with subscription
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
  'Step 2: With Subscription' as step,
  p.id,
  ps.user_id as subscription_user_id,
  ps.leads_per_month as subscription_value,
  p.max_open_leads as profile_fallback,
  COALESCE(ps.leads_per_month, p.max_open_leads, 0) as final_value
FROM lead_segments ls
JOIN profiles p ON (
  p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND p.is_active_for_routing = true
  AND p.is_admin = false
  AND (
    'noord-brabant' = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
    OR 'noord-brabant' = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[]))
  )
  AND (
    EXISTS (
      SELECT 1
      FROM user_industry_preferences uip
      JOIN industries i ON i.id = uip.industry_id
      WHERE uip.user_id = p.id
        AND uip.is_enabled = true
        AND (
          LOWER(i.name) = 'schilder'
          OR normalize_branch_name(i.name) = 'schilder'
        )
    )
  )
)
LEFT JOIN partner_subscriptions ps ON ps.user_id = p.id
WHERE ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e'
  AND ls.is_active = true;

-- 5. Check if subscription user_id matches profile id
SELECT 
  'ID Match Check' as check_type,
  p.id as profile_id,
  s.user_id as subscription_user_id,
  CASE 
    WHEN p.id = s.user_id THEN '✅ MATCH'
    ELSE '❌ NO MATCH'
  END as id_match,
  s.leads_per_month
FROM profiles p
CROSS JOIN subscriptions s
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND s.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND s.status = 'active'
  AND s.is_paused = false
ORDER BY s.created_at DESC
LIMIT 1;

