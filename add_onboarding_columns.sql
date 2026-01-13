-- =====================================================
-- ONBOARDING SYSTEM - Database Schema Updates
-- =====================================================
-- Run deze in Supabase SQL Editor
-- Dit voegt alle benodigde velden toe voor de intake wizard en spotlight tour

-- =====================================================
-- 1. ADD COLUMNS TO PROFILES TABLE
-- =====================================================

-- Basis informatie (optioneel)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT;

-- Adres informatie (optioneel)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS coc_number TEXT;

-- Referral informatie
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS referral_source TEXT CHECK (referral_source IN ('google', 'linkedin', 'partner', 'email', 'anders', '')),
ADD COLUMN IF NOT EXISTS referral_note TEXT;

-- Lead voorkeuren (arrays)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS lead_industries TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS lead_locations TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS lead_types TEXT[] DEFAULT '{}';

-- Budget voorkeuren
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS lead_budget_min NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS lead_budget_max NUMERIC(10,2);

-- Notificatie voorkeuren (array)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS notify_channels TEXT[] DEFAULT '{inapp}' CHECK (
  notify_channels <@ ARRAY['email', 'inapp', 'whatsapp']::TEXT[]
);

-- Onboarding tracking
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed 
ON profiles(onboarding_completed_at) 
WHERE onboarding_completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_step 
ON profiles(onboarding_step);

-- =====================================================
-- 3. UPDATE RLS POLICIES (if needed)
-- =====================================================

-- Zorg ervoor dat users hun eigen profiel kunnen lezen en updaten
-- (Deze policies zouden al moeten bestaan, maar we controleren ze)

-- Read own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);
  END IF;
END $$;

-- Update own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- =====================================================
-- 4. CREATE HELPER FUNCTION FOR ONBOARDING STATUS
-- =====================================================

CREATE OR REPLACE FUNCTION get_onboarding_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_status JSONB;
BEGIN
  SELECT * INTO v_profile
  FROM profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'User not found'
    );
  END IF;
  
  v_status := jsonb_build_object(
    'onboarding_completed', v_profile.onboarding_completed_at IS NOT NULL,
    'onboarding_step', COALESCE(v_profile.onboarding_step, 0),
    'onboarding_completed_at', v_profile.onboarding_completed_at,
    'has_basic_info', (
      (v_profile.first_name IS NOT NULL AND v_profile.first_name != '') OR
      (v_profile.company_name IS NOT NULL AND v_profile.company_name != '')
    ),
    'has_referral_info', v_profile.referral_source IS NOT NULL AND v_profile.referral_source != '',
    'has_lead_preferences', (
      array_length(v_profile.lead_industries, 1) > 0 OR
      array_length(v_profile.lead_locations, 1) > 0 OR
      array_length(v_profile.lead_types, 1) > 0
    )
  );
  
  RETURN v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_onboarding_status(UUID) TO authenticated;

-- =====================================================
-- 5. CREATE FUNCTION TO COMPLETE ONBOARDING
-- =====================================================

CREATE OR REPLACE FUNCTION complete_onboarding(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE profiles
  SET 
    onboarding_step = 99,
    onboarding_completed_at = NOW()
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION complete_onboarding(UUID) TO authenticated;

-- =====================================================
-- 6. CREATE FUNCTION TO UPDATE ONBOARDING STEP
-- =====================================================

CREATE OR REPLACE FUNCTION update_onboarding_step(
  p_user_id UUID,
  p_step INTEGER,
  p_data JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE profiles
  SET 
    onboarding_step = p_step,
    -- Optioneel: update specifieke velden gebaseerd op step
    first_name = COALESCE((p_data->>'first_name')::TEXT, first_name),
    last_name = COALESCE((p_data->>'last_name')::TEXT, last_name),
    company_name = COALESCE((p_data->>'company_name')::TEXT, company_name),
    phone = COALESCE((p_data->>'phone')::TEXT, phone),
    referral_source = COALESCE((p_data->>'referral_source')::TEXT, referral_source),
    referral_note = COALESCE((p_data->>'referral_note')::TEXT, referral_note),
    lead_industries = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_data->'lead_industries')),
      lead_industries
    ),
    lead_locations = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_data->'lead_locations')),
      lead_locations
    ),
    lead_types = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_data->'lead_types')),
      lead_types
    ),
    lead_budget_min = COALESCE((p_data->>'lead_budget_min')::NUMERIC, lead_budget_min),
    lead_budget_max = COALESCE((p_data->>'lead_budget_max')::NUMERIC, lead_budget_max),
    notify_channels = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(p_data->'notify_channels')),
      notify_channels
    )
  WHERE id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_onboarding_step(UUID, INTEGER, JSONB) TO authenticated;

-- =====================================================
-- 7. CREATE TRIGGER TO SET DEFAULT ONBOARDING STEP
-- =====================================================

CREATE OR REPLACE FUNCTION set_default_onboarding_step()
RETURNS TRIGGER AS $$
BEGIN
  -- Als onboarding_step NULL is, zet op 0
  IF NEW.onboarding_step IS NULL THEN
    NEW.onboarding_step := 0;
  END IF;
  
  -- Als notify_channels leeg is, zet default op inapp
  IF NEW.notify_channels IS NULL OR array_length(NEW.notify_channels, 1) IS NULL THEN
    NEW.notify_channels := ARRAY['inapp']::TEXT[];
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_set_default_onboarding ON profiles;
CREATE TRIGGER trigger_set_default_onboarding
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_default_onboarding_step();

-- =====================================================
-- 8. CREATE VIEW FOR ONBOARDING PROGRESS
-- =====================================================

CREATE OR REPLACE VIEW v_onboarding_progress AS
SELECT 
  id,
  email,
  first_name,
  last_name,
  company_name,
  onboarding_step,
  onboarding_completed_at,
  CASE 
    WHEN onboarding_completed_at IS NOT NULL THEN 100
    WHEN onboarding_step >= 3 THEN 75
    WHEN onboarding_step >= 2 THEN 50
    WHEN onboarding_step >= 1 THEN 25
    ELSE 0
  END as progress_percentage,
  -- Check if basic info is filled
  (
    (first_name IS NOT NULL AND first_name != '') OR
    (company_name IS NOT NULL AND company_name != '')
  ) as has_basic_info,
  -- Check if referral info is filled
  (
    referral_source IS NOT NULL AND referral_source != ''
  ) as has_referral_info,
  -- Check if lead preferences are filled
  (
    array_length(lead_industries, 1) > 0 OR
    array_length(lead_locations, 1) > 0 OR
    array_length(lead_types, 1) > 0
  ) as has_lead_preferences
FROM profiles;

-- Grant access to authenticated users
GRANT SELECT ON v_onboarding_progress TO authenticated;

-- =====================================================
-- 9. UPDATE EXISTING USERS (optional)
-- =====================================================

-- Zet default values voor bestaande users die nog geen onboarding hebben gedaan
UPDATE profiles
SET 
  onboarding_step = 0,
  notify_channels = ARRAY['inapp']::TEXT[]
WHERE onboarding_step IS NULL
  AND onboarding_completed_at IS NULL;

-- =====================================================
-- 10. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN profiles.first_name IS 'Voornaam van de gebruiker (optioneel)';
COMMENT ON COLUMN profiles.last_name IS 'Achternaam van de gebruiker (optioneel)';
COMMENT ON COLUMN profiles.company_name IS 'Bedrijfsnaam (optioneel)';
COMMENT ON COLUMN profiles.phone IS 'Telefoonnummer (optioneel)';
COMMENT ON COLUMN profiles.referral_source IS 'Hoe heeft de gebruiker ons gevonden: google, linkedin, partner, email, anders';
COMMENT ON COLUMN profiles.referral_note IS 'Extra toelichting over hoe de gebruiker ons heeft gevonden';
COMMENT ON COLUMN profiles.lead_industries IS 'Array van branche voorkeuren (bijv. ["dakdekker", "schilder"])';
COMMENT ON COLUMN profiles.lead_locations IS 'Array van locatie voorkeuren (bijv. ["Rotterdam", "Den Haag", "3061"])';
COMMENT ON COLUMN profiles.lead_types IS 'Array van lead type voorkeuren (bijv. ["b2b", "spoed", "phone"])';
COMMENT ON COLUMN profiles.lead_budget_min IS 'Minimaal budget per lead in euro';
COMMENT ON COLUMN profiles.lead_budget_max IS 'Maximaal budget per lead in euro';
COMMENT ON COLUMN profiles.notify_channels IS 'Array van notificatie voorkeuren: email, inapp, whatsapp';
COMMENT ON COLUMN profiles.onboarding_step IS 'Huidige stap in onboarding proces (0 = niet gestart, 1-3 = intake wizard, 99 = voltooid)';
COMMENT ON COLUMN profiles.onboarding_completed_at IS 'Datum/tijd wanneer onboarding is voltooid';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if columns were added successfully
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN (
    'first_name', 'last_name', 'company_name', 'phone',
    'referral_source', 'referral_note',
    'lead_industries', 'lead_locations', 'lead_types',
    'lead_budget_min', 'lead_budget_max',
    'notify_channels',
    'onboarding_step', 'onboarding_completed_at'
  )
ORDER BY column_name;

-- Check if functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_onboarding_status',
    'complete_onboarding',
    'update_onboarding_step'
  );

-- Check if view exists
SELECT 
  table_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name = 'v_onboarding_progress';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT '✅ Onboarding system successfully installed!' as status;

