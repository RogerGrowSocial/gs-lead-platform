-- =====================================================
-- INSPECT CURRENT TICKETS MODULE STATE
-- =====================================================
-- Run these queries to see what exists in your database
-- =====================================================

-- 1. Check if tickets table exists and its columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets'
ORDER BY ordinal_position;

-- 2. Check if ticket_comments table exists and its columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ticket_comments'
ORDER BY ordinal_position;

-- 3. Check if ticket_attachments table exists and its columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ticket_attachments'
ORDER BY ordinal_position;

-- 4. Check if ticket_audit_log table exists and its columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ticket_audit_log'
ORDER BY ordinal_position;

-- 5. Check if ticket_watchers table exists and its columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ticket_watchers'
ORDER BY ordinal_position;

-- 6. Check for assigned_to vs assignee_id in tickets
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets'
  AND column_name IN ('assigned_to', 'assignee_id');

-- 7. Check what author columns exist in ticket_comments
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ticket_comments'
  AND column_name LIKE '%author%';

-- 8. List all indexes on ticket_comments
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'ticket_comments';

