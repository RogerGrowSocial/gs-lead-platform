# PHASE 3: Services & Routing Logic - Plan van Aanpak

**Status:** 📋 Plan van Aanpak (wachtend op "go")  
**Date:** January 2025

---

## 📊 Codebase Scan Samenvatting

### Huidige State

#### 1. **PartnerLandingPageService** (`services/partnerLandingPageService.js`)
- **Huidige focus:** Partner-centric (vereist `partnerId`)
- **Methodes:**
  - `createLandingPage(partnerId, segmentId, config)` - vereist partner_id
  - `getPartnerLandingPages(partnerId, filters)` - partner-scoped
  - `getLandingPage(landingPageId)` - werkt met ID
  - `generateAIContent(partnerId, segmentId, toneOfVoice)` - placeholder, partner-centric
- **Probleem:** Alle methodes vereisen `partner_id`, geen platform-first opties

#### 2. **PartnerMarketingOrchestratorService** (`services/partnerMarketingOrchestratorService.js`)
- **Huidige focus:** Partner-centric iteratie
- **Flow:**
  1. Haalt `partner_lead_gaps` op (per partner)
  2. Filtert partners met `auto_marketing_enabled = true`
  3. Itereert over partners → genereert acties per partner
  4. Slaat recommendations op met `partner_id` (verplicht)
- **Probleem:** Itereert over partners, niet over `(site, segment)` combinaties

#### 3. **LeadAssignmentService** (`services/leadAssignmentService.js`)
- **Huidige focus:** Exclusieve routing naar 1 partner (✅ goed!)
- **Methodes:**
  - `getCandidates(leadId)` - haalt alle eligible partners op
  - `assignLead(leadId, partnerId)` - wijst toe aan 1 partner
- **Status:** ✅ Geen wijzigingen nodig, blijft exclusieve routing

#### 4. **Lead Creation Flow** (`routes/api.js` - `POST /api/leads`)
- **Huidige state:**
  - Accepteert: `name`, `email`, `phone`, `message`, `user_id`, `industry_id`, `status`
  - **Mist:** `landing_page_id`, `source_type`, `routing_mode`
  - Segment assignment gebeurt async na lead creation (via `LeadSegmentService.assignSegmentToLead`)
- **Probleem:** Geen koppeling met landing page, geen `source_type`/`routing_mode` tracking

#### 5. **AI Marketing Recommendations** (`routes/api.js`)
- **Endpoints:**
  - `GET /api/partners/:partnerId/marketing-recommendations` - partner-scoped
  - `POST /api/marketing-recommendations/:recId/approve` - **TODO: Execute action**
  - `POST /api/marketing-recommendations/:recId/reject`
- **Probleem:** Approve endpoint heeft `// TODO: Execute action based on type` - niet geïmplementeerd

#### 6. **Public Landing Page Rendering**
- **Status:** ❌ **NIET GEVONDEN**
- Geen route voor public LP rendering op basis van domain + path
- Geen template/view systeem voor LP content rendering

#### 7. **AI Content Generation** (`services/aiMailService.js`)
- **Huidige state:** OpenAI client setup aanwezig
- **Pattern:** `getOpenAIClient()`, `isOpenAIAvailable()`
- **Gebruikt voor:** Mail labeling, geen content generatie voor LPs

---

## 🎯 Plan van Aanpak

### **A) SiteService** (Nieuw)

**Bestand:** `services/siteService.js`

**Methodes:**
1. `async getSiteByDomain(domain)` 
   - Zoekt actieve site op domain (case-insensitive)
   - In-memory cache (Map) voor performance
   - Fallback naar `getDefaultSite()` als niet gevonden
   
2. `async getDefaultSite()`
   - Haalt site met `name = 'Main Platform'` op
   - Of eerste actieve site als fallback
   
3. `async listActiveSites()`
   - Retourneert alle `is_active = true` sites
   - Voor admin UI / debugging

**Implementatie details:**
- Gebruikt `supabaseAdmin` (consistent met andere services)
- Cache: `Map<domain, site>` met TTL (bijv. 5 minuten)
- Error handling: graceful fallback naar default site

---

### **B) PartnerLandingPageService** (Refactor - Platform-First)

**Bestand:** `services/partnerLandingPageService.js`

**Nieuwe Methodes (Platform-First):**

1. **`createPlatformLandingPage({ siteId, segmentId, pageType, path, ... })`**
   - **Forceert:** `partner_id = null`, `source_type = 'platform'`
   - **Validatie:**
     - `pageType` ∈ ['main', 'cost', 'quote', 'spoed', 'service_variant', 'info']
     - `path` begint met `/`
     - `path` bevat GEEN bedrijfsnamen (via `validatePath()` helper)
   - **Uniqueness check:** `(site_id, path)` - 409 error als conflict
   - **Status:** Default `'concept'`

2. **`getLandingPageByPath(siteId, path)`**
   - Zoekt LP op `site_id + path + status = 'live'`
   - Voor public rendering
   - Returns: LP object of null

3. **`getLandingPageCluster(siteId, segmentId)`**
   - Haalt alle LPs voor `(site_id, segment_id)` met status in ('live','concept','review')
   - Returns gestructureerd:
     ```js
     {
       main: LandingPage | null,
       cost: LandingPage | null,
       quote: LandingPage | null,
       spoed: LandingPage | null,
       others: LandingPage[]
     }
     ```

4. **`generateAIContentForPage({ site, segment, pageType, intent })`**
   - Gebruikt OpenAI client (zoals `AiMailService`)
   - Prompt bevat:
     - `site.positioning` (tone-of-voice)
     - `segment.branch` + `segment.region`
     - `pageType` (main/cost/quote/spoed)
     - **Expliciet:** "User kiest geen bedrijf; platform zoekt 1 specialist op achtergrond"
   - Returns:
     ```js
     {
       title, subtitle, seoTitle, seoDescription,
       content_json: { hero: {...}, features: [...], cta: {...} }
     }
     ```

**Helper Methodes:**

5. **`validatePath(path)`**
   - Check: begint met `/`
   - Check: geen e-mail patterns (`@`, `.com`, etc.)
   - Check: geen onrealistisch lange slugs (> 100 chars)
   - Check: geen bekende partner-namen (optioneel, via blacklist)
   - Returns: `{ valid: boolean, error?: string }`

6. **`generatePathFromSegment(segment, pageType)`**
   - Input: `segment` (met `branch`, `region`), `pageType`
   - Output: `/schilder/tilburg/` (main), `/schilder/tilburg/kosten/` (cost), etc.
   - **NOOIT** partner/bedrijfsdata gebruiken

**Legacy Methodes (Deprecated):**
- `createLandingPage(partnerId, ...)` - **DEPRECATED** - blijft voor legacy
- `getPartnerLandingPages(partnerId, ...)` - **DEPRECATED** - blijft voor legacy
- Markeer met `@deprecated` comments

---

### **C) PartnerMarketingOrchestratorService** (Refactor - Site+Segment)

**Bestand:** `services/partnerMarketingOrchestratorService.js`

**Nieuwe Flow:**

1. **Iteratie over `(site, segment)` in plaats van partners:**
   ```js
   // Oud: for (const partner of partners) { ... }
   // Nieuw:
   const sites = await SiteService.listActiveSites();
   const segments = await LeadSegmentService.getActiveSegments();
   
   for (const site of sites) {
     for (const segment of segments) {
       // Check lead gap voor dit (site, segment)
       // Genereer acties op basis van cluster status
     }
   }
   ```

2. **Lead Gap Berekening:**
   - Gebruik bestaande `lead_segment_plans` (segment-level targets)
   - Gebruik `lead_generation_stats` (segment-level actuals)
   - Gap = `target_leads_per_day - actual_leads` per segment
   - **Niet meer per partner**, maar per segment

3. **Cluster Status Check:**
   - Roep `PartnerLandingPageService.getLandingPageCluster(site.id, segment.id)` aan
   - Bepaal welke `page_type` mist:
     - Geen `main` → `create_landing_page` met `page_type='main'`
     - `main` bestaat, gap > threshold, geen `cost` → `create_landing_page` met `page_type='cost'`
     - `main` + `cost` bestaan, gap > hogere threshold, geen `quote` → `create_landing_page` met `page_type='quote'`
     - `spoed` alleen als segment daarop duidt (bijv. segment.code bevat 'spoed')

4. **Recommendations Opslaan:**
   - `site_id` (verplicht)
   - `partner_id = NULL` (platform-flow)
   - `segment_id` (verplicht)
   - `action_type = 'create_landing_page' | 'publish_landing_page' | 'increase_budget' | 'create_campaign'`
   - `action_details`:
     ```json
     {
       "site_id": "...",
       "segment_id": "...",
       "page_type": "main|cost|quote|spoed",
       "source_type": "platform",
       "suggested_path": "/schilder/tilburg/",
       "lead_gap": 10.5
     }
     ```

**Nieuwe Methodes:**

- `async generatePlatformMarketingActions(date)` - nieuwe entry point
- `async checkClusterStatus(siteId, segmentId)` - gebruikt `getLandingPageCluster`
- `async calculateSegmentGap(segmentId, date)` - segment-level gap (niet partner-level)

**Legacy Methodes (Deprecated):**
- `generateMarketingActions(date)` - **DEPRECATED** - blijft voor legacy partner-flow
- Markeer met `@deprecated` comments

---

### **D) Lead Creation Flow + LeadAssignmentService**

**Bestand:** `routes/api.js` - `POST /api/leads`

**Wijzigingen:**

1. **Accepteer nieuwe velden:**
   ```js
   const { 
     name, email, phone, message, 
     landing_page_id,  // NIEUW
     // ... rest
   } = req.body;
   ```

2. **Als `landing_page_id` aanwezig:**
   ```js
   if (landing_page_id) {
     const landingPage = await PartnerLandingPageService.getLandingPage(landing_page_id);
     if (landingPage) {
       insertData.landing_page_id = landing_page_id;
       insertData.source_type = landingPage.source_type || 'platform';
       insertData.routing_mode = 'ai_segment_routing';
     }
   }
   ```

3. **Na lead creation:**
   - Segment assignment blijft (via `LeadSegmentService.assignSegmentToLead`)
   - **NIEUW:** Als `routing_mode = 'ai_segment_routing'`, roep `LeadAssignmentService.assignLead()` aan
   - Lead wordt automatisch toegewezen aan beste partner (exclusief)

**LeadAssignmentService:**
- **Geen wijzigingen nodig** - blijft exclusieve routing naar 1 partner
- Eventueel helper: `assignLeadWithContext(lead, options)` als nodig, maar kern-logica blijft hetzelfde

---

### **E) Public Landing Page Rendering**

**Bestand:** `routes/public.js` (nieuw) of `routes/api.js` (toevoegen)

**Route:**
```js
// Catch-all route voor LP rendering (laatste route, na alle andere routes)
router.get('*', async (req, res) => {
  try {
    const host = req.hostname || req.headers.host;
    const path = req.path;
    
    // Skip API routes, admin routes, static files
    if (path.startsWith('/api/') || path.startsWith('/admin/') || path.startsWith('/css/') || path.startsWith('/js/')) {
      return next(); // Pass to next middleware
    }
    
    // Resolve site
    const site = await SiteService.getSiteByDomain(host);
    if (!site) {
      return next(); // Pass to normal app routing
    }
    
    // Get landing page
    const landingPage = await PartnerLandingPageService.getLandingPageByPath(site.id, path);
    if (!landingPage || landingPage.status !== 'live') {
      return res.status(404).render('404'); // Or pass to next
    }
    
    // Track view
    await PartnerLandingPageService.trackView(landingPage.id);
    
    // Get cluster for internal linking
    const cluster = await PartnerLandingPageService.getLandingPageCluster(site.id, landingPage.segment_id);
    
    // Render LP template
    res.render('public/landing-page', {
      landingPage,
      cluster,
      site
    });
  } catch (error) {
    console.error('Error rendering landing page:', error);
    next(); // Pass to normal app routing
  }
});
```

**Template:** `views/public/landing-page.ejs` (nieuw)
- Render `content_json` blokken
- Form met hidden field: `<input type="hidden" name="landing_page_id" value="<%= landingPage.id %>">`
- Internal links naar andere pagina's in cluster

---

### **F) Admin API voor AI Recommendations & LP's**

**Bestand:** `routes/api.js`

**Wijzigingen:**

1. **Approve Recommendation Execution:**
   ```js
   router.post("/marketing-recommendations/:recId/approve", requireAuth, async (req, res) => {
     // ... existing code ...
     
     // NIEUW: Execute action
     if (rec.action_type === 'create_landing_page' && rec.site_id && rec.segment_id) {
       const { site_id, segment_id, page_type, suggested_path } = rec.action_details;
       
       // Generate AI content
       const site = await SiteService.getDefaultSite(); // Or get by site_id
       const segment = await LeadSegmentService.getSegmentById(segment_id);
       const content = await PartnerLandingPageService.generateAIContentForPage({
         site,
         segment,
         pageType: page_type,
         intent: `${segment.branch} ${segment.region} ${page_type}`
       });
       
       // Create LP
       const landingPage = await PartnerLandingPageService.createPlatformLandingPage({
         siteId: site_id,
         segmentId: segment_id,
         pageType: page_type,
         path: suggested_path,
         ...content,
         sourceType: 'platform'
       });
       
       // Update recommendation
       await supabaseAdmin
         .from('ai_marketing_recommendations')
         .update({ 
           status: 'executed',
           executed_at: new Date().toISOString()
         })
         .eq('id', recId);
     } else if (rec.action_type === 'publish_landing_page' && rec.action_details.landing_page_id) {
       await PartnerLandingPageService.publishLandingPage(rec.action_details.landing_page_id);
       // Update recommendation status
     }
     
     // ... rest
   });
   ```

2. **Nieuwe Endpoints (Platform-First):**
   ```js
   // Get platform landing pages (site+segment)
   router.get("/admin/landing-pages", requireAuth, isAdmin, async (req, res) => {
     const { site_id, segment_id, page_type } = req.query;
     // Query platform LPs (partner_id IS NULL)
   });
   
   // Get recommendations (platform + legacy)
   router.get("/admin/marketing-recommendations", requireAuth, isAdmin, async (req, res) => {
     // Query all recommendations (partner_id IS NULL voor platform, partner_id IS NOT NULL voor legacy)
   });
   ```

---

### **G) Safeguards & Helpers**

**Bestand:** `services/partnerLandingPageService.js` of `utils/pathValidator.js`

1. **Path Validator:**
   ```js
   static validatePath(path) {
     // Check: begint met /
     if (!path.startsWith('/')) {
       return { valid: false, error: 'Path must start with /' };
     }
     
     // Check: geen e-mail patterns
     if (path.includes('@') || path.includes('.com') || path.includes('.nl')) {
       return { valid: false, error: 'Path cannot contain email-like patterns' };
     }
     
     // Check: geen onrealistisch lange slugs
     if (path.length > 100) {
       return { valid: false, error: 'Path too long' };
     }
     
     // Check: geen bekende partner-namen (optioneel)
     // TODO: Implement blacklist check
     
     return { valid: true };
   }
   ```

2. **Path Generator:**
   ```js
   static generatePathFromSegment(segment, pageType) {
     const branchSlug = slugify(segment.branch); // 'schilder'
     const regionSlug = slugify(segment.region); // 'tilburg'
     
     const pageTypeMap = {
       'main': '',
       'cost': '/kosten',
       'quote': '/offerte',
       'spoed': '/spoed',
       'service_variant': '/variant',
       'info': '/info'
     };
     
     const pageTypeSuffix = pageTypeMap[pageType] || '';
     return `/${branchSlug}/${regionSlug}${pageTypeSuffix}/`;
   }
   ```

3. **Documentatie:**
   - Comments: "This service is platform-first. Do NOT generate per-partner landing pages or include partner names in paths."
   - JSDoc: `@deprecated` voor legacy methodes

---

### **H) Tests / Sanity Checks**

**Bestand:** `scripts/test-phase3-services.js` (nieuw)

**Tests:**
1. `createPlatformLandingPage` zet geen `partner_id`
2. `getLandingPageByPath` werkt voor live page
3. Approving `create_landing_page` recommendation maakt LP in status 'concept'
4. Lead creation met `landing_page_id` zet `source_type='platform'` en `routing_mode='ai_segment_routing'`
5. Lead wordt automatisch toegewezen aan 1 partner via `LeadAssignmentService`

---

## 📋 Bestanden die Gewijzigd Worden

### **Nieuwe Bestanden:**
1. `services/siteService.js` - **NIEUW**
2. `routes/public.js` - **NIEUW** (of toevoegen aan `routes/api.js`)
3. `views/public/landing-page.ejs` - **NIEUW**
4. `scripts/test-phase3-services.js` - **NIEUW**

### **Gewijzigde Bestanden:**
1. `services/partnerLandingPageService.js` - **REFACTOR** (platform-first methodes toevoegen)
2. `services/partnerMarketingOrchestratorService.js` - **REFACTOR** (site+segment iteratie)
3. `routes/api.js` - **EXTEND** (lead creation, approve execution, nieuwe endpoints)
4. `services/leadAssignmentService.js` - **GEEN WIJZIGINGEN** (blijft exclusieve routing)

---

## ⚠️ Belangrijke Notities

1. **Geen Migrations:** Phase 3 maakt GEEN nieuwe migrations - alleen code updates
2. **Backward Compatibility:** Legacy methodes blijven werken (deprecated maar niet verwijderd)
3. **Platform-First:** Alle nieuwe logica werkt met `site_id + segment_id + page_type`, NIET `partner_id`
4. **Path Validation:** Hard geborgd in code - geen bedrijfsnamen in URLs
5. **Exclusieve Routing:** Blijft 1 partner per lead (geen Trustoo UX)

---

## ✅ Klaar voor Implementatie

**Wachtend op "go" om te starten met implementatie.**

