# OpenAI Setup Instructies

## Stap 1: OpenAI API Key verkrijgen

1. Ga naar [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Log in met je OpenAI account (of maak er een aan)
3. Klik op "Create new secret key"
4. Geef de key een naam (bijv. "GrowSocial Mail AI")
5. **BELANGRIJK**: Kopieer de API key direct - je kunt hem maar één keer zien!

## Stap 2: API Key toevoegen aan je project

### Optie A: .env bestand (Aanbevolen)

1. Maak een `.env` bestand aan in de root van je project (als deze nog niet bestaat)
2. Voeg de volgende regel toe:
   ```
   OPENAI_API_KEY=sk-...jouw-api-key-hier...
   ```
3. Sla het bestand op

**⚠️ BELANGRIJK**: Voeg `.env` toe aan je `.gitignore` zodat je API key niet naar GitHub wordt geüpload!

### Optie B: Environment variable in productie

Als je in productie draait (bijv. op een server), voeg de environment variable toe via:
- Je hosting provider (Heroku, Vercel, etc.)
- Server environment variables
- Docker compose
- Of je deployment configuratie

## Stap 3: Server herstarten

Na het toevoegen van de API key, herstart je server:
```bash
npm run dev
# of
npm start
```

## Stap 4: Testen

1. Ga naar `/admin/mail`
2. Synchroniseer een mailbox (als je dat nog niet hebt gedaan)
3. Open een mail
4. Klik op "AI-antwoord"
5. Je zou nu een echt AI gegenereerd antwoord moeten zien in plaats van een template!

## Kosten

- We gebruiken `gpt-4o-mini` voor kosten efficiëntie
- Ongeveer **$0.15 per 1M input tokens** en **$0.60 per 1M output tokens**
- Voor een gemiddelde e-mail label + reply: ongeveer **$0.001 - $0.01 per mail**
- Zie [OpenAI Pricing](https://openai.com/api/pricing/) voor actuele prijzen

## Troubleshooting

### "OpenAI API error: Invalid API key"
- Controleer of je API key correct is gekopieerd (zonder spaties)
- Controleer of de `.env` file in de root staat
- Herstart de server na het toevoegen van de key

### Fallback naar keyword-based labeling
- Als OpenAI niet beschikbaar is, valt het systeem automatisch terug naar keyword-based labeling
- Dit gebeurt automatisch zonder foutmeldingen aan de gebruiker

### AI antwoorden genereren nog steeds templates
- Controleer of `OPENAI_API_KEY` is ingesteld: `console.log(process.env.OPENAI_API_KEY)`
- Check de server logs voor OpenAI errors
- Als custom_instructions zijn ingesteld, gebruikt het systeem die in plaats van AI

## Disable OpenAI (tijdelijk)

Als je OpenAI tijdelijk wilt uitschakelen, verwijder of comment uit de `OPENAI_API_KEY` regel in je `.env` file.

