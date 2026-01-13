-- =====================================================
-- ADD MAILBOX ACCESS PERMISSIONS
-- =====================================================
-- This migration adds support for mailbox access control:
-- - Managers/admins can see all mailboxes
-- - Regular users can only see their own mailbox (matching email)
-- - Users with can_read_company_mailboxes can see company mailboxes
-- =====================================================

-- Add permission field to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_read_company_mailboxes BOOLEAN DEFAULT FALSE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_can_read_company_mailboxes ON public.profiles(can_read_company_mailboxes) WHERE can_read_company_mailboxes = TRUE;

-- Add comment
COMMENT ON COLUMN public.profiles.can_read_company_mailboxes IS 'If true, user can read company mailboxes (in addition to their own). Managers/admins always have access to all mailboxes.';
