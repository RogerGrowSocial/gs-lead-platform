-- =====================================================
-- TICKETS MODULE SCHEMA INSPECTION
-- =====================================================
-- Run these queries in Supabase SQL Editor to inspect
-- existing ticket-related tables before implementation
-- =====================================================

-- 0.1: Columns + types
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable, 
  column_default,
  ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('support_tickets', 'ticket_attachments', 'ticket_comments', 'tickets')
ORDER BY table_name, ordinal_position;

-- 0.2: Foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('support_tickets', 'ticket_attachments', 'ticket_comments', 'tickets')
ORDER BY tc.table_name, kcu.column_name;

-- 0.3: Indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('support_tickets', 'ticket_attachments', 'ticket_comments', 'tickets')
ORDER BY tablename, indexname;

-- 0.4: RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('support_tickets', 'ticket_attachments', 'ticket_comments', 'tickets')
ORDER BY tablename, policyname;

-- 0.5: Check constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('support_tickets', 'ticket_attachments', 'ticket_comments', 'tickets')
ORDER BY tc.table_name, tc.constraint_name;

-- 0.6: Sample rows (LIMIT 5)
SELECT 'support_tickets' AS table_name, COUNT(*) AS row_count FROM support_tickets;
SELECT * FROM support_tickets LIMIT 5;

SELECT 'ticket_comments' AS table_name, COUNT(*) AS row_count FROM ticket_comments;
SELECT * FROM ticket_comments LIMIT 5;

SELECT 'ticket_attachments' AS table_name, COUNT(*) AS row_count FROM ticket_attachments;
SELECT * FROM ticket_attachments LIMIT 5;

SELECT 'tickets' AS table_name, COUNT(*) AS row_count FROM tickets;
SELECT * FROM tickets LIMIT 5;

