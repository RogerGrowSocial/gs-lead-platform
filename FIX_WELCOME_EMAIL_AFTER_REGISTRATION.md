# Fix: Welcome Email Na Registratie

## 🎯 Probleem

Na registratie werd geen welcome email met password setup link verzonden. Alleen de verificatie email werd verzonden (als email confirmation aan staat).

## ✅ Oplossing

Welcome email is toegevoegd aan de registratie flow in `routes/auth.js`.

### Wat is er gedaan:

1. **Welcome email toegevoegd** na succesvolle registratie
2. **Password reset link gegenereerd** voor welcome email
3. **Asynchroon verzonden** (niet-blocking) zodat registratie response niet wordt vertraagd
4. **User profile data opgehaald** (first_name, last_name) voor gepersonaliseerde email
5. **Success message geüpdatet** om te vermelden dat welcome email is verzonden

---

## 🔍 Hoe Het Werkt

### Stap 1: User Registreert

1. User vult registratie formulier in
2. `supabase.auth.signUp()` wordt aangeroepen
3. User wordt aangemaakt in Supabase

### Stap 2: Welcome Email Wordt Verzonden (Nieuw)

Na succesvolle registratie:
1. Password reset link wordt gegenereerd via `supabaseAdmin.auth.admin.generateLink()`
2. User profile data wordt opgehaald (first_name, last_name)
3. Welcome email wordt verzonden via `emailService.sendWelcomeEmail()`
4. Email bevat password setup link

### Stap 3: User Ontvangt Emails

User ontvangt:
- ✅ **Verificatie email** (van Supabase, als email confirmation aan staat)
- ✅ **Welcome email** (van platform, met password setup link)

---

## 📧 Email Flow

### Scenario 1: Email Confirmation AAN

1. User registreert
2. Supabase stuurt **verificatie email**
3. Platform stuurt **welcome email** (nieuw!)
4. User verifieert email
5. User klikt op password setup link in welcome email
6. User stelt wachtwoord in

### Scenario 2: Email Confirmation UIT

1. User registreert
2. User heeft direct sessie (geen verificatie nodig)
3. Platform stuurt **welcome email** (nieuw!)
4. User klikt op password setup link in welcome email
5. User stelt wachtwoord in (of gebruikt bestaand wachtwoord)

---

## 🔧 Technische Details

### Code Locatie

**File**: `routes/auth.js`  
**Function**: `router.post("/register", ...)`  
**Line**: Na user creation, voor email confirmation check

### Implementatie

```javascript
// Send welcome email with password setup link (non-blocking)
(async () => {
  try {
    // Generate password reset link
    const { data: resetData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${req.protocol}://${req.get('host')}/auth/reset-password`
      }
    });
    
    // Get user profile data
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', data.user.id)
      .maybeSingle();
    
    // Send welcome email
    const EmailService = require('../services/emailService');
    const emailService = new EmailService();
    
    await emailService.sendWelcomeEmail({
      email,
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || ''
    }, resetData.properties?.action_link);
  } catch (emailErr) {
    // Log error but don't block registration
    console.error("Error sending welcome email:", emailErr);
  }
})();
```

### Belangrijke Punten

- ✅ **Non-blocking**: Email wordt asynchroon verzonden, blokkeert registratie niet
- ✅ **Error handling**: Errors worden gelogd maar blokkeren registratie niet
- ✅ **Dual SMTP**: Gebruikt de nieuwe dual SMTP configuratie (Mailgun/Mijndomein)
- ✅ **Personalized**: Gebruikt first_name en last_name uit profile

---

## 🧪 Testen

### Test 1: Registratie met Extern Email

1. Registreer met Gmail adres
2. Check inbox:
   - [ ] Verificatie email (van Supabase)
   - [ ] Welcome email (van platform)
3. Check welcome email:
   - [ ] Bevat password setup link
   - [ ] Link werkt
   - [ ] Email gebruikt Mailgun SMTP (externe email)

### Test 2: Registratie met Intern Email

1. Registreer met `serve@growsocialmedia.nl`
2. Check inbox:
   - [ ] Verificatie email (van Supabase)
   - [ ] Welcome email (van platform)
3. Check welcome email:
   - [ ] Bevat password setup link
   - [ ] Link werkt
   - [ ] Email gebruikt Mijndomein SMTP (interne email)

### Test 3: Check Logs

1. Check server logs na registratie:
   - [ ] "📧 Attempting to send welcome email to: [email]"
   - [ ] "✅ Password reset link generated for welcome email"
   - [ ] "✅ Welcome email sent successfully to: [email]"

---

## ⚠️ Belangrijk

### Email Verzending is Non-Blocking

- Welcome email wordt **asynchroon** verzonden
- Registratie response wordt **niet vertraagd**
- Als email verzending faalt, wordt dit gelogd maar blokkeert registratie niet

### Dual SMTP Configuratie

- **Externe emails** (Gmail, etc.) → Via Mailgun SMTP
- **Interne emails** (`@growsocialmedia.nl`) → Via Mijndomein SMTP
- Automatische detectie op basis van email domein

### Environment Variables Nodig

Zorg dat deze zijn ingesteld:
- `MAILGUN_SMTP_*` - Voor externe emails
- `MIJNDOMEIN_SMTP_*` - Voor interne emails (optioneel, alleen als je interne emails wilt)

---

## 🔍 Troubleshooting

### Probleem: Welcome Email Komt Niet Aan

**Check:**
1. Server logs voor errors
2. Email service logs
3. Mailgun/Mijndomein logs
4. Spam folder

**Oplossing:**
- Check SMTP configuratie
- Check environment variables
- Check email service logs

### Probleem: Password Setup Link Werkt Niet

**Check:**
1. Link is correct gegenereerd
2. Redirect URL is correct
3. Link is niet verlopen

**Oplossing:**
- Check `redirectTo` URL in code
- Verifieer reset-password route werkt
- Check Supabase Auth settings

---

## ✅ Checklist

- [ ] Welcome email wordt verzonden na registratie
- [ ] Email bevat password setup link
- [ ] Link werkt correct
- [ ] Externe emails gebruiken Mailgun
- [ ] Interne emails gebruiken Mijndomein (als geconfigureerd)
- [ ] Errors worden gelogd maar blokkeren registratie niet
- [ ] Success message vermeldt welcome email

---

**Laatste update**: January 2025
