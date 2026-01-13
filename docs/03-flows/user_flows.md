# User Flows

**Last Updated:** 2025-01-28

---

## Overview

User flows describe the journey of **partners** (service providers) through the platform.

**User Type:** Partners (role: `USER`)

---

## Onboarding Flow

### Step 1: Sign Up
1. User visits signup page
2. Enters: email, password, company name
3. System creates Supabase auth user
4. Database trigger creates `profiles` record
5. User receives email verification (if enabled)
6. Redirect to onboarding wizard

### Step 2: Onboarding Wizard
1. **Step 1:** Personal info (first name, last name, phone)
2. **Step 2:** Company details (address, KVK number, VAT number)
3. **Step 3:** Lead preferences (industries, locations, budget)
4. User can skip steps (completes later)
5. Progress saved after each step

### Step 3: Payment Setup
1. User navigates to payment settings
2. Chooses payment method:
   - **SEPA:** Enter bank details, verify
   - **Card:** Enter card details via Mollie
3. Payment method status: `pending` → `active` (after verification)
4. **Critical:** Without active payment method, user has 0 capacity

### Step 4: Capacity Setup
1. User sets `max_open_leads` (slider or input)
2. System syncs segments based on capacity
3. Segments created/activated for (branch, region) combos
4. User is now ready to receive leads

---

## Lead Receiving Flow

### Step 1: Lead Assignment
1. Lead created (via public form or admin)
2. AI router scores partners (if `routing_mode = 'ai_segment_routing'`)
3. Best partner selected based on score
4. Lead assigned to partner (`user_id` set)
5. Partner receives notification (email, in-app)

### Step 2: Lead Review
1. Partner views lead in dashboard (`/dashboard/leads`)
2. Sees: name, contact, message, industry, location, price
3. Can view lead details (`/dashboard/leads/:id`)

### Step 3: Lead Decision
1. Partner accepts or rejects lead
2. **Accept:**
   - Status → `accepted`
   - Billing triggered (quota/balance check)
   - Lead price deducted (if prepaid) or tracked (if postpaid)
   - `open_leads_count` incremented
3. **Reject:**
   - Status → `rejected`
   - `open_leads_count` decremented (if was accepted)
   - Lead available for reassignment (if configured)

### Step 4: Lead Management
1. Partner manages accepted leads
2. Can add notes, activities
3. Can update status: `in_progress`, `completed`, `closed`
4. When closed: `open_leads_count` decremented

---

## Billing Flow

### Prepaid (Card) Flow
1. User adds card via Mollie
2. Balance stored in `profiles.balance`
3. On lead acceptance:
   - System checks: `balance >= lead_price`
   - If sufficient: deduct balance, assign lead
   - If insufficient: reject assignment, show error
4. User can top up balance via payment

### Postpaid (SEPA) Flow
1. User adds SEPA bank details
2. SEPA verified (manual or automatic)
3. On lead acceptance:
   - Usage tracked in `v_monthly_lead_usage`
   - No immediate charge
4. End of month:
   - Invoice generated
   - Total: `approved_amount` for the month
   - Invoice sent via email
   - Payment processed via SEPA

### Quota Management
1. User has monthly quota (`subscriptions.leads_per_month`)
2. System checks quota before assignment
3. If quota reached: `can_allocate_lead()` returns `'QUOTA_REACHED'`
4. User can increase quota (upgrade subscription)

---

## Dashboard Flow

### Main Dashboard (`/dashboard`)
1. User sees:
   - Lead statistics (total, accepted, rejected, open)
   - Performance metrics (conversion rate, response time)
   - Recent leads
   - Billing snapshot (quota, usage, balance)
2. Charts and graphs for trends

### Leads Page (`/dashboard/leads`)
1. List of assigned leads
2. Filters: status, industry, date range
3. Search functionality
4. Click lead → detail page

### Lead Detail (`/dashboard/leads/:id`)
1. Full lead information
2. Contact details
3. Status actions (accept/reject/close)
4. Activity log
5. Notes

### Payments Page (`/dashboard/payments`)
1. Payment history
2. Payment methods
3. Invoices (for SEPA)
4. Balance (for prepaid)
5. Add payment method

---

## Settings Flow

### Profile Settings
1. Update personal info
2. Update company details
3. Update lead preferences (industries, locations, budget)
4. Save changes

### Capacity Settings
1. Update `max_open_leads` (slider)
2. System recalculates targets for affected segments
3. Segments sync if capacity changes significantly

### Payment Settings
1. View current payment methods
2. Add new payment method
3. Set default payment method
4. Remove payment method (if no active leads)

---

## Error Flows

### Insufficient Balance
1. User tries to accept lead
2. System checks balance
3. If insufficient: show error, redirect to payment page
4. User adds funds, retries

### Quota Reached
1. User tries to accept lead
2. System checks quota
3. If quota reached: show error, suggest upgrade
4. User upgrades subscription, retries

### Payment Method Expired
1. Payment method status → `failed` or `inactive`
2. User capacity → 0
3. User receives notification
4. User updates payment method
5. Capacity restored after verification

---

## Related Documentation

- **Admin Flows:** `/docs/03-flows/admin_flows.md`
- **Product:** `/docs/00-context/product.md`

