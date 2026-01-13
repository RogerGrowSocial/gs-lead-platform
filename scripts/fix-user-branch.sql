-- Fix: Zet branch voor user 465341c4-aea3-41e1-aba9-9c3b5d621602
-- 
-- Probleem: primary_branch is NULL en lead_industries is leeg
-- Oplossing: Zet een branch zodat user in segmenten komt

-- Check huidige status
SELECT 
  id,
  company_name,
  primary_branch,
  lead_industries,
  lead_locations
FROM profiles
WHERE id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- Check welke branches beschikbaar zijn
SELECT DISTINCT branch
FROM lead_segments
WHERE is_active = true
ORDER BY branch;

-- FIX: Zet primary_branch (kies een branch die past bij de user)
-- Voorbeeld: schilder, loodgieter, dakdekker, electricien, etc.
-- UNCOMMENT EN PAS AAN:

-- UPDATE profiles 
-- SET primary_branch = 'schilder'  -- PAS DIT AAN NAAR DE JUISTE BRANCH
-- WHERE id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- OF: Zet lead_industries (als user meerdere branches doet)
-- UPDATE profiles 
-- SET lead_industries = ARRAY['schilder', 'dakdekker']  -- PAS DIT AAN
-- WHERE id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- Check resultaat
SELECT 
  id,
  company_name,
  primary_branch,
  lead_industries,
  lead_locations
FROM profiles
WHERE id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

