-- Test: Waarom wordt subscription niet gevonden in de JOIN?

-- 1. Check subscription direct
SELECT 
  'Subscription' as check_type,
  s.*
FROM subscriptions s
WHERE s.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND s.status = 'active'
  AND s.is_paused = false
ORDER BY s.created_at DESC;

-- 2. Test de CTE die de functie gebruikt
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
  'CTE Result' as check_type,
  ps.*
FROM partner_subscriptions ps
WHERE ps.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 3. Test de volledige JOIN zoals in de functie
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
  'Full Join Test' as check_type,
  p.id,
  p.company_name,
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

-- 4. Check of er meerdere subscriptions zijn die elkaar overschrijven
SELECT 
  'All Subscriptions' as check_type,
  s.id,
  s.user_id,
  s.leads_per_month,
  s.status,
  s.is_paused,
  s.created_at,
  ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY s.created_at DESC) as rn
FROM subscriptions s
WHERE s.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
ORDER BY s.created_at DESC;

