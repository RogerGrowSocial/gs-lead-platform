# Mailgun voor Sending, Mijndomein voor Receiving

## 🎯 Doel

**Configuratie:**
- ✅ Mailgun voor **sending** (SMTP) - blijft zoals het nu is
- ✅ Mijndomein voor **receiving** (MX records) - emails ontvangen
- ✅ Emails naar `@growsocialmedia.nl` moeten aankomen

**Probleem:**
- Emails van Mailgun naar `@growsocialmedia.nl` komen niet aan
- Same-domain sending conflict

---

## ✅ Oplossing: Dual SMTP Configuratie

**Strategie:**
- Externe emails (Gmail, etc.) → Via Mailgun ✅
- Interne emails (`@growsocialmedia.nl`) → Via Mijndomein SMTP ✅

---

## Stap 1: Configureer Mijndomein SMTP voor Interne Emails

### 1.1 Haal Mijndomein SMTP Credentials Op

1. Log in op je Mijndomein account
2. Ga naar **Email** → **SMTP instellingen**
3. Noteer:
   - **SMTP Host**: `mail.mijndomein.nl` (of wat Mijndomein aangeeft)
   - **SMTP Port**: `587` (of `465` voor SSL)
   - **SMTP Username**: `serve@growsocialmedia.nl` (of je email)
   - **SMTP Password**: Je Mijndomein email wachtwoord

---

## Stap 2: Implementeer Dual SMTP in Code

### 2.1 Update Email Service

We moeten de email service aanpassen om te detecteren of een email intern is en dan Mijndomein SMTP te gebruiken.

**Optie A: Update `services/emailService.js`**

```javascript
// services/emailService.js
const nodemailer = require('nodemailer');

class EmailService {
  // ... bestaande code ...

  /**
   * Detect if email is internal (same domain)
   */
  isInternalEmail(email) {
    const internalDomain = process.env.INTERNAL_EMAIL_DOMAIN || 'growsocialmedia.nl';
    return email.toLowerCase().endsWith(`@${internalDomain}`);
  }

  /**
   * Get SMTP configuration based on email type
   */
  getSMTPConfig(email) {
    const isInternal = this.isInternalEmail(email);

    if (isInternal) {
      // Use Mijndomein SMTP for internal emails
      return {
        host: process.env.MIJNDOMEIN_SMTP_HOST || 'mail.mijndomein.nl',
        port: parseInt(process.env.MIJNDOMEIN_SMTP_PORT || '587'),
        secure: process.env.MIJNDOMEIN_SMTP_PORT === '465',
        auth: {
          user: process.env.MIJNDOMEIN_SMTP_USER || 'noreply@growsocialmedia.nl',
          pass: process.env.MIJNDOMEIN_SMTP_PASS
        }
      };
    } else {
      // Use Mailgun SMTP for external emails
      const mailgunDomain = process.env.MAILGUN_DOMAIN || 'growsocialmedia.nl';
      return {
        host: process.env.MAILGUN_SMTP_HOST || 'smtp.eu.mailgun.org',
        port: parseInt(process.env.MAILGUN_SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.MAILGUN_SMTP_USER || `postmaster@${mailgunDomain}`,
          pass: process.env.MAILGUN_SMTP_PASS
        }
      };
    }
  }

  /**
   * Send email using appropriate SMTP
   */
  async sendEmail(emailData) {
    try {
      const { to, subject, html } = emailData;
      
      if (!to || !subject || !html) {
        throw new Error('Missing required email fields: to, subject, html');
      }

      const isInternal = this.isInternalEmail(to);
      const smtpConfig = this.getSMTPConfig(to);
      const emailFrom = isInternal 
        ? (process.env.MIJNDOMEIN_EMAIL_FROM || 'noreply@growsocialmedia.nl')
        : (process.env.EMAIL_FROM || `noreply@${process.env.MAILGUN_DOMAIN || 'growsocialmedia.nl'}`);

      console.log(`📧 Sending email via ${isInternal ? 'Mijndomein' : 'Mailgun'}:`);
      console.log(`   To: ${to}`);
      console.log(`   From: ${emailFrom}`);
      console.log(`   Internal: ${isInternal}`);

      // Create transporter
      const transporter = nodemailer.createTransport({
        ...smtpConfig,
        tls: {
          rejectUnauthorized: false
        },
        debug: true,
        logger: true
      });

      // Verify connection
      try {
        console.log('🔍 Verifying SMTP connection...');
        await transporter.verify();
        console.log('✅ SMTP connection verified');
      } catch (verifyError) {
        console.error('❌ SMTP connection verification failed:', verifyError);
        return false;
      }

      // Send email
      const mailOptions = {
        from: emailFrom,
        to: to,
        subject: subject,
        html: html,
        text: this.stripHtml(html)
      };

      console.log('📤 Attempting to send email...');
      const info = await transporter.sendMail(mailOptions);
      
      console.log('✅ Email sent successfully:', {
        to: to,
        subject: subject,
        messageId: info.messageId,
        response: info.response
      });

      return true;
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return false;
    }
  }
}

module.exports = EmailService;
```

---

## Stap 3: Update Environment Variables

Voeg toe aan je `.env` file:

```env
# Mailgun Configuration (voor externe emails)
MAILGUN_DOMAIN=growsocialmedia.nl
MAILGUN_SMTP_HOST=smtp.eu.mailgun.org
MAILGUN_SMTP_PORT=587
MAILGUN_SMTP_USER=info@growsocialmedia.nl
MAILGUN_SMTP_PASS=YOUR_MAILGUN_SMTP_PASSWORD

# Mijndomein Configuration (voor interne emails)
MIJNDOMEIN_SMTP_HOST=mail.mijndomein.nl
MIJNDOMEIN_SMTP_PORT=587
MIJNDOMEIN_SMTP_USER=noreply@growsocialmedia.nl
MIJNDOMEIN_SMTP_PASS=[Je Mijndomein email wachtwoord]

# Email Configuration
EMAIL_FROM=noreply@growsocialmedia.nl
MIJNDOMEIN_EMAIL_FROM=noreply@growsocialmedia.nl
INTERNAL_EMAIL_DOMAIN=growsocialmedia.nl
```

---

## Stap 4: Update Supabase Password Reset (Als Nodig)

**BELANGRIJK**: Supabase gebruikt zijn eigen SMTP configuratie. Voor Supabase password reset emails naar interne adressen, heb je twee opties:

### Optie A: Laat Supabase Mailgun Gebruiken (Aanbevolen)

**Voor Supabase:**
- Blijf Mailgun gebruiken (zoals nu)
- Interne emails via Supabase komen mogelijk niet aan
- Gebruik extern email voor password reset (of forwarding)

### Optie B: Code Workaround voor Supabase

Als je Supabase password reset ook naar interne emails wilt sturen, moet je een custom implementatie maken die de email service gebruikt in plaats van Supabase's ingebouwde functie.

---

## Stap 5: Test Configuratie

### Test 1: Externe Email (Gmail)

1. Stuur email naar Gmail adres
2. Check of email via Mailgun wordt verzonden
3. Check of email aankomt

**Verwacht:**
- ✅ Email wordt verzonden via Mailgun
- ✅ Email komt aan in inbox

### Test 2: Interne Email (serve@growsocialmedia.nl)

1. Stuur email naar `serve@growsocialmedia.nl`
2. Check of email via Mijndomein wordt verzonden
3. Check of email aankomt

**Verwacht:**
- ✅ Email wordt verzonden via Mijndomein SMTP
- ✅ Email komt aan in inbox van `serve@growsocialmedia.nl`

---

## Stap 6: Verifieer MX Records

**BELANGRIJK**: Zorg dat MX records naar Mijndomein blijven wijzen (niet naar Mailgun):

1. Check je DNS provider (Mijndomein)
2. Verifieer MX records wijzen naar Mijndomein:
   - **MX Record**: `mail.mijndomein.nl` (of wat Mijndomein aangeeft)
   - **Priority**: 10 (of wat Mijndomein aangeeft)

**Als MX records naar Mailgun wijzen:**
- Verwijder Mailgun MX records
- Zet MX records terug naar Mijndomein
- Wacht 15-60 minuten voor DNS propagation

---

## 📋 Implementatie Checklist

- [ ] Mijndomein SMTP credentials opgehaald
- [ ] Environment variables toegevoegd aan `.env`
- [ ] `emailService.js` geüpdatet met dual SMTP logica
- [ ] MX records wijzen naar Mijndomein (niet Mailgun)
- [ ] Test externe email (Gmail) - werkt via Mailgun
- [ ] Test interne email (serve@growsocialmedia.nl) - werkt via Mijndomein
- [ ] Supabase blijft Mailgun gebruiken (voor externe emails)
- [ ] Code gebruikt dual SMTP voor platform emails

---

## 🔍 Troubleshooting

### Probleem: Interne Emails Komen Niet Aan

**Oplossing:**
1. Check Mijndomein SMTP credentials zijn correct
2. Check MX records wijzen naar Mijndomein
3. Test Mijndomein SMTP direct
4. Check email server accepteert emails

### Probleem: Externe Emails Komen Niet Aan

**Oplossing:**
1. Check Mailgun SMTP configuratie
2. Check Mailgun Logs
3. Verifieer Mailgun domain status is "Active"

### Probleem: Code Detecteert Interne Email Niet Correct

**Oplossing:**
1. Check `isInternalEmail()` functie
2. Check `INTERNAL_EMAIL_DOMAIN` environment variable
3. Check email adres format (moet eindigen met `@growsocialmedia.nl`)

---

## 🎯 Samenvatting

**Configuratie:**
- ✅ **Mailgun**: Voor externe emails (Gmail, etc.)
- ✅ **Mijndomein**: Voor interne emails (`@growsocialmedia.nl`)
- ✅ **MX Records**: Blijven bij Mijndomein (voor receiving)
- ✅ **SPF Records**: Blijven zoals ze zijn (Mailgun voor sending)

**Resultaat:**
- ✅ Externe emails werken via Mailgun
- ✅ Interne emails werken via Mijndomein
- ✅ Emails kunnen worden ontvangen op `@growsocialmedia.nl`
- ✅ Mailgun configuratie blijft zoals het nu is

---

**Laatste update**: January 2025
