# WhatsApp Notificatie Systeem - Implementatie Plan

## 📋 Overzicht

**Wat:** WhatsApp notificaties sturen wanneer gebruikers een nieuwe lead ontvangen
**Waarom:** Directe, persoonlijke notificaties voor belangrijke updates
**Moeilijkheidsgraad:** Medium (2-3 uur implementatie met AI)
**Schatting:** 2-3 uur voor volledige implementatie

## 🎯 Opties voor WhatsApp Integratie

### Optie 1: WhatsApp Business API via Meta (Aanbevolen)
**Moeilijkheidsgraad:** ⭐⭐⭐ (Medium)
**Kosten:** ~€0.05-0.10 per bericht
**Voordelen:**
- Officiële API van Meta
- Betrouwbaar en stabiel
- Templates voor transactionele berichten
- Goed gedocumenteerd

**Nadelen:**
- Vereist Meta Business account verificatie
- Template approval nodig (kan 1-2 dagen duren)
- Setup tijd: ~1-2 uur

**Implementatie:**
- Gebruik `whatsapp-business-api` npm package
- Of gebruik direct Graph API van Meta

### Optie 2: WhatsApp Cloud API (Gratis Tier)
**Moeilijkheidsgraad:** ⭐⭐⭐ (Medium)
**Kosten:** Gratis voor eerste 1000 gesprekken/maand
**Voordelen:**
- Gratis voor kleine volumes
- Directe Meta integratie
- Goede documentatie

**Nadelen:**
- Vereist Meta Business account
- Rate limits op gratis tier

### Optie 3: Third-party Provider (Twilio, MessageBird)
**Moeilijkheidsgraad:** ⭐⭐ (Makkelijk)
**Kosten:** ~€0.05-0.15 per bericht
**Voordelen:**
- Makkelijke setup
- Goede Node.js SDK's
- Minder verificatie nodig

**Nadelen:**
- Hogere kosten op lange termijn
- Extra dependency

## 🚀 Aanbevolen Aanpak: WhatsApp Cloud API

We gebruiken de officiële WhatsApp Cloud API omdat:
1. Gratis voor eerste 1000 berichten/maand
2. Betrouwbaar en officieel
3. Goede Node.js support
4. Makkelijk te schalen

## ⏱️ Tijdsinschatting per Stap

1. **Database & UI Setup** - 15 minuten ✅
2. **WhatsApp Service Bouwen** - 45 minuten
3. **Meta Business Account Setup** - 30-60 minuten (handmatig)
4. **Template Aanmaken & Goedkeuren** - 1-2 dagen (Meta approval)
5. **Integratie bij Lead Assignment** - 30 minuten
6. **Testing** - 30 minuten

**Totaal met AI:** ~2-3 uur (exclusief Meta approval tijd)

## 📦 Benodigde Dependencies

```bash
npm install whatsapp-web.js
# OF
npm install @whatsapp/cloud-api
# OF
npm install twilio
```

## 📝 WhatsApp Template Vereisten

WhatsApp vereist goedgekeurde templates voor transactionele berichten:

**Template Voorbeeld:**
```
Template naam: new_lead_notification
Type: Transactioneel

Template tekst:
🎯 Je hebt een nieuwe lead ontvangen!

Bedrijf: {{1}}
Naam: {{2}}
E-mail: {{3}}

Bekijk de details in je dashboard: {{4}}

Met vriendelijke groet,
GrowSocial Team

⚠️ Deze notificatie kan niet worden uitgeschakeld.
```

**Parameters:**
1. {{1}} - Bedrijfsnaam
2. {{2}} - Contact naam
3. {{3}} - Email
4. {{4}} - Dashboard URL

**Goedkeuring:** Meta moet deze template goedkeuren (1-2 dagen)

## 🔐 Benodigde Credentials

1. **Meta Business Account** (gratis aan te maken)
2. **WhatsApp Business Account** (via Meta Business Manager)
3. **Access Token** (van Meta Graph API)
4. **Phone Number ID** (van WhatsApp Business Account)
5. **Template ID** (na goedkeuring)

## 🛠️ Implementatie Stappen

### Stap 1: Database & UI ✅
- Kolom toevoegen: `whatsapp_notification_enabled`
- Switch toevoegen in UI
- Opslaan van instellingen

### Stap 2: WhatsApp Service
- Service maken die berichten verstuurt
- Template rendering
- Error handling

### Stap 3: Integratie
- Hook toevoegen bij lead assignment
- Check instellingen voordat bericht wordt verstuurd
- Alleen versturen bij nieuwe leads

### Stap 4: Testing
- Test met eigen nummer
- Verifieer template rendering
- Test error handling

## 💰 Kosten Schatting

- **Setup:** Gratis
- **Per bericht:** ~€0.05-0.10
- **1000 berichten/maand:** Gratis (Cloud API free tier)
- **Daarboven:** ~€50-100 per 1000 berichten

**Voorbeeld:**
- 100 leads/maand = ~€5-10/maand
- 500 leads/maand = Gratis (binnen free tier)
- 2000 leads/maand = ~€50-100/maand

## ⚠️ Belangrijke Overwegingen

1. **Opt-in Vereist:** WhatsApp vereist expliciete toestemming van gebruikers
2. **Template Approval:** Duurt 1-2 dagen bij Meta
3. **Rate Limits:** Max 1000 berichten/maand gratis, daarna betaald
4. **Telefoonnummer Format:** Moet internationaal formaat zijn (bijv. +31612345678)
5. **Spam Prevention:** Alleen bij nieuwe leads, niet bij updates

## 🎯 Aanbevolen Flow

1. Gebruiker schakelt WhatsApp notificaties aan
2. Bij nieuwe lead assignment:
   - Check of WhatsApp notificaties aan staan
   - Check of telefoonnummer aanwezig is
   - Verstuur WhatsApp bericht met template
   - Log het versturen
3. Bij fouten: Fallback naar email

## 📚 Resources

- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [WhatsApp Cloud API Setup](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Template Guidelines](https://developers.facebook.com/docs/whatsapp/message-templates)

