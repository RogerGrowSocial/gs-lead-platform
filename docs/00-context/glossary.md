# Glossary

**Last Updated:** 2025-01-28

---

## Core Terms

### Lead
A potential customer inquiry. Contains: name, email, phone, industry, location, message, urgency.

### Partner
A service provider (painter, roofer, electrician, etc.) who receives leads. Also called "user" in code.

### Segment
A combination of **industry** (branch) + **region** (province/city). Example: "Schilder" + "Tilburg". Segments are platform concepts, not partner-specific.

### Capacity
The maximum number of open leads a partner can handle. Stored in `profiles.max_open_leads`. Used to calculate available capacity: `total - open_leads_count`.

### Target
The desired number of leads to generate per segment per day. Calculated as: `available_capacity * 0.8` (80% utilization).

### Assignment
The process of assigning a lead to a partner. Can be:
- **Auto-assignment:** AI router automatically assigns best partner
- **Manual assignment:** Admin selects partner

### Routing Mode
How leads are assigned:
- `ai_segment_routing`: AI router assigns automatically
- `manual`: Admin assigns manually
- `none`: No assignment

---

## Database Terms

### RLS (Row Level Security)
PostgreSQL feature that restricts row access based on user. All tables have RLS policies.

### Materialized View
A cached query result. Example: `partner_performance_stats` - refreshed via cron, not real-time.

### Migration
SQL file that modifies database schema. Located in `supabase/migrations/`.

### Function
PostgreSQL function (stored procedure). Example: `get_segment_capacity()`, `can_allocate_lead()`.

### Trigger
Database trigger that runs automatically on INSERT/UPDATE/DELETE. Example: Profile creation trigger.

---

## Business Terms

### SEPA
Single Euro Payments Area. Postpaid payment method - invoiced monthly at end of month.

### Card/Credit
Prepaid payment method. Balance deducted immediately per lead. Stored in `profiles.balance`.

### Quota
Monthly lead limit per subscription. Stored in `subscriptions.leads_per_month`.

### Conversion Rate
Percentage of assigned leads that are accepted. Formula: `accepted_leads / total_assigned_leads`.

### Response Time
Time from lead assignment to partner response. Measured in minutes.

### Wait Time
Time since partner's last lead assignment. Used in AI routing scoring (longer wait = higher score).

---

## Technical Terms

### MCC (Manager Account)
Google Ads Manager Account. Used to manage multiple partner Google Ads accounts from one place.

### Service Role
Supabase service role key. Bypasses RLS. Used for admin operations. **Never expose to client.**

### Session
Express session stored in cookie. Used for authentication (not JWT).

### EJS
Embedded JavaScript templating. Used for server-side rendering.

### RLS Policy
SQL policy that defines who can access which rows. Example: "Users can only see their own leads."

---

## Feature-Specific Terms

### Landing Page (LP)
A marketing page for a specific segment + page type. Types: `main`, `cost`, `quote`, `spoed`. Platform-owned, not partner-owned.

### Site
A domain/brand. Example: "growsocial.nl", "partner-site.nl". Multi-site support allows different domains.

### Form Builder
Custom form creation tool for partners. Includes analytics and optimization.

### AI Router
The system that scores and assigns leads to partners. Uses: branch match, region match, performance, capacity, wait time.

### Segment Sync
Process that creates/activates/deactivates segments based on partner capacity. Runs via cron.

### Demand Planning
Process that calculates targets per segment. Runs daily via cron.

---

## Status Values

### Lead Status
- `new`: Just created, not assigned
- `assigned`: Assigned to partner, awaiting response
- `accepted`: Partner accepted lead
- `rejected`: Partner rejected lead
- `closed`: Lead closed (won/lost)
- `expired`: Lead expired (no response)

### Payment Method Status
- `active`: Can be used for payments
- `pending`: Awaiting verification
- `failed`: Verification failed
- `inactive`: Disabled

### Segment Status
- `is_active = true`: Segment has capacity, can receive leads
- `is_active = false`: No capacity, deactivated (not deleted)

### Landing Page Status
- `concept`: Draft, not published
- `review`: Awaiting review
- `live`: Published and accessible
- `archived`: No longer active

---

## Acronyms

- **GS:** GrowSocial
- **LP:** Landing Page
- **MCC:** Manager Account (Google Ads)
- **RLS:** Row Level Security
- **SEPA:** Single Euro Payments Area
- **KVK:** Kamer van Koophandel (Dutch business registry)
- **API:** Application Programming Interface
- **CRUD:** Create, Read, Update, Delete
- **TTL:** Time To Live (cache expiration)

---

## Related Documentation

- **Product:** `/docs/00-context/product.md`
- **Architecture:** `/docs/00-context/architecture.md`

