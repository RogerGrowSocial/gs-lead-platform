-- Migration: Add database triggers for automatic AI risk assessment
-- This triggers risk assessment when:
-- 1. A new profile is created (after onboarding/signup)
-- 2. Relevant profile fields are updated (KVK, address, company_name, etc.)

-- Create function to notify risk assessment worker
CREATE OR REPLACE FUNCTION public.notify_risk_assessment_needed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  should_assess BOOLEAN := false;
BEGIN
  -- For INSERT: assess new profiles if they have company_name or email
  IF TG_OP = 'INSERT' THEN
    IF NEW.company_name IS NOT NULL OR NEW.email IS NOT NULL THEN
      should_assess := true;
    END IF;
  END IF;

  -- For UPDATE: check if any relevant field changed using IS DISTINCT FROM (handles NULLs correctly)
  IF TG_OP = 'UPDATE' THEN
    IF (
      OLD.company_name IS DISTINCT FROM NEW.company_name OR
      OLD.coc_number IS DISTINCT FROM NEW.coc_number OR
      OLD.vat_number IS DISTINCT FROM NEW.vat_number OR
      OLD.email IS DISTINCT FROM NEW.email OR
      OLD.street IS DISTINCT FROM NEW.street OR
      OLD.postal_code IS DISTINCT FROM NEW.postal_code OR
      OLD.city IS DISTINCT FROM NEW.city OR
      OLD.country IS DISTINCT FROM NEW.country OR
      OLD.phone IS DISTINCT FROM NEW.phone
    ) THEN
      should_assess := true;
    END IF;
  END IF;

  -- Send notification if assessment is needed
  IF should_assess THEN
    PERFORM pg_notify(
      'risk_assessment_needed',
      json_build_object(
        'user_id', NEW.id,
        'operation', TG_OP,
        'timestamp', extract(epoch from now())
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_risk_assessment_on_profile_insert ON public.profiles;
DROP TRIGGER IF EXISTS trigger_risk_assessment_on_profile_update ON public.profiles;

-- Create trigger for INSERT (new profiles)
CREATE TRIGGER trigger_risk_assessment_on_profile_insert
AFTER INSERT ON public.profiles
FOR EACH ROW
WHEN (
  -- Only trigger if profile has at least company_name or email
  NEW.company_name IS NOT NULL OR NEW.email IS NOT NULL
)
EXECUTE FUNCTION public.notify_risk_assessment_needed();

-- Create trigger for UPDATE (profile changes)
CREATE TRIGGER trigger_risk_assessment_on_profile_update
AFTER UPDATE ON public.profiles
FOR EACH ROW
WHEN (
  -- Only trigger if relevant fields changed
  (
    OLD.company_name IS DISTINCT FROM NEW.company_name OR
    OLD.coc_number IS DISTINCT FROM NEW.coc_number OR
    OLD.vat_number IS DISTINCT FROM NEW.vat_number OR
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.street IS DISTINCT FROM NEW.street OR
    OLD.postal_code IS DISTINCT FROM NEW.postal_code OR
    OLD.city IS DISTINCT FROM NEW.city OR
    OLD.country IS DISTINCT FROM NEW.country OR
    OLD.phone IS DISTINCT FROM NEW.phone
  )
)
EXECUTE FUNCTION public.notify_risk_assessment_needed();

-- Add comment
COMMENT ON FUNCTION public.notify_risk_assessment_needed() IS 
'Sends a NOTIFY when a profile needs risk assessment (new profile or relevant field update)';

