# SPF Probleem Oplossen

## Huidige Situatie
- **Error**: `554 5.7.1 : End-of-data rejected: SPF Incorrect`
- **Oorzaak**: Je verzendt via `mail.mijndomein.nl`, maar de ontvangende server checkt of je server IP is toegestaan in het SPF record
- **Huidige SPF**: `v=spf1 include:spf.mijndomeinhosting.nl include:_spf.wpcloud.com ~all`

## Oplossingen (in volgorde van voorkeur)

### ✅ Oplossing 1: SPF Record Aanpassen (Snelste Fix)

**Mijndomein DNS Dashboard:**
1. Log in bij Mijndomein
2. Ga naar **DNS Beheer** voor `growsocialmedia.nl`
3. Zoek de **TXT record** met `v=spf1`
4. Verander `~all` naar `?all` (neutraal, alles toestaan maar niet expliciet goedkeuren)

   ```
   v=spf1 include:spf.mijndomeinhosting.nl include:_spf.wpcloud.com ?all
   ```

**Waarom dit werkt:**
- `?all` is neutraal - servers accepteren emails maar markeren ze niet als "goedgekeurd"
- Dit is veiliger dan geen SPF record, maar blokkeert geen emails

**Wachttijd:** 5-60 minuten (DNS propagation)

---

### ✅ Oplossing 2: Vraag Mijndomein Support

**Stuur dit bericht naar Mijndomein support:**

> Hallo,
> 
> Ik heb een probleem met SPF authenticatie bij het verzenden van emails via mail.mijndomein.nl.
> 
> Mijn situatie:
> - Domein: growsocialmedia.nl
> - SMTP Server: mail.mijndomein.nl:465
> - Error: `554 5.7.1 : End-of-data rejected: SPF Incorrect`
> 
> Vragen:
> 1. Welk IP adres moet ik toevoegen aan mijn SPF record om via mail.mijndomein.nl te kunnen verzenden?
> 2. Is er een speciale SMTP relay/configuratie die ik moet gebruiken?
> 3. Moet ik een andere SMTP host gebruiken (bijv. smtp.mijndomein.nl)?
> 
> Alvast bedankt!

---

### ✅ Oplossing 3: Alternatieve SMTP Service

Als Mijndomein niet kan helpen, overweeg een professionele email service:

#### SendGrid (Gratis: 100 emails/dag)
```javascript
// In mailbox settings:
SMTP Host: smtp.sendgrid.net
SMTP Port: 587
SMTP Secure: false (STARTTLS)
Username: apikey
Password: [je SendGrid API key]
```

**SPF Record toevoegen:**
```
v=spf1 include:spf.mijndomeinhosting.nl include:_spf.wpcloud.com include:sendgrid.net ~all
```

#### Mailgun (Gratis: 5,000 emails/maand)
```javascript
// In mailbox settings:
SMTP Host: smtp.mailgun.org
SMTP Port: 587
SMTP Secure: false (STARTTLS)
Username: [je Mailgun SMTP username]
Password: [je Mailgun SMTP password]
```

**SPF Record toevoegen:**
```
v=spf1 include:spf.mijndomeinhosting.nl include:_spf.wpcloud.com include:mailgun.org ~all
```

---

## Testen

Na het aanpassen van het SPF record:

1. **Check je SPF record:**
   ```bash
   dig +short TXT growsocialmedia.nl | grep spf
   ```

2. **Test je SPF record:**
   - Ga naar: https://mxtoolbox.com/spf.aspx
   - Voer `growsocialmedia.nl` in
   - Check of alle includes correct zijn

3. **Test email verzenden:**
   - Probeer een test email te versturen vanuit de mail interface
   - Check de server logs voor errors

---

## Waarom dit gebeurt

1. Je verzendt via `mail.mijndomein.nl` (Mijndomein's SMTP server)
2. De ontvangende server checkt het SPF record van `growsocialmedia.nl`
3. Het SPF record staat `include:spf.mijndomeinhosting.nl` (toegestaan)
4. MAAR: Sommige servers checken ook het **originele client IP** (jouw server)
5. Als jouw server IP niet in het SPF record staat, krijg je een SPF error

**Fix**: Door `?all` te gebruiken, accepteert de server emails maar geeft geen expliciete goedkeuring. Dit voorkomt blokkades.

---

## Direct Action Steps

1. ✅ Update SPF record naar `?all` (5 minuten)
2. ⏳ Wacht 30-60 minuten voor DNS propagation
3. ✅ Test email verzenden
4. ✅ Als het nog steeds niet werkt → Contact Mijndomein support

