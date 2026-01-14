# Fix: 535 Authentication Failed Error

## 🎯 Probleem

**Error**: `535 Authentication failed`

**Betekenis**: Supabase kan niet authenticeren met Mailgun SMTP server. De username of password is incorrect.

---

## 🔍 Oorzaak

De error "535 Authentication failed" betekent dat:
- ❌ Username is incorrect, OF
- ❌ Password is incorrect, OF
- ❌ Username/password combinatie komt niet overeen met Mailgun

---

## ✅ Oplossing

### Stap 1: Verifieer Mailgun SMTP Credentials

1. Ga naar **Mailgun Dashboard**: https://app.mailgun.com/
2. Ga naar **Sending** → **Domains** → `growsocialmedia.nl`
3. Scroll naar **"SMTP credentials"** sectie
4. Check:
   - [ ] Er is een SMTP password aangemaakt
   - [ ] Noteer de username die je gebruikt (moet volledig email adres zijn)

### Stap 2: Check Huidige Supabase Configuratie

Je hebt in Supabase:
- **Username**: `info@growsocialmedia.nl` ✅ (volledig email adres - goed!)
- **Password**: `********` (masked - we kunnen niet zien of het correct is)

### Stap 3: Fix Password in Supabase

**BELANGRIJK**: Het password in Supabase moet exact overeenkomen met het Mailgun SMTP password.

**Optie A: Gebruik Bestaand Password**

1. Je .env heeft: `MAILGUN_SMTP_PASS=YOUR_MAILGUN_SMTP_PASSWORD`
2. Ga naar Supabase Dashboard → **Project Settings** → **Auth** → **SMTP Settings**
3. Scroll naar **"Password"** veld
4. **Plak het password opnieuw**: Gebruik hetzelfde password als in je .env file
5. Klik **"Save changes"**
6. Test password reset opnieuw

**Optie B: Maak Nieuw SMTP Password Aan**

Als het password niet werkt, maak een nieuw aan:

1. Ga naar **Mailgun Dashboard** → **Sending** → **Domains** → `growsocialmedia.nl`
2. Scroll naar **"SMTP credentials"** sectie
3. Klik op **"Add password"** (of **"Create password"**)
4. Geef het een naam: `GrowSocial Platform Production`
5. **KOPIEER HET PASSWORD DIRECT** - je ziet het maar één keer!
6. Ga naar Supabase Dashboard → **Project Settings** → **Auth** → **SMTP Settings**
7. Plak het nieuwe password in het **"Password"** veld
8. Update ook je `.env` file met het nieuwe password
9. Klik **"Save changes"**
10. Test password reset opnieuw

---

## 🔍 Verificatie Checklist

Voordat je test, controleer:

### Supabase SMTP Settings
- [ ] **Host**: `smtp.eu.mailgun.org` ✅
- [ ] **Port**: `587` ✅
- [ ] **Username**: `info@growsocialmedia.nl` ✅ (volledig email adres)
- [ ] **Password**: [Exact hetzelfde als Mailgun SMTP password] ⚠️
- [ ] **Sender Email**: `noreply@growsocialmedia.nl` ✅
- [ ] **Sender Name**: `GrowSocial` ✅

### Mailgun SMTP Credentials
- [ ] SMTP password is aangemaakt in Mailgun
- [ ] Username in Supabase komt overeen met Mailgun
- [ ] Password in Supabase komt exact overeen met Mailgun

---

## 🧪 Test Na Fix

### Stap 1: Test Password Reset

1. Ga naar: `https://app.growsocialmedia.nl/auth/login`
2. Klik **"Wachtwoord vergeten?"**
3. Voer een bestaand email adres in
4. Klik **"Verstuur reset link"**

### Stap 2: Check Resultaat

**Succesvol:**
- ✅ Geen errors in Supabase Logs
- ✅ Email komt aan in inbox
- ✅ Mailgun Logs tonen "Accepted" en "Delivered"

**Nog steeds error:**
- ❌ Check of password exact is gekopieerd (geen extra spaties)
- ❌ Check of username volledig email adres is
- ❌ Maak nieuw SMTP password aan in Mailgun

---

## ⚠️ Veelvoorkomende Fouten

### Fout 1: Password Heeft Extra Spaties

**Probleem**: Password heeft voor/achter spaties

**Oplossing**: 
- Kopieer password opnieuw
- Zorg dat er geen spaties zijn voor/achter
- Plak in Supabase

### Fout 2: Verkeerde Username

**Probleem**: Username is niet volledig email adres

**Oplossing**:
- Moet zijn: `info@growsocialmedia.nl`
- NIET: `info` of `info@`

### Fout 3: Password Verloren

**Probleem**: Je weet niet meer welk password je gebruikt

**Oplossing**:
- Maak nieuw SMTP password aan in Mailgun
- Kopieer het direct
- Update in Supabase en .env

---

## 📝 Stap-voor-Stap Fix

### Stap 1: Open Mailgun Dashboard

1. Ga naar: https://app.mailgun.com/
2. Log in
3. Ga naar **Sending** → **Domains** → `growsocialmedia.nl`

### Stap 2: Check SMTP Credentials

1. Scroll naar **"SMTP credentials"** sectie
2. Check of er een password is
3. Als er een password is, noteer de username die je gebruikt

### Stap 3: Maak Nieuw Password (Als Nodig)

1. Klik **"Add password"** (of **"Create password"**)
2. Naam: `GrowSocial Platform Production`
3. **KOPIEER HET PASSWORD DIRECT**

### Stap 4: Update Supabase

1. Ga naar Supabase Dashboard → **Project Settings** → **Auth** → **SMTP Settings**
2. Scroll naar **"Password"** veld
3. **Plak het password** (van Mailgun of uit .env)
4. Zorg dat **Username** is: `info@growsocialmedia.nl`
5. Klik **"Save changes"**

### Stap 5: Update .env (Als Nieuw Password)

1. Open `.env` file
2. Update `MAILGUN_SMTP_PASS` met het nieuwe password
3. Sla op

### Stap 6: Test

1. Test password reset
2. Check Supabase Logs (geen errors)
3. Check inbox (email komt aan)

---

## ✅ Verwachte Resultaat

Na de fix:
- ✅ Geen "535 Authentication failed" error meer
- ✅ Supabase Logs tonen "Email sent successfully"
- ✅ Mailgun Logs tonen "Accepted"
- ✅ Email komt aan in inbox

---

## 🔗 Handige Links

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Mailgun Dashboard**: https://app.mailgun.com/
- **Mailgun SMTP Docs**: https://documentation.mailgun.com/en/latest/user_manual.html#sending-via-smtp

---

**Laatste update**: January 2025
