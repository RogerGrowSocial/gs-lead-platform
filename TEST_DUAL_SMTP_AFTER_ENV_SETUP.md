# Test Dual SMTP Na .env Setup

## ✅ Wat Je Hebt Gedaan

- [x] Mijndomein SMTP credentials toegevoegd aan `.env`

---

## 🔄 Stap 1: Herstart Server (BELANGRIJK!)

**Environment variables worden alleen geladen bij server start.**

1. **Stop je server** (Ctrl+C of stop commando)
2. **Start server opnieuw**
3. Dit laadt de nieuwe `MIJNDOMEIN_SMTP_*` environment variables

**Als je server niet herstart:**
- Dual SMTP werkt niet
- Code gebruikt nog steeds alleen Mailgun
- Interne emails blijven falen

---

## 🧪 Stap 2: Test Interne Email

### Test 1: Stuur Email Naar Intern Adres

1. Stuur een email naar `serve@growsocialmedia.nl`
   - Via registratie (welcome email)
   - OF via password reset
   - OF via direct email service test

2. **Check server logs direct daarna**

### Wat Je Moet Zien in Logs

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
🔍 Verifying SMTP connection...
✅ SMTP connection verified
📤 Attempting to send email...
✅ Email sent successfully
✅ Email verzonden via Mijndomein SMTP (interne email)
```

**❌ FOUT (Dual SMTP werkt niet):**
```
📧 Email Service Configuration (Mailgun):
   Host: smtp.eu.mailgun.org
   ...
   Internal: Yes  ← Dit is fout! Moet "Mijndomein" zijn
```

**❌ FOUT (Mijndomein credentials ontbreken):**
```
📧 Email Service Configuration (Mijndomein):
   ...
   Password: NOT SET  ← Mijndomein password ontbreekt
❌ Mijndomein SMTP credentials not configured.
```

---

## 🔍 Stap 3: Verifieer Environment Variables

### Check 1: Zijn Variables Aanwezig?

Check je `.env` file bevat:

```env
# Mijndomein Configuration
MIJNDOMEIN_SMTP_HOST=mail.mijndomein.nl
MIJNDOMEIN_SMTP_PORT=587
MIJNDOMEIN_SMTP_USER=noreply@growsocialmedia.nl
MIJNDOMEIN_SMTP_PASS=[Je Mijndomein email wachtwoord]
```

**Check:**
- [ ] Alle 4 variabelen zijn aanwezig
- [ ] Geen typos
- [ ] Password is correct (geen extra spaties)

---

### Check 2: Werken Variables?

**Test in code (optioneel):**

Maak een test script:

```javascript
// test-smtp-config.js
require('dotenv').config();

const internalDomain = process.env.INTERNAL_EMAIL_DOMAIN || 'growsocialmedia.nl';
const testEmail = 'serve@growsocialmedia.nl';
const isInternal = testEmail.toLowerCase().endsWith(`@${internalDomain}`);

console.log('Test Email:', testEmail);
console.log('Is Internal:', isInternal);
console.log('');

if (isInternal) {
  console.log('Mijndomein Config:');
  console.log('  Host:', process.env.MIJNDOMEIN_SMTP_HOST || 'NOT SET');
  console.log('  Port:', process.env.MIJNDOMEIN_SMTP_PORT || 'NOT SET');
  console.log('  User:', process.env.MIJNDOMEIN_SMTP_USER || 'NOT SET');
  console.log('  Pass:', process.env.MIJNDOMEIN_SMTP_PASS ? 'SET (' + process.env.MIJNDOMEIN_SMTP_PASS.length + ' chars)' : 'NOT SET');
} else {
  console.log('Mailgun Config:');
  console.log('  Host:', process.env.MAILGUN_SMTP_HOST || 'NOT SET');
  console.log('  User:', process.env.MAILGUN_SMTP_USER || 'NOT SET');
  console.log('  Pass:', process.env.MAILGUN_SMTP_PASS ? 'SET' : 'NOT SET');
}
```

Run: `node test-smtp-config.js`

**Verwacht:**
- Is Internal: `true`
- Mijndomein Config: Alle velden zijn "SET"

---

## 🧪 Stap 4: Test Scenarios

### Test 1: Registratie met Intern Email

1. Registreer nieuwe gebruiker met `serve@growsocialmedia.nl`
2. Check server logs:
   - [ ] "Email Service Configuration (Mijndomein)"
   - [ ] "Internal: Yes"
   - [ ] "Host: mail.mijndomein.nl"
3. Check inbox:
   - [ ] Welcome email komt aan

---

### Test 2: Password Reset met Intern Email

1. Ga naar login pagina
2. Klik "Wachtwoord vergeten?"
3. Voer in: `serve@growsocialmedia.nl`
4. Check server logs:
   - [ ] "Email Service Configuration (Mijndomein)"
   - [ ] "Internal: Yes"
5. Check inbox:
   - [ ] Password reset email komt aan

---

### Test 3: Externe Email (Gmail)

1. Stuur email naar Gmail adres
2. Check server logs:
   - [ ] "Email Service Configuration (Mailgun)"
   - [ ] "Internal: No"
   - [ ] "Host: smtp.eu.mailgun.org"
3. Check inbox:
   - [ ] Email komt aan

---

## ⚠️ Troubleshooting

### Probleem: Logs Tonen Nog "Mailgun" voor Interne Emails

**Oorzaak**: Server niet herstart of env vars niet geladen

**Oplossing:**
1. Stop server volledig
2. Start server opnieuw
3. Test opnieuw
4. Check logs opnieuw

---

### Probleem: "Mijndomein SMTP credentials not configured"

**Oorzaak**: Environment variables niet correct ingesteld

**Oplossing:**
1. Check `.env` file:
   - [ ] `MIJNDOMEIN_SMTP_HOST` is aanwezig
   - [ ] `MIJNDOMEIN_SMTP_USER` is aanwezig
   - [ ] `MIJNDOMEIN_SMTP_PASS` is aanwezig
2. Check geen typos
3. Herstart server
4. Test opnieuw

---

### Probleem: "SMTP connection verification failed" voor Mijndomein

**Oorzaak**: Mijndomein SMTP credentials zijn incorrect

**Oplossing:**
1. Verifieer Mijndomein SMTP credentials:
   - Host: `mail.mijndomein.nl` (of wat Mijndomein aangeeft)
   - Port: `587` (of `465` voor SSL)
   - Username: Volledig email adres
   - Password: Correct wachtwoord
2. Update `.env` met correcte waarden
3. Herstart server
4. Test opnieuw

---

## 📋 Verificatie Checklist

- [ ] Mijndomein SMTP credentials toegevoegd aan `.env`
- [ ] Server is herstart (om env vars te laden)
- [ ] Test interne email (`serve@growsocialmedia.nl`)
- [ ] Logs tonen "Mijndomein" (niet "Mailgun")
- [ ] Logs tonen "Internal: Yes"
- [ ] SMTP connection verification succesvol
- [ ] Email komt aan in inbox

---

## 🎯 Verwachte Resultaat

**Na correcte setup:**

1. **Interne emails** (`@growsocialmedia.nl`):
   - ✅ Gebruiken Mijndomein SMTP
   - ✅ Geen conflict met mail server
   - ✅ Komen direct aan in inbox

2. **Externe emails** (Gmail, etc.):
   - ✅ Gebruiken Mailgun SMTP
   - ✅ Betere deliverability
   - ✅ Komen aan in inbox

---

## ❓ Vragen

**Vraag 1: Is server herstart?**
- Ja → Test nu
- Nee → Herstart eerst

**Vraag 2: Wat zie je in logs?**
- "Mijndomein" → Perfect! Dual SMTP werkt
- "Mailgun" → Server niet herstart of env vars niet correct
- "NOT SET" → Credentials ontbreken in .env

**Vraag 3: Komt email aan?**
- Ja → Perfect! Alles werkt
- Nee → Check Mijndomein SMTP credentials

---

**Laatste update**: January 2025
