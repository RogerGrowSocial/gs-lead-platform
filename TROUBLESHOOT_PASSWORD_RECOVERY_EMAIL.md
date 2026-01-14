# Troubleshooting: Password Recovery Email Komt Niet Aan

## 🎯 Probleem

Je stuurt een password recovery email via Supabase, maar ontvangt geen email.

---

## Stap 1: Check Supabase SMTP Configuratie

### 1.1 Verifieer SMTP is Aangezet

1. Ga naar **Supabase Dashboard** → **Project Settings** → **Auth** → **SMTP Settings**
2. Check:
   - [ ] **Enable custom SMTP**: ✅ **AAN** (checkbox aangevinkt)
   - [ ] Als UIT: Zet dit aan!

### 1.2 Verifieer Alle SMTP Velden

Controleer of deze velden correct zijn ingevuld:

**Host:**
- [ ] Moet zijn: `smtp.eu.mailgun.org`
- [ ] Check of dit correct is

**Port:**
- [ ] Moet zijn: `587`
- [ ] Check of dit correct is

**Username:**
- [ ] Moet zijn: `info@growsocialmedia.nl` (volledig email adres)
- [ ] Check of dit overeenkomt met je .env file

**Password:**
- [ ] Moet zijn: Hetzelfde password als in je .env
- [ ] Check of dit correct is ingevuld
- [ ] **BELANGRIJK**: Als je het password niet meer ziet, moet je het opnieuw invullen

**Sender Email:**
- [ ] Moet zijn: `noreply@growsocialmedia.nl` (volledig)
- [ ] Check of dit niet alleen `noreply@` is

**Sender Name:**
- [ ] Moet zijn: `GrowSocial`
- [ ] Check of dit is ingevuld

### 1.3 Test SMTP Direct

1. In Supabase SMTP Settings, scroll naar beneden
2. Zoek naar **"Test SMTP"** knop
3. Klik erop
4. Voer een test email adres in
5. Klik **"Send test email"**

**Resultaat:**
- ✅ **Succesvol**: Test email komt aan → SMTP werkt, probleem ligt ergens anders
- ❌ **Faal**: Test email komt niet aan → SMTP configuratie probleem

**Als test faalt:**
- Check alle velden hierboven
- Check of Mailgun domain status "Active" is
- Maak nieuw SMTP password aan in Mailgun als nodig

---

## Stap 2: Check Supabase Logs

### 2.1 Auth Logs Checken

1. Ga naar **Supabase Dashboard** → **Logs** → **Auth Logs**
2. Filter op:
   - **Time range**: Laatste 1 uur
   - **Event type**: Email events
3. Zoek naar:
   - Password recovery events
   - SMTP errors
   - Email sending errors

**Wat te zoeken:**
- ❌ "SMTP authentication failed"
- ❌ "Connection timeout"
- ❌ "Invalid credentials"
- ❌ "Error sending recovery email"
- ✅ "Email sent successfully" (geen error)

**Als je errors ziet:**
- Noteer de exacte error message
- Check de troubleshooting sectie hieronder

---

## Stap 3: Check Mailgun Logs

### 3.1 Mailgun Dashboard Logs

1. Ga naar **Mailgun Dashboard**: https://app.mailgun.com/
2. Ga naar **Sending** → **Logs**
3. Filter op:
   - **Recipient**: je email adres
   - **Time range**: Laatste 1 uur
4. Check delivery status:

**Status Betekenis:**
- ✅ **Accepted**: Email geaccepteerd door Mailgun (goed!)
- ✅ **Delivered**: Email afgeleverd aan inbox (perfect!)
- ⚠️ **Bounced**: Email afgewezen door ontvanger's server
- ⚠️ **Failed**: Email delivery gefaald
- ⚠️ **Complained**: Ontvanger heeft als spam gemarkeerd
- ❌ **Geen log entry**: Email is niet aangekomen bij Mailgun (SMTP probleem)

**Als er GEEN log entry is:**
- Email komt niet aan bij Mailgun
- Probleem ligt bij Supabase → Mailgun verbinding
- Check Supabase SMTP configuratie

**Als er WEL een log entry is:**
- Email komt aan bij Mailgun
- Check delivery status
- Als "Accepted" maar niet "Delivered": probleem bij email provider

---

## Stap 4: Check Mailgun Domain Status

### 4.1 Domain Status Check

1. Ga naar **Mailgun Dashboard** → **Sending** → **Domains** → `growsocialmedia.nl`
2. Check **Domain status**:

**Status Betekenis:**
- ✅ **Active**: Perfect, emails kunnen worden verstuurd
- ⚠️ **Sandbox**: Je kunt alleen emails versturen naar geautoriseerde ontvangers
- ❌ **Unverified**: DNS records niet correct, emails worden niet verstuurd

**Als "Sandbox":**
- Je kunt alleen emails versturen naar ontvangers die je hebt toegevoegd aan "Authorized Recipients"
- Ga naar **Sending** → **Suppressions** → **Authorized Recipients**
- Voeg je email adres toe
- OF upgrade naar "Active" door DNS records correct toe te voegen

**Als "Unverified":**
- DNS records zijn niet correct
- Volg `MAILGUN_DNS_RECORDS_SETUP.md` om records toe te voegen
- Wacht 15-60 minuten voor DNS propagation

---

## Stap 5: Check Email Adres

### 5.1 Verifieer Email Adres

**Check:**
- [ ] Email adres bestaat in je systeem (gebruiker is geregistreerd)
- [ ] Email adres is correct gespeld
- [ ] Email adres is niet geblokkeerd

**Test met:**
- Een email adres waarvan je zeker weet dat het bestaat in je systeem
- Je eigen email adres (als je een account hebt)

---

## Stap 6: Check Spam Folder

### 6.1 Spam Folder Check

**Check:**
- [ ] Spam/Junk folder
- [ ] "All Mail" folder (Gmail)
- [ ] "Promotions" tab (Gmail)
- [ ] Email filters/regels

**Zoek naar:**
- "Wachtwoord resetten" of "Password reset"
- "GrowSocial"
- "noreply@growsocialmedia.nl"

---

## Stap 7: Verifieer DNS Records

### 7.1 DNS Records Status

1. Ga naar **Mailgun Dashboard** → **Sending** → **Domains** → `growsocialmedia.nl`
2. Check **Sending records**:
   - [ ] SPF (TXT): ✅ Verified (groen vinkje)
   - [ ] DKIM (TXT): ✅ Verified (groen vinkje)
   - [ ] Email Tracking (CNAME): ✅ Verified (groen vinkje)

**Als records niet verified zijn:**
- Emails kunnen worden afgewezen
- Volg `MAILGUN_DNS_RECORDS_SETUP.md` om records toe te voegen
- Wacht 15-60 minuten voor DNS propagation

---

## Stap 8: Test Met Verschillende Methoden

### 8.1 Test 1: Supabase SMTP Test

1. Supabase Dashboard → SMTP Settings → Test SMTP
2. Stuur test email
3. Check of deze aankomt

**Resultaat:**
- ✅ Test email komt aan → SMTP werkt, probleem ligt bij password recovery specifiek
- ❌ Test email komt niet aan → SMTP configuratie probleem

### 8.2 Test 2: Password Reset Via Platform

1. Ga naar login pagina
2. Klik "Wachtwoord vergeten?"
3. Voer email in
4. Check inbox

**Resultaat:**
- ✅ Email komt aan → Alles werkt!
- ❌ Email komt niet aan → Volg troubleshooting hierboven

### 8.3 Test 3: Mail Tester

1. Ga naar https://www.mail-tester.com/
2. Kopieer test email adres
3. Stuur email via Supabase test
4. Check score

**Resultaat:**
- ✅ Score 8/10 of hoger → Email deliverability is goed
- ❌ Score lager dan 8/10 → Er zijn deliverability problemen

---

## Veelvoorkomende Problemen & Oplossingen

### Probleem 1: "SMTP authentication failed"

**Oorzaak**: Username of password is incorrect

**Oplossing:**
1. Check of username volledig email adres is (`info@growsocialmedia.nl`)
2. Check of password correct is (moet overeenkomen met .env)
3. Maak nieuw SMTP password aan in Mailgun
4. Update password in Supabase
5. Test opnieuw

---

### Probleem 2: "Connection timeout"

**Oorzaak**: Host of port is incorrect, of firewall blokkeert

**Oplossing:**
1. Check host is `smtp.eu.mailgun.org` (niet `smtp.mailgun.org`)
2. Check port is `587` (of `465`)
3. Check firewall/network settings
4. Test met MX Toolbox SMTP test

---

### Probleem 3: Email komt aan bij Mailgun maar niet bij ontvanger

**Oorzaak**: Delivery probleem bij email provider

**Oplossing:**
1. Check Mailgun Dashboard → Logs voor delivery status
2. Check of email is "Bounced" of "Failed"
3. Check spam folder
4. Verifieer DNS records (SPF, DKIM, DMARC)
5. Test met Mail Tester om score te checken

---

### Probleem 4: Mailgun Domain in Sandbox Mode

**Oorzaak**: Domain is niet volledig geverifieerd

**Oplossing:**
1. Check Mailgun Dashboard → Domain status
2. Als "Sandbox": Voeg ontvanger toe aan "Authorized Recipients"
3. OF upgrade naar "Active" door DNS records correct toe te voegen
4. Wacht op verificatie

---

### Probleem 5: Geen Log Entry in Mailgun

**Oorzaak**: Email komt niet aan bij Mailgun (SMTP probleem)

**Oplossing:**
1. Check Supabase SMTP configuratie
2. Test SMTP direct in Supabase
3. Check Supabase Logs → Auth Logs voor errors
4. Verifieer alle SMTP velden zijn correct

---

## Debug Checklist

Gebruik deze checklist om systematisch te debuggen:

- [ ] **Supabase SMTP is aan**: Enable custom SMTP is aangevinkt
- [ ] **Alle SMTP velden zijn correct**: Host, Port, Username, Password, Sender
- [ ] **Supabase SMTP test werkt**: Test email komt aan
- [ ] **Mailgun domain status**: "Active" (niet "Sandbox" of "Unverified")
- [ ] **DNS records zijn verified**: Alle records hebben groene vinkjes
- [ ] **Supabase Logs**: Geen SMTP errors
- [ ] **Mailgun Logs**: Email wordt geaccepteerd
- [ ] **Email adres bestaat**: Gebruiker is geregistreerd in systeem
- [ ] **Spam folder**: Gecheckt
- [ ] **Email adres is correct**: Geen typos

---

## Snelle Fixes

### Fix 0: Mailgun Bounced Address (Code 605)

**Symptoom:**
- Mailgun log toont: `"event": "failed"`, `"code": 605`, `"message": "Not delivering to previously bounced address"`
- Supabase log toont: `"status": 200` (geen error)
- Email wordt niet ontvangen

**Oorzaak:**
- Email adres heeft eerder een bounce gegeven
- Mailgun heeft dit adres gemarkeerd als "bounced"
- Mailgun levert automatisch geen emails meer af naar bounced addresses

**Oplossing:**
1. Ga naar [Mailgun Dashboard](https://app.mailgun.com/) → **Suppressions** → **Bounces**
2. Zoek naar het email adres (bijv. `serve@gs-marketing.nl`)
3. Klik op **Remove** of **Delete**
4. Test password recovery opnieuw

**Zie ook:** `FIX_MAILGUN_BOUNCED_ADDRESS.md` voor gedetailleerde instructies.

---

### Fix 1: Herstel SMTP Configuratie

1. Ga naar Supabase Dashboard → SMTP Settings
2. Verifieer alle velden:
   - Host: `smtp.eu.mailgun.org`
   - Port: `587`
   - Username: `info@growsocialmedia.nl`
   - Password: [Je Mailgun SMTP password]
   - Sender Email: `noreply@growsocialmedia.nl`
   - Sender Name: `GrowSocial`
3. Klik "Save changes"
4. Test SMTP

### Fix 2: Maak Nieuw SMTP Password

1. Ga naar Mailgun Dashboard → Domain Settings → SMTP credentials
2. Klik "Add password"
3. Kopieer het nieuwe password
4. Update in Supabase
5. Test opnieuw

### Fix 3: Check Mailgun Sandbox Mode

1. Ga naar Mailgun Dashboard → Domains
2. Check domain status
3. Als "Sandbox": Voeg ontvanger toe aan "Authorized Recipients"
4. Test opnieuw

---

## Handige Links

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Mailgun Dashboard**: https://app.mailgun.com/
- **Mail Tester**: https://www.mail-tester.com/
- **MX Toolbox**: https://mxtoolbox.com/SuperTool.aspx

---

## Volgende Stappen

1. **Check Supabase SMTP test eerst** - Dit geeft direct feedback
2. **Check Supabase Logs** - Zoek naar errors
3. **Check Mailgun Logs** - Zie of email aankomt bij Mailgun
4. **Check Mailgun Domain Status** - Moet "Active" zijn
5. **Test met verschillende methoden** - Isoleren waar het probleem zit

---

**Laatste update**: January 2025
