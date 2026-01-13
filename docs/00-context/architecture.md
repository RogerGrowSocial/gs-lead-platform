# Architecture Overview

**Last Updated:** 2025-01-28

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GS Lead Platform                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   Express    │    │   Supabase   │    │   Services   │ │
│  │   Server     │◄───►│  PostgreSQL  │◄───►│   Layer     │ │
│  │  (Node.js)   │    │   + RLS      │    │              │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │   EJS Views  │    │  Migrations  │    │  Integrations│ │
│  │  + Tailwind  │    │   (SQL)      │    │  (Google Ads,│ │
│  │  + Radix UI  │    │              │    │   Mollie,    │ │
│  └──────────────┘    └──────────────┘    │   OpenAI)     │ │
│                                          └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Design Principles

### 1. Platform-First Architecture
- **Landing pages** are platform-owned, not partner-owned
- **Segments** are platform concepts (industry + region), not partner-specific
- **AI router** assigns exactly one partner per lead (consumer never chooses)

### 2. Capacity-Based Segment Management
- Segments created only where paying partners have capacity
- Only partners with active payment method create capacity
- Segments never deleted, only deactivated

### 3. Real-Time Updates
- Lead assignments update capacity immediately
- Targets recalculated on-demand (cron + dashboard loads)
- Open leads count updated in real-time (not just cron)

### 4. Single Source of Truth
- **Targets:** `LeadDemandPlannerService.planSegment()` is the only function that stores targets
- **Capacity:** `get_segment_capacity()` SQL function is the source of truth
- **Assignment:** `LeadAssignmentService.assignLead()` is the only assignment function

---

## Technology Stack

### Backend
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL 15+)
- **ORM:** Supabase Client (primary), Prisma (legacy)
- **Auth:** Supabase Auth (session-based, no hooks)

### Frontend
- **Templates:** EJS
- **Styling:** Tailwind CSS
- **Components:** Radix UI
- **JS:** Vanilla JavaScript (no framework)

### Database
- **Provider:** Supabase (managed PostgreSQL)
- **RLS:** Row Level Security enabled on all tables
- **Migrations:** SQL files in `supabase/migrations/`
- **Functions:** PostgreSQL functions for complex logic
- **Views:** Materialized views for performance stats

### Integrations
- **Google Ads:** `google-ads-api` package, Manager Account (MCC)
- **Payments:** Mollie API
- **AI:** OpenAI (GPT-4o-mini)
- **Email:** Mailgun
- **Verification:** KVK API (Dutch business registry)

---

## Service Layer Architecture

### Core Services
```
services/
├── leadAssignmentService.js      # AI routing, scoring, assignment
├── leadSegmentService.js          # Segment CRUD, capacity
├── leadDemandPlannerService.js    # Target calculation
├── segmentSyncService.js          # Capacity-based sync
├── partnerLandingPageService.js  # Platform-first LP management
├── siteService.js                 # Multi-site domain resolution
├── aiMailService.js               # Email labeling, AI responses
├── googleAdsService.js            # Campaign management
├── userRiskAssessmentService.js  # Risk evaluation
└── kvkApiService.js               # Business verification
```

### Service Patterns
- **Single Responsibility:** Each service handles one domain
- **Database Functions:** Complex queries use SQL functions
- **Error Handling:** Services throw errors, routes handle HTTP responses
- **No Direct DB Access:** Services use Supabase client, not raw SQL

---

## Database Architecture

### Key Tables
- `profiles` - Users/partners (extends Supabase auth.users)
- `leads` - Lead records
- `lead_segments` - Industry + region combinations
- `lead_segment_plans` - Target calculations per segment
- `partner_performance_stats` - Materialized view for performance
- `sites` - Multi-site domains
- `partner_landing_pages` - Platform-first landing pages
- `payment_methods` - SEPA/Card payment methods
- `subscriptions` - Lead quotas
- `ai_router_settings` - AI routing configuration

### RLS Policies
- **Principle:** Users can only access their own data
- **Admins:** Can access all data via service role
- **Partners:** Can only see their assigned leads
- **Public:** Can create leads via public API

### Functions & Triggers
- `get_segment_capacity()` - Calculates capacity per segment
- `get_branch_region_capacity_combos()` - Finds active (branch, region) combos
- `can_allocate_lead()` - Validates lead assignment
- `get_billing_snapshot()` - Billing status per user
- Triggers: Profile creation, risk assessment, lead usage tracking

---

## API Architecture

### Route Structure
```
routes/
├── api.js              # Main API routes
├── admin.js            # Admin pages
├── dashboard.js        # Partner dashboard
├── auth.js             # Authentication
├── leads.js            # Lead management
├── payments.js         # Payment operations
├── webhooks.js         # External webhooks (Mollie)
└── forms.js            # Form builder
```

### Authentication Flow
1. User signs up → Supabase Auth creates user
2. Database trigger creates `profiles` record
3. Session stored in Express session (cookie-based)
4. Middleware: `requireAuth` checks session
5. Middleware: `isAdmin` checks role

### API Patterns
- **RESTful:** GET, POST, PUT, DELETE where appropriate
- **Error Responses:** `{ ok: false, error: "message" }`
- **Success Responses:** `{ ok: true, data: {...} }`
- **Validation:** Express-validator for input validation

---

## Security

### Authentication
- Supabase Auth (email/password, 2FA optional)
- Session-based (no JWT in API calls)
- RLS policies enforce data access

### Authorization
- Role-based: `ADMIN`, `USER`, custom roles
- Permission-based: Granular permissions via `middleware/permissions.js`
- Service role: Admin operations use Supabase service role key

### Data Protection
- RLS on all tables
- Service role key never exposed to client
- Environment variables for secrets
- HTTPS required in production

---

## Performance Considerations

### Database
- **Indexes:** On foreign keys, frequently queried columns
- **Materialized Views:** For performance stats (refreshed via cron)
- **Functions:** Complex queries as SQL functions (cached execution plans)

### Caching
- **Site Service:** In-memory cache (5 min TTL) for domain resolution
- **No Redis:** Currently no external cache (consider for scale)

### Optimization
- **Lazy Loading:** Heavy routes loaded on-demand (e.g., `routes/leads`)
- **Bulk Operations:** Segment sync uses bulk queries, not loops
- **Real-Time Updates:** Capacity updated immediately, not just cron

---

## Deployment Architecture

### Environment
- **Development:** Local Node.js + Supabase local (optional)
- **Production:** Node.js server + Supabase cloud
- **HTTPS:** Required (setup via `setup-https.sh`)

### CI/CD
- Manual deployment (no automated pipeline documented)
- Migrations: Run via Supabase CLI or SQL Editor

### Monitoring
- Winston logging (file-based)
- System logs table in database
- Activity logs for audit trail

---

## Related Documentation

- **Schema:** `/docs/01-data/schema.sql`
- **Decisions:** `/docs/04-decisions/adr-index.md`
- **Runbooks:** `/docs/05-runbooks/deploy.md`

