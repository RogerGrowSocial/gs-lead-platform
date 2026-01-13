-- =====================================================
-- USER LOCATION PREFERENCES TABLE
-- =====================================================
-- Migration: 20250115000002_user_location_preferences.sql
-- Doel: Consistente structuur voor locatie voorkeuren
-- (net zoals user_industry_preferences)
-- =====================================================

-- Create user_location_preferences table
CREATE TABLE IF NOT EXISTS public.user_location_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Location code (bijv. 'noord-holland', 'zuid-holland')
  location_code TEXT NOT NULL,
  
  -- Location name (bijv. 'Noord-Holland', 'Zuid-Holland')
  location_name TEXT NOT NULL,
  
  -- Enabled status
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: één preference per user per location
  CONSTRAINT unique_user_location UNIQUE (user_id, location_code)
);

-- Indexen voor performance
CREATE INDEX IF NOT EXISTS idx_user_location_preferences_user_id 
  ON public.user_location_preferences (user_id);

CREATE INDEX IF NOT EXISTS idx_user_location_preferences_location_code 
  ON public.user_location_preferences (location_code);

CREATE INDEX IF NOT EXISTS idx_user_location_preferences_enabled 
  ON public.user_location_preferences (user_id, is_enabled) 
  WHERE is_enabled = TRUE;

-- Migreer bestaande data van profiles.lead_locations naar user_location_preferences
-- Dit migreert alleen als er data is in lead_locations
DO $$
DECLARE
  profile_record RECORD;
  location_code TEXT;
  location_name_map JSONB := '{
    "noord-holland": "Noord-Holland",
    "zuid-holland": "Zuid-Holland",
    "noord-brabant": "Noord-Brabant",
    "gelderland": "Gelderland",
    "utrecht": "Utrecht",
    "friesland": "Friesland",
    "overijssel": "Overijssel",
    "groningen": "Groningen",
    "drenthe": "Drenthe",
    "flevoland": "Flevoland",
    "limburg": "Limburg",
    "zeeland": "Zeeland"
  }'::JSONB;
BEGIN
  -- Loop door alle profiles met lead_locations
  FOR profile_record IN 
    SELECT id, lead_locations 
    FROM public.profiles 
    WHERE lead_locations IS NOT NULL 
      AND array_length(lead_locations, 1) > 0
  LOOP
    -- Loop door elke locatie in de array
    FOREACH location_code IN ARRAY profile_record.lead_locations
    LOOP
      -- Normaliseer location code (lowercase, strip spaces)
      location_code := lower(trim(location_code));
      
      -- Skip lege strings
      IF location_code = '' THEN
        CONTINUE;
      END IF;
      
      -- Bepaal location name (check of het al een naam is of een code)
      DECLARE
        location_name TEXT;
      BEGIN
        -- Check of het al een volledige naam is (met hoofdletters)
        IF location_code = ANY(ARRAY['Noord-Holland', 'Zuid-Holland', 'Noord-Brabant', 'Gelderland', 'Utrecht', 'Friesland', 'Overijssel', 'Groningen', 'Drenthe', 'Flevoland', 'Limburg', 'Zeeland']) THEN
          location_name := location_code;
          -- Converteer naar code
          location_code := lower(replace(location_code, ' ', '-'));
        ELSE
          -- Gebruik mapping voor code naar naam
          location_name := location_name_map->>location_code;
          IF location_name IS NULL THEN
            -- Fallback: capitalize first letter
            location_name := initcap(replace(location_code, '-', ' '));
          END IF;
        END IF;
        
        -- Insert in user_location_preferences (skip als al bestaat)
        INSERT INTO public.user_location_preferences (user_id, location_code, location_name, is_enabled)
        VALUES (profile_record.id, location_code, location_name, TRUE)
        ON CONFLICT (user_id, location_code) DO NOTHING;
      END;
    END LOOP;
  END LOOP;
END $$;

-- RLS Policies
ALTER TABLE public.user_location_preferences ENABLE ROW LEVEL SECURITY;

-- Users kunnen alleen hun eigen preferences lezen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_location_preferences' 
    AND policyname = 'users_select_own_location_preferences'
  ) THEN
    CREATE POLICY "users_select_own_location_preferences" 
      ON public.user_location_preferences
      FOR SELECT 
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_location_preferences' 
    AND policyname = 'users_insert_own_location_preferences'
  ) THEN
    CREATE POLICY "users_insert_own_location_preferences" 
      ON public.user_location_preferences
      FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_location_preferences' 
    AND policyname = 'users_update_own_location_preferences'
  ) THEN
    CREATE POLICY "users_update_own_location_preferences" 
      ON public.user_location_preferences
      FOR UPDATE 
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_location_preferences' 
    AND policyname = 'users_delete_own_location_preferences'
  ) THEN
    CREATE POLICY "users_delete_own_location_preferences" 
      ON public.user_location_preferences
      FOR DELETE 
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function: Sync lead_locations array from user_location_preferences
-- Dit houdt de array in sync voor backwards compatibility
CREATE OR REPLACE FUNCTION public.sync_lead_locations_from_preferences()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Determine user_id based on trigger operation
  IF TG_OP = 'DELETE' THEN
    target_user_id := OLD.user_id;
  ELSE
    target_user_id := NEW.user_id;
  END IF;
  
  -- Update profiles.lead_locations array met enabled locations
  UPDATE public.profiles
  SET 
    lead_locations = COALESCE((
      SELECT ARRAY_AGG(location_code)
      FROM public.user_location_preferences
      WHERE user_id = target_user_id
        AND is_enabled = TRUE
    ), ARRAY[]::TEXT[]),
    updated_at = NOW()
  WHERE id = target_user_id;
  
  -- Return appropriate record based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger: Auto-sync lead_locations array
DROP TRIGGER IF EXISTS sync_lead_locations_trigger ON public.user_location_preferences;
CREATE TRIGGER sync_lead_locations_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_location_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_locations_from_preferences();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_location_preferences TO authenticated;

-- =====================================================
-- EINDE MIGRATION
-- =====================================================

