# PHASE 1: Discovery & Architecture Proposal
## Multi-Site AI Landing Page Engine

**Status:** ✅ Analysis Complete - Awaiting Approval  
**Date:** January 2025

---

## 📋 Executive Summary

This document analyzes the current codebase and proposes an architecture upgrade to transform the existing partner-centric landing page system into a **multi-site, multi-brand, AI-driven landing page network** that operates at platform level, not partner level.

**Key Principle:** Landing pages are **platform-first**, not partner-first. The consumer never chooses a partner; the AI router assigns exactly one best partner per lead.

---

## 🔍 Current State Analysis

### 1. Database Schema

#### 1.1. `partner_landing_pages` Table
**Location:** `supabase/migrations/20250115000003_partner_marketing.sql`

**Current Structure:**
```sql
CREATE TABLE public.partner_landing_pages (
  id UUID PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES profiles(id),  -- ⚠️ REQUIRED, partner-centric
  segment_id UUID REFERENCES lead_segments(id),
  path TEXT NOT NULL,
  status TEXT DEFAULT 'concept',  -- 'concept', 'review', 'live', 'archived'
  source TEXT DEFAULT 'ai_generated',  -- 'ai_generated', 'manual', 'template'
  title TEXT NOT NULL,
  subtitle TEXT,
  seo_title TEXT,
  seo_description TEXT,
  content_json JSONB DEFAULT '{}',
  views_count INTEGER DEFAULT 0,
  conversions_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ
);

-- Unique constraint: (partner_id, path)  ⚠️ Partner-centric uniqueness
CREATE UNIQUE INDEX idx_partner_landing_pages_unique_path 
  ON partner_landing_pages (partner_id, path);
```

**Issues for Multi-Site Architecture:**
- ❌ `partner_id` is **NOT NULL** - forces partner-centric model
- ❌ Uniqueness is `(partner_id, path)` - same path can't exist for different partners
- ❌ No `site_id` - can't support multiple domains/brands
- ❌ No `page_type` - can't distinguish main/cost/quote/spoed pages
- ❌ No `parent_page_id` - can't create page clusters
- ❌ No `source_type` - can't distinguish platform vs partner_exclusive leads

#### 1.2. `ai_marketing_recommendations` Table
**Location:** `supabase/migrations/20250115000003_partner_marketing.sql`

**Current Structure:**
```sql
CREATE TABLE public.ai_marketing_recommendations (
  id UUID PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES profiles(id),  -- ⚠️ Partner-centric
  segment_id UUID REFERENCES lead_segments(id),
  action_type TEXT NOT NULL,  -- 'create_landing_page', 'publish_landing_page', etc.
  action_details JSONB NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  reason TEXT,
  lead_gap NUMERIC(10,2),
  created_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  executed_at TIMESTAMPTZ
);
```

**Issues:**
- ❌ `partner_id` is **NOT NULL** - recommendations are partner-centric
- ❌ No `site_id` - can't recommend pages per site
- ❌ `action_details` structure doesn't include `site_id`, `page_type`, `source_type`

#### 1.3. `leads` Table
**Location:** `supabase/migrations/20250115000000_lead_flow_intelligence.sql`

**Current Structure (relevant fields):**
```sql
ALTER TABLE public.leads
  ADD COLUMN segment_id UUID REFERENCES lead_segments(id),
  ADD COLUMN source_channel TEXT,  -- 'google_ads', 'seo', 'microsite', 'direct'
  ADD COLUMN source_campaign_id TEXT,
  ADD COLUMN source_keyword TEXT;
```

**Missing Fields:**
- ❌ No `landing_page_id` - can't track which LP generated the lead
- ❌ No `source_type` - can't distinguish 'platform' vs 'partner_exclusive'
- ❌ No `routing_mode` - can't track 'ai_segment_routing' vs 'direct_partner'

---

### 2. Services Analysis

#### 2.1. `PartnerLandingPageService`
**Location:** `services/partnerLandingPageService.js`

**Current Behavior:**
- ✅ CRUD operations work
- ✅ Status workflow (concept → review → live)
- ✅ Performance tracking (views, conversions)
- ❌ **Partner-centric**: All methods require `partnerId`
- ❌ No site awareness
- ❌ No page type support
- ❌ No cluster support (parent/child pages)
- ❌ AI content generation is placeholder only

**Key Methods:**
- `createLandingPage(partnerId, segmentId, config)` - ⚠️ Requires partnerId
- `getPartnerLandingPages(partnerId, filters)` - ⚠️ Partner-scoped
- `generateAIContent(partnerId, segmentId, toneOfVoice)` - ⚠️ Placeholder

#### 2.2. `PartnerMarketingOrchestratorService`
**Location:** `services/partnerMarketingOrchestratorService.js`

**Current Behavior:**
- ✅ Generates recommendations based on lead gaps
- ✅ Rule-based logic (no black box AI)
- ❌ **Partner-centric**: Iterates over partners, generates partner-specific recommendations
- ❌ Checks for LP existence per `(partner_id, segment_id)` - not `(site_id, segment_id)`
- ❌ No site awareness
- ❌ No page type logic

**Key Flow:**
1. Gets partner gaps from `PartnerDemandService`
2. Filters partners with `auto_marketing_enabled`
3. For each partner+segment gap:
   - Checks if LP exists: `WHERE partner_id = X AND segment_id = Y`
   - Generates `create_landing_page` recommendation with `partner_id` in action_details
4. Saves recommendations with `partner_id` NOT NULL

**Issue:** This creates partner-specific LPs, not platform LPs.

#### 2.3. `LeadAssignmentService`
**Location:** `services/leadAssignmentService.js`

**Current Behavior:**
- ✅ AI routing logic works (exclusive assignment to 1 partner)
- ✅ Scoring system based on branch/region/performance/capacity
- ✅ Uses `segment_id` from lead for routing
- ❌ No awareness of `landing_page_id`
- ❌ No `source_type` handling
- ❌ No `routing_mode` tracking

**Key Method:**
- `assignLead(leadId, assignedBy, partnerId)` - Assigns lead to exactly 1 partner ✅

**Good:** Already enforces exclusive routing - this must be preserved.

---

### 3. Admin UI Analysis

#### 3.1. Leadstroom Dashboard
**Location:** `/admin/leads/engine`

**Current Data Flow:**
- API: `GET /api/admin/leadstroom/overview`
- Fetches: `lead_generation_stats`, `lead_segments`, `lead_segment_plans`
- Displays: KPIs, chart, segments table
- ❌ No landing page visibility
- ❌ No site filtering
- ❌ No recommendations display (separate endpoint exists)

**Recommendations Endpoint:**
- `GET /api/partners/:partnerId/marketing-recommendations` - ⚠️ Partner-scoped
- `POST /api/marketing-recommendations/:recId/approve` - ⚠️ No execution logic

---

### 4. Cron Jobs

**Relevant Jobs:**
- `generateAiPartnerRecommendationsDaily.js` - Calls `PartnerMarketingOrchestratorService.generateMarketingActions()`
- `runPartnerDemandPlanningDaily.js` - Calculates partner gaps
- `calculatePartnerLeadStatsDaily.js` - Aggregates partner stats

**Issue:** All jobs are partner-centric, not site+segment-centric.

---

## 🎯 Proposed Architecture

### 1. New `sites` Table

**Purpose:** Support multiple domains/brands with different positioning.

```sql
CREATE TABLE public.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,  -- e.g., "Main Platform", "Spoed.nl", "DuurzaamSchilders.nl"
  domain TEXT NOT NULL UNIQUE,  -- e.g., "growsocialmedia.nl", "spoed.nl"
  theme_key TEXT NOT NULL DEFAULT 'main',  -- e.g., 'main', 'spoed', 'duurzaam'
  positioning TEXT,  -- AI copy hints: "fast/spoed", "sustainable", "premium"
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sites_domain ON sites (domain);
CREATE INDEX idx_sites_active ON sites (is_active) WHERE is_active = TRUE;
```

**Backfill Strategy:**
- Create 1 default site: `name = "Main Platform"`, `domain = <from env/config>`, `theme_key = "main"`

---

### 2. Extended `partner_landing_pages` Table

**Changes:**
1. Make `partner_id` **NULLABLE** (legacy/optional)
2. Add `site_id` (NOT NULL for new platform LPs)
3. Add `page_type` (main, cost, quote, spoed, service_variant, info)
4. Add `parent_page_id` (for clusters)
5. Add `source_type` (platform, partner_exclusive)
6. Change uniqueness: `(site_id, path)` instead of `(partner_id, path)`

**Proposed Schema:**
```sql
ALTER TABLE public.partner_landing_pages
  -- Make partner_id optional (legacy support)
  ALTER COLUMN partner_id DROP NOT NULL,
  
  -- Add site support
  ADD COLUMN site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Add page type
  ADD COLUMN page_type TEXT DEFAULT 'main' 
    CHECK (page_type IN ('main', 'cost', 'quote', 'spoed', 'service_variant', 'info')),
  
  -- Add cluster support
  ADD COLUMN parent_page_id UUID REFERENCES partner_landing_pages(id) ON DELETE SET NULL,
  
  -- Add source type
  ADD COLUMN source_type TEXT DEFAULT 'platform'
    CHECK (source_type IN ('platform', 'partner_exclusive'));

-- New uniqueness: path is unique per site
DROP INDEX IF EXISTS idx_partner_landing_pages_unique_path;
CREATE UNIQUE INDEX idx_partner_landing_pages_unique_path 
  ON partner_landing_pages (site_id, path) 
  WHERE site_id IS NOT NULL;

-- Optional: One main page per site+segment
CREATE UNIQUE INDEX idx_partner_landing_pages_unique_main 
  ON partner_landing_pages (site_id, segment_id, page_type) 
  WHERE page_type = 'main' AND site_id IS NOT NULL AND segment_id IS NOT NULL;

-- New indexes
CREATE INDEX idx_partner_landing_pages_site_id ON partner_landing_pages (site_id);
CREATE INDEX idx_partner_landing_pages_page_type ON partner_landing_pages (page_type);
CREATE INDEX idx_partner_landing_pages_parent ON partner_landing_pages (parent_page_id) 
  WHERE parent_page_id IS NOT NULL;
CREATE INDEX idx_partner_landing_pages_source_type ON partner_landing_pages (source_type);
```

**Backfill Strategy:**
- For all existing `partner_landing_pages`:
  - Set `site_id = <default_site.id>`
  - Set `page_type = 'main'`
  - Set `source_type = 'platform'`
  - Keep `partner_id` as-is (legacy data)

---

### 3. Extended `leads` Table

**New Fields:**
```sql
ALTER TABLE public.leads
  ADD COLUMN landing_page_id UUID REFERENCES partner_landing_pages(id) ON DELETE SET NULL,
  ADD COLUMN source_type TEXT DEFAULT 'platform'
    CHECK (source_type IN ('platform', 'partner_exclusive')),
  ADD COLUMN routing_mode TEXT
    CHECK (routing_mode IN ('ai_segment_routing', 'direct_partner'));

CREATE INDEX idx_leads_landing_page_id ON leads (landing_page_id);
CREATE INDEX idx_leads_source_type ON leads (source_type);
CREATE INDEX idx_leads_routing_mode ON leads (routing_mode);
```

**Backfill Strategy:**
- Existing leads: `landing_page_id = NULL`, `source_type = 'platform'`, `routing_mode = NULL`

---

### 4. Extended `ai_marketing_recommendations` Table

**Changes:**
```sql
ALTER TABLE public.ai_marketing_recommendations
  -- Make partner_id optional (platform recommendations don't need partner)
  ALTER COLUMN partner_id DROP NOT NULL,
  
  -- Add site support
  ADD COLUMN site_id UUID REFERENCES sites(id) ON DELETE CASCADE;

CREATE INDEX idx_ai_marketing_recommendations_site_id 
  ON ai_marketing_recommendations (site_id, status);
```

**Updated `action_details` Structure:**
For `create_landing_page` and `publish_landing_page`:
```json
{
  "site_id": "uuid",
  "segment_id": "uuid",
  "page_type": "main|cost|quote|spoed|service_variant|info",
  "source_type": "platform",
  "suggested_path": "/schilder/tilburg/",
  "lead_gap": 10.5,
  "segment_code": "schilder_tilburg"
}
```

---

## 🔧 Service Changes

### 1. New `SiteService`
**Location:** `services/siteService.js` (new file)

**Methods:**
- `getSiteByDomain(domain)` - Resolve site from Host header
- `getDefaultSite()` - Get default/main site
- `listActiveSites()` - List all active sites
- Caching: In-memory cache for performance

---

### 2. Updated `PartnerLandingPageService`

**Behavior Changes:**
- Treat as **platform LP service** (rename conceptually, keep class name for now)
- `partner_id` becomes **optional** (only for legacy/partner_exclusive LPs)
- New methods:
  - `getLandingPageByPath(siteId, path)` - Find LP by site+path
  - `getCluster(siteId, segmentId)` - Get main + all satellites
  - `determineNextPageTypeToCreate(siteId, segmentId, gapData)` - Rule-based page type selection
- Updated `createLandingPage()`:
  - Accept `site_id`, `page_type`, `parent_page_id`, `source_type`
  - `partner_id` optional (default NULL for platform LPs)
- Updated `generateAIContent()`:
  - Accept `site`, `segment`, `page_type` instead of `partnerId`, `segmentId`
  - Use site positioning for tone/voice

---

### 3. Updated `PartnerMarketingOrchestratorService`

**Behavior Changes:**
- **Stop iterating over partners** for LP recommendations
- **Iterate over sites + segments** instead
- For each `(site, segment)`:
  - Check existing pages: `WHERE site_id = X AND segment_id = Y`
  - Use lead gaps (aggregate per segment, not per partner)
  - Generate recommendations:
    - `create_landing_page` with `site_id`, `segment_id`, `page_type`, `source_type = 'platform'`
    - **No `partner_id`** in recommendation
- Generate recommendations for:
  - Main page (if missing)
  - Cost page (if gap > threshold)
  - Quote page (if gap > threshold)
  - Spoed page (if segment has urgency indicators)

**Guardrails:**
- Max 6 pages per `(site, segment)` cluster
- Only propose new pages when `lead_gap > 3` (configurable threshold)
- Document limits in code comments

---

### 4. Updated `LeadAssignmentService`

**Changes:**
- When lead is created from LP:
  - Set `landing_page_id` on lead
  - Fetch LP to get `source_type`
  - Set `source_type = 'platform'` (for now)
  - Set `routing_mode = 'ai_segment_routing'`
- Routing behavior:
  - `source_type = 'platform'` → Use existing AI router (exclusive to 1 partner) ✅
  - `source_type = 'partner_exclusive'` → Future: direct assignment (not implemented now)

---

## 🛡️ Guardrails & Constraints

### 1. SEO Guardrails
- **Max sites:** Hard cap of 10 sites (configurable constant)
- **Max pages per cluster:** 6 pages per `(site, segment)`
- **Content quality:** All AI content starts as `'concept'` - manual approval required
- **No doorway pages:** Each page must have unique, valuable content

### 2. Platform-First Guardrails
- **No partner selection UI:** Consumer never sees partner list
- **Exclusive routing:** Always 1 partner per lead (existing behavior preserved)
- **Path strategy:** Clean paths like `/schilder/tilburg/`, `/schilder/tilburg/kosten/`

### 3. Code-Level Constraints
- Constants in services:
  ```javascript
  const MAX_SITES = 10;
  const MAX_PAGES_PER_CLUSTER = 6;
  const MIN_GAP_FOR_NEW_PAGE = 3;
  ```

---

## 📊 Data Flow (Proposed)

### Landing Page Creation Flow
1. **Cron Job:** `generateAiPartnerRecommendationsDaily`
2. **Orchestrator:** Iterates over `(site, segment)` pairs
3. **Gap Analysis:** Uses aggregate segment gaps (not partner-specific)
4. **Recommendation:** `create_landing_page` with `site_id`, `segment_id`, `page_type`
5. **Admin Approval:** Admin reviews recommendation in UI
6. **Execution:** Creates LP with `source_type = 'platform'`, `partner_id = NULL`
7. **AI Content:** Generates content based on site positioning + segment + page_type
8. **Status:** Starts as `'concept'`, admin publishes to `'live'`

### Lead Capture Flow
1. **User visits:** `https://{domain}/schilder/tilburg/`
2. **Site Detection:** `SiteService.getSiteByDomain(host)`
3. **LP Lookup:** `getLandingPageByPath(site.id, '/schilder/tilburg/')`
4. **Render:** Template renders `content_json` sections
5. **Form Submit:** Includes `landing_page_id` in payload
6. **Lead Creation:** API creates lead with `landing_page_id`, `source_type = 'platform'`
7. **Routing:** `LeadAssignmentService` assigns to exactly 1 partner (exclusive)
8. **Tracking:** `trackConversion(landing_page_id)`

---

## ❓ Open Questions

1. **Domain Configuration:** Where should we store the default domain? Environment variable or config table?
2. **Page Type Priority:** What's the priority order for creating page types? (main → cost → quote → spoed?)
3. **Cluster Linking:** Should internal links be automatic or configurable per template?
4. **Legacy Data:** Should we migrate existing `partner_landing_pages` to platform LPs, or keep them as-is?
5. **AI Content Service:** Do we have an existing LLM client, or should we integrate OpenAI/Anthropic?

---

## 📁 Files Involved

### New Files (Phase 2+)
- `services/siteService.js` - Site resolution & caching
- `supabase/migrations/XXXXXX_add_sites_table.sql` - Sites table
- `supabase/migrations/XXXXXX_extend_landing_pages_for_multi_site.sql` - LP extensions
- `supabase/migrations/XXXXXX_extend_leads_for_lp_tracking.sql` - Leads extensions
- `supabase/migrations/XXXXXX_extend_recommendations_for_sites.sql` - Recommendations extensions

### Modified Files (Phase 3+)
- `services/partnerLandingPageService.js` - Add site/page_type support
- `services/partnerMarketingOrchestratorService.js` - Site+segment iteration
- `services/leadAssignmentService.js` - Landing page awareness
- `routes/api.js` - Update LP endpoints, add site endpoints
- `cron/generateAiPartnerRecommendationsDaily.js` - No changes needed (uses orchestrator)

---

## ✅ Summary

**Current State:**
- Partner-centric landing pages (`partner_id` required)
- Partner-centric recommendations (per partner+segment)
- No multi-site support
- No page type clustering
- No landing page tracking on leads

**Proposed State:**
- Platform-first landing pages (`site_id` + `segment_id` + `page_type`)
- Site+segment-centric recommendations
- Multi-site/brand support
- Page clusters (main + satellites)
- Full landing page tracking on leads

**Constraints Respected:**
- ✅ No Trustoo UX (consumer never chooses partner)
- ✅ Exclusive routing (1 partner per lead)
- ✅ SEO guardrails (max sites, max pages, quality gates)
- ✅ Platform-first (not partner-first)

---

**Phase 1 completed. Here is the analysis and architecture proposal.**

**Reply with 'go' to start designing migrations for Phase 2, or provide feedback.**

