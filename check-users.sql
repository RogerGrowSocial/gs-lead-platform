-- Check all users in profiles table
SELECT 
  id,
  email,
  first_name,
  last_name,
  company_name,
  created_at,
  updated_at,
  is_admin,
  status,
  has_payment_method,
  payment_method
FROM profiles
ORDER BY created_at DESC
LIMIT 50;

-- Count total users
SELECT COUNT(*) as total_users FROM profiles;

-- Check for duplicate emails
SELECT email, COUNT(*) as count
FROM profiles
GROUP BY email
HAVING COUNT(*) > 1;

