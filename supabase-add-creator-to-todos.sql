-- Add creator column to todos table (optional migration)
-- Run this SQL in your Supabase SQL Editor if you want to track who created each todo

ALTER TABLE todos ADD COLUMN IF NOT EXISTS creator TEXT;

-- Optional: Add index for creator if you plan to filter by creator
-- CREATE INDEX IF NOT EXISTS idx_todos_creator ON todos(creator);

