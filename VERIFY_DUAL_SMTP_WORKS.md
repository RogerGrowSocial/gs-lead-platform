# Verificatie: Werkt Dual SMTP Correct?

## 🎯 Probleem

**Jouw observatie**: Beide systemen (Mailgun en Mijndomein) gebruiken mogelijk dezelfde mail server, wat conflicten veroorzaakt.

**Dit klopt!** Het probleem is:
- Mailgun stuurt email → komt aan bij Mijndomein mail server
- Mijndomein mail server ziet: "Email van externe provider voor eigen domein?"
- Resultaat: Email wordt afgewezen of genegeerd

---

## ✅ Oplossing: Dual SMTP (Al Geïmplementeerd!)

**De code detecteert automatisch:**
- Email naar `@growsocialmedia.nl` → **Mijndomein SMTP** (direct, geen conflict)
- Email naar extern adres → **Mailgun SMTP**

**Dit voorkomt het conflict!**

---

## 🔍 Verificatie: Werkt Het?

### Stap 1: Check Environment Variables

**Open je `.env` file en check:**

```env
# Mailgun (voor externe emails)
MAILGUN_SMTP_HOST=smtp.eu.mailgun.org
MAILGUN_SMTP_PORT=587
MAILGUN_SMTP_USER=info@growsocialmedia.nl
MAILGUN_SMTP_PASS=YOUR_MAILGUN_SMTP_PASSWORD

# Mijndomein (voor interne emails) - ZIJN DEZE AANWEZIG?
MIJNDOMEIN_SMTP_HOST=mail.mijndomein.nl
MIJNDOMEIN_SMTP_PORT=587
MIJNDOMEIN_SMTP_USER=noreply@growsocialmedia.nl
MIJNDOMEIN_SMTP_PASS=[Je Mijndomein email wachtwoord]
```

**Check:**
- [ ] `MIJNDOMEIN_SMTP_HOST` is ingesteld
- [ ] `MIJNDOMEIN_SMTP_USER` is ingesteld  
- [ ] `MIJNDOMEIN_SMTP_PASS` is ingesteld

**Als deze ontbreken:**
- Dual SMTP werkt niet
- Interne emails gebruiken nog steeds Mailgun
- Conflict blijft bestaan

---

### Stap 2: Test Interne Email en Check Logs

**Test:**
1. Stuur een email naar `serve@growsocialmedia.nl`
2. Check server logs direct daarna

**Wat je moet zien in logs:**

**✅ GOED (Dual SMTP werkt):**
```
📧 Email Service Configuration (Mijndomein):
   Host: mail.mijndomein.nl
   Port: 587
   User: noreply@growsocialmedia.nl...
   Password: SET (X chars)
   From: noreply@growsocialmedia.nl
   To: serve@growsocialmedia.nl
   Internal: Yes
```

**❌ FOUT (Dual SMTP werkt niet):**
```
📧 Email Service Configuration (Mailgun):
   Host: smtp.eu.mailgun.org
   ...
   Internal: Yes  ← Dit zou "No" moeten zijn, of provider zou "Mijndomein" moeten zijn
```

---

### Stap 3: Als Dual SMTP Niet Werkt

**Probleem**: Logs tonen "Mailgun" voor interne emails

**Oplossing:**

1. **Voeg Mijndomein credentials toe aan `.env`:**
   ```env
   MIJNDOMEIN_SMTP_HOST=mail.mijndomein.nl
   MIJNDOMEIN_SMTP_PORT=587
   MIJNDOMEIN_SMTP_USER=noreply@growsocialmedia.nl
   MIJNDOMEIN_SMTP_PASS=[Je Mijndomein email wachtwoord]
   ```

2. **Haal Mijndomein SMTP credentials op:**
   - Log in op Mijndomein
   - Ga naar **Email** → **SMTP instellingen**
   - Noteer host, port, username, password

3. **Herstart server:**
   - Stop server
   - Start server opnieuw
   - Dit laadt nieuwe environment variables

4. **Test opnieuw:**
   - Stuur email naar `serve@growsocialmedia.nl`
   - Check logs: moet nu "Mijndomein" tonen

---

## 🧪 Test Plan

### Test 1: Check Logs Na Registratie

1. Registreer een nieuwe gebruiker met `serve@growsocialmedia.nl`
2. Check server logs direct daarna
3. Zoek naar: "Email Service Configuration"
4. Check welke provider wordt gebruikt

**Verwacht:**
- Als `serve@growsocialmedia.nl` → "Mijndomein"
- Als `user@gmail.com` → "Mailgun"

---

### Test 2: Direct Email Test

1. Stuur een test email naar `serve@growsocialmedia.nl`
2. Check logs
3. Check welke provider wordt gebruikt

**Verwacht:**
- Provider: "Mijndomein"
- Internal: "Yes"
- Host: "mail.mijndomein.nl"

---

## 📋 Quick Fix Checklist

Als dual SMTP niet werkt:

- [ ] **Mijndomein SMTP credentials opgehaald** uit Mijndomein dashboard
- [ ] **Environment variables toegevoegd** aan `.env`:
  - `MIJNDOMEIN_SMTP_HOST`
  - `MIJNDOMEIN_SMTP_PORT`
  - `MIJNDOMEIN_SMTP_USER`
  - `MIJNDOMEIN_SMTP_PASS`
- [ ] **Server herstart** (om env vars te laden)
- [ ] **Test interne email** - check logs
- [ ] **Verifieer logs tonen "Mijndomein"** voor interne emails

---

## 🎯 Samenvatting

**Jouw observatie is correct:**
- Mailgun en Mijndomein gebruiken dezelfde mail server
- Dit veroorzaakt conflicten voor same-domain sending

**De oplossing:**
- Dual SMTP is al geïmplementeerd in code
- Interne emails gaan direct via Mijndomein SMTP (geen conflict)
- Externe emails gaan via Mailgun SMTP

**Wat te doen:**
1. Verifieer Mijndomein SMTP credentials zijn in `.env`
2. Herstart server
3. Test en check logs

---

**Laatste update**: January 2025
