# SMTP Setup - Quick Start

## 🚀 Snelle Start voor Complete SMTP Configuratie

Deze quick start guide helpt je om snel je SMTP in te stellen. Voor volledige details, zie **`COMPLETE_SMTP_SETUP.md`**.

---

## Stap 1: Mailgun Domain (5 minuten)

1. Ga naar https://app.mailgun.com/ → **Sending** → **Domains**
2. Voeg toe: `growsocialmedia.nl` (EU region)
3. Kopieer de DNS records die Mailgun geeft

---

## Stap 2: DNS Records (10 minuten)

Voeg toe in je DNS provider:

### SPF Record (TXT)
```
Name: @
Value: v=spf1 include:mailgun.org ~all
```

### DKIM Records (TXT)
- Voeg alle DKIM records toe die Mailgun geeft (2-3 records)

### DMARC Record (TXT)
```
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@growsocialmedia.nl
```

**Wacht 15-60 minuten** voor DNS propagation.

---

## Stap 3: Mailgun SMTP Password (2 minuten)

1. Mailgun Dashboard → **Sending** → **Domains** → `growsocialmedia.nl`
2. Scroll naar **SMTP credentials**
3. Klik **Add password**
4. **KOPIEER HET PASSWORD** (je ziet het maar één keer!)

---

## Stap 4: Supabase SMTP (5 minuten)

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

## Stap 5: Site URL & Redirects (2 minuten)

1. Supabase Dashboard → **Project Settings** → **API**
2. Site URL: `https://app.growsocialmedia.nl`
3. **Project Settings** → **Auth** → **URL Configuration**
4. Redirect URLs:
   ```
   https://app.growsocialmedia.nl/auth/verify-email
   https://app.growsocialmedia.nl/auth/reset-password
   https://app.growsocialmedia.nl/auth/callback
   ```

---

## Stap 6: Environment Variables (1 minuut)

Voeg toe aan `.env`:

```env
MAILGUN_SMTP_HOST=smtp.eu.mailgun.org
MAILGUN_SMTP_PORT=587
MAILGUN_SMTP_USER=postmaster@growsocialmedia.nl
MAILGUN_SMTP_PASS=[Je Mailgun SMTP password]
MAILGUN_DOMAIN=growsocialmedia.nl
EMAIL_FROM=noreply@growsocialmedia.nl
APP_URL=https://app.growsocialmedia.nl
BASE_URL=https://app.growsocialmedia.nl
```

---

## Stap 7: Verificatie (5 minuten)

1. **Mailgun**: Check of alle DNS records groene vinkjes hebben ✅
2. **Supabase**: Test SMTP met "Test SMTP" knop
3. **Test**: Stuur een password reset email en check of deze aankomt

---

## ✅ Klaar!

Je SMTP is nu geconfigureerd. Test het met:
- Password reset functionaliteit
- Email verificatie bij registratie
- Platform notificaties

---

## 📚 Volledige Documentatie

Voor complete details, best practices, en troubleshooting:
- **`COMPLETE_SMTP_SETUP.md`** - Volledige setup guide
- **`DNS_VERIFICATION_CHECKLIST.md`** - DNS verificatie checklist
- **`SUPABASE_EMAIL_SETUP.md`** - Supabase email templates setup

---

**Domein**: `app.growsocialmedia.nl`  
**Mailgun Domain**: `growsocialmedia.nl`
