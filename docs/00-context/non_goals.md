# Non-Goals

**Last Updated:** 2025-01-28

This document explicitly states what this platform is **NOT** designed to do. This prevents scope creep and clarifies boundaries.

---

## What This Platform Is NOT

### 1. A CRM System
- **Not:** Full customer relationship management with pipelines, deals, contacts
- **Is:** Lead generation and routing platform
- **Note:** Basic opportunity tracking exists, but not a full CRM

### 2. A Partner Marketplace
- **Not:** A directory where consumers browse and choose partners
- **Is:** Automated routing where AI assigns exactly one partner per lead
- **Principle:** Consumer never chooses partner; platform assigns

### 3. A Multi-Tenant SaaS Platform
- **Not:** White-label solution where each partner has their own branded instance
- **Is:** Single platform with multi-site support (different domains, same codebase)
- **Note:** Partners share the same platform, not separate instances

### 4. A Full Marketing Automation Platform
- **Not:** Complete marketing automation with email campaigns, social media, etc.
- **Is:** Focused on lead generation via Google Ads and landing pages
- **Note:** Email sending exists (Mailgun), but not full email marketing

### 5. A Payment Processor
- **Not:** Direct payment processing (like Stripe Connect)
- **Is:** Payment integration via Mollie (third-party processor)
- **Note:** We don't handle card details directly

### 6. A Customer Support System
- **Not:** Ticketing system, live chat, knowledge base
- **Is:** Basic email inbox with AI labeling (for internal use)
- **Note:** No customer-facing support features

### 7. A Full Analytics Platform
- **Not:** Google Analytics alternative or full BI tool
- **Is:** Focused analytics: lead performance, partner stats, billing
- **Note:** Basic charts and KPIs, not advanced analytics

### 8. A Mobile App
- **Not:** Native iOS/Android apps
- **Is:** Web application (responsive, but not native)
- **Note:** Mobile-friendly web, but no app store apps

### 9. A White-Label Solution
- **Not:** Rebrandable platform for resellers
- **Is:** GrowSocial-branded platform (multi-site support for different domains)
- **Note:** Can support multiple domains, but not full white-labeling

### 10. A Social Media Management Tool
- **Not:** Social media scheduling, posting, engagement
- **Is:** Lead generation focused (Google Ads, landing pages)
- **Note:** No social media features

---

## What We Don't Support (Yet)

### Currently Out of Scope
- **Meta Ads Integration:** Only Google Ads currently
- **SEO Tools:** No SEO management features
- **Email Marketing:** No email campaign builder
- **Partner Portals:** No separate partner-facing portals
- **API for Partners:** No public API for partners to integrate
- **Webhooks for Partners:** No webhook system for partner integrations
- **Multi-Currency:** Only EUR (Euro) supported
- **Multi-Language UI:** Only Dutch UI (some English in code)

---

## Design Decisions That Define Boundaries

### Platform-First, Not Partner-First
- Landing pages are platform-owned, not partner-owned
- Segments are platform concepts, not partner-specific
- **Why:** Ensures consistent quality and AI routing

### One Partner Per Lead
- AI router assigns exactly one partner
- No "multiple quotes" or "bidding" system
- **Why:** Simpler, faster, better partner experience

### Capacity-Based, Not Demand-Based
- Segments created only where capacity exists
- Not: Create segments for all possible combinations
- **Why:** Prevents thousands of unused segments

### Payment Method Required
- Partners without payment method = 0 capacity
- Not: Allow leads without payment setup
- **Why:** Business rule: no free leads

---

## When to Say "No"

### Feature Requests to Decline
1. **"Let consumers choose their partner"** → Violates platform-first principle
2. **"Allow multiple partners per lead"** → Violates one-partner-per-lead rule
3. **"Create segments for all industries"** → Violates capacity-based principle
4. **"White-label for resellers"** → Out of scope (multi-site is different)
5. **"Full CRM features"** → Out of scope (we're lead generation, not CRM)

### How to Handle
- **Acknowledge:** "I understand you want X"
- **Explain:** "However, our platform is designed for Y, not X"
- **Suggest:** "Consider using [alternative tool] for X, and integrate with our platform for Y"
- **Document:** If it's a common request, add to this file

---

## Related Documentation

- **Product:** `/docs/00-context/product.md`
- **Architecture:** `/docs/00-context/architecture.md`

