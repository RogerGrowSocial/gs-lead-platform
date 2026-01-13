# Externe Apps - Overzicht

Kort overzicht van de 3 externe services die gebruikt worden in het platform.

---

## 🔷 Supabase

**Wat het is:** Database + Authentication + Real-time backend

**Gebruikt voor:**
- Database (PostgreSQL)
- User authenticatie
- Email templates (signup, reset password, etc.)
- Row Level Security (RLS)

**Belangrijke configuratie:**
- **Dashboard:** https://supabase.com/dashboard
- **Project URL:** `SUPABASE_URL` (in `.env`)
- **API Key:** `SUPABASE_KEY` (in `.env`)
- **Admin Key:** `SUPABASE_SERVICE_ROLE_KEY` (voor admin operaties)

**Email Templates:**
- Locatie: `templates/emails/supabase-*.html`
- Configuratie: Dashboard → Authentication → Email Templates
- SMTP: Dashboard → Project Settings → Auth → SMTP Settings

**Documentatie:**
- Setup: `SUPABASE_EMAIL_SETUP.md`
- Migratie: `SUPABASE_MIGRATION_README.md`

---

## 📱 Twilio

**Wat het is:** WhatsApp messaging service

**Gebruikt voor:**
- WhatsApp notificaties naar gebruikers
- Lead assignment notificaties

**Belangrijke configuratie:**
- **Dashboard:** https://console.twilio.com/
- **Account SID:** `TWILIO_ACCOUNT_SID` (in `.env`)
- **Auth Token:** `TWILIO_AUTH_TOKEN` (in `.env`)
- **WhatsApp From:** `TWILIO_WHATSAPP_FROM` (in `.env`)
- **Content SID:** `TWILIO_CONTENT_SID` (optioneel, in `.env`)

**Setup:**
1. Account aanmaken op https://www.twilio.com/
2. WhatsApp toegang aanvragen
3. Credentials toevoegen aan `.env`
4. Service: `services/whatsappService.js`

**Documentatie:**
- Volledige setup: `TWILIO_SETUP.md`
- Status: `TWILIO_STATUS.md` / `TWILIO_PRODUCTION.md`

---

## 📧 Mailgun

**Wat het is:** Email delivery service (SMTP)

**Gebruikt voor:**
- Transactionele emails
- Notificatie emails
- Supabase SMTP backend

**Belangrijke configuratie:**
- **Dashboard:** https://app.mailgun.com/
- **Domain:** `growsocialmedia.nl`
- **SMTP Host:** `smtp.eu.mailgun.org` (EU region)
- **SMTP Port:** `587`
- **SMTP Username:** `postmaster@growsocialmedia.nl`
- **SMTP Password:** (van Mailgun dashboard)

**DNS Records nodig:**
- SPF record
- DKIM records (2-3 stuks)
- DMARC record (optioneel)

**Setup:**
1. Account aanmaken op https://www.mailgun.com/
2. Domain toevoegen (`growsocialmedia.nl`)
3. DNS records toevoegen bij domein provider
4. SMTP credentials ophalen
5. Configureren in Supabase (SMTP Settings)

**Documentatie:**
- Volledige setup: `MAILGUN_SETUP.md`
- Input handleiding: `MAILGUN_INVOER_HANDLEIDING.md`

---

## 🔐 Environment Variables

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_CONTENT_SID=HXxxxxx

# Mailgun (via Supabase SMTP configuratie)
# Geen directe env vars nodig - configureer in Supabase dashboard
```

---

## 📝 Quick Links

- **Supabase Dashboard:** https://supabase.com/dashboard
- **Twilio Console:** https://console.twilio.com/
- **Mailgun Dashboard:** https://app.mailgun.com/

---

**Laatste update:** 2024

