-- Debug queries to check employee filtering
-- Run these in your SQL editor to understand the issue

-- 1. Check all profiles with their employee_status and is_admin
SELECT 
  id,
  email,
  first_name,
  last_name,
  employee_status,
  is_admin,
  role_id,
  created_at
FROM profiles
ORDER BY created_at DESC;

-- 2. Check which profiles have employee_status set (should be employees)
SELECT 
  id,
  email,
  first_name,
  last_name,
  employee_status,
  is_admin
FROM profiles
WHERE employee_status IS NOT NULL
ORDER BY employee_status, email;

-- 3. Check which profiles are admins
SELECT 
  id,
  email,
  first_name,
  last_name,
  employee_status,
  is_admin
FROM profiles
WHERE is_admin = true
ORDER BY email;

-- 4. Check profiles that should be shown as employees (employee_status active/paused OR is_admin)
SELECT 
  id,
  email,
  first_name,
  last_name,
  employee_status,
  is_admin,
  CASE 
    WHEN is_admin = true THEN 'Admin'
    WHEN employee_status = 'active' THEN 'Active Employee'
    WHEN employee_status = 'paused' THEN 'Paused Employee'
    WHEN employee_status = 'inactive' THEN 'Inactive Employee'
    ELSE 'Not an Employee'
  END as employee_type
FROM profiles
WHERE 
  is_admin = true 
  OR employee_status = 'active' 
  OR employee_status = 'paused'
ORDER BY employee_type, email;

-- 5. Check profiles that should NOT be shown (customers, etc.)
SELECT 
  id,
  email,
  first_name,
  last_name,
  employee_status,
  is_admin,
  role_id
FROM profiles
WHERE 
  (is_admin IS NULL OR is_admin = false)
  AND (employee_status IS NULL OR employee_status = 'inactive')
ORDER BY email;

-- 6. Count by employee_status
SELECT 
  employee_status,
  COUNT(*) as count
FROM profiles
GROUP BY employee_status
ORDER BY employee_status;

-- 7. Check specific users from the dropdown that shouldn't be there
-- Replace these IDs with actual IDs from your dropdown
SELECT 
  id,
  email,
  first_name,
  last_name,
  employee_status,
  is_admin,
  role_id
FROM profiles
WHERE id IN (
  '13c57b33-4ce9-49f8-8c8d-2c23ab43bd6c', -- barrie batsbak
  '9223d4b9-9aa3-48ba-9f08-8f12f7038ed4', -- Jan Jansen
  '97837dbd-ec38-43e4-8be4-70c949c9c656', -- schoenmakersrogier@gmail.com
  '03fc3ee2-4397-420c-8092-036c8aaee00f'  -- test72@growsocialmedia.nl
)
ORDER BY email;

-- 8. Check roles to see if there's a pattern
SELECT 
  r.id,
  r.name,
  r.display_name,
  COUNT(p.id) as profile_count
FROM roles r
LEFT JOIN profiles p ON p.role_id = r.id
GROUP BY r.id, r.name, r.display_name
ORDER BY profile_count DESC;

