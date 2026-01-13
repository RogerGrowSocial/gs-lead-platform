# Tavily AI Search API Setup

Tavily is een AI-powered search API specifiek ontworpen voor AI agents. Het combineert web search met AI-samenvatting in één snelle API call.

## Waarom Tavily?

- ⚡ **Sneller**: 1 API call in plaats van meerdere Google Search queries + AI samenvatting
- 🤖 **AI-powered**: Automatische samenvatting van search results
- 💰 **Goedkoper**: ~$0.10 per 1000 searches (vs $5 voor Google Custom Search)
- 🎯 **Betere resultaten**: Specifiek ontworpen voor AI agents

## Setup Stappen

### 1. Maak een Tavily Account

1. Ga naar [https://tavily.com](https://tavily.com)
2. Klik op "Sign Up" of "Get Started"
3. Maak een account (gratis tier beschikbaar)

### 2. Vind je API Key

1. Log in op je Tavily account
2. Ga naar je **Dashboard** of **API Keys** sectie
3. Kopieer je **API Key** (ziet eruit als: `tvly-xxxxxxxxxxxxx`)

### 3. Voeg API Key toe aan .env

Voeg de volgende regel toe aan je `.env` bestand:

```env
TAVILY_API_KEY=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
```

**Vervang `tvly-xxxxxxxxxxxxx` met je eigen API key!**

### 4. Herstart je applicatie

Na het toevoegen van de API key, herstart je Node.js applicatie:

```bash
# Stop de huidige applicatie (Ctrl+C)
# Start opnieuw
npm start
# of
node server.js
```

## Hoe het werkt

Het systeem gebruikt nu Tavily als **eerste optie** voor search:

1. **Tavily Search** (als `TAVILY_API_KEY` is ingesteld)
   - Snelle AI-powered search
   - Automatische samenvatting
   - ~2-5 seconden

2. **Google Custom Search** (fallback als Tavily niet beschikbaar is)
   - Langzamer maar meer gedetailleerd
   - ~8-12 seconden

3. **OpenAI Knowledge Base** (laatste redmiddel)
   - Alleen training data (mogelijk verouderd)
   - Geen real-time search

## Testen

Test of Tavily werkt door een risk assessment uit te voeren:

1. Ga naar de admin users pagina
2. Klik op "Risicoanalyse Uitvoeren" voor een gebruiker
3. Check de console logs - je zou moeten zien:
   ```
   Using Tavily AI Search for faster results...
   Tavily search completed successfully (XXX chars)
   ```

## Kosten

- **Free Tier**: 1000 searches/maand gratis
- **Paid**: $0.10 per 1000 searches daarna
- Veel goedkoper dan Google Custom Search ($5 per 1000 searches)

## Troubleshooting

### "Tavily search failed"
- Check of je API key correct is in `.env`
- Check of je account actief is op tavily.com
- Check je internet connectie

### "Tavily API error: 401"
- Je API key is ongeldig of verlopen
- Genereer een nieuwe API key op tavily.com

### "Tavily API error: 429"
- Je hebt je rate limit bereikt
- Wacht even of upgrade je plan

## Meer informatie

- [Tavily Documentation](https://docs.tavily.com)
- [Tavily Pricing](https://tavily.com/pricing)
- [Tavily API Reference](https://docs.tavily.com/api-reference)

