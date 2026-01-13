# Pricing Modal Refactor - Deliverables

## Summary
Refactored the pricing modal to enforce a single source of truth: **every service has packages (tiers)**. "Fixed price" is represented as exactly 1 package. Removed confusing pricing-mode logic and legacy mapping hacks.

## Files Changed

### 1. Database Migration
**File**: `supabase/migrations/20260109000000_refactor_pricing_packages.sql`
- Added `archived_at` column to `service_price_tiers` table
- Created `service_pricing_audit` table for detailed pricing change tracking
- Migration script to ensure all services have at least 1 package
- Added validation function `check_service_has_active_package()`
- RLS policies for pricing audit table

### 2. API Endpoint
**File**: `routes/api.js`
- **New endpoint**: `PATCH /api/admin/services/:id/pricing`
- Accepts: `{ billing_cycle, packages: [...] }`
- Server-side validation:
  - Role guard (admin/manager only)
  - Validates billing_cycle: 'one_time' | 'monthly' | 'yearly'
  - Validates packages array (min 1, at least 1 active)
  - Validates each package (name required, price >= 0)
- Upserts packages (create new, update existing)
- Archives removed packages (sets `archived_at`)
- Writes to `service_pricing_audit` and `service_audit_log`
- Returns updated service + packages

### 3. Modal UI
**File**: `views/admin/service-detail.ejs`
- **Removed**: Pricing mode dropdown ("Vast" / "Variabel")
- **Added**: Packages list editor with:
  - Section A: Facturering (billing cycle select)
  - Section B: Pakketten (dynamic list with add/remove)
  - Section C: Preview (read-only preview of active packages)
- Each package row has: name, description, price, cost, unit label, active toggle
- Validation UI: inline errors, preview updates in real-time

### 4. Frontend JavaScript
**File**: `public/js/admin/service-detail-modals.js`
- **New functions**:
  - `openEditPricingModal()` - Fetches fresh data from API (no cached `window.serviceData`)
  - `openPricingModal(service, packages)` - Opens modal with data
  - `closePricingModal()` - Closes modal
  - `renderPackagesList()` - Renders package rows dynamically
  - `addPackageRow()` - Adds new package
  - `removePackage(index)` - Removes package (with validation)
  - `updatePackageFromRow(row)` - Updates state from DOM
  - `updatePreview()` - Updates preview section
  - `savePricing()` - Saves to API with optimistic UI
- **Backward compatibility**: `openEditPricingModeModal()` redirects to new function
- **No page refresh**: Uses `window.loadServiceData()` to refresh data

### 5. Button Update
**File**: `views/admin/service-detail.ejs`
- Updated button `onclick` from `openEditPricingModeModal()` to `openEditPricingModal()`

## Backward Compatibility

### Legacy `pricing_mode` Handling
- **Read**: Existing services with `pricing_mode` still work (read-only)
- **Write**: New endpoint does NOT write `pricing_mode` field
- **Migration**: All services without packages get a default "Standaard" package created
- **Display**: Old pricing_mode values are ignored; packages are the source of truth

### Function Name Mapping
- `openEditPricingModeModal()` → redirects to `openEditPricingModal()`
- `closePricingModeModal()` → redirects to `closePricingModal()`

## Database Schema Changes

### `service_price_tiers` (Extended)
```sql
ALTER TABLE service_price_tiers
  ADD COLUMN archived_at TIMESTAMPTZ NULL;
```

### `service_pricing_audit` (New)
```sql
CREATE TABLE service_pricing_audit (
  id UUID PRIMARY KEY,
  service_id UUID REFERENCES services(id),
  actor_user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API Contract

### Request
```json
PATCH /api/admin/services/:id/pricing
{
  "billing_cycle": "one_time" | "monthly" | "yearly",
  "packages": [
    {
      "id": "uuid" | undefined,  // undefined = new package
      "name": "string",
      "description": "string" | null,
      "price_cents": number,
      "cost_cents": number,
      "unit_label": "string" | null,
      "is_active": boolean,
      "sort_order": number
    }
  ]
}
```

### Response
```json
{
  "success": true,
  "data": {
    "service": { ... },
    "packages": [ ... ]
  },
  "message": "Prijzen succesvol bijgewerkt"
}
```

## Validation Rules

### Server-Side
1. ✅ Role guard: Admin/Manager only
2. ✅ `billing_cycle`: Must be 'one_time', 'monthly', or 'yearly'
3. ✅ `packages`: Array, length >= 1
4. ✅ At least 1 package must have `is_active = true`
5. ✅ Each package: `name` required (non-empty string)
6. ✅ Each package: `price_cents` >= 0 (integer)
7. ✅ Each package: `cost_cents` >= 0 (integer, optional, defaults to 0)

### Client-Side
1. ✅ Same validations as server-side
2. ✅ Cannot remove last package
3. ✅ Cannot archive last active package
4. ✅ Real-time preview updates
5. ✅ Inline error messages

## QA Checklist

### Manual Testing
- [ ] Open pricing modal on service detail page
- [ ] Verify fresh data is fetched (not cached)
- [ ] Add new package
- [ ] Edit existing package
- [ ] Remove package (should fail if last one)
- [ ] Archive package (should fail if last active)
- [ ] Change billing cycle
- [ ] Save and verify no page refresh
- [ ] Verify data refreshes in background
- [ ] Verify toast notification appears
- [ ] Test as non-admin (should not see edit button)
- [ ] Test validation errors (empty name, negative price)
- [ ] Verify preview updates in real-time

### Edge Cases
- [ ] Service with no packages → auto-creates "Standaard" package
- [ ] Service with existing packages → loads correctly
- [ ] Multiple packages → all display correctly
- [ ] Archived packages → not shown in modal
- [ ] Network error → shows error, re-enables form

### Backward Compatibility
- [ ] Old `openEditPricingModeModal()` calls still work
- [ ] Services without packages get default package on first edit
- [ ] Existing packages are preserved

## Migration Steps

1. **Run database migration**:
   ```sql
   -- Run: supabase/migrations/20260109000000_refactor_pricing_packages.sql
   ```

2. **Deploy code changes**:
   - API endpoint: `routes/api.js`
   - Modal UI: `views/admin/service-detail.ejs`
   - Frontend JS: `public/js/admin/service-detail-modals.js`

3. **Verify migration**:
   - Check that all services have at least 1 package
   - Verify `archived_at` column exists on `service_price_tiers`
   - Verify `service_pricing_audit` table exists

4. **Test**:
   - Open service detail page
   - Click "Bewerken" on pricing section
   - Verify packages list appears
   - Add/edit/remove packages
   - Save and verify no errors

## Notes

- **No breaking changes**: Old API endpoints still work, but pricing modal uses new endpoint
- **Audit logging**: All pricing changes are logged to both `service_pricing_audit` and `service_audit_log`
- **Performance**: Modal fetches fresh data on open (no stale cache issues)
- **UX**: Optimistic UI updates, no full page refresh, smooth transitions
- **Future**: Can extend packages with more fields (tiers, addons, etc.) without changing core structure

