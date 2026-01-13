-- Debug query om te zien welke rollen er zijn en welke display_name ze hebben
SELECT 
  r.id,
  r.name,
  r.display_name,
  COUNT(p.id) as employee_count
FROM public.roles r
LEFT JOIN public.profiles p ON p.role_id = r.id
WHERE r.name NOT IN ('customer', 'consumer', 'klant')
GROUP BY r.id, r.name, r.display_name
ORDER BY r.name;

-- Debug query om te zien welke werknemers welke rollen hebben
SELECT 
  p.id,
  p.email,
  p.first_name,
  p.last_name,
  p.role_id,
  r.name as role_name,
  r.display_name as role_display_name,
  p.is_admin
FROM public.profiles p
LEFT JOIN public.roles r ON p.role_id = r.id
WHERE p.is_admin = true 
   OR (p.role_id IS NOT NULL AND r.name NOT IN ('customer', 'consumer', 'klant'))
   OR (p.role_id IS NULL AND p.is_admin = false)
ORDER BY p.created_at DESC
LIMIT 20;

