# Target Berekening Uitleg

**Datum:** January 2025

---

## 📊 Hoe wordt het Target bepaald?

Het target voor leads per dag wordt berekend op basis van **segment capaciteit** en wordt opgeslagen in de `lead_segment_plans` tabel.

---

## 🔄 Berekening Flow

### Stap 1: Segment Capaciteit Bepalen

**Database functie:** `get_segment_capacity(segment_id)`

Deze functie berekent de totale capaciteit voor een segment door:

1. **Partners vinden** die matchen met het segment:
   - `primary_branch` matcht met segment `branch` OF
   - Segment `branch` zit in `lead_industries` array
   - Segment `region` zit in `regions` OF `lead_locations` array
   - Partner is actief (`is_active_for_routing = true`)
   - Partner is geen admin (`is_admin = false`)

2. **Capaciteit berekenen**:
   ```sql
   capacity_partners = COUNT(DISTINCT partners)
   capacity_total_leads = SUM(partners.max_open_leads)
   current_open_leads = SUM(partner_performance_stats.open_leads_count)
   ```

**Voorbeeld:**
- Segment: `schilder_noord-brabant`
- 10 actieve partners met `max_open_leads` van respectievelijk: 5, 10, 8, 12, 6, 15, 7, 9, 11, 4
- `capacity_total_leads` = 5 + 10 + 8 + 12 + 6 + 15 + 7 + 9 + 11 + 4 = **87 leads**

---

### Stap 2: Target Leads Bepalen

**Service:** `LeadDemandPlannerService.calculateTargetLeads()`

**Formule:**
```javascript
target = max(MIN_TARGET_LEADS, floor(capacity_total_leads * TARGET_UTILIZATION))
```

**Constants:**
- `TARGET_UTILIZATION = 0.8` (80% van capaciteit)
- `MIN_TARGET_LEADS = 5` (minimum per dag)

**Voorbeeld:**
- `capacity_total_leads` = 87
- `target = max(5, floor(87 * 0.8))`
- `target = max(5, 69)`
- **Target = 69 leads per dag**

---

### Stap 3: Opslag in Database

**Tabel:** `lead_segment_plans`

Het target wordt opgeslagen per segment per dag:
- `segment_id` - Welk segment
- `date` - Voor welke datum
- `target_leads_per_day` - Het berekende target
- `lead_gap` - Verschil tussen target en actual (wordt later berekend)

**Unieke constraint:** Eén plan per segment per dag

---

## 🔄 Wanneer wordt Target bijgewerkt?

### Automatisch (Cron Job)
- **Functie:** `LeadDemandPlannerService.planAllSegments()`
- **Frequentie:** Dagelijks (via cron job)
- **Actie:** Berekent target voor alle actieve segmenten voor vandaag

### Handmatig
- Via `LeadDemandPlannerService.planSegment(segmentId, date)`
- Kan worden aangeroepen vanuit admin UI of API

---

## 📈 Target wordt gebruikt voor:

1. **Gap Analyse:**
   - `gap = target - actual`
   - Positieve gap = meer leads nodig
   - Negatieve gap = genoeg leads

2. **Marketing Orchestratie:**
   - Als `gap > MIN_GAP_FOR_NEW_PAGE` (3) → genereer landing page recommendations
   - Als `gap > 5` → genereer quote page recommendations
   - Als `gap > 7` → genereer spoed page recommendations

3. **Dashboard Statistieken:**
   - Toont target vs actual in Leadstroom overview
   - Status badge (on track / achterstand / overschot)

---

## ⚙️ Configuratie

**Aanpasbaar in code:**
- `TARGET_UTILIZATION = 0.8` (80%) - in `services/leadDemandPlannerService.js`
- `MIN_TARGET_LEADS = 5` - in `services/leadDemandPlannerService.js`

**Aanpasbaar per partner:**
- `max_open_leads` in `profiles` tabel bepaalt individuele capaciteit
- `target_leads_per_week` in `partner_segments` tabel (optioneel, overschrijft berekening)

---

## 🔍 Waar wordt Target opgehaald?

**API Endpoint:** `GET /api/admin/leadstroom/overview`

**Code flow:**
1. Haalt `lead_segment_plans` op voor vandaag
2. Voor elk segment: `plan.target_leads_per_day`
3. Totaal target = som van alle segment targets

**Als geen plan bestaat:**
- Target wordt real-time berekend via `calculateTargetLeads()`
- Maar wordt NIET automatisch opgeslagen (alleen via cron job)

---

## 💡 Belangrijke Notities

1. **Target is dynamisch:**
   - Verandert als partners capaciteit aanpassen (`max_open_leads`)
   - Verandert als partners actief/inactief worden
   - Wordt dagelijks herberekend

2. **Minimum target:**
   - Zelfs als capaciteit laag is, minimum 5 leads per dag
   - Zorgt ervoor dat kleine segmenten ook aandacht krijgen

3. **80% utilization:**
   - Doel: niet 100% vol boeken (ruimte voor variatie)
   - Realistisch target dat haalbaar is

4. **Real-time vs Aggregated:**
   - Target wordt opgeslagen in `lead_segment_plans` (aggregated)
   - Actual leads worden real-time geteld uit `leads` tabel
   - Gap = target (aggregated) - actual (real-time)

---

## 📝 Voorbeeld Scenario

**Segment:** Schilder in Noord-Brabant

**Partners:**
- Partner A: `max_open_leads = 10`
- Partner B: `max_open_leads = 15`
- Partner C: `max_open_leads = 8`
- Partner D: `max_open_leads = 12`

**Capaciteit:**
- `capacity_total_leads = 10 + 15 + 8 + 12 = 45`

**Target:**
- `target = max(5, floor(45 * 0.8))`
- `target = max(5, 36)`
- **Target = 36 leads per dag**

**Als vandaag 20 leads zijn gegenereerd:**
- `gap = 36 - 20 = 16`
- Status: **Achterstand** (16 leads tekort)
- Orchestrator zal recommendations genereren voor nieuwe landing pages

---

**Status:** ✅ Volledig geïmplementeerd en actief

