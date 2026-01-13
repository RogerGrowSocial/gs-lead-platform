-- Force recalculate target for schilder/noord-brabant segment

-- 1. Check current plan
SELECT 
  'Current Plan' as check_type,
  lsp.*
FROM lead_segment_plans lsp
WHERE lsp.segment_id = 'f204bcab-a89f-42a0-b499-0a9add824c5e'
  AND lsp.date = CURRENT_DATE;

-- 2. Check current capacity
SELECT 
  'Current Capacity' as check_type,
  cap.*,
  GREATEST(5, FLOOR(cap.capacity_total_leads * 0.8)) as calculated_target
FROM get_segment_capacity('f204bcab-a89f-42a0-b499-0a9add824c5e') cap;

-- 3. Force update plan with new target
WITH capacity_data AS (
  SELECT * FROM get_segment_capacity('f204bcab-a89f-42a0-b499-0a9add824c5e')
),
calculated_target AS (
  SELECT GREATEST(5, FLOOR(capacity_total_leads * 0.8)) as target
  FROM capacity_data
)
UPDATE lead_segment_plans
SET 
  target_leads_per_day = (SELECT target FROM calculated_target),
  updated_at = NOW()
WHERE segment_id = 'f204bcab-a89f-42a0-b499-0a9add824c5e'
  AND date = CURRENT_DATE
RETURNING *;

-- 4. Check updated plan
SELECT 
  'Updated Plan' as check_type,
  lsp.*
FROM lead_segment_plans lsp
WHERE lsp.segment_id = 'f204bcab-a89f-42a0-b499-0a9add824c5e'
  AND lsp.date = CURRENT_DATE;

