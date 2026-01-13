-- Create todos table
CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  assignee TEXT,
  due_date DATE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_todos_todo_id ON todos(todo_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
CREATE INDEX IF NOT EXISTS idx_todos_assignee ON todos(assignee);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);

-- Enable Row Level Security (RLS)
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- Create policy: Only admins can view todos
CREATE POLICY "Only admins can view todos"
  ON todos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create policy: Only admins can insert todos
CREATE POLICY "Only admins can insert todos"
  ON todos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create policy: Only admins can update todos
CREATE POLICY "Only admins can update todos"
  ON todos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create policy: Only admins can delete todos
CREATE POLICY "Only admins can delete todos"
  ON todos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_todos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION update_todos_updated_at();

-- Optional: Insert sample data (remove if not needed)
-- INSERT INTO todos (todo_id, title, description, priority, status, assignee, due_date, tags) VALUES
-- ('TODO-001', 'Database optimalisatie', 'Optimaliseer queries voor betere performance', 'high', 'todo', 'Jan Jansen', '2025-02-15', ARRAY['database', 'performance']),
-- ('TODO-002', 'UI verbeteringen', 'Verbeter gebruikersinterface op basis van feedback', 'normal', 'in_progress', 'Piet Pietersen', '2025-02-20', ARRAY['ui', 'ux']),
-- ('TODO-003', 'Documentatie bijwerken', 'Update API documentatie met nieuwe endpoints', 'low', 'done', 'Klaas Klaassen', NULL, ARRAY['documentation']);

