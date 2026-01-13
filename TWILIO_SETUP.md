# Twilio WhatsApp Setup - Snelle Gids

## ✅ Wat is er geïmplementeerd:

- ✅ Twilio WhatsApp service (`services/whatsappService.js`)
- ✅ Geïntegreerd in NotificationService
- ✅ Automatisch versturen bij lead assignment
- ✅ Telefoonnummer validatie en formatting
- ✅ Geen template goedkeuring nodig (in tegenstelling tot Meta)

---

## 🚀 Setup Stappen (30-60 minuten)

### STAP 1: Twilio Account Aanmaken (10 minuten)

1. **Ga naar:** https://www.twilio.com/try-twilio
2. **Maak account aan** met je email
3. **Verifieer je email** en telefoonnummer
4. **Kies:** "Build something" → "Send & receive messages" → "WhatsApp"

### STAP 2: Twilio WhatsApp Toegang Vragen (5 minuten)

1. **In Twilio Console:** Ga naar Messaging > Try it out > Send a WhatsApp message
2. **Klik:** "Get a WhatsApp sender"
3. **Vul formulier in:**
   - Use case: "Business notifications"
   - Describe your use case: "Sending transactional notifications to customers when they receive new lead requests"
   - Expected monthly volume: Schat je volume
4. **Submit** - Meestal binnen 24 uur goedgekeurd

### STAP 3: Twilio Credentials Ophalen (2 minuten)

1. **In Twilio Console:** Ga naar Dashboard
2. **Kopieer:**
   - **Account SID** (begint met `AC...`)
   - **Auth Token** (klik op "show" om te zien)

### STAP 4: WhatsApp Sandbox (Voor Testing)

**Optioneel:** Voor direct testen zonder wachten op goedkeuring:

1. **Ga naar:** Messaging > Try it out > Send a WhatsApp message
2. **Join WhatsApp Sandbox:**
   - Stuur "join [code]" naar het Twilio WhatsApp nummer
   - Je kunt dan direct testen (beperkt tot je eigen nummer)

### STAP 5: Environment Variables Toevoegen

Voeg toe aan je `.env` bestand:

```bash
# Twilio WhatsApp Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
# Voor sandbox: gebruik whatsapp:+14155238886
# Voor production: gebruik je eigen goedgekeurde nummer (na goedkeuring)
```

**Na goedkeuring van je WhatsApp nummer:**
- Update `TWILIO_WHATSAPP_FROM` naar je eigen nummer
- Formaat: `whatsapp:+31612345678`

### STAP 6: Server Herstarten

```bash
npm run dev
# of
node server.js
```

---

## 💰 Kosten

**Pricing:**
- **Per bericht:** ~€0.05-0.10
- **Test account:** Gratis credits (~€15-20 test credits)
- **Geen maandelijkse kosten** (pay-as-you-go)

**Voorbeelden:**
- 100 leads/maand = ~€5-10/maand
- 500 leads/maand = ~€25-50/maand
- 2000 leads/maand = ~€100-200/maand

---

## ✅ Checklist

- [ ] Twilio account aangemaakt
- [ ] WhatsApp toegang aangevraagd
- [ ] Account SID gekopieerd
- [ ] Auth Token gekopieerd
- [ ] WhatsApp Sandbox gejoined (voor testen)
- [ ] Environment variables toegevoegd aan `.env`
- [ ] Server herstart
- [ ] Test lead assignment uitgevoerd
- [ ] WhatsApp bericht ontvangen ✅

---

## 🧪 Testen

### Test met Sandbox (Direct):

1. **Join sandbox:** Stuur "join [code]" naar WhatsApp nummer dat Twilio geeft
2. **Test via code:**
   ```javascript
   const WhatsAppService = require('./services/whatsappService');
   const whatsappService = new WhatsAppService();
   
   await whatsappService.sendTestMessage('+31612345678', 'Test bericht');
   ```

### Test met Production (Na goedkeuring):

- Wacht op goedkeuring van je WhatsApp nummer (meestal binnen 24 uur)
- Update `TWILIO_WHATSAPP_FROM` in `.env`
- Test met een echte lead assignment

---

## 🔄 Van Meta naar Twilio

Als je later terug wilt naar Meta (voor kostenbesparing):

1. De code ondersteunt beide services
2. Verwijder Twilio configuratie uit `.env`
3. Voeg Meta configuratie toe
4. Herstart server

---

## 📚 Handige Links

- **Twilio Console:** https://console.twilio.com
- **WhatsApp Setup:** https://www.twilio.com/docs/whatsapp/quickstart
- **Pricing:** https://www.twilio.com/pricing/whatsapp
- **Documentation:** https://www.twilio.com/docs/whatsapp/api

---

## 🎯 Voordelen van Twilio vs Meta

**Twilio:**
- ✅ Sneller setup (30-60 min vs 1-2 dagen)
- ✅ Geen template goedkeuring nodig
- ✅ Makkelijker te gebruiken
- ✅ Goede Node.js SDK
- ❌ Hogere kosten

**Meta:**
- ✅ Gratis eerste 1000/maand
- ✅ Laagste kosten op lange termijn
- ❌ Langere setup tijd
- ❌ Template goedkeuring nodig (1-2 dagen)
- ❌ Rate limits tijdens setup

---

**Laatste update:** 2025-11-04

