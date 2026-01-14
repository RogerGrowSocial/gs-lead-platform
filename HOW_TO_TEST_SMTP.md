# Hoe SMTP Testen - Complete Guide

## 🎯 Doel

Deze guide laat je zien hoe je SMTP kunt testen op verschillende manieren:
1. **Supabase SMTP Test** (via Dashboard)
2. **Password Reset Test** (via je platform)
3. **Email Verificatie Test** (via registratie)
4. **Platform Email Test** (via code/API)
5. **Externe Tools** (Mail Tester, etc.)

---

## Methode 1: Supabase SMTP Test (Aanbevolen)

### Stap 1: Ga naar Supabase SMTP Settings

1. Log in op **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecteer je project
3. Ga naar **Project Settings** (⚙️ icoon linksonder)
4. Klik op **Auth** in het linker menu
5. Scroll naar **SMTP Settings**

### Stap 2: Test SMTP

1. Scroll naar beneden in de SMTP Settings pagina
2. Zoek naar **"Test SMTP"** knop (of **"Send test email"** of vergelijkbaar)
3. Klik erop
4. Er opent een popup of formulier

### Stap 3: Voer Test Email In

1. Voer een **test email adres** in waar je toegang toe hebt
   - Bijvoorbeeld: je eigen email adres
   - Of: een test email die je kunt controleren
2. Klik op **"Send test email"** (of **"Test"**)

### Stap 4: Check Resultaat

**Succesvol:**
- ✅ Je ziet een success message: "Test email sent successfully"
- ✅ Check je inbox (en spam folder)
- ✅ Test email komt aan binnen 1-2 minuten

**Gefaald:**
- ❌ Je ziet een error message
- ❌ Error: "SMTP authentication failed"
- ❌ Error: "Connection timeout"
- ❌ Error: "Invalid credentials"

### Stap 5: Troubleshooting (Als Test Faalt)

**Error: "SMTP authentication failed"**
- Check of username volledig email adres is (`info@growsocialmedia.nl`)
- Check of password correct is (moet overeenkomen met .env)
- Check of Mailgun domain status "Active" is (niet "Sandbox")

**Error: "Connection timeout"**
- Check of host is `smtp.eu.mailgun.org` (niet `smtp.mailgun.org`)
- Check of port is `587` (of `465`)
- Check firewall/network settings

**Error: "Invalid credentials"**
- Maak nieuw SMTP password aan in Mailgun
- Update password in Supabase
- Test opnieuw

---

## Methode 2: Password Reset Test (Platform)

### Stap 1: Ga naar Login Pagina

1. Ga naar je platform: `https://app.growsocialmedia.nl/auth/login`
2. Of lokaal: `http://localhost:3000/auth/login`

### Stap 2: Klik op "Wachtwoord Vergeten?"

1. Klik op de link **"Wachtwoord vergeten?"** (of **"Forgot password?"**)
2. Je komt op de forgot password pagina

### Stap 3: Voer Email In

1. Voer een **bestaand email adres** in van een gebruiker in je systeem
2. Klik op **"Verstuur reset link"** (of **"Send reset link"**)

### Stap 4: Check Resultaat

**Succesvol:**
- ✅ Je ziet een success message: "Als dit e-mailadres bestaat, ontvang je een e-mail..."
- ✅ Geen errors in console
- ✅ Check je inbox (en spam folder)
- ✅ Password reset email komt aan binnen 1-2 minuten
- ✅ Email bevat een reset link
- ✅ Reset link werkt wanneer je erop klikt

**Gefaald:**
- ❌ Error message: "Failed to send password recovery"
- ❌ Error: "Error sending recovery email"
- ❌ Geen email ontvangen

### Stap 5: Check Logs (Als Test Faalt)

1. **Supabase Logs:**
   - Ga naar Supabase Dashboard → **Logs** → **Auth Logs**
   - Zoek naar errors rond de tijd dat je de reset aanvroeg
   - Check voor SMTP errors

2. **Mailgun Logs:**
   - Ga naar Mailgun Dashboard → **Sending** → **Logs**
   - Zoek naar emails rond de tijd dat je de reset aanvroeg
   - Check delivery status

3. **Application Logs:**
   - Check je server logs
   - Zoek naar errors in console

---

## Methode 3: Email Verificatie Test (Registratie)

### Stap 1: Maak Nieuwe Gebruiker Aan

1. Ga naar registratie pagina: `https://app.growsocialmedia.nl/auth/signup`
2. Vul registratie formulier in:
   - Email: gebruik een test email die je kunt controleren
   - Wachtwoord: vul een wachtwoord in
   - Andere verplichte velden
3. Klik op **"Registreren"** (of **"Sign up"**)

### Stap 2: Check Resultaat

**Succesvol:**
- ✅ Je ziet een message: "Check je email voor verificatie"
- ✅ Check je inbox (en spam folder)
- ✅ Verificatie email komt aan binnen 1-2 minuten
- ✅ Email bevat een verificatie link
- ✅ Verificatie link werkt wanneer je erop klikt

**Gefaald:**
- ❌ Geen email ontvangen
- ❌ Error tijdens registratie
- ❌ Verificatie link werkt niet

### Stap 3: Verifieer Email

1. Open de verificatie email
2. Klik op de verificatie link
3. Je wordt doorgestuurd naar verificatie pagina
4. Controleer of verificatie succesvol is

---

## Methode 4: Platform Email Service Test (Code)

### Stap 1: Maak Test Script

Maak een test script om de email service te testen:

```javascript
// test-email-service.js
require('dotenv').config();
const EmailService = require('./services/emailService');

async function testEmailService() {
  const emailService = new EmailService();
  
  const testEmail = {
    to: 'jouw-test-email@gmail.com', // Vervang met je eigen email
    subject: 'Test Email - GrowSocial Platform',
    html: `
      <h1>Test Email</h1>
      <p>Dit is een test email van het GrowSocial platform.</p>
      <p>Als je deze email ontvangt, werkt SMTP correct!</p>
    `
  };
  
  console.log('📧 Sending test email...');
  const result = await emailService.sendEmail(testEmail);
  
  if (result) {
    console.log('✅ Email sent successfully!');
  } else {
    console.log('❌ Email failed to send');
  }
}

testEmailService().catch(console.error);
```

### Stap 2: Run Test Script

```bash
node test-email-service.js
```

### Stap 3: Check Resultaat

**Succesvol:**
- ✅ Console toont: "Email sent successfully"
- ✅ Check je inbox
- ✅ Test email komt aan

**Gefaald:**
- ❌ Console toont errors
- ❌ Geen email ontvangen

---

## Methode 5: Externe Tools Test

### 5.1 Mail Tester (Aanbevolen)

**Doel**: Test email deliverability en spam score

1. **Ga naar Mail Tester**: https://www.mail-tester.com/
2. **Kopieer het test email adres** dat ze geven
   - Bijvoorbeeld: `test-xxxxx@mail-tester.com`
3. **Stuur een email** naar dit adres:
   - Via Supabase test functie
   - Via password reset
   - Via je platform email service
4. **Ga terug naar Mail Tester**
5. **Klik op "Then check your score"**
6. **Check je score**:
   - ✅ **10/10**: Perfect!
   - ✅ **8-9/10**: Goed
   - ⚠️ **6-7/10**: Acceptabel, maar kan beter
   - ❌ **<6/10**: Problemen, moet worden opgelost

**Wat te checken:**
- ✅ SPF: Pass
- ✅ DKIM: Pass
- ✅ DMARC: Pass (als ingesteld)
- ✅ Geen spam triggers
- ✅ Correcte email headers

**Als score laag is:**
- Check de details op Mail Tester
- Los alle issues op
- Test opnieuw

---

### 5.2 MX Toolbox - SMTP Test

**Doel**: Test SMTP verbinding direct

1. **Ga naar MX Toolbox**: https://mxtoolbox.com/SuperTool.aspx
2. **Selecteer "SMTP Test"** in dropdown
3. **Voer in**:
   - SMTP Server: `smtp.eu.mailgun.org`
   - Port: `587`
   - Username: `info@growsocialmedia.nl`
   - Password: [Je Mailgun SMTP password]
4. **Klik op "Test"**
5. **Check resultaat**:
   - ✅ Connection successful
   - ❌ Connection failed

---

## Methode 6: Mailgun Dashboard Test

### Stap 1: Ga naar Mailgun Dashboard

1. Log in op **Mailgun Dashboard**: https://app.mailgun.com/
2. Ga naar **Sending** → **Domains** → `growsocialmedia.nl`

### Stap 2: Check Logs

1. Ga naar **Sending** → **Logs**
2. Filter op:
   - **Recipient**: je test email adres
   - **Time range**: laatste 24 uur
3. Check delivery status:
   - ✅ **Accepted**: Email geaccepteerd door Mailgun
   - ✅ **Delivered**: Email afgeleverd aan inbox
   - ⚠️ **Bounced**: Email afgewezen
   - ⚠️ **Failed**: Email delivery gefaald
   - ⚠️ **Complained**: Ontvanger heeft als spam gemarkeerd

### Stap 3: Check Domain Status

1. Ga naar **Sending** → **Domains** → `growsocialmedia.nl`
2. Check **Domain status**:
   - ✅ **Active**: Perfect
   - ⚠️ **Sandbox**: Kan alleen naar geautoriseerde ontvangers
   - ❌ **Unverified**: DNS records niet correct

---

## Troubleshooting

### Probleem: Test Email Komt Niet Aan

**Oplossing:**
1. ✅ Check spam folder
2. ✅ Check Mailgun Dashboard → Logs voor delivery status
3. ✅ Check Supabase Dashboard → Logs → Auth Logs voor errors
4. ✅ Verifieer DNS records zijn correct
5. ✅ Check Mailgun domain status is "Active"

---

### Probleem: SMTP Test Faalt in Supabase

**Oplossing:**
1. ✅ Verifieer username is volledig email adres
2. ✅ Verifieer password is correct
3. ✅ Check host is `smtp.eu.mailgun.org`
4. ✅ Check port is `587`
5. ✅ Check Mailgun domain status is "Active"
6. ✅ Maak nieuw SMTP password aan als nodig

---

### Probleem: Password Reset Email Komt Niet Aan

**Oplossing:**
1. ✅ Check of gebruiker bestaat in systeem
2. ✅ Check Supabase Dashboard → Logs → Auth Logs
3. ✅ Check Mailgun Dashboard → Logs
4. ✅ Test met Supabase SMTP test functie eerst
5. ✅ Verifieer SMTP configuratie is correct

---

## Test Checklist

Gebruik deze checklist om alle tests uit te voeren:

- [ ] **Supabase SMTP Test**: Uitgevoerd en succesvol
- [ ] **Password Reset Test**: Uitgevoerd en email ontvangen
- [ ] **Email Verificatie Test**: Uitgevoerd en email ontvangen
- [ ] **Mail Tester**: Score 8/10 of hoger
- [ ] **Mailgun Logs**: Emails worden geaccepteerd en afgeleverd
- [ ] **Supabase Logs**: Geen SMTP errors
- [ ] **Spam Folder**: Geen emails in spam (alleen in inbox)

---

## Handige Links

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Mailgun Dashboard**: https://app.mailgun.com/
- **Mail Tester**: https://www.mail-tester.com/
- **MX Toolbox**: https://mxtoolbox.com/SuperTool.aspx

---

**Laatste update**: January 2025
