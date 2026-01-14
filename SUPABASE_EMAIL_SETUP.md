# Supabase Email Templates - Setup Guide

## Overzicht

Dit bestand bevat instructies voor het configureren van custom email templates in Supabase voor:
- Email verificatie (signup confirmation)
- Wachtwoord reset

## Templates Beschikbaar

- `supabase-confirm-signup.html` - Email verificatie template
- `supabase-reset-password.html` - Wachtwoord reset template

## Stap 1: Supabase Dashboard Configuratie

### 1.1 Ga naar Supabase Dashboard

1. Log in op je Supabase Dashboard: https://supabase.com/dashboard
2. Selecteer je project
3. Ga naar **Authentication** → **Email Templates**

### 1.2 Configureer Email Verificatie Template

1. Klik op **"Confirm signup"** template
2. Kopieer de volledige HTML uit `supabase-confirm-signup.html`
3. Plak deze in de **"Message Body"** sectie
4. **Belangrijk**: Vervang `{{ .ConfirmationURL }}` door de Supabase variable:
   ```
   {{ .ConfirmationURL }}
   ```
   (Dit is de standaard Supabase variable voor de verificatie link)

5. **Subject line** (optioneel):
   ```
   Verifieer je e-mailadres - GrowSocial
   ```

### 1.3 Configureer Wachtwoord Reset Template

1. Klik op **"Reset password"** template
2. Kopieer de volledige HTML uit `supabase-reset-password.html`
3. Plak deze in de **"Message Body"** sectie
4. **Belangrijk**: Vervang `{{ .ConfirmationURL }}` door de Supabase variable:
   ```
   {{ .ConfirmationURL }}
   ```
   (Dit is de standaard Supabase variable voor de reset link)

5. **Subject line** (optioneel):
   ```
   Wachtwoord resetten - GrowSocial
   ```

## Stap 2: Supabase Variables

Supabase gebruikt Go template syntax. De beschikbare variables zijn:

### Voor Email Verificatie:
- `{{ .ConfirmationURL }}` - De verificatie link
- `{{ .Email }}` - Het email adres van de gebruiker
- `{{ .Token }}` - Het verificatie token (meestal niet nodig)
- `{{ .TokenHash }}` - Hash van het token (meestal niet nodig)
- `{{ .SiteURL }}` - De base URL van je site

### Voor Wachtwoord Reset:
- `{{ .ConfirmationURL }}` - De reset link
- `{{ .Email }}` - Het email adres van de gebruiker
- `{{ .Token }}` - Het reset token (meestal niet nodig)
- `{{ .TokenHash }}` - Hash van het token (meestal niet nodig)
- `{{ .SiteURL }}` - De base URL van je site

## Stap 3: Test de Templates

### 3.1 Test Email Verificatie

1. Maak een nieuwe gebruiker aan in je app
2. Check de inbox van het email adres
3. Verifieer dat de email er mooi uitziet
4. Klik op de verificatie link
5. Controleer of de link werkt

### 3.2 Test Wachtwoord Reset

1. Ga naar je login pagina
2. Klik op "Wachtwoord vergeten?"
3. Voer een email adres in
4. Check de inbox
5. Verifieer dat de email er mooi uitziet
6. Klik op de reset link
7. Controleer of de link werkt

## Stap 4: Aanpassingen (Optioneel)

### 4.1 Kleuren Aanpassen

Als je de kleuren wilt aanpassen, zoek naar deze waarden in de HTML:
- Primary color: `#ea5d0d` (oranje)
- Dark orange: `#c24c0b`
- Background: `#f9fafb`
- Text: `#111827`

### 4.2 Logo Configuratie

Het logo wordt automatisch geladen vanaf `{{ .SiteURL }}/img/gs-logo-oranje.jpg`.

**Belangrijk**: Zorg ervoor dat:
1. Je **Site URL** correct is ingesteld in Supabase Dashboard → **Settings** → **API** → **Site URL**
   - Production: `https://app.growsocialmedia.nl`
   - Development: `http://localhost:3000`
2. Het logo bestand beschikbaar is op je publieke URL: `https://app.growsocialmedia.nl/img/gs-logo-oranje.jpg`

Als je logo niet laadt, kun je ook een absolute URL gebruiken:
```html
<img src="https://app.growsocialmedia.nl/img/gs-logo-oranje.jpg" alt="GrowSocial" class="logo-image">
```

### 4.3 Contact Informatie Aanpassen

Pas de footer sectie aan met je eigen contact informatie:
```html
<strong>GrowSocial B.V.</strong><br>
Jouw Adres<br>
BTW: Jouw BTW | KvK: Jouw KvK<br>
Tel: Jouw Telefoon | Email: jouw@email.nl
```

## Stap 5: Email Provider Setup

### 5.1 Custom SMTP (Aanbevolen)

Voor productie gebruik je best een custom SMTP provider:

1. Ga naar **Project Settings** → **Auth** → **SMTP Settings**
2. Configureer je SMTP instellingen:
   - **SMTP Host**: `smtp.eu.mailgun.org` (EU region voor GDPR compliance)
   - **SMTP Port**: `587` (STARTTLS)
   - **SMTP User**: `postmaster@growsocialmedia.nl`
   - **SMTP Password**: Je Mailgun SMTP password (zie COMPLETE_SMTP_SETUP.md)
   - **Sender Email**: `noreply@growsocialmedia.nl`
   - **Sender Name**: `GrowSocial`

**BELANGRIJK**: 
- Gebruik **EU region** (`smtp.eu.mailgun.org`) voor GDPR compliance
- Het SMTP password moet worden aangemaakt in Mailgun Dashboard → Domain Settings → SMTP credentials
- Zie `COMPLETE_SMTP_SETUP.md` voor volledige configuratie instructies

### 5.2 Site URL Configuratie

1. Ga naar **Project Settings** → **API**
2. Stel **Site URL** in:
   - Production: `https://app.growsocialmedia.nl`
   - Development: `http://localhost:3000`

### 5.3 Redirect URLs

1. Ga naar **Project Settings** → **Auth** → **URL Configuration**
2. Voeg toe aan **Redirect URLs**:
   ```
   https://app.growsocialmedia.nl/auth/verify-email
   https://app.growsocialmedia.nl/auth/reset-password
   https://app.growsocialmedia.nl/auth/callback
   http://localhost:3000/auth/verify-email
   http://localhost:3000/auth/reset-password
   http://localhost:3000/auth/callback
   ```

### 5.4 SPF/DKIM/DMARC Records

Zorg ervoor dat je SPF, DKIM en DMARC records correct zijn ingesteld bij je DNS provider voor betere email deliverability en om niet in spam te komen.

**Zie `COMPLETE_SMTP_SETUP.md` voor volledige DNS records configuratie.**

## Troubleshooting

### Probleem: Email wordt niet verstuurd
**Oplossing:**
- Check je SMTP settings in Supabase
- Verifieer je SMTP credentials
- Check je spam folder
- Controleer Supabase logs voor errors

### Probleem: Links werken niet
**Oplossing:**
- Verifieer dat `{{ .ConfirmationURL }}` correct is gebruikt
- Check je Site URL in Supabase settings
- Zorg dat je redirect URLs correct zijn ingesteld

### Probleem: Email styling ziet er raar uit
**Oplossing:**
- Test de email in verschillende email clients (Gmail, Outlook, etc.)
- Gebruik inline CSS waar mogelijk
- Test op mobile devices
- Overweeg een email testing tool zoals Litmus of Email on Acid

## Best Practices

1. **Test altijd eerst** - Test emails in verschillende email clients
2. **Mobile responsive** - Zorg dat emails er goed uitzien op mobile
3. **Accessibility** - Gebruik goede contrasten en leesbare fonts
4. **Security** - Nooit gevoelige informatie in emails
5. **Branding** - Zorg voor consistente branding met je website
6. **Fallback** - Zorg altijd voor een tekst alternatief voor de link

## Extra Email Templates

Je kunt ook andere Supabase email templates customizen:
- **Change Email Address** - Voor email wijzigingen
- **Magic Link** - Voor passwordless login
- **Invite User** - Voor team uitnodigingen

Deze templates kun je op dezelfde manier configureren als hierboven beschreven.

## Contact

Voor vragen over email templates of Supabase configuratie:
- Check Supabase docs: https://supabase.com/docs/guides/auth/auth-email-templates
- Contact: support@growsocialmedia.nl

