-- =====================================================
-- SEED DATA FOR SCRAPER CALL SCRIPTS
-- =====================================================
-- This seed file creates initial call scripts for active services
-- =====================================================

-- Insert call scripts for each active service
-- Note: We use service slugs to find services, then insert scripts

INSERT INTO public.scraper_call_scripts (service_id, title, script_text, is_active)
SELECT 
  s.id,
  'Standaard belscript',
  CASE 
    WHEN s.slug = 'website-onderhoud' THEN 
      'Hallo, dit is [jouw naam] van GrowSocial. Ik bel omdat ik zag dat jullie een website hebben. Wij helpen bedrijven met het onderhouden en optimaliseren van hun website. Hebben jullie momenteel iemand die jullie website onderhoudt, of doen jullie dat zelf?'
    
    WHEN s.slug = 'google-ads' THEN 
      'Hallo, dit is [jouw naam] van GrowSocial. Ik bel omdat ik zag dat jullie actief zijn in [branche]. Wij helpen bedrijven met Google Ads campagnes om meer klanten te vinden. Adverteren jullie al online, of zijn jullie op zoek naar nieuwe manieren om klanten te bereiken?'
    
    WHEN s.slug = 'seo' THEN 
      'Hallo, dit is [jouw naam] van GrowSocial. Ik bel omdat ik zag dat jullie een website hebben. Wij helpen bedrijven om beter gevonden te worden in Google zonder te adverteren. Hoe vinden klanten jullie nu meestal?'
    
    WHEN s.slug = 'website-development' THEN 
      'Hallo, dit is [jouw naam] van GrowSocial. Ik bel omdat ik zag dat jullie actief zijn in [branche]. Wij helpen bedrijven met het ontwikkelen van nieuwe websites of het verbeteren van bestaande websites. Hebben jullie plannen om jullie online aanwezigheid te verbeteren?'
    
    WHEN s.slug = 'emailmarketing' THEN 
      'Hallo, dit is [jouw naam] van GrowSocial. Ik bel omdat ik zag dat jullie klanten hebben. Wij helpen bedrijven met e-mailmarketing om klanten te behouden en nieuwe klanten te werven. Doen jullie al iets met e-mailmarketing of nieuwsbrieven?'
    
    WHEN s.slug = 'aanvragen-service' THEN 
      'Hallo, dit is [jouw naam] van GrowSocial. Ik bel omdat ik zag dat jullie actief zijn in [branche]. Wij helpen bedrijven met het genereren van nieuwe aanvragen en leads. Krijgen jullie voldoende nieuwe klanten binnen, of zijn jullie op zoek naar meer aanvragen?'
    
    ELSE 
      'Hallo, dit is [jouw naam] van GrowSocial. Ik bel omdat ik zag dat jullie actief zijn in [branche]. Wij helpen bedrijven met [dienst]. Hebben jullie interesse om te bespreken hoe wij jullie kunnen helpen?'
  END,
  true
FROM public.services s
WHERE s.status = 'active'
ON CONFLICT DO NOTHING;

-- Note: If a service doesn't exist yet, the script won't be inserted (safe)
-- Managers can edit scripts later via the UI

