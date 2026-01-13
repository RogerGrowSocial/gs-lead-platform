# Lead Flow Intelligence - Volgende Stappen

## ✅ Wat is al gedaan
- Database schema migration aangemaakt
- Alle services geïmplementeerd
- Cron jobs geïmplementeerd
- API endpoints toegevoegd
- Integratie in lead creation

---

## 🚀 Stap-voor-stap Actieplan

### STAP 1: Database Migration Uitvoeren ⚠️ BELANGRIJK

**Optie A: Via Supabase Dashboard (Aanbevolen)**
1. Ga naar je Supabase project dashboard
2. Open de SQL Editor
3. Kopieer de inhoud van `supabase/migrations/20250115000000_lead_flow_intelligence.sql`
4. Plak in de SQL Editor en voer uit
5. Controleer of alle tabellen zijn aangemaakt:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('lead_segments', 'lead_generation_stats', 'lead_segment_plans', 'channel_orchestration_log');
   ```

**Optie B: Via Supabase CLI**
```bash
cd /path/to/gs-lead-platform
supabase db push
```

**Verificatie:**
- Check of de nieuwe kolommen in `leads` tabel bestaan: `segment_id`, `source_channel`, `source_campaign_id`, `source_keyword`
- Check of de functions bestaan: `calculate_lead_gap`, `update_lead_gap`, `get_segment_capacity`

---

### STAP 2: Cron Jobs Instellen

**Optie A: Via node-cron in server.js (Aanbevolen)**

Voeg toe aan `server.js` (of waar je cron jobs configureert):

```javascript
const cron = require('node-cron');
const aggregateLeadStatsDaily = require('./cron/aggregateLeadStatsDaily');
const runLeadDemandPlanningDaily = require('./cron/runLeadDemandPlanningDaily');
const adjustGoogleAdsBudgetsDaily = require('./cron/adjustGoogleAdsBudgetsDaily');

// Dagelijks om 01:00 - Aggregeer stats
cron.schedule('0 1 * * *', async () => {
  console.log('🔄 Running daily lead stats aggregation...');
  try {
    await aggregateLeadStatsDaily();
  } catch (error) {
    console.error('❌ Error in aggregateLeadStatsDaily:', error);
  }
});

// Dagelijks om 02:00 - Demand planning
cron.schedule('0 2 * * *', async () => {
  console.log('📊 Running daily demand planning...');
  try {
    await runLeadDemandPlanningDaily();
  } catch (error) {
    console.error('❌ Error in runLeadDemandPlanningDaily:', error);
  }
});

// Dagelijks om 03:00 - Budget aanpassingen
cron.schedule('0 3 * * *', async () => {
  console.log('🎯 Running daily budget adjustments...');
  try {
    await adjustGoogleAdsBudgetsDaily();
  } catch (error) {
    console.error('❌ Error in adjustGoogleAdsBudgetsDaily:', error);
  }
});
```

**Optie B: Via system crontab**
```bash
# Voeg toe aan crontab (crontab -e)
0 1 * * * cd /path/to/gs-lead-platform && node cron/aggregateLeadStatsDaily.js >> logs/aggregate.log 2>&1
0 2 * * * cd /path/to/gs-lead-platform && node cron/runLeadDemandPlanningDaily.js >> logs/planning.log 2>&1
0 3 * * * cd /path/to/gs-lead-platform && node cron/adjustGoogleAdsBudgetsDaily.js >> logs/orchestration.log 2>&1
```

---

### STAP 3: Testen - Segment Assignment

**Test 1: Maak een test lead aan**
1. Maak een lead aan via de API of admin interface
2. Zorg dat de lead een `industry_id` en `province` of `postcode` heeft
3. Check of `segment_id` automatisch wordt toegewezen:
   ```sql
   SELECT id, industry_id, province, postcode, segment_id 
   FROM leads 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

**Test 2: Handmatig segment aanmaken**
```bash
curl -X POST http://localhost:3000/api/lead-segments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "schilder",
    "region": "noord-brabant",
    "country": "NL",
    "description": "Test segment"
  }'
```

**Test 3: Segment ophalen**
```bash
curl http://localhost:3000/api/lead-segments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### STAP 4: Testen - Stats Aggregatie

**Handmatig testen:**
```bash
# Run de aggregatie job handmatig
node cron/aggregateLeadStatsDaily.js
```

**Verificatie:**
```sql
SELECT * FROM lead_generation_stats 
ORDER BY date DESC 
LIMIT 10;
```

---

### STAP 5: Testen - Demand Planning

**Handmatig testen:**
```bash
node cron/runLeadDemandPlanningDaily.js
```

**Verificatie:**
```sql
SELECT 
  ls.code,
  lsp.date,
  lsp.target_leads_per_day,
  lsp.lead_gap,
  lsp.lead_gap_percentage
FROM lead_segment_plans lsp
JOIN lead_segments ls ON ls.id = lsp.segment_id
ORDER BY lsp.date DESC, ls.code
LIMIT 20;
```

---

### STAP 6: Testen - Orchestration

**Handmatig testen:**
```bash
node cron/adjustGoogleAdsBudgetsDaily.js
```

**Verificatie:**
```sql
SELECT 
  ls.code,
  lsp.date,
  lsp.actual_daily_budget_google_ads,
  lsp.orchestration_status,
  lsp.orchestration_notes
FROM lead_segment_plans lsp
JOIN lead_segments ls ON ls.id = lsp.segment_id
WHERE lsp.orchestration_status IS NOT NULL
ORDER BY lsp.last_orchestration_at DESC
LIMIT 10;
```

---

### STAP 7: Monitoring Setup

**API Endpoints testen:**

1. **Overzicht segmenten:**
   ```bash
   GET /api/lead-segments
   ```

2. **Segment details:**
   ```bash
   GET /api/lead-segments/:id
   ```

3. **Segment stats:**
   ```bash
   GET /api/lead-segments/:id/stats?start_date=2025-01-01&end_date=2025-01-15
   ```

4. **Orchestration status:**
   ```bash
   GET /api/orchestration/status?date=2025-01-15
   ```

---

## 🔧 Configuratie Aanpassen (Optioneel)

### LeadDemandPlannerService
Pas aan in `services/leadDemandPlannerService.js`:
- `TARGET_UTILIZATION = 0.8` → Aanpassen naar wens (bijv. 0.7 voor 70%)
- `MIN_TARGET_LEADS = 5` → Minimum aantal leads per dag

### ChannelOrchestratorService
Pas aan in `services/channelOrchestratorService.js`:
- `MAX_DAILY_BUDGET_CHANGE = 0.20` → Max 20% wijziging (aanpassen naar wens)
- `MIN_BUDGET = 5.00` → Minimum budget
- `MAX_BUDGET = 1000.00` → Maximum budget
- `DEFAULT_CPL = 25.00` → Default Cost Per Lead (kan later uit stats komen)

---

## 🐛 Troubleshooting

### Probleem: Segment wordt niet toegewezen aan lead
**Oplossing:**
- Check of lead `industry_id` heeft
- Check of lead `province` of `postcode` heeft
- Check logs voor errors
- Test handmatig: `LeadSegmentService.assignSegmentToLead(leadId)`

### Probleem: Stats worden niet geaggregeerd
**Oplossing:**
- Check of cron job draait
- Check of leads `segment_id` hebben
- Check database logs
- Run handmatig: `node cron/aggregateLeadStatsDaily.js`

### Probleem: Geen capaciteit data
**Oplossing:**
- Check of `partner_performance_stats` view bestaat
- Check of partners `primary_branch` en `regions` hebben
- Test function: `SELECT * FROM get_segment_capacity('SEGMENT_ID');`

---

## 📊 Dashboard/UI (Toekomstig)

Voor nu zijn alleen API endpoints beschikbaar. Later kun je een admin dashboard bouwen met:
- Overzicht alle segmenten
- Visualisatie van gaps per segment
- Budget trends
- Orchestration status

---

## ✅ Checklist

- [ ] Database migration uitgevoerd
- [ ] Tabellen gecontroleerd (4 nieuwe tabellen)
- [ ] Functions gecontroleerd (3 nieuwe functions)
- [ ] Cron jobs geconfigureerd
- [ ] Test lead aangemaakt en segment assignment getest
- [ ] Stats aggregatie getest
- [ ] Demand planning getest
- [ ] Orchestration getest
- [ ] API endpoints getest
- [ ] Configuratie aangepast (indien nodig)

---

## 🎯 Klaar!

Als alle stappen zijn doorlopen, draait het Lead Flow Intelligence System volledig automatisch:
- Leads krijgen automatisch segmenten toegewezen
- Dagelijks worden stats geaggregeerd
- Dagelijks worden targets en gaps berekend
- Dagelijks worden budgets aangepast (placeholder voor nu)

**Het systeem is nu operationeel!** 🚀

