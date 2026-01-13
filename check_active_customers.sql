-- Check hoeveel actieve klanten we hebben
-- Status: 'active'

SELECT 
  COUNT(*) as total_active_customers
FROM public.customers
WHERE status = 'active';

-- Meer gedetailleerde breakdown per status
SELECT 
  status,
  COUNT(*) as count
FROM public.customers
GROUP BY status
ORDER BY count DESC;

-- Actieve klanten met details
SELECT 
  id,
  name,
  company_name,
  email,
  status,
  priority,
  created_at,
  updated_at
FROM public.customers
WHERE status = 'active'
ORDER BY name;
