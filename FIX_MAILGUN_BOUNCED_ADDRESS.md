# Fix: Mailgun Bounced Address (Code 605)

## 🔴 Probleem

Mailgun levert geen emails af naar `serve@gs-marketing.nl` omdat dit email adres eerder een bounce heeft gegeven.

**Mailgun Error:**
```
"event": "failed"
"code": 605
"message": "Not delivering to previously bounced address"
"reason": "suppress-bounce"
"severity": "permanent"
```

**Wat betekent dit?**
- Mailgun heeft dit email adres gemarkeerd als "bounced"
- Mailgun levert automatisch geen emails meer af naar bounced addresses
- Dit is een spam-preventie feature van Mailgun

---

## ✅ Oplossing: Verwijder Email Adres uit Suppression List

### Stap 1: Ga naar Mailgun Dashboard

1. Log in op [Mailgun Dashboard](https://app.mailgun.com/)
2. Selecteer je domain: `growsocialmedia.nl`
3. Ga naar **Suppressions** in het menu

---

### Stap 2: Check Bounces List

1. Klik op **Bounces** tab
2. Zoek naar `serve@gs-marketing.nl`
3. Check of dit email adres in de lijst staat

**Verwacht:**
- ✅ Email adres staat in Bounces lijst
- ✅ Reden: waarschijnlijk "550" (mailbox not found) of "554" (rejected)

---

### Stap 3: Verwijder Email Adres uit Bounces

**Optie A: Via Mailgun Dashboard**

1. Klik op het email adres `serve@gs-marketing.nl`
2. Klik op **Remove** of **Delete** knop
3. Bevestig verwijdering

**Optie B: Via Mailgun API**

```bash
# Verwijder email adres uit bounces
curl -X DELETE \
  "https://api.mailgun.net/v3/growsocialmedia.nl/bounces/serve@gs-marketing.nl" \
  -u "api:YOUR_MAILGUN_API_KEY"
```

**Vervang:**
- `YOUR_MAILGUN_API_KEY` met je Mailgun API key

---

### Stap 4: Check Suppressions

1. Ga naar **Suppressions** → **Unsubscribes** tab
2. Check of `serve@gs-marketing.nl` ook in Unsubscribes staat
3. Verwijder indien nodig

---

### Stap 5: Test Email Verzenden

1. Test password recovery opnieuw
2. Check Mailgun logs voor nieuwe status
3. Check of email wordt afgeleverd

**Verwacht na fix:**
- ✅ Mailgun log toont `"event": "accepted"` of `"event": "delivered"`
- ✅ Email wordt ontvangen in inbox

---

## 🔍 Waarom is dit gebeurd?

**Mogelijke oorzaken:**

1. **Email adres bestaat niet** ⚠️ **BELANGRIJK**
   - Email server heeft "550 Mailbox not found" teruggestuurd
   - Gmail zegt: "The email account that you tried to reach does not exist"
   - Mailgun heeft dit gemarkeerd als bounce
   - **Als email adres echt niet bestaat**: Verwijderen uit bounces heeft geen zin, het zal opnieuw bouncen
   - **Als email adres WEL bestaat**: Verwijderen uit bounces en opnieuw proberen

2. **Email server heeft email geweigerd**
   - Email server heeft "554 Message rejected" teruggestuurd
   - Mailgun heeft dit gemarkeerd als bounce

3. **Tijdelijke mailbox problemen**
   - Email server was tijdelijk niet bereikbaar
   - Mailgun heeft dit gemarkeerd als permanent bounce

---

## ⚠️ BELANGRIJK: Check Eerst of Email Adres Bestaat

**Voordat je het email adres uit bounces verwijdert:**

### Stap 1: Verifieer Email Adres

**Check 1: Test Email Adres Direct**
- Probeer een test email te sturen vanuit je eigen email client
- Check of je een bounce krijgt of dat het aankomt

**Check 2: Check Gmail Account**
- Log in op Gmail met `serve@gs-marketing.nl`
- Als je niet kunt inloggen: Email adres bestaat niet
- Als je wel kunt inloggen: Email adres bestaat, verwijder uit bounces

**Check 3: Check Database/System**
- Check of `serve@gs-marketing.nl` correct is geregistreerd in je systeem
- Check of er geen typo is (bijv. `serve@gs-marketing.com` vs `serve@gs-marketing.nl`)

---

### Stap 2: Beslissing

**Als Email Adres WEL Bestaat:**
- ✅ Verwijder uit Mailgun Bounces
- ✅ Test password recovery opnieuw
- ✅ Email zou nu moeten aankomen

**Als Email Adres NIET Bestaat:**
- ❌ Verwijder NIET uit bounces (heeft geen zin)
- ✅ Update email adres in je systeem naar correct adres
- ✅ Of gebruik een ander email adres voor deze gebruiker

---

## 🛡️ Preventie: Valideer Email Adressen

### Optie 1: Email Validatie Service

Gebruik een email validatie service voordat je emails verstuurt:

```javascript
// Voorbeeld: Email validatie
const emailValidator = require('email-validator');

if (!emailValidator.validate(email)) {
  return res.status(400).json({ error: 'Invalid email address' });
}
```

### Optie 2: Check Mailgun Suppressions voor Verzenden

```javascript
// Check of email in suppression list staat
const mailgun = require('mailgun-js')({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN
});

// Check bounces
const checkBounce = await mailgun.get(`/${process.env.MAILGUN_DOMAIN}/bounces/${email}`)
  .catch(() => null);

if (checkBounce) {
  console.warn(`⚠️ Email ${email} is in bounces list`);
  // Verwijder uit bounces of gebruik alternatief email adres
}
```

---

## 📋 Checklist

- [ ] Log in op Mailgun Dashboard
- [ ] Ga naar Suppressions → Bounces
- [ ] Zoek `serve@gs-marketing.nl`
- [ ] Verwijder email adres uit Bounces
- [ ] Check Unsubscribes (indien nodig)
- [ ] Test password recovery opnieuw
- [ ] Check Mailgun logs voor nieuwe status
- [ ] Bevestig dat email wordt ontvangen

---

## 🧪 Testen

### Test 1: Check Mailgun Bounces

1. Ga naar Mailgun Dashboard
2. Check Bounces lijst
3. Bevestig dat `serve@gs-marketing.nl` is verwijderd

**Verwacht:**
- ✅ Email adres staat niet meer in Bounces lijst

---

### Test 2: Test Password Recovery

1. Ga naar password recovery pagina
2. Vul `serve@gs-marketing.nl` in
3. Verstuur recovery request
4. Check Mailgun logs

**Verwacht:**
- ✅ Mailgun log toont `"event": "accepted"` of `"event": "delivered"`
- ✅ Geen `"code": 605` error
- ✅ Email wordt ontvangen in inbox

---

## 🔄 Alternatieve Oplossingen

### Als Email Adres Blijft Bouncen

**Optie 1: Gebruik Alternatief Email Adres**
- Gebruik een ander email adres voor testing
- Bijvoorbeeld: `serve+test@gs-marketing.nl`

**Optie 2: Contact Email Server Beheerder**
- Check of email server correct is geconfigureerd
- Check of mailbox bestaat
- Check of email server emails accepteert

**Optie 3: Whitelist Mailgun IPs**
- Voeg Mailgun IP ranges toe aan email server whitelist
- Dit voorkomt dat emails worden geweigerd

---

## 📚 Referenties

- [Mailgun Suppressions Documentation](https://documentation.mailgun.com/en/latest/user_manual.html#suppressions)
- [Mailgun Bounces API](https://documentation.mailgun.com/en/latest/api_reference.html#bounces)
- [Mailgun Error Codes](https://documentation.mailgun.com/en/latest/api_reference.html#errors)

---

## ✅ Resultaat

Na het verwijderen van het email adres uit de Bounces lijst:
- ✅ Mailgun levert emails weer af naar dit adres
- ✅ Password recovery emails worden ontvangen
- ✅ Geen "605 Not delivering to previously bounced address" errors

---

**Laatste update**: January 2025
