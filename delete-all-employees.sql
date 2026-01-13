-- SQL Query om alle werknemers te verwijderen
-- ⚠️ LET OP: Dit verwijdert alle werknemers, niet alleen test gebruikers!
-- Voer dit uit in Supabase SQL Editor

-- ⚠️ LET OP: Dit verwijdert ALLE werknemers en gerelateerde data!
-- Voer eerst de SELECT query uit om te zien wat wordt verwijderd

-- EERST: Check wat er wordt verwijderd (VEILIG - verwijdert niets)
-- Dit toont alleen de specifieke werknemers die verwijderd moeten worden
SELECT 
  p.id,
  p.email,
  p.first_name,
  p.last_name,
  r.name as role_name,
  p.is_admin,
  CASE WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = p.id) THEN 'Auth exists' ELSE 'ORPHANED' END as auth_status
FROM public.profiles p
LEFT JOIN public.roles r ON p.role_id = r.id
WHERE p.email IN (
  'harrie@growsocialmedia.nl',
  'serve@growsocialmedia.nl',
  'partner1@example.com',
  'partner2@example.com',
  'partner3@example.com'
)
ORDER BY p.created_at DESC;

-- ============================================
-- ACTIEVE DELETE QUERIES (voer uit in volgorde)
-- ============================================

-- Stap 1: Verwijder gerelateerde records in profile_completion_status (MOET EERST!)
DELETE FROM public.profile_completion_status
WHERE id IN (
  SELECT p.id
  FROM public.profiles p
  WHERE p.email IN (
    'harrie@growsocialmedia.nl',
    'serve@growsocialmedia.nl',
    'partner1@example.com',
    'partner2@example.com',
    'partner3@example.com'
  )
);

-- Stap 2: Verwijder andere gerelateerde records (VOER ALLE QUERIES UIT!)
-- ⚠️ BELANGRIJK: Voer ALLE queries hieronder uit voordat je naar Stap 3 gaat!
-- Als een tabel niet bestaat, krijg je een error - dat is OK, ga dan door naar de volgende

-- 2.1: lead_activities gebruikt 'created_by' in plaats van 'user_id'
DELETE FROM public.lead_activities
WHERE created_by IN (
  SELECT p.id FROM public.profiles p
  WHERE p.email IN (
    'harrie@growsocialmedia.nl',
    'serve@growsocialmedia.nl',
    'partner1@example.com',
    'partner2@example.com',
    'partner3@example.com'
  )
);

-- 2.2: lead_usage verwijst naar profiles via user_id
DELETE FROM public.lead_usage
WHERE user_id IN (
  SELECT p.id FROM public.profiles p
  WHERE p.email IN (
    'harrie@growsocialmedia.nl',
    'serve@growsocialmedia.nl',
    'partner1@example.com',
    'partner2@example.com',
    'partner3@example.com'
  )
);

-- 2.3: payments verwijst naar profiles via user_id (BELANGRIJK - MOET VOOR profiles!)
DELETE FROM public.payments
WHERE user_id IN (
  SELECT p.id FROM public.profiles p
  WHERE p.email IN (
    'harrie@growsocialmedia.nl',
    'serve@growsocialmedia.nl',
    'partner1@example.com',
    'partner2@example.com',
    'partner3@example.com'
  )
);

-- 2.4: payment_methods verwijst naar profiles via user_id
DELETE FROM public.payment_methods
WHERE user_id IN (
  SELECT p.id FROM public.profiles p
  WHERE p.email IN (
    'harrie@growsocialmedia.nl',
    'serve@growsocialmedia.nl',
    'partner1@example.com',
    'partner2@example.com',
    'partner3@example.com'
  )
);

-- 2.5: leads verwijst naar profiles via user_id
DELETE FROM public.leads
WHERE user_id IN (
  SELECT p.id FROM public.profiles p
  WHERE p.email IN (
    'harrie@growsocialmedia.nl',
    'serve@growsocialmedia.nl',
    'partner1@example.com',
    'partner2@example.com',
    'partner3@example.com'
  )
);

-- 2.6: invoices verwijst naar profiles via user_id
DELETE FROM public.invoices
WHERE user_id IN (
  SELECT p.id FROM public.profiles p
  WHERE p.email IN (
    'harrie@growsocialmedia.nl',
    'serve@growsocialmedia.nl',
    'partner1@example.com',
    'partner2@example.com',
    'partner3@example.com'
  )
);

-- 2.7: settings verwijst naar profiles via user_id
DELETE FROM public.settings
WHERE user_id IN (
  SELECT p.id FROM public.profiles p
  WHERE p.email IN (
    'harrie@growsocialmedia.nl',
    'serve@growsocialmedia.nl',
    'partner1@example.com',
    'partner2@example.com',
    'partner3@example.com'
  )
);

-- 2.8: pdfs verwijst naar profiles via user_id
DELETE FROM public.pdfs
WHERE user_id IN (
  SELECT p.id FROM public.profiles p
  WHERE p.email IN (
    'harrie@growsocialmedia.nl',
    'serve@growsocialmedia.nl',
    'partner1@example.com',
    'partner2@example.com',
    'partner3@example.com'
  )
);

-- Stap 3: Verwijder de profiles zelf
DELETE FROM public.profiles
WHERE email IN (
  'harrie@growsocialmedia.nl',
  'serve@growsocialmedia.nl',
  'partner1@example.com',
  'partner2@example.com',
  'partner3@example.com'
);

-- Optie 2: Verwijder ALLE profiles behalve admins (meer agressief)
-- Uncomment onderstaande regel als je ALLES wilt verwijderen behalve admins:
-- DELETE FROM public.profiles WHERE is_admin = false;

-- Optie 3: Verwijder alleen orphaned profiles (waar auth user niet meer bestaat)
-- Dit is veiliger en verwijdert alleen profiles waar de auth user al is verwijderd:
-- DELETE FROM public.profiles WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id = profiles.id);

-- Check hoeveel records worden verwijderd voordat je de DELETE uitvoert:
SELECT 
  COUNT(*) as total_to_delete,
  COUNT(CASE WHEN r.name IS NOT NULL AND LOWER(r.name) NOT IN ('consumer', 'customer') THEN 1 END) as employees_with_role,
  COUNT(CASE WHEN p.role_id IS NULL AND p.is_admin = false THEN 1 END) as employees_without_role,
  COUNT(CASE WHEN NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p.id) THEN 1 END) as orphaned_profiles
FROM public.profiles p
LEFT JOIN public.roles r ON p.role_id = r.id
WHERE 
  (r.name IS NOT NULL AND LOWER(r.name) NOT IN ('consumer', 'customer'))
  OR (p.role_id IS NULL AND p.is_admin = false)
  OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p.id);

