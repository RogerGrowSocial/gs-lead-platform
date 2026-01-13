-- ============================================
-- CHECK SYSTEM_LOGS TABLE STRUCTURE & DATA
-- ============================================

-- 1. Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'system_logs'
ORDER BY ordinal_position;

-- 2. Check if system_logs table exists and get row count
SELECT 
    COUNT(*) as total_logs,
    COUNT(DISTINCT user_id) as unique_users_with_logs,
    MIN(created_at) as oldest_log,
    MAX(created_at) as newest_log
FROM system_logs;

-- 3. Check recent logs for a specific user (replace USER_ID with actual user ID)
-- Example: '347866cb-e5b8-4536-982a-66b153010d0d'
SELECT 
    id,
    title,
    message,
    log_type,
    category,
    user_id,
    admin_id,
    created_at,
    source,
    severity
FROM system_logs
WHERE user_id = '347866cb-e5b8-4536-982a-66b153010d0d'  -- Replace with actual user ID
ORDER BY created_at DESC
LIMIT 20;

-- 4. Check all logs related to payment methods
SELECT 
    id,
    title,
    message,
    log_type,
    category,
    user_id,
    created_at,
    metadata
FROM system_logs
WHERE category = 'billing' 
   OR category = 'payment'
   OR title ILIKE '%payment%'
   OR title ILIKE '%betaal%'
   OR message ILIKE '%payment%'
   OR message ILIKE '%betaal%'
ORDER BY created_at DESC
LIMIT 20;

-- 5. Check all authentication/login logs
SELECT 
    id,
    title,
    message,
    log_type,
    category,
    user_id,
    created_at,
    metadata
FROM system_logs
WHERE category = 'authentication'
   OR title ILIKE '%login%'
   OR title ILIKE '%inlog%'
   OR message ILIKE '%login%'
   OR message ILIKE '%inlog%'
ORDER BY created_at DESC
LIMIT 20;

-- 6. Check logs by category to see what's being logged
SELECT 
    category,
    COUNT(*) as count,
    MAX(created_at) as last_log
FROM system_logs
GROUP BY category
ORDER BY count DESC;

-- 7. Check logs by type
SELECT 
    log_type,
    COUNT(*) as count,
    MAX(created_at) as last_log
FROM system_logs
GROUP BY log_type
ORDER BY count DESC;

-- 8. Check if log_system_activity function exists
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'log_system_activity';

-- 9. Check recent logs for all users (last 50)
SELECT 
    id,
    title,
    message,
    log_type,
    category,
    user_id,
    admin_id,
    created_at,
    source
FROM system_logs
ORDER BY created_at DESC
LIMIT 50;

-- 10. Check if there are any logs with user_id = NULL (should be filtered out)
SELECT 
    COUNT(*) as logs_with_null_user_id
FROM system_logs
WHERE user_id IS NULL;

-- ============================================
-- CHECK LOGIN_HISTORY TABLE
-- ============================================

-- 11. Check login_history table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'login_history'
ORDER BY ordinal_position;

-- 12. Check login history for specific user
SELECT 
    id,
    user_id,
    created_at,
    status,
    login_method,
    device,
    browser,
    os,
    location,
    ip_address
FROM login_history
WHERE user_id = '347866cb-e5b8-4536-982a-66b153010d0d'  -- Replace with actual user ID
ORDER BY created_at DESC
LIMIT 20;

-- 13. Check total login history count
SELECT 
    COUNT(*) as total_logins,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) FILTER (WHERE status = 'success') as successful_logins,
    MAX(created_at) as last_login
FROM login_history;

-- ============================================
-- CHECK ACTIVITIES TABLE (if exists)
-- ============================================

-- 14. Check if activities table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'activities'
) as activities_table_exists;

-- 15. If activities table exists, check structure and data
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'activities'
ORDER BY ordinal_position;

-- 16. Check activities for specific user (if table exists)
SELECT 
    id,
    user_id,
    title,
    description,
    activity_type,
    severity,
    created_at
FROM activities
WHERE user_id = '347866cb-e5b8-4536-982a-66b153010d0d'  -- Replace with actual user ID
ORDER BY created_at DESC
LIMIT 20;

-- ============================================
-- CHECK PAYMENT METHODS TABLE
-- ============================================

-- 17. Check payment_methods for specific user
SELECT 
    id,
    user_id,
    type,
    provider_payment_method_id,
    created_at,
    updated_at
FROM payment_methods
WHERE user_id = '347866cb-e5b8-4536-982a-66b153010d0d'  -- Replace with actual user ID
ORDER BY created_at DESC;

-- 18. Check profiles table for payment_method changes
SELECT 
    id,
    email,
    payment_method,
    has_payment_method,
    updated_at
FROM profiles
WHERE id = '347866cb-e5b8-4536-982a-66b153010d0d';  -- Replace with actual user ID

