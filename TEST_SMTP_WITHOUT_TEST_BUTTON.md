# SMTP Testen Zonder Test Knop in Supabase

## ✅ Jouw Configuratie is Correct!

Ik zie dat je Supabase SMTP configuratie er perfect uitziet:
- ✅ Enable custom SMTP: AAN
- ✅ Sender email: `noreply@growsocialmedia.nl` (volledig!)
- ✅ Sender name: `GrowSocial`
- ✅ Host: `smtp.eu.mailgun.org` (correct)
- ✅ Port: `587` (correct)
- ✅ Username: `info@growsocialmedia.nl` (correct)
- ✅ Password: Ingesteld

**Alle velden zijn correct!** 🎉

---

## 🧪 Alternatieve Test Methoden

Aangezien er geen "Test SMTP" knop is in Supabase, gebruiken we deze methoden:

---

## Methode 1: Password Reset Test (Direct)

### Stap 1: Test Password Reset

1. Ga naar je platform: `https://app.growsocialmedia.nl/auth/login`
2. Klik op **"Wachtwoord vergeten?"**
3. Voer een **bestaand email adres** in (van een gebruiker in je systeem)
4. Klik **"Verstuur reset link"**

### Stap 2: Check Resultaat

**Check deze dingen:**

1. **In je browser/console:**
   - [ ] Zie je een success message? ("Als dit e-mailadres bestaat...")
   - [ ] Zie je errors in de browser console? (F12 → Console)

2. **In je inbox:**
   - [ ] Check inbox
   - [ ] Check spam folder
   - [ ] Check "All Mail" (Gmail)
   - [ ] Wacht 1-2 minuten (emails kunnen vertraging hebben)

3. **In Supabase Logs:**
   - Ga naar Supabase Dashboard → **Logs** → **Auth Logs**
   - Filter op laatste 15 minuten
   - Zoek naar password recovery events
   - [ ] Zie je errors?
   - [ ] Zie je "Email sent successfully"?

4. **In Mailgun Logs:**
   - Ga naar Mailgun Dashboard → **Sending** → **Logs**
   - Filter op je email adres (laatste 15 minuten)
   - [ ] Zie je een log entry?
   - [ ] Wat is de status? (Accepted, Delivered, Bounced, Failed)

---

## Methode 2: Email Verificatie Test (Registratie)

### Stap 1: Maak Nieuwe Gebruiker Aan

1. Ga naar: `https://app.growsocialmedia.nl/auth/signup`
2. Vul registratie formulier in met een test email
3. Klik **"Registreren"**

### Stap 2: Check Resultaat

- [ ] Zie je "Check je email voor verificatie"?
- [ ] Check inbox voor verificatie email
- [ ] Check spam folder

---

## Methode 3: Mailgun Dashboard Check

### Stap 1: Check Domain Status

1. Ga naar Mailgun Dashboard → **Sending** → **Domains** → `growsocialmedia.nl`
2. Check:
   - [ ] Domain status is **"Active"** (niet "Sandbox")
   - [ ] Alle DNS records hebben groene vinkjes ✅

### Stap 2: Check SMTP Credentials

1. Scroll naar **"SMTP credentials"** sectie
2. Check:
   - [ ] Er is een SMTP password aangemaakt
   - [ ] Het password dat je gebruikt in Supabase komt overeen

---

## Methode 4: Supabase Logs Analyse

### Stap 1: Check Auth Logs

1. Ga naar Supabase Dashboard → **Logs** → **Auth Logs**
2. Filter op:
   - **Time range**: Laatste 1 uur
   - **Event type**: All events
3. Zoek naar:
   - Password recovery events
   - Email sending events
   - SMTP errors

### Stap 2: Wat te Zoeken

**Goede tekenen:**
- ✅ "Password recovery email sent"
- ✅ "Email sent successfully"
- ✅ Geen errors

**Slechte tekenen:**
- ❌ "SMTP authentication failed"
- ❌ "Connection timeout"
- ❌ "Error sending recovery email"
- ❌ "Invalid credentials"

**Als je errors ziet:**
- Noteer de exacte error message
- Check de troubleshooting sectie hieronder

---

## Methode 5: Mailgun Logs Analyse

### Stap 1: Check Sending Logs

1. Ga naar Mailgun Dashboard → **Sending** → **Logs**
2. Filter op:
   - **Recipient**: je test email adres
   - **Time range**: Laatste 1 uur
3. Check of er log entries zijn

### Stap 2: Interpreteer Resultaten

**Geen log entry:**
- ❌ Email komt niet aan bij Mailgun
- Probleem: Supabase → Mailgun verbinding
- Oplossing: Check Supabase SMTP configuratie

**Log entry "Accepted":**
- ✅ Email komt aan bij Mailgun
- Check delivery status:
  - ✅ "Delivered" → Email is afgeleverd (check inbox/spam)
  - ⚠️ "Bounced" → Email is afgewezen
  - ⚠️ "Failed" → Delivery gefaald

---

## 🔍 Debug Checklist

Gebruik deze checklist om systematisch te debuggen:

### Supabase Configuratie
- [ ] Enable custom SMTP: AAN ✅
- [ ] Sender email: `noreply@growsocialmedia.nl` (volledig) ✅
- [ ] Sender name: `GrowSocial` ✅
- [ ] Host: `smtp.eu.mailgun.org` ✅
- [ ] Port: `587` ✅
- [ ] Username: `info@growsocialmedia.nl` ✅
- [ ] Password: Ingesteld (moet overeenkomen met .env) ⚠️

### Mailgun Status
- [ ] Domain status: "Active" ✅
- [ ] DNS records: Alle verified ✅
- [ ] SMTP password: Aangemaakt ✅

### Test Resultaten
- [ ] Password reset test uitgevoerd
- [ ] Supabase Logs gecheckt
- [ ] Mailgun Logs gecheckt
- [ ] Spam folder gecheckt

---

## ⚠️ Meest Waarschijnlijke Problemen

### Probleem 1: Password Mismatch

**Symptoom**: Geen email komt aan, geen log entry in Mailgun

**Oplossing**:
1. Check of password in Supabase exact overeenkomt met .env
2. Je .env heeft: `MAILGUN_SMTP_PASS=YOUR_MAILGUN_SMTP_PASSWORD`
3. Zorg dat Supabase hetzelfde password heeft
4. Als je het password niet meer ziet in Supabase, moet je het opnieuw invullen

**Fix**:
1. Ga naar Mailgun Dashboard → Domain Settings → SMTP credentials
2. Maak een nieuw SMTP password aan (of gebruik het bestaande)
3. Kopieer het password
4. Ga naar Supabase → SMTP Settings
5. Plak het password opnieuw
6. Klik "Save changes"
7. Test opnieuw

---

### Probleem 2: Email Komt Aan Bij Mailgun Maar Niet Bij Ontvanger

**Symptoom**: Log entry in Mailgun "Accepted" maar niet "Delivered"

**Oplossing**:
1. Check Mailgun Logs → Delivery status
2. Als "Bounced": Email is afgewezen door ontvanger's server
3. Als "Failed": Delivery probleem
4. Check spam folder
5. Verifieer DNS records (SPF, DKIM, DMARC)

---

### Probleem 3: Email Adres Bestaat Niet in Systeem

**Symptoom**: Geen email, maar ook geen error

**Oplossing**:
1. Zorg dat je een email adres gebruikt van een bestaande gebruiker
2. Test met je eigen email adres (als je een account hebt)
3. Check of gebruiker bestaat in Supabase → Authentication → Users

---

## 🚀 Directe Actie Plan

### Stap 1: Test Password Reset Nu

1. Ga naar: `https://app.growsocialmedia.nl/auth/login`
2. Klik "Wachtwoord vergeten?"
3. Voer een bestaand email adres in
4. Klik "Verstuur reset link"

### Stap 2: Check Direct Daarna

**In Supabase Logs (binnen 1 minuut):**
1. Ga naar Supabase Dashboard → Logs → Auth Logs
2. Check laatste entries
3. Zoek naar password recovery events
4. Noteer eventuele errors

**In Mailgun Logs (binnen 1 minuut):**
1. Ga naar Mailgun Dashboard → Sending → Logs
2. Filter op je email adres
3. Check of er een log entry is
4. Noteer de status

**In je inbox (binnen 2 minuten):**
1. Check inbox
2. Check spam folder
3. Check "All Mail" (Gmail)

### Stap 3: Deel Resultaten

Deel met mij:
1. **Supabase Logs**: Zie je errors? Wat staat er?
2. **Mailgun Logs**: Zie je een log entry? Wat is de status?
3. **Inbox**: Komt email aan? In welke folder?

---

## 📝 Notities

**Minimum Interval:**
- Je hebt `15` seconden ingesteld
- Dit is prima (aanbevolen is 60, maar 15 werkt ook)

**Password Field:**
- In Supabase zie je alleen `********` (masked)
- Dit is normaal - Supabase toont het password niet om veiligheidsredenen
- Als je het password wilt verifiëren, moet je het opnieuw invullen

---

## ❓ Vragen?

Als je problemen blijft hebben:
1. Deel de Supabase Logs (Auth Logs)
2. Deel de Mailgun Logs (Sending Logs)
3. Deel of je errors ziet in browser console
4. Deel of email adres bestaat in je systeem

---

**Laatste update**: January 2025
