# SOP 05.3 – Rabobank API koppelen

**Doel:** De Rabobank API (OAuth) configureren zodat gebruikers hun Rabobank-rekening kunnen koppelen (bijv. voor betalingen of verificatie).

**Doelgroep:** Developers / systeembeheer.

---

## Stap 1: Rabobank Developer Portal

1. Ga naar [Rabobank Developer Portal](https://developer.rabobank.nl/).
2. **OAuth redirection URI’s** toevoegen voor je applicatie:
   - Development: `http://localhost:3000/auth/rabobank/callback`
   - Productie: `https://app.growsocialmedia.nl/auth/rabobank/callback`
3. **Credentials:** kopieer het Client Secret (Client ID heb je al, bijv. `021982d37013e06a4b453422ec715f44`).

---

## Stap 2: Environment variables

Voeg in `.env` toe:

```env
# Development
RABOBANK_CLIENT_ID=021982d37013e06a4b453422ec715f44
RABOBANK_CLIENT_SECRET=<jouw-client-secret>
RABOBANK_SANDBOX_MODE=true
APP_URL=http://localhost:3000
```

Voor productie (op hosting):

```env
RABOBANK_CLIENT_ID=<production-client-id>
RABOBANK_CLIENT_SECRET=<production-client-secret>
RABOBANK_SANDBOX_MODE=false
APP_URL=https://app.growsocialmedia.nl
```

---

## Stap 3: Database

- Voer de benodigde migraties uit (Rabobank-koppeling, tokens, enz.): `supabase db push` of SQL Editor.

---

## Stap 4: Testen

1. Start de app: `npm run dev`.
2. Log in.
3. Ga naar `http://localhost:3000/auth/rabobank/connect`.
4. Autoriseer de Rabobank-rekening in de Rabobank-flow.
5. Na callback wordt de rekening gekoppeld; controleer in de app of in de database.

---

## Redirect URI’s

- De URI’s in het Rabobank-portal moeten **exact** overeenkomen (protocol, domein, poort, pad).
- Geen trailing slash tenzij de app die verwacht.

---

**Gerelateerd:** `RABOBANK_QUICK_START.md`, [SOP 05.2 – Betalingen en facturatie](05-2-betalingen-facturatie-admin.md)
