# WhatsApp Notificaties - Documentatie & Setup Guide

**Account:** schoenmakersrogier@gmail.com  
**App Naam:** GrowSocial Messaging Service  
**App Contact Email:** info@growsocialmedia.nl  
**Datum:** 2025-11-04 22:51:57  
**Status:** In Setup - App aangemaakt ✅

---

## 📋 Overzicht

De WhatsApp notificatie functionaliteit is geïmplementeerd om automatisch WhatsApp berichten te sturen wanneer gebruikers een nieuwe aanvraag (lead) ontvangen.

**Wat werkt:**
- ✅ Database kolom `whatsapp_notification_enabled` bestaat
- ✅ WhatsApp service geïmplementeerd (`services/whatsappService.js`)
- ✅ Integratie in NotificationService
- ✅ Automatisch versturen bij lead assignment
- ✅ Telefoonnummer validatie en formatting

---

## 🔧 Setup Stappen

### ✅ STAP 1: Database - VOLTOOID
- Database kolom `whatsapp_notification_enabled` bestaat al in `settings` tabel

### 📝 STAP 2: Meta Business Account Setup

**Account:** schoenmakersrogier@gmail.com

1. **Ga naar Meta Business Manager:**
   - URL: https://business.facebook.com
   - Log in met: schoenmakersrogier@gmail.com

2. **Maak WhatsApp Business Account aan:**
   - In Business Manager: Settings > Business Assets > WhatsApp Accounts
   - Klik "Add" > "Create Account"
   - Volg de wizard

3. **Voeg telefoonnummer toe:**
   - Dit moet een nummer zijn dat je kunt gebruiken voor WhatsApp Business
   - Je ontvangt een verificatiecode via SMS/WhatsApp
   - **BELANGRIJK:** Noteer dit nummer, je hebt het nodig!

---

### 📝 STAP 3: Meta for Developers Setup

**Account:** schoenmakersrogier@gmail.com

1. **Ga naar Meta for Developers:**
   - URL: https://developers.facebook.com
   - Log in met: schoenmakersrogier@gmail.com

2. **Maak een nieuwe App aan:**
   - Klik "My Apps" > "Create App"
   - Kies "Business" als app type
   - App naam: `GrowSocial Messaging Service` ✅
   - Contact email: `info@growsocialmedia.nl` ✅

3. **Voeg WhatsApp product toe:**
   - In je app dashboard: "Add Product"
   - Zoek "WhatsApp" en klik "Set Up"
   - **BELANGRIJK:** Selecteer de optie **"Connect with customers through WhatsApp"** ✅
   - Deze optie zegt: "Start a WhatsApp conversation, send notifications, create ads that click-to-WhatsApp and provide support. Business portfolio required."

4. **Koppel WhatsApp Business Account:**
   - Volg de wizard
   - Selecteer het WhatsApp Business Account dat je in Stap 2 hebt aangemaakt

5. **Krijg je credentials:**
   - Ga naar: WhatsApp > API Setup (in je app dashboard)
   - Je ziet hier:
     - **Access Token** (begint met "EAA...")
     - **Phone Number ID** (een lang nummer)
   
   **⚠️ BELANGRIJK:** Kopieer beide en bewaar ze veilig!

---

### 📝 STAP 4: WhatsApp Template Aanmaken

**Template Details:**

- **Template Naam:** `new_lead_notification` (EXACT zoals dit, case-sensitive!)
- **Categorie:** UTILITY (of MARKETING als UTILITY niet beschikbaar is)
- **Taal:** Nederlands (nl)
- **Type:** Transactioneel

**Template Tekst:**
```
Je hebt een nieuwe aanvraag ontvangen!

Bedrijf: {{1}}
Naam: {{2}}
E-mail: {{3}}

Bekijk de details: {{4}}

Met vriendelijke groet,
GrowSocial Team
```

**Parameters:**
- {{1}} = Bedrijfsnaam
- {{2}} = Contact naam
- {{3}} = Email adres
- {{4}} = Dashboard URL (wordt automatisch ingevuld)

**Hoe aanmaken:**
1. Ga naar: WhatsApp > Message Templates (in Meta Business Manager)
2. Klik "Create Template"
3. Vul bovenstaande details in
4. Submit voor goedkeuring
5. **Wacht:** Goedkeuring kan 1-2 dagen duren (je krijgt email)

---

### 📝 STAP 5: Environment Variables Configureren

**Bestand:** `.env` (in root van project)

Voeg deze regels toe (vervang de waarden met jouw echte credentials uit Stap 3):

```bash
# WhatsApp Cloud API Configuration
# Account: schoenmakersrogier@gmail.com
# App: GrowSocial Messaging Service
WHATSAPP_ACCESS_TOKEN=EAAxxxxx... (jouw access token uit Meta for Developers)
WHATSAPP_PHONE_NUMBER_ID=123456789012345 (jouw phone number ID uit Meta for Developers)
WHATSAPP_API_VERSION=v21.0
WHATSAPP_TEMPLATE_ID=new_lead_notification
```

**Na het toevoegen:**
```bash
# Herstart je server
npm run dev
# of
node server.js
```

---

### 📝 STAP 6: Test Gebruiker Setup

**Voor testen:**

1. **Log in op dashboard** als test gebruiker

2. **Voeg telefoonnummer toe aan profiel:**
   - Ga naar: `/dashboard/settings/profile`
   - Voeg telefoonnummer toe
   - Formaat: `+31612345678` of `0612345678` (wordt automatisch geformatteerd)

3. **Schakel WhatsApp notificaties aan:**
   - Ga naar: `/dashboard/settings/notifications`
   - Schakel "WhatsApp notificaties" AAN

---

### 📝 STAP 7: Testen

**Na template goedkeuring:**

1. **Wacht op email** van Meta dat template is goedgekeurd

2. **Test lead assignment:**
   - Maak een test lead aan
   - Wijs toe aan je test gebruiker (via admin of API)
   - Check je WhatsApp binnen 10 seconden

3. **Check server logs:**
   - Je zou moeten zien: `✅ WhatsApp message sent successfully`
   - Als er errors zijn, staan ze in de logs

---

## 🔍 Troubleshooting

### WhatsApp berichten worden niet verstuurd?

**Check 1: Environment Variables**
```bash
# Check of variables geladen zijn:
node -e "console.log('Token:', process.env.WHATSAPP_ACCESS_TOKEN ? 'Gevonden ✅' : 'NIET GEVONDEN ❌')"
```

**Check 2: Server Logs**
Zoek naar:
- `⚠️ WhatsApp service niet geconfigureerd` → Environment variables niet geladen
- `❌ Error sending WhatsApp message` → Bekijk de error details

**Check 3: Gebruiker Instellingen**
```sql
-- Run in Supabase SQL Editor:
SELECT 
    s.whatsapp_notification_enabled, 
    p.phone,
    p.email
FROM settings s
JOIN profiles p ON s.user_id = p.id
WHERE p.email = 'jouw-test-email@example.com';
```

**Check 4: Template Status**
- Ga naar WhatsApp > Message Templates in Meta Business Manager
- Template moet status "APPROVED" hebben (niet "PENDING")

### Template niet gevonden error?

- Check dat `WHATSAPP_TEMPLATE_ID` exact overeenkomt met template naam
- Templates zijn case-sensitive!
- Template moet status "APPROVED" hebben

### Access Token expired?

- Access tokens verlopen na 60 dagen
- Genereer nieuwe: Meta for Developers > WhatsApp > API Setup
- Update `WHATSAPP_ACCESS_TOKEN` in `.env`

---

## 📊 Logs & Monitoring

**Server logs tonen:**
- `📱 Sending WhatsApp message to +31...` → Bericht wordt verstuurd
- `✅ WhatsApp message sent successfully` → Succesvol
- `⚠️ WhatsApp notifications disabled` → Gebruiker heeft uitgeschakeld
- `📱 No phone number found` → Gebruiker heeft geen telefoonnummer
- `❌ Error sending WhatsApp message` → Er is een error

---

## 💰 Kosten

**WhatsApp Cloud API Pricing:**
- **Eerste 1000 gesprekken/maand:** Gratis
- **Daarboven:** ~€0.05-0.10 per bericht
- **1000 berichten/maand:** Gratis
- **2000 berichten/maand:** ~€50-100

**Voorbeeld:**
- 100 leads/maand = ~€5-10/maand
- 500 leads/maand = Gratis (binnen free tier)
- 2000 leads/maand = ~€50-100/maand

---

## 🔐 Veiligheid

**BELANGRIJK:**
- ⚠️ Access tokens zijn gevoelig - bewaar ze veilig
- ⚠️ Gebruik nooit access tokens in code of git commits
- ⚠️ Rotate access tokens regelmatig (elke 60 dagen)
- ⚠️ Gebruik environment variables, nooit hardcoded

---

## 📚 Handige Links

- **Meta Business Manager:** https://business.facebook.com
- **Meta for Developers:** https://developers.facebook.com
- **WhatsApp Cloud API Docs:** https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- **Template Guidelines:** https://developers.facebook.com/docs/whatsapp/message-templates
- **API Reference:** https://developers.facebook.com/docs/whatsapp/cloud-api/reference

---

## ✅ Checklist

- [ ] Meta Business Account aangemaakt ✅
- [ ] WhatsApp Business Account aangemaakt
- [ ] Telefoonnummer toegevoegd en geverifieerd
- [ ] Meta for Developers App aangemaakt ✅ (`GrowSocial Messaging Service`)
- [ ] WhatsApp product toegevoegd ✅ ("Connect with customers through WhatsApp")
- [ ] Access Token gekopieerd
- [ ] Phone Number ID gekopieerd
- [ ] Template aangemaakt (`new_lead_notification`)
- [ ] Template goedgekeurd (wacht 1-2 dagen)
- [ ] Environment variables toegevoegd aan `.env`
- [ ] Server herstart
- [ ] Test gebruiker heeft telefoonnummer
- [ ] Test gebruiker heeft WhatsApp notificaties aan
- [ ] Test lead assignment uitgevoerd
- [ ] WhatsApp bericht ontvangen ✅

---

## 📝 Notities

**App Details:**
- **App Naam:** GrowSocial Messaging Service
- **App ID:** 1206899250352432
- **App Contact Email:** info@growsocialmedia.nl
- **Developer Account:** schoenmakersrogier@gmail.com
- **App Mode:** Development

**Datum template aangemaakt:** ...  
**Datum template goedgekeurd:** ...  
**Access Token aangemaakt:** ...  
**Access Token verloopt:** ... (60 dagen na aanmaak, of 90 dagen voor test tokens)

**Template ID:** `new_lead_notification`  
**Phone Number ID:** ... (noteer hier na selectie test nummer)  
**Access Token:** EAARJqyEY0TABP0H2pJPV7ee4e7AFbxJkHsRbr0m7HeunF16WCAwfvQ4qZBpCTYCqMw2lBKtIZAIHO4DYm06ySCRwZBbzZCHoGJQpOtp8CXM4VHoMv12FnDap3IaycpHHVFoU2hKHBFJZCgjKDRdEFRqJXDd2FYVz2ZArDfQIXaXs74ZCZAYlk2tOuyIZAjkJRZB3YLvYZBOsTruvLXyD5MOWkopctee38GDL2AOHSnZBwQ4YMR6xI2Ib6mYZCGtcqW9OiHqb8FEMN1LlFmsSBhEtfJcsgVFHDekUkOfHoLZBZCw4QZDZD (Temporary - 90 dagen geldig)

---

**Laatste update:** 2025-11-04 22:51:57

