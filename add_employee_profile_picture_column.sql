-- =====================================================
-- EMPLOYEE PROFILE PICTURE - Database Schema Update
-- =====================================================
-- Run deze in Supabase SQL Editor
-- Dit voegt de profile_picture kolom toe aan de profiles tabel
-- (als deze nog niet bestaat)

-- =====================================================
-- ADD PROFILE_PICTURE COLUMN TO PROFILES TABLE
-- =====================================================

-- Add profile_picture column if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_picture TEXT;

-- Add comment to column
COMMENT ON COLUMN profiles.profile_picture IS 'URL naar de profielfoto van de werknemer/gebruiker';

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run deze query om te verifiëren dat de kolom is toegevoegd:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'profile_picture';

