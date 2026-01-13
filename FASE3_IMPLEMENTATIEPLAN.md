# FASE 3: Secuur Implementatieplan & Architectuur

## Overzicht

Dit plan beschrijft hoe we het **Lead Flow Intelligence System** bouwen, stap voor stap.

---

## 3.1. Stappenplan (Bullet List)

### Stap 1: Database Schema Voorbereiden
- ✅ **FASE 2 voltooid**: SQL schema voorstellen gemaakt
- ⏳ **Nog te doen**: Migrations aanmaken in `supabase/migrations/` (na "go")
- ⏳ **Nog te doen**: Migrations testen in development omgeving

### Stap 2: Aggregatie Jobs (Stats Collection)
- ⏳ **Nog te doen**: Dagelijkse cronjob die `lead_generation_stats` vult
  - Aggregeert leads per segment per dag
  - Haalt Google Ads spend data op (via API of placeholder)
  - Berekent CPL, acceptance rates, etc.
  - Update capacity metrics (aantal actieve partners per segment)

### Stap 3: LeadDemandPlanner Service
- ⏳ **Nog te doen**: TypeScript/JavaScript service die:
  - Per segment leest: actuele stats + capaciteit
  - Berekent: `target_leads_per_day` (op basis van capaciteit)
  - Berekent: `lead_gap = target - actual`
  - Schrijft resultaten naar `lead_segment_plans`

### Stap 4: Channel Orchestrator Service
- ⏳ **Nog te doen**: Skeleton voor Google Ads orchestrator:
  - Mapping: segment ↔ Google Ads campaign ID
  - Logica: budget-aanpassingen binnen veilige grenzen (±20% max per dag)
  - Logging: alle wijzigingen in `channel_orchestration_log`
  - Safety checks: daily budget caps, max wijzigingen

### Stap 5: Segment Assignment Logic
- ⏳ **Nog te doen**: Bij lead creation: automatisch `segment_id` toewijzen
  - Op basis van `industry_id` + `province`/`postcode` van lead
  - Match met bestaande `lead_segments`
  - Fallback: geen segment (optioneel)

### Stap 6: API Endpoints & Dashboard
- ⏳ **Nog te doen**: API endpoints voor:
  - Segment overzicht (`GET /api/lead-segments`)
  - Stats per segment (`GET /api/lead-segments/:id/stats`)
  - Plans per segment (`GET /api/lead-segments/:id/plans`)
  - Orchestration status (`GET /api/orchestration/status`)
- ⏳ **Nog te doen**: Admin dashboard UI (schets/concept):
  - Tab "Leadstroom" / "Growth Engine"
  - Visualisatie: gap per segment, budget trends
  - Manual overrides voor targets

### Stap 7: Logging & Monitoring
- ⏳ **Nog te doen**: Integratie met bestaande `SystemLogService`
- ⏳ **Nog te doen**: Alerts bij grote gaps of orchestration failures

---

## 3.2. Concrete Bestandsstructuur

```
gs-lead-platform/
├── services/
│   ├── leadDemandPlannerService.js          [NIEUW]
│   ├── channelOrchestratorService.js          [NIEUW]
│   └── leadSegmentService.js                  [NIEUW]
│
├── cron/
│   ├── aggregateLeadStatsDaily.js            [NIEUW]
│   ├── runLeadDemandPlanningDaily.js         [NIEUW]
│   └── adjustGoogleAdsBudgetsDaily.js         [NIEUW]
│
├── integrations/
│   └── googleAdsClient.js                     [NIEUW]
│
├── supabase/
│   └── migrations/
│       └── YYYYMMDDHHMMSS_lead_flow_intelligence.sql  [NIEUW]
│
└── routes/
    └── api.js                                 [UITBREIDEN]
        - GET /api/lead-segments
        - GET /api/lead-segments/:id/stats
        - GET /api/lead-segments/:id/plans
        - POST /api/lead-segments (admin only)
        - GET /api/orchestration/status
```

---

## 3.3. Pseudo-code & Architectuur Schets

### 3.3.1. LeadDemandPlannerService

**Locatie:** `services/leadDemandPlannerService.js`

**Verantwoordelijkheden:**
- Leest `lead_generation_stats` per segment
- Berekent target leads op basis van capaciteit
- Berekent gap (target - actual)
- Schrijft naar `lead_segment_plans`

**Pseudo-code:**

```javascript
class LeadDemandPlannerService {
  /**
   * Berekent target leads per dag voor een segment
   * @param {string} segmentId - UUID van het segment
   * @param {Date} date - Datum
   * @returns {Promise<number>} Target aantal leads
   */
  static async calculateTargetLeads(segmentId, date) {
    // 1. Haal capaciteit op: aantal actieve partners × max_leads_per_partner
    const capacity = await this.getSegmentCapacity(segmentId);
    
    // 2. Berekent target: bijv. 80% van capaciteit (configurable)
    const targetUtilization = 0.8; // 80%
    const targetLeads = Math.floor(capacity * targetUtilization);
    
    return targetLeads;
  }

  /**
   * Berekent lead gap voor een segment
   * @param {string} segmentId - UUID van het segment
   * @param {Date} date - Datum
   * @returns {Promise<Object>} Gap analysis
   */
  static async calculateLeadGap(segmentId, date) {
    // 1. Haal stats op
    const stats = await this.getStatsForDate(segmentId, date);
    
    // 2. Bereken target
    const target = await this.calculateTargetLeads(segmentId, date);
    
    // 3. Bereken gap
    const actual = stats.leads_generated || 0;
    const gap = target - actual;
    const gapPercentage = target > 0 ? (gap / target) * 100 : 0;
    
    return {
      target,
      actual,
      gap,
      gapPercentage
    };
  }

  /**
   * Plan een segment voor een datum
   * @param {string} segmentId - UUID van het segment
   * @param {Date} date - Datum
   */
  static async planSegment(segmentId, date) {
    const gapAnalysis = await this.calculateLeadGap(segmentId, date);
    
    // Schrijf naar lead_segment_plans
    await supabaseAdmin
      .from('lead_segment_plans')
      .upsert({
        segment_id: segmentId,
        date: date.toISOString().split('T')[0],
        target_leads_per_day: gapAnalysis.target,
        lead_gap: gapAnalysis.gap,
        lead_gap_percentage: gapAnalysis.gapPercentage,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'segment_id,date'
      });
  }

  /**
   * Plan alle actieve segmenten voor vandaag
   */
  static async planAllSegments(date = new Date()) {
    // Haal alle actieve segmenten op
    const { data: segments } = await supabaseAdmin
      .from('lead_segments')
      .select('id')
      .eq('is_active', true);
    
    // Plan elk segment
    for (const segment of segments) {
      await this.planSegment(segment.id, date);
    }
  }
}
```

---

### 3.3.2. ChannelOrchestratorService

**Locatie:** `services/channelOrchestratorService.js`

**Verantwoordelijkheden:**
- Leest `lead_segment_plans` met gaps
- Voor positieve gaps: verhoog Google Ads budget
- Voor negatieve gaps: verlaag budget (binnen grenzen)
- Log alle wijzigingen

**Pseudo-code:**

```javascript
class ChannelOrchestratorService {
  // Configuratie
  static MAX_DAILY_BUDGET_CHANGE = 0.20; // 20% max wijziging per dag
  static MIN_BUDGET = 5.00; // Minimum budget in EUR
  static MAX_BUDGET = 1000.00; // Maximum budget in EUR

  /**
   * Orchestreer Google Ads budget voor een segment
   * @param {string} segmentId - UUID van het segment
   * @param {Date} date - Datum
   */
  static async orchestrateGoogleAds(segmentId, date) {
    // 1. Haal plan op
    const plan = await this.getPlan(segmentId, date);
    
    if (!plan || !plan.lead_gap) {
      return; // Geen plan of geen gap
    }

    // 2. Bepaal gewenste budget wijziging
    const budgetAdjustment = this.calculateBudgetAdjustment(plan);
    
    if (Math.abs(budgetAdjustment) < 0.01) {
      return; // Te kleine wijziging
    }

    // 3. Haal huidige budget op
    const currentBudget = plan.actual_daily_budget_google_ads || 0;
    const newBudget = this.applySafetyLimits(
      currentBudget + budgetAdjustment,
      currentBudget
    );

    // 4. Voer wijziging uit (via Google Ads API of placeholder)
    const result = await this.updateGoogleAdsBudget(segmentId, newBudget);

    // 5. Log wijziging
    await this.logOrchestration(segmentId, plan.id, {
      channel: 'google_ads',
      action_type: budgetAdjustment > 0 ? 'budget_increase' : 'budget_decrease',
      old_value: currentBudget,
      new_value: newBudget,
      status: result.success ? 'success' : 'failed',
      error_message: result.error
    });

    // 6. Update plan
    await this.updatePlanBudget(segmentId, date, newBudget);
  }

  /**
   * Berekent budget aanpassing op basis van gap
   */
  static calculateBudgetAdjustment(plan) {
    const gap = plan.lead_gap || 0;
    const currentBudget = plan.actual_daily_budget_google_ads || 0;
    const avgCpl = 25.00; // TODO: Haal uit stats of config

    if (gap > 0) {
      // Te weinig leads: verhoog budget
      // Bijv: gap van 10 leads × €25 CPL = €250 extra budget
      return gap * avgCpl;
    } else {
      // Te veel leads: verlaag budget (voorzichtig)
      // Bijv: gap van -5 leads × €25 CPL = -€125 budget reductie
      return gap * avgCpl;
    }
  }

  /**
   * Past safety limits toe op budget wijziging
   */
  static applySafetyLimits(newBudget, currentBudget) {
    // Max 20% wijziging per dag
    const maxChange = currentBudget * this.MAX_DAILY_BUDGET_CHANGE;
    const change = newBudget - currentBudget;
    
    if (Math.abs(change) > maxChange) {
      newBudget = currentBudget + (change > 0 ? maxChange : -maxChange);
    }

    // Min/max absolute grenzen
    newBudget = Math.max(this.MIN_BUDGET, Math.min(this.MAX_BUDGET, newBudget));

    return newBudget;
  }

  /**
   * Update Google Ads budget (placeholder voor nu)
   */
  static async updateGoogleAdsBudget(segmentId, newBudget) {
    // TODO: Integreer met Google Ads API
    // Voor nu: placeholder
    return { success: true, error: null };
  }
}
```

---

### 3.3.3. Aggregatie Job: aggregateLeadStatsDaily

**Locatie:** `cron/aggregateLeadStatsDaily.js`

**Verantwoordelijkheden:**
- Dagelijks (bijv. om 01:00) aggregatie van leads naar stats
- Per segment per dag: tel leads, acceptaties, etc.
- Haal Google Ads data op (placeholder voor nu)
- Update `lead_generation_stats`

**Pseudo-code:**

```javascript
const { supabaseAdmin } = require('../config/supabase');

async function aggregateLeadStatsDaily() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  // Haal alle actieve segmenten op
  const { data: segments } = await supabaseAdmin
    .from('lead_segments')
    .select('id')
    .eq('is_active', true);

  for (const segment of segments) {
    // Aggregeer leads voor dit segment op deze datum
    const stats = await aggregateSegmentStats(segment.id, dateStr);
    
    // Upsert naar lead_generation_stats
    await supabaseAdmin
      .from('lead_generation_stats')
      .upsert({
        segment_id: segment.id,
        date: dateStr,
        ...stats,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'segment_id,date'
      });
  }
}

async function aggregateSegmentStats(segmentId, date) {
  // Tel leads per status
  const { data: leads } = await supabaseAdmin
    .from('leads')
    .select('status, price_at_purchase')
    .eq('segment_id', segmentId)
    .gte('created_at', `${date}T00:00:00`)
    .lt('created_at', `${date}T23:59:59`);

  const stats = {
    leads_generated: leads.length,
    leads_accepted: leads.filter(l => l.status === 'accepted').length,
    leads_rejected: leads.filter(l => l.status === 'rejected').length,
    leads_pending: leads.filter(l => l.status === 'new' || l.status === 'pending').length,
    avg_cpl: calculateAvgCpl(leads),
    // TODO: Haal Google Ads data op via API
    google_ads_spend: 0,
    google_ads_clicks: 0,
    // TODO: Haal capacity data op
    capacity_partners: 0,
    capacity_total_leads: 0
  };

  return stats;
}
```

---

### 3.3.4. Segment Assignment bij Lead Creation

**Integratie in bestaande code:** `routes/api.js` (lead creation endpoint)

**Pseudo-code:**

```javascript
// In lead creation endpoint
async function assignSegmentToLead(lead) {
  // 1. Haal industry en regio op van lead
  const industry = await getIndustry(lead.industry_id);
  const region = extractRegion(lead.province, lead.postcode);

  // 2. Zoek matching segment
  const { data: segment } = await supabaseAdmin
    .from('lead_segments')
    .select('id')
    .eq('branch', industry.name.toLowerCase())
    .eq('region', region)
    .eq('is_active', true)
    .single();

  if (segment) {
    // 3. Update lead met segment_id
    await supabaseAdmin
      .from('leads')
      .update({ segment_id: segment.id })
      .eq('id', lead.id);
  }
}
```

---

## 3.4. Integratie met Bestaande Systemen

### SystemLogService
- Log alle orchestration acties
- Log errors in aggregatie jobs
- Log segment assignments

### LeadAssignmentService
- Gebruik `segment_id` voor betere matching
- Prioriteer partners binnen hetzelfde segment

### Billing System
- Gebruik `segment_id` voor segment-specifieke pricing
- Track revenue per segment

---

## 3.5. AI/LLM Integratie (Later)

**Conceptueel plan (niet nu implementeren):**

1. **Betere Target Berekeningen:**
   - LLM analyseert historische data
   - Voorspelt seizoenspatronen
   - Berekent optimale targets

2. **Keyword Optimalisatie:**
   - LLM suggereert betere keywords per segment
   - Analyseert competitor data

3. **Tekstuele Uitleg:**
   - LLM genereert uitleg waarom budget is aangepast
   - Schrijft rapporten per segment

**Voor nu:** Placeholder comments in code waar AI later kan worden toegevoegd.

---

## 3.6. Testing Strategie

1. **Unit Tests:**
   - `LeadDemandPlannerService.calculateTargetLeads()`
   - `ChannelOrchestratorService.calculateBudgetAdjustment()`

2. **Integration Tests:**
   - Aggregatie job met test data
   - Orchestrator met mock Google Ads API

3. **Manual Testing:**
   - Maak test segmenten
   - Run aggregatie job
   - Verifieer stats
   - Run demand planner
   - Verifieer plans

---

## Volgende Stap

Na goedkeuring van dit implementatieplan, ga ik naar **FASE 4**: Toestemming vragen voordat ik daadwerkelijk code en migrations aanmaak.

