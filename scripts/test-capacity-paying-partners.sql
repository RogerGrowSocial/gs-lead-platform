-- =====================================================
-- Test Script: Verifieer Capacity voor Betalende Partners
-- =====================================================
-- Run deze in Supabase SQL Editor om te testen of de nieuwe
-- capacity-logica correct werkt (alleen betalende partners)
-- =====================================================

-- 1. Check alle actieve segmenten
SELECT 
  id,
  code,
  branch,
  region,
  is_active
FROM lead_segments
WHERE is_active = true
ORDER BY branch, region
LIMIT 10;

-- 2. Haal capacity op voor het eerste segment
-- (Vervang de UUID hieronder met een echte segment ID uit stap 1)
WITH first_segment AS (
  SELECT id FROM lead_segments WHERE is_active = true LIMIT 1
)
SELECT 
  fs.id as segment_id,
  ls.code as segment_code,
  cap.*
FROM first_segment fs
CROSS JOIN LATERAL get_segment_capacity(fs.id) cap
JOIN lead_segments ls ON ls.id = fs.id;

-- 3. Check alle capacity combinaties (moet alleen betalende partners tonen)
SELECT 
  branch,
  region,
  capacity_partners,
  capacity_total_leads
FROM get_branch_region_capacity_combos()
ORDER BY branch, region;

-- 4. Verifieer dat partners zonder betaalmethode NIET meetellen
-- Deze query toont partners die actief zijn maar GEEN betaalmethode hebben
SELECT 
  p.id,
  p.email,
  p.is_active_for_routing,
  COUNT(pm.id) as active_payment_methods,
  COALESCE(s.leads_per_month, p.max_open_leads, 0) as capacity
FROM profiles p
LEFT JOIN payment_methods pm ON pm.user_id = p.id AND pm.status = 'active'
LEFT JOIN subscriptions s ON s.user_id = p.id AND s.status = 'active' AND s.is_paused = false
WHERE p.is_active_for_routing = true
  AND p.is_admin = false
  AND COALESCE(s.leads_per_month, p.max_open_leads, 0) > 0
GROUP BY p.id, p.email, p.is_active_for_routing, s.leads_per_month, p.max_open_leads
HAVING COUNT(pm.id) = 0  -- Partners zonder betaalmethode
ORDER BY capacity DESC
LIMIT 10;

-- 5. Verifieer dat partners MET betaalmethode WEL meetellen
-- Deze query toont partners die actief zijn EN een betaalmethode hebben
SELECT 
  p.id,
  p.email,
  p.is_active_for_routing,
  COUNT(pm.id) as active_payment_methods,
  COALESCE(s.leads_per_month, p.max_open_leads, 0) as capacity,
  STRING_AGG(DISTINCT pm.type::TEXT, ', ' ORDER BY pm.type::TEXT) as payment_types
FROM profiles p
INNER JOIN payment_methods pm ON pm.user_id = p.id AND pm.status = 'active'
LEFT JOIN subscriptions s ON s.user_id = p.id AND s.status = 'active' AND s.is_paused = false
WHERE p.is_active_for_routing = true
  AND p.is_admin = false
  AND COALESCE(s.leads_per_month, p.max_open_leads, 0) > 0
GROUP BY p.id, p.email, p.is_active_for_routing, s.leads_per_month, p.max_open_leads
ORDER BY capacity DESC
LIMIT 10;

-- 6. Vergelijk: Totaal aantal partners vs. partners met betaalmethode
SELECT 
  COUNT(DISTINCT p.id) as total_active_partners,
  COUNT(DISTINCT CASE WHEN pm.id IS NOT NULL THEN p.id END) as partners_with_payment_method,
  COUNT(DISTINCT CASE WHEN pm.id IS NULL THEN p.id END) as partners_without_payment_method
FROM profiles p
LEFT JOIN payment_methods pm ON pm.user_id = p.id AND pm.status = 'active'
WHERE p.is_active_for_routing = true
  AND p.is_admin = false
  AND COALESCE(
    (SELECT leads_per_month FROM subscriptions WHERE user_id = p.id AND status = 'active' AND is_paused = false ORDER BY created_at DESC LIMIT 1),
    p.max_open_leads,
    0
  ) > 0;

