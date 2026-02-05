-- =====================================================
-- ROLLBACK: Remove admin_notes table (undo 20260205000000)
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can manage admin_notes" ON public.admin_notes;
DROP TABLE IF EXISTS public.admin_notes CASCADE;
