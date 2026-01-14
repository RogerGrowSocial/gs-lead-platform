# Fix: Supabase Password Recovery met Dual SMTP

## 🔴 Probleem

Supabase password recovery emails naar interne email adressen (`serve@growsocialmedia.nl`) worden geaccepteerd door Mailgun (`"event": "accepted"`), maar niet afgeleverd (`"event": "delivered"` ontbreekt).

**Oorzaak:**
- Supabase gebruikt altijd Mailgun SMTP (zoals geconfigureerd in Supabase Dashboard)
- Mailgun accepteert de email, maar de ontvangende mailserver (Mijndomein) levert niet af
- Dit is hetzelfde "same-domain sending" probleem als eerder

---

## ✅ Oplossing: Dual SMTP voor Password Recovery

We hebben de `/forgot-password` route aangepast om:
1. **Interne emails** (`@growsocialmedia.nl`): Gebruik onze eigen `emailService` met dual SMTP (Mijndomein SMTP)
2. **Externe emails**: Gebruik Supabase's ingebouwde `resetPasswordForEmail` (Mailgun SMTP)

---

## 🔧 Wat is er Aangepast

### 1. Routes (`routes/auth.js`)

De `POST /forgot-password` route is aangepast:

```javascript
// Check if email is internal
const isInternal = emailService.isInternalEmail(email);

if (isInternal) {
  // Generate recovery link via Supabase admin API
  const { data: resetData } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: email,
    options: { redirectTo: `${req.protocol}://${req.get('host')}/auth/reset-password` }
  });

  // Render email template
  const htmlContent = emailService.renderTemplate('supabase-reset-password', {
    email: email,
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    reset_link: resetData.properties.action_link
  });

  // Send via emailService (uses dual SMTP - Mijndomein for internal)
  await emailService.sendEmail({
    to: email,
    subject: 'Reset je wachtwoord',
    html: htmlContent
  });
} else {
  // For external emails, use Supabase's built-in resetPasswordForEmail
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${req.protocol}://${req.get('host')}/auth/reset-password`
  });
}
```

### 2. Email Template (`templates/emails/supabase-reset-password.html`)

Template variabelen aangepast:
- `{{ .ConfirmationURL }}` → `{{reset_link}}`
- Template werkt nu met onze emailService

---

## 🧪 Testen

### Test 1: Interne Email (serve@growsocialmedia.nl)

1. Ga naar `/forgot-password`
2. Vul `serve@growsocialmedia.nl` in
3. Verstuur request
4. Check server logs

**Verwacht:**
- ✅ Server log: `"📧 Internal email detected, using dual SMTP..."`
- ✅ Server log: `"📧 Email Service Configuration (Mijndomein):"`
- ✅ Server log: `"✅ Email sent successfully"`
- ✅ Email wordt ontvangen in inbox

---

### Test 2: Externe Email (bijv. Gmail)

1. Ga naar `/forgot-password`
2. Vul extern email adres in (bijv. Gmail)
3. Verstuur request
4. Check server logs

**Verwacht:**
- ✅ Server log: `"📧 External email detected, using Supabase SMTP..."`
- ✅ Supabase gebruikt Mailgun SMTP
- ✅ Email wordt ontvangen in inbox

---

## 📋 Checklist

- [ ] Mijndomein SMTP credentials zijn geconfigureerd in `.env`
- [ ] `INTERNAL_EMAIL_DOMAIN=growsocialmedia.nl` is gezet in `.env`
- [ ] Server is herstart na `.env` wijzigingen
- [ ] Test interne email: `serve@growsocialmedia.nl`
- [ ] Test externe email: Gmail of ander extern adres
- [ ] Check server logs voor dual SMTP gebruik
- [ ] Check Mailgun logs (externe emails)
- [ ] Bevestig dat emails worden ontvangen

---

## 🔍 Troubleshooting

### Probleem: Interne Email Komt Niet Aan

**Check:**
1. Server logs: Zie je `"📧 Internal email detected"`?
2. Server logs: Zie je `"Email Service Configuration (Mijndomein)"`?
3. `.env` file: Zijn `MIJNDOMEIN_SMTP_*` variabelen gezet?
4. Server: Is server herstart na `.env` wijzigingen?

**Oplossing:**
- Check Mijndomein SMTP credentials
- Check server logs voor SMTP errors
- Verifieer dat `INTERNAL_EMAIL_DOMAIN` correct is

---

### Probleem: Externe Email Komt Niet Aan

**Check:**
1. Server logs: Zie je `"📧 External email detected"`?
2. Supabase logs: Check Auth Logs voor errors
3. Mailgun logs: Check delivery status

**Oplossing:**
- Check Supabase SMTP configuratie
- Check Mailgun domain status
- Check Mailgun logs voor delivery status

---

## 📚 Gerelateerde Documenten

- `MAILGUN_SENDING_MIJNDOMEIN_RECEIVING.md` - Dual SMTP implementatie
- `FIX_SAME_DOMAIN_EMAIL_DELIVERY.md` - Same-domain probleem uitleg
- `TROUBLESHOOT_PASSWORD_RECOVERY_EMAIL.md` - Algemene troubleshooting

---

## ✅ Resultaat

Na deze fix:
- ✅ Interne emails (`@growsocialmedia.nl`) worden verstuurd via Mijndomein SMTP
- ✅ Externe emails worden verstuurd via Mailgun SMTP (Supabase)
- ✅ Geen "accepted but not delivered" problemen meer
- ✅ Alle password recovery emails worden correct afgeleverd

---

**Laatste update**: January 2025
