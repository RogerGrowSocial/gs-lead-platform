# KVK API Setup Instructies

## Overzicht

De KVK (Kamer van Koophandel) API integratie maakt het mogelijk om bedrijfsgegevens te verifiëren tijdens aanmelding en risicobeoordeling. Deze API geeft toegang tot officiële gegevens uit het Handelsregister.

## Stap 1: KVK API Abonnement Aanvragen

1. Ga naar [KVK Developer Portal](https://developers.kvk.nl/)
2. Maak een account aan of log in
3. Ga naar "API's" of "Abonnementen"
4. Kies voor "KVK API" abonnement
5. Vul het aanvraagformulier in:
   - Bedrijfsgegevens
   - Contactgegevens
   - Gebruiksdoel (selecteer "Bedrijfsverificatie" of "Risicobeoordeling")
6. Accepteer de algemene voorwaarden
7. Voltooi de aanvraag

**Verwerkingstijd**: Meestal binnen 3 werkdagen

## Stap 2: API Key Ontvangen

Na goedkeuring van je aanvraag:

1. Log in op het [KVK Developer Portal](https://developers.kvk.nl/)
2. Ga naar "API Keys" of "Mijn API's"
3. Je ziet je API key (begint meestal met een reeks letters/cijfers)
4. **BELANGRIJK**: Kopieer de API key direct - bewaar deze veilig!

**Let op**: 
- Er is een test API key beschikbaar voor ontwikkeling
- Productie API key wordt na goedkeuring geactiveerd

## Stap 3: API Key Toevoegen aan Project

### Optie A: .env bestand (Aanbevolen voor ontwikkeling)

1. Maak een `.env` bestand aan in de root van je project (als deze nog niet bestaat)
2. Voeg de volgende regels toe:
   ```env
   # KVK API Configuration
   KVK_API_KEY=jouw-api-key-hier
   KVK_API_TEST_MODE=false  # Zet op true voor test omgeving
   ```
3. Sla het bestand op

**⚠️ BELANGRIJK**: 
- Voeg `.env` toe aan je `.gitignore` zodat je API key niet naar GitHub wordt geüpload!
- Deel je API key nooit publiekelijk

### Optie B: Environment Variables (Aanbevolen voor productie)

Voor productieomgevingen, voeg de environment variables toe via:

- **Heroku**: Settings → Config Vars
- **Vercel**: Project Settings → Environment Variables
- **Docker**: `docker-compose.yml` of `.env` file
- **Server**: System environment variables
- **Supabase**: Project Settings → Environment Variables

Voeg toe:
- `KVK_API_KEY=jouw-api-key-hier`
- `KVK_API_TEST_MODE=false` (of `true` voor test omgeving)

## Stap 4: Server Herstarten

Na het toevoegen van de API key, herstart je server:

```bash
npm run dev
# of
npm start
```

## Stap 5: Testen

### Test 1: API Beschikbaarheid Controleren

Test of de KVK API service correct is geconfigureerd:

```javascript
const KvkApiService = require('./services/kvkApiService')

// Check if API is available
if (KvkApiService.isAvailable()) {
  console.log('✅ KVK API is configured')
} else {
  console.log('❌ KVK API key not found')
}
```

### Test 2: Test KVK Nummer Verifiëren

Test met een bekend KVK nummer (gebruik test data in test omgeving):

```javascript
const KvkApiService = require('./services/kvkApiService')

async function testKvkVerification() {
  try {
    // Test met een bekend KVK nummer
    const result = await KvkApiService.verifyKvkNumber('12345678')
    console.log('Verification result:', result)
  } catch (error) {
    console.error('Error:', error.message)
  }
}

testKvkVerification()
```

### Test 3: Bedrijfsprofiel Ophalen

Test het ophalen van bedrijfsgegevens:

```javascript
const KvkApiService = require('./services/kvkApiService')

async function testGetProfile() {
  try {
    const profile = await KvkApiService.getCompanyProfile('12345678')
    if (profile) {
      console.log('Company name:', profile.companyName)
      console.log('Address:', profile.address)
      console.log('Status:', profile.status)
    } else {
      console.log('Company not found')
    }
  } catch (error) {
    console.error('Error:', error.message)
  }
}

testGetProfile()
```

## Kosten

### Abonnementskosten
- **Maandelijks abonnement**: €6,20 per maand
- **Per API call**: Variërende kosten (check actuele prijzen op KVK Developer Portal)
- **Geschat gebruik**: 
  - ~1 call per nieuwe gebruiker (signup verificatie)
  - ~1 call per risicobeoordeling (als KVK nummer aanwezig)
  - Totaal: 50-200 calls per maand (afhankelijk van groei)

### Kostenoptimalisatie
- **Caching**: KVK data wordt 24 uur gecached om dubbele calls te voorkomen
- **Lazy Loading**: Alleen ophalen wanneer nodig (niet bij elke profile update)
- **Batch Processing**: Meerdere requests combineren waar mogelijk

**Meer informatie**: [KVK API Prijzen](https://developers.kvk.nl/pricing)

## Test Omgeving

KVK biedt een test omgeving met fictieve data:

1. **Test API Key**: Gebruik de test API key uit het Developer Portal
2. **Test Mode**: Zet `KVK_API_TEST_MODE=true` in `.env`
3. **Test Data**: Gebruik de test KVK nummers uit de KVK documentatie

**Test Endpoint**: `https://api.kvk.nl/test/api/v2`

**Let op**: Test data is fictief en mag niet gebruikt worden voor echte verificaties

## API Endpoints

### Basisprofiel API (Primair)
```
GET /api/v2/basisprofiel/{kvkNumber}
```
Haalt bedrijfsgegevens op basis van KVK nummer.

**Response bevat**:
- Bedrijfsnaam
- Adres
- Oprichtingsdatum
- Status
- Rechtsvorm
- Hoofdactiviteit
- BTW nummer (indien beschikbaar)

### Zoeken API (Optioneel)
```
GET /api/v2/zoeken?q={companyName}
```
Zoekt bedrijven op basis van naam.

**Gebruik**: Wanneer alleen bedrijfsnaam bekend is, niet KVK nummer.

## Troubleshooting

### "KVK API key is not configured"
- Controleer of `KVK_API_KEY` is ingesteld in `.env` of environment variables
- Controleer of de key correct is gekopieerd (zonder spaties)
- Herstart de server na het toevoegen van de key

### "KVK API: Invalid API key"
- Controleer of de API key correct is
- Controleer of je de juiste key gebruikt (test vs. productie)
- Controleer of je abonnement actief is

### "KVK API: Resource not found"
- Het KVK nummer bestaat niet in de database
- Controleer of het KVK nummer correct is (8 cijfers voor Nederland)
- Test met een bekend KVK nummer

### "KVK API: Rate limit exceeded"
- Je hebt te veel requests gedaan
- Wacht even en probeer opnieuw
- Overweeg caching te implementeren

### "KVK API: Network error"
- Controleer je internetverbinding
- Controleer of de KVK API bereikbaar is
- Controleer firewall instellingen

### API Response Parsing Errors
- De KVK API response structuur kan verschillen
- Check de `rawData` field in de response voor de originele structuur
- Update `parseCompanyProfile` method in `kvkApiService.js` indien nodig

## Fallback Gedrag

Als de KVK API niet beschikbaar is:
- ✅ Signup/onboarding gaat door zonder KVK verificatie
- ✅ Risicobeoordeling gaat door zonder KVK data
- ⚠️ Waarschuwing wordt gelogd voor monitoring
- ❌ Gebruiker wordt NIET geblokkeerd

Dit zorgt ervoor dat het systeem blijft werken, zelfs als de KVK API tijdelijk niet beschikbaar is.

## KVK API Uitschakelen (Tijdelijk)

Als je de KVK API tijdelijk wilt uitschakelen:

1. Verwijder of comment uit de `KVK_API_KEY` regel in je `.env` file
2. Of verwijder de environment variable in productie
3. Herstart de server

Het systeem zal automatisch zonder KVK verificatie werken.

## Monitoring

### API Usage Tracking
- Monitor het aantal API calls
- Track success/failure rates
- Monitor response times
- Alert bij hoge failure rates

### Logging
De KVK API service logt automatisch:
- API requests (URLs)
- Success responses
- Errors en exceptions
- Rate limit warnings

Check je server logs voor KVK API activiteit:
```bash
# Filter KVK API logs
grep "KVK API" logs/combined.log
```

## Beveiliging

### API Key Beveiliging
- ✅ **DOEN**: API key in environment variables
- ✅ **DOEN**: `.env` in `.gitignore`
- ✅ **DOEN**: API key nooit in code committen
- ❌ **NIET DOEN**: API key in frontend code
- ❌ **NIET DOEN**: API key in publieke repositories

### Data Privacy
- KVK data is publiek beschikbaar, maar behandel het zorgvuldig
- Sla alleen benodigde data op
- Volg GDPR richtlijnen
- Geef gebruikers inzicht in welke KVK data wordt opgeslagen

## Documentatie Links

- **KVK Developer Portal**: https://developers.kvk.nl/
- **API Documentatie**: https://developers.kvk.nl/documentation
- **Quickstart Guide**: https://developers.kvk.nl/documentation/quickstart
- **Test Omgeving**: https://developers.kvk.nl/documentation/testing
- **Prijzen**: https://developers.kvk.nl/pricing

## Support

Voor vragen over de KVK API:
- **KVK Support**: Via het Developer Portal
- **Documentatie**: Check de KVK Developer Portal documentatie
- **Technische Vragen**: Contacteer KVK via het Developer Portal

Voor vragen over de integratie in dit project:
- Check de code comments in `services/kvkApiService.js`
- Check `KVK_API_INTEGRATION_PLAN.md` voor implementatie details

---

**Laatste update**: January 2025  
**Status**: Actief

