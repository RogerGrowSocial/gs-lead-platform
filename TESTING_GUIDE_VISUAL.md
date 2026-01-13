# 🧪 Visuele Test Guide - Platform Landing Pages

**Hoe test je het nieuwe platform landing page systeem visueel op je laptop**

---

## 📋 Stap 1: Migrations Toepassen (Als Nog Niet Gedaan)

### Option A: Via Supabase Dashboard
1. Ga naar je Supabase project dashboard
2. Navigeer naar **SQL Editor**
3. Voer de migrations uit in volgorde:
   - `20250115000004_add_sites_table.sql`
   - `20250115000005_extend_landing_pages_for_multi_site.sql`
   - `20250115000006_extend_leads_for_lp_tracking.sql`
   - `20250115000007_extend_recommendations_for_sites.sql`

### Option B: Via Supabase CLI
```bash
# Als je Supabase CLI hebt geïnstalleerd
supabase db push
```

### Option C: Handmatig via SQL Editor
Kopieer en plak de SQL uit elk migration bestand in Supabase SQL Editor.

---

## 📋 Stap 2: Default Site Domain Updaten

```sql
-- Update de default site domain naar localhost voor testing
UPDATE sites 
SET domain = 'localhost:3000' 
WHERE name = 'Main Platform';
```

**Of voor productie:**
```sql
UPDATE sites 
SET domain = 'growsocialmedia.nl' 
WHERE name = 'Main Platform';
```

---

## 📋 Stap 3: Test Segment Aanmaken (Als Nog Niet Bestaat)

### Via Admin UI:
1. Ga naar `/admin/leads/engine` (Leadstroom pagina)
2. Tab "Segmenten & capaciteit"
3. Maak een nieuw segment aan (bijv. "schilder" + "Noord-Brabant")

### Via SQL:
```sql
INSERT INTO lead_segments (code, branch, region, country, is_active)
VALUES ('schilder_noord_brabant', 'schilder', 'noord-brabant', 'NL', true)
ON CONFLICT (code) DO NOTHING;
```

---

## 📋 Stap 4: Server Starten

```bash
# In je terminal, in de project directory
npm start
# of
node server.js
```

Server draait nu op `http://localhost:3000`

---

## 📋 Stap 5: Test Data Aanmaken (Optie 1: Via Orchestrator)

### A. Genereer Recommendations
```bash
# In een nieuwe terminal
node cron/generateAiPartnerRecommendationsDaily.js
```

Dit genereert platform marketing recommendations voor alle (site, segment) combinaties.

### B. Check Recommendations in Database
```sql
SELECT 
  id,
  site_id,
  partner_id,  -- Moet NULL zijn voor platform
  segment_id,
  action_type,
  action_details->>'page_type' as page_type,
  action_details->>'suggested_path' as path,
  status,
  priority
FROM ai_marketing_recommendations
WHERE partner_id IS NULL  -- Platform recommendations
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📋 Stap 6: Recommendation Approven (Via API)

### Option A: Via Admin UI (Als Endpoint Beschikbaar)
1. Ga naar `/admin/leads/engine`
2. Tab "AI-acties"
3. Klik op een recommendation om te approven

### Option B: Via API Call (Postman/curl)

**Eerst: Haal recommendation ID op**
```sql
SELECT id FROM ai_marketing_recommendations 
WHERE partner_id IS NULL 
  AND action_type = 'create_landing_page'
  AND status = 'pending'
LIMIT 1;
```

**Dan: Approve via API**
```bash
# Vervang REC_ID met het ID uit bovenstaande query
# Vervang YOUR_AUTH_TOKEN met je admin auth token

curl -X POST http://localhost:3000/api/marketing-recommendations/REC_ID/approve \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  --cookie-jar cookies.txt \
  --cookie cookies.txt
```

**Of via browser console (als je ingelogd bent):**
```javascript
// Open browser console op /admin/leads/engine
fetch('/api/marketing-recommendations/REC_ID/approve', {
  method: 'POST',
  credentials: 'include'
})
.then(r => r.json())
.then(console.log);
```

---

## 📋 Stap 7: Landing Page Publiceren

### Via SQL:
```sql
-- Haal de aangemaakte LP op
SELECT id, path, status, page_type 
FROM partner_landing_pages 
WHERE partner_id IS NULL 
  AND status = 'concept'
ORDER BY created_at DESC
LIMIT 1;

-- Publiceer de LP
UPDATE partner_landing_pages 
SET status = 'live' 
WHERE id = 'LP_ID_HIER';
```

### Of via API:
```bash
# Via publish endpoint (als beschikbaar)
curl -X POST http://localhost:3000/api/landing-pages/LP_ID/publish \
  -H "Cookie: your-session-cookie"
```

---

## 📋 Stap 8: Landing Page Bekijken in Browser

### A. Check de Path
```sql
SELECT path, site_id, segment_id 
FROM partner_landing_pages 
WHERE partner_id IS NULL 
  AND status = 'live'
LIMIT 1;
```

### B. Open in Browser
1. **Voor localhost testing:**
   - Zorg dat je server draait op `localhost:3000`
   - Open: `http://localhost:3000/schilder/noord-brabant/`
   - (Pas path aan naar wat je in de database hebt)

2. **Voor domain-based testing:**
   - Voeg toe aan `/etc/hosts` (Mac/Linux) of `C:\Windows\System32\drivers\etc\hosts` (Windows):
     ```
     127.0.0.1 growsocialmedia.nl
     ```
   - Update site domain in database naar `growsocialmedia.nl`
   - Open: `http://growsocialmedia.nl:3000/schilder/noord-brabant/`

### C. Wat Je Moet Zien:
- ✅ Hero section met headline
- ✅ Features section
- ✅ Contact formulier
- ✅ Internal links naar andere cluster pages (als die bestaan)

---

## 📋 Stap 9: Formulier Testen

1. **Vul het formulier in op de landing page:**
   - Naam: "Test Gebruiker"
   - Email: "test@example.com"
   - Telefoon: "0612345678"
   - Bericht: "Test bericht"

2. **Submit het formulier**

3. **Check de Lead in Database:**
```sql
SELECT 
  id,
  name,
  email,
  landing_page_id,
  source_type,
  routing_mode,
  segment_id,
  user_id  -- Moet automatisch toegewezen zijn
FROM leads
ORDER BY created_at DESC
LIMIT 1;
```

**Verwachte resultaten:**
- ✅ `landing_page_id` is gezet
- ✅ `source_type = 'platform'`
- ✅ `routing_mode = 'ai_segment_routing'`
- ✅ `user_id` is automatisch toegewezen (via AI router)

---

## 📋 Stap 10: Admin Dashboard Checken

### A. Leadstroom Dashboard
1. Ga naar `/admin/leads/engine`
2. Check de tabs:
   - **Overzicht**: KPIs en segmenten
   - **Segmenten & capaciteit**: Partner capaciteit per segment
   - **AI-acties**: Recommendations (platform + legacy)
   - **Content & campagnes**: Landing pages backlog

### B. Check Recommendations
```sql
-- Platform recommendations
SELECT COUNT(*) 
FROM ai_marketing_recommendations 
WHERE partner_id IS NULL;

-- Legacy recommendations
SELECT COUNT(*) 
FROM ai_marketing_recommendations 
WHERE partner_id IS NOT NULL;
```

---

## 🐛 Troubleshooting

### Probleem: Landing Page niet gevonden (404)
**Oplossing:**
1. Check of LP status = 'live'
2. Check of path exact matcht (inclusief trailing slash)
3. Check of site domain correct is in database
4. Check server logs voor errors

### Probleem: Formulier submit faalt
**Oplossing:**
1. Check browser console voor errors
2. Check of `/api/leads` endpoint bereikbaar is
3. Check of auth middleware niet blokkeert
4. Check server logs

### Probleem: Geen recommendations gegenereerd
**Oplossing:**
1. Check of er actieve sites zijn: `SELECT * FROM sites WHERE is_active = true;`
2. Check of er actieve segments zijn: `SELECT * FROM lead_segments WHERE is_active = true;`
3. Check of er lead gaps zijn (target vs actual)
4. Run orchestrator handmatig: `node cron/generateAiPartnerRecommendationsDaily.js`

### Probleem: Domain resolution werkt niet
**Oplossing:**
1. Check `req.hostname` in server logs
2. Voor localhost: gebruik `localhost:3000` als domain
3. Check SiteService cache: `SiteService.clearCache()` in code

---

## 🎯 Quick Test Checklist

- [ ] Migrations toegepast
- [ ] Default site domain geüpdatet
- [ ] Test segment aangemaakt
- [ ] Server draait op localhost:3000
- [ ] Recommendations gegenereerd
- [ ] Recommendation geapproved → LP aangemaakt
- [ ] LP gepubliceerd (status = 'live')
- [ ] LP zichtbaar in browser op `/schilder/noord-brabant/`
- [ ] Formulier werkt en lead wordt aangemaakt
- [ ] Lead heeft `landing_page_id`, `source_type`, `routing_mode`
- [ ] Lead is automatisch toegewezen aan partner

---

## 🚀 Snelle Test Commands

```bash
# 1. Test script draaien
node scripts/test-phase3-platform-lp.js

# 2. Orchestrator handmatig draaien
node cron/generateAiPartnerRecommendationsDaily.js

# 3. Check actieve sites
# (Via SQL Editor)
SELECT * FROM sites WHERE is_active = true;

# 4. Check actieve segments
# (Via SQL Editor)
SELECT * FROM lead_segments WHERE is_active = true;

# 5. Check platform LPs
# (Via SQL Editor)
SELECT id, path, status, page_type, site_id, segment_id 
FROM partner_landing_pages 
WHERE partner_id IS NULL;
```

---

**Succes met testen! 🎉**

