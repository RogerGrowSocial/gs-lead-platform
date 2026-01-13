# FASE 2: Aanpassingen Schema Voorstel - Integratie Bestaand Systeem

## Belangrijke Bevindingen

Na analyse van de bestaande database structuur heb ik het volgende gevonden:

### ✅ Bestaande Partner Infrastructuur

1. **`profiles` tabel heeft al partner-velden:**
   - `primary_branch` (TEXT) - Primaire branche van partner
   - `regions` (TEXT of TEXT[]) - Regio's waar partner actief is
   - `max_open_leads` (INTEGER) - Maximale capaciteit
   - `is_active_for_routing` (BOOLEAN) - Of partner actief is voor routing
   - `routing_priority` (INTEGER) - Prioriteit voor routing
   - `lead_industries` (TEXT[]) - Array van branches
   - `lead_locations` (TEXT[]) - Array van locaties

2. **`partner_performance_stats` materialized view bestaat al:**
   - Bevat: `partner_id`, `leads_assigned_30d`, `leads_accepted_30d`, `conversion_rate_30d`, `open_leads_count`, etc.
   - Wordt dagelijks ge-refreshed via `refresh_partner_performance_stats()` RPC
   - Gebruikt door `LeadAssignmentService` voor routing

3. **`lead_routing_candidates` view bestaat al:**
   - Combineert leads met partners voor routing
   - Gebruikt `partner_performance_stats` voor scoring

---

## Aanpassingen aan Schema Voorstel

### 1. Segment Matching met Bestaande Partner Data

**Aanpassing:** In plaats van een compleet nieuw systeem, koppelen we segmenten aan bestaande partner velden:

- `lead_segments.branch` matcht met `profiles.primary_branch` of `profiles.lead_industries[]`
- `lead_segments.region` matcht met `profiles.regions` of `profiles.lead_locations[]`

**Voordeel:**
- Geen dubbele data
- Gebruikt bestaande partner configuratie
- Makkelijker te onderhouden

---

### 2. Capaciteit Berekening via Bestaande Stats

**Aanpassing:** In plaats van een nieuwe capaciteit tabel, gebruiken we:

- `partner_performance_stats.open_leads_count` - Huidige open leads
- `profiles.max_open_leads` - Maximale capaciteit
- `partner_performance_stats.leads_assigned_30d` - Recente activiteit

**Voor capaciteit per segment:**
```sql
-- Berekent capaciteit per segment
SELECT 
  ls.id AS segment_id,
  COUNT(DISTINCT p.id) AS capacity_partners,
  SUM(p.max_open_leads) AS capacity_total_leads,
  SUM(COALESCE(pps.open_leads_count, 0)) AS current_open_leads
FROM lead_segments ls
JOIN profiles p ON (
  (p.primary_branch = ls.branch OR ls.branch = ANY(p.lead_industries))
  AND (ls.region = ANY(p.regions) OR ls.region = ANY(p.lead_locations))
  AND p.is_active_for_routing = true
  AND p.is_admin = false
)
LEFT JOIN partner_performance_stats pps ON pps.partner_id = p.id
WHERE ls.is_active = true
GROUP BY ls.id;
```

---

### 3. Lead Segment Assignment

**Aanpassing:** Bij lead creation, match lead aan segment op basis van:
- `leads.industry_id` → `industries.name` → `lead_segments.branch`
- `leads.province` of `leads.postcode` → `lead_segments.region`

**Logica:**
```javascript
// Pseudo-code voor segment assignment
async function assignSegmentToLead(lead) {
  // 1. Haal industry op
  const industry = await getIndustry(lead.industry_id);
  
  // 2. Bepaal regio (uit province of postcode)
  const region = extractRegion(lead.province, lead.postcode);
  
  // 3. Zoek matching segment
  const segment = await findSegment({
    branch: industry.name.toLowerCase(),
    region: region
  });
  
  if (segment) {
    await updateLead(lead.id, { segment_id: segment.id });
  }
}
```

---

### 4. Stats Aggregatie - Gebruik Bestaande Data

**Aanpassing:** `lead_generation_stats` vullen met:
- Leads tellen per segment (via `leads.segment_id`)
- Acceptatie rates (uit `leads.status`)
- Partner capaciteit (uit `partner_performance_stats` + `profiles.max_open_leads`)

**Query voor aggregatie:**
```sql
-- Aggregeer stats per segment per dag
INSERT INTO lead_generation_stats (
  segment_id, date, 
  leads_generated, leads_accepted, leads_rejected, leads_pending,
  capacity_partners, capacity_total_leads
)
SELECT 
  l.segment_id,
  DATE(l.created_at) AS date,
  COUNT(*) AS leads_generated,
  COUNT(*) FILTER (WHERE l.status = 'accepted') AS leads_accepted,
  COUNT(*) FILTER (WHERE l.status = 'rejected') AS leads_rejected,
  COUNT(*) FILTER (WHERE l.status IN ('new', 'pending')) AS leads_pending,
  -- Capaciteit uit partners
  COUNT(DISTINCT p.id) AS capacity_partners,
  SUM(COALESCE(p.max_open_leads, 0)) AS capacity_total_leads
FROM leads l
JOIN lead_segments ls ON ls.id = l.segment_id
LEFT JOIN profiles p ON (
  (p.primary_branch = ls.branch OR ls.branch = ANY(p.lead_industries))
  AND (ls.region = ANY(p.regions) OR ls.region = ANY(p.lead_locations))
  AND p.is_active_for_routing = true
)
WHERE l.segment_id IS NOT NULL
  AND DATE(l.created_at) = CURRENT_DATE - INTERVAL '1 day'
GROUP BY l.segment_id, DATE(l.created_at);
```

---

## Geen Wijzigingen Nodig aan Bestaande Tabellen

**Belangrijk:** We hoeven **NIET** te wijzigen aan:
- `profiles` tabel (behalve eventueel segment-koppeling voor caching)
- `partner_performance_stats` view (blijft zoals het is)
- `lead_routing_candidates` view (blijft zoals het is)

**We voegen alleen toe:**
- Nieuwe tabellen voor segmenten, stats, plans
- `segment_id` kolom aan `leads` tabel
- Helper functions voor segment matching

---

## Voordelen van Deze Aanpak

1. ✅ **Geen dubbele data** - Gebruikt bestaande partner configuratie
2. ✅ **Backwards compatible** - Bestaande routing blijft werken
3. ✅ **Minder migrations** - Minder wijzigingen aan bestaande tabellen
4. ✅ **Betere performance** - Gebruikt bestaande materialized views
5. ✅ **Eenvoudiger onderhoud** - Eén bron van waarheid voor partner data

---

## Volgende Stap

Het schema voorstel in `FASE2_NIEUW_SCHEMA_VOORSTEL.sql` blijft grotendeels hetzelfde, maar de implementatie zal:
- Gebruik maken van bestaande `partner_performance_stats` voor capaciteit
- Segment matching doen op basis van `profiles.primary_branch` en `profiles.regions`
- Geen extra partner-tabellen aanmaken

De services zullen worden aangepast om deze bestaande data te gebruiken.

