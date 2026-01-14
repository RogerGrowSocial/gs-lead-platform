# DNS Records Verificatie Checklist

## 🎯 Doel

Deze checklist helpt je om alle DNS records te verifiëren voor een perfecte email deliverability.

---

## Stap 1: DNS Records Toevoegen

### 1.1 SPF Record

**Type**: TXT  
**Name**: `@` (of `growsocialmedia.nl`)  
**Value**: 
```
v=spf1 include:mailgun.org ~all
```

**Verificatie**:
- [ ] Record is toegevoegd in DNS provider
- [ ] TTL is ingesteld (3600 aanbevolen)
- [ ] Wacht 15-60 minuten voor propagation

### 1.2 DKIM Records

Mailgun geeft je 2-3 DKIM records. Voeg alle toe:

**DKIM Record 1**:
- [ ] Type: TXT
- [ ] Name: `[Mailgun geeft je deze naam]` (bijv. `mg._domainkey`)
- [ ] Value: `[Mailgun geeft je deze waarde]`
- [ ] TTL: 3600

**DKIM Record 2**:
- [ ] Type: TXT
- [ ] Name: `[Mailgun geeft je deze naam]` (bijv. `k1._domainkey`)
- [ ] Value: `[Mailgun geeft je deze waarde]`
- [ ] TTL: 3600

**DKIM Record 3** (als aanwezig):
- [ ] Type: TXT
- [ ] Name: `[Mailgun geeft je deze naam]`
- [ ] Value: `[Mailgun geeft je deze waarde]`
- [ ] TTL: 3600

### 1.3 DMARC Record

**Type**: TXT  
**Name**: `_dmarc`  
**Value**: 
```
v=DMARC1; p=none; rua=mailto:dmarc@growsocialmedia.nl; ruf=mailto:dmarc@growsocialmedia.nl; fo=1
```

**Verificatie**:
- [ ] Record is toegevoegd
- [ ] TTL is ingesteld (3600 aanbevolen)

---

## Stap 2: Mailgun Verificatie

### 2.1 Domain Status Check

1. Ga naar Mailgun Dashboard → **Sending** → **Domains** → `growsocialmedia.nl`
2. Controleer status:
   - [ ] Domain status is **"Active"** (niet "Sandbox" of "Unverified")
   - [ ] Alle DNS records hebben **groene vinkjes** ✅

### 2.2 DNS Records Status

Check elke record:
- [ ] SPF record: ✅ Verified
- [ ] DKIM record 1: ✅ Verified
- [ ] DKIM record 2: ✅ Verified
- [ ] DKIM record 3 (als aanwezig): ✅ Verified
- [ ] DMARC record: ✅ Verified (optioneel maar aanbevolen)

**Als records niet geverifieerd zijn:**
- Wacht 15-60 minuten (DNS propagation)
- Check of je de juiste records hebt toegevoegd
- Verifieer records met MX Toolbox (zie Stap 3)

---

## Stap 3: Externe Verificatie Tools

### 3.1 MX Toolbox - SPF Check

1. Ga naar: https://mxtoolbox.com/spf.aspx
2. Voer in: `growsocialmedia.nl`
3. Klik op **"SPF Record Lookup"**
4. Controleer:
   - [ ] SPF record wordt gevonden
   - [ ] Record bevat `include:mailgun.org`
   - [ ] Geen errors of warnings

### 3.2 MX Toolbox - DKIM Check

1. Ga naar: https://mxtoolbox.com/dkim.aspx
2. Voer in: `growsocialmedia.nl`
3. Klik op **"DKIM Record Lookup"**
4. Controleer:
   - [ ] DKIM records worden gevonden
   - [ ] Alle Mailgun DKIM records zijn aanwezig
   - [ ] Geen errors of warnings

### 3.3 MX Toolbox - DMARC Check

1. Ga naar: https://mxtoolbox.com/dmarc.aspx
2. Voer in: `growsocialmedia.nl`
3. Klik op **"DMARC Record Lookup"**
4. Controleer:
   - [ ] DMARC record wordt gevonden
   - [ ] Record bevat `v=DMARC1`
   - [ ] Geen errors of warnings

### 3.4 MX Toolbox - SuperTool (All Records)

1. Ga naar: https://mxtoolbox.com/SuperTool.aspx
2. Voer in: `growsocialmedia.nl`
3. Selecteer **"TXT"** in dropdown
4. Klik op **"MX Lookup"**
5. Controleer:
   - [ ] Alle TXT records worden getoond
   - [ ] SPF record is zichtbaar
   - [ ] DKIM records zijn zichtbaar
   - [ ] DMARC record is zichtbaar

---

## Stap 4: Email Deliverability Test

### 4.1 Mail Tester

1. Ga naar: https://www.mail-tester.com/
2. Kopieer het test email adres (bijv. `test-xxxxx@mail-tester.com`)
3. Stuur een test email naar dit adres vanuit je platform
4. Ga terug naar Mail Tester en klik op **"Then check your score"**
5. Controleer score:
   - [ ] Score is **8/10 of hoger** (streef naar 10/10)
   - [ ] SPF: ✅ Pass
   - [ ] DKIM: ✅ Pass
   - [ ] DMARC: ✅ Pass (als ingesteld)
   - [ ] Geen spam triggers

**Als score lager is dan 8/10:**
- Check de details op Mail Tester
- Los alle issues op
- Test opnieuw

### 4.2 Test Emails naar Verschillende Providers

Stuur test emails naar:
- [ ] Gmail (test@gmail.com)
- [ ] Outlook (test@outlook.com)
- [ ] Yahoo (test@yahoo.com)
- [ ] ProtonMail (test@protonmail.com)

Voor elke provider:
- [ ] Email komt aan in inbox (niet spam)
- [ ] Email headers tonen SPF pass
- [ ] Email headers tonen DKIM pass
- [ ] Email headers tonen DMARC pass (als ingesteld)

**Hoe email headers te checken:**
- **Gmail**: Open email → Klik op 3 puntjes → "Show original"
- **Outlook**: Open email → Klik op 3 puntjes → "View" → "View message source"
- **Yahoo**: Open email → Klik op 3 puntjes → "View raw message"

---

## Stap 5: Supabase SMTP Test

### 5.1 SMTP Configuratie Check

1. Ga naar Supabase Dashboard → **Project Settings** → **Auth** → **SMTP Settings**
2. Controleer:
   - [ ] Enable Custom SMTP: ✅ AAN
   - [ ] SMTP Host: `smtp.eu.mailgun.org`
   - [ ] SMTP Port: `587`
   - [ ] SMTP Username: `postmaster@growsocialmedia.nl`
   - [ ] SMTP Password: ✅ Ingesteld
   - [ ] Sender Email: `noreply@growsocialmedia.nl`
   - [ ] Sender Name: `GrowSocial`

### 5.2 SMTP Test

1. Klik op **"Test SMTP"** in Supabase Dashboard
2. Voer test email adres in
3. Klik op **"Send test email"**
4. Controleer:
   - [ ] Test email wordt succesvol verzonden
   - [ ] Test email komt aan in inbox
   - [ ] Geen errors in Supabase logs

### 5.3 Password Reset Test

1. Ga naar login pagina
2. Klik op **"Wachtwoord vergeten?"**
3. Voer email adres in
4. Controleer:
   - [ ] Geen errors in console
   - [ ] Email komt aan in inbox (niet spam)
   - [ ] Reset link werkt correct

---

## Stap 6: Platform Email Test

### 6.1 Welcome Email Test

1. Maak een nieuwe gebruiker aan via admin
2. Controleer:
   - [ ] Welcome email wordt verzonden
   - [ ] Email komt aan in inbox
   - [ ] Email bevat correcte links

### 6.2 Notification Email Test

1. Trigger verschillende notificaties
2. Controleer:
   - [ ] Emails worden verzonden
   - [ ] Emails komen aan in inbox
   - [ ] Geen errors in logs

---

## Stap 7: Monitoring Setup

### 7.1 Mailgun Monitoring

- [ ] Check Mailgun Dashboard → **Sending** → **Logs** regelmatig
- [ ] Monitor delivery rate (streef naar >95%)
- [ ] Monitor bounce rate (streef naar <5%)
- [ ] Check voor spam complaints

### 7.2 Supabase Monitoring

- [ ] Check Supabase Dashboard → **Logs** → **Auth Logs** regelmatig
- [ ] Monitor voor email sending errors
- [ ] Check SMTP connection errors

---

## Troubleshooting

### Probleem: DNS Records niet geverifieerd in Mailgun

**Oplossing**:
1. Wacht 15-60 minuten na DNS aanpassing
2. Verifieer records met MX Toolbox
3. Check of je de juiste records hebt toegevoegd
4. Check TTL waarden (gebruik 3600)

### Probleem: Mail Tester score laag

**Oplossing**:
1. Check Mail Tester details voor specifieke issues
2. Los alle issues op (SPF, DKIM, DMARC, content)
3. Test opnieuw
4. Streef naar score van 10/10

### Probleem: Emails komen in spam

**Oplossing**:
1. Verifieer SPF/DKIM/DMARC records
2. Check Mailgun domain status (moet "Active" zijn)
3. Warm-up je domain (start met kleine volumes)
4. Check email content voor spam triggers
5. Gebruik Mail Tester om score te verbeteren

---

## Quick Reference

### DNS Records Samenvatting

| Record Type | Name | Value | Status |
|------------|------|-------|--------|
| SPF (TXT) | `@` | `v=spf1 include:mailgun.org ~all` | ⬜ |
| DKIM 1 (TXT) | `[Mailgun naam]` | `[Mailgun waarde]` | ⬜ |
| DKIM 2 (TXT) | `[Mailgun naam]` | `[Mailgun waarde]` | ⬜ |
| DMARC (TXT) | `_dmarc` | `v=DMARC1; p=none; ...` | ⬜ |

### Verificatie Links

- **SPF Check**: https://mxtoolbox.com/spf.aspx
- **DKIM Check**: https://mxtoolbox.com/dkim.aspx
- **DMARC Check**: https://mxtoolbox.com/dmarc.aspx
- **Mail Tester**: https://www.mail-tester.com/
- **MX Toolbox**: https://mxtoolbox.com/SuperTool.aspx

---

**Domein**: `growsocialmedia.nl`  
**Platform**: `app.growsocialmedia.nl`  
**Laatste update**: January 2025
