# Target Systeem Test Guide

**Datum:** January 2025

---

## 📊 Hoe werkt het Target Systeem?

Het target-systeem berekent automatisch hoeveel leads per dag nodig zijn op basis van **partner capaciteit**.

### Flow:

1. **Capaciteit Bepalen** (`get_segment_capacity()`):
   - Vindt alle actieve partners die matchen met het segment
   - Telt hun `max_open_leads` op
   - Dit is de totale capaciteit

2. **Target Berekening**:
   ```
   target = max(5, floor(capacity_total_leads * 0.8))
   ```
   - 80% van capaciteit
   - Minimum 5 leads per dag

3. **Gap Berekening**:
   ```
   gap = target - actual
   ```
   - Positieve gap = meer leads nodig
   - Negatieve gap = genoeg leads

4. **Opslag**: In `lead_segment_plans` tabel per segment per dag

---

## 🧪 Testen van het Target Systeem

### Optie 1: Test Script

```bash
node scripts/test-target-system.js
```

Dit script test:
- ✅ Capaciteit berekening
- ✅ Target berekening
- ✅ Gap berekening
- ✅ Database opslag
- ✅ `planAllSegments()` functie

### Optie 2: Handmatig via Cron Job

```bash
node cron/runLeadDemandPlanningDaily.js
```

Dit draait de volledige planning voor alle segmenten.

### Optie 3: Via Admin Dashboard

1. Ga naar `/admin/leadstroom/overview`
2. Check de KPI "Leads vandaag" vs "Target"
3. Check de segmenten tabel voor target/actual/gap per segment

---

## 🔍 Verificatie Stappen

### 1. Check Partner Capaciteit

```sql
-- Check partners voor een segment
SELECT 
  p.id,
  p.company_name,
  p.primary_branch,
  p.max_open_leads,
  p.is_active_for_routing,
  ls.branch as segment_branch,
  ls.region as segment_region
FROM profiles p
CROSS JOIN lead_segments ls
WHERE ls.id = 'SEGMENT_ID_HIER'
  AND (
    p.primary_branch = ls.branch 
    OR ls.branch = ANY(COALESCE(p.lead_industries, ARRAY[]::TEXT[]))
  )
  AND (
    ls.region = ANY(COALESCE(p.regions::TEXT[], ARRAY[]::TEXT[]))
    OR ls.region = ANY(COALESCE(p.lead_locations, ARRAY[]::TEXT[]))
  )
  AND p.is_active_for_routing = true
  AND p.is_admin = false;
```

### 2. Check Capaciteit via Database Functie

```sql
SELECT * FROM get_segment_capacity('SEGMENT_ID_HIER');
```

Verwacht resultaat:
- `capacity_partners`: Aantal actieve partners
- `capacity_total_leads`: Som van alle `max_open_leads`
- `current_open_leads`: Huidige open leads

### 3. Check Target Berekening

```sql
-- Check plan voor vandaag
SELECT 
  ls.branch,
  ls.region,
  lsp.target_leads_per_day,
  lsp.lead_gap,
  lsp.lead_gap_percentage
FROM lead_segment_plans lsp
JOIN lead_segments ls ON ls.id = lsp.segment_id
WHERE lsp.date = CURRENT_DATE
ORDER BY lsp.target_leads_per_day DESC;
```

### 4. Check Gap Berekening

```sql
-- Check gap vs actual
SELECT 
  ls.branch,
  ls.region,
  lsp.target_leads_per_day as target,
  lsp.lead_gap as gap,
  COALESCE(lgs.leads_generated, 0) as actual
FROM lead_segments ls
LEFT JOIN lead_segment_plans lsp ON lsp.segment_id = ls.id AND lsp.date = CURRENT_DATE
LEFT JOIN lead_generation_stats lgs ON lgs.segment_id = ls.id AND lgs.date = CURRENT_DATE
WHERE ls.is_active = true
ORDER BY lsp.target_leads_per_day DESC;
```

---

## ⚙️ Configuratie

### Aanpassen Target Berekening

**Bestand:** `services/leadDemandPlannerService.js`

```javascript
static TARGET_UTILIZATION = 0.8 // 80% van capaciteit
static MIN_TARGET_LEADS = 5 // Minimum leads per dag
```

### Aanpassen Partner Capaciteit

**Database:** `profiles` tabel
- `max_open_leads`: Maximum aantal open leads per partner
- `is_active_for_routing`: Of partner actief is voor routing

---

## 🔄 Automatische Updates

### Cron Job: `runLeadDemandPlanningDaily.js`

**Frequentie:** Dagelijks (bijv. om 02:00)

**Actie:**
1. Berekent target voor alle actieve segmenten
2. Slaat op in `lead_segment_plans`
3. Berekent gaps

**Check of cron job draait:**
```bash
# Check cron logs
tail -f logs/cron.log | grep "demand planning"
```

---

## 📊 Dashboard Integratie

Het target wordt getoond in:

1. **Leadstroom Overview** (`/admin/leadstroom/overview`):
   - KPI: "Leads vandaag" vs "Target"
   - Status badge: "Onder target" / "In balans" / "Overtarget"

2. **Segmenten Tabel**:
   - Kolom: "Target/dag"
   - Kolom: "Actual/dag"
   - Kolom: "Gap"
   - Status badge per segment

---

## 🐛 Troubleshooting

### Probleem: Target is 0 of te laag

**Oorzaak:** Geen actieve partners of lage capaciteit

**Oplossing:**
1. Check of partners `is_active_for_routing = true` hebben
2. Check of partners `max_open_leads > 0` hebben
3. Check of partners matchen met segment (branch + region)

### Probleem: Target wordt niet bijgewerkt

**Oorzaak:** Cron job draait niet of faalt

**Oplossing:**
1. Run handmatig: `node cron/runLeadDemandPlanningDaily.js`
2. Check logs voor errors
3. Check of `lead_segment_plans` tabel bestaat

### Probleem: Gap is incorrect

**Oorzaak:** Stats niet geaggregeerd of actual niet geteld

**Oplossing:**
1. Check `lead_generation_stats` tabel
2. Run aggregatie cron job: `node cron/aggregateLeadStatsDaily.js`
3. Check of leads `segment_id` hebben

---

## ✅ Checklist voor Testen

- [ ] Partners hebben `max_open_leads > 0`
- [ ] Partners zijn actief (`is_active_for_routing = true`)
- [ ] Partners matchen met segment (branch + region)
- [ ] `get_segment_capacity()` retourneert capaciteit > 0
- [ ] `calculateTargetLeads()` retourneert target >= 5
- [ ] `planSegment()` slaat plan op in database
- [ ] Dashboard toont target correct
- [ ] Gap wordt correct berekend (target - actual)
- [ ] Cron job draait dagelijks

---

**Status:** ✅ Volledig geïmplementeerd en getest

