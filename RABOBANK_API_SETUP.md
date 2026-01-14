# Rabobank API Setup Instructies

## Overzicht

De Rabobank API integratie maakt het mogelijk om bankrekeningen te koppelen via PSD2 (Payment Services Directive 2). Gebruikers kunnen hun Rabobank rekening autoriseren via OAuth 2.0, waarna het platform toegang heeft tot account informatie zoals saldo's en transacties.

## Stap 1: Rabobank Developer Account Aanmaken

1. Ga naar [Rabobank Developer Portal](https://developer.rabobank.nl/)
2. Maak een account aan of log in
3. Registreer je applicatie:
   - Klik op "Register Application" of "Nieuwe Applicatie"
   - Vul applicatiegegevens in:
     - **Application Name**: GrowSocial Lead Platform
     - **Description**: Platform voor lead management en betalingen
     - **Redirect URI**: 
       - Development: `http://localhost:3000/auth/rabobank/callback`
       - Production: `https://app.growsocialmedia.nl/auth/rabobank/callback`
   - Selecteer de gewenste API's:
     - **Account Information Service (AISP)** - Voor het ophalen van rekeninginformatie
     - Optioneel: **Payment Initiation Service (PISP)** - Voor het initiëren van betalingen
4. Accepteer de algemene voorwaarden
5. Voltooi de registratie

**Verwerkingstijd**: Meestal binnen 1-2 werkdagen voor sandbox toegang

## Stap 2: API Credentials Ontvangen

Na goedkeuring van je aanvraag:

1. Log in op het [Rabobank Developer Portal](https://developer.rabobank.nl/)
2. Ga naar "My Applications" of "Mijn Applicaties"
3. Selecteer je applicatie
4. Je ziet je credentials:
   - **Client ID** (Application ID)
   - **Client Secret** (Application Secret)
5. **BELANGRIJK**: Kopieer beide credentials direct - bewaar deze veilig!

**Let op**: 
- Er is een sandbox omgeving beschikbaar voor ontwikkeling
- Productie credentials worden na goedkeuring geactiveerd
- Sandbox en productie hebben verschillende credentials

## Stap 3: API Credentials Toevoegen aan Project

### Optie A: .env bestand (Aanbevolen voor ontwikkeling)

1. Maak een `.env` bestand aan in de root van je project (als deze nog niet bestaat)
2. Voeg de volgende regels toe:
   ```env
   # Rabobank API Configuration
   RABOBANK_CLIENT_ID=021982d37013e06a4b453422ec715f44
   RABOBANK_CLIENT_SECRET=87153edc1f8c1a738c3965d364230dcb
   RABOBANK_SANDBOX_MODE=true  # Zet op false voor productie
   APP_URL=http://localhost:3000  # Of je productie URL
   ```
3. Sla het bestand op

**⚠️ BELANGRIJK**: 
- Voeg `.env` toe aan je `.gitignore` zodat je credentials niet naar GitHub worden geüpload!
- Deel je credentials nooit publiekelijk
- Gebruik verschillende credentials voor development en productie

### Optie B: Environment Variables (Aanbevolen voor productie)

Voor productieomgevingen, voeg de environment variables toe via:

- **Heroku**: Settings → Config Vars
- **Vercel**: Project Settings → Environment Variables
- **Docker**: `docker-compose.yml` of `.env` file
- **Server**: System environment variables
- **Supabase**: Project Settings → Environment Variables

Voeg toe:
- `RABOBANK_CLIENT_ID=jouw-client-id`
- `RABOBANK_CLIENT_SECRET=jouw-client-secret`
- `RABOBANK_SANDBOX_MODE=false` (voor productie)
- `APP_URL=https://app.growsocialmedia.nl`

## Stap 4: Database Migratie Uitvoeren

De database migratie voor de `bank_connections` tabel moet worden uitgevoerd:

```bash
# Via Supabase CLI (aanbevolen)
supabase db push

# Of handmatig via SQL editor in Supabase dashboard
# Voer het SQL bestand uit: supabase/migrations/20250128000000_add_rabobank_bank_connections.sql
```

## Stap 5: Server Herstarten

Na het toevoegen van de credentials, herstart je server:

```bash
npm run dev
# of
npm start
```

## Stap 6: Testen

### Test 1: API Beschikbaarheid Controleren

Test of de Rabobank API service correct is geconfigureerd:

```javascript
const RabobankApiService = require('./services/rabobankApiService')

// Check if API is available
if (RabobankApiService.isAvailable()) {
  console.log('✅ Rabobank API is configured')
} else {
  console.log('❌ Rabobank API credentials not found')
}
```

### Test 2: OAuth Flow Testen

1. Log in op je applicatie
2. Ga naar de dashboard
3. Klik op "Koppel Rabobank Rekening" of navigeer naar `/auth/rabobank/connect`
4. Je wordt doorgestuurd naar Rabobank voor autorisatie
5. Autoriseer de applicatie
6. Je wordt terug gestuurd naar de callback URL
7. Controleer of de rekening is gekoppeld in de database

### Test 3: Account Informatie Ophalen

Test het ophalen van rekeninginformatie:

```javascript
const RabobankApiService = require('./services/rabobankApiService')
const { supabaseAdmin } = require('./config/supabase')

async function testGetAccountInfo() {
  try {
    // Get user's bank connection
    const { data: connection, error } = await supabaseAdmin
      .from('bank_connections')
      .select('*')
      .eq('user_id', 'USER_ID_HIER')
      .eq('provider', 'rabobank')
      .eq('connection_status', 'active')
      .single()

    if (error || !connection) {
      console.log('No active Rabobank connection found')
      return
    }

    // Check if token needs refresh
    let accessToken = connection.access_token
    if (new Date(connection.token_expires_at) < new Date()) {
      console.log('Token expired, refreshing...')
      const tokenData = await RabobankApiService.refreshAccessToken(connection.refresh_token)
      accessToken = tokenData.access_token
      
      // Update connection with new token
      await supabaseAdmin
        .from('bank_connections')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || connection.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        })
        .eq('id', connection.id)
    }

    // Get account information
    const accountInfo = await RabobankApiService.getAccountInformation(accessToken)
    console.log('Account information:', accountInfo)

    // Get account balances
    const balances = await RabobankApiService.getAccountBalances(accessToken)
    console.log('Account balances:', balances)

  } catch (error) {
    console.error('Error:', error.message)
  }
}

testGetAccountInfo()
```

## API Endpoints

### Account Information Service (AISP)

#### GET /psd2/account-information/v3/accounts
Haalt alle gekoppelde rekeningen op.

**Response bevat**:
- Account ID
- IBAN
- Account naam
- Account type
- Currency
- Status

#### GET /psd2/account-information/v3/accounts/{accountId}/balances
Haalt saldo's op voor een specifieke rekening.

**Response bevat**:
- Balance amount
- Balance type (interimBooked, openingBooked, etc.)
- Currency
- Last change date

#### GET /psd2/account-information/v3/accounts/{accountId}/transactions
Haalt transacties op voor een specifieke rekening.

**Query parameters**:
- `dateFrom` - Start datum (ISO 8601)
- `dateTo` - Eind datum (ISO 8601)
- `bookingStatus` - booked, pending, both
- `limit` - Aantal transacties (max 100)

**Response bevat**:
- Transaction ID
- Amount
- Currency
- Booking date
- Value date
- Creditor/Debtor information
- Remittance information

## Kosten

### Sandbox Omgeving
- **Gratis** voor ontwikkeling en testen
- Beperkte functionaliteit
- Test data

### Productie Omgeving
- **Gratis** voor PSD2 API's (Account Information, Payment Initiation)
- Geen maandelijkse kosten
- Rate limits kunnen van toepassing zijn

**Meer informatie**: [Rabobank API Prijzen](https://developer.rabobank.nl/pricing)

## Sandbox vs Productie

### Sandbox Omgeving
- **URL**: `https://api-sandbox.rabobank.nl`
- **OAuth URL**: `https://api-sandbox.rabobank.nl/oauth`
- Gebruik voor ontwikkeling en testen
- Test credentials beschikbaar
- Geen echte bankrekeningen

### Productie Omgeving
- **URL**: `https://api.rabobank.nl`
- **OAuth URL**: `https://api.rabobank.nl/oauth`
- Gebruik voor live applicaties
- Vereist goedkeuring van Rabobank
- Echte bankrekeningen

**Overschakelen tussen sandbox en productie**:
Zet `RABOBANK_SANDBOX_MODE=true` (sandbox) of `RABOBANK_SANDBOX_MODE=false` (productie) in je `.env` bestand.

## Troubleshooting

### "Rabobank API credentials not configured"
- Controleer of `RABOBANK_CLIENT_ID` en `RABOBANK_CLIENT_SECRET` zijn ingesteld in `.env` of environment variables
- Controleer of de credentials correct zijn gekopieerd (zonder spaties)
- Herstart de server na het toevoegen van de credentials

### "Rabobank API: Invalid credentials"
- Controleer of je de juiste credentials gebruikt (sandbox vs productie)
- Controleer of je applicatie is goedgekeurd in het Developer Portal
- Controleer of de redirect URI exact overeenkomt met wat je hebt geregistreerd

### "Rabobank API: Invalid or expired access token"
- Het access token is verlopen (meestal na 1 uur)
- Gebruik `refreshAccessToken()` om een nieuw token te krijgen
- Controleer of de refresh token nog geldig is

### "Rabobank API: Insufficient permissions"
- Controleer of je de juiste scopes hebt aangevraagd tijdens autorisatie
- Controleer of je applicatie toegang heeft tot de benodigde API's in het Developer Portal

### "OAuth state mismatch"
- Dit kan duiden op een CSRF aanval of sessie probleem
- Zorg ervoor dat sessies correct zijn geconfigureerd
- Controleer of cookies worden ondersteund

### "Database error storing connection"
- Controleer of de migratie is uitgevoerd
- Controleer of de `bank_connections` tabel bestaat
- Controleer database connectie en permissions

## Beveiliging

### Token Beveiliging
- ✅ **DOEN**: Access tokens en refresh tokens opslaan in database
- ✅ **DOEN**: Tokens versleutelen in productie (gebruik encryption at rest)
- ✅ **DOEN**: Tokens automatisch verversen voordat ze verlopen
- ❌ **NIET DOEN**: Tokens in logs of frontend code
- ❌ **NIET DOEN**: Tokens delen tussen gebruikers

### OAuth Beveiliging
- ✅ **DOEN**: State parameter gebruiken voor CSRF bescherming
- ✅ **DOEN**: Redirect URI exact matchen
- ✅ **DOEN**: HTTPS gebruiken in productie
- ❌ **NIET DOEN**: State parameter overslaan
- ❌ **NIET DOEN**: Redirect URI's accepteren van externe bronnen

### Data Privacy
- Volg GDPR richtlijnen
- Sla alleen benodigde data op
- Geef gebruikers inzicht in welke data wordt opgeslagen
- Implementeer data retention policies
- Laat gebruikers hun verbinding op elk moment verbreken

## Monitoring

### API Usage Tracking
- Monitor het aantal API calls
- Track success/failure rates
- Monitor response times
- Alert bij hoge failure rates

### Logging
De Rabobank API service logt automatisch:
- OAuth authorization requests
- Token exchanges
- API requests (URLs)
- Success responses
- Errors en exceptions
- Rate limit warnings

Check je server logs voor Rabobank API activiteit:
```bash
# Filter Rabobank API logs
grep "Rabobank" logs/combined.log
```

## Documentatie Links

- **Rabobank Developer Portal**: https://developer.rabobank.nl/
- **API Documentatie**: https://developer.rabobank.nl/api-documentation
- **OAuth 2.0 Guide**: https://developer.rabobank.nl/api-documentation/oauth2-services
- **PSD2 API's**: https://developer.rabobank.nl/api-documentation/psd2-apis
- **Sandbox Guide**: https://developer.rabobank.nl/sandbox

## Support

Voor vragen over de Rabobank API:
- **Rabobank Support**: Via het Developer Portal
- **Documentatie**: Check de Rabobank Developer Portal documentatie
- **Technische Vragen**: Contacteer Rabobank via het Developer Portal

Voor vragen over de integratie in dit project:
- Check de code comments in `services/rabobankApiService.js`
- Check de routes in `routes/auth.js`
- Check deze setup guide

---

**Laatste update**: January 2025  
**Status**: Actief
