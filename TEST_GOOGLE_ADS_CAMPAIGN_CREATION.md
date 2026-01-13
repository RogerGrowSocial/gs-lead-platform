# 🧪 Test Handleiding: Google Ads Campaign Creation

## Stap 1: Check of er AI Recommendations zijn

### Optie A: Via de UI
1. Ga naar: `http://localhost:3000/admin/leads/engine/ai-actions`
2. Check of er `create_campaign` recommendations zijn
3. Als er geen zijn → ga naar Stap 2

### Optie B: Via API
```bash
curl http://localhost:3000/api/admin/leadstroom/ai-actions?status=pending \
  -H "Cookie: your-session-cookie" \
  | jq '.data.recommendations[] | select(.actionType == "create_campaign")'
```

---

## Stap 2: Genereer AI Recommendations (als er geen zijn)

### Optie A: Wacht op Daily Cron Job
De cron job draait automatisch dagelijks en genereert recommendations.

### Optie B: Handmatig Triggeren
```bash
cd gs-lead-platform
node -e "
const PartnerMarketingOrchestratorService = require('./services/partnerMarketingOrchestratorService');
const today = new Date();
PartnerMarketingOrchestratorService.generatePlatformMarketingActions(today)
  .then(actions => {
    console.log('✅ Generated', actions.length, 'actions');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
"
```

---

## Stap 3: Test Campaign Creation

### Via UI (Aanbevolen)
1. Ga naar: `http://localhost:3000/admin/leads/engine/ai-actions`
2. Zoek een `create_campaign` recommendation
3. Klik op de recommendation om de modal te openen
4. Check de details:
   - ✅ Campagne naam
   - ✅ Dagelijks budget
   - ✅ Target locaties (moet specifieke regio zijn, niet "NL")
   - ✅ Landing page URL
5. Klik op **"Goedkeuren"**
6. Wacht op success message

### Via API (Voor Developers)
```bash
# 1. Haal recommendations op
REC_ID=$(curl -s http://localhost:3000/api/admin/leadstroom/ai-actions?status=pending \
  -H "Cookie: your-session-cookie" \
  | jq -r '.data.recommendations[] | select(.actionType == "create_campaign") | .id' | head -1)

# 2. Approve recommendation
curl -X POST http://localhost:3000/api/marketing-recommendations/$REC_ID/approve \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json" \
  | jq '.'
```

---

## Stap 4: Verifieer Campaign Creation

### Check Database
```sql
-- Check of segment is gekoppeld aan campagne
SELECT 
  code,
  branch,
  region,
  google_ads_campaign_id,
  google_ads_campaign_name,
  google_ads_last_synced_at
FROM lead_segments
WHERE google_ads_campaign_id IS NOT NULL
ORDER BY google_ads_last_synced_at DESC;
```

### Check Google Ads API
```bash
# Via API endpoint
curl http://localhost:3000/api/admin/google-ads/campaigns \
  -H "Cookie: your-session-cookie" \
  | jq '.data[] | select(.name | contains("glaszetter"))'
```

### Check Server Logs
```bash
# Check server logs voor campaign creation
tail -f /tmp/server.log | grep -i "campaign\|google.*ads"
```

---

## Stap 5: Verifieer Next-Level Features

### Check Ad Extensions
In Google Ads interface:
- Ga naar de campagne
- Check "Assets" → "Sitelinks", "Callouts", "Structured Snippets"
- Moeten automatisch zijn toegevoegd

### Check Negative Keywords
In Google Ads interface:
- Ga naar de campagne
- Check "Keywords" → "Negative keywords"
- Moeten keywords bevatten zoals "gratis", "vacature", "diy"

### Check Multi-Ad Groups
In Google Ads interface:
- Ga naar de campagne
- Check "Ad groups"
- Moeten 3 ad groups hebben:
  - `[Branch] [Region]` (location)
  - `[Branch] Offerte [Region]` (intent)
  - `Spoed [Branch] [Region]` (urgency)

### Check Keywords
In Google Ads interface:
- Ga naar elk ad group
- Check keywords:
  - Location ad group: core keywords zonder "offerte", "prijs", "spoed"
  - Intent ad group: keywords met "offerte", "prijs", "kosten"
  - Urgency ad group: keywords met "spoed", "snel", "vandaag"

### Check RSA Ads
In Google Ads interface:
- Ga naar elk ad group
- Check "Ads" → "Responsive search ads"
- Moeten 15 headlines en 4 descriptions hebben
- Headlines moeten per ad group type verschillen

---

## Stap 6: Test Optimization Service

### Handmatig Triggeren
```bash
# Optimize één campagne
curl -X POST http://localhost:3000/api/admin/google-ads/campaigns/CAMPAIGN_ID/optimize \
  -H "Cookie: your-session-cookie" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": "YOUR_CUSTOMER_ID"}' \
  | jq '.'
```

### Check Optimization Results
```bash
# Check server logs
tail -f /tmp/server.log | grep -i "optimize\|pause\|quality"
```

---

## Stap 7: Test Daily Optimization Cron

### Check Cron Job
```bash
# Check of cron job is geregistreerd
grep -i "optimizeGoogleAdsCampaignsDaily" gs-lead-platform/cron/leadFlowIntelligenceJobs.js
```

### Handmatig Draaien
```bash
cd gs-lead-platform
node cron/optimizeGoogleAdsCampaignsDaily.js
```

---

## 🐛 Troubleshooting

### Geen Recommendations
**Probleem:** Geen `create_campaign` recommendations zichtbaar

**Oplossing:**
1. Check of er segments zijn met `gap > 3` en geen `google_ads_campaign_id`
2. Run handmatig: `node -e "require('./services/partnerMarketingOrchestratorService').generatePlatformMarketingActions(new Date()).then(console.log)"`
3. Check database: `SELECT * FROM ai_marketing_recommendations WHERE action_type = 'create_campaign' AND status = 'pending'`

### Campaign Creation Fails
**Probleem:** Error bij campaign creation

**Oplossing:**
1. Check Google Ads API credentials in `.env`
2. Check server logs voor specifieke error
3. Check of customer ID correct is
4. Test API connection: `GET /api/admin/google-ads/test`

### Ad Extensions Niet Zichtbaar
**Probleem:** Ad extensions worden niet getoond in Google Ads

**Oplossing:**
1. Check server logs voor asset creation errors
2. Assets worden aangemaakt, maar linking kan verbeterd worden
3. Check Google Ads interface → Assets → Campaign assets

### Negative Keywords Niet Toegevoegd
**Probleem:** Negative keywords zijn niet zichtbaar

**Oplossing:**
1. Check server logs voor keyword creation errors
2. Negative keywords worden toegevoegd op campaign level
3. Check Google Ads interface → Keywords → Negative keywords

---

## ✅ Success Criteria

Een succesvolle test betekent:
- ✅ Campaign wordt aangemaakt (ENABLED status)
- ✅ 3 ad groups worden aangemaakt
- ✅ Keywords worden toegevoegd per ad group
- ✅ RSA ads worden aangemaakt per ad group
- ✅ Ad extensions worden aangemaakt (assets)
- ✅ Negative keywords worden toegevoegd
- ✅ Campaign is zichtbaar in Google Ads interface
- ✅ Segment is gekoppeld in database

---

## 📊 Test Checklist

- [ ] AI recommendation wordt getoond
- [ ] Modal toont correcte details
- [ ] Target locaties zijn specifiek (niet "NL")
- [ ] Campaign wordt aangemaakt
- [ ] Campaign status is ENABLED
- [ ] 3 ad groups worden aangemaakt
- [ ] Keywords worden toegevoegd
- [ ] RSA ads worden aangemaakt
- [ ] Ad extensions worden aangemaakt
- [ ] Negative keywords worden toegevoegd
- [ ] Segment wordt gekoppeld in database
- [ ] Campaign is zichtbaar in Google Ads

---

## 🚀 Quick Test Script

```bash
#!/bin/bash
# Quick test script voor Google Ads campaign creation

echo "🧪 Testing Google Ads Campaign Creation..."

# 1. Check API connection
echo "1. Testing API connection..."
curl -s http://localhost:3000/api/admin/google-ads/test \
  -H "Cookie: your-session-cookie" | jq '.'

# 2. Check for recommendations
echo "2. Checking for create_campaign recommendations..."
curl -s http://localhost:3000/api/admin/leadstroom/ai-actions?status=pending \
  -H "Cookie: your-session-cookie" \
  | jq '.data.recommendations[] | select(.actionType == "create_campaign")'

# 3. Check existing campaigns
echo "3. Checking existing campaigns..."
curl -s http://localhost:3000/api/admin/google-ads/campaigns \
  -H "Cookie: your-session-cookie" \
  | jq '.data | length'

echo "✅ Test complete!"
```

