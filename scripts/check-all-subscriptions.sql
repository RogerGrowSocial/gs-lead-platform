-- Check ALL subscriptions for user 465341c4-aea3-41e1-aba9-9c3b5d621602

SELECT 
  'All Subscriptions' as check_type,
  s.id,
  s.user_id,
  s.leads_per_month,
  s.status,
  s.is_paused,
  s.created_at,
  s.updated_at,
  CASE 
    WHEN s.status = 'active' AND s.is_paused = false THEN '✅ ACTIVE'
    ELSE '❌ INACTIVE'
  END as active_status
FROM subscriptions s
WHERE s.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
ORDER BY s.created_at DESC;

-- Check which subscription would be used by the function
-- (most recent active, not paused)
SELECT 
  'Function Would Use' as check_type,
  s.id,
  s.leads_per_month,
  s.status,
  s.is_paused,
  s.created_at
FROM subscriptions s
WHERE s.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND s.status = 'active' 
  AND s.is_paused = false
ORDER BY s.created_at DESC
LIMIT 1;

-- Test what the function would get (simulate the CTE)
SELECT 
  'Function Test' as check_type,
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

-- Update subscription to 60 if needed
-- UNCOMMENT TO FIX:
UPDATE subscriptions 
SET leads_per_month = 60,
    updated_at = NOW()
WHERE user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND status = 'active'
  AND is_paused = false
  AND id = (
    SELECT id FROM subscriptions
    WHERE user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
      AND status = 'active'
      AND is_paused = false
    ORDER BY created_at DESC
    LIMIT 1
  )
RETURNING *;

