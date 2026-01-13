# Email Verificatie Troubleshooting Guide

## Probleem: E-mails worden niet ontvangen bij registratie

Als je SMTP correct hebt geconfigureerd maar geen e-mails ontvangt, controleer het volgende:

## 1. Check Supabase Email Settings

### 1.1 Email Confirmation Status
Ga naar **Supabase Dashboard** → **Authentication** → **Settings** → **Email Auth**

**Controleer:**
- ✅ Is "Enable email confirmations" **AAN**?
- ✅ Is "Enable email change confirmations" **AAN**?

**Als email confirmation UIT staat:**
- Gebruikers worden direct aangemaakt zonder verificatie
- Geen e-mail wordt verstuurd
- Check de logs: `userConfirmed: 'yes'` betekent dat confirmatie is overgeslagen

### 1.2 SMTP Configuration
Ga naar **Supabase Dashboard** → **Project Settings** → **Auth** → **SMTP Settings**

**Controleer:**
- ✅ SMTP Host is correct (bijv. `smtp.eu.mailgun.org`)
- ✅ SMTP Port is correct (meestal `587` of `465`)
- ✅ SMTP User/Username is correct
- ✅ SMTP Password is correct en niet verlopen
- ✅ Sender Email is correct (moet bestaan in je SMTP account)
- ✅ Sender Name is ingesteld

**Test SMTP:**
- Klik op "Test SMTP" in Supabase Dashboard
- Controleer of de test e-mail aankomt

### 1.3 Site URL Configuration
Ga naar **Supabase Dashboard** → **Project Settings** → **API**

**Controleer:**
- ✅ Site URL is correct ingesteld (bijv. `https://jouw-domein.nl` of `http://localhost:3000` voor development)
- ✅ Redirect URLs bevatten je verify-email route

**Redirect URLs moeten bevatten:**
```
http://localhost:3000/auth/verify-email
https://jouw-domein.nl/auth/verify-email
```

## 2. Check Application Logs

Na registratie, check de logs voor:

```javascript
// Deze log zie je als registratie start
logger.info('Attempting user registration:', {
  email: '...',
  emailRedirectTo: '...'
});

// Deze log zie je na signup
logger.info('Signup response:', {
  hasUser: true/false,
  hasSession: true/false,
  userConfirmed: 'yes'/'no'
});
```

**Wat betekenen de logs?**

- `userConfirmed: 'yes'` → Email confirmatie is UIT in Supabase
- `userConfirmed: 'no'` → Email confirmatie is AAN, maar e-mail is mogelijk niet verstuurd
- `hasSession: true` → Gebruiker heeft direct een sessie (email confirmatie uit)
- `hasSession: false` → Email confirmatie vereist (e-mail zou moeten zijn verstuurd)

## 3. Check Supabase Logs

Ga naar **Supabase Dashboard** → **Logs** → **Auth Logs**

**Zoek naar:**
- Email sending errors
- SMTP connection errors
- Authentication errors

**Veelvoorkomende errors:**
- `SMTP connection failed` → SMTP credentials zijn incorrect
- `Invalid sender email` → Sender email bestaat niet in je SMTP account
- `Rate limit exceeded` → Te veel e-mails in korte tijd

## 4. Check Email Provider

### 4.1 Spam Folder
- ✅ Check je spam/junk folder
- ✅ Check je "All Mail" folder (Gmail)
- ✅ Check "Promotions" tab (Gmail)
- ✅ Zoek naar "noreply@growsocialmedia.nl" of "Bevestig je e-mailadres"

### 4.2 Mailgun Specific (als je Mailgun gebruikt)

**Als je "accepted" ziet in Mailgun logs:**
De email is succesvol verstuurd door Supabase naar Mailgun. Het probleem ligt bij de delivery.

**Check Mailgun Delivery Status:**
1. Ga naar **Mailgun Dashboard** → **Sending** → **Logs**
2. Zoek je email op basis van:
   - Recipient (iris@growsocialmedia.nl)
   - Subject ("Bevestig je e-mailadres")
   - Timestamp
3. Check de **event status**:
   - ✅ `accepted` = Email geaccepteerd door Mailgun (SUCCES)
   - ✅ `delivered` = Email afgeleverd aan inbox (SUCCES)
   - ⚠️ `bounced` = Email afgewezen door ontvanger's server
   - ⚠️ `failed` = Email delivery gefaald
   - ⚠️ `complained` = Ontvanger heeft als spam gemarkeerd

**Check Domain Status:**
- ✅ Ga naar **Mailgun Dashboard** → **Sending** → **Domains** → **growsocialmedia.nl**
- ✅ Check of domain **niet** in "Sandbox Mode" staat
- ✅ Check "Authorized Recipients" als je in Sandbox Mode bent
- ✅ Check DNS records (SPF, DKIM, MX) zijn correct ingesteld

**Check Mailgun Suppressions:**
- ✅ Ga naar **Mailgun Dashboard** → **Sending** → **Suppressions**
- ✅ Check of het email adres niet op een suppression list staat
- ✅ Check "Bounces", "Unsubscribes", "Complaints"

**Mailgun Delivery Delays:**
- ⏱️ Emails kunnen 1-5 minuten duren om afgeleverd te worden
- ⏱️ Check logs na 5 minuten voor "delivered" event

### 4.3 Rate Limits
- ✅ Check of je niet te veel e-mails verstuurt
- ✅ Wacht 1-2 minuten tussen test registraties
- ✅ Check Mailgun Dashboard → **Sending** → **Overview** voor rate limits

## 5. Email Template Issues

Ga naar **Supabase Dashboard** → **Authentication** → **Email Templates**

**Controleer "Confirm signup" template:**
- ✅ Template bestaat en is niet leeg
- ✅ `{{ .ConfirmationURL }}` is aanwezig in de template
- ✅ Template is correct geconfigureerd

**Test template:**
- Gebruik de "Preview" functie in Supabase
- Controleer of de preview er goed uitziet

## 6. Common Issues & Solutions

### Issue: Email confirmation is disabled
**Symptoom:** `userConfirmed: 'yes'` in logs, gebruiker kan direct inloggen

**Oplossing:**
1. Ga naar Supabase Dashboard → Authentication → Settings
2. Zet "Enable email confirmations" **AAN**
3. Test opnieuw

### Issue: SMTP credentials incorrect
**Symptoom:** Errors in Supabase Auth Logs over SMTP

**Oplossing:**
1. Verifieer SMTP credentials in Supabase Dashboard
2. Test SMTP verbinding met "Test SMTP" knop
3. Reset SMTP password als nodig

### Issue: Site URL mismatch
**Symptoom:** E-mails worden verstuurd maar links werken niet

**Oplossing:**
1. Controleer Site URL in Supabase Settings
2. Zorg dat redirect URLs correct zijn ingesteld
3. Gebruik HTTPS in productie

### Issue: Email in spam
**Symptoom:** E-mails worden verstuurd maar komen niet aan in inbox

**Oplossing:**
1. Check SPF/DKIM records voor je domein
2. Configureer SPF record: `v=spf1 include:mailgun.org ~all`
3. Configureer DKIM via je email provider
4. Vraag gebruikers om je sender email toe te voegen aan contacten

## 7. Debugging Steps

### Stap 1: Check logs na registratie
```bash
# Check de application logs
tail -f logs/combined.log | grep "Registration\|Signup"
```

### Stap 2: Test SMTP direct
1. Ga naar Supabase Dashboard → Project Settings → Auth → SMTP Settings
2. Klik op "Test SMTP"
3. Controleer of test e-mail aankomt

### Stap 3: Test email template
1. Ga naar Supabase Dashboard → Authentication → Email Templates
2. Selecteer "Confirm signup"
3. Klik op "Preview"
4. Controleer of template correct is

### Stap 4: Check Supabase Auth Settings
1. Ga naar Supabase Dashboard → Authentication → Settings
2. Controleer alle email gerelateerde settings
3. Zorg dat alles correct is ingesteld

## 8. Test Scenario

Voer deze test uit om te debuggen:

1. **Registreer een nieuwe gebruiker**
   ```bash
   # Gebruik een test email die je kunt controleren
   ```

2. **Check application logs**
   ```bash
   # Zoek naar "Signup response" log
   # Noteer: hasUser, hasSession, userConfirmed
   ```

3. **Check Supabase Auth Logs**
   ```bash
   # Ga naar Supabase Dashboard → Logs → Auth Logs
   # Zoek naar errors of email sending events
   ```

4. **Check email provider logs**
   ```bash
   # Als je Mailgun gebruikt: check Mailgun Dashboard → Logs
   # Als je andere provider gebruikt: check hun logs
   ```

5. **Check inbox (en spam)**
   ```bash
   # Controleer alle folders
   ```

## 9. Quick Fixes

### Fix 1: Herstel SMTP configuratie
```bash
# Ga naar Supabase Dashboard
# Project Settings → Auth → SMTP Settings
# Reset credentials en test opnieuw
```

### Fix 2: Enable email confirmation
```bash
# Ga naar Supabase Dashboard
# Authentication → Settings → Email Auth
# Zet "Enable email confirmations" AAN
```

### Fix 3: Update Site URL
```bash
# Ga naar Supabase Dashboard
# Project Settings → API
# Update Site URL naar je correcte domain
```

### Fix 4: Als Mailgun "accepted" toont maar email niet aankomt

**Stap 1: Check Mailgun Delivery Logs**
```bash
# Ga naar Mailgun Dashboard → Sending → Logs
# Zoek op recipient email adres
# Check of er een "delivered" event is na "accepted"
```

**Stap 2: Als er GEEN "delivered" event is:**
- Check of het email adres op een suppression list staat
- Check of het email adres geldig is
- Wacht 5-10 minuten (delivery kan vertraagd zijn)
- Check bounce logs in Mailgun

**Stap 3: Als er WEL "delivered" event is:**
- Email is afgeleverd aan de ontvanger's email server
- Check spam folder in de email client
- Check email filters/regels
- Vraag de ontvanger om te zoeken naar "Bevestig je e-mailadres" of "noreply@growsocialmedia.nl"

**Stap 4: Check Email Server Status**
- Als je @growsocialmedia.nl gebruikt, check of de email server correct is ingesteld
- Check MX records voor growsocialmedia.nl
- Test of je emails KUNT ontvangen op dat adres

**Stap 5: Test met ander email adres**
- Probeer registratie met een Gmail of ander email adres
- Als dat WEL werkt → probleem met growsocialmedia.nl email server
- Als dat OOK niet werkt → probleem met Mailgun delivery of DNS

## 10. Contact & Support

Als niets werkt:
1. Check Supabase Status: https://status.supabase.com
2. Check Supabase Docs: https://supabase.com/docs/guides/auth/auth-email-templates
3. Check Supabase GitHub Issues: https://github.com/supabase/supabase/issues

Voor applicatie-specifieke vragen:
- Check application logs: `logs/combined.log`
- Check error logs: `logs/error.log`

