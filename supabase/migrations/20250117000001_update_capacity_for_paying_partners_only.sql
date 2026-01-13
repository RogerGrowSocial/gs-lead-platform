-- =====================================================
-- Update Capacity Functions: Alleen Betalende Partners
-- =====================================================
-- Migration: 20250117000001_update_capacity_for_paying_partners_only.sql
-- Doel: Alleen partners met actieve betaalmethode tellen mee voor capacity
-- =====================================================

-- =====================================================
-- 1. UPDATE get_segment_capacity() FUNCTION
-- =====================================================
-- Alleen partners met actieve betaalmethode (payment_methods) tellen mee
-- NOTE: capacity-based segment sync — we only count partners with active payment methods.
-- This ensures segments are only created/kept for paying partners.

DROP FUNCTION IF EXISTS public.get_segment_capacity(UUID);

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
    -- =====================================================
    -- HARDE BUSINESS REGEL: Alleen betalende partners tellen mee
    -- =====================================================
    -- Een partner moet een actieve betaalmethode hebben om mee te tellen
    -- voor capacity en segment-aanmaak. Dit is een harde business regel.
    -- Zie: docs/ARCHITECTURE.md voor details
    -- =====================================================
    AND EXISTS (
      SELECT 1
      FROM payment_methods pm
      WHERE pm.user_id = p.id
        AND pm.status = 'active'
    )
    -- Capacity check: moet limiet > 0 hebben
    AND (
      EXISTS (
        SELECT 1
        FROM partner_subscriptions ps2
        WHERE ps2.user_id = p.id
          AND ps2.leads_per_month > 0
      )
      OR p.max_open_leads > 0
    )
  )
  LEFT JOIN partner_subscriptions ps ON ps.user_id = p.id
  LEFT JOIN partner_performance_stats pps ON pps.partner_id = p.id
  WHERE ls.id = p_segment_id
    AND ls.is_active = true;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_segment_capacity(UUID) TO authenticated;

-- Update comment
COMMENT ON FUNCTION public.get_segment_capacity(UUID) IS 
'Berekent segment capaciteit op basis van subscriptions.leads_per_month (voor actieve subscriptions) of profiles.max_open_leads (fallback). Alleen partners met actieve betaalmethode (payment_methods.status = active) tellen mee.';

-- =====================================================
-- 2. UPDATE get_branch_region_capacity_combos() FUNCTION
-- =====================================================
-- Alleen combinaties met betalende partners

DROP FUNCTION IF EXISTS public.get_branch_region_capacity_combos();

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
  -- CRITICAL: Alleen partners met actieve betaalmethode
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
      -- Alleen betalende partners
      AND EXISTS (
        SELECT 1
        FROM payment_methods pm
        WHERE pm.user_id = p.id
          AND pm.status = 'active'
      )
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
      -- Alleen betalende partners
      AND EXISTS (
        SELECT 1
        FROM payment_methods pm
        WHERE pm.user_id = p.id
          AND pm.status = 'active'
      )
    
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
      -- Alleen betalende partners
      AND EXISTS (
        SELECT 1
        FROM payment_methods pm
        WHERE pm.user_id = p.id
          AND pm.status = 'active'
      )
  ),
  -- Get all regions per partner
  -- CRITICAL: Alleen partners met actieve betaalmethode
  partner_regions AS (
    SELECT DISTINCT
      p.id AS partner_id,
      LOWER(unnest(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[]))) AS region
    FROM profiles p
    WHERE p.is_active_for_routing = true
      AND p.is_admin = false
      AND p.regions IS NOT NULL
      AND array_length(p.regions::TEXT[], 1) > 0
      -- Alleen betalende partners
      AND EXISTS (
        SELECT 1
        FROM payment_methods pm
        WHERE pm.user_id = p.id
          AND pm.status = 'active'
      )
    
    UNION
    
    SELECT DISTINCT
      p.id AS partner_id,
      LOWER(unnest(p.lead_locations)) AS region
    FROM profiles p
    WHERE p.is_active_for_routing = true
      AND p.is_admin = false
      AND p.lead_locations IS NOT NULL
      AND array_length(p.lead_locations, 1) > 0
      -- Alleen betalende partners
      AND EXISTS (
        SELECT 1
        FROM payment_methods pm
        WHERE pm.user_id = p.id
          AND pm.status = 'active'
      )
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
  -- CRITICAL: Alleen partners met capacity > 0 EN actieve betaalmethode
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
      -- Double-check: alleen betalende partners (al gefilterd in CTEs, maar extra veiligheid)
      AND EXISTS (
        SELECT 1
        FROM payment_methods pm
        WHERE pm.user_id = p.id
          AND pm.status = 'active'
      )
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

-- Update comment
COMMENT ON FUNCTION public.get_branch_region_capacity_combos() IS 
'Returns all (branch, region) combinations where there are active partners with capacity > 0 AND active payment methods. Used for capacity-based segment sync. Only paying partners are included.';

-- =====================================================
-- 3. ADD INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for payment_methods lookups (user_id + status)
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_status 
  ON public.payment_methods (user_id, status)
  WHERE status = 'active';

-- Composite index for lead_segments (is_active + branch + region)
CREATE INDEX IF NOT EXISTS idx_lead_segments_active_branch_region 
  ON public.lead_segments (is_active, branch, region)
  WHERE is_active = true;

-- =====================================================
-- 4. VERIFY NO DELETE OPERATIONS ON SEGMENTS
-- =====================================================
-- Check if there are any DELETE policies or triggers that remove segments
-- (We want to ensure segments are never deleted, only deactivated)

-- Note: If there are DELETE policies, they should be removed or modified
-- to prevent physical deletion. We only want soft deletes via is_active = false.

