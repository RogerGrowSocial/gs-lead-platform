# Partner Marketing System - Volgende Stappen

## ✅ Wat is al gedaan

1. ✅ **Database migration aangemaakt** - `supabase/migrations/20250115000003_partner_marketing.sql`
2. ✅ **Services geïmplementeerd** - 4 services voor partner marketing
3. ✅ **Cron jobs geïmplementeerd** - 4 dagelijkse jobs
4. ✅ **API endpoints toegevoegd** - Volledige REST API
5. ✅ **Server integratie** - Cron jobs geïnitialiseerd

---

## 🚀 STAP 1: Migration Uitvoeren (BELANGRIJK)

### Optie A: Via Supabase Dashboard (Aanbevolen)
1. Ga naar je Supabase project dashboard
2. Open de **SQL Editor**
3. Kopieer de volledige inhoud van `supabase/migrations/20250115000003_partner_marketing.sql`
4. Plak in de SQL Editor en voer uit
5. Controleer of er geen errors zijn

### Optie B: Via Supabase CLI
```bash
cd /path/to/gs-lead-platform
supabase db push
```

### Verificatie na Migration
Voer deze queries uit om te controleren of alles is aangemaakt:

```sql
-- Check of nieuwe tabellen bestaan
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'partner_segments',
    'partner_landing_pages',
    'partner_marketing_campaigns',
    'partner_lead_gaps',
    'ai_marketing_recommendations'
  )
ORDER BY table_name;

-- Check of profiles kolommen zijn toegevoegd
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name IN (
    'marketing_mode',
    'auto_marketing_enabled',
    'monthly_marketing_budget',
    'preferred_channels',
    'brand_color',
    'logo_url',
    'tone_of_voice'
  )
ORDER BY column_name;
```

**Verwachte resultaat:** 5 tabellen en 7 kolommen in profiles

---

## 🧪 STAP 2: Testen - API Endpoints

### Test 1: Marketing Profiel Ophalen
```bash
# Vervang YOUR_USER_ID en YOUR_TOKEN
curl http://localhost:3000/api/partners/YOUR_USER_ID/marketing-profile \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Verwachte resultaat:** JSON met marketing profiel (default: `marketing_mode: 'leads_only'`)

### Test 2: Marketing Profiel Updaten
```bash
curl -X POST http://localhost:3000/api/partners/YOUR_USER_ID/marketing-profile \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "marketing_mode": "hybrid",
    "auto_marketing_enabled": true,
    "monthly_marketing_budget": 1000,
    "preferred_channels": ["google_ads", "seo"]
  }'
```

### Test 3: Partner Segmenten Ophalen
```bash
curl http://localhost:3000/api/partners/YOUR_USER_ID/segments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Verwachte resultaat:** Lege array `[]` (nog geen segmenten gekoppeld)

### Test 4: Segment Toevoegen
```bash
# Eerst een segment ID ophalen uit lead_segments
# Vervang SEGMENT_ID met een bestaand segment ID
curl -X POST http://localhost:3000/api/partners/YOUR_USER_ID/segments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "segment_id": "SEGMENT_ID",
    "is_primary": true,
    "target_leads_per_week": 20
  }'
```

---

## 🔄 STAP 3: Testen - Cron Jobs

### Handmatig Testen (Optioneel)

**Test Partner Stats Aggregatie:**
```bash
node cron/calculatePartnerLeadStatsDaily.js
```

**Test Demand Planning:**
```bash
node cron/runPartnerDemandPlanningDaily.js
```

**Test AI Recommendations:**
```bash
node cron/generateAiPartnerRecommendationsDaily.js
```

**Test Campaign Sync:**
```bash
node cron/syncPartnerCampaignsDaily.js
```

**Verwachte resultaat:** Jobs draaien zonder errors (mogelijk warnings als er nog geen data is)

---

## 📊 STAP 4: Verificatie - Database Data

### Check Marketing Profiel
```sql
-- Check of partners marketing profiel hebben
SELECT 
  id,
  company_name,
  marketing_mode,
  auto_marketing_enabled,
  monthly_marketing_budget,
  preferred_channels
FROM profiles
WHERE is_admin = false
  AND marketing_mode IS NOT NULL
LIMIT 10;
```

### Check Partner Segments
```sql
-- Check of er partner-segment koppelingen zijn
SELECT 
  ps.*,
  ls.code AS segment_code,
  ls.branch,
  ls.region
FROM partner_segments ps
JOIN lead_segments ls ON ls.id = ps.segment_id
LIMIT 10;
```

### Check Lead Gaps
```sql
-- Check of er lead gaps zijn berekend
SELECT 
  *,
  ls.code AS segment_code
FROM partner_lead_gaps plg
JOIN lead_segments ls ON ls.id = plg.segment_id
ORDER BY date DESC
LIMIT 10;
```

### Check AI Recommendations
```sql
-- Check of er AI recommendations zijn
SELECT 
  *,
  ls.code AS segment_code
FROM ai_marketing_recommendations amr
LEFT JOIN lead_segments ls ON ls.id = amr.segment_id
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🎯 STAP 5: Eerste Setup (Optioneel)

### 1. Partner Marketing Profiel Configureren

Via API of direct in database:
```sql
-- Update een partner naar hybrid mode
UPDATE profiles
SET 
  marketing_mode = 'hybrid',
  auto_marketing_enabled = true,
  monthly_marketing_budget = 1000,
  preferred_channels = ARRAY['google_ads', 'seo']
WHERE id = 'PARTNER_ID';
```

### 2. Partner Segmenten Koppelen

```sql
-- Koppel partner aan segment
INSERT INTO partner_segments (
  partner_id,
  segment_id,
  is_primary,
  target_leads_per_week
)
SELECT 
  'PARTNER_ID',
  id,
  true,
  20
FROM lead_segments
WHERE code = 'schilder_noord_brabant'  -- Vervang met bestaand segment
LIMIT 1;
```

### 3. Test Gap Berekening

Na setup, run handmatig:
```bash
node cron/runPartnerDemandPlanningDaily.js
```

Check resultaat:
```sql
SELECT * FROM partner_lead_gaps 
WHERE partner_id = 'PARTNER_ID'
ORDER BY date DESC;
```

---

## 🐛 Troubleshooting

### Probleem: Migration faalt met "relation already exists"
**Oplossing:** 
- Tabellen bestaan al, gebruik `DROP TABLE IF EXISTS` of skip deze stap
- Check of migration al is uitgevoerd

### Probleem: API geeft 403 Unauthorized
**Oplossing:**
- Check of user is ingelogd (token valid)
- Check of `partnerId` in URL matcht met `req.user.id`
- Check of user admin is voor andere partners

### Probleem: Cron jobs draaien niet
**Oplossing:**
- Check server logs voor errors
- Verifieer dat `require('./cron/partnerMarketingJobs')` in `server.js` staat
- Check of server is opnieuw gestart na code changes

### Probleem: Geen gaps worden berekend
**Oplossing:**
- Check of partner `auto_marketing_enabled = true` heeft
- Check of partner `marketing_mode IN ('hybrid', 'full_marketing')` heeft
- Check of partner segmenten heeft gekoppeld
- Check of er leads zijn voor deze partner

---

## ✅ Checklist

- [ ] Migration uitgevoerd in Supabase
- [ ] Tabellen bestaan (5 nieuwe tabellen)
- [ ] Profiles kolommen bestaan (7 nieuwe kolommen)
- [ ] Server opnieuw gestart
- [ ] API endpoints getest
- [ ] Cron jobs draaien (check logs)
- [ ] Partner marketing profiel geconfigureerd (optioneel)
- [ ] Partner segmenten gekoppeld (optioneel)
- [ ] Gap berekening getest (optioneel)

---

## 🎉 Klaar!

Na het uitvoeren van de migration en testen, is het systeem operationeel:
- ✅ Database schema compleet
- ✅ Services werken
- ✅ Cron jobs draaien automatisch
- ✅ API endpoints beschikbaar
- ✅ Klaar voor UI integratie (volgende fase)

**Start met STAP 1 (migration uitvoeren) - dat is het belangrijkst!**

