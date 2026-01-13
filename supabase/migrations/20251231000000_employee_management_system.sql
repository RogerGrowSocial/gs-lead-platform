-- =====================================================
-- EMPLOYEE MANAGEMENT SYSTEM - Complete Migration
-- =====================================================
-- Migration: 20251231000000_employee_management_system.sql
-- Doel: Werknemer management systeem met taken, urenregistratie en salaris
-- =====================================================

-- =====================================================
-- 1. EMPLOYEE PROFILES (extends profiles)
-- =====================================================

-- Add employee-specific columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hourly_rate_cents INTEGER DEFAULT 0 CHECK (hourly_rate_cents >= 0),
  ADD COLUMN IF NOT EXISTS employee_status TEXT DEFAULT 'active' CHECK (employee_status IN ('active', 'paused', 'inactive'));

-- Index for manager lookups
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id 
  ON public.profiles (manager_id) 
  WHERE manager_id IS NOT NULL;

-- Index for employee status
CREATE INDEX IF NOT EXISTS idx_profiles_employee_status 
  ON public.profiles (employee_status) 
  WHERE employee_status IS NOT NULL;

-- =====================================================
-- 2. EMPLOYEE TASKS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.employee_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'in_review', 'done', 'rejected')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  value_cents INTEGER DEFAULT 0 CHECK (value_cents >= 0),
  due_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employee_tasks_employee_id 
  ON public.employee_tasks (employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_tasks_status 
  ON public.employee_tasks (status);

CREATE INDEX IF NOT EXISTS idx_employee_tasks_due_at 
  ON public.employee_tasks (due_at) 
  WHERE due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employee_tasks_created_by 
  ON public.employee_tasks (created_by) 
  WHERE created_by IS NOT NULL;

-- =====================================================
-- 3. TIME ENTRIES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.employee_tasks(id) ON DELETE SET NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0 CHECK (duration_minutes >= 0),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id 
  ON public.time_entries (employee_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_status 
  ON public.time_entries (status);

CREATE INDEX IF NOT EXISTS idx_time_entries_start_at 
  ON public.time_entries (start_at);

CREATE INDEX IF NOT EXISTS idx_time_entries_task_id 
  ON public.time_entries (task_id) 
  WHERE task_id IS NOT NULL;

-- =====================================================
-- 4. PAYOUT BATCHES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  total_amount_cents INTEGER DEFAULT 0 CHECK (total_amount_cents >= 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payout_batches_period_check CHECK (period_end >= period_start)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payout_batches_status 
  ON public.payout_batches (status);

CREATE INDEX IF NOT EXISTS idx_payout_batches_period 
  ON public.payout_batches (period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_payout_batches_created_by 
  ON public.payout_batches (created_by);

-- =====================================================
-- 5. PAYOUT ITEMS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.payout_batches(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('time_entry', 'task', 'bonus', 'adjustment')),
  source_id UUID, -- References time_entries.id or employee_tasks.id
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payout_items_batch_id 
  ON public.payout_items (batch_id);

CREATE INDEX IF NOT EXISTS idx_payout_items_employee_id 
  ON public.payout_items (employee_id);

CREATE INDEX IF NOT EXISTS idx_payout_items_source 
  ON public.payout_items (source_type, source_id) 
  WHERE source_id IS NOT NULL;

-- =====================================================
-- 6. EMPLOYEE NOTES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.employee_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employee_notes_employee_id 
  ON public.employee_notes (employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_notes_created_by 
  ON public.employee_notes (created_by);

CREATE INDEX IF NOT EXISTS idx_employee_notes_created_at 
  ON public.employee_notes (created_at DESC);

-- =====================================================
-- 7. AUDIT LOG (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL, -- 'employee_task', 'time_entry', 'payout_batch', 'employee_profile', etc.
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'approved', 'rejected', 'status_changed', etc.
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_actor 
  ON public.audit_log (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity 
  ON public.audit_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at 
  ON public.audit_log (created_at DESC);

-- =====================================================
-- 8. TRIGGERS
-- =====================================================

-- Update updated_at for employee_tasks
CREATE OR REPLACE FUNCTION update_employee_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_employee_tasks_updated_at ON public.employee_tasks;
CREATE TRIGGER trigger_update_employee_tasks_updated_at
  BEFORE UPDATE ON public.employee_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_tasks_updated_at();

-- Update updated_at for time_entries
CREATE OR REPLACE FUNCTION update_time_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_time_entries_updated_at ON public.time_entries;
CREATE TRIGGER trigger_update_time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_time_entries_updated_at();

-- Update updated_at for payout_batches
CREATE OR REPLACE FUNCTION update_payout_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_payout_batches_updated_at ON public.payout_batches;
CREATE TRIGGER trigger_update_payout_batches_updated_at
  BEFORE UPDATE ON public.payout_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_payout_batches_updated_at();

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Employee Tasks RLS
ALTER TABLE public.employee_tasks ENABLE ROW LEVEL SECURITY;

-- Employee can view own tasks
CREATE POLICY "Employees can view own tasks"
  ON public.employee_tasks FOR SELECT
  USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (is_admin = true OR id IN (SELECT manager_id FROM public.profiles WHERE id = employee_tasks.employee_id))
    )
  );

-- Manager/Admin can create tasks
CREATE POLICY "Managers and admins can create tasks"
  ON public.employee_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (is_admin = true OR id IN (SELECT manager_id FROM public.profiles WHERE id = employee_tasks.employee_id))
    )
  );

-- Employee can update own tasks (status only)
CREATE POLICY "Employees can update own tasks"
  ON public.employee_tasks FOR UPDATE
  USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (is_admin = true OR id IN (SELECT manager_id FROM public.profiles WHERE id = employee_tasks.employee_id))
    )
  );

-- Time Entries RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Employee can view own time entries
CREATE POLICY "Employees can view own time entries"
  ON public.time_entries FOR SELECT
  USING (
    employee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (is_admin = true OR id IN (SELECT manager_id FROM public.profiles WHERE id = time_entries.employee_id))
    )
  );

-- Employee can create own time entries (draft only)
CREATE POLICY "Employees can create own time entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (employee_id = auth.uid() AND status = 'draft');

-- Employee can update own time entries (draft only)
CREATE POLICY "Employees can update own draft time entries"
  ON public.time_entries FOR UPDATE
  USING (employee_id = auth.uid() AND status = 'draft')
  WITH CHECK (employee_id = auth.uid() AND (status = 'draft' OR status = 'submitted'));

-- Manager/Admin can approve/reject submitted time entries
CREATE POLICY "Managers and admins can approve time entries"
  ON public.time_entries FOR UPDATE
  USING (
    status = 'submitted' AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (is_admin = true OR id IN (SELECT manager_id FROM public.profiles WHERE id = time_entries.employee_id))
    )
  );

-- Payout Batches RLS
ALTER TABLE public.payout_batches ENABLE ROW LEVEL SECURITY;

-- Admin/Finance can view all payouts
CREATE POLICY "Admins can view all payouts"
  ON public.payout_batches FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin can create/update payouts
CREATE POLICY "Admins can manage payouts"
  ON public.payout_batches FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Payout Items RLS
ALTER TABLE public.payout_items ENABLE ROW LEVEL SECURITY;

-- Admin can view all payout items
CREATE POLICY "Admins can view payout items"
  ON public.payout_items FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admin can create payout items
CREATE POLICY "Admins can create payout items"
  ON public.payout_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Employee Notes RLS
ALTER TABLE public.employee_notes ENABLE ROW LEVEL SECURITY;

-- Manager/Admin can view notes (employee cannot)
CREATE POLICY "Managers and admins can view notes"
  ON public.employee_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (is_admin = true OR id IN (SELECT manager_id FROM public.profiles WHERE id = employee_notes.employee_id))
    )
  );

-- Manager/Admin can create notes
CREATE POLICY "Managers and admins can create notes"
  ON public.employee_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND (is_admin = true OR id IN (SELECT manager_id FROM public.profiles WHERE id = employee_notes.employee_id))
    )
  );

-- Audit Log RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admin can view all audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- System can insert audit logs (via service role)
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- 10. HELPER FUNCTIONS
-- =====================================================

-- Function to check if user is manager of employee
CREATE OR REPLACE FUNCTION public.is_manager_of_employee(
  p_manager_id UUID,
  p_employee_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_employee_id 
    AND manager_id = p_manager_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get employee unpaid balance (approved but not paid)
CREATE OR REPLACE FUNCTION public.get_employee_unpaid_balance(
  p_employee_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER := 0;
BEGIN
  -- Sum approved time entries (hourly rate * hours)
  SELECT COALESCE(SUM(
    CASE 
      WHEN te.duration_minutes > 0 THEN 
        (te.duration_minutes / 60.0) * COALESCE(p.hourly_rate_cents, 0)
      ELSE 0
    END
  ), 0)::INTEGER
  INTO v_balance
  FROM public.time_entries te
  JOIN public.profiles p ON p.id = te.employee_id
  WHERE te.employee_id = p_employee_id
    AND te.status = 'approved'
    AND NOT EXISTS (
      SELECT 1 FROM public.payout_items pi
      WHERE pi.source_type = 'time_entry' 
      AND pi.source_id = te.id
    );

  -- Add approved task values
  SELECT COALESCE(SUM(et.value_cents), 0)::INTEGER
  INTO v_balance
  FROM public.employee_tasks et
  WHERE et.employee_id = p_employee_id
    AND et.status = 'done'
    AND et.approved_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.payout_items pi
      WHERE pi.source_type = 'task' 
      AND pi.source_id = et.id
    );

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 11. SEED DATA (for testing)
-- =====================================================

-- Note: This assumes you have at least one employee profile in the system
-- Replace 'EMPLOYEE_USER_ID_HERE' with an actual user ID from profiles table

DO $$
DECLARE
  v_employee_id UUID;
  v_task1_id UUID;
BEGIN
  -- Get first employee (or create test data)
  SELECT id INTO v_employee_id 
  FROM public.profiles 
  WHERE is_admin = false 
  LIMIT 1;

  -- If no employee found, skip seed data
  IF v_employee_id IS NULL THEN
    RAISE NOTICE 'No employee found for seed data. Skipping...';
    RETURN;
  END IF;

  -- Create first test task and capture its ID
  INSERT INTO public.employee_tasks (employee_id, title, description, status, priority, value_cents, due_at)
  VALUES 
    (v_employee_id, 'Test Taak 1', 'Dit is een test taak voor development', 'in_progress', 'high', 5000, NOW() + INTERVAL '7 days')
  RETURNING id INTO v_task1_id;

  -- Create second test task (don't need to capture ID)
  INSERT INTO public.employee_tasks (employee_id, title, description, status, priority, value_cents, due_at)
  VALUES 
    (v_employee_id, 'Test Taak 2', 'Nog een test taak', 'open', 'medium', 3000, NOW() + INTERVAL '14 days');

  -- Create 2 test time entries (using the first task ID we captured)
  INSERT INTO public.time_entries (employee_id, task_id, start_at, end_at, duration_minutes, note, status)
  VALUES 
    (v_employee_id, v_task1_id, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '4 hours', 240, 'Test urenregistratie', 'submitted'),
    (v_employee_id, NULL, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '2 hours', 120, 'Algemene uren', 'draft');

  RAISE NOTICE 'Seed data created for employee: %', v_employee_id;
END $$;

-- =====================================================
-- END OF MIGRATION
-- =====================================================

