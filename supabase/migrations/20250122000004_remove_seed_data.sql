-- =====================================================
-- REMOVE SEED SALES DATA FROM SERVICES MODULE
-- =====================================================
-- This migration removes test/sample sales data
-- Services (master data) are kept, only sales are removed
-- =====================================================

-- Remove sample service sales (only those with source='manual' that look like seed data)
-- This removes sales that were likely created by the seed script
DELETE FROM public.service_sales 
WHERE source = 'manual' 
  AND sold_at >= NOW() - INTERVAL '30 days'
  AND (
    -- Remove sales that match seed patterns (round numbers, specific quantities)
    revenue_cents IN (10000, 15000, 8000, 50000, 5000, 12000, 8000)
    OR quantity IN (1, 8, 10, 15)
  );

-- Note: Services are NOT removed - they are master data and should remain
-- Only test sales data is removed so you can start with real sales data

