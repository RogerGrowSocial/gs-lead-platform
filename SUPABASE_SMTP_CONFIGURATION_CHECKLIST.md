# Supabase SMTP Configuratie Checklist

## ✅ Configuratie Checklist

Gebruik deze checklist om te verifiëren dat je Supabase SMTP correct is geconfigureerd.

---

## Stap 1: Enable Custom SMTP

- [ ] **Enable custom SMTP**: ✅ **AAN** (checkbox aangevinkt)

**Status**: Als dit niet aan staat, gebruikt Supabase de standaard email service (niet aanbevolen voor productie).

---

## Stap 2: Sender Details

### 2.1 Sender Email Address

**Vul in:**
```
noreply@growsocialmedia.nl
```

**OF als je een andere sender wilt:**
```
notificaties@growsocialmedia.nl
```

**BELANGRIJK**: 
- ✅ Moet een email adres zijn van je verified domain (`growsocialmedia.nl`)
- ✅ Gebruik **niet** `postmaster@growsocialmedia.nl` als sender (gebruik dit alleen als SMTP username)
- ✅ Gebruik een professioneel email adres zoals `noreply@` of `notificaties@`

**Checklist:**
- [ ] Sender email is `noreply@growsocialmedia.nl` (of vergelijkbaar)
- [ ] Email adres is van je verified domain
- [ ] Email adres is professioneel

---

### 2.2 Sender Name

**Vul in:**
```
GrowSocial
```

**OF als je een andere naam wilt:**
```
GrowSocial Platform
```

**BELANGRIJK**:
- ✅ Gebruik je merknaam
- ✅ Gebruik geen generieke namen zoals "System" of "No Reply"
- ✅ Maximaal 50 karakters

**Checklist:**
- [ ] Sender name is `GrowSocial` (of vergelijkbaar)
- [ ] Gebruikt je merknaam
- [ ] Is professioneel

---

## Stap 3: SMTP Provider Settings

### 3.1 Host

**Vul in:**
```
smtp.eu.mailgun.org
```

**BELANGRIJK**:
- ✅ Gebruik **EU region** (`smtp.eu.mailgun.org`) voor GDPR compliance
- ❌ Gebruik **NIET** `smtp.mailgun.org` (dat is US region)
- ✅ Geen trailing slash of extra karakters

**Checklist:**
- [ ] Host is `smtp.eu.mailgun.org`
- [ ] Geen typos of extra karakters
- [ ] EU region (niet US)

---

### 3.2 Port Number

**Vul in:**
```
587
```

**BELANGRIJK**:
- ✅ Gebruik poort **587** (STARTTLS) - aanbevolen
- ✅ Alternatief: poort **465** (SSL/TLS) - ook goed
- ❌ Gebruik **NIET** poort 25 (vaak geblokkeerd)

**Checklist:**
- [ ] Port is `587` (of `465`)
- [ ] Port is **niet** `25`

---

### 3.3 Username

**Vul in:**
```
postmaster@growsocialmedia.nl
```

**BELANGRIJK**:
- ✅ Moet een **volledig email adres** zijn van je verified domain
- ✅ Mailgun accepteert alleen volledige email adressen als username
- ✅ Gebruik `postmaster@` of een ander email adres van je domain
- ❌ Gebruik **niet** alleen `postmaster` (zonder @domain)

**Checklist:**
- [ ] Username is `postmaster@growsocialmedia.nl` (volledig email adres)
- [ ] Email adres is van je verified domain
- [ ] Geen typos

---

### 3.4 Password

**Vul in:**
```
[Je Mailgun SMTP password]
```

**BELANGRIJK**:
- ✅ Dit is het **SMTP password** dat je hebt aangemaakt in Mailgun Dashboard
- ✅ **NIET** je Mailgun account wachtwoord
- ✅ **NIET** je Mailgun API key
- ✅ Moet worden aangemaakt in: Mailgun Dashboard → Sending → Domains → growsocialmedia.nl → SMTP credentials → Add password
- ⚠️ Je kunt het password niet meer zien na het opslaan (veilig)

**Hoe SMTP password aan te maken:**
1. Ga naar Mailgun Dashboard → **Sending** → **Domains** → `growsocialmedia.nl`
2. Scroll naar **SMTP credentials** sectie
3. Klik op **Add password** (of **Create password**)
4. Geef het een naam: `GrowSocial Platform Production`
5. **KOPIEER HET PASSWORD DIRECT** - je ziet het maar één keer!
6. Plak het in Supabase SMTP Password veld

**Checklist:**
- [ ] Password is aangemaakt in Mailgun Dashboard
- [ ] Password is gekopieerd en geplakt (niet getypt)
- [ ] Password is **niet** je Mailgun account wachtwoord
- [ ] Password is **niet** je Mailgun API key

---

### 3.5 Minimum Interval Per User

**Vul in:**
```
60
```

**Uitleg**:
- Dit is het minimum aantal seconden tussen emails naar dezelfde gebruiker
- `60` seconden = 1 minuut (aanbevolen)
- Voorkomt spam en rate limiting issues

**Checklist:**
- [ ] Minimum interval is `60` seconden (of hoger)
- [ ] Niet te laag (bijv. 0 of 1)

---

## Stap 4: Opslaan en Testen

### 4.1 Opslaan

1. Controleer alle velden nog een keer
2. Klik op **"Save changes"**
3. Wacht tot je een success message ziet

**Checklist:**
- [ ] Alle velden zijn correct ingevuld
- [ ] "Save changes" is geklikt
- [ ] Success message is zichtbaar

---

### 4.2 Test SMTP

1. Scroll naar beneden in Supabase SMTP Settings
2. Zoek naar **"Test SMTP"** knop (of vergelijkbaar)
3. Klik op **"Test SMTP"**
4. Voer een test email adres in
5. Klik op **"Send test email"**
6. Check je inbox (en spam folder)

**Checklist:**
- [ ] Test SMTP is uitgevoerd
- [ ] Test email is verzonden
- [ ] Test email komt aan in inbox (niet spam)
- [ ] Geen errors in Supabase logs

---

## Volledige Configuratie Overzicht

Hier is een overzicht van alle waarden die je moet invullen:

```
✅ Enable custom SMTP: AAN

Sender Details:
  Sender email: noreply@growsocialmedia.nl
  Sender name: GrowSocial

SMTP Provider Settings:
  Host: smtp.eu.mailgun.org
  Port: 587
  Username: postmaster@growsocialmedia.nl
  Password: [Je Mailgun SMTP password]
  Minimum interval: 60
```

---

## Veelvoorkomende Fouten

### ❌ Fout 1: Verkeerde Host

**Fout:**
```
smtp.mailgun.org
```

**Goed:**
```
smtp.eu.mailgun.org
```

**Waarom**: EU region is nodig voor GDPR compliance.

---

### ❌ Fout 2: Username zonder @domain

**Fout:**
```
postmaster
```

**Goed:**
```
postmaster@growsocialmedia.nl
```

**Waarom**: Mailgun accepteert alleen volledige email adressen als username.

---

### ❌ Fout 3: Verkeerd Password

**Fout:**
- Mailgun account wachtwoord
- Mailgun API key
- Een willekeurig wachtwoord

**Goed:**
- SMTP password aangemaakt in Mailgun Dashboard → Domain Settings → SMTP credentials

**Waarom**: Alleen SMTP passwords werken voor SMTP authenticatie.

---

### ❌ Fout 4: Sender Email = Username

**Fout:**
- Sender email: `postmaster@growsocialmedia.nl`
- Username: `postmaster@growsocialmedia.nl`

**Goed:**
- Sender email: `noreply@growsocialmedia.nl`
- Username: `postmaster@growsocialmedia.nl`

**Waarom**: Sender email is wat gebruikers zien, username is voor authenticatie. Ze kunnen verschillend zijn zolang ze van hetzelfde domain zijn.

---

## Verificatie Na Configuratie

### 1. Test Password Reset

1. Ga naar je login pagina
2. Klik op "Wachtwoord vergeten?"
3. Voer een email adres in
4. Check of email aankomt

**Checklist:**
- [ ] Password reset email wordt verzonden
- [ ] Email komt aan in inbox
- [ ] Reset link werkt

---

### 2. Test Email Verificatie

1. Maak een nieuwe gebruiker aan
2. Check of verificatie email aankomt
3. Klik op verificatie link
4. Controleer of link werkt

**Checklist:**
- [ ] Verificatie email wordt verzonden
- [ ] Email komt aan in inbox
- [ ] Verificatie link werkt

---

### 3. Check Supabase Logs

1. Ga naar Supabase Dashboard → **Logs** → **Auth Logs**
2. Check voor email sending events
3. Check voor errors

**Checklist:**
- [ ] Geen SMTP errors in logs
- [ ] Emails worden succesvol verzonden
- [ ] Geen authentication errors

---

## Troubleshooting

### Probleem: "SMTP authentication failed"

**Oplossing:**
1. ✅ Verifieer dat username volledig email adres is
2. ✅ Verifieer dat password correct is (kopieer opnieuw uit Mailgun)
3. ✅ Check of Mailgun domain niet in Sandbox Mode staat
4. ✅ Test SMTP verbinding met Mailgun Dashboard

---

### Probleem: "Connection timeout"

**Oplossing:**
1. ✅ Verifieer host is `smtp.eu.mailgun.org` (niet `smtp.mailgun.org`)
2. ✅ Verifieer port is `587` (of `465`)
3. ✅ Check firewall/network settings
4. ✅ Test met Mailgun Dashboard → Test SMTP

---

### Probleem: "Emails komen niet aan"

**Oplossing:**
1. ✅ Check Mailgun Dashboard → Logs voor delivery status
2. ✅ Check spam folder
3. ✅ Verifieer DNS records zijn correct (SPF, DKIM, DMARC)
4. ✅ Check Mailgun domain status (moet "Active" zijn)

---

## Handige Links

- **Supabase Dashboard**: https://supabase.com/dashboard
- **Mailgun Dashboard**: https://app.mailgun.com/
- **Complete SMTP Setup**: `COMPLETE_SMTP_SETUP.md`
- **Quick Start**: `SMTP_SETUP_QUICK_START.md`

---

**Laatste update**: January 2025
