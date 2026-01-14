# Check Email Adres Bestaat Voordat Je Uit Bounces Verwijdert

## ⚠️ Belangrijk

**Gmail Bounce Message:**
```
5.1.1 The email account that you tried to reach does not exist
```

Dit betekent dat Gmail zegt dat het email adres **niet bestaat**.

**Voordat je het email adres uit Mailgun Bounces verwijdert, moet je eerst checken of het email adres echt bestaat.**

---

## 🔍 Stap 1: Verifieer Email Adres

### Check 1: Test Email Adres Direct

1. Open je email client (Gmail, Outlook, etc.)
2. Stuur een test email naar `serve@gs-marketing.nl`
3. Check of je een bounce krijgt of dat het aankomt

**Resultaat:**
- ✅ Email komt aan → Email adres bestaat, verwijder uit bounces
- ❌ Email bouncet → Email adres bestaat niet, verwijder NIET uit bounces

---

### Check 2: Check Gmail Account Direct

1. Ga naar [Gmail Login](https://mail.google.com/)
2. Probeer in te loggen met `serve@gs-marketing.nl`
3. Check of account bestaat

**Resultaat:**
- ✅ Kun je inloggen → Email adres bestaat, verwijder uit bounces
- ❌ Kun je niet inloggen → Email adres bestaat niet, verwijder NIET uit bounces

---

### Check 3: Check Database/System

1. Check je database of systeem
2. Zoek naar `serve@gs-marketing.nl`
3. Check of email adres correct is geregistreerd

**Check voor:**
- ✅ Geen typo's (bijv. `serve@gs-marketing.com` vs `serve@gs-marketing.nl`)
- ✅ Correct domain (`.nl` vs `.com`)
- ✅ Correct spelling van gebruikersnaam

---

## ✅ Stap 2: Beslissing

### Scenario A: Email Adres WEL Bestaat

**Actie:**
1. ✅ Verwijder uit Mailgun Bounces
2. ✅ Test password recovery opnieuw
3. ✅ Email zou nu moeten aankomen

**Waarom:**
- Email adres bestaat, maar was tijdelijk niet bereikbaar
- Of email server had tijdelijke problemen
- Na verwijderen uit bounces zou het moeten werken

---

### Scenario B: Email Adres NIET Bestaat

**Actie:**
1. ❌ Verwijder NIET uit bounces (heeft geen zin, het zal opnieuw bouncen)
2. ✅ Update email adres in je systeem naar correct adres
3. ✅ Of gebruik een ander email adres voor deze gebruiker
4. ✅ Test met correct email adres

**Waarom:**
- Email adres bestaat echt niet
- Verwijderen uit bounces lost niets op
- Je moet het email adres corrigeren in je systeem

---

## 🧪 Test Plan

### Test 1: Direct Email Test

```bash
# Test email adres met mail command (als beschikbaar)
echo "Test email" | mail -s "Test" serve@gs-marketing.nl
```

**Of:**
- Stuur handmatig een test email vanuit je email client
- Check of het aankomt of bouncet

---

### Test 2: Check Gmail Account

1. Ga naar Gmail login
2. Probeer in te loggen
3. Check of account bestaat

---

### Test 3: Check System Database

```sql
-- Check of email adres in database staat
SELECT email FROM users WHERE email = 'serve@gs-marketing.nl';

-- Check voor typo's
SELECT email FROM users WHERE email LIKE '%serve%' AND email LIKE '%gs-marketing%';
```

---

## 📋 Checklist

- [ ] Test email adres direct (stuur test email)
- [ ] Check Gmail account (probeer in te loggen)
- [ ] Check database/system (verifieer email adres)
- [ ] Check voor typo's (`.com` vs `.nl`, etc.)
- [ ] **Beslissing**: Email adres bestaat WEL → Verwijder uit bounces
- [ ] **Beslissing**: Email adres bestaat NIET → Update in systeem

---

## 🎯 Voor Jouw Situatie

**Gmail Bounce Message:**
```
5.1.1 The email account that you tried to reach does not exist
```

**Dit betekent waarschijnlijk:**
- ❌ Email adres `serve@gs-marketing.nl` bestaat niet in Gmail
- ❌ Of het is een typo (bijv. `serve@gs-marketing.com`)

**Aanbevolen Actie:**
1. **Eerst checken**: Test of `serve@gs-marketing.nl` echt bestaat
2. **Als het niet bestaat**: Update email adres in je systeem
3. **Als het wel bestaat**: Verwijder uit bounces en test opnieuw

---

## ✅ Resultaat

**Na verificatie:**
- ✅ Als email adres bestaat: Verwijder uit bounces, test opnieuw
- ✅ Als email adres niet bestaat: Update in systeem, gebruik correct adres
- ✅ Geen onnodige verwijderingen uit bounces
- ✅ Geen herhaalde bounces

---

**Laatste update**: January 2025
