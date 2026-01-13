-- Migration: Fix get_segment_capacity to use subscriptions.leads_per_month instead of profiles.max_open_leads
-- 
-- Probleem: Target berekening gebruikt profiles.max_open_leads, maar capaciteit komt uit subscriptions.leads_per_month
-- Oplossing: Update get_segment_capacity functie om subscriptions.leads_per_month te gebruiken

-- Helper function: Convert plural industry name to singular branch name
-- Handles common Dutch plural forms: -s, -ers, -en, etc.
CREATE OR REPLACE FUNCTION public.normalize_branch_name(industry_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := LOWER(TRIM(industry_name));
  
  -- Remove common plural endings
  -- "Schilders" -> "schilder", "Dakdekkers" -> "dakdekker", "Glaszetters" -> "glazetter"
  -- For "-ers" words, remove only the final "s" (not "ers" or "rs")
  -- "schilders" (9) -> "schilder" (8) = remove 1 char ("s")
  -- "glaszetters" (11) -> "glazetter" (10) = remove 1 char ("s")
  IF normalized LIKE '%ers' THEN
    -- Remove last character: "s"
    normalized := SUBSTRING(normalized FROM 1 FOR LENGTH(normalized) - 1);
  ELSIF normalized LIKE '%en' AND normalized NOT LIKE '%gen' THEN
    -- "Loodgieters" -> "loodgieter" (already handled by -ers)
    -- But handle cases like "Timmermannen" -> "timmerman" (but this is rare)
    -- For now, just remove -en if it's not -gen
    normalized := SUBSTRING(normalized FROM 1 FOR LENGTH(normalized) - 2);
  ELSIF normalized LIKE '%s' AND normalized NOT LIKE '%ers' AND normalized NOT LIKE '%ss' THEN
    -- Simple plural: "Schilders" -> "schilder" (but -ers takes precedence)
    -- "Glaszetters" -> "glazetter" (but -ers takes precedence)
    -- Only remove -s if it's not part of -ers or -ss
    normalized := SUBSTRING(normalized FROM 1 FOR LENGTH(normalized) - 1);
  END IF;
  
  RETURN normalized;
END;
$$;

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_segment_capacity(UUID);

-- Recreate function with subscriptions.leads_per_month
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_segment_capacity(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_segment_capacity(UUID) IS 
'Berekent segment capaciteit op basis van subscriptions.leads_per_month (voor actieve subscriptions) of profiles.max_open_leads (fallback)';

-- =====================================================
-- OPTIONEEL: Trigger om targets automatisch te herberekenen
-- =====================================================
-- Deze trigger zorgt ervoor dat targets automatisch worden herberekend
-- wanneer subscriptions.leads_per_month wordt gewijzigd
-- 
-- Let op: Dit kan performance impact hebben bij veel updates
-- Je kunt deze trigger uitschakelen als je liever alleen real-time berekening bij page load hebt

-- Function om targets te herberekenen voor alle segmenten van een user
CREATE OR REPLACE FUNCTION public.recalculate_targets_for_user_segments(
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_segment_ids UUID[];
  v_segment_id UUID;
  v_today DATE;
BEGIN
  -- Get today's date
  v_today := CURRENT_DATE;
  
  -- Find all segments where this user's partners are active
  SELECT ARRAY_AGG(DISTINCT ls.id)
  INTO v_segment_ids
  FROM lead_segments ls
  JOIN profiles p ON (
    p.id = p_user_id
    AND (p.primary_branch = ls.branch OR ls.branch = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[])))
    AND (
      ls.region = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[])) 
      OR ls.region = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[]))
    )
    AND p.is_active_for_routing = true
    AND p.is_admin = false
  )
  WHERE ls.is_active = true;
  
  -- Recalculate targets for each segment (async via NOTIFY, or sync via function call)
  -- For now, we'll just mark plans as needing recalculation by updating updated_at
  -- The real recalculation happens in the application layer
  IF v_segment_ids IS NOT NULL THEN
    UPDATE lead_segment_plans
    SET updated_at = NOW()
    WHERE segment_id = ANY(v_segment_ids)
      AND date = v_today;
  END IF;
END;
$$;

-- Trigger function that calls recalculation
CREATE OR REPLACE FUNCTION public.trigger_recalculate_targets_on_subscription_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger if leads_per_month actually changed
  IF (TG_OP = 'UPDATE' AND OLD.leads_per_month IS DISTINCT FROM NEW.leads_per_month) 
     OR (TG_OP = 'INSERT' AND NEW.status = 'active' AND NEW.is_paused = false) THEN
    
    -- Recalculate targets for this user's segments
    PERFORM public.recalculate_targets_for_user_segments(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on subscriptions table
-- COMMENT OUT IF YOU DON'T WANT AUTOMATIC RECALCULATION
-- Uncomment the lines below to enable automatic target recalculation on subscription changes

-- DROP TRIGGER IF EXISTS trigger_subscription_change_recalculate_targets ON subscriptions;
-- CREATE TRIGGER trigger_subscription_change_recalculate_targets
--   AFTER INSERT OR UPDATE OF leads_per_month, status, is_paused
--   ON subscriptions
--   FOR EACH ROW
--   EXECUTE FUNCTION public.trigger_recalculate_targets_on_subscription_change();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.recalculate_targets_for_user_segments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_recalculate_targets_on_subscription_change() TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.recalculate_targets_for_user_segments(UUID) IS 
'Herberekent targets voor alle segmenten waar een user actief is (wordt aangeroepen via trigger)';

COMMENT ON FUNCTION public.trigger_recalculate_targets_on_subscription_change() IS 
'Trigger function die targets herberekent bij wijziging van subscriptions.leads_per_month (optioneel, trigger is uitgeschakeld)';

