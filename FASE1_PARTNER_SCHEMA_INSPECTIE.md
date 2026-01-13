# FASE 1: Partner Schema Inspectie - Samenvatting

## Status: ✅ INSPECTIE ALLEEN (GEEN WIJZIGINGEN)

**Belangrijk:** In Fase 1 voer ik geen schema-wijzigingen uit, alleen schema-inspectie.

---

## Samenvatting Bevindingen

### 1. Partner/Bedrijf Tabel

**Hoofdtabel:** `profiles`
- Dit is de centrale tabel voor partners/bedrijven
- Gekoppeld aan `auth.users` via `id` (UUID, foreign key)
- Bevat zowel admin- als partner-accounts (onderscheid via `is_admin` boolean)

**Bestaande Partner-gerelateerde Velden in `profiles`:**
- `primary_branch` (TEXT) - Primaire branche van partner
- `regions` (TEXT of TEXT[]) - Regio's waar partner actief is  
- `lead_industries` (TEXT[]) - Array van branches waar partner leads voor wil
- `lead_locations` (TEXT[]) - Array van locaties waar partner leads voor wil
- `max_open_leads` (INTEGER) - Maximale capaciteit (open leads)
- `is_active_for_routing` (BOOLEAN) - Of partner actief is voor lead routing
- `routing_priority` (INTEGER) - Prioriteit voor routing
- `company_name` (TEXT) - Bedrijfsnaam
- `status` (TEXT, default 'active') - Status van partner account

### 2. Bestaande Segment Koppeling

**Segment Tabel:** `lead_segments` (bestaat al)
- Tabel is al aangemaakt in eerdere Lead Flow Intelligence implementatie
- Velden: `id`, `code`, `branch`, `region`, `country`, `postal_prefixes`, `is_active`

**Huidige Koppeling Methode:**
- **Geen expliciete koppeltabel** tussen partners en segmenten
- Koppeling gebeurt **impliciet** via matching:
  - `lead_segments.branch` matcht met `profiles.primary_branch` of `profiles.lead_industries[]`
  - `lead_segments.region` matcht met `profiles.regions` of `profiles.lead_locations[]`
- Deze matching gebeurt in code (services), niet in database constraints

### 3. Bestaande Partner Performance Infrastructuur

**Materialized View:** `partner_performance_stats`
- Bevat partner statistieken: `partner_id`, `leads_assigned_30d`, `leads_accepted_30d`, `conversion_rate_30d`, `open_leads_count`, etc.
- Wordt dagelijks ge-refreshed via `refresh_partner_performance_stats()` RPC function
- Gebruikt door `LeadAssignmentService` voor routing

**View:** `lead_routing_candidates`
- Combineert leads met partners voor routing
- Gebruikt `partner_performance_stats` voor scoring

---

## SQL Queries voor Schema Inspectie

### Query 1: Overzicht Partner-gerelateerde Tabellen

```sql
-- 1) Overzicht partner-gerelateerde tabellen
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%profile%' 
    OR table_name ILIKE '%partner%' 
    OR table_name ILIKE '%company%'
    OR table_name ILIKE '%user%'
  )
ORDER BY table_name;
```

**Verwachte Resultaten:**
- `profiles` (BASE TABLE)
- `partner_performance_stats` (VIEW of MATERIALIZED VIEW)
- `lead_routing_candidates` (VIEW)
- Mogelijk andere views/tabellen

---

### Query 2: Kolommen van `profiles` Tabel (Partner Tabel)

```sql
-- 2) Kolommen van de belangrijkste partner/bedrijfstabel (profiles)
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;
```

**Verwachte Belangrijke Kolommen:**
- `id` (uuid) - Primary key, FK naar auth.users
- `primary_branch` (text)
- `regions` (text of text[])
- `lead_industries` (text[])
- `lead_locations` (text[])
- `max_open_leads` (integer)
- `is_active_for_routing` (boolean)
- `routing_priority` (integer)
- `is_admin` (boolean)
- `company_name` (text)
- `status` (text)

---

### Query 3: Bestaande Koppeling met Segmenten/Branches/Regio's

```sql
-- 3) Tabellen die segmenten/branches/regio's bevatten
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%segment%' 
    OR table_name ILIKE '%branch%' 
    OR table_name ILIKE '%region%'
    OR table_name ILIKE '%industry%'
  )
ORDER BY table_name;
```

**Verwachte Resultaten:**
- `lead_segments` (BASE TABLE) - Segmenten (branch + region)
- `industries` (BASE TABLE) - Branches/branches
- Mogelijk andere gerelateerde tabellen

---

### Query 4: Foreign Keys en Constraints op `profiles`

```sql
-- 4) Foreign keys en constraints op profiles tabel
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'profiles'
ORDER BY tc.constraint_type, tc.constraint_name;
```

**Verwachte Resultaten:**
- Primary key constraint op `id`
- Foreign key constraint: `id` → `auth.users(id)`
- Mogelijk check constraints op `status`, etc.

---

### Query 5: Bestaande Partner-Segment Koppeling (Indien Aanwezig)

```sql
-- 5) Check of er al een koppeltabel bestaat tussen partners en segmenten
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%partner%segment%'
    OR table_name ILIKE '%segment%partner%'
    OR table_name ILIKE '%profile%segment%'
  )
ORDER BY table_name;
```

**Verwachte Resultaat:**
- Geen resultaten (geen expliciete koppeltabel gevonden in codebase)

---

### Query 6: Kolommen van `lead_segments` Tabel

```sql
-- 6) Kolommen van lead_segments tabel (bestaat al)
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'lead_segments'
ORDER BY ordinal_position;
```

**Verwachte Kolommen:**
- `id` (uuid) - Primary key
- `code` (text) - Unieke code
- `branch` (text) - Branche
- `region` (text) - Regio
- `country` (text) - Land (default 'NL')
- `postal_prefixes` (text[]) - Postcode prefixes
- `is_active` (boolean) - Status
- `description` (text) - Metadata
- `created_at`, `updated_at` (timestamptz)

---

### Query 7: Materialized View `partner_performance_stats` Structuur

```sql
-- 7) Structuur van partner_performance_stats view
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partner_performance_stats'
ORDER BY ordinal_position;
```

**Verwachte Kolommen:**
- `partner_id` (uuid) - FK naar profiles.id
- `leads_assigned_30d` (integer) - Leads toegewezen laatste 30 dagen
- `leads_accepted_30d` (integer) - Leads geaccepteerd laatste 30 dagen
- `conversion_rate_30d` (numeric) - Conversie rate
- `open_leads_count` (integer) - Huidige open leads
- Mogelijk andere performance metrics

---

### Query 8: Sample Data - Partners met Branches/Regio's

```sql
-- 8) Sample data: Partners met hun branches en regio's
SELECT 
  id,
  company_name,
  primary_branch,
  regions,
  lead_industries,
  lead_locations,
  max_open_leads,
  is_active_for_routing,
  is_admin
FROM public.profiles
WHERE is_admin = false
  AND (primary_branch IS NOT NULL OR lead_industries IS NOT NULL)
LIMIT 10;
```

**Doel:** Zien hoe partners momenteel zijn geconfigureerd met branches/regio's.

---

## Conclusie Fase 1

### ✅ Wat bestaat al:

1. **Partner Tabel:** `profiles` met uitgebreide partner-velden
2. **Segment Tabel:** `lead_segments` (branch + region combinaties)
3. **Performance Tracking:** `partner_performance_stats` materialized view
4. **Routing Infrastructuur:** `lead_routing_candidates` view

### ❌ Wat ontbreekt:

1. **Expliciete Koppeltabel:** Geen `partner_segments` tabel voor expliciete koppeling
2. **Marketing Profiel:** Geen marketing-gerelateerde velden in `profiles`
3. **Landingspagina's:** Geen tabel voor partner landingspagina's
4. **Campagnes:** Geen tabel voor partner marketing campagnes

### 📋 Volgende Stap:

**FASE 2:** Schema-voorstel voor:
- Marketing profiel velden in `profiles`
- `partner_segments` koppeltabel
- `partner_landing_pages` tabel
- `partner_marketing_campaigns` tabel

---

## Belangrijke Notitie

**In Fase 1 voer ik geen wijzigingen uit, alleen schema-inspectie.**

De bovenstaande SQL queries zijn **alleen voorstellen** om het schema te inspecteren. Ze kunnen worden uitgevoerd in Supabase SQL Editor om de exacte structuur te verifiëren voordat we verder gaan met Fase 2.

