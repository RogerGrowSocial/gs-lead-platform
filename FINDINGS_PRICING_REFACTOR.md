# Findings: Pricing Modal Refactor

## Current Implementation

### Files
- **Modal UI**: `views/admin/service-detail.ejs` (lines 692-765)
- **Modal JS**: `public/js/admin/service-detail-modals.js` (lines 582-700)
- **API Endpoint**: `routes/api.js` (PATCH `/api/admin/services/:id`, line 5842)
- **Service Fetch**: `routes/api.js` (GET `/api/admin/services/:id`, line 6048)
- **Frontend Data Load**: `public/js/admin/service-detail.js` (loadServiceData, line 45)

### Current Schema
- **services table**: Has `pricing_mode`, `billing_model`, `base_price_cents`, `base_cost_cents`
- **service_price_tiers table**: Exists with columns: id, service_id, name, description, billing_model, price_cents, cost_cents, unit_label, included_units, overage_price_cents, is_active, sort_order, created_at, updated_at
- **service_audit_log table**: Exists for audit logging

### Current Behavior
1. Modal shows "Prijsmodel" dropdown (Vast/Variabel)
2. Uses `window.serviceData` (cached, not fresh)
3. Saves to `PATCH /api/admin/services/:id` with `pricing_mode`, `billing_model`, `base_price_cents`
4. Full page refresh after save (`reloadServiceData()`)
5. Legacy mapping: `fixed` vs `tiers`/`recurring`/`usage`/`hybrid`

### Issues to Fix
1. ❌ Pricing mode dropdown is confusing (Vast vs Variabel)
2. ❌ No packages list in modal
3. ❌ Uses cached `window.serviceData` instead of fresh fetch
4. ❌ Full page refresh after save
5. ❌ No validation that services must have >= 1 package
6. ❌ `archived_at` column missing from `service_price_tiers`

### Patterns to Reuse
- ✅ `isAdminOrManager` permission check pattern
- ✅ `logServiceAudit` function for audit logging
- ✅ `showNotification` for toasts
- ✅ Modal styling from existing modals
- ✅ Form validation patterns

