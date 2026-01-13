-- =====================================================
-- CHECK LEADS COUNT
-- =====================================================
-- Doel: Snel checken hoeveel leads er in de database zijn
-- =====================================================

-- Totaal aantal leads
SELECT 
  'Totaal leads' as info,
  COUNT(*) as count
FROM leads;

-- Leads in laatste 30 dagen
SELECT 
  'Leads laatste 30 dagen' as info,
  COUNT(*) as count
FROM leads
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Leads per status
SELECT 
  status,
  COUNT(*) as count
FROM leads
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY status
ORDER BY count DESC;

-- Sample leads (van create-sample-analytics-data.sql script)
SELECT 
  'Sample leads (laatste 30 dagen)' as info,
  COUNT(*) as count
FROM leads
WHERE source_type = 'platform' 
  AND (email LIKE 'sample%@example.com' OR email LIKE 'auto-partner-%@example.com')
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Recente leads (laatste 10)
SELECT 
  id,
  name,
  email,
  status,
  created_at,
  user_id,
  industry_id
FROM leads
ORDER BY created_at DESC
LIMIT 10;

