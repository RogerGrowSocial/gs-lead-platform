# Google Ads API - Activatie Handleiding

Je hebt nu toegang tot de Google Ads API! Hier is hoe je het activeert en gebruikt.

## ✅ Developer Token

Je developer token is: **`EFwUAp_r-fFKDxuhYM3n4A`**

## 📋 Stap 1: Environment Variables Configureren

Voeg deze regels toe aan je `.env` bestand:

```env
# Google Ads API Configuration
GOOGLE_ADS_DEVELOPER_TOKEN=EFwUAp_r-fFKDxuhYM3n4A
GOOGLE_ADS_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your-client-secret
GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token
GOOGLE_ADS_CUSTOMER_ID=1234567890  # Je Manager Account (MCC) ID zonder streepjes
```

## 🔑 Stap 2: OAuth2 Credentials Aanmaken

Als je nog geen OAuth2 credentials hebt:

1. Ga naar [Google Cloud Console](https://console.cloud.google.com/)
2. Maak een nieuw project aan (of gebruik bestaand project)
3. Ga naar "APIs & Services" → "Credentials"
4. Klik op "Create Credentials" → "OAuth client ID"
5. Als je nog geen OAuth consent screen hebt:
   - Ga naar "OAuth consent screen"
   - Kies "External" (of "Internal" als je Google Workspace gebruikt)
   - Vul in:
     - **App name**: GrowSocial Lead Platform
     - **User support email**: info@growsocialmedia.nl
     - **Developer contact**: info@growsocialmedia.nl
   - Scopes: Voeg toe: `https://www.googleapis.com/auth/adwords`
   - Test users: Voeg je eigen email toe
6. Terug naar Credentials:
   - **Application type**: Web application
   - **Name**: GrowSocial Google Ads API
   - **Authorized redirect URIs**: 
     - `http://localhost:3000/auth/google-ads/callback` (voor development)
   - Klik "Create"
7. Kopieer **Client ID** en **Client Secret**

## 🔄 Stap 3: Refresh Token Verkrijgen

Gebruik deze URL (vervang `YOUR_CLIENT_ID`):

```
https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/auth/google-ads/callback&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent
```

1. Open de URL in je browser
2. Autoriseer de applicatie
3. Kopieer de `code` uit de redirect URL
4. Exchange de code voor refresh token:

```bash
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code=YOUR_CODE" \
  -d "grant_type=authorization_code" \
  -d "redirect_uri=http://localhost:3000/auth/google-ads/callback"
```

5. Kopieer de `refresh_token` uit de response

## 🏢 Stap 4: Google Ads Manager Account ID Vinden

1. Log in op je **Manager Account (MCC)** op [Google Ads](https://ads.google.com/)
2. Klik op het account selector (rechtsboven)
3. Je **Manager Account ID** staat in de URL of in account settings
4. Format: `123-456-7890` (zonder streepjes: `1234567890`)
5. **Let op**: Dit is het ID van je MCC account, niet van een individueel customer account

## 🧪 Stap 5: Testen

1. Test de API verbinding:
   ```bash
   node scripts/test-google-ads-api.js
   ```

2. Sync campagnes naar database:
   ```bash
   node scripts/sync-google-ads-campaigns.js
   ```

3. Test via API endpoint:
   ```bash
   GET /api/admin/google-ads/test
   ```

## 🚀 Stap 6: Database Migration Uitvoeren

Run de nieuwe migration om campaign mapping toe te voegen:

```sql
-- Via Supabase Dashboard SQL Editor
-- Of via CLI: supabase migration up
```

De migration file is: `supabase/migrations/20250128000000_add_google_ads_campaign_mapping.sql`

## 📊 Nieuwe Features

### 1. Campaign Mapping
- Segmenten worden automatisch gekoppeld aan Google Ads campagnes
- Mapping wordt opgeslagen in `lead_segments.google_ads_campaign_id`
- Sync script: `scripts/sync-google-ads-campaigns.js`

### 2. Verbeterde API Client
- Retry logic met exponential backoff
- Betere error handling
- Support voor multi-account (via database)
- Campaign ID mapping uit database

### 3. Admin API Endpoints

**Sync Campaigns:**
```
POST /api/admin/google-ads/sync-campaigns
```

**Get All Campaigns:**
```
GET /api/admin/google-ads/campaigns
```

**Get Segment Stats:**
```
GET /api/admin/google-ads/segments/:segmentId/stats?date=2025-01-28
```

**Update Budget:**
```
POST /api/admin/google-ads/segments/:segmentId/budget
Body: { "dailyBudget": 100 }
```

**Get Mapped Segments:**
```
GET /api/admin/google-ads/segments
```

**Test Connection:**
```
GET /api/admin/google-ads/test
```

## 🔄 Automatische Budget Aanpassingen

Het systeem past automatisch budgets aan via de daily cronjob:

```bash
# Dagelijks om 03:00
node cron/adjustGoogleAdsBudgetsDaily.js
```

Of integreer in je bestaande cron systeem.

## 📝 Belangrijke Notities

1. **Campaign Naming**: Campagnes moeten de segment code bevatten in de naam (bijv. "Schilder - Noord-Brabant" voor segment "schilder_noord_brabant")

2. **Budget Limits**: 
   - Minimum: €5.00 per dag
   - Maximum: €1,000.00 per dag
   - Max wijziging: ±20% per dag

3. **Rate Limits**: 
   - Google Ads API: 15,000 operations per dag
   - Ons gebruik: ~100-500 operations per dag (ruim binnen limits)

4. **Multi-Account Support**: 
   - Je kunt meerdere Google Ads accounts beheren
   - Voeg accounts toe aan `google_ads_accounts` tabel
   - Segmenten kunnen verschillende customer IDs hebben

## 🐛 Troubleshooting

### "Developer token not approved"
- Check of je developer token correct is: `EFwUAp_r-fFKDxuhYM3n4A`
- Voor test accounts is geen goedkeuring nodig
- Voor productie accounts kan goedkeuring 1-3 dagen duren

### "Invalid refresh token"
- Genereer een nieuwe refresh token
- Zorg dat `access_type=offline` en `prompt=consent` in de OAuth URL staan

### "Customer ID not found"
- Check of je **Manager Account (MCC) ID** correct is (zonder streepjes)
- Check of je toegang hebt tot het Manager Account

### "Campaign not found"
- Run eerst het sync script: `node scripts/sync-google-ads-campaigns.js`
- Zorg dat campagnes de segment code in de naam hebben

## 📚 Documentatie

- [Google Ads API Docs](https://developers.google.com/google-ads/api/docs/start)
- [Node.js Client Library](https://github.com/Opteo/google-ads-api)
- [Design Document](./GOOGLE_ADS_API_DESIGN_DOCUMENT.md)
- [Setup Guide](./GOOGLE_ADS_SETUP.md)

## ✅ Checklist

- [ ] Developer token toegevoegd aan `.env`
- [ ] OAuth2 credentials geconfigureerd
- [ ] Refresh token verkregen
- [ ] Manager Account ID gevonden en toegevoegd
- [ ] Database migration uitgevoerd
- [ ] Test script gedraaid: `node scripts/test-google-ads-api.js`
- [ ] Campaigns gesynced: `node scripts/sync-google-ads-campaigns.js`
- [ ] API test endpoint getest: `GET /api/admin/google-ads/test`
- [ ] Daily cronjob geconfigureerd

---

**Klaar!** 🎉 Je Google Ads API integratie is nu actief en klaar voor gebruik!

