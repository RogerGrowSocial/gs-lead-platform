# FASE 3: Partner Marketing Functioneel Ontwerp & Stappenplan

## Status: ✅ ONTWERP ALLEEN (GEEN CODE)

**Belangrijk:** Dit is een functioneel ontwerp; ik schrijf nog geen code, alleen pseudo-code en beschrijvingen.

---

## 3.1. Vraag/Aanbod Logica per Partner

### Concept: Partner Lead Gap

**Doel:** Per partner berekenen hoeveel leads ze willen vs. hoeveel ze krijgen

**Input Data:**
1. **Segment Stats** (uit `lead_generation_stats`)
   - Leads gegenereerd per segment per dag
   - Acceptatie rates
   - CPL per segment

2. **Partner Stats** (uit `partner_performance_stats` + nieuwe tracking)
   - Huidige leads via platform (lead routing)
   - Leads via eigen campagnes (`partner_marketing_campaigns`)
   - Target leads per week/maand (nieuw veld in `profiles` of `partner_segments`)

3. **Partner Configuratie** (uit `profiles` + `partner_segments`)
   - Marketing mode (leads_only, hybrid, full_marketing)
   - Auto marketing enabled
   - Budget beschikbaar
   - Actieve segmenten

**Output:**
- `partner_lead_gap` per partner per segment
- Voorbeeld: "Jansen wil 20 leads/week, krijgt er nu 8 → gap=12"

### Service: PartnerDemandService

**Pseudo-code:**

```javascript
class PartnerDemandService {
  /**
   * Bereken lead gap per partner per segment
   * @param {Date} date - Datum voor berekening (default: vandaag)
   * @returns {Array} Array van partner gap records
   */
  static async calculatePartnerLeadGaps(date = new Date()) {
    // 1. Haal alle actieve partners op met marketing enabled
    const partners = await getActivePartnersWithMarketing();
    
    // 2. Voor elke partner:
    const gaps = [];
    for (const partner of partners) {
      // 2a. Haal actieve segmenten op voor deze partner
      const segments = await getPartnerSegments(partner.id);
      
      // 2b. Voor elk segment:
      for (const segment of segments) {
        // 2c. Bereken target leads (uit partner config of segment stats)
        const targetLeads = await calculateTargetLeads(partner, segment);
        
        // 2d. Bereken huidige leads (platform + eigen campagnes)
        const currentLeads = await calculateCurrentLeads(partner, segment, date);
        
        // 2e. Bereken gap
        const gap = targetLeads - currentLeads;
        
        // 2f. Sla op in partner_lead_gaps tabel (nieuw, zie hieronder)
        gaps.push({
          partner_id: partner.id,
          segment_id: segment.id,
          date: date,
          target_leads: targetLeads,
          current_leads: currentLeads,
          lead_gap: gap,
          source_breakdown: {
            platform_leads: currentLeads.platform,
            own_campaign_leads: currentLeads.ownCampaigns
          }
        });
      }
    }
    
    return gaps;
  }
  
  /**
   * Bereken target leads voor partner in segment
   */
  static async calculateTargetLeads(partner, segment) {
    // Optie 1: Partner heeft expliciet target ingesteld (nieuw veld)
    if (partner.target_leads_per_week) {
      return partner.target_leads_per_week / 7; // per dag
    }
    
    // Optie 2: Gebruik capaciteit (max_open_leads - huidige open leads)
    const capacity = partner.max_open_leads - partner.current_open_leads;
    return capacity / 30; // Verdeel over maand
    
    // Optie 3: Gebruik historische acceptatie rate
    // (later met AI/ML)
  }
  
  /**
   * Bereken huidige leads voor partner in segment
   */
  static async calculateCurrentLeads(partner, segment, date) {
    // Platform leads (via lead routing)
    const platformLeads = await countPlatformLeads(partner.id, segment.id, date);
    
    // Eigen campagne leads (uit partner_marketing_campaigns)
    const ownCampaignLeads = await countOwnCampaignLeads(partner.id, segment.id, date);
    
    return {
      total: platformLeads + ownCampaignLeads,
      platform: platformLeads,
      ownCampaigns: ownCampaignLeads
    };
  }
}
```

### Nieuwe Tabel: `partner_lead_gaps`

**Doel:** Tracken van lead gaps per partner per segment per dag

```sql
CREATE TABLE IF NOT EXISTS public.partner_lead_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.lead_segments(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  -- Targets en actuals
  target_leads_per_day NUMERIC(10,2),
  current_leads_per_day NUMERIC(10,2),
  lead_gap NUMERIC(10,2), -- target - current
  
  -- Breakdown per source
  platform_leads INTEGER DEFAULT 0,
  own_campaign_leads INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(partner_id, segment_id, date)
);
```

**Motivatie:**
- Historische tracking van gaps
- Trend analysis mogelijk
- Input voor AI/ML modellen (later)

---

## 3.2. AI/Regels voor Partner-Acties

### Concept: Regel-gebaseerde Eerste Versie

**Doel:** Automatisch acties voorstellen op basis van lead gaps en budget

**Regels (Geen Black Box AI):**

#### Regel 1: Gap > 0 EN Auto Marketing Enabled

**Conditie:**
- `partner_lead_gap > 0`
- `auto_marketing_enabled = TRUE`
- `marketing_mode IN ('hybrid', 'full_marketing')`

**Acties:**
1. **Budget Check:**
   - Check `monthly_marketing_budget` vs. huidige spend
   - Als budget ruimte: verhoog budget
   - Als geen budget: stel voor om budget te verhogen

2. **Landingspagina Acties:**
   - Als geen LP voor dit segment: stel voor om LP aan te maken
   - Als LP in 'concept': stel voor om te reviewen/publiceren
   - Als LP live maar weinig conversies: stel voor om te optimaliseren

3. **Campagne Acties:**
   - Als geen campagne: stel voor om campagne aan te maken
   - Als campagne 'planned': stel voor om te activeren
   - Als campagne actief: verhoog budget (binnen limieten)
   - Als campagne actief maar hoge CPL: stel voor om keywords/ads te optimaliseren

#### Regel 2: Gap < 0 (Te Veel Leads of Budget Verspilling)

**Conditie:**
- `partner_lead_gap < 0` (meer leads dan target)
- OF `avg_cpl > cpl_target * 1.5` (te dure leads)

**Acties:**
1. **Budget Verlagen:**
   - Verlaag dagelijks budget met 10-20%
   - Pauzeer minst performante AdGroups/keywords

2. **Campagne Optimalisatie:**
   - Stel voor om bepaalde keywords te pauzeren
   - Stel voor om budget te verplaatsen naar betere performing campagnes

#### Regel 3: Budget Limieten

**Conditie:**
- Huidige spend > `monthly_marketing_budget * 0.9` (90% van budget gebruikt)

**Acties:**
- Waarschuw partner (notificatie)
- Stel voor om budget te verhogen OF campagnes te pauzeren

### Service: PartnerMarketingOrchestrator

**Pseudo-code:**

```javascript
class PartnerMarketingOrchestrator {
  /**
   * Genereer marketing acties voor partners met gaps
   * @param {Date} date - Datum voor berekening
   * @returns {Array} Array van actie voorstellen
   */
  static async generateMarketingActions(date = new Date()) {
    // 1. Haal partner gaps op
    const gaps = await PartnerDemandService.calculatePartnerLeadGaps(date);
    
    // 2. Filter partners met auto_marketing_enabled
    const autoMarketingPartners = gaps.filter(gap => 
      gap.partner.auto_marketing_enabled === true
    );
    
    // 3. Voor elke partner met gap:
    const actions = [];
    for (const gap of autoMarketingPartners) {
      // 3a. Check budget ruimte
      const budgetStatus = await checkBudgetStatus(gap.partner);
      
      // 3b. Genereer acties op basis van gap
      if (gap.lead_gap > 0) {
        // Positieve gap: meer leads nodig
        const increaseActions = await generateIncreaseActions(gap, budgetStatus);
        actions.push(...increaseActions);
      } else if (gap.lead_gap < -2) {
        // Negatieve gap: te veel leads of verspilling
        const decreaseActions = await generateDecreaseActions(gap, budgetStatus);
        actions.push(...decreaseActions);
      }
    }
    
    // 4. Sla acties op als 'concept' (niet direct uitvoeren)
    await saveActionsAsConcepts(actions);
    
    return actions;
  }
  
  /**
   * Genereer acties om leads te verhogen
   */
  static async generateIncreaseActions(gap, budgetStatus) {
    const actions = [];
    const partner = gap.partner;
    const segment = gap.segment;
    
    // Actie 1: Check of LP bestaat
    const existingLP = await getPartnerLandingPage(partner.id, segment.id);
    if (!existingLP) {
      actions.push({
        type: 'create_landing_page',
        partner_id: partner.id,
        segment_id: segment.id,
        priority: 'high',
        reason: `Geen LP voor segment ${segment.code}, gap=${gap.lead_gap}`,
        status: 'concept'
      });
    } else if (existingLP.status === 'concept') {
      actions.push({
        type: 'publish_landing_page',
        landing_page_id: existingLP.id,
        priority: 'medium',
        reason: `LP in concept, kan gepubliceerd worden`,
        status: 'concept'
      });
    }
    
    // Actie 2: Check of campagne bestaat
    const existingCampaign = await getPartnerCampaign(partner.id, segment.id, 'google_ads');
    if (!existingCampaign) {
      // Check budget
      if (budgetStatus.hasBudget) {
        actions.push({
          type: 'create_campaign',
          partner_id: partner.id,
          segment_id: segment.id,
          channel: 'google_ads',
          suggested_daily_budget: calculateSuggestedBudget(gap, budgetStatus),
          priority: 'high',
          reason: `Geen campagne, gap=${gap.lead_gap}`,
          status: 'concept'
        });
      }
    } else if (existingCampaign.status === 'active') {
      // Verhoog budget (binnen limieten)
      const suggestedIncrease = calculateBudgetIncrease(gap, existingCampaign);
      if (suggestedIncrease > 0 && budgetStatus.hasBudget) {
        actions.push({
          type: 'increase_campaign_budget',
          campaign_id: existingCampaign.id,
          current_budget: existingCampaign.daily_budget,
          suggested_budget: existingCampaign.daily_budget + suggestedIncrease,
          priority: 'medium',
          reason: `Gap=${gap.lead_gap}, kan budget verhogen`,
          status: 'concept'
        });
      }
    }
    
    return actions;
  }
  
  /**
   * Genereer acties om leads/budget te verlagen
   */
  static async generateDecreaseActions(gap, budgetStatus) {
    // Implementatie: verlaag budget, pauzeer keywords, etc.
    // (vergelijkbaar met increaseActions maar omgekeerd)
  }
  
  /**
   * Sla acties op als concept (voor review)
   */
  static async saveActionsAsConcepts(actions) {
    // Optie 1: Sla op in nieuwe tabel 'ai_marketing_recommendations'
    // Optie 2: Update bestaande records (LP's, campagnes) met status='concept'
    // Optie 3: Beide
    
    for (const action of actions) {
      if (action.type === 'create_landing_page') {
        await createLandingPageConcept(action);
      } else if (action.type === 'create_campaign') {
        await createCampaignConcept(action);
      } else if (action.type === 'increase_campaign_budget') {
        await updateCampaignConcept(action);
      }
      // etc.
    }
  }
}
```

### Nieuwe Tabel: `ai_marketing_recommendations` (Optioneel)

**Doel:** Tracken van AI-voorstellen voor review

```sql
CREATE TABLE IF NOT EXISTS public.ai_marketing_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  segment_id UUID REFERENCES public.lead_segments(id) ON DELETE SET NULL,
  
  -- Actie type
  action_type TEXT NOT NULL, -- 'create_landing_page', 'create_campaign', 'increase_budget', etc.
  
  -- Actie details (JSONB voor flexibiliteit)
  action_details JSONB NOT NULL,
  
  -- Prioriteit en status
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'executed'
  
  -- Reden/context
  reason TEXT,
  lead_gap NUMERIC(10,2), -- Gap op moment van voorstel
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  executed_at TIMESTAMPTZ
);
```

**Motivatie:**
- Transparantie: partners zien wat AI voorstelt
- Review workflow: admin/partner kan goedkeuren/afwijzen
- Historische tracking: welke voorstellen zijn gedaan?

---

## 3.3. Klassen + Bestandsstructuur

### Voorgestelde Structuur

```
src/
  services/
    LeadEngine/
      SegmentDemandPlanner.ts          # Bestaand (segment-level planning)
      PartnerDemandService.ts          # NIEUW (partner-level gap berekening)
      PartnerMarketingOrchestrator.ts  # NIEUW (actie generatie)
      PartnerCampaignService.ts        # NIEUW (campagne management)
      PartnerLandingPageService.ts     # NIEUW (LP management)
  
  models/
    PartnerMarketingProfile.ts        # NIEUW (TypeScript types)
    PartnerLandingPage.ts              # NIEUW
    PartnerMarketingCampaign.ts       # NIEUW
    PartnerLeadGap.ts                 # NIEUW
  
  jobs/
    calculatePartnerLeadStatsDaily.ts # NIEUW (partner stats aggregatie)
    runPartnerDemandPlanningDaily.ts  # NIEUW (gap berekening)
    generateAiPartnerRecommendationsDaily.ts # NIEUW (actie generatie)
    syncPartnerCampaignsDaily.ts      # NIEUW (sync met externe APIs)
  
  integrations/
    googleAds/
      GoogleAdsPartnerClient.ts       # NIEUW (Google Ads API voor partners)
      GoogleAdsCampaignManager.ts     # NIEUW (campagne CRUD)
    metaAds/
      MetaAdsPartnerClient.ts          # NIEUW (toekomstig)
```

### Service Beschrijvingen

#### PartnerDemandService.ts

**Verantwoordelijkheden:**
- Bereken lead gaps per partner per segment
- Aggregeer leads per source (platform vs. eigen campagnes)
- Bereken targets (uit config of capaciteit)

**Methodes:**
- `calculatePartnerLeadGaps(date)` - Hoofdmethode
- `calculateTargetLeads(partner, segment)` - Target berekening
- `calculateCurrentLeads(partner, segment, date)` - Huidige leads
- `getPartnerSegments(partnerId)` - Haal actieve segmenten op

#### PartnerMarketingOrchestrator.ts

**Verantwoordelijkheden:**
- Genereer marketing acties op basis van gaps
- Check budget limieten
- Sla acties op als concept voor review

**Methodes:**
- `generateMarketingActions(date)` - Hoofdmethode
- `generateIncreaseActions(gap, budgetStatus)` - Acties om leads te verhogen
- `generateDecreaseActions(gap, budgetStatus)` - Acties om budget te verlagen
- `saveActionsAsConcepts(actions)` - Sla op voor review
- `checkBudgetStatus(partner)` - Check budget ruimte

#### PartnerCampaignService.ts

**Verantwoordelijkheden:**
- CRUD operaties voor partner campagnes
- Sync met externe APIs (Google Ads, Meta, etc.)
- Budget aanpassingen (binnen limieten)

**Methodes:**
- `createCampaign(partnerId, segmentId, channel, config)` - Nieuwe campagne
- `updateCampaignBudget(campaignId, newBudget)` - Budget aanpassen
- `pauseCampaign(campaignId)` - Pauzeer campagne
- `syncWithGoogleAds(campaignId)` - Sync met Google Ads API
- `getCampaignPerformance(campaignId, dateRange)` - Performance data

#### PartnerLandingPageService.ts

**Verantwoordelijkheden:**
- CRUD operaties voor partner LP's
- AI-content generatie (later)
- Publicatie workflow

**Methodes:**
- `createLandingPage(partnerId, segmentId, config)` - Nieuwe LP
- `generateAIContent(partnerId, segmentId, toneOfVoice)` - AI generatie (later)
- `publishLandingPage(landingPageId)` - Publiceer LP
- `updateLandingPageContent(landingPageId, content)` - Update content

---

## 3.4. UI-Uitbreiding (Alleen Ontwerp)

### Admin → User/Partner Detailpagina

**Nieuwe Tab: "Marketing"**

**Sectie 1: Marketing Profiel**
- **Kaart:** "Marketing Configuratie"
  - Marketing mode dropdown (leads_only, hybrid, full_marketing)
  - Auto marketing toggle (aan/uit)
  - Maandelijks budget input (EUR)
  - Voorkeur kanalen multi-select (Google Ads, Meta Ads, SEO, etc.)
  - Brand color picker
  - Logo upload
  - Tone of voice textarea

**Sectie 2: Leads Overzicht**
- **Kaart:** "Leads via Platform vs Eigen Campagnes"
  - Grafiek: Leads per week (stacked bar: platform vs. eigen)
  - Metrics:
    - Totaal leads deze week
    - Platform leads
    - Eigen campagne leads
    - Target leads
    - Gap (target - totaal)

**Sectie 3: Segmenten**
- **Kaart:** "Actieve Segmenten"
  - Tabel met:
    - Segment (branch + region)
    - Status (primair/secundair)
    - Target leads/week
    - Huidige leads/week
    - Gap
    - Acties (edit, verwijder)

**Sectie 4: Landingspagina's**
- **Kaart:** "Partner Landingspagina's"
  - Tabel met:
    - Path/URL
    - Segment
    - Status (concept/review/live)
    - Views (optioneel)
    - Conversies (optioneel)
    - Acties (edit, preview, publish, archive)

**Sectie 5: Campagnes**
- **Kaart:** "Marketing Campagnes"
  - Tabel met:
    - Kanaal (Google Ads, Meta, etc.)
    - Segment
    - Status (planned/active/paused)
    - Dagelijks budget
    - Totale spend
    - Leads gegenereerd
    - CPL
    - AI managed toggle
    - Acties (edit, pause, sync, view in Google Ads)

**Sectie 6: AI Voorstellen**
- **Kaart:** "AI Marketing Aanbevelingen"
  - Lijst met voorstellen:
    - Type actie (create LP, create campaign, increase budget, etc.)
    - Segment
    - Prioriteit (low/medium/high)
    - Reden/uitleg
    - Status (pending/approved/rejected)
    - Acties (approve, reject, view details)
  - Filter op status (pending/approved/rejected)

---

### Admin → Lead Engine → Segment Detail

**Nieuwe Sectie: "Partner Marketing in dit Segment"**

**Kaart:** "Partners met Marketing in dit Segment"
- Tabel met:
  - Partner naam
  - Marketing mode
  - Auto marketing (aan/uit)
  - Actieve campagnes (aantal)
  - Live LP's (aantal)
  - Totale spend deze maand
  - Leads gegenereerd deze maand
  - Status (actief/inactief)

**Acties:**
- Klik op partner → ga naar partner detailpagina
- Filter op marketing mode
- Sorteer op spend, leads, etc.

---

### Partner Portal (Dashboard)

**Nieuwe Tab: "Marketing"**

**Sectie 1: Overzicht**
- **Kaart:** "Mijn Marketing Status"
  - Marketing mode display
  - Auto marketing toggle (aan/uit)
  - Budget gebruikt deze maand (progress bar)
  - Totale leads deze week (platform + eigen)
  - Gap (target - totaal)

**Sectie 2: Segmenten**
- **Kaart:** "Mijn Segmenten"
  - Lijst met actieve segmenten
  - Per segment:
    - Target leads/week
    - Huidige leads/week
    - Gap
    - Status (primair/secundair)

**Sectie 3: Landingspagina's**
- **Kaart:** "Mijn Landingspagina's"
  - Lijst met LP's
  - Per LP:
    - Path/URL (klikbaar)
    - Segment
    - Status badge
    - Views/conversies (als live)
    - Acties (edit, preview, request review)

**Sectie 4: Campagnes**
- **Kaart:** "Mijn Campagnes"
  - Lijst met campagnes
  - Per campagne:
    - Kanaal badge
    - Segment
    - Status badge
    - Budget display
    - Performance (spend, leads, CPL)
    - Acties (view details, pause, edit)

**Sectie 5: AI Aanbevelingen**
- **Kaart:** "AI Marketing Voorstellen"
  - Lijst met voorstellen
  - Per voorstel:
    - Type actie
    - Segment
    - Prioriteit badge
    - Reden/uitleg
    - Status badge
    - Acties (approve, reject, meer info)

**Sectie 6: Instellingen**
- **Kaart:** "Marketing Instellingen"
  - Marketing mode select
  - Auto marketing toggle
  - Maandelijks budget input
  - Voorkeur kanalen select
  - Brand color picker
  - Logo upload
  - Tone of voice textarea
  - Save button

---

## 3.5. Stappenplan Implementatie

### Stap 1: Dag-/Weekelijkse Job - Partner Stats Berekenen

**Job:** `calculatePartnerLeadStatsDaily.ts`

**Doel:** Aggregeer partner leads per source (platform vs. eigen campagnes)

**Pseudo-code:**
```javascript
async function calculatePartnerLeadStatsDaily() {
  // 1. Haal alle actieve partners op
  const partners = await getActivePartners();
  
  // 2. Voor elke partner:
  for (const partner of partners) {
    // 2a. Tel platform leads (uit leads tabel waar user_id = partner.id)
    const platformLeads = await countPlatformLeads(partner.id, dateRange);
    
    // 2b. Tel eigen campagne leads (uit partner_marketing_campaigns.total_leads)
    const ownCampaignLeads = await sumCampaignLeads(partner.id, dateRange);
    
    // 2c. Sla op in partner_lead_gaps of nieuwe partner_daily_stats tabel
    await savePartnerStats(partner.id, {
      date: today,
      platform_leads: platformLeads,
      own_campaign_leads: ownCampaignLeads,
      total_leads: platformLeads + ownCampaignLeads
    });
  }
}
```

**Cron:** Dagelijks om 01:00 (na lead stats aggregatie)

---

### Stap 2: PartnerDemandService - Gap Berekening

**Job:** `runPartnerDemandPlanningDaily.ts`

**Doel:** Bereken lead gaps per partner per segment

**Pseudo-code:**
```javascript
async function runPartnerDemandPlanningDaily() {
  // 1. Run PartnerDemandService
  const gaps = await PartnerDemandService.calculatePartnerLeadGaps(today);
  
  // 2. Sla gaps op in partner_lead_gaps tabel
  for (const gap of gaps) {
    await upsertPartnerLeadGap(gap);
  }
  
  // 3. Log resultaten
  logger.info(`Calculated ${gaps.length} partner lead gaps`);
}
```

**Cron:** Dagelijks om 02:00 (na partner stats)

---

### Stap 3: PartnerMarketingOrchestrator - Actie Generatie

**Job:** `generateAiPartnerRecommendationsDaily.ts`

**Doel:** Genereer marketing acties op basis van gaps

**Pseudo-code:**
```javascript
async function generateAiPartnerRecommendationsDaily() {
  // 1. Run PartnerMarketingOrchestrator
  const actions = await PartnerMarketingOrchestrator.generateMarketingActions(today);
  
  // 2. Sla acties op als concept
  for (const action of actions) {
    if (action.type === 'create_landing_page') {
      await PartnerLandingPageService.createConcept(action);
    } else if (action.type === 'create_campaign') {
      await PartnerCampaignService.createConcept(action);
    } else if (action.type === 'increase_campaign_budget') {
      await PartnerCampaignService.updateBudgetConcept(action);
    }
    // etc.
  }
  
  // 3. Optioneel: Sla ook op in ai_marketing_recommendations tabel
  await saveRecommendations(actions);
  
  // 4. Stuur notificaties naar partners (optioneel)
  await notifyPartnersOfNewRecommendations(actions);
  
  logger.info(`Generated ${actions.length} marketing recommendations`);
}
```

**Cron:** Dagelijks om 03:00 (na gap berekening)

---

### Stap 4: Admin/Partner Review Workflow

**Doel:** Partners/admins kunnen voorstellen goedkeuren/afwijzen

**UI Flow:**
1. Partner ziet voorstellen in "AI Aanbevelingen" sectie
2. Klik op voorstel → zie details (reden, impact, budget, etc.)
3. Kies: Approve, Reject, of "Meer info"
4. Bij approve:
   - Als LP: status wordt 'review' (admin moet goedkeuren)
   - Als campagne: status wordt 'planned' (admin kan activeren)
   - Als budget: update wordt gepland (admin kan goedkeuren)
5. Bij reject: status wordt 'rejected', voorstel verdwijnt

**Backend:**
- API endpoint: `POST /api/partners/:id/marketing-recommendations/:recId/approve`
- API endpoint: `POST /api/partners/:id/marketing-recommendations/:recId/reject`

---

## Volgende Stap

**FASE 4:** Toestemming vragen ("go") vóór echte wijzigingen

---

## Belangrijke Notitie

**Dit is een functioneel ontwerp; ik schrijf nog geen code.**

Alle beschrijvingen zijn conceptueel en kunnen worden aangepast voordat implementatie start.

