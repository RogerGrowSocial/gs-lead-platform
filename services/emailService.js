const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.templatesPath = path.join(__dirname, '../templates/emails');
  }

  /**
   * Load and render an email template
   * @param {string} templateName - Name of the template file (without .html)
   * @param {object} variables - Variables to replace in the template
   * @returns {string} Rendered HTML
   */
  renderTemplate(templateName, variables = {}) {
    try {
      const templatePath = path.join(this.templatesPath, `${templateName}.html`);
      
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Email template not found: ${templateName}.html`);
      }

      let template = fs.readFileSync(templatePath, 'utf8');
      
      // Replace variables in the template
      Object.keys(variables).forEach(key => {
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        const value = variables[key] != null ? String(variables[key]) : '';
        template = template.replace(placeholder, value);
      });

      // Check if there are any unreplaced placeholders (for debugging)
      const remainingPlaceholders = template.match(/{{[^}]+}}/g);
      if (remainingPlaceholders && remainingPlaceholders.length > 0) {
        console.warn(`⚠️  Template "${templateName}" has unreplaced placeholders:`, remainingPlaceholders);
      }

      // Validate HTML structure (more tolerant for attributes on <html> / <body>)
      const htmlTagCount = (template.match(/<html[^>]*>/gi) || []).length;
      const closingHtmlTagCount = (template.match(/<\/html>/gi) || []).length;
      const bodyTagCount = (template.match(/<body[^>]*>/gi) || []).length;
      const closingBodyTagCount = (template.match(/<\/body>/gi) || []).length;

      if (htmlTagCount !== closingHtmlTagCount || bodyTagCount !== closingBodyTagCount) {
        console.error(`❌ Template "${templateName}" has malformed HTML structure`);
        console.error(`   HTML tags: ${htmlTagCount} opening, ${closingHtmlTagCount} closing`);
        console.error(`   Body tags: ${bodyTagCount} opening, ${closingBodyTagCount} closing`);
      }

      console.log(`✅ Template "${templateName}" rendered successfully (${template.length} chars)`);
      
      return template;
    } catch (error) {
      console.error('Error rendering email template:', error);
      throw error;
    }
  }

  /**
   * Strip HTML tags to create plain text version
   * @param {string} html - HTML content
   * @returns {string} Plain text version
   */
  stripHtml(html) {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Send welcome email with password setup link
   * @param {object} userData - User information
   * @param {string} resetLink - Password reset link
   * @returns {Promise<boolean>} Success status
   */
  async sendWelcomeEmail(userData, resetLink) {
    try {
      const { email, first_name, last_name } = userData;
      
      // Render the email template
      const htmlContent = this.renderTemplate('welcome-password-setup', {
        email,
        first_name,
        last_name,
        reset_link: resetLink
      });

      return await this.sendEmail({
        to: email,
        subject: 'Welkom bij GrowSocial - Wachtwoord instellen',
        html: htmlContent
      });
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  }

  /**
   * Detect if email is internal (same domain)
   * @param {string} email - Email address to check
   * @returns {boolean} True if internal email
   */
  isInternalEmail(email) {
    const internalDomain = process.env.INTERNAL_EMAIL_DOMAIN || 'growsocialmedia.nl';
    return email.toLowerCase().endsWith(`@${internalDomain}`);
  }

  /**
   * Get SMTP configuration based on email type (internal vs external)
   * @param {string} email - Recipient email address
   * @returns {object} SMTP configuration
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
        },
        emailFrom: process.env.MIJNDOMEIN_EMAIL_FROM || 'noreply@growsocialmedia.nl',
        provider: 'Mijndomein'
      };
    } else {
      // Use Mailgun SMTP for external emails
      const mailgunDomain = process.env.MAILGUN_DOMAIN || 'growsocialmedia.nl';
      return {
        host: process.env.MAILGUN_SMTP_HOST || process.env.MAILGUN_SMTP_SERVER || process.env.SMTP_HOST || 'smtp.eu.mailgun.org',
        port: parseInt(process.env.MAILGUN_SMTP_PORT || process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.MAILGUN_SMTP_USER || process.env.SMTP_USER || `postmaster@${mailgunDomain}`,
          pass: process.env.MAILGUN_SMTP_PASS || process.env.SMTP_PASS
        },
        emailFrom: process.env.EMAIL_FROM || `noreply@${mailgunDomain}`,
        provider: 'Mailgun'
      };
    }
  }

  /**
   * Send email using appropriate SMTP (Mailgun for external, Mijndomein for internal)
   * @param {object} emailData - Email data { to, subject, html }
   * @returns {Promise<boolean>} Success status
   */
  async sendEmail(emailData) {
    try {
      const { to, subject, html } = emailData;
      
      if (!to || !subject || !html) {
        throw new Error('Missing required email fields: to, subject, html');
      }

      // Get SMTP configuration based on email type
      const isInternal = this.isInternalEmail(to);
      const smtpConfig = this.getSMTPConfig(to);

      console.log(`📧 Email Service Configuration (${smtpConfig.provider}):`);
      console.log(`   Host: ${smtpConfig.host}`);
      console.log(`   Port: ${smtpConfig.port}`);
      console.log(`   User: ${smtpConfig.auth.user ? smtpConfig.auth.user.substring(0, 10) + '...' : 'NOT SET'}`);
      console.log(`   Password: ${smtpConfig.auth.pass ? 'SET (' + smtpConfig.auth.pass.length + ' chars)' : 'NOT SET'}`);
      console.log(`   From: ${smtpConfig.emailFrom}`);
      console.log(`   To: ${to}`);
      console.log(`   Internal: ${isInternal ? 'Yes' : 'No'}`);

      if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
        const provider = isInternal ? 'Mijndomein' : 'Mailgun';
        console.error(`❌ ${provider} SMTP credentials not configured.`);
        if (isInternal) {
          console.error('   Set MIJNDOMEIN_SMTP_USER and MIJNDOMEIN_SMTP_PASS environment variables.');
        } else {
          console.error('   Set MAILGUN_SMTP_USER and MAILGUN_SMTP_PASS environment variables.');
        }
        return false;
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
          user: smtpConfig.auth.user,
          pass: smtpConfig.auth.pass
        },
        tls: {
          // Do not fail on invalid certificates
          rejectUnauthorized: false
        },
        debug: true, // Enable debug logging
        logger: true // Log to console
      });

      // Verify connection first
      try {
        console.log('🔍 Verifying SMTP connection...');
        await transporter.verify();
        console.log('✅ SMTP connection verified');
      } catch (verifyError) {
        console.error('❌ SMTP connection verification failed:', verifyError);
        console.error('   Error details:', verifyError.message);
        if (verifyError.response) {
          console.error('   Response:', verifyError.response);
        }
        return false;
      }

      // Send email
      const mailOptions = {
        from: smtpConfig.emailFrom,
        to: to,
        subject: subject,
        html: html,
        text: this.stripHtml(html) // Add plain text fallback
      };

      console.log('📤 Attempting to send email...');
      console.log('   HTML length:', html.length);
      console.log('   Text length:', mailOptions.text.length);
      
      const info = await transporter.sendMail(mailOptions);
      
      console.log('✅ Email sent successfully:', {
        to: to,
        subject: subject,
        messageId: info.messageId,
        response: info.response
      });

      // Provider-specific warnings
      if (!isInternal) {
        console.log('');
        console.log('⚠️  BELANGRIJK (Mailgun): Als je geen emails ontvangt:');
        console.log('   1. Check Mailgun Dashboard → Sending → Domain Settings');
        console.log('   2. Controleer of je domain NIET in "Sandbox Mode" staat');
        console.log('   3. Als je in Sandbox Mode bent, voeg ontvangers toe aan "Authorized Recipients"');
        console.log('   4. OF upgrade je Mailgun account naar "Production Mode"');
        console.log('   5. Check Mailgun → Logs voor delivery status');
        console.log('');
      } else {
        console.log('');
        console.log('✅ Email verzonden via Mijndomein SMTP (interne email)');
        console.log('');
      }

      return true;
    } catch (error) {
      console.error('❌ Error sending email:', error);
      console.error('   Error type:', error.constructor.name);
      console.error('   Error message:', error.message);
      if (error.response) {
        console.error('   SMTP Response:', error.response);
      }
      if (error.responseCode) {
        console.error('   Response Code:', error.responseCode);
      }
      if (error.command) {
        console.error('   Failed Command:', error.command);
      }
      console.error('   Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      return false;
    }
  }

  /**
   * Test email template rendering
   * @param {string} templateName - Template to test
   * @param {object} testData - Test data
   */
  testTemplate(templateName, testData = {}) {
    try {
      const html = this.renderTemplate(templateName, testData);
      console.log(`✅ Template "${templateName}" rendered successfully`);
      return html;
    } catch (error) {
      console.error(`❌ Error testing template "${templateName}":`, error.message);
      return null;
    }
  }
}

module.exports = EmailService;