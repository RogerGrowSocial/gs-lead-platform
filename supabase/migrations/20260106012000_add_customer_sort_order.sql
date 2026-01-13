-- =====================================================
-- ADD SORT_ORDER TO CUSTOMERS TABLE
-- =====================================================
-- This adds a sort_order field to allow manual ordering
-- of customers in the listing, independent of created_at
-- =====================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_customers_sort_order ON public.customers(sort_order);

-- Set initial sort_order based on created_at (newest first = higher number)
-- This ensures existing customers maintain their current order
UPDATE public.customers c
SET sort_order = sub.row_num - 1
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (ORDER BY created_at DESC) as row_num
  FROM public.customers
) sub
WHERE c.id = sub.id;

-- Add comment
COMMENT ON COLUMN public.customers.sort_order IS 'Manual sort order for customer listing. Lower numbers appear first. Defaults to 0.';

