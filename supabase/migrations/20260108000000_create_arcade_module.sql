-- =====================================================
-- ARCADE MODULE - Complete Migration
-- =====================================================
-- Migration: 20260108000000_create_arcade_module.sql
-- Purpose: Admin-only internal command center with game-like visualization
-- =====================================================

-- =====================================================
-- 1. ARCADE ROOMS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.arcade_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  theme TEXT NOT NULL DEFAULT 'dark_office',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arcade_rooms_slug ON public.arcade_rooms(slug);

-- =====================================================
-- 2. ARCADE ENTITIES (catalog: desks, computers, portals, decor)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.arcade_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('desk', 'interactable', 'decor', 'system')),
  sprite_key TEXT NOT NULL,
  footprint_w INTEGER NOT NULL DEFAULT 1,
  footprint_h INTEGER NOT NULL DEFAULT 1,
  is_interactable BOOLEAN NOT NULL DEFAULT FALSE,
  interaction_type TEXT CHECK (interaction_type IN ('open_route', 'open_modal', 'open_dashboard')),
  interaction_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arcade_entities_key ON public.arcade_entities(key);
CREATE INDEX IF NOT EXISTS idx_arcade_entities_category ON public.arcade_entities(category);
CREATE INDEX IF NOT EXISTS idx_arcade_entities_interactable ON public.arcade_entities(is_interactable) WHERE is_interactable = TRUE;

-- =====================================================
-- 3. ARCADE PLACEMENTS (room layout)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.arcade_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.arcade_rooms(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.arcade_entities(id) ON DELETE CASCADE,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  rotation INTEGER NOT NULL DEFAULT 0,
  z_index INTEGER NOT NULL DEFAULT 0,
  placed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arcade_placements_room_id ON public.arcade_placements(room_id);
CREATE INDEX IF NOT EXISTS idx_arcade_placements_entity_id ON public.arcade_placements(entity_id);
CREATE INDEX IF NOT EXISTS idx_arcade_placements_position ON public.arcade_placements(room_id, x, y);

-- Note: Collision detection is handled in application logic, not at the database level
-- Multiple entities can share the same position (e.g., decor on top of desks)

-- =====================================================
-- 4. ARCADE EMPLOYEE SEATS (mapping employees -> desk spot)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.arcade_employee_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.arcade_rooms(id) ON DELETE CASCADE,
  seat_x INTEGER NOT NULL,
  seat_y INTEGER NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_profile_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arcade_employee_seats_room_id ON public.arcade_employee_seats(room_id);
CREATE INDEX IF NOT EXISTS idx_arcade_employee_seats_employee ON public.arcade_employee_seats(employee_profile_id);
CREATE INDEX IF NOT EXISTS idx_arcade_employee_seats_position ON public.arcade_employee_seats(room_id, seat_x, seat_y);

-- =====================================================
-- 5. ARCADE UNLOCKS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.arcade_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.arcade_rooms(id) ON DELETE CASCADE,
  unlock_key TEXT NOT NULL,
  is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  UNIQUE(room_id, unlock_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arcade_unlocks_room_id ON public.arcade_unlocks(room_id);
CREATE INDEX IF NOT EXISTS idx_arcade_unlocks_key ON public.arcade_unlocks(unlock_key);

-- =====================================================
-- 6. ARCADE WALLET (currency)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.arcade_wallet (
  id INTEGER PRIMARY KEY DEFAULT 1,
  currency TEXT NOT NULL DEFAULT 'EUR',
  balance_cents BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT arcade_wallet_single_row CHECK (id = 1)
);

-- =====================================================
-- 7. ARCADE TRANSACTIONS (audit)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.arcade_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'sync')),
  amount_cents BIGINT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_arcade_transactions_type ON public.arcade_transactions(type);
CREATE INDEX IF NOT EXISTS idx_arcade_transactions_created_at ON public.arcade_transactions(created_at DESC);

-- =====================================================
-- 8. TRIGGERS
-- =====================================================

-- Updated_at trigger for arcade_placements
CREATE OR REPLACE FUNCTION update_arcade_placements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_arcade_placements_updated_at
  BEFORE UPDATE ON public.arcade_placements
  FOR EACH ROW
  EXECUTE FUNCTION update_arcade_placements_updated_at();

-- Updated_at trigger for arcade_wallet
CREATE OR REPLACE FUNCTION update_arcade_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_arcade_wallet_updated_at
  BEFORE UPDATE ON public.arcade_wallet
  FOR EACH ROW
  EXECUTE FUNCTION update_arcade_wallet_updated_at();

-- =====================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.arcade_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_employee_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arcade_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admin/Manager full access, employees no access
-- Note: These policies check is_admin flag or manager role via profiles table

-- Arcade Rooms: Admin/Manager can read/write
CREATE POLICY "arcade_rooms_admin_manager_all" ON public.arcade_rooms
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = TRUE OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND LOWER(roles.name) LIKE '%manager%'
      ))
    )
  );

-- Arcade Entities: Admin/Manager can read/write
CREATE POLICY "arcade_entities_admin_manager_all" ON public.arcade_entities
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = TRUE OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND LOWER(roles.name) LIKE '%manager%'
      ))
    )
  );

-- Arcade Placements: Admin/Manager can read/write
CREATE POLICY "arcade_placements_admin_manager_all" ON public.arcade_placements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = TRUE OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND LOWER(roles.name) LIKE '%manager%'
      ))
    )
  );

-- Arcade Employee Seats: Admin/Manager can read/write
CREATE POLICY "arcade_employee_seats_admin_manager_all" ON public.arcade_employee_seats
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = TRUE OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND LOWER(roles.name) LIKE '%manager%'
      ))
    )
  );

-- Arcade Unlocks: Admin/Manager can read/write
CREATE POLICY "arcade_unlocks_admin_manager_all" ON public.arcade_unlocks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = TRUE OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND LOWER(roles.name) LIKE '%manager%'
      ))
    )
  );

-- Arcade Wallet: Admin/Manager can read/write
CREATE POLICY "arcade_wallet_admin_manager_all" ON public.arcade_wallet
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = TRUE OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND LOWER(roles.name) LIKE '%manager%'
      ))
    )
  );

-- Arcade Transactions: Admin/Manager can read/write
CREATE POLICY "arcade_transactions_admin_manager_all" ON public.arcade_transactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.is_admin = TRUE OR EXISTS (
        SELECT 1 FROM public.roles
        WHERE roles.id = profiles.role_id
        AND LOWER(roles.name) LIKE '%manager%'
      ))
    )
  );

