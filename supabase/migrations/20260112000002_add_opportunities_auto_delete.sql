-- =====================================================
-- AUTO-DELETE OPPORTUNITIES AFTER 7 DAYS
-- =====================================================
-- Opportunities that haven't been updated in 7 days are automatically deleted
-- This prevents database bloat
-- =====================================================

-- Add function to check and delete old opportunities
CREATE OR REPLACE FUNCTION cleanup_old_opportunities()
RETURNS TABLE(deleted_count INTEGER, warning_count INTEGER) AS $$
DECLARE
  deleted_count INTEGER := 0;
  warning_count INTEGER := 0;
  total_opportunities INTEGER;
BEGIN
  -- Count total opportunities
  SELECT COUNT(*) INTO total_opportunities FROM public.opportunities;
  
  -- If more than 1000 opportunities, log warning
  IF total_opportunities > 1000 THEN
    warning_count := total_opportunities;
    -- Log warning (you might want to add to system_logs table)
    RAISE WARNING 'High number of opportunities: % - consider cleanup', total_opportunities;
  END IF;
  
  -- Delete opportunities older than 7 days that haven't been updated
  WITH deleted AS (
    DELETE FROM public.opportunities
    WHERE updated_at < NOW() - INTERVAL '7 days'
      AND status IN ('open', 'new') -- Only delete open/new, not won/lost
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN QUERY SELECT deleted_count, warning_count;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job (requires pg_cron extension)
-- Note: This requires pg_cron extension to be enabled
-- If not available, run cleanup_old_opportunities() manually or via cron job

-- Comment on function
COMMENT ON FUNCTION cleanup_old_opportunities() IS 'Deletes opportunities older than 7 days. Returns deleted count and warning count if total > 1000.';

