-- ============================================
-- Bugs Table for Admin Bug Tracking System
-- ============================================
-- Run this SQL in your Supabase SQL Editor to create the bugs table

CREATE TABLE IF NOT EXISTS bugs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bug_id TEXT UNIQUE NOT NULL, -- e.g., 'BUG-101'
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'fixed', 'closed')),
  area TEXT, -- e.g., 'Onboarding Tour', 'Dashboard', 'Payments'
  url TEXT, -- Link to the page where bug occurs
  reporter TEXT, -- Who reported the bug
  tags TEXT[], -- Array of tags like ['UI', 'Overlay', 'Mask']
  assigned_to UUID REFERENCES profiles(id), -- Optional: assign to a team member
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  fixed_at TIMESTAMPTZ, -- When bug was fixed
  notes TEXT -- Additional notes or comments
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status);
CREATE INDEX IF NOT EXISTS idx_bugs_priority ON bugs(priority);
CREATE INDEX IF NOT EXISTS idx_bugs_area ON bugs(area);
CREATE INDEX IF NOT EXISTS idx_bugs_created_at ON bugs(created_at DESC);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_bugs_updated_at
  BEFORE UPDATE ON bugs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE bugs ENABLE ROW LEVEL SECURITY;

-- Create policy: Only admins can view bugs
CREATE POLICY "Only admins can view bugs"
  ON bugs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create policy: Only admins can insert bugs
CREATE POLICY "Only admins can insert bugs"
  ON bugs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create policy: Only admins can update bugs
CREATE POLICY "Only admins can update bugs"
  ON bugs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create policy: Only admins can delete bugs
CREATE POLICY "Only admins can delete bugs"
  ON bugs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Insert some example bugs (optional - remove if you don't want sample data)
INSERT INTO bugs (bug_id, title, description, priority, status, area, url, reporter, tags) VALUES
  ('BUG-101', 'Spotlight mini-square at (0,0) on step navigation', 'Tiny highlight appears top-left for a split second when switching steps.', 'urgent', 'open', 'Onboarding Tour', '/dashboard/leads?tour=true&step=3', 'QA - Laura', ARRAY['UI', 'Overlay', 'Mask']),
  ('BUG-102', 'Tooltip overlaps card at narrow widths', 'On small screens the tooltip can extend outside viewport.', 'high', 'in_progress', 'Dashboard', '/dashboard', 'Support', ARRAY['Responsive', 'Tooltip']),
  ('BUG-103', 'Payments: loading state too long on slow network', 'Cards show "Laden…" for >3s even when data is available.', 'normal', 'open', 'Payments', '/dashboard/payments', 'Customer', ARRAY['Performance']),
  ('BUG-104', 'Lead slider causes 500 when API throttled', 'Slider emits too many requests without debounce.', 'low', 'fixed', 'Leads', '/dashboard/leads', 'DevOps', ARRAY['API', 'Throttle'])
ON CONFLICT (bug_id) DO NOTHING;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON bugs TO authenticated;
-- GRANT USAGE ON SEQUENCE bugs_id_seq TO authenticated;

