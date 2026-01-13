-- Query to check roles in Supabase SQL Editor
-- Run this in your Supabase SQL Editor to verify roles exist

-- 1. Check all roles
SELECT 
  id,
  name,
  description,
  is_system_role,
  created_at,
  updated_at
FROM roles
ORDER BY name ASC;

-- 2. Count roles
SELECT 
  COUNT(*) as total_roles,
  array_agg(name) as role_names
FROM roles;

-- 3. Check roles table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'roles'
ORDER BY ordinal_position;


