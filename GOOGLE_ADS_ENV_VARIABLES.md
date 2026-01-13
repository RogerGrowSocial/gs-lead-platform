# Google Ads API - Environment Variables

**Vereiste environment variables voor Google Ads API integratie**

---

## 🔑 Verplichte Variabelen (Core Authentication)

Voeg deze toe aan je `.env` bestand:

```env
# Google Ads API - Core Authentication (VERPLICHT)
GOOGLE_ADS_DEVELOPER_TOKEN=EFwUAp_r-fFKDxuhYM3n4A
GOOGLE_ADS_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your-client-secret
GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token
GOOGLE_ADS_CUSTOMER_ID=1234567890
```

### Uitleg:

1. **`GOOGLE_ADS_DEVELOPER_TOKEN`**
   - Je Google Ads API Developer Token
   - Al bekend: `EFwUAp_r-fFKDxuhYM3n4A`
   - Verkrijgbaar via: https://ads.google.com/aw/apicenter

2. **`GOOGLE_ADS_CLIENT_ID`**
   - OAuth2 Client ID van Google Cloud Console
   - Format: `xxxxx.apps.googleusercontent.com`
   - Verkrijgbaar via: https://console.cloud.google.com/apis/credentials

3. **`GOOGLE_ADS_CLIENT_SECRET`**
   - OAuth2 Client Secret van Google Cloud Console
   - Verkrijgbaar via: https://console.cloud.google.com/apis/credentials

4. **`GOOGLE_ADS_REFRESH_TOKEN`**
   - OAuth2 Refresh Token (verkrijg via OAuth flow)
   - Zie instructies hieronder voor het verkrijgen

5. **`GOOGLE_ADS_CUSTOMER_ID`**
   - Je Google Ads Manager Account (MCC) ID
   - Format: `1234567890` (zonder streepjes)
   - **BELANGRIJK**: Dit is je Manager Account ID, niet een individueel customer account

---

## ⚙️ Optionele Variabelen (Configuration)

Deze zijn optioneel maar aanbevolen:

```env
# Google Ads API - Campaign Configuration (Optioneel)
GOOGLE_ADS_CAMPAIGN_GOAL=LEADS
GOOGLE_ADS_DEFAULT_MAX_CPC_EUR=2.5
GOOGLE_ADS_CAMPAIGN_MIN_DAILY_BUDGET=5
GOOGLE_ADS_CAMPAIGN_MAX_DAILY_BUDGET=1000
GOOGLE_ADS_BUDGET_GUARD_MODE=error
GOOGLE_ADS_ENABLE_SEARCH_PARTNERS=false
GOOGLE_ADS_DEFAULT_LANGUAGE_CONSTANT_IDS=1010
GOOGLE_ADS_STRICT_LOCATION_CHECK=true

# Tracking & Assets (Optioneel)
GOOGLE_ADS_TRACKING_TEMPLATE={lpurl}?gclid={gclid}&gbraid={gbraid}&wbraid={wbraid}
GOOGLE_ADS_LOGO_URL=https://growsocialmedia.nl/logo.png

# Branch-specific overrides (Optioneel)
GOOGLE_ADS_DEFAULT_MAX_CPC_EUR_SCHILDER=3.0
GOOGLE_ADS_MAX_DAILY_BUDGET_SCHILDER=500
```

---

## 📋 Stap-voor-stap Setup

### Stap 1: OAuth2 Credentials Aanmaken

1. Ga naar [Google Cloud Console](https://console.cloud.google.com/)
2. Selecteer je project (of maak een nieuw project aan)
3. Ga naar **APIs & Services** → **Credentials**
4. Klik op **Create Credentials** → **OAuth client ID**
5. Als je nog geen OAuth consent screen hebt:
   - Ga naar **OAuth consent screen**
   - Kies **External** (of **Internal** als je Google Workspace gebruikt)
   - Vul in:
     - **App name**: GrowSocial Lead Platform
     - **User support email**: info@growsocialmedia.nl
     - **Developer contact**: info@growsocialmedia.nl
   - **Scopes**: Voeg toe: `https://www.googleapis.com/auth/adwords`
   - **Test users**: Voeg je eigen email toe
6. Terug naar **Credentials**:
   - **Application type**: Web application
   - **Name**: GrowSocial Google Ads API
   - **Authorized redirect URIs**: 
     - `http://localhost:3000/auth/google-ads/callback` (voor development)
     - `https://yourdomain.com/auth/google-ads/callback` (voor production)
   - Klik **Create**
7. **Kopieer Client ID en Client Secret**

### Stap 2: Refresh Token Verkrijgen

1. Vervang `YOUR_CLIENT_ID` in deze URL:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/auth/google-ads/callback&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent
   ```

2. Open de URL in je browser
3. Autoriseer de applicatie
4. Kopieer de `code` uit de redirect URL (na `?code=`)
5. Exchange de code voor refresh token:
   ```bash
   curl -X POST https://oauth2.googleapis.com/token \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "code=YOUR_CODE" \
     -d "grant_type=authorization_code" \
     -d "redirect_uri=http://localhost:3000/auth/google-ads/callback"
   ```
6. **Kopieer de `refresh_token`** uit de response

### Stap 3: Manager Account ID Vinden

1. Log in op je **Manager Account** op [Google Ads](https://ads.google.com/)
2. Klik op het account selector (rechtsboven)
3. Je **Manager Account ID** staat in de URL of in account settings
4. Format: `123-456-7890` → gebruik zonder streepjes: `1234567890`
5. **BELANGRIJK**: Dit is het ID van je MCC account, niet van een individueel customer account

### Stap 4: .env Bestand Updaten

Voeg alle variabelen toe aan je `.env` bestand:

```env
# Google Ads API - Core (VERPLICHT)
GOOGLE_ADS_DEVELOPER_TOKEN=EFwUAp_r-fFKDxuhYM3n4A
GOOGLE_ADS_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=xxxxx
GOOGLE_ADS_REFRESH_TOKEN=xxxxx
GOOGLE_ADS_CUSTOMER_ID=1234567890

# Google Ads API - Configuration (Optioneel)
GOOGLE_ADS_CAMPAIGN_GOAL=LEADS
GOOGLE_ADS_DEFAULT_MAX_CPC_EUR=2.5
GOOGLE_ADS_TRACKING_TEMPLATE={lpurl}?gclid={gclid}&gbraid={gbraid}&wbraid={wbraid}
```

### Stap 5: Testen

1. Herstart je server
2. Test de integratie:
   ```bash
   node scripts/test-google-ads-api.js
   ```

---

## 🔍 Troubleshooting

### "Google Ads API credentials not configured"
- Check of alle 5 verplichte variabelen zijn ingesteld
- Check of er geen typos zijn in de variabelen namen
- Herstart de server na het toevoegen van variabelen

### "Invalid refresh token"
- Genereer een nieuwe refresh token (zie Stap 2)
- Zorg dat `access_type=offline` en `prompt=consent` in de OAuth URL staan

### "Customer ID not found"
- Check of je **Manager Account (MCC) ID** correct is (zonder streepjes)
- Check of je toegang hebt tot het Manager Account
- Gebruik het ID van je MCC account, niet van een individueel customer account

### "Developer token not approved"
- Wacht op goedkeuring van Google (kan 1-3 dagen duren)
- Check je email voor updates

---

## 📝 Voorbeeld .env Bestand

```env
# Google Ads API - Core Authentication
GOOGLE_ADS_DEVELOPER_TOKEN=EFwUAp_r-fFKDxuhYM3n4A
GOOGLE_ADS_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
GOOGLE_ADS_REFRESH_TOKEN=1//0abcdefghijklmnopqrstuvwxyz
GOOGLE_ADS_CUSTOMER_ID=1234567890

# Google Ads API - Campaign Settings
GOOGLE_ADS_CAMPAIGN_GOAL=LEADS
GOOGLE_ADS_DEFAULT_MAX_CPC_EUR=2.5
GOOGLE_ADS_CAMPAIGN_MIN_DAILY_BUDGET=5
GOOGLE_ADS_CAMPAIGN_MAX_DAILY_BUDGET=1000
GOOGLE_ADS_ENABLE_SEARCH_PARTNERS=false
GOOGLE_ADS_DEFAULT_LANGUAGE_CONSTANT_IDS=1010
GOOGLE_ADS_STRICT_LOCATION_CHECK=true

# Tracking
GOOGLE_ADS_TRACKING_TEMPLATE={lpurl}?gclid={gclid}&gbraid={gbraid}&wbraid={wbraid}

# Assets
GOOGLE_ADS_LOGO_URL=https://growsocialmedia.nl/logo.png
```

---

## ✅ Checklist

- [ ] Developer Token toegevoegd
- [ ] OAuth2 Client ID aangemaakt en toegevoegd
- [ ] OAuth2 Client Secret toegevoegd
- [ ] Refresh Token verkregen en toegevoegd
- [ ] Manager Account ID gevonden en toegevoegd
- [ ] Server herstart
- [ ] Test script uitgevoerd
- [ ] Geen errors in console

---

**Klaar!** Je Google Ads API integratie is nu geconfigureerd. 🚀

