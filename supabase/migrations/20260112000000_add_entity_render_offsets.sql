-- =====================================================
-- Add render offset and origin columns to arcade_entities
-- =====================================================
-- Migration: 20260112000000_add_entity_render_offsets.sql
-- Purpose: Support Kenney isometric asset rendering with proper offsets and anchors
-- =====================================================

-- Add new columns for Kenney isometric rendering
ALTER TABLE public.arcade_entities
  ADD COLUMN IF NOT EXISTS draw_offset_x INTEGER NOT NULL DEFAULT -192,
  ADD COLUMN IF NOT EXISTS draw_offset_y INTEGER NOT NULL DEFAULT 170,
  ADD COLUMN IF NOT EXISTS origin_x NUMERIC NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS origin_y NUMERIC NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS render_w INTEGER,
  ADD COLUMN IF NOT EXISTS render_h INTEGER;

-- Add comments
COMMENT ON COLUMN public.arcade_entities.draw_offset_x IS 'X offset in pixels from base tile position (Kenney default: -192)';
COMMENT ON COLUMN public.arcade_entities.draw_offset_y IS 'Y offset in pixels from base tile position (Kenney default: 170)';
COMMENT ON COLUMN public.arcade_entities.origin_x IS 'Sprite origin X (0.0-1.0), default 0.5 (center)';
COMMENT ON COLUMN public.arcade_entities.origin_y IS 'Sprite origin Y (0.0-1.0), default 1.0 (bottom)';
COMMENT ON COLUMN public.arcade_entities.render_w IS 'Optional render width override (for scaling)';
COMMENT ON COLUMN public.arcade_entities.render_h IS 'Optional render height override (for scaling)';

-- Update existing entities to use Kenney defaults
UPDATE public.arcade_entities
SET 
  draw_offset_x = -192,
  draw_offset_y = 170,
  origin_x = 0.5,
  origin_y = 1.0
WHERE draw_offset_x IS NULL OR draw_offset_y IS NULL;

