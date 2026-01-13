# Lead Flow Intelligence System - Implementatie Samenvatting

## ✅ Implementatie Voltooid

Het Lead Flow Intelligence System is volledig geïmplementeerd en klaar voor gebruik.

---

## 📁 Aangemaakte Bestanden

### Database Migration
- **`supabase/migrations/20250115000000_lead_flow_intelligence.sql`**
  - 4 nieuwe tabellen: `lead_segments`, `lead_generation_stats`, `lead_segment_plans`, `channel_orchestration_log`
  - Uitbreidingen `leads` tabel: `segment_id`, `source_channel`, `source_campaign_id`, `source_keyword`
  - Helper functions: `calculate_lead_gap()`, `update_lead_gap()`, `get_segment_capacity()`
  - RLS policies voor security

### Services
- **`services/leadSegmentService.js`**
  - Segment management (find/create, assign to leads)
  - Capaciteit berekening via bestaande partner data
  - Regio extractie uit province/postcode

- **`services/leadDemandPlannerService.js`**
  - Target leads berekening (80% van capaciteit)
  - Gap analysis (target - actual)
  - Planning voor alle segmenten

- **`services/channelOrchestratorService.js`**
  - Budget aanpassingen op basis van gaps
  - Safety limits (max 20% wijziging per dag)
  - Google Ads orchestration (placeholder)

### Integrations
- **`integrations/googleAdsClient.js`**
  - Placeholder voor Google Ads API integratie
  - Klaar voor uitbreiding met echte API calls

### Cron Jobs
- **`cron/aggregateLeadStatsDaily.js`**
  - Dagelijkse aggregatie van leads naar stats
  - Gebruikt bestaande partner data voor capaciteit
  - Google Ads stats (placeholder)

- **`cron/runLeadDemandPlanningDaily.js`**
  - Dagelijkse demand planning
  - Berekent targets en gaps voor alle segmenten

- **`cron/adjustGoogleAdsBudgetsDaily.js`**
  - Dagelijkse budget aanpassingen
  - Orchestreert alle segmenten met gaps

### API Endpoints
- **`GET /api/lead-segments`** - Overzicht alle actieve segmenten
- **`GET /api/lead-segments/:id`** - Segment details met capaciteit
- **`POST /api/lead-segments`** - Nieuw segment aanmaken (admin only)
- **`GET /api/lead-segments/:id/stats`** - Stats per segment
- **`GET /api/lead-segments/:id/plans`** - Plans per segment
- **`GET /api/orchestration/status`** - Orchestration status (admin only)

### Integratie
- **`routes/api.js`** - Segment assignment toegevoegd aan lead creation

---

## 🚀 Gebruik

### 1. Database Migration Uitvoeren

Run de migration in Supabase:
```sql
-- Via Supabase Dashboard SQL Editor
-- Of via CLI: supabase migration up
```

### 2. Cron Jobs Instellen

Voeg toe aan je cron scheduler (bijv. via `crontab` of node-cron):

```bash
# Dagelijks om 01:00 - Aggregeer stats
0 1 * * * node /path/to/cron/aggregateLeadStatsDaily.js

# Dagelijks om 02:00 - Demand planning
0 2 * * * node /path/to/cron/runLeadDemandPlanningDaily.js

# Dagelijks om 03:00 - Budget aanpassingen
0 3 * * * node /path/to/cron/adjustGoogleAdsBudgetsDaily.js
```

Of integreer in je bestaande cron systeem (bijv. `server.js` met node-cron).

### 3. Segmenten Aanmaken

Segmenten worden automatisch aangemaakt wanneer leads worden toegewezen, maar je kunt ze ook handmatig aanmaken via de API:

```javascript
POST /api/lead-segments
{
  "branch": "schilder",
  "region": "noord-brabant",
  "country": "NL",
  "description": "Schilders in Noord-Brabant"
}
```

### 4. Monitoring

Bekijk orchestration status:
```javascript
GET /api/orchestration/status?date=2025-01-15
```

Bekijk segment stats:
```javascript
GET /api/lead-segments/:id/stats?start_date=2025-01-01&end_date=2025-01-15
```

---

## 🔧 Configuratie

### LeadDemandPlannerService
- `TARGET_UTILIZATION = 0.8` - 80% van capaciteit als target
- `MIN_TARGET_LEADS = 5` - Minimum aantal leads per dag

### ChannelOrchestratorService
- `MAX_DAILY_BUDGET_CHANGE = 0.20` - Max 20% wijziging per dag
- `MIN_BUDGET = 5.00` - Minimum budget in EUR
- `MAX_BUDGET = 1000.00` - Maximum budget in EUR
- `DEFAULT_CPL = 25.00` - Default Cost Per Lead

Pas deze waarden aan in de service files naar behoefte.

---

## 📊 Hoe Het Werkt

1. **Lead Creation** → Segment wordt automatisch toegewezen op basis van industry + regio
2. **Dagelijkse Aggregatie** (01:00) → Leads worden geaggregeerd naar stats per segment
3. **Demand Planning** (02:00) → Targets en gaps worden berekend
4. **Budget Aanpassingen** (03:00) → Google Ads budgets worden aangepast op basis van gaps

---

## 🔮 Toekomstige Uitbreidingen

### Google Ads API Integratie
- Vervang placeholder in `integrations/googleAdsClient.js`
- Implementeer echte API calls voor budget updates
- Haal echte stats op (spend, clicks, impressions)

### SEO Tracking
- Implementeer SEO stats tracking
- Voeg toe aan `lead_generation_stats`

### Microsite Tracking
- Implementeer microsite stats tracking
- Voeg toe aan `lead_generation_stats`

### AI/LLM Integratie
- Betere target berekeningen met historische data
- Voorspellingen voor seizoenspatronen
- Keyword optimalisatie suggesties

---

## 🐛 Troubleshooting

### Segment wordt niet toegewezen aan lead
- Check of lead `industry_id` en `province`/`postcode` heeft
- Check of er een matching segment bestaat
- Check logs voor errors

### Stats worden niet geaggregeerd
- Check of cron job draait
- Check of leads `segment_id` hebben
- Check database logs voor errors

### Budget aanpassingen werken niet
- Check orchestration status via API
- Check `channel_orchestration_log` tabel
- Check Google Ads client (placeholder geeft altijd success)

---

## 📝 Notities

- **Google Ads integratie is placeholder** - Echte API integratie moet nog worden toegevoegd
- **Segment matching** gebruikt bestaande partner data (`profiles.primary_branch`, `profiles.regions`)
- **Capaciteit berekening** gebruikt bestaande `partner_performance_stats` view
- **Backwards compatible** - Bestaande lead routing blijft werken

---

## ✅ Status

- ✅ Database schema geïmplementeerd
- ✅ Services geïmplementeerd
- ✅ Cron jobs geïmplementeerd
- ✅ API endpoints geïmplementeerd
- ✅ Integratie in lead creation geïmplementeerd
- ⏳ Google Ads API integratie (placeholder)
- ⏳ UI/Dashboard (buiten scope)

---

**Het systeem is klaar voor gebruik!** 🎉

