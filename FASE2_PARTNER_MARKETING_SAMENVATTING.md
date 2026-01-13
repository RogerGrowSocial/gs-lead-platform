# FASE 2: Partner Marketing Schema Voorstel - Samenvatting

## Status: ✅ VOORSTEL ALLEEN (GEEN UITVOERING)

**Belangrijk:** Dit zijn schema-voorstellen; ik heb nog geen migrations aangemaakt of iets uitgevoerd.

---

## Overzicht Voorgestelde Schema Wijzigingen

### 2.1. Partner Marketing Profiel (Uitbreiding `profiles` tabel)

**Doel:** Partners kunnen hun marketingprofiel configureren

**Nieuwe Kolommen:**
- `marketing_mode` (TEXT) - 'leads_only', 'hybrid', of 'full_marketing'
- `auto_marketing_enabled` (BOOLEAN) - Mag AI automatisch marketing-acties uitvoeren?
- `monthly_marketing_budget` (NUMERIC) - Maandelijks budget in EUR
- `preferred_channels` (TEXT[]) - Array van voorkeur kanalen (bijv. ['google_ads', 'seo'])
- `brand_color` (TEXT) - Hex color code voor branding
- `logo_url` (TEXT) - URL naar logo image
- `tone_of_voice` (TEXT) - Kort tekstveld voor AI-content generatie

**Motivatie:**
- Centrale plek voor marketing configuratie per partner
- Flexibel systeem (modes, kanalen, branding)
- Klaar voor AI-integratie (tone_of_voice, auto_marketing_enabled)

---

### 2.2. Partner Segments Koppeltabel (`partner_segments`)

**Doel:** Expliciete koppeling tussen partners en segmenten

**Kernvelden:**
- `partner_id` (FK → `profiles.id`)
- `segment_id` (FK → `lead_segments.id`)
- `is_primary` (BOOLEAN) - Is dit het primaire segment?
- `priority` (INTEGER) - Prioriteit bij meerdere segmenten
- `is_active` (BOOLEAN) - Status van koppeling

**Motivatie:**
- Expliciete koppeling i.p.v. impliciete matching
- Partners kunnen meerdere segmenten hebben
- Primaire segment markering voor prioriteit
- Makkelijker queries en rapportage

**Unique Constraint:** Eén actieve koppeling per partner+segment combinatie

---

### 2.3. Partner Landing Pagina's (`partner_landing_pages`)

**Doel:** Partner-specifieke landingspagina's per segment

**Kernvelden:**
- `partner_id` (FK → `profiles.id`)
- `segment_id` (FK → `lead_segments.id`, optioneel)
- `path` (TEXT) - URL path (bijv. '/partners/jansen-schilderwerken/tilburg')
- `status` (TEXT) - 'concept', 'review', 'live', 'archived'
- `source` (TEXT) - 'ai_generated', 'manual', 'template'
- `title`, `subtitle`, `seo_title`, `seo_description` (TEXT)
- `content_json` (JSONB) - Gestructureerde content blokken
- `views_count`, `conversions_count` (INTEGER) - Performance tracking

**Motivatie:**
- Partners kunnen eigen LP's hebben per segment
- AI kan LP's genereren (status='concept')
- Workflow: concept → review → live
- Performance tracking ingebouwd

**Unique Constraint:** Eén unieke path per partner

---

### 2.4. Partner Marketing Campagnes (`partner_marketing_campaigns`)

**Doel:** Tracken van partner marketing campagnes (Google Ads, Meta Ads, etc.)

**Kernvelden:**
- `partner_id` (FK → `profiles.id`)
- `segment_id` (FK → `lead_segments.id`, optioneel)
- `channel` (TEXT) - 'google_ads', 'meta_ads', 'linkedin_ads', etc.
- `external_campaign_id` (TEXT) - ID van externe API (Google Ads, Meta, etc.)
- `status` (TEXT) - 'planned', 'active', 'paused', 'archived'
- `daily_budget`, `monthly_budget` (NUMERIC) - Budget in EUR
- `cpl_target` (NUMERIC) - Target Cost Per Lead
- `ai_managed` (BOOLEAN) - Wordt deze campagne door AI beheerd?
- `total_spend`, `total_clicks`, `total_impressions`, `total_leads` - Performance metrics
- `avg_cpl` (NUMERIC) - Gemiddelde CPL (calculated)

**Motivatie:**
- Centrale tracking van alle partner campagnes
- Koppeling met externe APIs (Google Ads, Meta, etc.)
- AI kan campagnes beheren (ai_managed flag)
- Performance tracking per campagne

**Unique Constraint:** Eén externe campagne ID per kanaal (als opgegeven)

---

## Tabel Overzicht

| Tabel | Type | Doel | Belangrijkste Velden |
|-------|------|------|---------------------|
| `profiles` | ALTER | Marketing profiel | `marketing_mode`, `auto_marketing_enabled`, `monthly_marketing_budget`, `preferred_channels` |
| `partner_segments` | NEW | Koppeling partner ↔ segment | `partner_id`, `segment_id`, `is_primary`, `priority` |
| `partner_landing_pages` | NEW | Partner LP's | `partner_id`, `segment_id`, `path`, `status`, `content_json` |
| `partner_marketing_campaigns` | NEW | Partner campagnes | `partner_id`, `segment_id`, `channel`, `external_campaign_id`, `ai_managed` |

---

## Indexen en Performance

**Indexen worden aangemaakt voor:**
- Snelle filtering op `marketing_mode`, `auto_marketing_enabled`
- Snelle lookups op `partner_id`, `segment_id`
- Status filtering (actieve campagnes, live LP's)
- Path lookups voor LP's

---

## Row Level Security (RLS)

**Beveiliging:**
- Partners kunnen alleen hun eigen data zien/bewerken
- Admins hebben volledige toegang
- RLS policies op alle nieuwe tabellen

---

## Helper Functions

**Triggers:**
- Automatische `updated_at` timestamp updates
- Toegepast op: `partner_segments`, `partner_landing_pages`, `partner_marketing_campaigns`

---

## Volgende Stap

**FASE 3:** Functioneel ontwerp & stappenplan voor:
- Partner vraag/aanbod logica
- AI/regels voor partner-acties
- Services en jobs structuur
- UI-uitbreidingen

---

## Belangrijke Notitie

**Dit zijn schema-voorstellen; ik heb nog geen migrations aangemaakt of iets uitgevoerd.**

Het volledige SQL schema staat in: `FASE2_PARTNER_MARKETING_SCHEMA_VOORSTEL.sql`

