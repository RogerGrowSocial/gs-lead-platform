-- =====================================================
-- QUICK DELETE AI MARKETING RECOMMENDATIONS
-- =====================================================
-- Gebruik dit om aanbevelingen te verwijderen zodat je opnieuw kunt genereren
-- =====================================================

-- EERST: Check hoeveel aanbevelingen er zijn
SELECT 
  status,
  action_type,
  COUNT(*) as count
FROM public.ai_marketing_recommendations
GROUP BY status, action_type
ORDER BY status, action_type;

-- =====================================================
-- OPTIE 1: Verwijder ALLE pending aanbevelingen (AANBEVOLEN)
-- =====================================================
-- Dit verwijdert alleen aanbevelingen die nog niet zijn goedgekeurd/afgewezen
DELETE FROM public.ai_marketing_recommendations
WHERE status = 'pending';

-- =====================================================
-- OPTIE 2: Verwijder ALLE aanbevelingen (inclusief approved/rejected)
-- =====================================================
-- ⚠️ LET OP: Dit verwijdert alles, inclusief historie!
-- DELETE FROM public.ai_marketing_recommendations;

-- =====================================================
-- OPTIE 3: Verwijder alleen platform aanbevelingen (partner_id IS NULL)
-- =====================================================
-- DELETE FROM public.ai_marketing_recommendations
-- WHERE partner_id IS NULL;

-- =====================================================
-- OPTIE 4: Verwijder alleen campaign aanbevelingen
-- =====================================================
-- DELETE FROM public.ai_marketing_recommendations
-- WHERE action_type = 'create_campaign';

-- =====================================================
-- OPTIE 5: Verwijder alleen landing page aanbevelingen
-- =====================================================
-- DELETE FROM public.ai_marketing_recommendations
-- WHERE action_type = 'create_landing_page';

-- =====================================================
-- OPTIE 6: Verwijder alleen oude aanbevelingen (ouder dan 7 dagen)
-- =====================================================
-- DELETE FROM public.ai_marketing_recommendations
-- WHERE created_at < NOW() - INTERVAL '7 days';

-- =====================================================
-- NA UITVOEREN: Check resultaat
-- =====================================================
SELECT 
  status,
  action_type,
  COUNT(*) as count
FROM public.ai_marketing_recommendations
GROUP BY status, action_type
ORDER BY status, action_type;

