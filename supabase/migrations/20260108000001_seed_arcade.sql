-- =====================================================
-- ARCADE MODULE - Seed Data
-- =====================================================
-- Migration: 20260108000001_seed_arcade.sql
-- Purpose: Seed default room, entities, placements, and unlocks
-- =====================================================

-- =====================================================
-- 1. CREATE DEFAULT ROOM
-- =====================================================

INSERT INTO public.arcade_rooms (name, slug, width, height, theme)
VALUES ('Main Office', 'main-office', 50, 40, 'dark_office')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 2. CREATE ENTITY DEFINITIONS
-- =====================================================

-- Desks
INSERT INTO public.arcade_entities (key, name, category, sprite_key, footprint_w, footprint_h, is_interactable, interaction_type, interaction_payload)
VALUES 
  ('desk_basic', 'Basic Desk', 'desk', 'desk_basic', 2, 2, FALSE, NULL, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Interactables (computers/terminals)
INSERT INTO public.arcade_entities (key, name, category, sprite_key, footprint_w, footprint_h, is_interactable, interaction_type, interaction_payload)
VALUES 
  ('pc_tasks', 'Task Terminal', 'interactable', 'pc_tasks', 1, 1, TRUE, 'open_route', '{"route": "/admin/tasks"}'::jsonb),
  ('pc_tickets', 'Tickets Terminal', 'interactable', 'pc_tickets', 1, 1, TRUE, 'open_route', '{"route": "/admin/tickets"}'::jsonb),
  ('pc_services', 'Service Terminal', 'interactable', 'pc_services', 1, 1, TRUE, 'open_route', '{"route": "/admin/services"}'::jsonb),
  ('finance_vault', 'Finance Vault', 'interactable', 'finance_vault', 2, 2, TRUE, 'open_route', '{"route": "/admin/payments"}'::jsonb),
  ('lead_router', 'Lead Router', 'interactable', 'lead_router', 2, 1, TRUE, 'open_route', '{"route": "/admin/leads/engine"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- System/Decor
INSERT INTO public.arcade_entities (key, name, category, sprite_key, footprint_w, footprint_h, is_interactable, interaction_type, interaction_payload)
VALUES 
  ('door_expansion', 'Expansion Door', 'system', 'door_expansion', 1, 2, TRUE, 'open_modal', '{"modal": "unlocks"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 3. CREATE DEFAULT PLACEMENTS (nice office layout)
-- =====================================================

-- Get room_id and entity_ids
DO $$
DECLARE
  v_room_id UUID;
  v_desk_id UUID;
  v_pc_tasks_id UUID;
  v_pc_tickets_id UUID;
  v_pc_services_id UUID;
  v_finance_vault_id UUID;
  v_lead_router_id UUID;
  v_door_id UUID;
BEGIN
  -- Get room ID
  SELECT id INTO v_room_id FROM public.arcade_rooms WHERE slug = 'main-office';
  
  -- Get entity IDs
  SELECT id INTO v_desk_id FROM public.arcade_entities WHERE key = 'desk_basic';
  SELECT id INTO v_pc_tasks_id FROM public.arcade_entities WHERE key = 'pc_tasks';
  SELECT id INTO v_pc_tickets_id FROM public.arcade_entities WHERE key = 'pc_tickets';
  SELECT id INTO v_pc_services_id FROM public.arcade_entities WHERE key = 'pc_services';
  SELECT id INTO v_finance_vault_id FROM public.arcade_entities WHERE key = 'finance_vault';
  SELECT id INTO v_lead_router_id FROM public.arcade_entities WHERE key = 'lead_router';
  SELECT id INTO v_door_id FROM public.arcade_entities WHERE key = 'door_expansion';
  
  -- Only insert if room exists
  IF v_room_id IS NOT NULL THEN
    -- Place desks in a grid (4x3 grid starting at x=5, y=5)
    -- Row 1
    INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_desk_id, 5, 5, 0, 0) ON CONFLICT DO NOTHING;
    INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_desk_id, 8, 5, 0, 0) ON CONFLICT DO NOTHING;
    INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_desk_id, 11, 5, 0, 0) ON CONFLICT DO NOTHING;
    INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_desk_id, 14, 5, 0, 0) ON CONFLICT DO NOTHING;
    
    -- Row 2
    INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_desk_id, 5, 8, 0, 0) ON CONFLICT DO NOTHING;
    INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_desk_id, 8, 8, 0, 0) ON CONFLICT DO NOTHING;
    INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_desk_id, 11, 8, 0, 0) ON CONFLICT DO NOTHING;
    INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_desk_id, 14, 8, 0, 0) ON CONFLICT DO NOTHING;
    
    -- Row 3
    INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_desk_id, 5, 11, 0, 0) ON CONFLICT DO NOTHING;
    INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_desk_id, 8, 11, 0, 0) ON CONFLICT DO NOTHING;
    INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_desk_id, 11, 11, 0, 0) ON CONFLICT DO NOTHING;
    INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_desk_id, 14, 11, 0, 0) ON CONFLICT DO NOTHING;
    
    -- Place interactables along the walls
    -- Task Terminal (left wall)
    IF v_pc_tasks_id IS NOT NULL THEN
      INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_pc_tasks_id, 2, 5, 0, 1) ON CONFLICT DO NOTHING;
    END IF;
    
    -- Tickets Terminal (left wall)
    IF v_pc_tickets_id IS NOT NULL THEN
      INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_pc_tickets_id, 2, 8, 0, 1) ON CONFLICT DO NOTHING;
    END IF;
    
    -- Service Terminal (left wall)
    IF v_pc_services_id IS NOT NULL THEN
      INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_pc_services_id, 2, 11, 0, 1) ON CONFLICT DO NOTHING;
    END IF;
    
    -- Finance Vault (right wall)
    IF v_finance_vault_id IS NOT NULL THEN
      INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_finance_vault_id, 20, 8, 0, 1) ON CONFLICT DO NOTHING;
    END IF;
    
    -- Lead Router (top wall)
    IF v_lead_router_id IS NOT NULL THEN
      INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_lead_router_id, 10, 2, 0, 1) ON CONFLICT DO NOTHING;
    END IF;
    
    -- Expansion Door (bottom wall)
    IF v_door_id IS NOT NULL THEN
      INSERT INTO public.arcade_placements (room_id, entity_id, x, y, rotation, z_index) VALUES (v_room_id, v_door_id, 25, 15, 0, 1) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- =====================================================
-- 4. CREATE DEFAULT UNLOCKS
-- =====================================================

DO $$
DECLARE
  v_room_id UUID;
BEGIN
  SELECT id INTO v_room_id FROM public.arcade_rooms WHERE slug = 'main-office';
  
  IF v_room_id IS NOT NULL THEN
    INSERT INTO public.arcade_unlocks (room_id, unlock_key, is_unlocked, unlocked_at)
    VALUES 
      (v_room_id, 'expansion_north', FALSE, NULL),
      (v_room_id, 'expansion_east', FALSE, NULL),
      (v_room_id, 'decor_pack_01', FALSE, NULL),
      (v_room_id, 'automation_room', FALSE, NULL)
    ON CONFLICT (room_id, unlock_key) DO NOTHING;
  END IF;
END $$;

-- =====================================================
-- 5. INITIALIZE WALLET
-- =====================================================

INSERT INTO public.arcade_wallet (id, currency, balance_cents)
VALUES (1, 'EUR', 0)
ON CONFLICT (id) DO NOTHING;

