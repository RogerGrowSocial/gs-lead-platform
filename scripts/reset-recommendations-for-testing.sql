-- =====================================================
-- RESET RECOMMENDATIONS FOR TESTING
-- =====================================================
-- This script resets the database so recommendations will appear again
-- Use this when testing campaign creation
-- =====================================================

-- STEP 1: Check current state (optional - just to see what we're resetting)
SELECT 
  'Current Recommendations' as check_type,
  status,
  action_type,
  COUNT(*) as count
FROM public.ai_marketing_recommendations
GROUP BY status, action_type
ORDER BY status, action_type;

SELECT 
  'Segments with Campaigns' as check_type,
  COUNT(*) as count
FROM public.lead_segments
WHERE google_ads_campaign_id IS NOT NULL;

-- =====================================================
-- STEP 2: Delete ALL recommendations (clean slate)
-- =====================================================
-- This removes all recommendations so new ones can be generated
DELETE FROM public.ai_marketing_recommendations;

-- =====================================================
-- STEP 3: Clear campaign IDs from segments
-- =====================================================
-- This makes the system think no campaigns exist for these segments
UPDATE public.lead_segments
SET google_ads_campaign_id = NULL
WHERE google_ads_campaign_id IS NOT NULL;

-- =====================================================
-- STEP 4: (Optional) Delete campaign records
-- =====================================================
-- If you want to also remove campaign tracking records
-- Uncomment the following line:
-- DELETE FROM public.partner_marketing_campaigns WHERE channel = 'google_ads';

-- =====================================================
-- STEP 5: Verify reset
-- =====================================================
SELECT 
  'After Reset - Recommendations' as check_type,
  COUNT(*) as count
FROM public.ai_marketing_recommendations;

SELECT 
  'After Reset - Segments with Campaigns' as check_type,
  COUNT(*) as count
FROM public.lead_segments
WHERE google_ads_campaign_id IS NOT NULL;

-- =====================================================
-- DONE! 
-- =====================================================
-- Now when you trigger recommendation generation, 
-- new recommendations should appear for segments without campaigns.
-- =====================================================
