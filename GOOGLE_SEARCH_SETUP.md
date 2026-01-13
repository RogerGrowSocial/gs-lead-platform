# Google Custom Search API Setup

Deze setup maakt het mogelijk om echte Google zoekresultaten (inclusief websites en Google Reviews) te gebruiken voor risk assessments.

## Stap 1: Google Custom Search Engine aanmaken

1. Ga naar [Google Custom Search](https://programmablesearchengine.google.com/) of [CSE Control Panel](https://cse.google.com/cse/)
2. Log in met je Google account
3. Klik op **"Add"** of **"Create a custom search engine"** om een nieuwe search engine te maken
4. Vul in:
   - **Sites to search**: `*` (zoek over het hele internet - typ letterlijk een asterisk)
   - **Name**: Bijv. "GrowSocial Risk Assessment Search"
5. Klik op **"Create"**

## Stap 1b: Search Engine ID (CX) vinden

**Waar vind je je Search Engine ID?**

Na het aanmaken van je search engine:

1. Je ziet een overzicht van je search engines
2. Klik op de naam van je search engine (of klik op **"Control Panel"**)
3. In het linker menu, klik op **"Setup"** of **"Instellen"**
4. Klik op **"Basics"** of **"Basisinstellingen"**
5. Scroll naar beneden naar **"Search engine ID"** of **"Zoekmachine-ID"**
6. Je ziet een code die eruit ziet als: `012345678901234567890:abcdefghijk`
7. **Kopieer deze volledige code** - dit is je `GOOGLE_CUSTOM_SEARCH_ENGINE_ID`

**Alternatieve manier:**
- In het Control Panel, klik op je search engine
- De Search Engine ID staat vaak direct zichtbaar onder de naam van je engine
- Of in de URL: `https://cse.google.com/cse/setup/basic?cx=JE_ID_HIER`

## Stap 2: Google Cloud API Key aanmaken

1. Ga naar [Google Cloud Console](https://console.cloud.google.com/)
2. Maak een nieuw project aan (of gebruik een bestaand project)
3. Ga naar "APIs & Services" → "Library"
4. Zoek naar "Custom Search API"
5. Klik op "Enable"
6. Ga naar "APIs & Services" → "Credentials"
7. Klik op "Create Credentials" → "API Key"
8. Kopieer je **API Key** - je hebt dit nodig!

## Stap 3: API Key beperken (optioneel, aanbevolen)

1. Klik op je API Key om deze te bewerken
2. Onder "API restrictions":
   - Selecteer "Restrict key"
   - Kies alleen "Custom Search API"
3. Klik op "Save"

## Stap 4: Toevoegen aan .env

Voeg deze regels toe aan je `.env` bestand:

```env
GOOGLE_CUSTOM_SEARCH_API_KEY=je-api-key-hier
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=je-search-engine-id-hier
```

## Stap 5: Testen

Herstart je server en voer een risk assessment uit:

```bash
node test-risk-assessment.js mokum-schilderwerken
```

Je zou nu echte Google zoekresultaten moeten zien, inclusief websites en Google Reviews!

## Kosten

- **Gratis tier**: 100 queries per dag
- **Betaald**: $5 per 1000 queries na de gratis tier
- Voor risk assessments: meestal 1-2 queries per assessment

## Fallback

Als de Google Custom Search API niet is geconfigureerd, valt het systeem automatisch terug naar OpenAI (zoals voorheen).

## Troubleshooting

### "Google Search API error: 403"
- Check of de Custom Search API is ingeschakeld in Google Cloud Console
- Check of je API key correct is
- Check of je API key niet is beperkt tot andere APIs

### "No search results found"
- Check of je Search Engine ID correct is
- Probeer handmatig te zoeken op [Google Custom Search](https://cse.google.com/) om te zien of je engine werkt

### "Quota exceeded"
- Je hebt je dagelijkse limiet van 100 gratis queries bereikt
- Wacht tot morgen, of upgrade naar betaald plan

