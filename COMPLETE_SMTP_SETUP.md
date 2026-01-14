# Complete SMTP Setup - GrowSocial Platform

## 🎯 Doel

Een complete, professionele SMTP configuratie voor het hele platform die:
- ✅ Altijd betrouwbaar werkt
- ✅ Niet in spam komt
- ✅ Werkt met Supabase Auth
- ✅ Werkt met alle email functionaliteit
- ✅ Gebruikt het domein `app.growsocialmedia.nl`

---

## 📋 Overzicht

Deze setup configureert:
1. **Mailgun** voor email delivery (SMTP)
2. **DNS Records** (SPF, DKIM, DMARC) voor authenticatie
3. **Supabase SMTP** configuratie
4. **Platform email** configuratie
5. **Best practices** voor deliverability

---

## Stap 1: Mailgun Domain Configuratie

### 1.1 Domain Toevoegen in Mailgun

1. Log in op **Mailgun Dashboard**: https://app.mailgun.com/
2. Ga naar **Sending** → **Domains**
3. Klik op **Add New Domain**
4. Voer in: `growsocialmedia.nl` (hoofddomein, niet subdomein)
5. Selecteer **EU region** (belangrijk voor GDPR compliance)
6. Klik op **Add Domain**

**BELANGRIJK**: Mailgun verifieert het **hoofddomein** (`growsocialmedia.nl`), niet het subdomein. Het subdomein `app.growsocialmedia.nl` kan emails versturen zolang het hoofddomein is geverifieerd.

### 1.2 DNS Records Ophalen

Na het toevoegen van het domain, geeft Mailgun je DNS records. Noteer deze:

1. **SPF Record** (TXT)
2. **DKIM Records** (2-3 TXT records)
3. **DMARC Record** (TXT - optioneel maar aanbevolen)

---

## Stap 2: DNS Records Configureren

### 2.1 Ga naar je DNS Provider

Log in op je DNS provider (bijv. Mijndomein, Cloudflare, etc.)

### 2.2 SPF Record (TXT)

**Type**: TXT  
**Name**: `@` (of `growsocialmedia.nl`)  
**Value**: 
```
v=spf1 include:mailgun.org ~all
```

**OF als je meerdere email services gebruikt:**
```
v=spf1 include:mailgun.org include:spf.mijndomeinhosting.nl include:_spf.wpcloud.com ~all
```

**TTL**: 3600 (1 uur)

### 2.3 DKIM Records (TXT)

Mailgun geeft je 2-3 DKIM records. Voeg deze allemaal toe:

**Voorbeeld DKIM Record 1:**
- **Type**: TXT
- **Name**: `mg._domainkey` (of wat Mailgun aangeeft)
- **Value**: `[Mailgun geeft je deze waarde]`
- **TTL**: 3600

**Voorbeeld DKIM Record 2:**
- **Type**: TXT
- **Name**: `k1._domainkey` (of wat Mailgun aangeeft)
- **Value**: `[Mailgun geeft je deze waarde]`
- **TTL**: 3600

**BELANGRIJK**: Kopieer de exacte waarden uit Mailgun Dashboard!

### 2.4 DMARC Record (TXT) - Aanbevolen

**Type**: TXT  
**Name**: `_dmarc`  
**Value**: 
```
v=DMARC1; p=none; rua=mailto:dmarc@growsocialmedia.nl; ruf=mailto:dmarc@growsocialmedia.nl; fo=1
```

**Uitleg**:
- `p=none`: Start met monitoring (geen actie)
- `rua`: Email adres voor aggregate reports
- `ruf`: Email adres voor forensic reports
- `fo=1`: Generate reports voor alle failures

**Later kun je upgraden naar**:
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@growsocialmedia.nl
```
(Quarantine = verdachte emails naar spam)

### 2.5 Verificatie in Mailgun

1. Wacht **15-60 minuten** na het toevoegen van DNS records
2. Ga naar Mailgun Dashboard → **Sending** → **Domains** → `growsocialmedia.nl`
3. Check of alle records **groene vinkjes** hebben
4. Als records nog niet geverifieerd zijn:
   - Check of je de juiste records hebt toegevoegd
   - Wacht langer (DNS propagation kan tot 48 uur duren)
   - Gebruik https://mxtoolbox.com/ om DNS records te verifiëren

---

## Stap 3: Mailgun SMTP Credentials

### 3.1 SMTP Password Aanmaken

1. Ga naar Mailgun Dashboard → **Sending** → **Domains** → `growsocialmedia.nl`
2. Scroll naar **SMTP credentials** sectie
3. Klik op **Add password** (of **Create password**)
4. Geef het een naam: `GrowSocial Platform Production`
5. **KOPIEER HET PASSWORD DIRECT** - je ziet het maar één keer!
6. Bewaar dit password veilig

### 3.2 SMTP Instellingen

**SMTP Host**: `smtp.eu.mailgun.org`  
**SMTP Port**: `587` (STARTTLS) of `465` (SSL)  
**SMTP Username**: `postmaster@growsocialmedia.nl`  
**SMTP Password**: `[Het password dat je net hebt aangemaakt]`  
**Sender Email**: `noreply@growsocialmedia.nl` (of `notificaties@growsocialmedia.nl`)

**BELANGRIJK**: 
- Gebruik **EU region** (`smtp.eu.mailgun.org`) voor GDPR compliance
- Gebruik poort **587** met STARTTLS (niet SSL)
- De username moet een **volledig email adres** zijn van je verified domain

---

## Stap 4: Supabase SMTP Configuratie

### 4.1 Ga naar Supabase Dashboard

1. Log in op **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecteer je project
3. Ga naar **Project Settings** (⚙️ icoon linksonder)
4. Klik op **Auth** in het linker menu
5. Scroll naar **SMTP Settings**

### 4.2 Configureer SMTP

Vul de volgende instellingen in:

**Enable Custom SMTP**: ✅ **AAN**

**SMTP Host**: 
```
smtp.eu.mailgun.org
```

**SMTP Port**: 
```
587
```

**SMTP Username**: 
```
postmaster@growsocialmedia.nl
```

**SMTP Password**: 
```
[Het Mailgun SMTP password uit Stap 3.1]
```

**Sender Email**: 
```
noreply@growsocialmedia.nl
```

**Sender Name**: 
```
GrowSocial
```

### 4.3 Test SMTP

1. Klik op **"Test SMTP"** knop
2. Voer een test email adres in
3. Klik op **"Send test email"**
4. Controleer of de test email aankomt

**Als de test faalt:**
- ✅ Verifieer dat het SMTP password correct is
- ✅ Check of `postmaster@growsocialmedia.nl` bestaat in Mailgun
- ✅ Verifieer dat je Mailgun domain **niet in Sandbox Mode** staat
- ✅ Check Mailgun Dashboard → Sending → Logs voor errors

### 4.4 Site URL Configuratie

1. Blijf in **Project Settings** → **API**
2. Stel **Site URL** in:
   - Production: `https://app.growsocialmedia.nl`
   - Development: `http://localhost:3000`

### 4.5 Redirect URLs

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

---

## Stap 5: Environment Variables

Voeg toe aan je `.env` bestand:

```env
# Mailgun SMTP Configuration
MAILGUN_SMTP_HOST=smtp.eu.mailgun.org
MAILGUN_SMTP_PORT=587
MAILGUN_SMTP_USER=postmaster@growsocialmedia.nl
MAILGUN_SMTP_PASS=[Je Mailgun SMTP password]
MAILGUN_DOMAIN=growsocialmedia.nl

# Email From Address
EMAIL_FROM=noreply@growsocialmedia.nl
EMAIL_FROM_NAME=GrowSocial

# App URL
APP_URL=https://app.growsocialmedia.nl
BASE_URL=https://app.growsocialmedia.nl
```

**BELANGRIJK**: 
- Vervang `[Je Mailgun SMTP password]` met het echte password
- Gebruik HTTPS in productie
- Gebruik `http://localhost:3000` voor development

---

## Stap 6: Email Templates Verificatie

### 6.1 Supabase Email Templates

1. Ga naar Supabase Dashboard → **Authentication** → **Email Templates**
2. Controleer de volgende templates:
   - **Confirm signup** - Email verificatie
   - **Reset password** - Wachtwoord reset
   - **Change email address** - Email wijziging
   - **Magic Link** - Passwordless login (als gebruikt)

3. Voor elke template:
   - ✅ Controleer dat `{{ .ConfirmationURL }}` aanwezig is
   - ✅ Controleer dat `{{ .SiteURL }}` correct wordt gebruikt
   - ✅ Test de preview functie

### 6.2 Platform Email Templates

Controleer dat alle email templates in `templates/emails/` correct zijn:
- ✅ Gebruiken `app.growsocialmedia.nl` in links
- ✅ Gebruiken `noreply@growsocialmedia.nl` als sender
- ✅ Hebben correcte branding

---

## Stap 7: Best Practices voor Email Deliverability

### 7.1 SPF Alignment

**CRITICAL**: De "From" email adres **MOET** exact overeenkomen met de SMTP authenticated username voor SPF alignment.

**Goed**:
- SMTP Username: `postmaster@growsocialmedia.nl`
- From Address: `postmaster@growsocialmedia.nl` ✅

**Ook goed**:
- SMTP Username: `postmaster@growsocialmedia.nl`
- From Address: `noreply@growsocialmedia.nl` ✅ (zelfde domain)

**Fout**:
- SMTP Username: `postmaster@growsocialmedia.nl`
- From Address: `noreply@example.com` ❌ (ander domain)

### 7.2 Email Content Best Practices

1. **Subject Lines**:
   - Gebruik duidelijke, beschrijvende subject lines
   - Vermijd spam trigger woorden (FREE, URGENT, etc.)
   - Gebruik je merknaam: "GrowSocial - [Onderwerp]"

2. **Email Body**:
   - Gebruik HTML met inline CSS
   - Voeg altijd een plain text versie toe
   - Gebruik correcte HTML structuur
   - Voeg een unsubscribe link toe (voor marketing emails)

3. **Links**:
   - Gebruik absolute URLs (https://app.growsocialmedia.nl/...)
   - Gebruik HTTPS voor alle links
   - Test alle links voordat je emails verstuurt

4. **Images**:
   - Gebruik hosted images (niet attachments)
   - Gebruik alt text voor alle images
   - Gebruik correcte image URLs

### 7.3 Sender Reputation

1. **Warm-up je domain**:
   - Start met kleine volumes (10-50 emails/dag)
   - Verhoog geleidelijk over 2-4 weken
   - Monitor bounce rates en spam complaints

2. **Monitor je metrics**:
   - Check Mailgun Dashboard → Analytics
   - Monitor: Delivery rate, Open rate, Bounce rate
   - Reageer op spam complaints direct

3. **Maintain clean lists**:
   - Verwijder hard bounces direct
   - Verwijder soft bounces na 3-5 pogingen
   - Respecteer unsubscribe requests

### 7.4 Authentication Records

Zorg dat alle records correct zijn:
- ✅ SPF record is correct en geverifieerd
- ✅ DKIM records zijn correct en geverifieerd
- ✅ DMARC record is ingesteld (start met `p=none`)
- ✅ Alle records hebben groene vinkjes in Mailgun

---

## Stap 8: Verificatie & Testing

### 8.1 DNS Records Verificatie

Test je DNS records met:

1. **SPF Check**: https://mxtoolbox.com/spf.aspx
   - Voer in: `growsocialmedia.nl`
   - Check of SPF record correct is

2. **DKIM Check**: https://mxtoolbox.com/dkim.aspx
   - Voer in: `growsocialmedia.nl`
   - Check of DKIM records correct zijn

3. **DMARC Check**: https://mxtoolbox.com/dmarc.aspx
   - Voer in: `growsocialmedia.nl`
   - Check of DMARC record correct is

4. **MX Toolbox**: https://mxtoolbox.com/SuperTool.aspx
   - Voer in: `growsocialmedia.nl`
   - Check alle records

### 8.2 Email Deliverability Test

1. **Send test emails** naar verschillende providers:
   - Gmail
   - Outlook
   - Yahoo
   - ProtonMail

2. **Check spam folders**:
   - Controleer of emails in inbox komen (niet spam)
   - Check email headers voor SPF/DKIM/DMARC pass

3. **Use email testing tools**:
   - **Mail Tester**: https://www.mail-tester.com/
     - Stuur een email naar het adres dat ze geven
     - Krijg een score (streef naar 10/10)
   - **GlockApps**: https://glockapps.com/
   - **Litmus**: https://www.litmus.com/

### 8.3 Supabase Email Test

1. **Test password reset**:
   - Ga naar login pagina
   - Klik "Wachtwoord vergeten?"
   - Voer email in
   - Check of email aankomt

2. **Test email verification**:
   - Maak een nieuwe gebruiker aan
   - Check of verificatie email aankomt
   - Klik op verificatie link
   - Controleer of link werkt

### 8.4 Platform Email Test

1. **Test welcome email**:
   - Maak een nieuwe gebruiker aan via admin
   - Check of welcome email aankomt

2. **Test notification emails**:
   - Trigger verschillende notificaties
   - Check of emails correct worden verstuurd

---

## Stap 9: Monitoring & Maintenance

### 9.1 Mailgun Monitoring

Check regelmatig:
- **Mailgun Dashboard** → **Sending** → **Logs**
  - Monitor delivery status
  - Check voor bounces
  - Check voor spam complaints

- **Mailgun Dashboard** → **Sending** → **Analytics**
  - Delivery rate (streef naar >95%)
  - Open rate
  - Click rate
  - Bounce rate (streef naar <5%)

### 9.2 Supabase Monitoring

Check regelmatig:
- **Supabase Dashboard** → **Logs** → **Auth Logs**
  - Check voor email sending errors
  - Monitor SMTP connection errors

### 9.3 DNS Records Maintenance

- ✅ Check maandelijks of DNS records nog correct zijn
- ✅ Verifieer dat records niet zijn verlopen
- ✅ Update records als je van email provider verandert

---

## Troubleshooting

### Probleem: Emails komen in spam

**Oplossing**:
1. ✅ Verifieer SPF/DKIM/DMARC records
2. ✅ Check Mailgun Dashboard → Domain status (moet "Active" zijn, niet "Sandbox")
3. ✅ Gebruik Mail Tester om score te checken
4. ✅ Warm-up je domain (start met kleine volumes)
5. ✅ Check email content voor spam triggers

### Probleem: SMTP authentication failed

**Oplossing**:
1. ✅ Verifieer SMTP password is correct
2. ✅ Check of username volledig email adres is
3. ✅ Verifieer dat je EU region gebruikt (`smtp.eu.mailgun.org`)
4. ✅ Test SMTP verbinding met "Test SMTP" in Supabase

### Probleem: DNS records niet geverifieerd

**Oplossing**:
1. ✅ Wacht 15-60 minuten na DNS aanpassing
2. ✅ Verifieer records met MX Toolbox
3. ✅ Check of je de juiste records hebt toegevoegd
4. ✅ Check TTL waarden (gebruik 3600)

### Probleem: Emails worden niet verstuurd

**Oplossing**:
1. ✅ Check Mailgun Dashboard → Logs voor errors
2. ✅ Check Supabase Dashboard → Auth Logs voor errors
3. ✅ Verifieer SMTP configuratie in beide systemen
4. ✅ Test SMTP verbinding
5. ✅ Check of domain niet in Sandbox Mode staat

---

## Checklist

Voordat je live gaat, controleer:

- [ ] Mailgun domain is toegevoegd en geverifieerd
- [ ] SPF record is correct en geverifieerd
- [ ] DKIM records zijn correct en geverifieerd
- [ ] DMARC record is ingesteld
- [ ] Mailgun SMTP password is aangemaakt
- [ ] Supabase SMTP is geconfigureerd
- [ ] Supabase SMTP test is succesvol
- [ ] Site URL is correct ingesteld in Supabase
- [ ] Redirect URLs zijn correct ingesteld
- [ ] Environment variables zijn correct ingesteld
- [ ] Email templates zijn gecontroleerd
- [ ] Test emails zijn verstuurd en aangekomen
- [ ] Email deliverability test is gedaan (Mail Tester)
- [ ] DNS records zijn geverifieerd met MX Toolbox
- [ ] Monitoring is ingesteld

---

## Handige Links

- **Mailgun Dashboard**: https://app.mailgun.com/
- **Supabase Dashboard**: https://supabase.com/dashboard
- **MX Toolbox**: https://mxtoolbox.com/
- **Mail Tester**: https://www.mail-tester.com/
- **SPF Record Checker**: https://mxtoolbox.com/spf.aspx
- **DKIM Record Checker**: https://mxtoolbox.com/dkim.aspx
- **DMARC Record Checker**: https://mxtoolbox.com/dmarc.aspx

---

## Support

Als je problemen hebt:
1. Check de troubleshooting sectie hierboven
2. Check Mailgun Dashboard → Logs
3. Check Supabase Dashboard → Auth Logs
4. Gebruik Mail Tester om email score te checken
5. Verifieer DNS records met MX Toolbox

---

**Domein**: `app.growsocialmedia.nl`  
**Hoofddomein voor Mailgun**: `growsocialmedia.nl`  
**Laatste update**: January 2025
