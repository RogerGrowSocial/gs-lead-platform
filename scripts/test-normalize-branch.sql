-- Test: normalize_branch_name functie

-- Test cases
SELECT 
  'Test' as check_type,
  'Schilders' as input,
  normalize_branch_name('Schilders') as output,
  'schilder' as expected,
  CASE 
    WHEN normalize_branch_name('Schilders') = 'schilder' THEN '✅'
    ELSE '❌'
  END as result;

SELECT 
  'Test' as check_type,
  'Dakdekkers' as input,
  normalize_branch_name('Dakdekkers') as output,
  'dakdekker' as expected,
  CASE 
    WHEN normalize_branch_name('Dakdekkers') = 'dakdekker' THEN '✅'
    ELSE '❌'
  END as result;

SELECT 
  'Test' as check_type,
  'Glaszetters' as input,
  normalize_branch_name('Glaszetters') as output,
  'glazetter' as expected,
  CASE 
    WHEN normalize_branch_name('Glaszetters') = 'glazetter' THEN '✅'
    ELSE '❌'
  END as result;

-- Test met echte data
SELECT 
  'Real Data' as check_type,
  i.name as industry_name,
  normalize_branch_name(i.name) as normalized,
  ls.branch as segment_branch,
  CASE 
    WHEN normalize_branch_name(i.name) = LOWER(ls.branch) THEN '✅ MATCH'
    ELSE '❌ NO MATCH'
  END as match_status
FROM user_industry_preferences uip
JOIN industries i ON i.id = uip.industry_id
CROSS JOIN lead_segments ls
WHERE uip.user_id = '465341c4-aea3-41e1-aba9-9c3b5d621602'
  AND uip.is_enabled = true
  AND ls.is_active = true
  AND ls.region = ANY(ARRAY['zuid-holland', 'noord-brabant']::TEXT[])
ORDER BY i.name, ls.branch;

