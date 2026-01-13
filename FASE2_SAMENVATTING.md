# FASE 2: Voorstel Nieuw SQL Schema - Samenvatting

## Status: ✅ VOORSTEL ALLEEN (GEEN UITVOERING)

**Belangrijk:** Dit zijn alleen voorstellen; ik maak nog geen migrations aan en voer ze nog niet uit.

---

## Voorgestelde Nieuwe Tabellen

### 1. `lead_segments`
**Doel:** Definieer segmenten (branche + regio combinaties)

**Kernvelden:**
- `code` (TEXT, UNIQUE) - Unieke identifier zoals 'schilder_noord_brabant'
- `branch` (TEXT) - Branche (bijv. 'schilder', 'dakdekker')
- `region` (TEXT) - Regio (bijv. 'noord-brabant', 'zuid-holland')
- `country` (TEXT, default 'NL')
- `postal_prefixes` (TEXT[]) - Optionele postcode prefixes
- `is_active` (BOOLEAN) - Status van het segment

**Motivatie:** 
- Generieke structuur (geen hard-coded branches)
- Unieke constraint voorkomt dubbele actieve segmenten
- Uitbreidbaar naar andere landen

---

### 2. `lead_generation_stats`
**Doel:** Dagelijkse statistieken per segment

**Kernvelden:**
- `segment_id` (FK → `lead_segments`)
- `date` (DATE)
- `leads_generated`, `leads_accepted`, `leads_rejected`, `leads_pending` (INTEGER)
- `avg_cpl` (NUMERIC) - Average Cost Per Lead
- `google_ads_spend`, `google_ads_clicks`, `google_ads_impressions` (NUMERIC/INTEGER)
- `seo_clicks`, `seo_visits` (INTEGER)
- `microsite_visits`, `microsite_leads` (INTEGER)
- `capacity_partners`, `capacity_total_leads` (INTEGER)

**Motivatie:**
- Eén record per segment per dag (UNIQUE constraint)
- Alle relevante metrics op één plek
- Klaar voor uitbreiding met nieuwe kanalen

---

### 3. `lead_segment_plans`
**Doel:** Planning en targets per segment (output van LeadDemandPlanner)

**Kernvelden:**
- `segment_id` (FK → `lead_segments`)
- `date` (DATE)
- `target_leads_per_day` (INTEGER)
- `expected_leads_per_day` (INTEGER) - Voor AI/ML voorspellingen later
- `lead_gap` (INTEGER) - target - actual
- `target_daily_budget_google_ads`, `actual_daily_budget_google_ads` (NUMERIC)
- `orchestration_status` (TEXT) - Status van budget-aanpassingen

**Motivatie:**
- Centrale plek voor planning data
- Gap analysis ingebouwd
- Tracking van orchestration status

---

### 4. `channel_orchestration_log`
**Doel:** Audit trail van alle budget/campaign wijzigingen

**Kernvelden:**
- `segment_id` (FK → `lead_segments`)
- `channel` (TEXT) - 'google_ads', 'seo', etc.
- `action_type` (TEXT) - 'budget_increase', 'budget_decrease', etc.
- `old_value`, `new_value` (NUMERIC)
- `status` (TEXT) - 'pending', 'success', 'failed'

**Motivatie:**
- Volledige transparantie over wijzigingen
- Debugging en compliance
- Geschiedenis van alle acties

---

## Uitbreiding Bestaande Tabellen

### `leads` tabel uitbreidingen:
- `segment_id` (FK → `lead_segments`) - Koppeling lead aan segment
- `source_channel` (TEXT) - 'google_ads', 'seo', 'microsite', etc.
- `source_campaign_id` (TEXT) - Externe campaign ID
- `source_keyword` (TEXT) - Voor SEO/keyword tracking

**Motivatie:**
- Leads kunnen nu aan segmenten gekoppeld worden
- Channel attribution tracking
- Mogelijkheid tot ROI-analyse per kanaal

---

## Helper Functions

### `calculate_lead_gap(segment_id, date)`
Berekent de gap tussen target en actual voor een segment op een datum.

### `update_lead_gap(segment_id, date)`
Update automatisch de gap in de `lead_segment_plans` tabel.

**Motivatie:**
- Herbruikbare logica
- Consistentie in berekeningen
- Makkelijk te testen

---

## Indexen

**Performance indexen op:**
- `lead_segments`: branch+region lookups, code lookups
- `lead_generation_stats`: segment+date queries
- `lead_segment_plans`: segment+date queries, gap filtering
- `channel_orchestration_log`: segment+date queries, status filtering
- `leads`: segment_id, source_channel

**Motivatie:**
- Snelle queries voor aggregatie jobs
- Efficient dashboard queries
- Goede performance bij groei

---

## RLS (Row Level Security)

**Policies:**
- Alle tabellen: SELECT voor iedereen (authenticated users)
- INSERT/UPDATE: Alleen admins (via `profiles.is_admin` check)

**Motivatie:**
- Transparantie voor alle users
- Beveiliging: alleen admins kunnen configureren
- Supabase best practices

---

## Volgende Stap

Na goedkeuring van dit schema-voorstel, ga ik naar **FASE 3**: Secuur implementatieplan & architectuur.

