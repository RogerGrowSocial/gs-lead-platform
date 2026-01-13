-- =====================================================
-- ADD reasoning COLUMN TO ai_marketing_recommendations
-- =====================================================
-- Migration: 20250116000001_add_reasoning_to_recommendations.sql
-- Doel: Voeg reasoning kolom toe voor uitgebreide uitleg in UI
-- =====================================================

-- Add reasoning column (voor uitgebreide uitleg, naast reason die kort is)
ALTER TABLE public.ai_marketing_recommendations
  ADD COLUMN IF NOT EXISTS reasoning TEXT;

-- Backfill: kopieer reason naar reasoning voor bestaande records
UPDATE public.ai_marketing_recommendations
SET reasoning = reason
WHERE reasoning IS NULL AND reason IS NOT NULL;

-- Comment
COMMENT ON COLUMN public.ai_marketing_recommendations.reasoning IS 
  'Uitgebreide uitleg/redenering voor deze aanbeveling (voor display in UI). reason is kort, reasoning is uitgebreid.';

