-- Debug: Waarom geeft get_segment_capacity nog steeds 4 terug?

-- 1. Check subscription direct
SELECT 
  'Subscription Check' as check_type,
  s.id,
  s.user_id,
  s.leads_per_month,
  s.status,
  s.is_paused,
  s.created_at,
  s.updated_at
FROM subscriptions s
WHERE s.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND s.status = 'active'
  AND s.is_paused = false
ORDER BY s.created_at DESC;

-- 2. Check wat de CTE in de functie zou krijgen
SELECT 
  'CTE Test' as check_type,
  user_id,
  leads_per_month,
  created_at
FROM (
  SELECT DISTINCT ON (user_id)
    user_id,
    leads_per_month,
    created_at
  FROM subscriptions
  WHERE user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
    AND status = 'active' 
    AND is_paused = false
  ORDER BY user_id, created_at DESC
) sub;

-- 3. Check profile max_open_leads (fallback)
SELECT 
  'Profile Fallback' as check_type,
  p.id,
  p.company_name,
  p.max_open_leads
FROM profiles p
WHERE p.id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 4. Test capaciteit functie direct
SELECT 
  'Capacity Function' as check_type,
  cap.*,
  GREATEST(5, FLOOR(cap.capacity_total_leads * 0.8)) as calculated_target
FROM get_segment_capacity('f204bcab-a89f-42a0-b499-0a9add824c5e') cap;

-- 5. Manual test: Check of user wordt gevonden in de query
SELECT 
  'Manual Query Test' as check_type,
  p.id,
  p.company_name,
  ps.leads_per_month as subscription_value,
  p.max_open_leads as profile_fallback,
  COALESCE(ps.leads_per_month, p.max_open_leads, 0) as final_capacity_value
FROM lead_segments ls
JOIN profiles p ON (
  p.is_active_for_routing = true
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
LEFT JOIN (
  SELECT DISTINCT ON (user_id)
    user_id,
    leads_per_month
  FROM subscriptions
  WHERE status = 'active' 
    AND is_paused = false
  ORDER BY user_id, created_at DESC
) ps ON ps.user_id = p.id
WHERE ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e'
  AND ls.is_active = true;

