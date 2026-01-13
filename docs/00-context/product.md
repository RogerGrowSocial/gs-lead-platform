# Product Overview

**Platform:** GS Lead Platform  
**Company:** GrowSocial  
**Purpose:** B2B lead generation and routing platform

---

## Core Value Proposition

GrowSocial operates as a platform/agency that:
1. **Generates leads** for local service providers (painters, roofers, electricians, etc.)
2. **Routes leads intelligently** using AI to match leads with the best partner
3. **Manages marketing** via Google Ads Manager Account (MCC) across multiple partner accounts
4. **Optimizes spend** automatically based on real-time lead demand and supply

---

## User Types

### Partners (Service Providers)
- **Role:** `USER` (default) or custom roles
- **Journey:**
  1. Sign up → Onboarding wizard
  2. Complete profile (company, branches, regions, capacity)
  3. Add payment method (SEPA or Card)
  4. Set lead preferences (industries, locations, budget)
  5. Receive leads via AI routing
  6. Accept/reject leads → billing
  7. View dashboard with stats, performance, billing

### Admins
- **Role:** `ADMIN`
- **Capabilities:**
  - Manage all users, leads, opportunities
  - Configure AI router settings
  - View analytics and KPIs
  - Manage Google Ads campaigns
  - Access billing and payments
  - Email inbox with AI labeling

---

## Key Features

### 1. AI Lead Routing
- **What:** Automatically assigns leads to best partner
- **How:** Scores partners on branch match, region match, performance, capacity, wait time
- **Where:** `services/leadAssignmentService.js`
- **UI:** Admin lead detail page with recommendations drawer

### 2. Capacity-Based Segment Management
- **What:** Segments created only where paying partners have capacity
- **How:** Syncs from `get_branch_region_capacity_combos()` function
- **Rule:** Only partners with active payment method create capacity
- **Where:** `services/segmentSyncService.js`

### 3. Multi-Site Landing Pages
- **What:** Platform-first landing pages (not partner-specific)
- **How:** AI-generated content per segment + page type (main, cost, quote, spoed)
- **Principle:** Consumer never chooses partner; AI router assigns exactly one
- **Where:** `services/partnerLandingPageService.js`, `services/siteService.js`

### 4. Google Ads Integration
- **What:** Automated campaign management via Manager Account
- **How:** Creates/updates campaigns, adjusts budgets based on targets
- **Where:** `services/googleAdsService.js`
- **Status:** Active, managing multiple partner accounts

### 5. Billing System
- **SEPA (Postpaid):** Monthly invoicing at end of month
- **Card (Prepaid):** Balance deducted immediately per lead
- **Quota:** Monthly lead limits per subscription
- **Where:** Supabase functions (`get_billing_snapshot`, `can_allocate_lead`)

### 6. AI Email Features
- **Labeling:** Auto-labels emails (lead, newsletter, customer_request, etc.)
- **Opportunity Detection:** Suggests creating opportunity from email
- **Response Generation:** Generates professional email replies
- **Where:** `services/aiMailService.js`

### 7. Form Builder & Analytics
- **What:** Custom form builder for partners
- **Features:** Analytics, optimization suggestions, benchmarks
- **Where:** `routes/forms.js`, form-related migrations

### 8. Risk Assessment
- **What:** Evaluates partner risk level
- **How:** Based on KVK verification, payment history, behavior
- **Where:** `services/userRiskAssessmentService.js`

---

## Business Rules

### Hard Rules (Never Violate)
1. **Payment Method Required:** Partners without active payment method = 0 capacity, 0 leads
2. **No Segment Deletion:** Segments are deactivated (`is_active = false`), never deleted
3. **Available Capacity for Targets:** Targets = (total_capacity - open_leads) * 0.8
4. **Platform-First LPs:** Landing pages are platform-owned, not partner-owned
5. **One Partner Per Lead:** AI router assigns exactly one partner per lead

### Soft Rules (Can Be Overridden)
- Auto-assignment threshold: Default 70 (configurable)
- Target utilization: Default 80% (configurable)
- Minimum target: 5 leads (if capacity > 0)

---

## Key Metrics

- **Lead Conversion Rate:** Accepted leads / Total leads assigned
- **Average Response Time:** Time from assignment to partner response
- **Capacity Utilization:** Open leads / Total capacity
- **Target Achievement:** Actual leads / Target leads per segment
- **Revenue:** Lead prices * Accepted leads

---

## Future Roadmap

- [ ] Partner marketing campaigns (landing pages, Google Ads)
- [ ] Advanced form optimization with AI
- [ ] Multi-channel marketing (Meta Ads, SEO)
- [ ] Partner dashboard enhancements
- [ ] Advanced analytics and reporting

---

## Related Documentation

- **Architecture:** `/docs/00-context/architecture.md`
- **Flows:** `/docs/03-flows/user_flows.md`, `/docs/03-flows/admin_flows.md`
- **API:** `/docs/02-api/endpoints.md`

