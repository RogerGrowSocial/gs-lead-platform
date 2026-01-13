# PERFORMANCE SYSTEM - INTERNE SAMENVATTING

## Status: ✅ COMPLEET - Alle stappen afgerond

**Datum:** 2025-01-20  
**Engineer:** Backend Team

**Laatste update:** 
- ✅ Stap 0: Database inspectie
- ✅ Stap 1: Database migrations (Phase 1 & 2)
- ✅ Stap 2: Partner performance stats view uitgebreid
- ✅ Stap 3: Service laag geïmplementeerd
- ✅ Stap 4: Debug endpoint en logging toegevoegd

---

## ✅ WAT WE AL HEBBEN

### 1. Database Structuur

#### `profiles` tabel
- ✅ `id` (UUID, PK)
- ✅ `primary_branch` (TEXT)
- ✅ `regions` (TEXT of TEXT[])
- ✅ `lead_industries` (TEXT[])
- ✅ `lead_locations` (TEXT[])
- ✅ `max_open_leads` (INTEGER)
- ✅ `is_active_for_routing` (BOOLEAN)
- ✅ `routing_priority` (INTEGER)
- ✅ `ai_risk_score` (INTEGER, 0-100) - **Dit is onze AI trust score!**
- ✅ `ai_risk_level` (TEXT: 'low', 'medium', 'high')
- ✅ `ai_risk_assessed_at` (TIMESTAMPTZ)

#### `leads` tabel
- ✅ `id` (UUID, PK)
- ✅ `user_id` (UUID, FK naar profiles) - **Dit is de partner_id**
- ✅ `status` (TEXT: 'new', 'accepted', 'rejected', 'in_progress', 'completed')
- ✅ `industry_id` (UUID, FK naar industries)
- ✅ `province` (TEXT)
- ✅ `postcode` (TEXT)
- ✅ `created_at` (TIMESTAMPTZ)
- ✅ `accepted_at` (TIMESTAMPTZ)
- ✅ `price_at_purchase` (NUMERIC) - **Mogelijk deal value?**
- ❌ `first_contact_at` - **MOET TOEGEVOEGD WORDEN**
- ❌ `deal_value` - **MOET TOEGEVOEGD WORDEN** (of gebruiken we price_at_purchase?)
- ❌ Status 'won' / 'lost' - **MOET GEÏMPLEMENTEERD WORDEN**

#### `lead_activities` tabel
- ✅ **BESTAAT AL!**
- ✅ `id` (UUID, PK)
- ✅ `lead_id` (UUID, FK)
- ✅ `type` (TEXT) - **Moet uitgebreid worden met: phone_call, email_sent, whatsapp, meeting**
- ✅ `description` (TEXT)
- ✅ `created_by` (UUID, FK naar profiles)
- ✅ `created_at` (TIMESTAMPTZ)
- ❌ `partner_id` - **MOET TOEGEVOEGD WORDEN** (of afleiden uit lead.user_id)
- ❌ `metadata` (JSONB) - **OPTIONEEL, maar handig**

#### `partner_performance_stats` (Materialized View)
- ✅ **BESTAAT AL!**
- ✅ `partner_id` (UUID)
- ✅ `leads_assigned_30d` (INTEGER)
- ✅ `leads_accepted_30d` (INTEGER)
- ✅ `leads_rejected_30d` (INTEGER)
- ✅ `conversion_rate_30d` (NUMERIC)
- ✅ `avg_response_time_minutes` (NUMERIC) - **Basis voor reactiesnelheid!**
- ✅ `open_leads_count` (INTEGER)
- ✅ `last_lead_assigned_at` (TIMESTAMPTZ)
- ✅ `refresh_partner_performance_stats()` functie bestaat

#### Feedback / Ratings / Complaints
- ❌ Geen `lead_feedback` tabel - **MOET AANGEMAAKT WORDEN**
- ❌ Geen `support_tickets` tabel - **MOET AANGEMAAKT WORDEN**

---

## ❌ WAT WE MISSEN

### Database Schema Uitbreidingen

1. **`leads.first_contact_at`** kolom
   - Trigger nodig: bij eerste `lead_activities` insert met type in ('phone_call', 'email_sent', 'whatsapp', 'meeting', 'status_change_contacted') → set `first_contact_at = NOW()` (alleen als NULL)

2. **`lead_activities` uitbreidingen**
   - `partner_id` kolom toevoegen (of afleiden uit `leads.user_id`)
   - `metadata` JSONB kolom (optioneel)
   - Type check constraint uitbreiden: `CHECK (type IN ('phone_call', 'email_sent', 'whatsapp', 'meeting', 'status_change_contacted', 'note', 'created', ...))`

3. **Deal/Won Status**
   - Status 'won' / 'lost' toevoegen aan `leads.status` enum
   - Of aparte `deals` tabel (minder waarschijnlijk)
   - `deal_value` kolom in `leads` (of gebruiken we `price_at_purchase`?)

4. **Feedback Tabel**
   - `lead_feedback` tabel aanmaken met:
     - `id`, `lead_id`, `partner_id`, `rating` (1-5), `comment`, `created_at`

5. **Support Tickets / Complaints**
   - `support_tickets` tabel aanmaken met:
     - `id`, `lead_id`, `partner_id`, `type` ('complaint', 'question', etc.), `created_at`

6. **`partner_performance_stats` uitbreidingen**
   - Nieuwe kolommen toevoegen voor alle 8 metrics:
     - Reactiesnelheid: `avg_first_response_time_minutes_7d`, `avg_first_response_time_minutes_30d`, `pct_contacted_within_1h_30d`, `pct_contacted_within_24h_30d`
     - AI Trust: `ai_trust_score` (join met profiles)
     - Deal Rate: `deal_rate_7d`, `deal_rate_30d`, `won_leads_30d`, `lost_leads_30d`
     - Follow-up: `avg_contact_attempts_per_lead_30d`, `pct_leads_min_2_attempts_30d`
     - Feedback: `avg_customer_rating_30d`, `num_ratings_30d`
     - Klachten: `complaints_30d`, `complaint_rate_30d`
     - Dealwaarde: `avg_deal_value_30d`, `median_deal_value_30d`
     - Consistentie: `consistency_score`

---

## 📋 IMPLEMENTATIE PLAN

### Stap 1: Database Migrations
- [ ] Migration: Add `first_contact_at` to `leads`
- [ ] Migration: Add trigger for `first_contact_at`
- [ ] Migration: Extend `lead_activities` (partner_id, metadata, type constraint)
- [ ] Migration: Add 'won'/'lost' status to leads (of aparte deals tabel)
- [ ] Migration: Add `deal_value` to leads (of gebruik price_at_purchase)
- [ ] Migration: Create `lead_feedback` tabel
- [ ] Migration: Create `support_tickets` tabel

### Stap 2: Partner Performance Stats Uitbreiding
- [ ] Update `partner_performance_stats` materialized view met alle nieuwe metrics
- [ ] Update `refresh_partner_performance_stats()` functie
- [ ] Test aggregatie queries

### Stap 3: Service Laag
- [ ] Update `LeadAssignmentService.calculateScore()` met nieuwe performance metrics
- [ ] Maak `calculatePerformanceScore()` functie
- [ ] Integreer met bestaande sliders (regionWeight, performanceWeight, fairnessWeight)

### Stap 4: Debug & Validatie
- [ ] Debug endpoint: `/api/admin/ai-router/performance-debug?partner_id=...`
- [ ] Logging in `lead_assignment_logs` met nieuwe metrics
- [ ] Documentatie update

---

## 🔍 BELANGRIJKE BESLISSINGEN

1. **Deal Value**: Gebruiken we `price_at_purchase` of maken we een aparte `deal_value` kolom?
   - **VOORSTEL**: Gebruik `price_at_purchase` voor nu, voeg later `deal_value` toe als we onderscheid willen tussen aankoopprijs en opdrachtwaarde.

2. **Won/Lost Status**: In `leads.status` of aparte tabel?
   - **VOORSTEL**: Voeg 'won' en 'lost' toe aan `leads.status` enum. Simpeler en directer.

3. **Lead Activities Partner ID**: Nieuwe kolom of afleiden?
   - **VOORSTEL**: Afleiden uit `leads.user_id` in queries. Geen extra kolom nodig (minder redundantie).

4. **AI Trust Score**: Gebruiken we `profiles.ai_risk_score` direct?
   - **VOORSTEL**: Ja, maar normaliseren naar 0-100 (nu al 0-100, maar check of lager = beter of hoger = beter).

---

## 📝 VOLGENDE STAPPEN

1. ✅ Database inspectie queries uitgevoerd
2. ⏳ Wachten op resultaten van inspectie queries
3. ⏳ Migrations schrijven voor ontbrekende kolommen/tabellen
4. ⏳ Partner performance stats view uitbreiden
5. ⏳ Service laag updaten

---

## 🎯 METRICS DEFINITIES

### 1. Reactiesnelheid
- **avg_first_response_time_minutes_7d**: Gemiddelde tijd tussen lead creation en eerste contact (laatste 7 dagen)
- **avg_first_response_time_minutes_30d**: Zelfde, laatste 30 dagen
- **pct_contacted_within_1h_30d**: % leads waar first_contact_at <= created_at + 1 uur (30d)
- **pct_contacted_within_24h_30d**: % leads waar first_contact_at <= created_at + 24 uur (30d)

### 2. AI Trust Score
- **ai_trust_score**: Direct uit `profiles.ai_risk_score` (0-100, check of hoger = beter)

### 3. Deal Rate
- **deal_rate_30d**: `won_leads_30d / (won_leads_30d + lost_leads_30d)` (alleen leads met beslissing)
- **won_leads_30d**: Leads met status='won' en created_at binnen 30d
- **lost_leads_30d**: Leads met status='lost' en created_at binnen 30d

### 4. Follow-up Discipline
- **avg_contact_attempts_per_lead_30d**: Gemiddeld aantal lead_activities per lead (30d)
- **pct_leads_min_2_attempts_30d**: % leads met >= 2 lead_activities (30d)

### 5. Klantenfeedback
- **avg_customer_rating_30d**: Gemiddelde rating uit `lead_feedback` (30d)
- **num_ratings_30d**: Aantal ratings (30d)

### 6. Klachten
- **complaints_30d**: Aantal support_tickets met type='complaint' (30d)
- **complaint_rate_30d**: `complaints_30d / leads_assigned_30d`

### 7. Dealwaarde
- **avg_deal_value_30d**: Gemiddelde `deal_value` (of `price_at_purchase`) van won leads (30d)
- **median_deal_value_30d**: Mediaan deal value (optioneel)

### 8. Consistentie
- **consistency_score**: Score gebaseerd op verschil tussen 7d en 30d metrics
  - Verschil deal_rate_7d vs deal_rate_30d (kleiner = beter)
  - Verschil avg_response_time_7d vs 30d (kleiner = beter)
  - Normaliseer naar 0-100

---

## 🔧 TECHNISCHE DETAILS

### Trigger voor first_contact_at
```sql
CREATE OR REPLACE FUNCTION set_first_contact_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type IN ('phone_call', 'email_sent', 'whatsapp', 'meeting', 'status_change_contacted') THEN
    UPDATE leads
    SET first_contact_at = COALESCE(first_contact_at, NOW())
    WHERE id = NEW.lead_id
      AND first_contact_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_first_contact_at
  AFTER INSERT ON lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION set_first_contact_at();
```

### Performance Score Berekeningslogica
- Reactiesnelheid: <= 30 min = 100, 30-120 min = 70-100, 2-24h = 40-70, >24h = 0-40
- AI Trust: Direct gebruiken (0-100)
- Deal Rate: Hoger = beter, cap op 80-90
- Follow-up: Hoger % met min 2 attempts = beter
- Feedback: 1-5 sterren → 0-100 mapping
- Klachten: Hogere complaint_rate = lagere score (negatief)
- Dealwaarde: Log-normalisatie, kleine bonus
- Consistentie: Verschil 7d vs 30d, kleiner = beter

---

**Laatste update:** 2025-01-XX  
**Status:** In progress - Stap 0 afgerond, klaar voor Stap 1 (Migrations)

