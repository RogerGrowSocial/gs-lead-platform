-- =====================================================
-- Maak 12 test leads aan voor 14-11-2025
-- =====================================================
-- Run deze in Supabase SQL Editor
-- =====================================================

-- Haal eerst segment IDs op
DO $$
DECLARE
  segment_schilder UUID := 'f204bcab-a89f-42a0-b499-0a9add824c5e';
  segment_dakdekker UUID := '1d7b5218-1639-422d-b188-8d22e757e851';
  segment_glaszetter UUID := 'af1d6cfb-b648-47db-b729-8e7f7820846e';
BEGIN
  -- Verifieer dat segmenten bestaan
  IF NOT EXISTS (SELECT 1 FROM lead_segments WHERE id = segment_schilder AND is_active = true) THEN
    RAISE EXCEPTION 'Segment schilder_noord_brabant niet gevonden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM lead_segments WHERE id = segment_dakdekker AND is_active = true) THEN
    RAISE EXCEPTION 'Segment dakdekker_noord_brabant niet gevonden';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM lead_segments WHERE id = segment_glaszetter AND is_active = true) THEN
    RAISE EXCEPTION 'Segment glaszetter_noord_brabant niet gevonden';
  END IF;

  -- Maak 12 test leads aan voor 14-11-2025
  -- Verdeel over verschillende tijden en segmenten
  
  INSERT INTO public.leads (
    id,
    name,
    email,
    phone,
    message,
    status,
    priority,
    segment_id,
    source_type,
    routing_mode,
    created_at
  ) VALUES
    -- Schilder leads (4 leads)
    (gen_random_uuid(), 'Jan de Vries', 'jan.devries@example.com', '0612345678', 'Ik zoek een schilder voor mijn huis in Breda', 'new', 'medium', segment_schilder, 'platform', 'ai_segment_routing', '2025-11-14 08:30:00+00'),
    (gen_random_uuid(), 'Maria Jansen', 'maria.jansen@example.com', '0612345679', 'Heeft u tijd voor een offerte?', 'new', 'medium', segment_schilder, 'platform', 'ai_segment_routing', '2025-11-14 10:15:00+00'),
    (gen_random_uuid(), 'Piet Bakker', 'piet.bakker@example.com', '0612345680', 'Interesse in schilderwerk', 'new', 'high', segment_schilder, 'platform', 'ai_segment_routing', '2025-11-14 14:20:00+00'),
    (gen_random_uuid(), 'Anna Smit', 'anna.smit@example.com', '0612345681', 'Graag contact opnemen', 'new', 'medium', segment_schilder, 'platform', 'ai_segment_routing', '2025-11-14 16:45:00+00'),
    
    -- Dakdekker leads (4 leads)
    (gen_random_uuid(), 'Kees van der Berg', 'kees.vanderberg@example.com', '0612345682', 'Dak lekt, heeft u snel tijd?', 'new', 'high', segment_dakdekker, 'platform', 'ai_segment_routing', '2025-11-14 09:00:00+00'),
    (gen_random_uuid(), 'Lisa de Wit', 'lisa.dewit@example.com', '0612345683', 'Offerte nodig voor dakrenovatie', 'new', 'medium', segment_dakdekker, 'platform', 'ai_segment_routing', '2025-11-14 11:30:00+00'),
    (gen_random_uuid(), 'Tom Mulder', 'tom.mulder@example.com', '0612345684', 'Dakgoot moet worden vervangen', 'new', 'medium', segment_dakdekker, 'platform', 'ai_segment_routing', '2025-11-14 13:15:00+00'),
    (gen_random_uuid(), 'Emma van Dijk', 'emma.vandijk@example.com', '0612345685', 'Nieuwe dakpannen nodig', 'new', 'low', segment_dakdekker, 'platform', 'ai_segment_routing', '2025-11-14 15:30:00+00'),
    
    -- Glaszetter leads (4 leads)
    (gen_random_uuid(), 'Mark de Boer', 'mark.deboer@example.com', '0612345686', 'Ruit gebroken, spoed nodig', 'new', 'high', segment_glaszetter, 'platform', 'ai_segment_routing', '2025-11-14 07:45:00+00'),
    (gen_random_uuid(), 'Sophie van Leeuwen', 'sophie.vanleeuwen@example.com', '0612345687', 'Nieuwe ramen laten plaatsen', 'new', 'medium', segment_glaszetter, 'platform', 'ai_segment_routing', '2025-11-14 12:00:00+00'),
    (gen_random_uuid(), 'Lucas Meijer', 'lucas.meijer@example.com', '0612345688', 'Dubbele beglazing offerte', 'new', 'medium', segment_glaszetter, 'platform', 'ai_segment_routing', '2025-11-14 14:45:00+00'),
    (gen_random_uuid(), 'Julia van der Meer', 'julia.vandermeer@example.com', '0612345689', 'Glas vervangen in deur', 'new', 'low', segment_glaszetter, 'platform', 'ai_segment_routing', '2025-11-14 17:00:00+00');

  RAISE NOTICE '✅ 12 test leads aangemaakt voor 14-11-2025';
  RAISE NOTICE '   - 4 schilder leads';
  RAISE NOTICE '   - 4 dakdekker leads';
  RAISE NOTICE '   - 4 glaszetter leads';
END $$;

-- Verifieer de leads
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE segment_id IS NOT NULL) as with_segment,
  COUNT(*) FILTER (WHERE segment_id IS NULL) as without_segment
FROM leads
WHERE DATE(created_at) = '2025-11-14'
GROUP BY DATE(created_at);

