# Google Places API Setup

## Overzicht

De Google Places API wordt gebruikt om **exacte Google Reviews en ratings** op te halen voor bedrijven. Dit is veel accurater dan algemene Google Search omdat het direct toegang geeft tot Google Business profielen.

## Voordelen

- ✅ **Exacte reviews**: Direct van Google Business profiel
- ✅ **Accurate ratings**: Exacte rating (bijv. 4.9, niet afgerond naar 5.0)
- ✅ **Exact aantal reviews**: Direct van Google, geen schattingen
- ✅ **Betere matching**: Zoekt op bedrijfsnaam + adres voor exacte match
- ✅ **Officiële data**: Direct van Google, geen scraping

## Setup Stappen

### 1. Google Cloud Console

1. Ga naar [Google Cloud Console](https://console.cloud.google.com/)
2. Maak een nieuw project aan of selecteer een bestaand project
3. Zorg dat billing is ingeschakeld (Google Places API is betaald)

### 2. Activeer Google Places API

1. Ga naar **API's en services** > **Bibliotheek**
2. Zoek naar **"Places API"**
3. Klik op **Places API** en klik **Activeren**

### 3. Maak API Key

1. Ga naar **API's en services** > **Referenties**
2. Klik op **Referentie maken** > **API-sleutel**
3. Kopieer de API key
4. **BELANGRIJK**: Beperk de API key:
   - Klik op de API key om te bewerken
   - Bij **API-beperkingen**: Selecteer alleen **Places API**
   - Bij **Toepassingsbeperkingen**: Stel IP-beperkingen in (optioneel, voor extra beveiliging)

### 4. Voeg API Key toe aan .env

Voeg de volgende regel toe aan je `.env` bestand:

```env
GOOGLE_PLACES_API_KEY=your_api_key_here
```

### 5. Herstart de server

Na het toevoegen van de API key, herstart de server:

```bash
npm run dev
```

## Kosten

Google Places API heeft de volgende kosten (per 1000 requests):

- **Text Search**: $32 per 1000 requests
- **Place Details**: $17 per 1000 requests

**Totaal per risk assessment**: ~$0.049 (Text Search + Place Details)

**Maandelijkse kosten schatting**:
- 100 assessments/maand: ~$4.90
- 1000 assessments/maand: ~$49
- 10000 assessments/maand: ~$490

**Tip**: Google geeft $200 gratis credits per maand voor nieuwe accounts!

## Testen

Test de Google Places API met:

```bash
node scripts/test-google-places.js "GrowSocial" "Amsterdam"
```

## Hoe het werkt

1. **Text Search**: Zoekt bedrijf op naam + adres
2. **Best Match**: Vindt het beste match op basis van:
   - Naam matching (exact > partial)
   - Adres matching (als KVK adres beschikbaar)
   - Rating (hogere rating = betere match)
   - Aantal reviews (meer reviews = betere match)
3. **Place Details**: Haalt volledige details op inclusief:
   - Exacte rating (bijv. 4.9)
   - Exact aantal reviews
   - Reviews (indien beschikbaar)
   - Website
   - Telefoonnummer

## Fallback

Als Google Places API niet beschikbaar is of geen resultaten vindt, valt het systeem terug op:
- Algemene internet search (Tavily/Google Custom Search)
- Dit is minder accuraat maar geeft nog steeds bruikbare informatie

## Troubleshooting

### "API key not found"
- Check of `GOOGLE_PLACES_API_KEY` in `.env` staat
- Herstart de server na het toevoegen

### "ZERO_RESULTS"
- Het bedrijf heeft mogelijk geen Google Business profiel
- Probeer met KVK adres (wordt automatisch gedaan)
- Check of de bedrijfsnaam correct is gespeld

### "REQUEST_DENIED"
- API key is niet correct
- Places API is niet geactiveerd
- API key heeft geen toegang tot Places API (check API-beperkingen)

### "OVER_QUERY_LIMIT"
- Je hebt je quota bereikt
- Check je billing in Google Cloud Console
- Upgrade je quota indien nodig

## Security

- ✅ API key is beperkt tot alleen Places API
- ✅ IP-beperkingen kunnen worden ingesteld (optioneel)
- ✅ API key staat in `.env` (niet in git)

## Monitoring

Check je Google Cloud Console regelmatig voor:
- API usage
- Kosten
- Errors

