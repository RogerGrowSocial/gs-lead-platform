-- Direct fix: Test en fix de capaciteit functie

-- 1. Check subscription (should be 60)
SELECT 
  'Subscription' as check_type,
  s.leads_per_month
FROM subscriptions s
WHERE s.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND s.status = 'active'
  AND s.is_paused = false
ORDER BY s.created_at DESC
LIMIT 1;

-- 2. Test de CTE direct
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
  ps.leads_per_month
FROM partner_subscriptions ps
WHERE ps.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- 3. Test de volledige query zoals in de functie
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
  'Full Query Test' as check_type,
  p.id,
  ps.leads_per_month as subscription_value,
  p.max_open_leads as profile_fallback,
  COALESCE(ps.leads_per_month, p.max_open_leads, 0) as final_capacity
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

-- 4. Test de functie direct
SELECT 
  'Function Result' as check_type,
  cap.*
FROM get_segment_capacity('f204bcab-a89f-42a0-b499-0a9add824c5e') cap;

-- 5. Check of de functie misschien gecached is of oude code heeft
-- Drop en recreate de functie
DROP FUNCTION IF EXISTS public.get_segment_capacity(UUID);

-- Recreate (copy from migration file)
CREATE OR REPLACE FUNCTION public.get_segment_capacity(
  p_segment_id UUID
)
RETURNS TABLE (
  capacity_partners BIGINT,
  capacity_total_leads BIGINT,
  current_open_leads BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH partner_subscriptions AS (
    -- Get most recent active subscription per user
    SELECT DISTINCT ON (user_id)
      user_id,
      leads_per_month
    FROM subscriptions
    WHERE status = 'active' 
      AND is_paused = false
    ORDER BY user_id, created_at DESC
  )
  SELECT 
    COUNT(DISTINCT p.id)::BIGINT AS capacity_partners,
    -- Use subscriptions.leads_per_month for active subscriptions, fallback to profiles.max_open_leads
    COALESCE(
      SUM(
        COALESCE(ps.leads_per_month, p.max_open_leads, 0)
      ), 
      0
    )::BIGINT AS capacity_total_leads,
    COALESCE(SUM(pps.open_leads_count), 0)::BIGINT AS current_open_leads
  FROM lead_segments ls
  JOIN profiles p ON (
    p.is_active_for_routing = true
    AND p.is_admin = false
    AND (
      -- Region match: regions or lead_locations
      ls.region = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
      OR ls.region = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[]))
    )
    AND (
      -- Branch match via user_industry_preferences (NEW - preferred method)
      -- Uses normalize_branch_name to handle plural/singular differences
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
      -- OR legacy: primary_branch or lead_industries (fallback)
      OR p.primary_branch = ls.branch 
      OR ls.branch = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[]))
    )
  )
  LEFT JOIN partner_subscriptions ps ON ps.user_id = p.id
  LEFT JOIN partner_performance_stats pps ON pps.partner_id = p.id
  WHERE ls.id = p_segment_id
    AND ls.is_active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_segment_capacity(UUID) TO authenticated;

-- 6. Test functie opnieuw
SELECT 
  'Function After Recreate' as check_type,
  cap.*,
  GREATEST(5, FLOOR(cap.capacity_total_leads * 0.8)) as expected_target
FROM get_segment_capacity('f204bcab-a89f-42a0-b499-0a9add824c5e') cap;

