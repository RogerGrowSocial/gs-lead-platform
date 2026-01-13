# WhatsApp Notificaties Setup Guide

## Overzicht

De WhatsApp notificatie functionaliteit is nu geïmplementeerd en kan worden gebruikt om automatisch WhatsApp berichten te sturen wanneer gebruikers een nieuwe aanvraag (lead) ontvangen.

## Functionaliteit

- ✅ WhatsApp service geïmplementeerd (`services/whatsappService.js`)
- ✅ Geïntegreerd in NotificationService
- ✅ Automatisch versturen bij lead assignment
- ✅ Telefoonnummer validatie en formatting
- ✅ Check of gebruiker WhatsApp notificaties heeft ingeschakeld
- ✅ Fallback: email notificatie blijft altijd werken als WhatsApp faalt

## Setup Stappen

### 1. Meta Business Account Setup

1. Maak een Meta Business Account aan op https://business.facebook.com
2. Maak een WhatsApp Business Account aan via Meta Business Manager
3. Voeg een telefoonnummer toe aan je WhatsApp Business Account

### 2. WhatsApp Cloud API Setup

1. Ga naar Meta for Developers: https://developers.facebook.com
2. Maak een nieuwe App aan (of gebruik een bestaande)
3. Voeg "WhatsApp" product toe aan je app
4. Ga naar WhatsApp > API Setup
5. Kopieer je **Access Token** en **Phone Number ID**

### 3. WhatsApp Template Aanmaken

WhatsApp vereist goedgekeurde templates voor transactionele berichten:

1. Ga naar WhatsApp > Message Templates in Meta Business Manager
2. Maak een nieuwe template aan met de volgende details:

**Template Naam:** `new_lead_notification`  
**Categorie:** Transactioneel  
**Taal:** Nederlands (nl)

**Template Tekst:**
```
🎯 Je hebt een nieuwe aanvraag ontvangen!

Bedrijf: {{1}}
Naam: {{2}}
E-mail: {{3}}

Bekijk de details: {{4}}

Met vriendelijke groet,
GrowSocial Team
```

**Parameters:**
- {{1}} - Bedrijfsnaam
- {{2}} - Contact naam
- {{3}} - Email
- {{4}} - Dashboard URL

**Let op:** Template goedkeuring kan 1-2 dagen duren bij Meta.

### 4. Environment Variables

Voeg de volgende environment variables toe aan je `.env` bestand:

```bash
# WhatsApp Cloud API Configuration
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_API_VERSION=v21.0
WHATSAPP_TEMPLATE_ID=new_lead_notification
```

### 5. Database Check

Zorg dat de `whatsapp_notification_enabled` kolom bestaat in de `settings` tabel:

```sql
-- Run deze SQL in Supabase SQL Editor als de kolom nog niet bestaat
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS whatsapp_notification_enabled INTEGER DEFAULT 0;
```

### 6. Gebruiker Setup

Gebruikers moeten:
1. Een telefoonnummer hebben in hun profiel (`profiles.phone`)
2. WhatsApp notificaties inschakelen in de instellingen (`/dashboard/settings/notifications`)

## Hoe het Werkt

1. **Lead wordt toegewezen:** Wanneer een lead wordt toegewezen aan een gebruiker (`routes/api.js`):
   - `notificationService.sendLeadAssigned()` wordt aangeroepen
   - Email notificatie wordt altijd verstuurd
   - WhatsApp notificatie wordt verstuurd als:
     - Gebruiker heeft WhatsApp notificaties ingeschakeld (`whatsapp_notification_enabled = 1`)
     - Gebruiker heeft een telefoonnummer in profiel
     - WhatsApp service is geconfigureerd (access token en phone number ID)

2. **Telefoonnummer Formatting:**
   - Nederlandse nummers worden automatisch geformatteerd naar internationaal formaat
   - Bijvoorbeeld: `0612345678` → `+31612345678`
   - Ondersteunt verschillende input formaten

3. **Error Handling:**
   - Als WhatsApp faalt, wordt de error gelogd maar faalt de lead assignment niet
   - Email notificatie blijft altijd werken als fallback

## Testing

### Test in Development Mode

De WhatsApp service logt warnings als deze niet geconfigureerd is, maar crasht niet. Je kunt de functionaliteit testen door:

1. WhatsApp credentials toe te voegen aan `.env`
2. Een test template aan te maken in Meta Business Manager
3. Een lead toe te wijzen aan een gebruiker met:
   - WhatsApp notificaties ingeschakeld
   - Geldig telefoonnummer in profiel

### Test Bericht Sturen

Je kunt een test bericht sturen via de WhatsApp service:

```javascript
const WhatsAppService = require('./services/whatsappService');
const whatsappService = new WhatsAppService();

// Test bericht sturen
await whatsappService.sendTestMessage('+31612345678', 'Test bericht');
```

## Kosten

- **Setup:** Gratis
- **Per bericht:** ~€0.05-0.10 (via WhatsApp Cloud API)
- **Gratis tier:** Eerste 1000 gesprekken/maand gratis
- **Daarboven:** ~€50-100 per 1000 berichten

## Troubleshooting

### WhatsApp berichten worden niet verstuurd

1. **Check environment variables:**
   ```bash
   echo $WHATSAPP_ACCESS_TOKEN
   echo $WHATSAPP_PHONE_NUMBER_ID
   ```

2. **Check logs:** De service logt warnings als deze niet geconfigureerd is

3. **Check gebruiker instellingen:**
   - Heeft gebruiker WhatsApp notificaties ingeschakeld?
   - Heeft gebruiker een telefoonnummer in profiel?

4. **Check template status:** Is de template goedgekeurd in Meta Business Manager?

5. **Check API response:** De service logt alle API responses voor debugging

### Template niet gevonden

- Zorg dat `WHATSAPP_TEMPLATE_ID` overeenkomt met de exacte template naam in Meta Business Manager
- Templates zijn case-sensitive

### Telefoonnummer formatting issues

- Check de logs voor de geformatteerde telefoonnummers
- Zorg dat nummers beginnen met `+` en landcode (bijv. `+31` voor Nederland)

## Veiligheid

- Access tokens zijn gevoelig - bewaar ze veilig in environment variables
- Gebruik nooit access tokens in code of git commits
- Rotate access tokens regelmatig voor betere security

## Volgende Stappen

- [ ] Meta Business Account aanmaken
- [ ] WhatsApp Business Account setup
- [ ] Template aanmaken en goedkeuren
- [ ] Environment variables configureren
- [ ] Testen met een echte lead assignment
- [ ] Monitoring toevoegen voor succes/faal ratio

## Support

Voor vragen over WhatsApp Cloud API:
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [WhatsApp Cloud API Setup](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Template Guidelines](https://developers.facebook.com/docs/whatsapp/message-templates)

