# Email Notificatie Systeem - Overzicht

## ✅ Geïmplementeerd

### Database Migratie
- Bestand: `add_new_notification_columns.sql`
- Voegt nieuwe kolommen toe voor alle notificatie types

### Email Templates
Alle templates zijn gemaakt in `templates/emails/`:
1. ✅ `quota_warning.html` - Quota waarschuwing (80%)
2. ✅ `quota_reached.html` - Quota volledig gebruikt
3. ✅ `lead_assigned.html` - Lead toegewezen
4. ✅ `lead_status_changed.html` - Lead status gewijzigd
5. ✅ `subscription_expiring.html` - Abonnement loopt af
6. ✅ `subscription_expired.html` - Abonnement verlopen
7. ✅ `login_from_new_device.html` - Nieuwe inlog vanaf nieuw apparaat

### Services
- ✅ `services/notificationService.js` - Notification service die settings checkt en emails verstuurt
- ✅ `services/emailService.js` - Email service met template rendering

### UI
- ✅ Notificatie instellingen pagina met alle nieuwe opties
- ✅ Automatisch opslaan bij wijzigingen

## 📋 Volgende Stappen

### 1. Database Migratie Uitvoeren
Voer eerst de migratie uit in Supabase SQL Editor:
```sql
-- Zie: add_new_notification_columns.sql
```

### 2. Email Service Integreren
De `emailService.sendEmail()` functie moet worden geïntegreerd met je bestaande email systeem (nodemailer/Mailgun).

**Voorbeeld implementatie:**
```javascript
// In services/emailService.js
async sendEmail(emailData) {
  const nodemailer = require('nodemailer');
  
  // Configure transporter (gebruik je bestaande configuratie)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.eu.mailgun.org',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'notificaties@growsocialmedia.nl',
    to: emailData.to,
    subject: emailData.subject,
    html: emailData.html
  });
  
  return true;
}
```

### 3. Notification Service Gebruiken
Gebruik de notification service in je code:

```javascript
const notificationService = require('./services/notificationService');

// Quota waarschuwing versturen
await notificationService.sendQuotaWarning(userId, {
  leads_used: 80,
  monthly_quota: 100,
  leads_remaining: 20,
  usage_percentage: 80,
  quota_reset_date: '1 februari 2025'
});

// Lead toegewezen versturen
await notificationService.sendLeadAssigned(userId, {
  company_name: 'Voorbeeld BV',
  contact_name: 'Jan Jansen',
  email: 'jan@voorbeeld.nl',
  phone: '0612345678',
  industry: 'ICT',
  lead_id: 'lead-uuid'
});
```

### 4. Integratie Punten

**Quota waarschuwingen:**
- Check bij lead assignment of quota wordt bereikt
- Verstuur bij 80% en 100%

**Lead assignment:**
- Verstuur wanneer `assigned_to` wordt gezet op een lead

**Subscription notificaties:**
- Check dagelijks via cron job welke subscriptions aflopen
- Verstuur 7 dagen voor afloop en op afloopdatum

**Login notificaties:**
- Check in login route of locatie/apparaat nieuw is
- Verstuur via `utils/loginHistory.js`

## 📧 Template Variabelen

Elke template gebruikt standaard variabelen:
- `{{first_name}}` - Voornaam gebruiker
- `{{last_name}}` - Achternaam gebruiker
- `{{company_name}}` - Bedrijfsnaam
- `{{email}}` - Email gebruiker
- `{{dashboard_url}}` - URL naar dashboard

Specifieke variabelen per template staan in de template bestanden.

