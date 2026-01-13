-- Reset risk assessments for all users
-- This clears AI risk assessment data so assessments can be re-run with KVK integration

UPDATE public.profiles
SET 
  ai_risk_score = NULL,
  ai_risk_level = NULL,
  ai_risk_explanation = NULL,
  ai_risk_assessed_at = NULL,
  -- Optionally reset requires_manual_review (uncomment if needed)
  -- requires_manual_review = false,
  updated_at = NOW()
WHERE 
  ai_risk_score IS NOT NULL 
  OR ai_risk_level IS NOT NULL 
  OR ai_risk_assessed_at IS NOT NULL;

-- Show count of reset profiles
SELECT COUNT(*) as reset_count
FROM public.profiles
WHERE ai_risk_score IS NULL 
  AND ai_risk_level IS NULL 
  AND ai_risk_assessed_at IS NULL;
