-- =====================================================
-- ADD SKILLS COLUMN TO PROFILES TABLE
-- =====================================================
-- Run deze in Supabase SQL Editor
-- Dit voegt een skills kolom toe voor het opslaan van vaardigheden

-- Add skills column as TEXT array (can store array of skill names)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN profiles.skills IS 'Array of skill names for employees (e.g., ["Sales", "CRM", "Marketing"])';

-- Optional: Create index if you plan to search/filter by skills
-- CREATE INDEX IF NOT EXISTS idx_profiles_skills ON profiles USING GIN (skills);

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND table_schema = 'public'
  AND column_name = 'skills';

