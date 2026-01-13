-- ============================================
-- SQL Command voor Flickering Bug toevoegen
-- Onboarding Tour Page Navigation Flickering
-- ============================================
-- Run deze SQL in je Supabase SQL Editor

-- BUG: Flickering bij Page Navigation in Onboarding Tour
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
  'Flickering bij Page Navigation in Onboarding Tour',
  'Bij navigatie tussen verschillende pagina''s tijdens de onboarding tour (bijvoorbeeld van `/dashboard?tour=true&step=2` naar `/dashboard/leads?tour=true&step=3`) treedt er een zichtbare flickering op waarbij de overlay (dimming layer) kort verdwijnt en weer verschijnt.

**Technische Details:**
- Bij een volledige page reload wordt alle JavaScript state gewist
- CSS `tour-pre-dim` overlay verschijnt direct bij page load
- JavaScript verwijdert deze overlay voordat de highlight klaar is
- Er ontstaat een gap tussen het verwijderen van de CSS overlay en het zichtbaar maken van de JavaScript highlight
- De huidige `isInitialRender` flag implementatie werkt niet correct omdat de state verloren gaat bij page reload

**Visuele Manifestatie:**
1. Donker scherm (pre-dim CSS overlay verschijnt)
2. Korte flash van licht (overlay wordt verwijderd voordat highlight klaar is)
3. Fade-in van highlight (JavaScript highlight verschijnt met transition)

Dit wordt waargenomen als een "flickering" of "flashing" effect.

**Root Causes:**
1. State loss bij page reload - `this.state.isActive` is altijd `false` in nieuwe context
2. Race condition tussen CSS en JavaScript overlays
3. Timing issues tussen overlay removal en highlight visibility
4. Onjuiste detectie van page navigation

**Impact:**
- Slechte gebruikerservaring
- Onprofessionele indruk
- Mogelijk verwarring voor nieuwe gebruikers',
  'high' AS priority,
  'open' AS status,
  'Onboarding Tour' AS area,
  '/dashboard?tour=true&step=2' AS url,
  'Development Team' AS reporter,
  ARRAY['onboarding', 'tour', 'flickering', 'overlay', 'page-navigation', 'ui-bug'] AS tags,
  '**Huidige Implementatie:**
- `isInitialRender` flag toegevoegd aan state
- Pre-overlay wordt verwijderd in `requestAnimationFrame` na spotlight visibility
- Transition wordt tijdelijk uitgeschakeld bij eerste render

**Probleem:**
De implementatie werkt nog niet volledig omdat:
- Bij page reload gaat alle state verloren
- De flag wordt wel gezet maar de timing van overlay removal is nog niet perfect
- Mogelijk conflict tussen CSS animatie en JavaScript transition

**Mogelijke Oplossingsrichtingen:**
1. State persistence via sessionStorage/localStorage
2. Unified overlay systeem (alleen CSS of alleen JavaScript)
3. Pre-render highlight element voordat CSS overlay wordt verwijderd
4. Instant highlight zonder transition bij page navigation
5. Navigation detection via URL parameters in plaats van state' AS notes
FROM next_bug_number
ON CONFLICT (bug_id) DO NOTHING;

-- Verificatie: Check of de bug is toegevoegd
SELECT 'BUG toegevoegd:' AS type, bug_id, title, status, priority FROM bugs WHERE tags @> ARRAY['flickering'] ORDER BY created_at DESC LIMIT 1;

