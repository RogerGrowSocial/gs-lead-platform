-- =====================================================
-- SQL Queries om AI Aanbevelingen te Verwijderen
-- =====================================================
-- Tabel: ai_marketing_recommendations
-- =====================================================

-- OPTIE 1: Verwijder ALLE aanbevelingen
-- ⚠️ LET OP: Dit verwijdert alles, inclusief approved/rejected!
DELETE FROM public.ai_marketing_recommendations;

-- OPTIE 2: Verwijder alleen PENDING aanbevelingen (aanbevolen)
DELETE FROM public.ai_marketing_recommendations
WHERE status = 'pending';

-- OPTIE 3: Verwijder alleen PLATFORM aanbevelingen (partner_id IS NULL)
DELETE FROM public.ai_marketing_recommendations
WHERE partner_id IS NULL;

-- OPTIE 4: Verwijder alleen PENDING platform aanbevelingen
DELETE FROM public.ai_marketing_recommendations
WHERE partner_id IS NULL 
  AND status = 'pending';

-- OPTIE 5: Verwijder alleen aanbevelingen van een specifiek segment
DELETE FROM public.ai_marketing_recommendations
WHERE segment_id = 'SEGMENT_ID_HIER';  -- Vervang met echte segment_id

-- OPTIE 6: Verwijder alleen aanbevelingen van een specifieke actie type
DELETE FROM public.ai_marketing_recommendations
WHERE action_type = 'create_landing_page';  -- of 'create_campaign', etc.

-- OPTIE 7: Verwijder alleen oude aanbevelingen (bijv. ouder dan 30 dagen)
DELETE FROM public.ai_marketing_recommendations
WHERE created_at < NOW() - INTERVAL '30 days';

-- =====================================================
-- VEILIG: Eerst checken hoeveel records worden verwijderd
-- =====================================================

-- Check hoeveel pending aanbevelingen er zijn
SELECT COUNT(*) as total_pending
FROM public.ai_marketing_recommendations
WHERE status = 'pending';

-- Check hoeveel platform aanbevelingen er zijn
SELECT COUNT(*) as total_platform
FROM public.ai_marketing_recommendations
WHERE partner_id IS NULL;

-- Check overzicht per status
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE partner_id IS NULL) as platform_count,
  COUNT(*) FILTER (WHERE partner_id IS NOT NULL) as partner_count
FROM public.ai_marketing_recommendations
GROUP BY status
ORDER BY status;

-- Check overzicht per action_type
SELECT 
  action_type,
  status,
  COUNT(*) as count
FROM public.ai_marketing_recommendations
GROUP BY action_type, status
ORDER BY action_type, status;

-- =====================================================
-- AANBEVOLEN: Soft delete (status wijzigen i.p.v. verwijderen)
-- =====================================================

-- Markeer als rejected in plaats van verwijderen (behoud historie)
UPDATE public.ai_marketing_recommendations
SET status = 'rejected',
    reviewed_at = NOW()
WHERE status = 'pending'
  AND partner_id IS NULL;

