-- =====================================================
-- SAMPLE ANALYTICS DATA
-- =====================================================
-- Doel: Maak sample leads aan voor analytics dashboard
-- Voert uit: Sample leads met verschillende statussen, branches, regio's en partners
-- 
-- Gebruik: Kopieer dit script en run het in Supabase SQL Editor
-- =====================================================

-- Eerst: Zorg dat er industries zijn
-- Let op: industries.id is INTEGER (auto-increment), geen UUID
INSERT INTO industries (name, is_active, created_at)
SELECT industry_name, true, NOW()
FROM (VALUES 
  ('Schilder'),
  ('Dakdekker'),
  ('Timmerman'),
  ('Loodgieter'),
  ('Elektricien')
) AS industries(industry_name)
WHERE NOT EXISTS (SELECT 1 FROM industries i WHERE i.name = industries.industry_name);

-- Cleanup: Verwijder oude sample leads VOORDAT we nieuwe aanmaken
-- Schakel alleen user-defined triggers uit (niet system triggers)
DO $$
DECLARE
  trigger_rec RECORD;
  deleted_count INTEGER;
  old_leads_count INTEGER;
BEGIN
  -- Eerst: check hoeveel oude sample leads er zijn
  SELECT COUNT(*) INTO old_leads_count
  FROM leads 
  WHERE source_type = 'platform' 
    AND (email LIKE 'sample%@example.com' OR email LIKE 'auto-partner-%@example.com')
    AND created_at >= CURRENT_DATE - INTERVAL '30 days';
  
  RAISE NOTICE 'Gevonden % oude sample leads om te verwijderen', old_leads_count;
  
  -- Schakel alle user-defined triggers uit (niet system triggers)
  FOR trigger_rec IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'leads'::regclass
      AND NOT tgisinternal  -- Alleen user-defined triggers, geen system triggers
  LOOP
    EXECUTE format('ALTER TABLE leads DISABLE TRIGGER %I', trigger_rec.tgname);
    RAISE NOTICE 'Trigger % uitgeschakeld', trigger_rec.tgname;
  END LOOP;
  
  -- Verwijder eerst de lead_activities voor sample leads
  DELETE FROM lead_activities
  WHERE lead_id IN (
    SELECT id FROM leads 
    WHERE source_type = 'platform' 
      AND (email LIKE 'sample%@example.com' OR email LIKE 'auto-partner-%@example.com')
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
  );
  
  -- Verwijder dan de sample leads zelf (zowel sample leads als auto-partner leads)
  DELETE FROM leads 
  WHERE source_type = 'platform' 
    AND (email LIKE 'sample%@example.com' OR email LIKE 'auto-partner-%@example.com')
    AND created_at >= CURRENT_DATE - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Verwijderd: % oude sample leads', deleted_count;
  
  -- Schakel triggers weer in
  FOR trigger_rec IN 
    SELECT tgname 
    FROM pg_trigger 
    WHERE tgrelid = 'leads'::regclass
      AND NOT tgisinternal
  LOOP
    EXECUTE format('ALTER TABLE leads ENABLE TRIGGER %I', trigger_rec.tgname);
    RAISE NOTICE 'Trigger % weer ingeschakeld', trigger_rec.tgname;
  END LOOP;
END $$;

-- Haal industries op
CREATE TEMP TABLE temp_industries AS
SELECT id, name FROM industries WHERE is_active = true LIMIT 5;

-- Zorg dat er test partners zijn
-- Haal eerst een geldige role_id op (of gebruik NULL als dat is toegestaan)
DO $$
DECLARE
  v_role_id UUID;
BEGIN
  -- Probeer een role_id op te halen
  SELECT id INTO v_role_id FROM roles LIMIT 1;
  
  -- Als er geen role is, gebruik NULL (als de kolom nullable is)
  -- Anders maak een default role aan
  IF v_role_id IS NULL THEN
    -- Maak een default role aan als die niet bestaat
    INSERT INTO roles (id, name, created_at)
    VALUES (gen_random_uuid(), 'partner', NOW())
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_role_id;
    
    -- Als dat ook niet werkt, gebruik NULL
    IF v_role_id IS NULL THEN
      v_role_id := NULL;
    END IF;
  END IF;
  
  -- Insert partners met role_id
  INSERT INTO profiles (id, email, first_name, last_name, company_name, is_active_for_routing, is_admin, role_id, created_at)
  SELECT gen_random_uuid(), p_email, p_first_name, p_last_name, p_company_name, true, false, v_role_id, NOW()
  FROM (VALUES 
    ('partner1@example.com', 'Jan', 'Jansen', 'Jansen Schilders BV'),
    ('partner2@example.com', 'Piet', 'Pietersen', 'Pietersen Dakdekkers'),
    ('partner3@example.com', 'Klaas', 'Klaassen', 'Klaassen Timmerwerk')
  ) AS partners(p_email, p_first_name, p_last_name, p_company_name)
  WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.email = partners.p_email);
END $$;

-- Haal partners op - ZORG DAT ER PARTNERS ZIJN
-- Maak eerst temp table aan
CREATE TEMP TABLE temp_partners (
  id UUID PRIMARY KEY
);

-- Vul temp_partners met bestaande partners
INSERT INTO temp_partners (id)
SELECT id FROM profiles 
WHERE is_active_for_routing = true AND is_admin = false 
LIMIT 10;

-- Als er geen partners zijn, maak ze dan aan
DO $$
DECLARE
  v_role_id UUID;
  v_partner_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_partner_count FROM temp_partners;
  
  IF v_partner_count = 0 THEN
    RAISE NOTICE 'Geen partners gevonden, maak 3 test partners aan...';
    
    -- Haal role_id op
    SELECT id INTO v_role_id FROM roles LIMIT 1;
    
    -- Maak 3 test partners aan
    INSERT INTO profiles (id, email, first_name, last_name, company_name, is_active_for_routing, is_admin, role_id, created_at)
    SELECT gen_random_uuid(), email, first_name, last_name, company_name, true, false, v_role_id, NOW()
    FROM (VALUES 
      ('test-partner-1@example.com', 'Jan', 'Jansen', 'Jansen Schilders BV'),
      ('test-partner-2@example.com', 'Piet', 'Pietersen', 'Pietersen Dakdekkers'),
      ('test-partner-3@example.com', 'Klaas', 'Klaassen', 'Klaassen Timmerwerk')
    ) AS new_partners(email, first_name, last_name, company_name)
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.email = new_partners.email);
    
    -- Vul temp_partners met de nieuwe partners
    INSERT INTO temp_partners (id)
    SELECT id FROM profiles 
    WHERE email IN ('test-partner-1@example.com', 'test-partner-2@example.com', 'test-partner-3@example.com')
      AND is_active_for_routing = true;
    
    RAISE NOTICE 'Test partners aangemaakt en toegevoegd aan temp_partners';
  ELSE
    RAISE NOTICE 'Gevonden % bestaande partners', v_partner_count;
  END IF;
END $$;

-- Haal segment op (of maak er een)
DO $$
DECLARE
  v_segment_id UUID;
  v_industry_id INTEGER;  -- industries.id is INTEGER, niet UUID
  v_user_id UUID;
  v_date DATE;
  v_status TEXT;
  v_province TEXT;
  v_industry_name TEXT;
  v_partner_id UUID;
  v_role_id UUID;  -- Voor partner creation, in main scope
  v_new_partner_id UUID;  -- Voor partner creation, in main scope
  i INTEGER;
  industry_rec RECORD;
  partner_count INTEGER;
BEGIN
  -- Controleer of er partners zijn in temp_partners
  SELECT COUNT(*) INTO partner_count FROM temp_partners;
  
  -- Als er nog steeds geen partners zijn, STOP dan
  IF partner_count = 0 THEN
    RAISE EXCEPTION 'GEEN PARTNERS BESCHIKBAAR! Kan geen leads aanmaken zonder partners.';
  END IF;
  
  RAISE NOTICE 'Start met % partners beschikbaar in temp_partners', partner_count;
  
  -- Haal eerste segment op
  SELECT id INTO v_segment_id
  FROM lead_segments
  WHERE is_active = true
  LIMIT 1;
  
  -- Maak 100 sample leads aan voor de laatste 30 dagen
  FOR i IN 1..100 LOOP
    -- Random datum in laatste 30 dagen
    v_date := CURRENT_DATE - (RANDOM() * 30)::INTEGER;
    
    -- Random status (50% new, 40% accepted, 10% rejected)
    -- Meer accepted leads zodat we meer partners zien
    DECLARE
      v_random NUMERIC := RANDOM();
    BEGIN
      IF v_random < 0.5 THEN
        v_status := 'new';
      ELSIF v_random < 0.9 THEN
        v_status := 'accepted';
      ELSE
        v_status := 'rejected';
      END IF;
    END;
    
    -- Random industry
    SELECT id, name INTO industry_rec
    FROM temp_industries
    ORDER BY RANDOM()
    LIMIT 1;
    
    v_industry_id := industry_rec.id;
    v_industry_name := industry_rec.name;
    
    -- Random partner (alleen voor accepted leads)
    -- Zorg dat er ALTIJD een partner beschikbaar is
    IF v_status = 'accepted' THEN
      -- Reset v_partner_id elke iteratie
      v_partner_id := NULL;
      
      -- 1) Eerst: probeer uit temp_partners
      SELECT id INTO v_partner_id
      FROM temp_partners
      ORDER BY RANDOM()
      LIMIT 1;
      
      -- 2) Als dat niet werkt, haal dan een bestaande partner op
      IF v_partner_id IS NULL THEN
        SELECT id INTO v_partner_id
        FROM profiles
        WHERE is_active_for_routing = true 
          AND is_admin = false
        ORDER BY RANDOM()
        LIMIT 1;
      END IF;
      
      -- 3) Als er nog steeds geen partner is, maak er dan een aan
      IF v_partner_id IS NULL THEN
        -- Haal role_id op (in main scope, geen nested DECLARE)
        SELECT id INTO v_role_id FROM roles LIMIT 1;
        
        IF v_role_id IS NULL THEN
          RAISE EXCEPTION 'Geen role_id beschikbaar om partner aan te maken voor lead %', i;
        END IF;
        
        -- Maak een nieuwe partner aan
        INSERT INTO profiles (id, email, first_name, last_name, company_name, is_active_for_routing, is_admin, role_id, created_at)
        VALUES (
          gen_random_uuid(), 
          'auto-partner-' || i || '@example.com', 
          'Auto', 
          'Partner ' || i, 
          'Auto Partner ' || i || ' BV', 
          true, 
          false, 
          v_role_id, 
          NOW()
        )
        RETURNING id INTO v_new_partner_id;
        
        -- Zet v_partner_id naar de nieuwe partner
        v_partner_id := v_new_partner_id;
        
        -- Voeg toe aan temp table voor toekomstige leads
        INSERT INTO temp_partners (id) VALUES (v_new_partner_id);
        
        RAISE NOTICE 'Nieuwe partner aangemaakt voor lead %: %', i, v_new_partner_id;
      END IF;
      
      -- 4) Hard guard: dit MOET een waarde hebben voor accepted leads
      IF v_partner_id IS NULL THEN
        RAISE EXCEPTION 'Partner ID is NULL for accepted lead % - dit mag niet gebeuren!', i;
      END IF;
      
      -- Log alleen elke 10e lead om spam te voorkomen
      IF i % 10 = 0 THEN
        RAISE NOTICE 'Lead %: status=%, partner_id=%', i, v_status, v_partner_id;
      END IF;
    ELSE
      -- Voor non-accepted leads: expliciet NULL
      v_partner_id := NULL;
    END IF;
    
    -- Random provincie
    v_province := (ARRAY['Noord-Holland', 'Zuid-Holland', 'Noord-Brabant', 'Utrecht', 'Gelderland', 'Overijssel', 'Friesland', 'Groningen'])[
      (RANDOM() * 8)::INTEGER + 1
    ];
    
    -- Insert lead
    -- CRITICAL CHECK: accepted leads MOETEN een partner hebben
    IF v_status = 'accepted' AND v_partner_id IS NULL THEN
      RAISE EXCEPTION 'FATALE FOUT: Lead % heeft status accepted maar partner_id is NULL! Dit mag nooit gebeuren.', i;
    END IF;
    
    INSERT INTO leads (
      id,
      name,
      email,
      phone,
      message,
      industry_id,
      province,
      status,
      user_id,
      segment_id,
      created_at,
      source_type,
      routing_mode
    ) VALUES (
      gen_random_uuid(),
      'Sample Lead ' || i || ' - ' || v_industry_name,
      'sample' || i || '@example.com',
      '+316' || LPAD((RANDOM() * 9999999)::INTEGER::TEXT, 7, '0'),
      'Sample lead message voor analytics testing - ' || v_industry_name || ' in ' || v_province,
      v_industry_id,
      v_province,
      v_status,
      v_partner_id,  -- Dit MOET een waarde hebben voor accepted leads
      v_segment_id,
      v_date + (RANDOM() * 24)::INTEGER * INTERVAL '1 hour', -- Random tijd op de dag
      'platform',
      'ai_segment_routing'
    );
  END LOOP;
  
  RAISE NOTICE 'Sample analytics data aangemaakt: 100 leads';
  
  -- Verificatie: Check hoeveel accepted leads een partner hebben
  DECLARE
    v_accepted_total INTEGER;
    v_accepted_with_partner INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_accepted_total
    FROM leads
    WHERE source_type = 'platform'
      AND status = 'accepted'
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND email LIKE 'sample%@example.com';
    
    SELECT COUNT(*) INTO v_accepted_with_partner
    FROM leads
    WHERE source_type = 'platform'
      AND status = 'accepted'
      AND user_id IS NOT NULL
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      AND email LIKE 'sample%@example.com';
    
    RAISE NOTICE 'Verificatie: % accepted leads totaal, % met partner', v_accepted_total, v_accepted_with_partner;
    
    IF v_accepted_total > 0 AND v_accepted_with_partner < v_accepted_total THEN
      RAISE WARNING 'WAARSCHUWING: Niet alle accepted leads hebben een partner!';
      RAISE WARNING 'Details: % accepted leads zonder partner', (v_accepted_total - v_accepted_with_partner);
    END IF;
  END;
END $$;

-- Cleanup temp tables
DROP TABLE IF EXISTS temp_industries;
DROP TABLE IF EXISTS temp_partners;

-- Verificatie query's
SELECT 
  COUNT(*) as total_leads,
  COUNT(DISTINCT province) as unique_provinces,
  COUNT(DISTINCT industry_id) as unique_industries,
  COUNT(DISTINCT user_id) as unique_partners,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted_leads,
  COUNT(*) FILTER (WHERE status = 'new') as new_leads,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_leads,
  MIN(created_at) as earliest_lead,
  MAX(created_at) as latest_lead
FROM leads
WHERE source_type = 'platform' 
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- Toon leads per provincie
SELECT 
  province,
  COUNT(*) as leads_count,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted_count
FROM leads
WHERE source_type = 'platform' 
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND province IS NOT NULL
GROUP BY province
ORDER BY leads_count DESC;

-- Toon leads per industry
SELECT 
  i.name as industry_name,
  COUNT(l.id) as leads_count,
  COUNT(l.id) FILTER (WHERE l.status = 'accepted') as accepted_count,
  ROUND(100.0 * COUNT(l.id) FILTER (WHERE l.status = 'accepted') / NULLIF(COUNT(l.id), 0), 1) as conversion_rate
FROM leads l
LEFT JOIN industries i ON l.industry_id = i.id
WHERE l.source_type = 'platform' 
  AND l.created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND l.industry_id IS NOT NULL
GROUP BY i.name
ORDER BY leads_count DESC;

-- Toon top partners (ALLEEN leads MET partner - geen "Geen partner" rij)
SELECT 
  p.company_name,
  COALESCE(p.first_name || ' ' || p.last_name, 'Onbekend') as partner_name,
  COUNT(l.id) as total_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'accepted') as accepted_leads,
  ROUND(
    CASE 
      WHEN COUNT(l.id) FILTER (WHERE l.status = 'accepted') = 0 
        THEN 0
      ELSE
        (COUNT(l.id) FILTER (WHERE l.status = 'accepted')::NUMERIC 
         / COUNT(l.id)::NUMERIC) * 100
    END
  , 1) as conversion_rate
FROM leads l
INNER JOIN profiles p ON l.user_id = p.id  -- 🔥 INNER JOIN: alleen leads MET partner
WHERE l.source_type = 'platform' 
  AND l.created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND l.user_id IS NOT NULL
GROUP BY p.id, p.company_name, p.first_name, p.last_name
ORDER BY total_leads DESC
LIMIT 10;

-- DEBUG: Toon accepted sample leads zonder partner
SELECT 
  'DEBUG: Accepted sample leads zonder partner' as info,
  COUNT(*) as count
FROM leads
WHERE source_type = 'platform' 
  AND email LIKE 'sample%@example.com'
  AND status = 'accepted'
  AND user_id IS NULL
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';

-- DIAGNOSTIEK: Toon leads zonder partner met status breakdown
SELECT 
  'DIAGNOSTIEK: Leads zonder partner' as info,
  COUNT(l.id) as total_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'accepted') as accepted_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'new') as new_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'rejected') as rejected_leads,
  COUNT(l.id) FILTER (WHERE l.email LIKE 'sample%@example.com') as sample_email_leads,
  COUNT(l.id) FILTER (WHERE l.email NOT LIKE 'sample%@example.com') as other_email_leads
FROM leads l
WHERE l.source_type = 'platform' 
  AND l.created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND (l.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = l.user_id));

-- DEBUG: Toon leads zonder partner (apart, niet in top partners lijst)
-- Deze query is alleen voor debugging - de "top partners" query hierboven toont alleen leads MET partner
SELECT 
  'DEBUG: Leads zonder partner (niet in top partners)' as info,
  COUNT(l.id) as total_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'accepted') as accepted_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'new') as new_leads,
  COUNT(l.id) FILTER (WHERE l.status = 'rejected') as rejected_leads,
  ROUND(100.0 * COUNT(l.id) FILTER (WHERE l.status = 'accepted') / NULLIF(COUNT(l.id), 0), 1) as conversion_rate
FROM leads l
WHERE l.source_type = 'platform' 
  AND l.created_at >= CURRENT_DATE - INTERVAL '30 days'
  AND (l.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = l.user_id));

-- OPTIONEEL: Cleanup query om user_id te verwijderen van leads met niet-bestaande users
-- UNCOMMENT DEZE QUERY ALS JE DE OUDE LEADS WILT OPSCHONEN:
/*
UPDATE leads l
SET user_id = NULL
WHERE l.user_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = l.user_id)
  AND l.source_type = 'platform';
*/

