# Mailgun DNS Records Setup - GrowSocial

## 📋 Huidige Status

Je hebt de volgende records nodig in Mailgun:

### ✅ Sending Records (Verzenden)
1. **SPF Record** (TXT) - ✅ Gegeven door Mailgun
2. **DKIM Record** (TXT) - ✅ Gegeven door Mailgun

### ⚠️ Tracking Record (CNAME)
3. **Email Tracking** (CNAME) - ✅ Gegeven door Mailgun

### ⚠️ Authentication Records
4. **Authentication Records** - Nog niet ingesteld (optioneel maar aanbevolen)

### ℹ️ Receiving Records (MX)
5. **MX Records** - Alleen nodig als je emails wilt ONTVANGEN via Mailgun (optioneel)

---

## Stap 1: DNS Records Toevoegen

### 1.1 SPF Record (TXT)

**In je DNS provider (bijv. Mijndomein, Cloudflare):**

- **Type**: TXT
- **Name/Host**: `@` (of `growsocialmedia.nl`)
- **Value**: 
  ```
  v=spf1 include:mailgun.org ~all
  ```
- **TTL**: 3600 (1 uur)

**Status**: ✅ Deze moet je toevoegen aan je DNS provider

---

### 1.2 DKIM Record (TXT)

**In je DNS provider:**

- **Type**: TXT
- **Name/Host**: `mta._domainkey` (of `mta._domainkey.growsocialmedia.nl` - check je DNS provider)
- **Value**: 
  ```
  k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDdflJ0HjIzzFekAjODdWe5pFXL/VIMNGYBQlxQvlQz8Gly6RXpqHT/IUXQ6rVbjfCWAA++EcJni2eNio816JJPoj85de9dXf1xcMjLFNA4XsDaCUubXE8nqeymX3idSVCFf6ASOSorz5DCus6hnamW+tg5r7slDzZblfU6WDpK7wIDAQAB
  ```
- **TTL**: 3600

**BELANGRIJK**: 
- Kopieer de exacte waarde uit Mailgun (de waarde hierboven is een voorbeeld)
- De naam kan variëren per DNS provider:
  - Sommige providers: `mta._domainkey`
  - Andere providers: `mta._domainkey.growsocialmedia.nl`
  - Check je DNS provider's instructies

**Status**: ✅ Deze moet je toevoegen aan je DNS provider

---

### 1.3 Email Tracking (CNAME)

**In je DNS provider:**

- **Type**: CNAME
- **Name/Host**: `email` (of `email.growsocialmedia.nl` - check je DNS provider)
- **Value/Target**: 
  ```
  eu.mailgun.org
  ```
- **TTL**: 3600

**Status**: ✅ Deze moet je toevoegen aan je DNS provider

---

### 1.4 DMARC Record (TXT) - Aanbevolen

**In je DNS provider:**

- **Type**: TXT
- **Name/Host**: `_dmarc` (of `_dmarc.growsocialmedia.nl`)
- **Value**: 
  ```
  v=DMARC1; p=none; rua=mailto:dmarc@growsocialmedia.nl; ruf=mailto:dmarc@growsocialmedia.nl; fo=1
  ```
- **TTL**: 3600

**Status**: ⚠️ Optioneel maar sterk aanbevolen voor betere deliverability

---

### 1.5 MX Records - Optioneel

**Alleen nodig als je emails wilt ONTVANGEN via Mailgun.**

Als je al een andere email provider hebt (bijv. Mijndomein email), hoef je deze **NIET** toe te voegen.

**Als je WEL emails wilt ontvangen via Mailgun:**

- **Type**: MX
- **Name/Host**: `@` (of `growsocialmedia.nl`)
- **Value**: `mxa.eu.mailgun.org`
- **Priority**: 10
- **TTL**: 3600

- **Type**: MX
- **Name/Host**: `@` (of `growsocialmedia.nl`)
- **Value**: `mxb.eu.mailgun.org`
- **Priority**: 10
- **TTL**: 3600

**Status**: ⚠️ Optioneel - alleen als je emails wilt ontvangen via Mailgun

---

## Stap 2: DNS Provider Specifieke Instructies

### Mijndomein

1. Log in op Mijndomein
2. Ga naar **Domeinbeheer** → **DNS-instellingen**
3. Voeg records toe zoals hierboven beschreven
4. **BELANGRIJK**: Voor subdomeinen (zoals `mta._domainkey`), voeg toe als:
   - Name: `mta._domainkey` (zonder `.growsocialmedia.nl`)
   - Mijndomein voegt automatisch het domein toe

### Cloudflare

1. Log in op Cloudflare
2. Selecteer je domain `growsocialmedia.nl`
3. Ga naar **DNS** → **Records**
4. Voeg records toe
5. **BELANGRIJK**: Voor subdomeinen, gebruik de volledige naam:
   - Name: `mta._domainkey.growsocialmedia.nl`

### Andere Providers

- Volg de instructies van je DNS provider
- Gebruik de exacte waarden uit Mailgun
- Check of je provider subdomeinen automatisch toevoegt of niet

---

## Stap 3: Verificatie in Mailgun

### 3.1 Wacht op DNS Propagation

Na het toevoegen van DNS records:
- **Wacht 15-60 minuten** voor DNS propagation
- Soms kan het tot 48 uur duren (maar meestal binnen 1 uur)

### 3.2 Check Status in Mailgun

1. Ga naar Mailgun Dashboard → **Sending** → **Domains** → `growsocialmedia.nl`
2. Check de **Status** kolom:
   - ✅ **Groen vinkje** = Record is geverifieerd
   - ⚠️ **Geel waarschuwing** = Record wordt nog gecontroleerd
   - ❌ **Rood kruis** = Record is niet gevonden of incorrect

### 3.3 Wat te Checken

Voor elke record:
- [ ] SPF (TXT): ✅ Verified
- [ ] DKIM (TXT): ✅ Verified
- [ ] Email Tracking (CNAME): ✅ Verified
- [ ] DMARC (TXT): ✅ Verified (als toegevoegd)
- [ ] MX Records: ✅ Verified (alleen als toegevoegd)

---

## Stap 4: Externe Verificatie

### 4.1 MX Toolbox - SPF Check

1. Ga naar: https://mxtoolbox.com/spf.aspx
2. Voer in: `growsocialmedia.nl`
3. Klik op **"SPF Record Lookup"**
4. Controleer:
   - ✅ SPF record wordt gevonden
   - ✅ Record bevat `include:mailgun.org`
   - ✅ Geen errors

### 4.2 MX Toolbox - DKIM Check

1. Ga naar: https://mxtoolbox.com/dkim.aspx
2. Voer in: `growsocialmedia.nl`
3. Klik op **"DKIM Record Lookup"**
4. Controleer:
   - ✅ DKIM record wordt gevonden
   - ✅ Record bevat de juiste public key
   - ✅ Geen errors

### 4.3 MX Toolbox - SuperTool

1. Ga naar: https://mxtoolbox.com/SuperTool.aspx
2. Voer in: `growsocialmedia.nl`
3. Selecteer **"TXT"** in dropdown
4. Klik op **"MX Lookup"**
5. Controleer:
   - ✅ Alle TXT records zijn zichtbaar
   - ✅ SPF record is aanwezig
   - ✅ DKIM record is aanwezig
   - ✅ DMARC record is aanwezig (als toegevoegd)

---

## Stap 5: SMTP Credentials Ophalen

### 5.1 SMTP Password Aanmaken

1. Ga naar Mailgun Dashboard → **Sending** → **Domains** → `growsocialmedia.nl`
2. Scroll naar **SMTP credentials** sectie
3. Klik op **Add password** (of **Create password**)
4. Geef het een naam: `GrowSocial Platform Production`
5. **KOPIEER HET PASSWORD DIRECT** - je ziet het maar één keer!
6. Bewaar dit password veilig

### 5.2 SMTP Instellingen

**SMTP Host**: `smtp.eu.mailgun.org`  
**SMTP Port**: `587` (STARTTLS)  
**SMTP Username**: `postmaster@growsocialmedia.nl`  
**SMTP Password**: `[Het password dat je net hebt aangemaakt]`  
**Sender Email**: `noreply@growsocialmedia.nl`

---

## Stap 6: Supabase SMTP Configuratie

Zie **`COMPLETE_SMTP_SETUP.md`** Stap 4 voor volledige Supabase configuratie.

**Quick Setup:**
1. Supabase Dashboard → **Project Settings** → **Auth** → **SMTP Settings**
2. Enable Custom SMTP: ✅ **AAN**
3. Vul in:
   - Host: `smtp.eu.mailgun.org`
   - Port: `587`
   - Username: `postmaster@growsocialmedia.nl`
   - Password: `[Je Mailgun SMTP password]`
   - Sender Email: `noreply@growsocialmedia.nl`
   - Sender Name: `GrowSocial`
4. Klik **Test SMTP** en verifieer

---

## Checklist

Voordat je verder gaat:

- [ ] SPF record (TXT) is toegevoegd aan DNS provider
- [ ] DKIM record (TXT) is toegevoegd aan DNS provider
- [ ] Email tracking (CNAME) is toegevoegd aan DNS provider
- [ ] DMARC record (TXT) is toegevoegd (aanbevolen)
- [ ] Wacht 15-60 minuten voor DNS propagation
- [ ] Check Mailgun Dashboard - alle records hebben groene vinkjes ✅
- [ ] Verifieer records met MX Toolbox
- [ ] Mailgun SMTP password is aangemaakt
- [ ] Supabase SMTP is geconfigureerd
- [ ] Supabase SMTP test is succesvol

---

## Troubleshooting

### Probleem: Records worden niet geverifieerd in Mailgun

**Oplossing**:
1. Wacht langer (DNS propagation kan tot 48 uur duren)
2. Verifieer records met MX Toolbox
3. Check of je de juiste records hebt toegevoegd
4. Check of de waarden exact overeenkomen met Mailgun
5. Check TTL waarden (gebruik 3600)

### Probleem: DKIM record naam klopt niet

**Oplossing**:
- Sommige DNS providers voegen automatisch het domein toe
- Probeer beide: `mta._domainkey` en `mta._domainkey.growsocialmedia.nl`
- Check je DNS provider's documentatie

### Probleem: CNAME record werkt niet

**Oplossing**:
- Check of je provider CNAME records ondersteunt
- Sommige providers gebruiken andere naamconventies
- Check je DNS provider's documentatie

---

## Handige Links

- **Mailgun Dashboard**: https://app.mailgun.com/
- **MX Toolbox SPF**: https://mxtoolbox.com/spf.aspx
- **MX Toolbox DKIM**: https://mxtoolbox.com/dkim.aspx
- **MX Toolbox SuperTool**: https://mxtoolbox.com/SuperTool.aspx
- **Mail Tester**: https://www.mail-tester.com/

---

**Domein**: `growsocialmedia.nl`  
**Platform**: `app.growsocialmedia.nl`  
**Laatste update**: January 2025
