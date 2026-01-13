# Arcade Mode Implementation

## Overview

Arcade Mode is an admin-only internal command center that visualizes and drives real operations through a game-like interface. It provides a "War Room" view of the platform's operational state.

## Features Implemented

### 1. Database Schema
- **arcade_rooms**: Room definitions (width, height, theme)
- **arcade_entities**: Catalog of objects (desks, computers, portals, decor)
- **arcade_placements**: Room layout (positions of entities)
- **arcade_employee_seats**: Mapping of employees to desk positions
- **arcade_unlocks**: Unlockable features/rooms
- **arcade_wallet**: Currency system
- **arcade_transactions**: Audit trail for wallet transactions

### 2. API Endpoints

All endpoints require admin/manager access via `isManagerOrAdmin` middleware:

- `GET /api/admin/arcade/state` - Get full arcade state (room, placements, seats, unlocks, wallet, metrics)
- `POST /api/admin/arcade/seats/sync` - Sync employee seats (auto-assigns seats to active employees)
- `POST /api/admin/arcade/placements` - Create new placement
- `PATCH /api/admin/arcade/placements/:id` - Update placement (move/rotate)
- `POST /api/admin/arcade/unlocks/:unlockKey/purchase` - Purchase unlock with wallet
- `POST /api/admin/arcade/wallet/sync` - Sync wallet to real revenue (30d)

### 3. Real Data Integration

Arcade Mode displays live operational metrics:
- **employees_total**: Count of active employees (excludes customers/partners)
- **tasks_open**: Open/in-progress tasks
- **tasks_overdue**: Overdue tasks
- **tickets_open**: Open tickets
- **tickets_urgent**: Urgent tickets
- **revenue_30d**: Revenue from last 30 days
- **profit_30d**: Profit from last 30 days
- **payments_pending**: Pending payments
- **invoices_overdue**: Overdue invoices

### 4. User Interface

- **Entry Point**: "Arcade Mode" item in admin user dropdown (admin/manager only)
- **Route**: `/admin/arcade` (protected by `isManagerOrAdmin`)
- **Game Engine**: Phaser 3 (lazy-loaded via CDN)
- **HUD Overlay**:
  - Top-left: Ops status badges (urgent tickets, overdue tasks, pending payments)
  - Top-center: "Arcade Mode" title
  - Top-right: Wallet balance + Sync/Exit buttons

### 5. Game Features

- **Movement**: WASD or Arrow keys
- **Interactables**: Click on terminals/computers to navigate to admin routes:
  - Task Terminal → `/admin/tasks`
  - Tickets Terminal → `/admin/tickets`
  - Service Terminal → `/admin/services`
  - Finance Vault → `/admin/payments`
  - Lead Router → `/admin/leads/engine`
- **Employee Seats**: Visual representation of employees at desks
- **Grid-based Layout**: 32px grid system

## Database Migrations

1. `20260108000000_create_arcade_module.sql` - Creates all arcade tables, indexes, triggers, and RLS policies
2. `20260108000001_seed_arcade.sql` - Seeds default room, entities, placements, and unlocks

## How to Run

1. **Run Migrations**:
   ```bash
   # Apply migrations to Supabase
   # The migrations will create tables, indexes, RLS policies, and seed data
   ```

2. **Access Arcade Mode**:
   - Log in as admin or manager
   - Click user dropdown in top-right
   - Select "Arcade Mode"
   - Or navigate directly to `/admin/arcade`

3. **Sync Employee Seats** (optional):
   - Use the API endpoint: `POST /api/admin/arcade/seats/sync`
   - This auto-assigns seats to active employees

4. **Sync Wallet** (optional):
   - Click "Sync" button in HUD
   - Or use API: `POST /api/admin/arcade/wallet/sync`
   - Syncs wallet balance to 30-day revenue

## Security

- **RLS Policies**: All arcade tables have RLS enabled
- **Access Control**: Only admins and managers can access (checked via `isManagerOrAdmin` middleware)
- **Server-side Validation**: All API endpoints validate permissions server-side
- **Audit Logging**: All mutations log to `activities` table via `ActivityService`

## Future Enhancements

- Edit mode for room layout (drag & drop)
- Sprite assets (currently using colored rectangles)
- Collision detection for player movement
- Employee status indicators (red/yellow/green based on workload)
- Unlock system with KPI gates
- Multiple rooms/expansions
- Real-time updates via WebSocket

## Technical Notes

- Phaser 3 is loaded dynamically (no bundle impact on other pages)
- Game uses 32px grid system for positioning
- All state is stored in Supabase (source of truth)
- HUD uses existing design system colors and patterns
- Metrics are calculated server-side from real database tables

## Files Created/Modified

### Created:
- `supabase/migrations/20260108000000_create_arcade_module.sql`
- `supabase/migrations/20260108000001_seed_arcade.sql`
- `views/admin/arcade.ejs`
- `ARCADE_MODE_IMPLEMENTATION.md`

### Modified:
- `routes/api.js` - Added arcade API endpoints
- `routes/admin.js` - Added `/admin/arcade` route
- `views/layouts/admin.ejs` - Added "Arcade Mode" dropdown item

