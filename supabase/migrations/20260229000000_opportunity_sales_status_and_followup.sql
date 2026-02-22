-- =====================================================
-- OPPORTUNITY SALES STATUS + FOLLOW-UP AUTOMATION
-- =====================================================
-- A) sales_status fields on opportunities
-- B) opportunity_sales_status_history
-- C) opportunity_assignment_actions (idempotency for email/task)
-- D) opportunity_followup_reminders
-- E) employee_tasks.opportunity_id for follow-up tasks
-- =====================================================

-- A) Opportunities: sales status and contact tracking
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS sales_status TEXT NOT NULL DEFAULT 'new'
    CHECK (sales_status IN ('new', 'contacted', 'appointment_set', 'customer', 'lost', 'unreachable')),
  ADD COLUMN IF NOT EXISTS sales_status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS sales_outcome_reason TEXT,
  ADD COLUMN IF NOT EXISTS contact_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;

COMMENT ON COLUMN public.opportunities.sales_status IS 'Sales disposition: new, contacted, appointment_set, customer (won), lost, unreachable';
COMMENT ON COLUMN public.opportunities.sales_outcome_reason IS 'Required when sales_status = lost';
COMMENT ON COLUMN public.opportunities.contact_attempts IS 'Number of contact attempts';
COMMENT ON COLUMN public.opportunities.last_contact_at IS 'Last contact attempt timestamp';

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

COMMENT ON COLUMN public.opportunities.assigned_at IS 'When the opportunity was last assigned (for reminder windows)';

CREATE INDEX IF NOT EXISTS idx_opportunities_sales_status ON public.opportunities(sales_status);
CREATE INDEX IF NOT EXISTS idx_opportunities_sales_status_updated_at ON public.opportunities(sales_status_updated_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_assigned_to_created ON public.opportunities(assigned_to, created_at DESC) WHERE assigned_to IS NOT NULL;

-- B) History of sales status changes
CREATE TABLE IF NOT EXISTS public.opportunity_sales_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_sales_status_history_opportunity
  ON public.opportunity_sales_status_history(opportunity_id, changed_at DESC);

-- C) Assignment actions: idempotency for email + task (same assignee within window = no duplicate)
CREATE TABLE IF NOT EXISTS public.opportunity_assignment_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  assignee_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_hash TEXT NOT NULL,
  assigned_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual')),
  email_sent_at TIMESTAMPTZ,
  task_id UUID REFERENCES public.employee_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_assignment_actions_hash
  ON public.opportunity_assignment_actions(assignment_hash);

CREATE INDEX IF NOT EXISTS idx_opportunity_assignment_actions_opportunity
  ON public.opportunity_assignment_actions(opportunity_id, created_at DESC);

-- D) Follow-up reminders (day1, day3, day7_escalation) sent once per type
CREATE TABLE IF NOT EXISTS public.opportunity_followup_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  assignee_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('day1', 'day3', 'day7_escalation')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunity_followup_reminders_opportunity_type
  ON public.opportunity_followup_reminders(opportunity_id, reminder_type);

CREATE INDEX IF NOT EXISTS idx_opportunity_followup_reminders_opportunity
  ON public.opportunity_followup_reminders(opportunity_id);

-- E) Link tasks to opportunities for follow-up
ALTER TABLE public.employee_tasks
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.employee_tasks.opportunity_id IS 'Optional: follow-up task for this opportunity';

CREATE INDEX IF NOT EXISTS idx_employee_tasks_opportunity_id
  ON public.employee_tasks(opportunity_id) WHERE opportunity_id IS NOT NULL;
