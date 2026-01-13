# Google Ads API Setup

Deze setup maakt het mogelijk om echte Google Ads campagnes te beheren via de Lead Flow Intelligence systeem.

## Stap 1: Google Ads API Developer Token aanvragen

**⚠️ BELANGRIJK**: De Developer Token kan **alleen** via het Google Ads API Center worden aangevraagd, **niet** via Google Cloud Console. Je hebt hiervoor een Google Ads account nodig.

1. Zorg dat je een Google Ads account hebt (of maak er een aan op [ads.google.com](https://ads.google.com))
2. Ga naar [Google Ads API Center](https://ads.google.com/aw/apicenter)
3. Log in met je Google Ads account
4. Klik op "Apply for API access" of "Request API access"
5. Vul het formulier in:
   - **Application name**: GrowSocial Lead Platform
   - **Contact email**: info@growsocialmedia.nl
   - **Website**: https://growsocialmedia.nl
   - **Use case**: Automatische budget aanpassingen op basis van lead gaps en demand planning
   - **Business model beschrijving** (zie hieronder)
6. Wacht op goedkeuring (kan 1-3 dagen duren)
7. **BELANGRIJK**: Kopieer je **Developer Token** zodra deze is goedgekeurd (ziet eruit als: `xxxx-xxxx-xxxx-xxxx`)

**📝 Business Model Beschrijving voor het formulier:**

Gebruik deze tekst voor het veld "Please briefly describe your company's business model and how you use Google Ads.":

```
GrowSocial is een B2B lead generation platform dat lokale dienstverleners (zoals schilders, dakdekkers, elektriciens) koppelt aan potentiële klanten via een geautomatiseerd lead routing systeem. 

Ons platform gebruikt Google Ads om leads te genereren voor verschillende branches en regio's. We beheren meerdere Google Ads campagnes via een Manager Account (MCC) voor verschillende partners binnen ons platform.

De Google Ads API gebruiken we voor:
- Automatische budget optimalisatie op basis van real-time lead demand en supply
- Dynamische campagne aanpassingen per segment (branche + regio combinatie)
- Performance monitoring en rapportage per partner account
- AI-gestuurde budget allocatie om lead gaps te dichten

We opereren als een platform/agency model waarbij we meerdere Google Ads accounts beheren via ons Manager Account voor verschillende partners binnen ons ecosysteem.
```

**Let op**: 
- Voor test accounts kun je direct een test developer token krijgen (geen goedkeuring nodig!)
- Voor productie accounts moet je wachten op goedkeuring van Google (1-3 dagen)

## ⚡ Workaround: Test Account gebruiken (SNEL!)

**Goed nieuws!** Je kunt direct beginnen met een **test account** zonder te wachten op goedkeuring:

1. Maak een Google Ads test account aan (gratis, geen creditcard nodig)
2. Ga naar het API Center in dat test account
3. Krijg **direct** een test developer token (geen goedkeuring nodig!)
4. Gebruik deze om te ontwikkelen en testen
5. Vraag later een productie developer token aan voor je echte account

**Test account aanmaken:**
- Ga naar [ads.google.com](https://ads.google.com)
- Maak een nieuw account aan
- Je hoeft **geen campagnes te starten** of geld uit te geven
- Het account is alleen nodig om toegang te krijgen tot het API Center

**Alternatief: MCC Account (Manager Account)**

**Wat is een MCC?**
- MCC = **Manager Account** (ook wel "My Client Center" genoemd)
- Een speciaal type Google Ads account dat **meerdere Google Ads accounts kan beheren**
- **Gratis** - je hoeft geen campagnes te starten of geld uit te geven
- Perfect voor agencies of platforms die meerdere accounts beheren

**Voordelen van MCC:**
- ✅ Direct toegang tot API Center (geen goedkeuring nodig voor test)
- ✅ Kan meerdere Google Ads accounts linken en beheren
- ✅ Centraal overzicht van alle accounts
- ✅ Ideaal voor ons platform (we beheren meerdere partner accounts)

**MCC Account aanmaken:**
1. Ga naar [ads.google.com](https://ads.google.com)
2. Klik op "Switch to Expert Mode" (onderaan)
3. Kies "Create a manager account"
4. Vul de gegevens in (geen creditcard nodig)
5. Je hebt nu direct toegang tot het API Center!

**Wanneer gebruik je MCC vs Test Account?**
- **MCC**: Als je meerdere accounts gaat beheren (aanbevolen voor productie)
- **Test Account**: Als je snel wilt testen (simpeler, maar beperkt tot 1 account)

## Stap 2: OAuth2 Credentials aanmaken

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
   - Klik "Save and Continue"
   - Scopes: Voeg toe: `https://www.googleapis.com/auth/adwords`
   - Test users: Voeg je eigen email toe
   - Klik "Save and Continue"
6. Terug naar Credentials:
   - **Application type**: Web application
   - **Name**: GrowSocial Google Ads API
   - **Authorized redirect URIs**: 
     - `http://localhost:3000/auth/google-ads/callback` (voor development)
     - Voeg productie URL toe later
   - Klik "Create"
7. **BELANGRIJK**: Kopieer:
   - **Client ID**
   - **Client Secret**

## Stap 3: Refresh Token verkrijgen

1. Gebruik de OAuth2 Playground of maak een simpel script:
   ```bash
   node scripts/get-google-ads-refresh-token.js
   ```
2. Of gebruik deze URL (vervang CLIENT_ID):
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/auth/google-ads/callback&response_type=code&scope=https://www.googleapis.com/auth/adwords&access_type=offline&prompt=consent
   ```
3. Autoriseer de applicatie
4. Kopieer de `code` uit de redirect URL
5. Exchange de code voor refresh token:
   ```bash
   curl -X POST https://oauth2.googleapis.com/token \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "code=YOUR_CODE" \
     -d "grant_type=authorization_code" \
     -d "redirect_uri=http://localhost:3000/auth/google-ads/callback"
   ```
6. Kopieer de `refresh_token` uit de response

## Stap 4: Google Ads Manager Account ID vinden

**⚠️ BELANGRIJK**: Gebruik je **Manager Account (MCC) ID**, niet een individueel customer account ID.

1. Log in op je **Manager Account** op [Google Ads](https://ads.google.com/)
2. Klik op het account selector (rechtsboven)
3. Je **Manager Account ID** staat in de URL of in account settings
4. Format: `123-456-7890` (zonder streepjes: `1234567890`)
5. **Let op**: Dit is het ID van je MCC account, niet van een individueel customer account

## Stap 5: Environment Variables Configureren

Voeg deze regels toe aan je `.env` bestand:

```env
# Google Ads API Configuration
GOOGLE_ADS_DEVELOPER_TOKEN=EFwUAp_r-fFKDxuhYM3n4A
GOOGLE_ADS_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your-client-secret
GOOGLE_ADS_REFRESH_TOKEN=your-refresh-token
GOOGLE_ADS_CUSTOMER_ID=1234567890  # Dit is je Manager Account (MCC) ID
```

## Stap 6: Testen

1. Herstart je server
2. Test de integratie:
   ```bash
   node scripts/test-google-ads-api.js
   ```
3. Check de console logs voor errors

## Troubleshooting

### "Developer token not approved"
- Wacht op goedkeuring van Google
- Check je email voor updates

### "Invalid refresh token"
- Genereer een nieuwe refresh token
- Zorg dat `access_type=offline` en `prompt=consent` in de OAuth URL staan

### "Customer ID not found" of "Manager Account ID not found"
- Check of je **Manager Account (MCC) ID** correct is (zonder streepjes)
- Check of je toegang hebt tot het Manager Account
- Gebruik het ID van je MCC account, niet van een individueel customer account

### "Campaign not found"
- Zorg dat campagnes de segment code in de naam hebben
- Of update de database om campaign IDs op te slaan

## Kosten

- Google Ads API is **gratis** te gebruiken
- Je betaalt alleen voor je Google Ads campagnes (zoals normaal)
- Rate limits: 15,000 operations per dag (meer dan genoeg)

## Documentatie

- [Google Ads API Docs](https://developers.google.com/google-ads/api/docs/start)
- [Node.js Client Library](https://github.com/Opteo/google-ads-api)

