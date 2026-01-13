# Twilio WhatsApp Production Setup - Volgende Stappen

## ✅ Wat is klaar:

- ✅ WhatsApp Sender aangemaakt: `+3197010289758`
- ✅ Business Display Name: GrowSocial Platform
- ✅ Gekoppeld met Facebook
- ✅ Code geïmplementeerd
- ✅ WhatsApp From nummer geüpdatet in `.env`

## 📋 Wat je nu moet doen:

### STAP 1: Auth Token toevoegen (als nog niet gedaan)

Zorg dat je Auth Token in `.env` staat:
```bash
TWILIO_AUTH_TOKEN=je_auth_token_hier
```

### STAP 2: Content Template Aanmaken (BELANGRIJK!)

Voor business-initiated messages (eerste bericht zonder eerdere reactie) moet je een Content Template aanmaken:

1. **Ga naar:** Messaging > Content Template Builder in Twilio Console
2. **Klik:** "Create new template"
3. **Vul in:**
   - **Content Type:** `twilio/text` (Text)
   - **Category:** Transactional
   - **Language:** Dutch (nl)
   - **Template name:** `new_lead_notification`
   - **Template content:**
     ```
     Je hebt een nieuwe aanvraag ontvangen!
     
     Bedrijf: {{company_name}}
     Naam: {{contact_name}}
     E-mail: {{email}}
     
     Bekijk de details: {{dashboard_url}}
     
     Met vriendelijke groet,
     GrowSocial Team
     ```
   - **Variables:** (named variables, niet nummers!)
     - `{{company_name}}` = Bedrijfsnaam
     - `{{contact_name}}` = Contact naam
     - `{{email}}` = Email adres
     - `{{dashboard_url}}` = Dashboard URL met lead link
4. **Submit** voor goedkeuring (meestal binnen 24 uur)

**Na goedkeuring:**
- Noteer de Content SID (begint met `HX...`)
- Voeg toe aan `.env`: `TWILIO_CONTENT_SID=HX...`

### STAP 3: Business Profile Invullen (Optioneel maar Aanbevolen)

In je WhatsApp Sender settings:
- ✅ Business display name: GrowSocial Platform (al ingevuld)
- ⏳ Profile photo: Upload een logo (640x640px)
- ⏳ Business address: Je adres
- ⏳ Business website: https://www.growsocialmedia.nl
- ⏳ Business email: info@growsocialmedia.nl
- ⏳ Business description: Korte beschrijving van je bedrijf

**Waarom:** Verhoogt vertrouwen en engagement bij gebruikers.

### STAP 4: Webhooks Configureren (Optioneel)

Voor nu niet nodig, maar later handig voor:
- Inkomende berichten ontvangen
- Delivery status updates

**Voor later:**
- Webhook URL: `https://jouw-domein.nl/api/webhooks/whatsapp`
- Status callback URL: `https://jouw-domein.nl/api/webhooks/whatsapp/status`

### STAP 5: Server Herstarten & Testen

```bash
npm run dev
# of
node server.js
```

**Test:**
1. Zorg dat je test gebruiker een telefoonnummer heeft
2. Schakel WhatsApp notificaties aan
3. Wijs een test lead toe
4. Check je WhatsApp binnen 10 seconden

---

## ⚠️ Belangrijk:

**Status: Offline**
- Dit is normaal voor nieuwe WhatsApp Senders
- Na goedkeuring van Content Template wordt dit "Online"
- Je kunt al testen tijdens review periode

**Messaging Limits:**
- 80 messages per second (meer dan genoeg)
- Na goedkeuring heb je volledige toegang

**Content Templates:**
- Vereist voor business-initiated messages
- Na goedkeuring kun je automatisch berichten sturen
- Duurt meestal 24-48 uur voor goedkeuring

---

## 🎯 Huidige Status:

- ✅ WhatsApp Sender: `+3197010289758`
- ✅ Business Name: GrowSocial Platform
- ✅ WhatsApp From geüpdatet in `.env`
- ⏳ Content Template: **Nog aanmaken**
- ⏳ Auth Token: **Check of toegevoegd**
- ⏳ Status: Offline (wordt Online na template goedkeuring)

---

## 📝 Quick Checklist:

- [ ] Auth Token in `.env`?
- [ ] Content Template aangemaakt?
- [ ] Business profile ingevuld (optioneel)?
- [ ] Server herstart?
- [ ] Test uitgevoerd?

---

**Volgende actie:** Maak Content Template aan en voeg Content SID toe aan `.env`!

---

**Laatste update:** 2025-11-04

