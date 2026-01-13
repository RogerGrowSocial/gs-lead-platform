-- =====================================================
-- DATABASE INSPECTIE VOOR ANALYTICS
-- =====================================================
-- Doel: Inspecteer database structuur en data om te begrijpen waarom leads geen partners hebben
-- =====================================================

-- 1. Check industries tabel structuur
SELECT 
  'industries' as tabel,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'industries'
ORDER BY ordinal_position;

-- 2. Check profiles tabel structuur (relevante kolommen)
SELECT 
  'profiles' as tabel,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('id', 'email', 'first_name', 'last_name', 'company_name', 'is_active_for_routing', 'is_admin', 'role_id')
ORDER BY ordinal_position;

-- 3. Check leads tabel structuur (relevante kolommen)
SELECT 
  'leads' as tabel,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('id', 'user_id', 'industry_id', 'status', 'province', 'source_type', 'created_at')
ORDER BY ordinal_position;

-- 4. Check hoeveel industries er zijn
SELECT 
  'Industries count' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as active
FROM industries;

-- 5. Check hoeveel partners er zijn
SELECT 
  'Partners count' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active_for_routing = true AND is_admin = false) as active_routing,
  COUNT(*) FILTER (WHERE is_admin = false) as non_admin
FROM profiles;

-- 6. Check roles tabel
SELECT 
  'Roles count' as info,
  COUNT(*) as total,
  array_agg(name) as role_names
FROM roles;

-- 7. Check leads zonder partner (de laatste 30 dagen)
SELECT 
  'Leads zonder partner (30d)' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE user_id IS NULL) as null_user_id,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = leads.user_id)) as invalid_user_id,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted_without_partner
FROM leads
WHERE source_type = 'platform' 
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND (user_id IS NULL OR NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = leads.user_id));

-- 8. Check leads met partner (de laatste 30 dagen)
SELECT 
  'Leads met partner (30d)' as info,
  COUNT(*) as total,
  COUNT(DISTINCT user_id) as unique_partners
FROM leads
WHERE source_type = 'platform' 
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = leads.user_id);

-- 9. Check sample leads die we hebben aangemaakt
SELECT 
  'Sample leads check' as info,
  COUNT(*) as total_sample_leads,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted_sample_leads,
  COUNT(*) FILTER (WHERE status = 'accepted' AND user_id IS NOT NULL) as accepted_with_user_id,
  COUNT(*) FILTER (WHERE status = 'accepted' AND user_id IS NULL) as accepted_without_user_id,
  COUNT(*) FILTER (WHERE email LIKE 'sample%@example.com') as with_sample_email
FROM leads
WHERE source_type = 'platform' 
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- 10. Check welke partners er zijn (met details)
SELECT 
  id,
  email,
  first_name,
  last_name,
  company_name,
  is_active_for_routing,
  is_admin,
  role_id,
  created_at
FROM profiles
WHERE is_active_for_routing = true 
  AND is_admin = false
ORDER BY created_at DESC
LIMIT 10;

-- 11. Check recente leads met details
SELECT 
  l.id,
  l.email,
  l.status,
  l.user_id,
  l.created_at,
  p.email as partner_email,
  p.company_name as partner_company,
  p.first_name as partner_first_name,
  p.last_name as partner_last_name
FROM leads l
LEFT JOIN profiles p ON l.user_id = p.id
WHERE l.source_type = 'platform' 
  AND l.created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY l.created_at DESC
LIMIT 20;

-- 12. Check temp_partners tabel (als die bestaat)
SELECT 
  'temp_partners check' as info,
  COUNT(*) as count
FROM information_schema.tables
WHERE table_name = 'temp_partners';

-- 13. Check segmenten
SELECT 
  'Segments check' as info,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as active
FROM lead_segments;

-- 14. Check of er accepted leads zijn zonder user_id
SELECT 
  'Accepted leads zonder user_id' as info,
  COUNT(*) as count,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM leads
WHERE source_type = 'platform' 
  AND status = 'accepted'
  AND user_id IS NULL
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- 15. Check of er accepted leads zijn met invalid user_id
SELECT 
  'Accepted leads met invalid user_id' as info,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_invalid_user_ids,
  array_agg(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as invalid_user_ids
FROM leads
WHERE source_type = 'platform' 
  AND status = 'accepted'
  AND user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = leads.user_id)
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';

