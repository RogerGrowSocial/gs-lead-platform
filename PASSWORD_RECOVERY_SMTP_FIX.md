# Password Recovery Email Fix - SMTP Configuratie

## Probleem

Bij het aanvragen van een password reset krijg je de volgende error:
```
Failed to send password recovery: Failed to make POST request to "https://haxwrebdksawioivhlmh.supabase.co/auth/v1/recover". 
Check your project's Auth logs for more information. 
Error message: Error sending recovery email
```

## Oorzaak

Deze error betekent dat Supabase Auth **geen SMTP configuratie heeft** of de SMTP configuratie **incorrect is**. Supabase kan daardoor geen emails versturen voor password recovery.

## Oplossing: Configureer SMTP in Supabase Dashboard

**BELANGRIJK**: Voor een complete, professionele SMTP setup die altijd werkt en niet in spam komt, volg de **`COMPLETE_SMTP_SETUP.md`** guide. Deze guide bevat:
- Complete Mailgun configuratie
- DNS records (SPF, DKIM, DMARC) voor perfecte deliverability
- Supabase SMTP configuratie
- Best practices om niet in spam te komen

### Stap 1: Ga naar Supabase SMTP Settings

1. Log in op **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecteer je project (`haxwrebdksawioivhlmh`)
3. Ga naar **Project Settings** (⚙️ icoon linksonder)
4. Klik op **Auth** in het linker menu
5. Scroll naar **SMTP Settings** sectie

### Stap 2: Configureer Mailgun SMTP

Vul de volgende SMTP instellingen in:

**Zie `COMPLETE_SMTP_SETUP.md` voor volledige configuratie met DNS records en best practices.**

#### SMTP Host
```
smtp.eu.mailgun.org
```

#### SMTP Port
```
587
```

#### SMTP Username
```
postmaster@growsocialmedia.nl
```

#### SMTP Password
⚠️ **BELANGRIJK**: Haal het SMTP password op uit je Mailgun Dashboard:
1. Ga naar https://app.mailgun.com/
2. Selecteer je domain (`growsocialmedia.nl`)
3. Ga naar **Sending** → **Domain Settings**
4. Scroll naar **SMTP credentials**
5. Kopieer het **SMTP password** (niet de API key!)

#### Sender Email
```
notificaties@growsocialmedia.nl
```
of
```
noreply@growsocialmedia.nl
```

#### Sender Name
```
GrowSocial
```

### Stap 3: Test SMTP Verbinding

1. Klik op de **"Test SMTP"** knop in Supabase Dashboard
2. Voer een test email adres in
3. Klik op **"Send test email"**
4. Controleer of de test email aankomt

**Als de test faalt:**
- ✅ Verifieer dat het SMTP password correct is (kopieer opnieuw uit Mailgun)
- ✅ Check of `postmaster@growsocialmedia.nl` bestaat in Mailgun
- ✅ Verifieer dat je Mailgun domain niet in "Sandbox Mode" staat
- ✅ Check Mailgun Dashboard → Sending → Logs voor errors

### Stap 4: Verifieer Site URL

1. Blijf in **Project Settings** → **API**
2. Controleer de **Site URL**:
   - Voor productie: `https://jouw-domein.nl`
   - Voor development: `http://localhost:3000`
3. Zorg dat de Site URL correct is ingesteld

### Stap 5: Check Redirect URLs

1. In **Project Settings** → **Auth** → **URL Configuration**
2. Controleer **Redirect URLs** bevat:
   ```
   https://jouw-domein.nl/auth/reset-password
   http://localhost:3000/auth/reset-password
   ```

### Stap 6: Verifieer Email Template

1. Ga naar **Authentication** → **Email Templates**
2. Selecteer **"Reset password"** template
3. Controleer dat:
   - ✅ Template bestaat en niet leeg is
   - ✅ `{{ .ConfirmationURL }}` is aanwezig
   - ✅ Template is correct geconfigureerd

## Test de Fix

Na het configureren van SMTP:

1. Ga naar je login pagina
2. Klik op **"Wachtwoord vergeten?"**
3. Voer een email adres in
4. Klik op **"Verstuur reset link"**
5. Check je inbox (en spam folder) voor de password reset email

## Troubleshooting

### Probleem: SMTP test faalt met "Authentication failed"

**Oplossing:**
- Het SMTP password is incorrect
- Haal het password opnieuw op uit Mailgun Dashboard
- Zorg dat je het **SMTP password** gebruikt, niet de API key
- Reset het SMTP password in Mailgun als nodig

### Probleem: SMTP test faalt met "Connection timeout"

**Oplossing:**
- Check of `smtp.eu.mailgun.org` bereikbaar is
- Verifieer dat je de EU region gebruikt (niet US)
- Check firewall/network settings

### Probleem: Email komt niet aan na SMTP configuratie

**Oplossing:**
1. Check Supabase Dashboard → **Logs** → **Auth Logs** voor errors
2. Check Mailgun Dashboard → **Sending** → **Logs** voor delivery status
3. Check spam folder
4. Verifieer dat het email adres geldig is

### Probleem: "Error sending recovery email" blijft bestaan

**Oplossing:**
1. ✅ Verifieer dat SMTP **ENABLED** is in Supabase (niet disabled)
2. ✅ Check Supabase Auth Logs voor specifieke error details
3. ✅ Test SMTP opnieuw met "Test SMTP" functie
4. ✅ Controleer of Mailgun domain niet in Sandbox Mode staat
5. ✅ Verifieer dat Mailgun SMTP credentials niet zijn veranderd

## Mailgun SMTP Credentials Ophalen

### Stap 1: Log in op Mailgun
1. Ga naar https://app.mailgun.com/
2. Log in met je credentials

### Stap 2: Selecteer Domain
1. Klik op **Sending** in het linker menu
2. Selecteer je domain (`growsocialmedia.nl`)

### Stap 3: Haal SMTP Credentials Op
1. Klik op **Domain Settings** tab
2. Scroll naar **SMTP credentials** sectie
3. Je ziet:
   - **SMTP hostname**: `smtp.eu.mailgun.org`
   - **Port**: `587` (of `465` voor SSL)
   - **Username**: `postmaster@growsocialmedia.nl`
   - **Password**: Klik op **"Show"** of **"Reset"** om het password te zien

### Stap 4: Kopieer Password
⚠️ **BELANGRIJK**: 
- Kopieer het **SMTP password** (niet de API key!)
- Het password is meestal een lange string van letters en cijfers
- Als je het password niet ziet, klik op **"Reset"** om een nieuw password te genereren

## Verificatie Checklist

Voordat je de password recovery opnieuw test, controleer:

- [ ] SMTP is geconfigureerd in Supabase Dashboard
- [ ] SMTP test email is succesvol verzonden
- [ ] Site URL is correct ingesteld
- [ ] Redirect URLs bevatten `/auth/reset-password`
- [ ] "Reset password" email template bestaat
- [ ] Mailgun domain is niet in Sandbox Mode
- [ ] SMTP password is correct gekopieerd (niet API key)

## Extra Resources

- **Supabase SMTP Docs**: https://supabase.com/docs/guides/auth/auth-smtp
- **Mailgun SMTP Docs**: https://documentation.mailgun.com/en/latest/user_manual.html#sending-via-smtp
- **Email Troubleshooting Guide**: `EMAIL_VERIFICATION_TROUBLESHOOTING.md`
- **Email Setup Guide**: `SUPABASE_EMAIL_SETUP.md`

## Contact

Als het probleem blijft bestaan na het volgen van deze stappen:
1. Check Supabase Dashboard → **Logs** → **Auth Logs** voor specifieke errors
2. Check Mailgun Dashboard → **Sending** → **Logs** voor delivery status
3. Neem contact op met support met de error logs
