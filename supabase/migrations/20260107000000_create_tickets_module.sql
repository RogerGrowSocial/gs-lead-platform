-- =====================================================
-- TICKETS MODULE - COMPREHENSIVE MIGRATION
-- =====================================================
-- Extends tickets table (canonical) and creates
-- ticket_comments, ticket_attachments, ticket_audit_log, ticket_watchers
-- =====================================================

-- =====================================================
-- 1. EXTEND TICKETS TABLE (CANONICAL)
-- =====================================================

-- Create tickets table if it doesn't exist, or add missing columns
DO $$ 
BEGIN
  -- Check if tickets table exists
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tickets') THEN
    -- Create tickets table
    CREATE TABLE public.tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- Core fields
      ticket_number TEXT UNIQUE NOT NULL DEFAULT 'TKT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('tickets_number_seq'::regclass)::text, 6, '0'),
      subject TEXT NOT NULL,
      description TEXT,
      
      -- Status and priority
      status TEXT DEFAULT 'new' CHECK (status IN ('new', 'open', 'waiting_on_customer', 'waiting_on_internal', 'resolved', 'closed')),
      priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      
      -- Categorization
      category TEXT DEFAULT 'support',
      tags TEXT[] DEFAULT '{}',
      source TEXT DEFAULT 'internal' CHECK (source IN ('internal', 'email', 'phone', 'system')),
      
      -- Requester info (before customer link exists)
      requester_email TEXT,
      requester_name TEXT,
      
      -- Relationships
      customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
      user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      
      -- Team/Department (future)
      team_id UUID,
      department TEXT,
      
      -- SLA and timing
      due_at TIMESTAMPTZ,
      first_response_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      last_activity_at TIMESTAMPTZ DEFAULT NOW(),
      
      -- Internal flags
      is_internal_only BOOLEAN DEFAULT FALSE,
      escalation_level INTEGER DEFAULT 0,
      
      -- Metadata
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    -- Create sequence for ticket numbers
    CREATE SEQUENCE IF NOT EXISTS tickets_number_seq START 1;
  ELSE
    -- Table exists, add missing columns
    ALTER TABLE public.tickets 
      ADD COLUMN IF NOT EXISTS ticket_number TEXT UNIQUE DEFAULT 'TKT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('tickets_number_seq'::regclass)::text, 6, '0'),
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' CHECK (status IN ('new', 'open', 'waiting_on_customer', 'waiting_on_internal', 'resolved', 'closed')),
      ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'support',
      ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'internal' CHECK (source IN ('internal', 'email', 'phone', 'system')),
      ADD COLUMN IF NOT EXISTS requester_email TEXT,
      ADD COLUMN IF NOT EXISTS requester_name TEXT,
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS team_id UUID,
      ADD COLUMN IF NOT EXISTS department TEXT,
      ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS is_internal_only BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;
    
    -- Rename assigned_to to assignee_id if it exists and assignee_id doesn't exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'assigned_to') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'assignee_id') THEN
      ALTER TABLE public.tickets RENAME COLUMN assigned_to TO assignee_id;
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'assigned_to') 
          AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'assignee_id') THEN
      -- Both columns exist, drop assigned_to and keep assignee_id
      ALTER TABLE public.tickets DROP COLUMN IF EXISTS assigned_to;
    END IF;
    
    -- Create sequence if it doesn't exist
    CREATE SEQUENCE IF NOT EXISTS tickets_number_seq START 1;
  END IF;
END $$;

-- Create indexes for tickets
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON public.tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assignee_id ON public.tickets(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON public.tickets(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON public.tickets(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_last_activity_at ON public.tickets(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_due_at ON public.tickets(due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_category ON public.tickets(category);
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON public.tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON public.tickets(ticket_number);

-- =====================================================
-- 2. TICKET COMMENTS TABLE
-- =====================================================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  
  -- Comment content
  body TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  
  -- Author
  author_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_employee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

-- Add missing columns if table exists
DO $$ 
BEGIN
  -- Add author_user_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'ticket_comments' 
                 AND column_name = 'author_user_id') THEN
    ALTER TABLE public.ticket_comments 
      ADD COLUMN author_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  
  -- Add author_employee_id if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'ticket_comments' 
                 AND column_name = 'author_employee_id') THEN
    ALTER TABLE public.ticket_comments 
      ADD COLUMN author_employee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  
  -- Add is_internal if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'ticket_comments' 
                 AND column_name = 'is_internal') THEN
    ALTER TABLE public.ticket_comments 
      ADD COLUMN is_internal BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Indexes for ticket_comments (only create if columns exist)
-- Basic indexes that should always exist
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);

-- Conditional indexes - only create if columns exist
DO $$
BEGIN
  -- Only create created_at index if column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'ticket_comments' 
             AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at 
      ON public.ticket_comments(created_at DESC);
  END IF;
  
  -- Only create author index if column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'ticket_comments' 
             AND column_name = 'author_user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_author 
      ON public.ticket_comments(author_user_id) 
      WHERE author_user_id IS NOT NULL;
  END IF;
  
  -- Only create internal index if column exists
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'ticket_comments' 
             AND column_name = 'is_internal') THEN
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_internal 
      ON public.ticket_comments(ticket_id, is_internal);
  END IF;
END $$;

-- =====================================================
-- 3. TICKET ATTACHMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  
  -- File info
  storage_path TEXT NOT NULL,
  url TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  
  -- Uploader
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ticket_attachments
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON public.ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_by ON public.ticket_attachments(uploaded_by) WHERE uploaded_by IS NOT NULL;

-- =====================================================
-- 4. TICKET AUDIT LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ticket_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  
  -- Actor
  actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Action details
  action TEXT NOT NULL, -- 'status_changed', 'priority_changed', 'assigned', 'unassigned', 'comment_added', etc.
  field_name TEXT, -- 'status', 'priority', 'assignee_id', etc.
  old_value TEXT,
  new_value TEXT,
  diff JSONB, -- Full diff object for complex changes
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for ticket_audit_log
CREATE INDEX IF NOT EXISTS idx_ticket_audit_log_ticket_id ON public.ticket_audit_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_audit_log_created_at ON public.ticket_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_audit_log_actor ON public.ticket_audit_log(actor_user_id) WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ticket_audit_log_action ON public.ticket_audit_log(action);

-- =====================================================
-- 5. TICKET WATCHERS TABLE (OPTIONAL NEXT-LEVEL FEATURE)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ticket_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one user can only watch a ticket once
  UNIQUE(ticket_id, user_id)
);

-- Indexes for ticket_watchers
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_ticket_id ON public.ticket_watchers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_watchers_user_id ON public.ticket_watchers(user_id);

-- =====================================================
-- 6. TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tickets.updated_at
DROP TRIGGER IF EXISTS trigger_tickets_updated_at ON public.tickets;
CREATE TRIGGER trigger_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_tickets_updated_at();

-- Function to update last_activity_at on ticket changes
CREATE OR REPLACE FUNCTION update_ticket_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tickets
  SET last_activity_at = NOW()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ticket_comments
DROP TRIGGER IF EXISTS trigger_ticket_comments_activity ON public.ticket_comments;
CREATE TRIGGER trigger_ticket_comments_activity
  AFTER INSERT OR UPDATE ON public.ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_last_activity();

-- Trigger for ticket_attachments
DROP TRIGGER IF EXISTS trigger_ticket_attachments_activity ON public.ticket_attachments;
CREATE TRIGGER trigger_ticket_attachments_activity
  AFTER INSERT ON public.ticket_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_last_activity();

-- Function to update ticket status timestamps
CREATE OR REPLACE FUNCTION update_ticket_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set first_response_at on first status change from 'new'
  IF OLD.status = 'new' AND NEW.status != 'new' AND NEW.first_response_at IS NULL THEN
    NEW.first_response_at = NOW();
  END IF;
  
  -- Set resolved_at when status becomes 'resolved'
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at = NOW();
  END IF;
  
  -- Set closed_at when status becomes 'closed'
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    NEW.closed_at = NOW();
  END IF;
  
  -- Update last_activity_at
  NEW.last_activity_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for status changes
DROP TRIGGER IF EXISTS trigger_ticket_status_timestamps ON public.tickets;
CREATE TRIGGER trigger_ticket_status_timestamps
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_ticket_status_timestamps();

-- Function to generate ticket_number if not set
-- Drop existing function first if it exists with different signature
DROP FUNCTION IF EXISTS generate_ticket_number() CASCADE;

CREATE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'TKT-' || to_char(NOW(), 'YYYYMMDD') || '-' || 
      lpad(nextval('tickets_number_seq'::regclass)::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ticket_number generation
DROP TRIGGER IF EXISTS trigger_generate_ticket_number ON public.tickets;
CREATE TRIGGER trigger_generate_ticket_number
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION generate_ticket_number();

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_watchers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can view all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admin can manage all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Employees can view assigned tickets" ON public.tickets;
DROP POLICY IF EXISTS "Employees can view watched tickets" ON public.tickets;
DROP POLICY IF EXISTS "Employees can view tickets if support_agent role" ON public.tickets;

-- Tickets policies
-- Admin/Manager: full access
CREATE POLICY "Admin can view all tickets"
  ON public.tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND roles.name ILIKE '%manager%'
      ))
    )
  );

CREATE POLICY "Admin can manage all tickets"
  ON public.tickets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND roles.name ILIKE '%manager%'
      ))
    )
  );

-- Employees: access if assigned, watching, or has support_agent role
CREATE POLICY "Employees can view assigned tickets"
  ON public.tickets FOR SELECT
  USING (
    assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.ticket_watchers
      WHERE ticket_watchers.ticket_id = tickets.id
      AND ticket_watchers.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      JOIN public.roles ON roles.id = profiles.role_id
      WHERE profiles.id = auth.uid()
      AND roles.name ILIKE '%support%'
    )
  );

CREATE POLICY "Employees can update assigned tickets"
  ON public.tickets FOR UPDATE
  USING (
    assignee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND roles.name ILIKE '%support%'
      ))
    )
  );

-- Ticket comments policies
DROP POLICY IF EXISTS "Admin can view all comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Employees can view non-internal comments" ON public.ticket_comments;
DROP POLICY IF EXISTS "Employees can view internal comments if assigned" ON public.ticket_comments;
DROP POLICY IF EXISTS "Employees can add comments" ON public.ticket_comments;

CREATE POLICY "Admin can view all comments"
  ON public.ticket_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND roles.name ILIKE '%manager%'
      ))
    )
  );

CREATE POLICY "Employees can view non-internal comments"
  ON public.ticket_comments FOR SELECT
  USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (
        tickets.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.ticket_watchers
          WHERE ticket_watchers.ticket_id = tickets.id
          AND ticket_watchers.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Employees can view internal comments if assigned"
  ON public.ticket_comments FOR SELECT
  USING (
    is_internal = true
    AND EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (
        tickets.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_admin = true OR EXISTS (
            SELECT 1 FROM public.roles
            WHERE roles.id = profiles.role_id
            AND roles.name ILIKE '%support%'
          ))
        )
      )
    )
  );

CREATE POLICY "Employees can add comments"
  ON public.ticket_comments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_comments.ticket_id
      AND (
        tickets.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_admin = true OR EXISTS (
            SELECT 1 FROM public.roles
            WHERE roles.id = profiles.role_id
            AND roles.name ILIKE '%support%'
          ))
        )
      )
    )
  );

-- Ticket attachments policies (similar to comments)
CREATE POLICY "Admin can manage all attachments" ON public.ticket_attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND roles.name ILIKE '%manager%'
      ))
    )
  );

CREATE POLICY "Employees can view attachments"
  ON public.ticket_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_attachments.ticket_id
      AND (
        tickets.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.ticket_watchers
          WHERE ticket_watchers.ticket_id = tickets.id
          AND ticket_watchers.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_admin = true OR EXISTS (
            SELECT 1 FROM public.roles
            WHERE roles.id = profiles.role_id
            AND roles.name ILIKE '%support%'
          ))
        )
      )
    )
  );

CREATE POLICY "Employees can add attachments"
  ON public.ticket_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_attachments.ticket_id
      AND (
        tickets.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_admin = true OR EXISTS (
            SELECT 1 FROM public.roles
            WHERE roles.id = profiles.role_id
            AND roles.name ILIKE '%support%'
          ))
        )
      )
    )
  );

-- Audit log: only admins can view
CREATE POLICY "Admin can view audit log" ON public.ticket_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = true OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND roles.name ILIKE '%manager%'
      ))
    )
  );

-- Watchers: users can manage their own watch status
CREATE POLICY "Users can view watchers" ON public.ticket_watchers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE tickets.id = ticket_watchers.ticket_id
      AND (
        tickets.assignee_id = auth.uid()
        OR ticket_watchers.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
          AND (profiles.is_admin = true OR EXISTS (
            SELECT 1 FROM public.roles
            WHERE roles.id = profiles.role_id
            AND roles.name ILIKE '%support%'
          ))
        )
      )
    )
  );

CREATE POLICY "Users can manage own watch status" ON public.ticket_watchers FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON TABLE public.tickets IS 'Canonical tickets table for internal ticket handling';
COMMENT ON TABLE public.ticket_comments IS 'Comments and internal notes on tickets';
COMMENT ON TABLE public.ticket_attachments IS 'File attachments for tickets';
COMMENT ON TABLE public.ticket_audit_log IS 'Audit trail of all ticket changes';
COMMENT ON TABLE public.ticket_watchers IS 'Users watching tickets for notifications';

-- =====================================================
-- END MIGRATION
-- =====================================================

