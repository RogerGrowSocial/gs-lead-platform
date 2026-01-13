# Tickets Module Implementation - Complete

## Overview

A comprehensive internal ticket handling system has been implemented for the GrowSocial Admin platform. The system matches the exact UI/UX, styling, and patterns used across the platform, especially `/admin/employees/[id]`, `/admin/payments`, and `/admin/services`.

## What Was Implemented

### 1. Database Schema (Migration)
**File:** `supabase/migrations/20260107000000_create_tickets_module.sql`

- **Extended `tickets` table** (canonical) with:
  - Core fields: `ticket_number`, `subject`, `description`
  - Status: `new`, `open`, `waiting_on_customer`, `waiting_on_internal`, `resolved`, `closed`
  - Priority: `low`, `normal`, `high`, `urgent`
  - Categorization: `category`, `tags[]`, `source`
  - Requester info: `requester_email`, `requester_name`
  - Relationships: `customer_id`, `user_id`, `assignee_id`, `created_by`
  - SLA: `due_at`, `first_response_at`, `resolved_at`, `closed_at`, `last_activity_at`
  - Internal flags: `is_internal_only`, `escalation_level`

- **Created supporting tables:**
  - `ticket_comments` - Comments and internal notes
  - `ticket_attachments` - File attachments
  - `ticket_audit_log` - Complete audit trail
  - `ticket_watchers` - User watch list (optional feature)

- **Triggers:**
  - Auto-update `updated_at` on ticket changes
  - Auto-update `last_activity_at` on comment/attachment changes
  - Auto-set `first_response_at`, `resolved_at`, `closed_at` based on status
  - Auto-generate `ticket_number` on insert

- **RLS Policies:**
  - Admin/Manager: Full access
  - Employees: Access if assigned, watching, or has support role
  - Internal comments hidden from unauthorized roles

### 2. API Endpoints
**File:** `routes/admin.js` (added comprehensive endpoints)

- `GET /api/admin/tickets` - List tickets with filters, pagination, sorting
- `GET /api/admin/tickets/:id` - Get single ticket with comments, attachments, audit log
- `POST /api/admin/tickets` - Create ticket (admin only)
- `PATCH /api/admin/tickets/:id` - Update ticket fields
- `POST /api/admin/tickets/:id/assign` - Assign/unassign ticket
- `POST /api/admin/tickets/:id/status` - Change status with validation
- `POST /api/admin/tickets/:id/comment` - Add comment (supports internal notes)
- `POST /api/admin/tickets/:id/attachment` - Register attachment
- `POST /api/admin/tickets/bulk` - Bulk actions (assign, status, priority)

All endpoints include:
- Permission checks (admin/employee roles)
- Audit logging for changes
- Role-based data shaping (internal comments hidden)

### 3. Frontend Pages

#### List Page: `/admin/tickets`
**Files:**
- `views/admin/tickets.ejs` - Updated with new status options
- `public/js/admin/tickets.js` - Updated to use new API with server-side filtering

**Features:**
- KPI cards: Total, Open, In Progress, Urgent
- Filters: Search, Status, Priority, Assignee, "Only mine"
- Table with: Ticket ID, Subject, Customer, Status, Priority, Assignee, Last Activity
- Row click opens detail page
- Actions menu: View, Edit, Delete

#### Detail Page: `/admin/tickets/:id`
**Files:**
- `views/admin/ticket-detail.ejs` - Complete detail page with tabs
- `public/js/admin/ticket-detail.js` - Full interactivity

**Features:**
- Header with subject, status badge, priority badge, quick actions
- KPI cards: Status & Age, SLA, Comment Count, Last Activity
- **Tabs:**
  1. **Overzicht** - Description, tags, timeline widget
  2. **Reacties** - Thread-style comments, toggle internal notes, add comment
  3. **Bijlagen** - Attachment list, upload functionality
  4. **Activity** (admin only) - Complete audit log
- Right sidebar: Quick actions, ticket info, watchers

### 4. Seed Data
**File:** `supabase/migrations/20260107000001_seed_tickets.sql`

Creates 5 sample tickets:
1. Open, High Priority - Payment issue with comments
2. Waiting on Customer, Normal - Lead quality question
3. Resolved, Low Priority - Account settings issue
4. New, Urgent, Unassigned - System crash
5. Closed - Billing question

Includes comments (internal and external) and audit log entries.

## How to Run

### Step 1: Run Migrations

```bash
# Option 1: Using Supabase CLI
supabase migration up

# Option 2: Run SQL directly in Supabase SQL Editor
# Execute in order:
# 1. supabase/migrations/20260107000000_create_tickets_module.sql
# 2. supabase/migrations/20260107000001_seed_tickets.sql
```

### Step 2: Verify Tables

Run the inspection queries from `supabase/inspect_tickets_schema.sql` to verify:
- Tables created: `tickets`, `ticket_comments`, `ticket_attachments`, `ticket_audit_log`, `ticket_watchers`
- Indexes created
- RLS policies enabled
- Triggers active

### Step 3: Access the UI

1. Navigate to `/admin/tickets` in your browser
2. You should see:
   - KPI cards at the top
   - Filters bar
   - Table with seed tickets (if seed data ran successfully)
3. Click any ticket row to open the detail page
4. Test:
   - Status changes
   - Adding comments (internal and external)
   - Assignment changes
   - Priority changes

## Key Features

### Status Workflow
- `new` → `open` → `waiting_on_customer` / `waiting_on_internal` / `resolved`
- `resolved` → `closed` or `open` (reopen)
- `closed` → `open` (reopen)

### Internal Notes
- Comments can be marked as `is_internal`
- Only visible to admins and assigned employees with support role
- Toggle in detail page: "Toon interne notities"

### Audit Trail
- Every status/priority/assignment change is logged
- Shows: actor, action, field, old value, new value, timestamp
- Admin-only visibility

### SLA Tracking
- `due_at` field for deadlines
- `first_response_at` auto-set on first status change
- `resolved_at` / `closed_at` auto-set on status transitions
- Visual indicators for overdue tickets

## API Usage Examples

### List Tickets with Filters
```javascript
GET /admin/api/admin/tickets?status=open&priority=high&page=1&pageSize=20&sort=-last_activity_at
```

### Get Single Ticket
```javascript
GET /admin/api/admin/tickets/:id
// Returns: ticket, comments, attachments, audit_log, watchers
```

### Add Comment
```javascript
POST /admin/api/admin/tickets/:id/comment
{
  "body": "This is a comment",
  "is_internal": false
}
```

### Change Status
```javascript
POST /admin/api/admin/tickets/:id/status
{
  "status": "resolved"
}
```

### Bulk Actions
```javascript
POST /admin/api/admin/tickets/bulk
{
  "ticket_ids": ["uuid1", "uuid2"],
  "action": "assign",
  "value": "employee-uuid"
}
```

## Permissions

- **Admin/Manager**: Full access to all tickets, can see internal comments
- **Employees**: 
  - Can view tickets if: assigned to them, watching, or have support role
  - Can update tickets if: assigned to them or have support role
  - Cannot see internal comments unless assigned or have support role

## Next Steps (Future Enhancements)

1. **Ticket Submission Portal** - Customer-facing ticket creation (explicitly excluded for now)
2. **Email Integration** - Auto-create tickets from emails
3. **Notifications** - Notify watchers on updates
4. **Macros** - Predefined response templates
5. **Saved Views** - User-specific filter presets
6. **SLA Policies** - Automatic due date calculation based on priority

## Files Created/Modified

### Created:
- `supabase/migrations/20260107000000_create_tickets_module.sql`
- `supabase/migrations/20260107000001_seed_tickets.sql`
- `supabase/inspect_tickets_schema.sql`
- `views/admin/ticket-detail.ejs`
- `public/js/admin/ticket-detail.js`
- `TICKETS_MODULE_IMPLEMENTATION.md`

### Modified:
- `routes/admin.js` - Added comprehensive API endpoints and detail route
- `views/admin/tickets.ejs` - Updated status filter options
- `public/js/admin/tickets.js` - Updated to use new API with server-side filtering

## Testing Checklist

- [ ] Run migrations successfully
- [ ] Seed data creates 5 tickets
- [ ] `/admin/tickets` page loads with KPI cards
- [ ] Filters work (search, status, priority, assignee)
- [ ] Clicking ticket row opens detail page
- [ ] Detail page shows all tabs
- [ ] Adding comment works
- [ ] Internal comments toggle works
- [ ] Status change works and is logged
- [ ] Assignment change works
- [ ] Priority change works
- [ ] Activity log shows changes (admin only)
- [ ] Permissions work (employee can only see assigned tickets)

## Notes

- The sidebar already has a "Tickets" menu item pointing to `/admin/tickets`
- The system uses `tickets` as the canonical table (not `support_tickets`)
- All styling matches existing platform patterns
- All text is in Dutch (matching platform language)
- Empty states are handled gracefully
- Error handling is consistent with platform patterns

