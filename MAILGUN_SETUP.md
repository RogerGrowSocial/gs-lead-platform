# Mailgun Setup Guide

## Stap 1: Mailgun Account Aanmaken

1. Ga naar https://www.mailgun.com/
2. Maak een gratis account aan (5,000 emails/maand gratis)
3. Verifieer je email adres
4. Log in op het Mailgun dashboard

## Stap 2: Domain Toevoegen aan Mailgun

1. In Mailgun dashboard, ga naar **Sending** → **Domains**
2. Klik op **Add New Domain**
3. Voer je domein in: `growsocialmedia.nl`
4. Selecteer **EU region** (belangrijk voor GDPR compliance)
5. Klik op **Add Domain**

## Stap 3: DNS Records Toevoegen in Mijndomein

Mailgun geeft je DNS records die je moet toevoegen:

1. **SPF Record** (TXT):
   ```
   v=spf1 include:mailgun.org ~all
   ```
   OF als je meerdere services hebt:
   ```
   v=spf1 include:mailgun.org include:spf.mijndomeinhosting.nl include:_spf.wpcloud.com ~all
   ```

2. **DKIM Records** (TXT records - Mailgun geeft je deze):
   - Meerdere DKIM records (meestal 2-3 records)
   - Kopieer deze exact van Mailgun dashboard

3. **DMARC Record** (Optioneel maar aanbevolen):
   ```
   v=DMARC1; p=none; rua=mailto:dmarc@growsocialmedia.nl
   ```

4. **MX Records** (Alleen als je ook emails wilt ontvangen via Mailgun):
   - Volg de Mailgun instructies voor MX records

**Na het toevoegen van DNS records:**
- Wacht 5-60 minuten voor DNS propagation
- Check in Mailgun dashboard of alle records zijn geverifieerd (groene vinkjes)

## Stap 4: Mailgun SMTP Credentials Ophalen

1. In Mailgun dashboard, ga naar **Sending** → **Domain Settings**
2. Klik op je domein: `growsocialmedia.nl`
3. Scroll naar beneden naar **SMTP credentials** sectie
4. Je ziet:
   - **SMTP Hostname**: `smtp.eu.mailgun.org` (voor EU region) of `smtp.mailgun.org` (voor US)
   - **Ports**: 25, 587 (STARTTLS), 2525, 465 (SSL/TLS)

5. **BELANGRIJK: Maak een SMTP Password aan:**
   - In de SMTP credentials sectie, klik op **Add password** (of **Create password**)
   - Geef het een naam (bijv. "GrowSocial Platform")
   - Kopieer het SMTP password **direct** - je kunt het maar één keer zien!
   - Bewaar dit password veilig (niet je Mijndomein wachtwoord!)

6. **Username:**
   - Gebruik je **volledige email adres**: `brad@growsocialmedia.nl` (of welk email je ook wilt gebruiken)
   - Mailgun accepteert alleen volledige email adressen als username

7. **Wat NIET te gebruiken:**
   - ❌ Je Mijndomein email wachtwoord
   - ❌ Je Mailgun account wachtwoord
   - ❌ Je Mailgun API key (voor SMTP moet je een SMTP password aanmaken)

## Stap 5: Mailbox Toevoegen in GrowSocial Platform

1. Ga naar `/admin/mail/settings`
2. Klik op **Mailbox toevoegen**
3. Vul in:
   - **Email**: `info@growsocialmedia.nl` (of je gewenste email)
   - **IMAP Host**: `imap.mijndomein.nl` (of je huidige IMAP server voor ontvangen)
   - **IMAP Port**: `993`
   - **IMAP Secure**: ✅ Aan
   - **SMTP Host**: `smtp.eu.mailgun.org` (of `smtp.mailgun.org` voor US region)
   - **SMTP Port**: `587` (STARTTLS) of `465` (SSL)
   - **SMTP Secure**: 
     - ✅ Aan voor poort 465 (SSL)
     - ❌ Uit voor poort 587 (STARTTLS)
   - **Gebruikersnaam**: Je Mailgun SMTP login (of gebruik `api` voor API key methode)
   - **Wachtwoord**: Je Mailgun SMTP wachtwoord OF je API key

## Stap 6: Mailgun Configuratie (Code Side)

Er zijn twee manieren om Mailgun te gebruiken:

### Methode 1: Direct via SMTP (Wat we nu gebruiken)
- Gebruik de SMTP credentials uit Mailgun dashboard
- Werkt direct met je huidige code

### Methode 2: Via Mailgun API (Aanbevolen voor betere features)
- Gebruik de Mailgun API voor meer controle
- Betere error handling en delivery tracking
- Hier kunnen we later naartoe upgraden

## Stap 7: Test Email Verzenden

1. Voeg de mailbox toe zoals hierboven beschreven
2. Ga naar `/admin/mail`
3. Open een email
4. Klik op **Verzenden** voor een AI reply
5. Check of de email succesvol wordt verzonden

## Environment Variables (Optioneel)

Als je later API access wilt (voor advanced features), voeg toe aan `.env`:

```bash
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MAILGUN_DOMAIN=growsocialmedia.nl
MAILGUN_REGION=eu  # of 'us' voor US region
```

## Troubleshooting

### SPF Errors
- Check of alle DNS records correct zijn toegevoegd in Mijndomein
- Wacht minstens 30-60 minuten na DNS aanpassing
- Test je SPF record op: https://mxtoolbox.com/spf.aspx

### Authentication Errors
- Double-check je SMTP credentials in Mailgun dashboard
- Zorg dat je de juiste region gebruikt (`eu` vs `us`)
- Probeer beide poorten: 587 (STARTTLS) en 465 (SSL)

### Delivery Issues
- Check Mailgun dashboard → **Sending** → **Logs** voor delivery status
- Mailgun geeft gedetailleerde logs over elke email

## Voordelen van Mailgun

✅ **Betrouwbaarheid**: 99.99% uptime SLA
✅ **Delivery Tracking**: Zie welke emails zijn bezorgd
✅ **Analytics**: Open rates, click rates, bounces
✅ **Scalability**: Betaal alleen voor wat je gebruikt (na gratis tier)
✅ **API Access**: Bouw advanced features (later)
✅ **SPF/DKIM/DMARC**: Volledig geconfigureerd

## Kosten

- **Gratis Tier**: 5,000 emails/maand voor eerste 3 maanden
- **Foundation Plan**: $35/maand voor 50,000 emails
- **Pay-as-you-go**: $0.80 per 1,000 emails

Je kunt makkelijk binnen de gratis tier blijven voor normaal gebruik.

