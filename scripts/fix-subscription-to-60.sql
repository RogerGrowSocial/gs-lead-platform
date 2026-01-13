-- Quick fix: Update subscription to 60 for user 465341c4-aea3-41e1-aba9-9c3b5d621602

-- Check current subscription
SELECT 
  'Before' as check_type,
  s.*
FROM subscriptions s
WHERE s.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND s.status = 'active'
  AND s.is_paused = false
ORDER BY s.created_at DESC
LIMIT 1;

-- Update to 60
UPDATE subscriptions 
SET 
  leads_per_month = 60,
  updated_at = NOW()
WHERE user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND status = 'active'
  AND is_paused = false
  AND id = (
    SELECT id 
    FROM subscriptions
    WHERE user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
      AND status = 'active'
      AND is_paused = false
    ORDER BY created_at DESC
    LIMIT 1
  )
RETURNING *;

-- Check after update
SELECT 
  'After' as check_type,
  s.*
FROM subscriptions s
WHERE s.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND s.status = 'active'
  AND s.is_paused = false
ORDER BY s.created_at DESC
LIMIT 1;

-- Test capacity again
SELECT 
  'Capacity After Fix' as check_type,
  cap.*,
  GREATEST(5, FLOOR(cap.capacity_total_leads * 0.8)) as expected_target
FROM get_segment_capacity('f204bcab-a89f-42a0-b499-0a9add824c5e') cap;

-- Force update the plan with new target
WITH capacity_data AS (
  SELECT * FROM get_segment_capacity('f204bcab-a89f-42a0-b499-0a9add824c5e')
),
calculated_target AS (
  SELECT GREATEST(5, FLOOR(capacity_total_leads * 0.8))::INTEGER as target
  FROM capacity_data
),
current_actual AS (
  SELECT COALESCE(SUM(leads_generated), 0)::INTEGER as actual
  FROM lead_generation_stats
  WHERE segment_id = 'f204bcab-a89f-42a0-b499-0a9add824c5e'
    AND date = CURRENT_DATE
)
INSERT INTO lead_segment_plans (
  segment_id,
  date,
  target_leads_per_day,
  lead_gap,
  lead_gap_percentage,
  updated_at
)
SELECT 
  'f204bcab-a89f-42a0-b499-0a9add824c5e'::UUID,
  CURRENT_DATE,
  ct.target,
  ct.target - ca.actual,
  CASE 
    WHEN ct.target > 0 THEN ((ct.target - ca.actual)::NUMERIC / ct.target::NUMERIC) * 100
    ELSE NULL
  END,
  NOW()
FROM calculated_target ct
CROSS JOIN current_actual ca
ON CONFLICT (segment_id, date) 
DO UPDATE SET
  target_leads_per_day = EXCLUDED.target_leads_per_day,
  lead_gap = EXCLUDED.lead_gap,
  lead_gap_percentage = EXCLUDED.lead_gap_percentage,
  updated_at = NOW()
RETURNING *;

-- Final check
SELECT 
  'Final Plan' as check_type,
  lsp.*
FROM lead_segment_plans lsp
WHERE lsp.segment_id = 'f204bcab-a89f-42a0-b499-0a9add824c5e'
  AND lsp.date = CURRENT_DATE;

