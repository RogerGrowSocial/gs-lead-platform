-- Quick check: is_active_for_routing status voor user

SELECT 
  id,
  company_name,
  is_active_for_routing,
  primary_branch,
  lead_industries,
  regions,
  lead_locations
FROM profiles
WHERE id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

-- Fix: Zet is_active_for_routing op true als het false is
-- UNCOMMENT DE VOLGENDE REGEL OM TE FIXEN:
-- UPDATE profiles SET is_active_for_routing = true WHERE id = '465341c4-aea3-41e1-aba9-9c3b5d621602';

