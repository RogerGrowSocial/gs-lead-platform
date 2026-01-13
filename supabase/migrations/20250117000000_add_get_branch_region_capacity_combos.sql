-- Migration: Add function to get all (branch, region) combinations with capacity > 0
-- 
-- This function returns all unique (branch, region) combinations where there are
-- active partners with capacity (subscriptions.leads_per_month or profiles.max_open_leads > 0).
-- Used for capacity-based segment sync to avoid creating segments without real demand.

CREATE OR REPLACE FUNCTION public.get_branch_region_capacity_combos()
RETURNS TABLE (
  branch TEXT,
  region TEXT,
  capacity_partners BIGINT,
  capacity_total_leads BIGINT
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
  ),
  -- Get all branches per partner (from user_industry_preferences or legacy fields)
  partner_branches AS (
    SELECT DISTINCT
      p.id AS partner_id,
      LOWER(public.normalize_branch_name(i.name)) AS branch
    FROM profiles p
    JOIN user_industry_preferences uip ON uip.user_id = p.id
    JOIN industries i ON i.id = uip.industry_id
    WHERE p.is_active_for_routing = true
      AND p.is_admin = false
      AND uip.is_enabled = true
      AND (
        LOWER(i.name) = LOWER(public.normalize_branch_name(i.name))
        OR public.normalize_branch_name(i.name) IS NOT NULL
      )
    
    UNION
    
    -- Legacy: primary_branch
    SELECT DISTINCT
      p.id AS partner_id,
      LOWER(p.primary_branch) AS branch
    FROM profiles p
    WHERE p.is_active_for_routing = true
      AND p.is_admin = false
      AND p.primary_branch IS NOT NULL
      AND p.primary_branch != ''
    
    UNION
    
    -- Legacy: lead_industries array
    SELECT DISTINCT
      p.id AS partner_id,
      LOWER(unnest(p.lead_industries)) AS branch
    FROM profiles p
    WHERE p.is_active_for_routing = true
      AND p.is_admin = false
      AND p.lead_industries IS NOT NULL
      AND array_length(p.lead_industries, 1) > 0
  ),
  -- Get all regions per partner
  partner_regions AS (
    SELECT DISTINCT
      p.id AS partner_id,
      LOWER(unnest(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[]))) AS region
    FROM profiles p
    WHERE p.is_active_for_routing = true
      AND p.is_admin = false
      AND p.regions IS NOT NULL
      AND array_length(p.regions::TEXT[], 1) > 0
    
    UNION
    
    SELECT DISTINCT
      p.id AS partner_id,
      LOWER(unnest(p.lead_locations)) AS region
    FROM profiles p
    WHERE p.is_active_for_routing = true
      AND p.is_admin = false
      AND p.lead_locations IS NOT NULL
      AND array_length(p.lead_locations, 1) > 0
  ),
  -- Combine branches and regions per partner
  partner_branch_regions AS (
    SELECT DISTINCT
      pb.partner_id,
      pb.branch,
      pr.region
    FROM partner_branches pb
    JOIN partner_regions pr ON pr.partner_id = pb.partner_id
    WHERE pb.branch IS NOT NULL
      AND pb.branch != ''
      AND pr.region IS NOT NULL
      AND pr.region != ''
  ),
  -- Calculate capacity per (branch, region) combination
  branch_region_capacity AS (
    SELECT
      pbr.branch,
      pbr.region,
      COUNT(DISTINCT p.id) AS capacity_partners,
      SUM(COALESCE(ps.leads_per_month, p.max_open_leads, 0)) AS capacity_total_leads
    FROM partner_branch_regions pbr
    JOIN profiles p ON p.id = pbr.partner_id
    LEFT JOIN partner_subscriptions ps ON ps.user_id = p.id
    WHERE COALESCE(ps.leads_per_month, p.max_open_leads, 0) > 0
    GROUP BY pbr.branch, pbr.region
    HAVING SUM(COALESCE(ps.leads_per_month, p.max_open_leads, 0)) > 0
  )
  SELECT
    brc.branch,
    brc.region,
    brc.capacity_partners,
    brc.capacity_total_leads
  FROM branch_region_capacity brc
  ORDER BY brc.branch, brc.region;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_branch_region_capacity_combos() TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_branch_region_capacity_combos() IS 
'Returns all (branch, region) combinations where there are active partners with capacity > 0. Used for capacity-based segment sync.';

