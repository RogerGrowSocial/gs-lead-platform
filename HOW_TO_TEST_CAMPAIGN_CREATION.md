# 🧪 Hoe Test Je Google Ads Campaign Creation?

## 🚀 Snelle Test (5 minuten)

### Stap 1: Genereer Recommendations

**Optie A: Via UI (Makkelijkst)**
1. Ga naar: `http://localhost:3000/admin/leads/engine/ai-actions`
2. Klik op de **"Genereer Aanbevelingen"** knop (bovenaan de pagina)
3. Wacht tot recommendations zijn gegenereerd

**Optie B: Via Script**
```bash
cd gs-lead-platform
node scripts/test-campaign-creation.js
```

**Optie C: Via API**
```bash
curl -X POST http://localhost:3000/api/admin/leadstroom/generate-recommendations \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json"
```

---

### Stap 2: Vind een create_campaign Recommendation

1. Ga naar: `http://localhost:3000/admin/leads/engine/ai-actions`
2. Zoek in de lijst naar een recommendation met type **"Google Ads Campagne"**
3. Als je er geen ziet:
   - Check of er segments zijn met gaps > 3
   - Check of segments al een campagne hebben
   - Run het test script om te zien wat er is

---

### Stap 3: Test Campaign Creation

1. **Klik op de recommendation** → Modal opent
2. **Check de details:**
   - ✅ Campagne naam (bijv. "glaszetter - gelderland")
   - ✅ Dagelijks budget (bijv. "€10.00/dag")
   - ✅ Target locaties (moet specifieke regio zijn, niet "NL")
   - ✅ Landing page URL
3. **Check de groene box:**
   - Moet zeggen: "Next Level Automatisering"
   - Moet uitleggen dat alles automatisch gebeurt
   - Moet zeggen dat campagne direct ENABLED is
4. **Klik op "Goedkeuren"**
5. **Wacht op success message**

---

### Stap 4: Verifieer in Database

```sql
-- Check of segment is gekoppeld
SELECT 
  code,
  branch,
  region,
  google_ads_campaign_id,
  google_ads_campaign_name,
  google_ads_last_synced_at
FROM lead_segments
WHERE google_ads_campaign_id IS NOT NULL
ORDER BY google_ads_last_synced_at DESC
LIMIT 5;
```

---

### Stap 5: Verifieer in Google Ads

1. Log in op Google Ads: https://ads.google.com
2. Ga naar je account
3. Check of campagne is aangemaakt:
   - ✅ Status moet **"Actief"** zijn (niet "Gepauzeerd")
   - ✅ Naam moet overeenkomen met recommendation
4. Check ad groups:
   - ✅ Moeten **3 ad groups** zijn:
     - `[Branch] [Region]` (location)
     - `[Branch] Offerte [Region]` (intent)
     - `Spoed [Branch] [Region]` (urgency)
5. Check keywords:
   - ✅ Elke ad group moet keywords hebben
   - ✅ Keywords moeten per ad group type verschillen
6. Check ads:
   - ✅ Elke ad group moet Responsive Search Ads hebben
   - ✅ Ads moeten 15 headlines en 4 descriptions hebben
7. Check ad extensions:
   - ✅ Ga naar "Assets" → "Sitelinks, Callouts, Structured Snippets"
   - ✅ Moeten automatisch zijn toegevoegd
8. Check negative keywords:
   - ✅ Ga naar "Keywords" → "Negative keywords"
   - ✅ Moeten keywords bevatten zoals "gratis", "vacature", "diy"

---

## 🐛 Troubleshooting

### Geen Recommendations?

**Check 1: Zijn er segments met gaps?**
```sql
SELECT 
  s.code,
  s.branch,
  s.region,
  s.google_ads_campaign_id,
  p.lead_gap
FROM lead_segments s
LEFT JOIN lead_segment_plans p ON p.segment_id = s.id
WHERE s.is_active = true
  AND s.google_ads_campaign_id IS NULL
  AND p.lead_gap > 3
LIMIT 5;
```

**Check 2: Zijn er recommendations in database?**
```sql
SELECT 
  id,
  action_type,
  status,
  action_details->>'campaign_name' as campaign_name,
  created_at
FROM ai_marketing_recommendations
WHERE action_type = 'create_campaign'
  AND status = 'pending'
ORDER BY created_at DESC
LIMIT 5;
```

**Oplossing: Genereer handmatig**
```bash
cd gs-lead-platform
node cron/generateAiPartnerRecommendationsDaily.js
```

---

### Campaign Creation Fails?

**Check server logs:**
```bash
tail -f /tmp/server.log | grep -i "campaign\|error"
```

**Check API connection:**
```bash
curl http://localhost:3000/api/admin/google-ads/test \
  -H "Cookie: your-session-cookie"
```

**Veelvoorkomende errors:**
- `Google Ads API client not initialized` → Check `.env` file
- `Customer ID not found` → Check `GOOGLE_ADS_CUSTOMER_ID` in `.env`
- `Permission denied` → Check of customer ID correct is

---

### Ad Extensions Niet Zichtbaar?

Ad extensions worden aangemaakt als **Assets** in Google Ads. Ze moeten worden gelinkt aan de campagne. Dit kan even duren voordat ze zichtbaar zijn in de interface.

**Check in Google Ads:**
- Ga naar "Assets" → "Campaign assets"
- Check of sitelinks, callouts, structured snippets zijn toegevoegd

---

## ✅ Success Checklist

Na een succesvolle test moet je zien:

- [ ] ✅ Campaign is aangemaakt in Google Ads (status: Actief)
- [ ] ✅ 3 ad groups zijn aangemaakt
- [ ] ✅ Keywords zijn toegevoegd per ad group
- [ ] ✅ RSA ads zijn aangemaakt per ad group
- [ ] ✅ Ad extensions zijn toegevoegd (assets)
- [ ] ✅ Negative keywords zijn toegevoegd
- [ ] ✅ Segment is gekoppeld in database (`google_ads_campaign_id` is gevuld)
- [ ] ✅ Success message in UI

---

## 🎯 Test Script Output

Wanneer je `node scripts/test-campaign-creation.js` runt, krijg je:

```
🧪 Testing Google Ads Campaign Creation...

1️⃣ Checking for segments with gaps but no campaign...
✅ Found 3 segments without campaigns

2️⃣ Generating AI recommendations...
✅ Generated 2 create_campaign recommendations

3️⃣ Recommendations to test:
   1. glaszetter - gelderland
      Segment: abc-123-def
      Budget: €10/day
      Locations: gelderland
      Priority: medium

4️⃣ Next steps:
   - Go to: http://localhost:3000/admin/leads/engine/ai-actions
   - Find a create_campaign recommendation
   - Click to open modal
   - Click "Goedkeuren" to create the campaign
```

---

## 📞 Hulp Nodig?

Als er iets niet werkt:
1. Check server logs: `tail -f /tmp/server.log`
2. Check database voor recommendations
3. Test API connection: `GET /api/admin/google-ads/test`
4. Check Google Ads API credentials in `.env`

