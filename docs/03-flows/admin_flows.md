# Admin Flows

**Last Updated:** 2025-01-28

---

## Overview

Admin flows describe the journey of **admins** through the platform.

**User Type:** Admins (role: `ADMIN`, `is_admin = true`)

---

## Lead Management Flow

### Step 1: Lead Creation
1. Admin creates lead manually (`/admin/leads/new`)
2. Enters: name, email, phone, message, industry, location
3. System creates lead with status `new`
4. Lead appears in admin leads list

### Step 2: Lead Assignment
1. Admin views lead (`/admin/leads/:id`)
2. Options:
   - **Auto-assign:** Click "Auto-assign" → AI router selects best partner
   - **Manual assign:** Select partner from dropdown
   - **View recommendations:** See top 5 AI recommendations
3. Lead assigned to partner
4. Partner receives notification

### Step 3: Lead Monitoring
1. Admin views all leads (`/admin/leads`)
2. Filters: status, partner, industry, date range
3. Can reassign leads if needed
4. Can view lead details, activities, notes

---

## AI Router Management Flow

### View Recommendations
1. Admin opens lead detail page
2. Clicks "View Recommendations"
3. System shows top 5 partners with:
   - Score (0-100)
   - Reasons (branch match, region match, performance, etc.)
   - Partner details
4. Admin can assign to any recommended partner

### Auto-Assignment
1. Admin clicks "Auto-assign"
2. System:
   - Gets candidates via `LeadAssignmentService.getCandidates()`
   - Calculates scores
   - Selects best match (score >= threshold)
   - Assigns lead
3. If assignment fails: show error, allow manual assignment

### Configure AI Router Settings
1. Admin navigates to AI Router settings
2. Adjusts weights:
   - Region weight (default: 80)
   - Performance weight (default: 40)
   - Fairness weight (default: 60)
3. Sets auto-assignment threshold (default: 70)
4. Saves settings
5. Settings applied to future assignments

---

## Lead Flow Intelligence Flow

### View Overview (`/admin/leadstroom/overview`)
1. Admin sees:
   - All segments (industry + region)
   - Capacity per segment
   - Targets per segment
   - Actual leads vs targets
   - Gap analysis
2. Can filter by branch, region, date

### Segment Management
1. Admin views segments
2. Can:
   - Activate/deactivate segments
   - View capacity details
   - View target calculations
   - Trigger manual sync

### Target Recalculation
1. Admin can trigger target recalculation
2. System:
   - Recalculates targets for all segments
   - Uses `LeadDemandPlannerService.planAllSegments()`
   - Updates `lead_segment_plans` table
3. Results visible in overview

---

## User Management Flow

### View Users (`/admin/users`)
1. Admin sees list of all users
2. Filters: role, status, search
3. Can view user details

### User Details (`/admin/users/:id`)
1. Admin sees:
   - Profile information
   - Lead history
   - Performance stats
   - Billing information
   - Payment methods
2. Can:
   - Update user info
   - Change role
   - Activate/deactivate user
   - View risk assessment

### Create User
1. Admin creates new user
2. Enters: email, password, company name, role
3. System creates auth user + profile
4. User receives welcome email (if configured)

---

## Campaign Management Flow

### Google Ads Integration
1. Admin connects Google Ads Manager Account (MCC)
2. System syncs partner accounts
3. Admin can:
   - View campaigns per partner
   - Create new campaigns
   - Update budgets
   - Pause/resume campaigns

### Campaign Creation
1. Admin selects partner
2. Chooses segment (industry + region)
3. Sets budget, targeting
4. System creates campaign via Google Ads API
5. Campaign appears in dashboard

### Budget Optimization
1. System calculates targets per segment
2. Admin reviews target vs actual
3. System suggests budget adjustments
4. Admin approves/denies adjustments
5. Budgets updated via Google Ads API

---

## Email Management Flow

### Email Inbox (`/admin/mail`)
1. Admin views email inbox
2. Emails auto-labeled by AI:
   - `lead`: Potential sales lead
   - `newsletter`: Marketing email
   - `customer_request`: Customer inquiry
   - `urgent`: Urgent request
3. Admin can filter by label

### Email Actions
1. **Create Opportunity:**
   - AI suggests creating opportunity from email
   - Admin clicks "Create Opportunity"
   - System creates opportunity with email data
2. **AI Response:**
   - Admin clicks "AI Antwoord"
   - System generates professional response
   - Admin reviews, edits, sends
3. **Manual Reply:**
   - Admin writes reply manually
   - Sends via Mailgun

### Opportunity Management
1. Admin views opportunities (`/admin/opportunities`)
2. AI suggests best sales rep per opportunity
3. Admin assigns opportunity to sales rep
4. Tracks opportunity status

---

## Billing & Payments Flow

### View Payments (`/admin/payments`)
1. Admin sees all payments
2. Filters: user, status, date range
3. Can view payment details

### Payment Processing
1. Admin views pending payments
2. Can:
   - Approve payments
   - Reject payments
   - Refund payments (via Mollie)

### Invoice Management
1. Admin views invoices (SEPA postpaid)
2. Can:
   - Generate invoices manually
   - Send invoices via email
   - Mark as paid
   - Export for accounting

---

## Analytics & Reporting Flow

### Dashboard Overview (`/admin`)
1. Admin sees:
   - Total leads, conversions, revenue
   - Partner performance
   - Campaign performance
   - KPIs and trends
2. Charts and graphs
3. Date range filters

### Performance Reports
1. Admin generates reports:
   - Partner performance
   - Segment performance
   - Campaign ROI
   - Lead quality metrics
2. Exports to CSV/PDF

---

## System Settings Flow

### General Settings
1. Admin configures:
   - Platform name, logo
   - Email templates
   - Notification settings
   - Feature flags

### Integration Settings
1. Admin manages integrations:
   - Google Ads API credentials
   - Mollie API keys
   - OpenAI API key
   - Mailgun settings
   - KVK API settings

---

## Troubleshooting Flow

### Debug Lead Assignment
1. Admin views lead that failed assignment
2. Checks:
   - AI router recommendations
   - Partner capacity
   - Quota/balance
   - Payment method status
3. Manually assigns if needed

### Debug Billing Issues
1. Admin views user billing snapshot
2. Checks:
   - Quota usage
   - Balance (prepaid)
   - Payment method status
   - Invoice history
3. Manually adjusts if needed

### System Logs
1. Admin views system logs
2. Filters: level, module, date range
3. Debugs errors, API calls, activities

---

## Related Documentation

- **User Flows:** `/docs/03-flows/user_flows.md`
- **Product:** `/docs/00-context/product.md`

