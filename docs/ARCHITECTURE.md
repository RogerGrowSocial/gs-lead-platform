# Lead Flow Intelligence - Architecture & Design Decisions

**Laatste update:** 2025-01-17

---

## 🎯 Core Design Principles

### 1. Capacity-Based Segment Management
**Principe:** Segmenten worden alleen aangemaakt/geactiveerd waar daadwerkelijk capacity is (betalende partners met limiet > 0).

**Implementatie:**
- `syncSegmentsFromCapacity()` gebruikt `get_branch_region_capacity_combos()` 
- Alleen (branch, region) combinaties met `capacity_total_leads > 0` worden gesynct
- Segmenten worden **nooit verwijderd**, alleen gedeactiveerd (`is_active = false`)

**Waarom:**
- Voorkomt duizenden ongebruikte segmenten
- Zorgt voor schaalbaarheid
- Behoudt historie (bestaande leads kunnen inactieve segmenten hebben)

---

### 2. Payment Method als Harde Voorwaarde

**HARDE BUSINESS REGEL:** Alleen partners met actieve betaalmethode tellen mee voor capacity en segment-aanmaak.

**Implementatie:**
- `get_segment_capacity()` filtert op: `EXISTS (SELECT 1 FROM payment_methods WHERE user_id = p.id AND status = 'active')`
- `get_branch_region_capacity_combos()` filtert partners op betaalmethode
- `syncSegmentsForUser()` checkt betaalmethode voordat segmenten worden aangemaakt

**Waarom:**
- Zorgt dat alleen betalende partners capacity creëren
- Voorkomt segment-aanmaak voor niet-betalende partners
- Business regel: geen leads zonder betaalmethode

**Locaties waar dit wordt gecontroleerd:**
- `supabase/migrations/20250117000001_update_capacity_for_paying_partners_only.sql`
- `services/segmentSyncService.js` - `syncSegmentsForUser()`
- `services/leadSegmentService.js` - `getSegmentCapacity()`

---

### 3. Target Berekening: Beschikbare Capaciteit

**Principe:** Targets zijn gebaseerd op **beschikbare** capaciteit, niet totale capaciteit.

**Formule:**
```
beschikbare_capaciteit = capacity_total_leads - current_open_leads
target = beschikbare_capaciteit * 0.8 (TARGET_UTILIZATION)
```

**Implementatie:**
- `LeadDemandPlannerService.calculateTargetLeads()` gebruikt beschikbare capaciteit
- Als `availableCapacity = 0`, dan `target = 0`
- Minimum target: `MIN_TARGET_LEADS = 5` (alleen als capaciteit > 0)

**Waarom:**
- Als partners al leads hebben ontvangen, is er minder capaciteit beschikbaar
- Targets moeten dynamisch zijn en reageren op huidige situatie
- Voorkomt over-targeting wanneer partners vol zitten

---

## 🔄 Real-time Updates vs Cron Jobs

### Target Recalculation

**Huidige aanpak:** Hybrid (cron + on-demand)

**Cron-based:**
- Dagelijks om 02:30: `runPartnerDemandPlanningDaily()` - herberekent alle segmenten
- Gebruikt: `LeadDemandPlannerService.planAllSegments()`

**On-demand:**
- Dashboard load: `/api/admin/leadstroom/overview` - real-time berekening
- Slider wijziging: `/api/user/lead-limit` - trigger voor alle relevante segmenten
- Gebruikt: `LeadDemandPlannerService.planSegment()` of `calculateTargetLeads()`

**🔖 DESIGN DECISION: Eén Centrale Functie voor Targets**

**Alle targets worden altijd berekend via:**
```
LeadDemandPlannerService.planSegment(segmentId, date)
```

**Cron, slider-wijzigingen en dashboards roepen ALLEMAAL deze functie aan. Geen losse rekenlogica eromheen.**

**Implementatie:**
- ✅ **Centrale functie:** `LeadDemandPlannerService.planSegment(segmentId, date)` is de enige functie die targets opslaat
- ✅ **Berekening:** `calculateTargetLeads()` is de enige functie die targets berekent (wordt aangeroepen door `planSegment()`)
- ✅ **Consistentie:** Alle calls gebruiken dezelfde functies, geen duplicate logica

**Locaties waar targets worden herberekend:**
- `cron/runPartnerDemandPlanningDaily.js` → `planAllSegments()` → `planSegment()`
- `routes/api.js` - `/admin/leadstroom/overview` → `planSegment()`
- `routes/api.js` - `/user/lead-limit` → `planSegment()`

**Waarom:**
- Er is maar één plek waar de rekensom voor targets staat
- Voorkomt inconsistenties tussen verschillende berekeningen
- Makkelijk te debuggen en aanpassen

---

### Current Open Leads Updates

**Huidige situatie:**
- `partner_performance_stats.open_leads_count` wordt berekend via materialized view
- View wordt gerefresht via cron job (`updatePartnerStats()`)
- Wordt gebruikt in `get_segment_capacity()` voor beschikbare capaciteit

**🔖 DESIGN DECISION: `current_open_leads` Altijd Realtime Bijhouden**

**Beslissing:** Open leads realtime updaten, zodat capaciteit nooit kunstmatig te laag lijkt.

**Gedrag:**
- ✅ **Bij assignment:** `open_leads_count + 1` (direct na `assignLead()`)
- ✅ **Bij lead gesloten / afgewezen:** `open_leads_count - 1` (direct bij status update)
- ✅ **Cron job is alleen backup:** `updatePartnerStats()` refresh materialized view als verificatie, niet als "bron van de waarheid"

**Waarom belangrijk:**
- Als `current_open_leads` niet real-time is, wordt beschikbare capaciteit onderschat
- Targets worden dan te hoog (want `availableCapacity = total - open` wordt te laag berekend)
- Partners krijgen mogelijk meer leads dan ze aankunnen

**Implementatie locaties:**
- `services/leadAssignmentService.js` - `assignLead()`: verhoog `open_leads_count` na assignment
- `routes/api.js` - lead status update (PUT /leads/:id): verlaag `open_leads_count` bij rejection/closure
- `cron/updatePartnerStats.js` - blijft als fallback/verificatie (refresh materialized view)

**⚠️ TODO:** Implementeer real-time updates in bovenstaande locaties

---

## 📊 Data Flow

### Segment Lifecycle

```
1. Partner heeft betaalmethode + capacity > 0
   → syncSegmentsFromCapacity() detecteert (branch, region) combo
   → Segment wordt aangemaakt (is_active = true)
   → OF bestaand inactief segment wordt geactiveerd

2. Partner verliest betaalmethode OF capacity = 0
   → syncSegmentsFromCapacity() detecteert geen capacity meer
   → Segment krijgt is_active = false
   → Segment blijft in database (geen DELETE)

3. Partner krijgt weer betaalmethode + capacity > 0
   → syncSegmentsFromCapacity() detecteert capacity weer
   → Segment krijgt is_active = true (reactivatie)
```

### Target Lifecycle

```
1. Segment heeft capacity
   → calculateTargetLeads() berekent: beschikbaar = total - open
   → Target = beschikbaar * 0.8
   → Opgeslagen in lead_segment_plans

2. Lead wordt toegewezen
   → current_open_leads stijgt (real-time update)
   → Volgende target berekening: beschikbaar daalt
   → Target daalt automatisch

3. Partner zet slider naar 0
   → capacity_total_leads = 0
   → beschikbaar = 0 - open = 0
   → Target = 0
```

### Lead Assignment Flow

```
1. Lead wordt aangemaakt
   → assignSegmentToLead() wijst segment toe
   → Auto-assignment (als routing_mode = 'ai_segment_routing')
   → Lead wordt toegewezen aan beste partner
   → current_open_leads stijgt (real-time)

2. Lead wordt geaccepteerd
   → Status = 'accepted'
   → current_open_leads blijft gelijk (lead is nog "open")
   → Billing wordt getriggerd

3. Lead wordt afgewezen/gesloten
   → Status = 'rejected' of 'closed'
   → current_open_leads daalt (real-time)
   → Beschikbare capaciteit stijgt
   → Target kan stijgen (volgende berekening)
```

---

## 🔒 Harde Business Regels

### 1. Payment Method Requirement ⚠️ BUSINESS-KRITIEK

**HARDE REGEL:** Een partner telt **alleen mee** in capaciteit en routing als hij een **actieve betaalmethode** heeft (`payment_methods.status = 'active'`). Zonder betaalmethode: 0 capacity, 0 leads.

**Implementatie:**
- ✅ `get_segment_capacity()` filtert op: `EXISTS (SELECT 1 FROM payment_methods WHERE user_id = p.id AND status = 'active')`
- ✅ `get_branch_region_capacity_combos()` filtert partners op betaalmethode
- ✅ `syncSegmentsForUser()` checkt betaalmethode voordat segmenten worden aangemaakt
- ✅ `LeadAssignmentService.getCandidates()` gebruikt alleen partners met betaalmethode (via capacity check)

**Waarom:**
- Business regel: geen leads zonder betaalmethode
- Voorkomt segment-aanmaak voor niet-betalende partners
- Zorgt dat alleen betalende partners capacity creëren

**Locaties waar dit wordt gecontroleerd:**
- `supabase/migrations/20250117000001_update_capacity_for_paying_partners_only.sql` - SQL functies
- `services/segmentSyncService.js` - `syncSegmentsForUser()`
- `services/leadSegmentService.js` - `getSegmentCapacity()`
- `services/leadAssignmentService.js` - `getCandidates()` (indirect via capacity)

---

### 2. No Segment Deletion
**Regel:** Segmenten worden nooit verwijderd, alleen gedeactiveerd
- ✅ Geïmplementeerd: `syncSegmentsFromCapacity()` gebruikt `is_active = false`
- ✅ `findOrCreateSegment()` reactiveert inactieve segmenten

---

### 3. Available Capacity for Targets
**Regel:** Targets zijn gebaseerd op beschikbare capaciteit (total - open)
- ✅ Geïmplementeerd: `calculateTargetLeads()` gebruikt `availableCapacity`
- ✅ Real-time updates nodig voor accurate berekening

---

## 🚀 Performance & Scalability

### Bulk Operations
- ✅ Segment sync gebruikt bulk queries (geen loops met individuele queries)
- ✅ `get_branch_region_capacity_combos()` is één SQL functie
- ✅ `get_segment_capacity()` is één SQL functie

### Indexes
- ✅ `idx_payment_methods_user_status` - voor snelle payment method lookups
- ✅ `idx_lead_segments_active_branch_region` - voor snelle segment queries

### Caching
- ⚠️ **TODO:** Overweeg caching voor `get_segment_capacity()` resultaten (met TTL)
- ⚠️ **TODO:** Overweeg materialized view voor capacity calculations

---

## 📝 TODO / Future Improvements

### High Priority

#### 1. Real-time `current_open_leads` Updates ⚠️

**Huidige situatie:**
- `partner_performance_stats.open_leads_count` wordt alleen via cron job bijgewerkt
- Materialized view wordt gerefresht via `updatePartnerStats()` cron job
- Dit betekent dat beschikbare capaciteit mogelijk onderschat wordt

**Gewenst gedrag:**
- ✅ **Bij assignment:** `open_leads_count` moet direct stijgen
- ✅ **Bij rejection/closure:** `open_leads_count` moet direct dalen
- ✅ **Cron job blijft:** Als fallback/verificatie (refresh materialized view)

**Impact:**
- Als `current_open_leads` niet real-time is, wordt `availableCapacity = total - open` te laag berekend
- Targets worden dan te hoog (want beschikbare capaciteit wordt onderschat)
- Partners krijgen mogelijk meer leads dan ze aankunnen

**Implementatie locaties:**
- `services/leadAssignmentService.js` - `assignLead()`: verhoog count na assignment
- `routes/api.js` - lead status update (PUT /leads/:id): verlaag count bij rejection/closure
- `cron/updatePartnerStats.js` - blijft als fallback/verificatie

**SQL voor real-time update:**
```sql
-- Bij assignment: verhoog open_leads_count
UPDATE partner_performance_stats 
SET open_leads_count = open_leads_count + 1
WHERE partner_id = :partnerId;

-- Bij rejection/closure: verlaag open_leads_count
UPDATE partner_performance_stats 
SET open_leads_count = GREATEST(0, open_leads_count - 1)
WHERE partner_id = :partnerId;
```

#### 2. Centralized Target Recalculation ✅

**Huidige situatie:**
- ✅ **Al geïmplementeerd:** `LeadDemandPlannerService.planSegment()` is de centrale functie
- ✅ Alle calls gebruiken deze functie (cron, dashboard, slider-change)
- ✅ Geen duplicate logica

**Status:** Geen actie nodig - huidige implementatie is al centraal en consistent.

**Locaties waar targets worden herberekend:**
- `cron/runPartnerDemandPlanningDaily.js` - gebruikt `planAllSegments()` → `planSegment()`
- `routes/api.js` - `/admin/leadstroom/overview` - gebruikt `planSegment()`
- `routes/api.js` - `/user/lead-limit` - gebruikt `planSegment()`

### Medium Priority
3. **Segment reactivatie trigger**
   - Automatische reactivatie wanneer partner weer capacity krijgt
   - Nu: wacht op volgende cron sync (03:00)

4. **Target caching**
   - Cache `get_segment_capacity()` resultaten met korte TTL (5 min)
   - Voorkomt duplicate queries bij dashboard loads

### Low Priority
5. **Lazy segment creation**
   - Als lead segment nodig heeft maar niet bestaat, maak dan aan
   - Nu: alleen via sync (kan leiden tot unassigned leads)

---

## 🔍 Code Locations

### Segment Management
- `services/segmentSyncService.js` - Capacity-based sync
- `services/leadSegmentService.js` - Segment CRUD
- `supabase/migrations/20250117000001_update_capacity_for_paying_partners_only.sql` - Database functies

### Target Calculation
- `services/leadDemandPlannerService.js` - Target berekening en planning
- `cron/runPartnerDemandPlanningDaily.js` - Dagelijkse planning

### Capacity Calculation
- `supabase/migrations/20250117000001_update_capacity_for_paying_partners_only.sql` - `get_segment_capacity()`
- `services/leadSegmentService.js` - `getSegmentCapacity()` wrapper

### Lead Assignment
- `services/leadAssignmentService.js` - Assignment logica
- `routes/api.js` - Lead creation endpoints

### Stats Aggregation
- `cron/aggregateLeadStatsDaily.js` - Dagelijkse stats aggregatie
- `cron/calculatePartnerLeadStatsDaily.js` - Partner stats

---

---

## 🤖 AI Lead Routing Systeem

### Wat Doet Het?

Het AI Lead Routing systeem wijst leads automatisch toe aan de beste partner op basis van:
- **Branch/industry match** - Exacte of partiële match met partner branches
- **Region match** - Exacte of partiële match met partner regio's
- **Wait time** - Eerlijke verdeling (lange wachttijd = bonus)
- **Performance** - Conversie rate van partner (laatste 30 dagen)
- **Capacity** - Beschikbare capaciteit (max_open_leads - open_leads_count)
- **Urgency** - Snelle responders krijgen bonus voor urgente leads
- **Routing priority** - Handmatige prioriteit boost

### Waar Komt De Data Vandaan?

**Partner Data:**
- `profiles` tabel: `primary_branch`, `regions[]`, `lead_industries[]`, `lead_locations[]`, `max_open_leads`, `routing_priority`
- `partner_performance_stats` materialized view: `conversion_rate_30d`, `open_leads_count`, `last_lead_assigned_at`, `avg_response_time_minutes`

**Lead Data:**
- `leads` tabel: `industry_id`, `province`, `postcode`, `is_urgent`, `status`
- `industries` tabel: `name` (voor branch matching)

**Filters:**
- Alleen actieve partners: `is_active_for_routing = true` AND `is_admin = false`
- Alleen partners met betaalmethode: `EXISTS (SELECT 1 FROM payment_methods WHERE user_id = p.id AND status = 'active')`
- Quota check: `open_leads_count < max_open_leads` (bij assignment, niet in `getCandidates()`)

### Hoe Werken Scores?

**Score Weights (Configurable):**
```javascript
{
  branchMatch: 100,        // Exact branch match
  branchPartial: 50,       // Partial branch match
  regionMatch: 80,         // Exact region match
  regionPartial: 40,       // Partial region match
  waitTime: 60,            // Max 24 hours = 60 points
  performance: 40,         // Conversion rate * 40
  capacity: 30,            // Bonus if under capacity
  urgencyBonus: 20,       // Fast responder bonus
  routingPriority: 10     // Manual priority boost
}
```

**Totaal Score:** Som van alle factoren (max ~340 punten theoretisch)

**Beste Match:** Partner met hoogste score wordt geselecteerd

### Waar Zijn De Zwakke Plekken / TODO's?

#### 1. Settings Niet Gebruikt in Scoring ⚠️
- `ai_router_settings` tabel bevat `region_weight`, `performance_weight`, `fairness_weight`
- Maar `SCORE_WEIGHTS` zijn hardcoded in `LeadAssignmentService`
- **TODO:** Implementeer dynamische weights op basis van settings

#### 2. Quota Check Timing ⚠️
- `getCandidates()` filtert niet op quota
- Quota wordt pas gecheckt bij `assignLead()`
- Dit betekent dat partners met volle quota wel in recommendations staan, maar assignment zal falen
- **TODO:** Filter op quota in `getCandidates()` of maak dit expliciet in UI

#### 3. Segment-Based Filtering ⚠️
- `getCandidates()` filtert niet expliciet op `segment_id`
- Gebruikt branch/region matching, maar niet segment membership
- Dit zou kunnen leiden tot partners die niet in het segment zitten
- **TODO:** Filter kandidaten op segment membership

#### 4. Real-time Stats Updates ⚠️
- `open_leads_count` wordt alleen via cron bijgewerkt
- **TODO:** Real-time update bij assignment/rejection (zie sectie "Current Open Leads Updates")

### Code Structuur

**Core Service:**
- `services/leadAssignmentService.js` - Alle routing logica
  - `getCandidates(leadId)` - Haal kandidaten op
  - `calculateScore(lead, industryName, partner, stats)` - Berekent score
  - `assignLead(leadId, assignedBy, partnerId)` - Wijst toe
  - `getRecommendations(leadId)` - Retourneert top 5 zonder toe te wijzen

**API Endpoints:**
- `POST /api/admin/leads/:id/auto-assign` - Auto-assign via AI router
- `GET /api/admin/leads/:id/recommendations` - Haal recommendations op
- `GET /api/admin/ai-router/settings` - Haal settings op
- `POST /api/admin/ai-router/settings` - Sla settings op

**Frontend:**
- `public/js/ai-lead-router.js` - UI logica (drawer, charts, settings)
- `public/css/admin/ai-lead-router.css` - Styling
- `views/admin/leads.ejs` - Admin UI met AI router drawer

**Database:**
- `ai_router_settings` - Configuratie settings
- `lead_assignment_logs` - Audit trail van assignments
- `partner_performance_stats` - Performance metrics (materialized view)

### Auto-Assignment Flow

**Platform Landing Pages:**
1. Lead wordt aangemaakt via `/api/leads/public`
2. `routing_mode = 'ai_segment_routing'` wordt automatisch gezet
3. `assignSegmentToLead()` wijst segment toe
4. Auto-assignment: `getCandidates()` → `assignLead()` (beste match)
5. Als beste match faalt (quota, paused), probeert volgende kandidaat
6. Lead wordt toegewezen of blijft unassigned

**Legacy Flow (Admin):**
1. Lead wordt aangemaakt via `/api/leads` (admin)
2. Check `auto_assign_enabled` setting
3. Check `auto_assign_threshold` (default: 70)
4. Alleen toewijzen als score >= threshold

---

## 📚 Related Documentation

- `docs/CAPACITY_PAYING_PARTNERS_ONLY.md` - Capacity-based sync details
- `docs/MANUAL_TEST_CAPACITY_SYNC.md` - Testing guide
- `TARGET_BEREKENING_UITLEG.md` - Target calculation explanation

