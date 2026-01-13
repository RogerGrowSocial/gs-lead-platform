-- =====================================================
-- PERFORMANCE SYSTEM - PHASE 1: Database Schema Uitbreidingen
-- =====================================================
-- Migration: 20250120000000_performance_system_phase1.sql
-- Doel: Basis infrastructuur voor master prestatie-systeem
-- =====================================================

-- =====================================================
-- 1. LEADS TABLE: first_contact_at kolom
-- =====================================================

-- Voeg first_contact_at kolom toe aan leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ;

-- Index voor performance queries
CREATE INDEX IF NOT EXISTS idx_leads_first_contact_at 
  ON public.leads (first_contact_at)
  WHERE first_contact_at IS NOT NULL;

-- =====================================================
-- 2. LEADS TABLE: deal_value kolom (voor won leads)
-- =====================================================

-- Voeg deal_value kolom toe (optioneel, kan NULL zijn)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS deal_value NUMERIC(10,2);

-- Index voor performance queries
CREATE INDEX IF NOT EXISTS idx_leads_deal_value 
  ON public.leads (deal_value)
  WHERE deal_value IS NOT NULL;

-- =====================================================
-- 3. LEADS TABLE: Status uitbreiding (won/lost)
-- =====================================================

-- Check constraint voor status (voeg 'won' en 'lost' toe aan bestaande enum)
-- Let op: PostgreSQL ondersteunt geen ALTER TYPE ... ADD VALUE in een transaction
-- Dit moet mogelijk handmatig gedaan worden of via een aparte migration
-- Voor nu: we gebruiken een CHECK constraint die 'won' en 'lost' toestaat

-- Eerst checken of er al een constraint is
DO $$
BEGIN
  -- Als er al een constraint is, verwijder die eerst (handmatig te doen)
  -- Voor nu: we voegen een nieuwe constraint toe die 'won' en 'lost' toestaat
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'leads_status_check_extended'
  ) THEN
    -- Voeg constraint toe die 'won' en 'lost' toestaat
    ALTER TABLE public.leads
      DROP CONSTRAINT IF EXISTS leads_status_check;
    
    ALTER TABLE public.leads
      ADD CONSTRAINT leads_status_check_extended 
      CHECK (status IN ('new', 'accepted', 'rejected', 'in_progress', 'completed', 'won', 'lost'));
  END IF;
END $$;

-- =====================================================
-- 4. LEAD_ACTIVITIES TABLE: Uitbreidingen
-- =====================================================

-- Voeg metadata JSONB kolom toe (optioneel) - dit wordt in de DO block hieronder gedaan

-- Update type constraint om nieuwe types toe te staan
-- Let op: Dit vereist mogelijk handmatige aanpassing van de constraint
-- Voor nu: we documenteren welke types we nodig hebben:
-- 'phone_call', 'email_sent', 'whatsapp', 'meeting', 'status_change_contacted', 'note', 'created'

-- Check of lead_activities tabel bestaat en voeg metadata toe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'lead_activities'
  ) THEN
    -- Voeg metadata kolom toe als die nog niet bestaat
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'lead_activities' 
        AND column_name = 'metadata'
    ) THEN
      ALTER TABLE public.lead_activities
        ADD COLUMN metadata JSONB;
    END IF;
  END IF;
END $$;

-- =====================================================
-- 5. TRIGGER: Set first_contact_at bij eerste contact
-- =====================================================

-- Functie om first_contact_at te zetten bij eerste contact activiteit
CREATE OR REPLACE FUNCTION public.set_first_contact_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check of dit een contact-activiteit is
  IF NEW.type IN ('phone_call', 'email_sent', 'whatsapp', 'meeting', 'status_change_contacted') THEN
    -- Update leads.first_contact_at alleen als die nog NULL is
    UPDATE public.leads
    SET first_contact_at = COALESCE(first_contact_at, NOW())
    WHERE id = NEW.lead_id
      AND first_contact_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop bestaande trigger als die bestaat
DROP TRIGGER IF EXISTS trigger_set_first_contact_at ON public.lead_activities;

-- Maak nieuwe trigger
CREATE TRIGGER trigger_set_first_contact_at
  AFTER INSERT ON public.lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_first_contact_at();

-- =====================================================
-- 6. LEAD_FEEDBACK TABLE: Klantenfeedback/ratings
-- =====================================================

CREATE TABLE IF NOT EXISTS public.lead_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referenties
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Feedback data
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_lead_feedback UNIQUE (lead_id, partner_id)
);

-- Indexen voor performance
CREATE INDEX IF NOT EXISTS idx_lead_feedback_lead_id 
  ON public.lead_feedback (lead_id);

CREATE INDEX IF NOT EXISTS idx_lead_feedback_partner_id 
  ON public.lead_feedback (partner_id);

CREATE INDEX IF NOT EXISTS idx_lead_feedback_created_at 
  ON public.lead_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_feedback_rating 
  ON public.lead_feedback (rating);

-- =====================================================
-- 7. SUPPORT_TICKETS TABLE: Klachten/tickets
-- =====================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Referenties
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Ticket data
  type TEXT NOT NULL CHECK (type IN ('complaint', 'question', 'technical', 'other')),
  subject TEXT,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  
  -- Optioneel: wie heeft het ticket aangemaakt/opgelost
  created_by UUID REFERENCES public.profiles(id),
  resolved_by UUID REFERENCES public.profiles(id)
);

-- Indexen voor performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_lead_id 
  ON public.support_tickets (lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_partner_id 
  ON public.support_tickets (partner_id)
  WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_type 
  ON public.support_tickets (type);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status 
  ON public.support_tickets (status);

CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at 
  ON public.support_tickets (created_at DESC);

-- Index specifiek voor complaints (belangrijk voor performance metrics)
CREATE INDEX IF NOT EXISTS idx_support_tickets_complaints 
  ON public.support_tickets (partner_id, created_at DESC)
  WHERE type = 'complaint';

-- =====================================================
-- 8. COMMENTS & DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN public.leads.first_contact_at IS 'Timestamp van eerste contact met lead (gezet via trigger bij lead_activities insert)';
COMMENT ON COLUMN public.leads.deal_value IS 'Waarde van de opdracht/deal (voor won leads)';
COMMENT ON TABLE public.lead_feedback IS 'Klantenfeedback/ratings per lead (1-5 sterren)';
COMMENT ON TABLE public.support_tickets IS 'Support tickets en klachten per lead/partner';

-- =====================================================
-- 9. GRANTS (als RLS enabled is)
-- =====================================================

-- Grant permissions (aanpassen naar jouw RLS policies)
-- ALTER TABLE public.lead_feedback ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- EINDE MIGRATION
-- =====================================================

