# Rabobank API - Environment Variables

**Vereiste environment variables voor Rabobank API integratie**

---

## 🔑 Verplichte Variabelen (Core Authentication)

Voeg deze toe aan je `.env` bestand:

```env
# Rabobank API - Core Authentication (VERPLICHT)
RABOBANK_CLIENT_ID=021982d37013e06a4b453422ec715f44
RABOBANK_CLIENT_SECRET=87153edc1f8c1a738c3965d364230dcb
RABOBANK_SANDBOX_MODE=true
APP_URL=http://localhost:3000
```

### Uitleg:

1. **`RABOBANK_CLIENT_ID`**
   - Je Rabobank API Client ID (Application ID)
   - Verkrijgbaar via: https://developer.rabobank.nl/
   - Format: Alphanumeric string (32+ karakters)
   - **Huidige waarde**: `021982d37013e06a4b453422ec715f44`

2. **`RABOBANK_CLIENT_SECRET`**
   - Je Rabobank API Client Secret (Application Secret)
   - Verkrijgbaar via: https://developer.rabobank.nl/
   - Format: Alphanumeric string (32+ karakters)
   - **Huidige waarde**: `87153edc1f8c1a738c3965d364230dcb`
   - **BELANGRIJK**: Bewaar deze veilig en deel deze nooit publiekelijk!

3. **`RABOBANK_SANDBOX_MODE`**
   - Gebruik sandbox omgeving (`true`) of productie (`false`)
   - **Development**: `true` (gebruikt test omgeving)
   - **Production**: `false` (gebruikt live omgeving)
   - Default: `true` (veiligheid)

4. **`APP_URL`**
   - Basis URL van je applicatie
   - Gebruikt voor OAuth redirect URI's
   - **Development**: `http://localhost:3000`
   - **Production**: `https://app.growsocialmedia.nl`
   - Moet exact overeenkomen met redirect URI in Rabobank Developer Portal

---

## 🌐 OAuth vs API URLs (belangrijk)

OAuth (authorize + token) moet altijd via **oauth.rabobank.nl** lopen, niet via api-sandbox.rabobank.nl. Anders krijg je "Access Denied" en een client certificate prompt in de browser. De resource API (rekeningen, transacties) blijft via api-sandbox of api.rabobank.nl.

Optioneel kun je de URLs overschrijven:

```env
# OAuth endpoints (standaard: oauth.rabobank.nl – geen override nodig)
RABOBANK_OAUTH_AUTHORIZE_URL=https://oauth.rabobank.nl/openapi/oauth2/authorize
RABOBANK_OAUTH_TOKEN_URL=https://oauth.rabobank.nl/openapi/oauth2/token

# Resource API base (standaard afhankelijk van RABOBANK_SANDBOX_MODE)
RABOBANK_API_BASE_URL=https://api-sandbox.rabobank.nl
# of productie: https://api.rabobank.nl
```

- **Authorize/Token**: altijd oauth.rabobank.nl (browser redirect + server-side token exchange).
- **API base**: api-sandbox.rabobank.nl of api.rabobank.nl; mTLS alleen server-side indien vereist.

---

## ⚙️ Optionele Variabelen (Configuration)

Deze zijn optioneel maar kunnen handig zijn:

```env
# Rabobank API - Advanced Configuration (Optioneel)
RABOBANK_TOKEN_REFRESH_THRESHOLD=300  # Refresh token 5 minuten voor expiry (seconden)
RABOBANK_REQUEST_TIMEOUT=30000  # Request timeout in milliseconden
RABOBANK_MAX_RETRIES=3  # Maximum aantal retries bij API failures
```

### Uitleg:

1. **`RABOBANK_TOKEN_REFRESH_THRESHOLD`**
   - Tijd in seconden voordat token verloopt om automatisch te refreshen
   - Default: `300` (5 minuten)
   - Voorkomt expired tokens tijdens API calls

2. **`RABOBANK_REQUEST_TIMEOUT`**
   - Timeout voor API requests in milliseconden
   - Default: `30000` (30 seconden)
   - Verhoog bij trage verbindingen

3. **`RABOBANK_MAX_RETRIES`**
   - Maximum aantal retries bij gefaalde API calls
   - Default: `3`
   - Alleen voor transient errors (network, rate limits)

---

## 🔄 Environment Setup per Omgeving

### Development (.env)

```env
# Development Environment
RABOBANK_CLIENT_ID=021982d37013e06a4b453422ec715f44
RABOBANK_CLIENT_SECRET=87153edc1f8c1a738c3965d364230dcb
RABOBANK_SANDBOX_MODE=true
APP_URL=http://localhost:3000
```

### Staging (.env.staging)

```env
# Staging Environment
RABOBANK_CLIENT_ID=staging_client_id_hier
RABOBANK_CLIENT_SECRET=staging_client_secret_hier
RABOBANK_SANDBOX_MODE=true  # Nog steeds sandbox voor staging
APP_URL=https://staging.jouw-domein.nl
```

### Production (.env.production)

```env
# Production Environment
RABOBANK_CLIENT_ID=production_client_id_hier
RABOBANK_CLIENT_SECRET=production_client_secret_hier
RABOBANK_SANDBOX_MODE=false  # Productie omgeving
APP_URL=https://app.growsocialmedia.nl
```

---

## ✅ Validatie Checklist

Voordat je de applicatie start, controleer:

- [ ] `RABOBANK_CLIENT_ID` is ingesteld
- [ ] `RABOBANK_CLIENT_SECRET` is ingesteld
- [ ] `RABOBANK_SANDBOX_MODE` is ingesteld (`true` of `false`)
- [ ] `APP_URL` is ingesteld en correct
- [ ] Redirect URI in Rabobank Developer Portal komt overeen met `${APP_URL}/auth/rabobank/callback`
- [ ] `.env` staat in `.gitignore` (credentials niet in Git!)
- [ ] Productie credentials zijn anders dan development credentials

---

## 🔒 Beveiliging Best Practices

### ✅ DOEN:

1. **Environment Variables gebruiken**
   - Sla credentials op in environment variables, niet in code
   - Gebruik `.env` voor development, environment variables voor productie

2. **.gitignore configureren**
   ```gitignore
   # Environment variables
   .env
   .env.local
   .env.*.local
   ```

3. **Verschillende credentials per omgeving**
   - Gebruik sandbox credentials voor development
   - Gebruik productie credentials alleen voor productie

4. **Regelmatig roteren**
   - Verander credentials regelmatig
   - Revoke oude credentials wanneer niet meer nodig

5. **Monitoring**
   - Monitor API usage voor verdachte activiteit
   - Alert bij onverwachte API calls

### ❌ NIET DOEN:

1. **Credentials in code committen**
   - ❌ Nooit credentials hardcoden in source code
   - ❌ Nooit credentials in comments plaatsen
   - ❌ Nooit credentials in logs printen

2. **Credentials delen**
   - ❌ Nooit credentials delen via email/Slack/etc.
   - ❌ Nooit credentials in screenshots plaatsen
   - ❌ Nooit credentials in publieke repositories

3. **Productie credentials voor development**
   - ❌ Gebruik nooit productie credentials voor development
   - ❌ Gebruik altijd sandbox voor testen

---

## 🧪 Testen van Configuratie

Test of je configuratie correct is:

```javascript
// test-rabobank-config.js
require('dotenv').config()
const RabobankApiService = require('./services/rabobankApiService')

console.log('Testing Rabobank API configuration...\n')

// Check if credentials are set
const credentials = RabobankApiService.getCredentials()
if (!credentials) {
  console.error('❌ RABOBANK_CLIENT_ID or RABOBANK_CLIENT_SECRET not set')
  process.exit(1)
}

console.log('✅ Credentials found')
console.log(`   Client ID: ${credentials.clientId.substring(0, 10)}...`)
console.log(`   Client Secret: ${credentials.clientSecret.substring(0, 10)}...`)

// Check if API is available
if (RabobankApiService.isAvailable()) {
  console.log('✅ Rabobank API service is available')
} else {
  console.error('❌ Rabobank API service is not available')
  process.exit(1)
}

// Check environment mode
const sandboxMode = process.env.RABOBANK_SANDBOX_MODE === 'true'
console.log(`✅ Environment: ${sandboxMode ? 'SANDBOX' : 'PRODUCTION'}`)

// Check URLs (OAuth = oauth.rabobank.nl, API = api-sandbox / api.rabobank.nl)
console.log(`✅ API Base URL: ${RabobankApiService.getApiBaseUrl()}`)
console.log(`✅ OAuth Authorize: ${RabobankApiService.getOAuthAuthorizeUrl()}`)
console.log(`✅ OAuth Token: ${RabobankApiService.getOAuthTokenUrl()}`)

// Check APP_URL
const appUrl = process.env.APP_URL
if (!appUrl) {
  console.warn('⚠️  APP_URL not set (required for OAuth redirect)')
} else {
  console.log(`✅ APP URL: ${appUrl}`)
  console.log(`✅ Redirect URI: ${appUrl}/auth/rabobank/callback`)
}

console.log('\n✅ All checks passed!')
```

Run de test:
```bash
node test-rabobank-config.js
```

---

## 📝 Voorbeeld .env Bestand

### Development (.env)

```env
# ============================================
# RABOBANK API CONFIGURATION - DEVELOPMENT
# ============================================

# Core Authentication (VERPLICHT)
RABOBANK_CLIENT_ID=021982d37013e06a4b453422ec715f44
RABOBANK_CLIENT_SECRET=87153edc1f8c1a738c3965d364230dcb

# Environment Configuration
RABOBANK_SANDBOX_MODE=true

# Application URL (voor OAuth redirect)
APP_URL=http://localhost:3000

# ============================================
# OPTIONELE CONFIGURATIE
# ============================================

# Token Management
RABOBANK_TOKEN_REFRESH_THRESHOLD=300

# Request Configuration
RABOBANK_REQUEST_TIMEOUT=30000
RABOBANK_MAX_RETRIES=3
```

### Production (.env.production)

```env
# ============================================
# RABOBANK API CONFIGURATION - PRODUCTION
# ============================================

# Core Authentication (VERPLICHT)
RABOBANK_CLIENT_ID=production_client_id_hier
RABOBANK_CLIENT_SECRET=production_client_secret_hier

# Environment Configuration
RABOBANK_SANDBOX_MODE=false

# Application URL (voor OAuth redirect)
APP_URL=https://app.growsocialmedia.nl

# ============================================
# OPTIONELE CONFIGURATIE
# ============================================

# Token Management
RABOBANK_TOKEN_REFRESH_THRESHOLD=300

# Request Configuration
RABOBANK_REQUEST_TIMEOUT=30000
RABOBANK_MAX_RETRIES=3
```

---

**Laatste update**: January 2025  
**Status**: Actief
