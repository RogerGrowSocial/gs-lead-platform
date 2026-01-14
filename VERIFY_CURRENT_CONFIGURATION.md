# Verificatie Huidige Configuratie

## 🎯 Doel

Deze guide helpt je om te controleren wat je **nu** hebt ingesteld in Mailgun en Supabase, en wat er nog moet gebeuren.

---

## Stap 1: Mailgun Dashboard Check

### 1.1 Domain Status

1. Ga naar **Mailgun Dashboard**: https://app.mailgun.com/
2. Ga naar **Sending** → **Domains** → `growsocialmedia.nl`
3. Check de **domain status**:

**Status Check:**
- [ ] Domain status is **"Active"** ✅ (goed)
- [ ] Domain status is **"Sandbox"** ⚠️ (moet worden geüpgraded)
- [ ] Domain status is **"Unverified"** ❌ (DNS records niet correct)

**Wat te doen:**
- Als "Active": ✅ Perfect, ga door naar volgende stap
- Als "Sandbox": ⚠️ Je kunt alleen emails versturen naar geautoriseerde ontvangers. Upgrade naar "Active" door DNS records correct toe te voegen.
- Als "Unverified": ❌ DNS records zijn niet correct. Volg `MAILGUN_DNS_RECORDS_SETUP.md`

---

### 1.2 DNS Records Status

In dezelfde pagina, check de **"Sending records"** sectie:

**SPF Record (TXT):**
- [ ] Status: ✅ **Verified** (groen vinkje)
- [ ] Status: ⚠️ **Pending** (geel icoon - wacht op DNS propagation)
- [ ] Status: ❌ **Failed** (rood kruis - record niet gevonden)

**DKIM Record (TXT):**
- [ ] Status: ✅ **Verified** (groen vinkje)
- [ ] Status: ⚠️ **Pending** (geel icoon - wacht op DNS propagation)
- [ ] Status: ❌ **Failed** (rood kruis - record niet gevonden)

**Email Tracking (CNAME):**
- [ ] Status: ✅ **Verified** (groen vinkje)
- [ ] Status: ⚠️ **Pending** (geel icoon - wacht op DNS propagation)
- [ ] Status: ❌ **Failed** (rood kruis - record niet gevonden)

**Wat te doen:**
- Als alle records ✅ Verified zijn: Perfect! Ga door naar Stap 2
- Als records ⚠️ Pending zijn: Wacht 15-60 minuten, refresh de pagina
- Als records ❌ Failed zijn: Check `MAILGUN_DNS_RECORDS_SETUP.md` en voeg records toe aan je DNS provider

---

### 1.3 SMTP Credentials

1. Scroll naar beneden naar **"SMTP credentials"** sectie
2. Check of je een SMTP password hebt:

**SMTP Password Check:**
- [ ] Er is een SMTP password aangemaakt
- [ ] Je hebt het password gekopieerd en opgeslagen
- [ ] Het password is niet verlopen

**Wat te doen:**
- Als je **geen** SMTP password hebt:
  1. Klik op **"Add password"** (of **"Create password"**)
  2. Geef het een naam: `GrowSocial Platform Production`
  3. **KOPIEER HET PASSWORD DIRECT** - je ziet het maar één keer!
  4. Bewaar het password veilig (je hebt het nodig voor Supabase)

- Als je het password **verloren** bent:
  1. Maak een nieuw password aan
  2. Update het in Supabase (zie Stap 2)

---

## Stap 2: Supabase Dashboard Check

### 2.1 SMTP Settings Status

1. Ga naar **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecteer je project
3. Ga naar **Project Settings** (⚙️ icoon linksonder)
4. Klik op **Auth** in het linker menu
5. Scroll naar **SMTP Settings**

**Enable Custom SMTP:**
- [ ] ✅ **AAN** (checkbox aangevinkt) - Goed!
- [ ] ❌ **UIT** (checkbox niet aangevinkt) - Zet dit aan!

---

### 2.2 Sender Details Check

**Sender Email Address:**
- [ ] Ingevuld: `noreply@growsocialmedia.nl` ✅
- [ ] Ingevuld: `notificaties@growsocialmedia.nl` ✅ (ook goed)
- [ ] Ingevuld: `postmaster@growsocialmedia.nl` ⚠️ (gebruik liever noreply@)
- [ ] Leeg of ander domain ❌

**Sender Name:**
- [ ] Ingevuld: `GrowSocial` ✅
- [ ] Ingevuld: `GrowSocial Platform` ✅ (ook goed)
- [ ] Leeg of generiek ❌

**Wat te doen:**
- Als sender email leeg is of verkeerd: Vul in `noreply@growsocialmedia.nl`
- Als sender name leeg is: Vul in `GrowSocial`

---

### 2.3 SMTP Provider Settings Check

**Host:**
- [ ] Ingevuld: `smtp.eu.mailgun.org` ✅ (goed - EU region)
- [ ] Ingevuld: `smtp.mailgun.org` ⚠️ (US region, gebruik liever EU)
- [ ] Leeg of verkeerd ❌

**Port Number:**
- [ ] Ingevuld: `587` ✅ (goed - STARTTLS)
- [ ] Ingevuld: `465` ✅ (ook goed - SSL)
- [ ] Ingevuld: `25` ❌ (vaak geblokkeerd)
- [ ] Leeg ❌

**Username:**
- [ ] Ingevuld: `postmaster@growsocialmedia.nl` ✅ (volledig email adres)
- [ ] Ingevuld: alleen `postmaster` ❌ (moet volledig email zijn)
- [ ] Leeg ❌

**Password:**
- [ ] Ingevuld: [Mailgun SMTP password] ✅
- [ ] Leeg ❌
- [ ] Ingevuld maar werkt niet ⚠️ (maak nieuw password aan in Mailgun)

**Minimum Interval:**
- [ ] Ingevuld: `60` of hoger ✅
- [ ] Ingevuld: `0` of te laag ⚠️ (gebruik minstens 60)

**Wat te doen:**
- Als host verkeerd is: Verander naar `smtp.eu.mailgun.org`
- Als port verkeerd is: Verander naar `587`
- Als username niet volledig email is: Verander naar `postmaster@growsocialmedia.nl`
- Als password leeg is: Haal SMTP password op uit Mailgun (zie Stap 1.3)
- Als password niet werkt: Maak nieuw password aan in Mailgun en update hier

---

### 2.4 Test SMTP

1. Scroll naar beneden in SMTP Settings
2. Zoek naar **"Test SMTP"** knop
3. Klik erop en voer een test email adres in
4. Klik op **"Send test email"**

**Test Resultaat:**
- [ ] ✅ Test email wordt succesvol verzonden
- [ ] ✅ Test email komt aan in inbox
- [ ] ❌ Error: "SMTP authentication failed"
- [ ] ❌ Error: "Connection timeout"
- [ ] ❌ Error: "Invalid credentials"

**Wat te doen:**
- Als test succesvol is: ✅ Perfect! Ga door naar Stap 3
- Als "authentication failed": Check username en password (moet volledig email zijn)
- Als "connection timeout": Check host (`smtp.eu.mailgun.org`) en port (`587`)
- Als "invalid credentials": Maak nieuw SMTP password aan in Mailgun

---

## Stap 3: Site URL & Redirects Check

### 3.1 Site URL

1. Ga naar **Project Settings** → **API**
2. Check **Site URL**:

**Site URL Check:**
- [ ] Ingesteld: `https://app.growsocialmedia.nl` ✅
- [ ] Ingesteld: `http://localhost:3000` ⚠️ (alleen voor development)
- [ ] Leeg of verkeerd ❌

**Wat te doen:**
- Als leeg of verkeerd: Stel in op `https://app.growsocialmedia.nl`

---

### 3.2 Redirect URLs

1. Ga naar **Project Settings** → **Auth** → **URL Configuration**
2. Check **Redirect URLs**:

**Redirect URLs Check:**
- [ ] Bevat: `https://app.growsocialmedia.nl/auth/verify-email` ✅
- [ ] Bevat: `https://app.growsocialmedia.nl/auth/reset-password` ✅
- [ ] Bevat: `https://app.growsocialmedia.nl/auth/callback` ✅
- [ ] Bevat development URLs: `http://localhost:3000/auth/*` ✅ (voor development)

**Wat te doen:**
- Als URLs ontbreken: Voeg ze toe (zie `COMPLETE_SMTP_SETUP.md` Stap 4.5)

---

## Stap 4: Samenvatting & Acties

### ✅ Wat is Goed

Noteer wat al correct is ingesteld:
- [ ] Mailgun domain status: ___________
- [ ] DNS records status: ___________
- [ ] SMTP password: ___________
- [ ] Supabase SMTP configuratie: ___________
- [ ] Site URL: ___________
- [ ] Redirect URLs: ___________

---

### ⚠️ Wat Moet Worden Aangepast

Noteer wat nog moet worden gedaan:
- [ ] ___________
- [ ] ___________
- [ ] ___________

---

### 📋 Actie Lijst

Gebruik deze lijst om te tracken wat je moet doen:

**Mailgun:**
- [ ] DNS records toevoegen aan DNS provider
- [ ] Wachten op DNS propagation (15-60 minuten)
- [ ] Verifiëren dat alle records groene vinkjes hebben
- [ ] SMTP password aanmaken (als nog niet gedaan)
- [ ] SMTP password kopiëren en opslaan

**Supabase:**
- [ ] Enable custom SMTP aanzetten
- [ ] Sender details invullen
- [ ] SMTP provider settings invullen
- [ ] Test SMTP uitvoeren
- [ ] Site URL instellen
- [ ] Redirect URLs toevoegen

**Testing:**
- [ ] Password reset testen
- [ ] Email verificatie testen
- [ ] Check Mailgun logs voor delivery status

---

## Stap 5: Verificatie Tools

### 5.1 DNS Records Verificatie

Gebruik deze tools om DNS records te verifiëren:

1. **MX Toolbox SuperTool**: https://mxtoolbox.com/SuperTool.aspx
   - Voer in: `growsocialmedia.nl`
   - Selecteer "TXT"
   - Check of SPF, DKIM, DMARC records zichtbaar zijn

2. **SPF Check**: https://mxtoolbox.com/spf.aspx
   - Voer in: `growsocialmedia.nl`
   - Check of SPF record correct is

3. **DKIM Check**: https://mxtoolbox.com/dkim.aspx
   - Voer in: `growsocialmedia.nl`
   - Check of DKIM records correct zijn

---

### 5.2 Email Deliverability Test

1. **Mail Tester**: https://www.mail-tester.com/
   - Stuur een test email naar het adres dat ze geven
   - Check je score (streef naar 10/10)
   - Los alle issues op

---

## Troubleshooting

### Probleem: Alle DNS records zijn "Failed" in Mailgun

**Oplossing:**
1. Check of je de records hebt toegevoegd aan je DNS provider
2. Wacht 15-60 minuten voor DNS propagation
3. Verifieer records met MX Toolbox
4. Check of je de exacte waarden uit Mailgun hebt gebruikt

---

### Probleem: Supabase SMTP test faalt

**Oplossing:**
1. Check of Mailgun domain status "Active" is (niet "Sandbox")
2. Verifieer username is volledig email adres
3. Verifieer password is correct (maak nieuw aan als nodig)
4. Check host is `smtp.eu.mailgun.org` (niet `smtp.mailgun.org`)
5. Check port is `587` (of `465`)

---

### Probleem: Emails komen niet aan

**Oplossing:**
1. Check Mailgun Dashboard → Logs voor delivery status
2. Check spam folder
3. Verifieer DNS records zijn correct
4. Check Mailgun domain status is "Active"
5. Test met Mail Tester om score te checken

---

## Handige Links

- **Mailgun Dashboard**: https://app.mailgun.com/
- **Supabase Dashboard**: https://supabase.com/dashboard
- **MX Toolbox**: https://mxtoolbox.com/SuperTool.aspx
- **Mail Tester**: https://www.mail-tester.com/

---

## Documentatie

Voor meer details, zie:
- **`COMPLETE_SMTP_SETUP.md`** - Volledige setup guide
- **`MAILGUN_DNS_RECORDS_SETUP.md`** - DNS records setup
- **`SUPABASE_SMTP_CONFIGURATION_CHECKLIST.md`** - Supabase checklist
- **`SMTP_SETUP_QUICK_START.md`** - Quick start guide

---

**Laatste update**: January 2025
