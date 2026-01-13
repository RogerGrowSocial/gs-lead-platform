-- Quick check: What columns exist in ticket_comments?
SELECT 
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ticket_comments'
ORDER BY ordinal_position;

