# Project Snapshot

**Last Updated:** 2025-12-31  
**Status:** Active Development  
**Version:** 1.0

---

## What Is This Platform?

**GS Lead Platform** is a B2B lead generation platform for GrowSocial that:
- Connects local service providers (painters, roofers, electricians, etc.) with potential customers
- Automatically routes leads to appropriate partners based on AI-powered matching
- Manages Google Ads campaigns via Manager Account (MCC) for multiple partner accounts
- Optimizes marketing spend based on real-time lead demand and supply
- Provides billing, subscription management, and performance analytics

**Business Model:** Platform/agency model where GrowSocial manages multiple Google Ads accounts and generates leads for different industry segments and geographic regions.

---

## Current State (Week of 2025-12-31)

### Focus Areas
- ✅ Multi-site landing page system (platform-first, not partner-first)
- ✅ AI Lead Routing with capacity-based segment management
- ✅ Google Ads API integration for campaign management
- ✅ Billing system (SEPA postpaid + Card prepaid)
- ✅ Form builder and analytics
- 🔄 Partner marketing system (in progress)
- ✅ Schema exported on 2025-01-28 (canonical source: `docs/01-data/schema.sql`)

### Recent Major Changes
- Multi-site architecture: Landing pages are now platform-first (`partner_id = null`, `source_type = 'platform'`)
- Capacity-based segment sync: Only paying partners with active payment methods create capacity
- Real-time lead assignment with AI scoring
- Risk assessment system for partners
- Database schema exported to `docs/01-data/schema.sql` (canonical source)
- Knowledgebase hardening: Complete schema, RLS, and triggers documentation

---

## Top Modules

### Core Services
- **Lead Assignment Service** (`services/leadAssignmentService.js`) - AI-powered lead routing
- **Lead Segment Service** (`services/leadSegmentService.js`) - Segment management and capacity
- **Lead Demand Planner** (`services/leadDemandPlannerService.js`) - Target calculation
- **Segment Sync Service** (`services/segmentSyncService.js`) - Capacity-based segment sync
- **Partner Landing Page Service** (`services/partnerLandingPageService.js`) - Platform-first LP management
- **Site Service** (`services/siteService.js`) - Multi-site domain resolution

### AI Services
- **AI Mail Service** (`services/aiMailService.js`) - Email labeling, opportunity detection, response generation
- **AI Router** - Lead assignment scoring (branch, region, performance, capacity)

### Billing & Payments
- **Mollie Integration** (`lib/mollie.js`) - Payment processing
- **Billing Functions** (Supabase) - Usage tracking, quota management
- **SEPA** - Postpaid monthly invoicing
- **Card/Credit** - Prepaid balance system

### Integrations
- **Google Ads API** (`services/googleAdsService.js`) - Campaign management via MCC
- **KVK API** (`services/kvkApiService.js`) - Business verification
- **Twilio** - WhatsApp/SMS (optional)
- **Mailgun** - Email sending
- **OpenAI** - AI features (email labeling, content generation)

---

## Key Flows

### Lead Generation Flow
1. Lead created via public form or admin
2. Segment assigned based on industry + region
3. AI router scores candidates (if `routing_mode = 'ai_segment_routing'`)
4. Lead auto-assigned to best partner (or manual assignment)
5. Partner receives notification
6. Lead accepted/rejected → billing triggered
7. Capacity updated in real-time

### Billing Flow
- **Prepaid (Card):** Lead price deducted from `profiles.balance` immediately
- **Postpaid (SEPA):** Usage tracked in `v_monthly_lead_usage`, invoiced monthly
- Quota check: `can_allocate_lead()` validates before assignment

### Campaign Management Flow
1. Demand planner calculates targets per segment
2. Google Ads campaigns created/updated via MCC
3. Budgets adjusted based on real-time demand
4. Leads generated from campaigns
5. Performance tracked and optimized

---

## Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** Supabase (PostgreSQL) with RLS
- **ORM:** Prisma (legacy, mostly using Supabase client now)
- **Views:** EJS templates
- **Frontend:** Vanilla JS + Tailwind CSS + Radix UI components
- **Auth:** Supabase Auth (session-based)
- **Payments:** Mollie
- **AI:** OpenAI (GPT-4o-mini)

---

## DB Notes

**Top 10 Core Tables:**

1. **`profiles`** - Users/partners (extends Supabase auth.users), stores capacity, preferences, billing info
2. **`leads`** - Lead records with assignment, status, pricing, industry/location data
3. **`lead_segments`** - Industry + region combinations for capacity-based lead routing
4. **`lead_segment_plans`** - Target calculations per segment (daily planning)
5. **`partner_landing_pages`** - Platform-first landing pages (site_id, segment_id, page_type)
6. **`sites`** - Multi-site domains/brands (domain resolution, theming)
7. **`subscriptions`** - Lead quotas per user (leads_per_month, status)
8. **`payment_methods`** - SEPA/Card payment methods (required for capacity)
9. **`partner_performance_stats`** - Materialized view: conversion rates, open leads, response times
10. **`lead_generation_stats`** - Daily lead statistics per segment (generated, accepted, revenue)

---

## Known Issues / Gotchas

### Architecture Ambiguities
1. **Hybrid Express + Next.js:** `/app/` directory contains Next.js routes (e.g., `app/api/billing/snapshot/route.ts`) but primary server is Express (`server.js`). Unclear how they integrate or if Next.js is actively used.
2. **Legacy Prisma:** Prisma schema exists (`prisma/schema.prisma`) with User/Subscription/Invoice models, but codebase primarily uses Supabase client. Prisma marked as "legacy" but still in dependencies.
3. **Session-based Auth:** Uses Express sessions (cookie-based) instead of JWT. Reason not documented - may be for compatibility or security requirements.

### Technical Debt
- Prisma dependency still present but unused in most code paths
- Next.js build script exists but unclear if Next.js server runs alongside Express
- Mixed frontend: EJS templates (primary) + React components (Radix UI) + Next.js routes (unclear usage)

---

## Maintenance Checklist

Update this file when:
- [ ] Schema changes (new tables, columns, migrations)
- [ ] New major feature deployed
- [ ] Architecture decision made (add to `/docs/04-decisions/`)
- [ ] Deployment process changes
- [ ] New integration added
- [ ] Business rules change
- [ ] Weekly: Update "Current State" section

**How to update:**
1. Update "Last Updated" date
2. Add/remove items in "Focus Areas"
3. Update "Recent Major Changes" if significant
4. Add new modules to "Top Modules" if they become core
5. Document new flows in "Key Flows"

---

## Quick Links

- **Architecture:** `/docs/00-context/architecture.md`
- **Product Details:** `/docs/00-context/product.md`
- **Schema:** `/docs/01-data/schema.sql` or `supabase/migrations/`
- **API Endpoints:** `/docs/02-api/endpoints.md`
- **Decisions:** `/docs/04-decisions/adr-index.md`

