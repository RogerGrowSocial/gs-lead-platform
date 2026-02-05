-- =====================================================
-- ADMIN NOTES - Simple notes for admin/manager users
-- =====================================================

CREATE TABLE public.admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_admin_notes_created_at ON public.admin_notes(created_at DESC);
CREATE INDEX idx_admin_notes_created_by ON public.admin_notes(created_by);

COMMENT ON TABLE public.admin_notes IS 'Admin notes for internal use by managers and admins';

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_admin_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_admin_notes_updated_at ON public.admin_notes;
CREATE TRIGGER trigger_admin_notes_updated_at
  BEFORE UPDATE ON public.admin_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_notes_updated_at();

-- RLS: API uses service role (bypasses RLS). Policy for direct client access.
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to admin_notes"
  ON public.admin_notes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
