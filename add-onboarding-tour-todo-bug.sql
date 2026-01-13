-- ============================================
-- SQL Commands voor To-Do en Bug toevoegen
-- Onboarding Tour Loading Screen Issue
-- ============================================
-- Run deze SQL in je Supabase SQL Editor

-- 1. TO-DO: Onboarding Tour Stabilisatie
-- Genereer automatisch het volgende TODO-ID nummer
WITH next_todo_number AS (
  SELECT COALESCE(
    (SELECT MAX(CAST(SUBSTRING(todo_id FROM 6) AS INTEGER)) FROM todos WHERE todo_id ~ '^TODO-[0-9]+$'),
    0
  ) + 1 AS next_num
)
INSERT INTO todos (todo_id, title, description, priority, status, assignee, due_date, tags)
SELECT 
  'TODO-' || LPAD(next_num::TEXT, 3, '0') AS todo_id,
  'Onboarding Tour Stabilisatie en Documentatie',
  'De onboarding tour heeft meerdere stabiliteitsproblemen gehad die nu zijn opgelost. Documenteer de nieuwe tour-engine architectuur en zorg voor robuuste error handling. Belangrijke fixes: 
- Scripts worden nu globaal geladen in dashboard.ejs layout
- Auto-start werkt op alle dashboard routes via ?tour=true&step=X
- Backwards-compatible conversie van ?startTour=true naar ?tour=true&step=0
- Single vs multiple highlights correct geïmplementeerd
- Loading screen wordt correct verborgen zodra spotlight actief is

Te documenteren:
- GSTour engine architectuur
- Step configuratie (single vs multiple highlights)
- Auto-start mechanisme
- Error handling en fallbacks',
  'high' AS priority,
  'in_progress' AS status,
  NULL AS assignee,
  NULL AS due_date,
  ARRAY['onboarding', 'tour', 'documentation', 'stability'] AS tags
FROM next_todo_number
ON CONFLICT (todo_id) DO NOTHING;

-- 2. BUG: Loading Screen Blijft Vast bij startTour Parameter
-- Genereer automatisch het volgende BUG-ID nummer
WITH next_bug_number AS (
  SELECT COALESCE(
    (SELECT MAX(CAST(SUBSTRING(bug_id FROM 5) AS INTEGER)) FROM bugs WHERE bug_id ~ '^BUG-[0-9]+$'),
    0
  ) + 1 AS next_num
)
INSERT INTO bugs (bug_id, title, description, priority, status, area, url, reporter, tags, notes)
SELECT 
  'BUG-' || LPAD(next_num::TEXT, 3, '0') AS bug_id,
  'Loading Screen Blijft Vast bij startTour Parameter',
  'Wanneer gebruikers vanuit het onboarding formulier worden doorgestuurd naar /dashboard?startTour=true, blijft de loading screen vast staan en start de tour niet.

Oorzaak:
- Oude redirect gebruikt ?startTour=true parameter
- Nieuwe tour-logica checkt alleen ?tour=true parameter
- Auto-start code triggert niet bij startTour=true
- Loading screen wordt niet verborgen omdat tour niet start

Impact:
- Gebruikers kunnen niet verder na onboarding
- Slechte eerste indruk
- Mogelijk verlies van nieuwe gebruikers

Fix:
- Redirect aangepast naar /dashboard?tour=true&step=0
- Backwards-compatible conversie toegevoegd (startTour → tour)
- Loading screen wordt nu correct verborgen zodra spotlight actief is',
  'urgent' AS priority,
  'fixed' AS status,
  'Onboarding Tour' AS area,
  '/dashboard?startTour=true' AS url,
  'Development Team' AS reporter,
  ARRAY['onboarding', 'loading-screen', 'redirect', 'tour'] AS tags,
  'Fixed door:
1. Redirects aangepast in onboarding.js en onboarding/index.ejs
2. normalizeStartTourParam() functie toegevoegd aan dashboard.ejs
3. Auto-start code werkt nu op alle dashboard routes
4. Loading screen wordt verborgen in positionHighlightAndTooltip() zodra spotlight actief is' AS notes
FROM next_bug_number
ON CONFLICT (bug_id) DO NOTHING;

-- Verificatie: Check of de records zijn toegevoegd
SELECT 'TODO toegevoegd:' AS type, todo_id, title, status FROM todos WHERE tags @> ARRAY['onboarding'] ORDER BY created_at DESC LIMIT 1;
SELECT 'BUG toegevoegd:' AS type, bug_id, title, status FROM bugs WHERE tags @> ARRAY['onboarding'] ORDER BY created_at DESC LIMIT 1;

