# Rabobank API - Quick Start Guide

## 🚀 Snelle Setup voor GrowSocial

### Stap 1: Rabobank Developer Portal

1. **OAuth Redirection URI's toevoegen:**
   - Ga naar je applicatie in het [Rabobank Developer Portal](https://developer.rabobank.nl/)
   - Voeg toe in "OAuth redirection URI":
     - Development: `http://localhost:3000/auth/rabobank/callback`
     - Production: `https://app.growsocialmedia.nl/auth/rabobank/callback`

2. **Client Secret ophalen:**
   - Ga naar "Credentials"
   - Kopieer je Client Secret
   - Je hebt al: Client ID = `021982d37013e06a4b453422ec715f44`

### Stap 2: Environment Variables

Voeg toe aan je `.env` bestand:

```env
# Rabobank API - Development
RABOBANK_CLIENT_ID=021982d37013e06a4b453422ec715f44
RABOBANK_CLIENT_SECRET=je-client-secret-hier
RABOBANK_SANDBOX_MODE=true
APP_URL=http://localhost:3000
```

**Voor productie** (later toevoegen aan je hosting platform):
```env
RABOBANK_CLIENT_ID=production_client_id
RABOBANK_CLIENT_SECRET=production_client_secret
RABOBANK_SANDBOX_MODE=false
APP_URL=https://app.growsocialmedia.nl
```

### Stap 3: Database Migratie

```bash
supabase db push
```

### Stap 4: Testen

1. Start je server: `npm run dev`
2. Log in op je applicatie
3. Ga naar: `http://localhost:3000/auth/rabobank/connect`
4. Autoriseer je Rabobank rekening
5. Je wordt terug gestuurd en de rekening is gekoppeld!

---

## 📋 Redirect URI's voor Rabobank Portal

**Voeg deze exact toe in het Rabobank Developer Portal:**

- ✅ `http://localhost:3000/auth/rabobank/callback` (Development)
- ✅ `https://app.growsocialmedia.nl/auth/rabobank/callback` (Production)

**BELANGRIJK**: De URI's moeten exact overeenkomen, inclusief:
- Protocol (http vs https)
- Domein
- Poort (voor localhost)
- Pad (`/auth/rabobank/callback`)

---

## 🔗 Handige Links

- **Rabobank Developer Portal**: https://developer.rabobank.nl/
- **API Documentatie**: https://developer.rabobank.nl/api-documentation
- **OAuth 2.0 Guide**: https://developer.rabobank.nl/api-documentation/oauth2-services

---

**Domein**: `app.growsocialmedia.nl`  
**Laatste update**: January 2025
