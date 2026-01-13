-- Exact simulation of the function logic

-- This is EXACTLY what the function does
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
WHERE ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e'
  AND ls.is_active = true;

-- Debug: Show individual values before SUM
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
  'Debug Values' as check_type,
  p.id,
  p.company_name,
  ps.user_id as subscription_user_id,
  ps.leads_per_month as subscription_value,
  p.max_open_leads as profile_fallback,
  COALESCE(ps.leads_per_month, p.max_open_leads, 0) as individual_capacity_value
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
LEFT JOIN partner_performance_stats pps ON pps.partner_id = p.id
WHERE ls.id = 'f204bcab-a89f-42a0-b499-0a9add824c5e'
  AND ls.is_active = true;

