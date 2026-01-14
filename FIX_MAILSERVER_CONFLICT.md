# Fix: Mail Server Conflict - Mailgun vs Mijndomein

## 🎯 Probleem

**Situatie:**
- Mailgun wordt gebruikt voor **sending** (SMTP)
- Mijndomein wordt gebruikt voor **receiving** (MX records)
- Beide gebruiken mogelijk dezelfde mail server voor `growsocialmedia.nl`
- Dit kan conflicten veroorzaken

**Symptoom:**
- Emails naar externe adressen (Gmail) werken ✅
- Emails naar interne adressen (`serve@growsocialmedia.nl`) komen niet aan ❌
- Email wordt "accepted" door Mailgun maar niet "delivered"

---

## 🔍 Waarom Dit Gebeurt

### Het Probleem

1. **Mailgun stuurt email** naar `serve@growsocialmedia.nl`
2. **Email komt aan bij Mijndomein mail server** (via MX records)
3. **Mijndomein mail server ziet**: 
   - Email komt van Mailgun (externe provider)
   - Email is voor eigen domein (`growsocialmedia.nl`)
   - Mail server denkt: "Waarom komt er een email van externe provider voor mijn eigen domein?"
4. **Resultaat**: Email wordt afgewezen, genegeerd, of komt in spam

---

## ✅ Oplossing: Dual SMTP (Al Geïmplementeerd!)

**Goed nieuws**: We hebben al dual SMTP geïmplementeerd! Dit zou het probleem moeten oplossen.

### Hoe Het Nu Werkt

**Code detecteert automatisch:**
- Email naar `@growsocialmedia.nl` → **Mijndomein SMTP** ✅
- Email naar extern adres → **Mailgun SMTP** ✅

**Dit betekent:**
- Interne emails gaan **direct** via Mijndomein SMTP
- Geen conflict meer met mail server
- Email komt direct aan in inbox

---

## 🔧 Verificatie: Werkt Dual SMTP?

### Check 1: Environment Variables

Controleer of deze zijn ingesteld in `.env`:

```env
# Mailgun (voor externe emails)
MAILGUN_SMTP_HOST=smtp.eu.mailgun.org
MAILGUN_SMTP_PORT=587
MAILGUN_SMTP_USER=info@growsocialmedia.nl
MAILGUN_SMTP_PASS=YOUR_MAILGUN_SMTP_PASSWORD

# Mijndomein (voor interne emails)
MIJNDOMEIN_SMTP_HOST=mail.mijndomein.nl
MIJNDOMEIN_SMTP_PORT=587
MIJNDOMEIN_SMTP_USER=noreply@growsocialmedia.nl
MIJNDOMEIN_SMTP_PASS=[Je Mijndomein email wachtwoord]
```

**Check:**
- [ ] `MIJNDOMEIN_SMTP_HOST` is ingesteld
- [ ] `MIJNDOMEIN_SMTP_USER` is ingesteld
- [ ] `MIJNDOMEIN_SMTP_PASS` is ingesteld

---

### Check 2: Test Interne Email

1. Stuur een email naar `serve@growsocialmedia.nl`
2. Check server logs:
   - [ ] Zie je: "Email Service Configuration (Mijndomein)"?
   - [ ] Zie je: "Internal: Yes"?
   - [ ] Zie je: "Host: mail.mijndomein.nl"?

**Als je "Mailgun" ziet in plaats van "Mijndomein":**
- Dual SMTP werkt niet correct
- Check environment variables
- Check of code correct is geladen

---

### Check 3: Mijndomein SMTP Credentials

**Verifieer Mijndomein SMTP instellingen:**

1. Log in op Mijndomein
2. Ga naar **Email** → **SMTP instellingen**
3. Noteer:
   - **SMTP Host**: Meestal `mail.mijndomein.nl`
   - **SMTP Port**: Meestal `587` (STARTTLS) of `465` (SSL)
   - **SMTP Username**: Je volledige email adres (bijv. `noreply@growsocialmedia.nl`)
   - **SMTP Password**: Je email wachtwoord

4. **Update `.env`** met deze waarden:
   ```env
   MIJNDOMEIN_SMTP_HOST=mail.mijndomein.nl
   MIJNDOMEIN_SMTP_PORT=587
   MIJNDOMEIN_SMTP_USER=noreply@growsocialmedia.nl
   MIJNDOMEIN_SMTP_PASS=[Je Mijndomein email wachtwoord]
   ```

---

## 🧪 Test Dual SMTP

### Test 1: Externe Email (Gmail)

1. Stuur email naar Gmail adres
2. Check server logs:
   - [ ] "Email Service Configuration (Mailgun)"
   - [ ] "Internal: No"
   - [ ] "Host: smtp.eu.mailgun.org"
3. Check inbox:
   - [ ] Email komt aan ✅

**Verwacht**: Email wordt verzonden via Mailgun

---

### Test 2: Interne Email (serve@growsocialmedia.nl)

1. Stuur email naar `serve@growsocialmedia.nl`
2. Check server logs:
   - [ ] "Email Service Configuration (Mijndomein)"
   - [ ] "Internal: Yes"
   - [ ] "Host: mail.mijndomein.nl"
3. Check inbox:
   - [ ] Email komt aan ✅

**Verwacht**: Email wordt verzonden via Mijndomein SMTP (direct, geen conflict)

---

## ⚠️ Als Dual SMTP Niet Werkt

### Probleem: Code Gebruikt Nog Altijd Mailgun

**Symptoom**: Logs tonen "Mailgun" voor interne emails

**Oplossing:**
1. Check environment variables zijn correct ingesteld
2. Herstart server (om nieuwe env vars te laden)
3. Check of `isInternalEmail()` functie correct werkt
4. Test opnieuw

---

### Probleem: Mijndomein SMTP Werkt Niet

**Symptoom**: "SMTP connection verification failed" voor Mijndomein

**Oplossing:**
1. Verifieer Mijndomein SMTP credentials
2. Check of host/port correct zijn
3. Check of username volledig email adres is
4. Check of password correct is
5. Test Mijndomein SMTP direct

---

## 📋 Checklist

- [ ] `MIJNDOMEIN_SMTP_*` environment variables zijn ingesteld
- [ ] Mijndomein SMTP credentials zijn correct
- [ ] Server is herstart (om env vars te laden)
- [ ] Test externe email - gebruikt Mailgun ✅
- [ ] Test interne email - gebruikt Mijndomein ✅
- [ ] Interne email komt aan in inbox ✅

---

## 🎯 Samenvatting

**Het probleem:**
- Mailgun en Mijndomein gebruiken mogelijk dezelfde mail server
- Dit veroorzaakt conflicten voor same-domain sending

**De oplossing:**
- Dual SMTP is al geïmplementeerd
- Interne emails gaan via Mijndomein SMTP (direct, geen conflict)
- Externe emails gaan via Mailgun SMTP

**Wat te doen:**
1. Verifieer Mijndomein SMTP credentials in `.env`
2. Test interne email
3. Check logs om te zien welke provider wordt gebruikt

---

## ❓ Vragen

**Vraag 1: Zie je "Mijndomein" in logs voor interne emails?**
- Ja → Dual SMTP werkt, check of Mijndomein SMTP correct is
- Nee → Check environment variables en herstart server

**Vraag 2: Werkt Mijndomein SMTP?**
- Test met direct SMTP test
- Check credentials zijn correct
- Check firewall/network settings

**Vraag 3: Komt interne email aan?**
- Als dual SMTP werkt en Mijndomein SMTP werkt → Email zou moeten aankomen
- Check inbox en spam folder
- Check Mijndomein email logs

---

**Laatste update**: January 2025
