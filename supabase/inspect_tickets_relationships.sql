-- =====================================================
-- INSPECT TICKETS TABLE RELATIONSHIPS
-- =====================================================
-- Run these to understand the current database state
-- =====================================================

-- 1. Check tickets table columns (especially assignee/assigned columns)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets'
  AND column_name IN ('assignee_id', 'assigned_to', 'created_by', 'customer_id')
ORDER BY column_name;

-- 2. Check all foreign key constraints on tickets table
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
  AND tc.table_name = 'tickets'
ORDER BY kcu.column_name;

-- 3. Check if assigned_to column exists (old column name)
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets'
  AND column_name = 'assigned_to';

-- 4. Check if assignee_id column exists (new column name)
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets'
  AND column_name = 'assignee_id';

-- 5. List all foreign key constraint names on tickets
SELECT
  constraint_name,
  table_name,
  column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public'
  AND table_name = 'tickets'
  AND constraint_name IN (
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public'
    AND table_name = 'tickets'
  );

-- 6. Quick check: What columns exist in tickets table?
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tickets'
ORDER BY ordinal_position;

