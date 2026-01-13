-- Migration: Add user risk assessment and "new user" tracking to profiles table
-- This migration adds columns for AI-powered risk scoring and manual review tracking

-- =====================================================
-- PROFILES TABLE EXTENSIONS
-- =====================================================

-- Add "new user" tracking
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT true;

-- Add AI risk assessment columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS ai_risk_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_risk_level TEXT,
  ADD COLUMN IF NOT EXISTS ai_risk_explanation TEXT,
  ADD COLUMN IF NOT EXISTS ai_risk_assessed_at TIMESTAMP WITH TIME ZONE;

-- Add manual review tracking columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS manually_reviewed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS manually_reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS manually_reviewed_at TIMESTAMP WITH TIME ZONE;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for filtering new users
CREATE INDEX IF NOT EXISTS idx_profiles_is_new 
  ON public.profiles(is_new) 
  WHERE is_new = true;

-- Index for filtering users requiring review
CREATE INDEX IF NOT EXISTS idx_profiles_requires_review 
  ON public.profiles(requires_manual_review) 
  WHERE requires_manual_review = true;

-- Index for risk score queries
CREATE INDEX IF NOT EXISTS idx_profiles_ai_risk_score 
  ON public.profiles(ai_risk_score) 
  WHERE ai_risk_score IS NOT NULL;

-- Index for created_at (for new user detection)
CREATE INDEX IF NOT EXISTS idx_profiles_created_at 
  ON public.profiles(created_at);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN public.profiles.is_new IS 'Indicates if user is new (default true, cleared manually by admin)';
COMMENT ON COLUMN public.profiles.ai_risk_score IS 'AI-generated risk score from 0-100 (lower = higher risk)';
COMMENT ON COLUMN public.profiles.ai_risk_level IS 'AI risk level: low, medium, or high';
COMMENT ON COLUMN public.profiles.ai_risk_explanation IS 'AI-generated explanation of the risk assessment';
COMMENT ON COLUMN public.profiles.ai_risk_assessed_at IS 'Timestamp when AI risk assessment was last performed';
COMMENT ON COLUMN public.profiles.requires_manual_review IS 'Flag indicating if user requires manual review (based on AI score threshold)';
COMMENT ON COLUMN public.profiles.manually_reviewed IS 'Flag indicating if user has been manually reviewed';
COMMENT ON COLUMN public.profiles.manually_reviewed_by IS 'UUID of admin/manager who performed the review';
COMMENT ON COLUMN public.profiles.manually_reviewed_at IS 'Timestamp when manual review was completed';

