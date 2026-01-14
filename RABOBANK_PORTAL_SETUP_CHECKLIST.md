# Rabobank Developer Portal - Setup Checklist

## ✅ Wat je al hebt:
- ✅ Client ID: `021982d37013e06a4b453422ec715f44`
- ✅ Applicatie geregistreerd: "GrowSocial"
- ✅ Sandbox omgeving beschikbaar

## ⚠️ Wat je nog moet doen:

### 1. **OAuth Redirection URI Toevoegen** (VERPLICHT)

Dit is **kritisch** - zonder deze URI werkt de OAuth flow niet!

**Stappen:**
1. Ga naar de "Configuration" of "Credentials" sectie in het Rabobank Developer Portal
2. Zoek naar "OAuth redirection URI" of "Redirect URI"
3. Voeg de volgende URI's toe:

   **Voor Development (Sandbox):**
   ```
   http://localhost:3000/auth/rabobank/callback
   ```

   **Voor Production (later toevoegen):**
   ```
   https://app.growsocialmedia.nl/auth/rabobank/callback
   ```

4. **BELANGRIJK**: De URI moet **exact** overeenkomen met wat je in je code gebruikt
5. Sla de wijzigingen op

**Waarom dit belangrijk is:**
- Rabobank controleert of de redirect URI exact overeenkomt
- Als de URI niet overeenkomt, krijg je een "redirect_uri_mismatch" error
- Je kunt meerdere URI's toevoegen voor verschillende omgevingen

---

### 2. **Client Secret Ophalen** (VERPLICHT)

Je hebt de Client ID, maar je hebt ook de **Client Secret** nodig!

**Stappen:**
1. Ga naar de "Credentials" sectie
2. Zoek naar "Client Secret" of "Application Secret"
3. Klik op "Show" of "Reveal" om het secret te zien
4. **BELANGRIJK**: Kopieer het secret direct - je ziet het mogelijk maar één keer!
5. Voeg het toe aan je `.env` bestand als `RABOBANK_CLIENT_SECRET`

**Als je het secret niet kunt vinden:**
- Sommige portals tonen het secret alleen bij de eerste keer
- Als je het secret kwijt bent, moet je mogelijk een nieuw secret genereren
- Kijk naar een "Generate new secret" of "Reset secret" knop

---

### 3. **Certificate (Mutual TLS)** (OPTIONEEL - voor productie)

Voor de **sandbox** omgeving is een certificate meestal **niet vereist**.

Voor **productie** kan Rabobank mutual TLS (mTLS) vereisen voor extra beveiliging.

**Wanneer is dit nodig?**
- ✅ Sandbox: Meestal **niet nodig**
- ⚠️ Productie: Kan vereist zijn, afhankelijk van Rabobank's eisen

**Als je een certificate nodig hebt:**
1. Genereer een X.509 certificate (zelfondertekend of via CA)
2. Upload het certificate in het Developer Portal
3. Download het public key certificate van Rabobank (als vereist)
4. Configureer mutual TLS in je applicatie

**Voor nu (sandbox):**
- Je kunt dit overslaan en later toevoegen wanneer je naar productie gaat

---

### 4. **API Subscriptions Controleren** (VERPLICHT)

Zorg ervoor dat je de juiste API's hebt geabonneerd:

**Benodigde API's:**
- ✅ **Account Information Service (AISP)** - Voor rekeninginformatie
- ⚠️ **Payment Initiation Service (PISP)** - Alleen nodig als je betalingen wilt initiëren

**Stappen:**
1. Ga naar "Subscriptions" of "API's" in het Developer Portal
2. Controleer of "Account Information Service" is geabonneerd
3. Als niet, abonneer je op de API

---

## 📋 Complete Checklist

Gebruik deze checklist om te controleren of alles is ingesteld:

### In Rabobank Developer Portal:
- [ ] **OAuth Redirection URI toegevoegd**
  - [ ] Development: `http://localhost:3000/auth/rabobank/callback`
  - [ ] Production: `https://app.growsocialmedia.nl/auth/rabobank/callback` (later)
- [ ] **Client Secret opgehaald en opgeslagen**
- [ ] **Account Information Service (AISP) geabonneerd**
- [ ] **Certificate geüpload** (alleen voor productie, indien vereist)

### In je Project:
- [ ] **Environment variables ingesteld in `.env`:**
  ```env
  RABOBANK_CLIENT_ID=021982d37013e06a4b453422ec715f44
  RABOBANK_CLIENT_SECRET=je-client-secret-hier
  RABOBANK_SANDBOX_MODE=true
  APP_URL=http://localhost:3000
  ```
- [ ] **Database migratie uitgevoerd:**
  ```bash
  supabase db push
  ```
- [ ] **Server herstart** na het toevoegen van environment variables

---

## 🧪 Testen

Na het voltooien van de setup, test de integratie:

1. **Start je server:**
   ```bash
   npm run dev
   ```

2. **Test de OAuth flow:**
   - Log in op je applicatie
   - Ga naar: `http://localhost:3000/auth/rabobank/connect`
   - Je zou moeten worden doorgestuurd naar Rabobank voor autorisatie
   - Na autorisatie word je terug gestuurd naar je callback URL

3. **Controleer de database:**
   - Check of er een record is toegevoegd in de `bank_connections` tabel
   - Controleer of de tokens zijn opgeslagen

---

## ❌ Veelvoorkomende Problemen

### "redirect_uri_mismatch"
- **Oorzaak**: De redirect URI in je code komt niet overeen met wat je in het Developer Portal hebt ingesteld
- **Oplossing**: Controleer of de URI exact hetzelfde is (inclusief http/https, poort, pad)

### "invalid_client"
- **Oorzaak**: Client ID of Client Secret is onjuist
- **Oplossing**: Controleer of de credentials correct zijn gekopieerd in je `.env` bestand

### "invalid_grant"
- **Oorzaak**: Authorization code is verlopen of al gebruikt
- **Oplossing**: Start de OAuth flow opnieuw

### "insufficient_scope"
- **Oorzaak**: Je hebt niet de juiste API geabonneerd
- **Oplossing**: Abonneer je op "Account Information Service (AISP)" in het Developer Portal

---

## 📞 Hulp Nodig?

Als je vastloopt:
1. Check de Rabobank API documentatie: https://developer.rabobank.nl/api-documentation
2. Check de OAuth 2.0 documentatie: https://developer.rabobank.nl/api-documentation/oauth2-services
3. Neem contact op met Rabobank support via het Developer Portal

---

**Laatste update**: January 2025
