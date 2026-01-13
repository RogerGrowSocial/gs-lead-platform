-- =====================================================
-- CUSTOMER RESPONSIBLE EMPLOYEES - Many-to-Many Relationship
-- =====================================================
-- Migration: 20260105222136_add_customer_responsible_employees.sql
-- Doel: Relatie tussen klanten en verantwoordelijke werknemers
-- =====================================================

-- =====================================================
-- CUSTOMER RESPONSIBLE EMPLOYEES JUNCTION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.customer_responsible_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'responsible' CHECK (role IN ('responsible', 'backup', 'observer')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate assignments
  CONSTRAINT customer_responsible_employees_unique UNIQUE (customer_id, employee_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_responsible_employees_customer_id 
  ON public.customer_responsible_employees (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_responsible_employees_employee_id 
  ON public.customer_responsible_employees (employee_id);

CREATE INDEX IF NOT EXISTS idx_customer_responsible_employees_role 
  ON public.customer_responsible_employees (role);

-- Add comments
COMMENT ON TABLE public.customer_responsible_employees IS 'Junction table for many-to-many relationship between customers and responsible employees';
COMMENT ON COLUMN public.customer_responsible_employees.customer_id IS 'Reference to customer profile (profiles table where role is customer)';
COMMENT ON COLUMN public.customer_responsible_employees.employee_id IS 'Reference to employee profile (profiles table where role is employee)';
COMMENT ON COLUMN public.customer_responsible_employees.role IS 'Type of assignment: responsible (primair/hoofdverantwoordelijke), backup (secundair/vervanger), or observer (informatief)';
COMMENT ON COLUMN public.customer_responsible_employees.assigned_by IS 'User who assigned this employee to the customer';

-- =====================================================
-- UPDATE TRIGGER FOR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_customer_responsible_employees_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_responsible_employees_updated_at ON public.customer_responsible_employees;

CREATE TRIGGER trigger_update_customer_responsible_employees_updated_at
  BEFORE UPDATE ON public.customer_responsible_employees
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_responsible_employees_updated_at();


