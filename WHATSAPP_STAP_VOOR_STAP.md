# WhatsApp Notificaties - Stap voor Stap Handleiding

## ✅ Checklist

### FASE 1: Database Setup (5 minuten)

- [ ] **Stap 1.1:** Check of `whatsapp_notification_enabled` kolom bestaat
  ```sql
  -- Run in Supabase SQL Editor
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'settings' AND column_name = 'whatsapp_notification_enabled';
  ```

- [ ] **Stap 1.2:** Als kolom niet bestaat, voeg toe:
  ```sql
  ALTER TABLE settings 
  ADD COLUMN IF NOT EXISTS whatsapp_notification_enabled INTEGER DEFAULT 0;
  ```

---

### FASE 2: Meta Business Account Setup (30-60 minuten)

- [ ] **Stap 2.1:** Ga naar https://business.facebook.com en maak een account aan (of log in)

- [ ] **Stap 2.2:** Maak een WhatsApp Business Account aan
  - Ga naar Meta Business Manager
  - Klik op "WhatsApp Accounts" > "Add" > "Create Account"
  - Volg de wizard

- [ ] **Stap 2.3:** Voeg een telefoonnummer toe
  - Dit moet een nummer zijn dat je kunt gebruiken voor WhatsApp Business
  - Je ontvangt een verificatiecode via SMS/WhatsApp

---

### FASE 3: Meta for Developers Setup (30 minuten)

- [ ] **Stap 3.1:** Ga naar https://developers.facebook.com en log in

- [ ] **Stap 3.2:** Maak een nieuwe App aan
  - Klik op "My Apps" > "Create App"
  - Kies "Business" als type
  - Geef een naam (bijv. "GrowSocial WhatsApp")
  - Vul contact email in

- [ ] **Stap 3.3:** Voeg WhatsApp product toe
  - In je app dashboard, klik op "Add Product"
  - Zoek "WhatsApp" en klik "Set Up"

- [ ] **Stap 3.4:** Koppel je WhatsApp Business Account
  - Volg de wizard om je WhatsApp Business Account te koppelen
  - Selecteer het account dat je in stap 2.2 hebt aangemaakt

- [ ] **Stap 3.5:** Ga naar WhatsApp > API Setup
  - Kopieer je **Access Token** (begint met "EAA...")
  - Kopieer je **Phone Number ID** (een lang nummer)
  - **BELANGRIJK:** Sla deze op, je hebt ze nodig voor stap 4!

---

### FASE 4: WhatsApp Template Aanmaken (15 minuten + 1-2 dagen wachten)

- [ ] **Stap 4.1:** Ga naar WhatsApp > Message Templates in Meta Business Manager

- [ ] **Stap 4.2:** Klik op "Create Template"

- [ ] **Stap 4.3:** Vul template details in:
  - **Template Name:** `new_lead_notification`
  - **Category:** Kies "UTILITY" of "MARKETING" (UTILITY is beter voor transactionele berichten)
  - **Language:** Nederlands (nl)

- [ ] **Stap 4.4:** Voeg template tekst toe:
  ```
  Je hebt een nieuwe aanvraag ontvangen!

  Bedrijf: {{1}}
  Naam: {{2}}
  E-mail: {{3}}

  Bekijk de details: {{4}}

  Met vriendelijke groet,
  GrowSocial Team
  ```

- [ ] **Stap 4.5:** Submit template voor goedkeuring
  - Template moet worden goedgekeurd door Meta (duurt 1-2 dagen)
  - Je ontvangt een email wanneer het is goedgekeurd
  - **BELANGRIJK:** Template naam moet EXACT zijn: `new_lead_notification`

---

### FASE 5: Environment Variables Configureren (5 minuten)

- [ ] **Stap 5.1:** Open je `.env` bestand in de root van je project

- [ ] **Stap 5.2:** Voeg deze regels toe (vervang de waarden met jouw echte credentials):
  ```bash
  # WhatsApp Cloud API Configuration
  WHATSAPP_ACCESS_TOKEN=EAAxxxxx... (jouw access token uit stap 3.5)
  WHATSAPP_PHONE_NUMBER_ID=123456789012345 (jouw phone number ID uit stap 3.5)
  WHATSAPP_API_VERSION=v21.0
  WHATSAPP_TEMPLATE_ID=new_lead_notification
  ```

- [ ] **Stap 5.3:** Sla het bestand op

- [ ] **Stap 5.4:** Herstart je server:
  ```bash
  # Stop je huidige server (Ctrl+C)
  # Start opnieuw:
  npm run dev
  # of
  node server.js
  ```

---

### FASE 6: Test Gebruiker Setup (5 minuten)

- [ ] **Stap 6.1:** Log in op je dashboard als test gebruiker

- [ ] **Stap 6.2:** Ga naar Profiel instellingen en zorg dat je een telefoonnummer hebt:
  - Ga naar `/dashboard/settings/profile`
  - Voeg je telefoonnummer toe als het er nog niet is
  - Formaat: `+31612345678` of `0612345678` (wordt automatisch geformatteerd)

- [ ] **Stap 6.3:** Ga naar Notificatie instellingen:
  - Ga naar `/dashboard/settings/notifications`
  - Schakel "WhatsApp notificaties" AAN

---

### FASE 7: Testen (10 minuten)

- [ ] **Stap 7.1:** Wacht tot template is goedgekeurd (check email van Meta)

- [ ] **Stap 7.2:** Maak een test lead aan en wijs deze toe aan je test gebruiker
  - Of gebruik de admin interface om een lead toe te wijzen

- [ ] **Stap 7.3:** Check je WhatsApp
  - Je zou binnen 10 seconden een WhatsApp bericht moeten ontvangen

- [ ] **Stap 7.4:** Check server logs
  - Je zou moeten zien: `✅ WhatsApp message sent successfully`
  - Als er een error is, staat die in de logs

---

## 🐛 Troubleshooting

### WhatsApp berichten worden niet verstuurd?

1. **Check environment variables:**
   ```bash
   # In terminal:
   node -e "console.log('Token:', process.env.WHATSAPP_ACCESS_TOKEN ? 'Gevonden' : 'NIET GEVONDEN')"
   ```

2. **Check server logs:**
   - Zoek naar `⚠️ WhatsApp service niet geconfigureerd`
   - Als je dit ziet, zijn je environment variables niet geladen

3. **Check gebruiker instellingen:**
   ```sql
   -- Run in Supabase:
   SELECT whatsapp_notification_enabled, phone 
   FROM settings s
   JOIN profiles p ON s.user_id = p.id
   WHERE s.user_id = 'jouw-user-id-hier';
   ```

4. **Check template status:**
   - Ga naar WhatsApp > Message Templates in Meta Business Manager
   - Template moet status "APPROVED" hebben

### Template niet gevonden error?

- Check dat `WHATSAPP_TEMPLATE_ID` exact overeenkomt met de template naam in Meta
- Templates zijn case-sensitive!
- Template moet status "APPROVED" hebben

### Access Token expired?

- Access tokens verlopen na 60 dagen (of eerder)
- Genereer een nieuwe token in Meta for Developers > WhatsApp > API Setup
- Update `WHATSAPP_ACCESS_TOKEN` in je `.env` bestand

---

## 📞 Hulp Nodig?

- **Meta Developer Docs:** https://developers.facebook.com/docs/whatsapp
- **WhatsApp Cloud API:** https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- **Template Guidelines:** https://developers.facebook.com/docs/whatsapp/message-templates

---

## ✅ Quick Start (Als je alles al hebt)

Als je al een Meta Business Account hebt met WhatsApp:

1. Ga naar https://developers.facebook.com > Je App > WhatsApp > API Setup
2. Kopieer Access Token en Phone Number ID
3. Voeg toe aan `.env`:
   ```bash
   WHATSAPP_ACCESS_TOKEN=...
   WHATSAPP_PHONE_NUMBER_ID=...
   WHATSAPP_TEMPLATE_ID=new_lead_notification
   ```
4. Maak template aan (stap 4)
5. Wacht op goedkeuring
6. Test!

---

**Geschatte totale tijd:** ~2-3 uur setup + 1-2 dagen wachten op template goedkeuring

