const twilio = require('twilio');
const { supabaseAdmin } = require('../config/supabase');

/**
 * WhatsApp Service voor het versturen van notificaties via Twilio WhatsApp API
 * Makkelijker setup dan Meta's WhatsApp Cloud API - geen template goedkeuring nodig
 */
class WhatsAppService {
  constructor() {
    // Twilio configuratie uit environment variables
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio test number
    
    // Initialize Twilio client
    this.client = null;
    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
    }
    
    // Fallback: als WhatsApp niet geconfigureerd is, loggen we alleen
    this.enabled = !!(this.accountSid && this.authToken && this.client);
    
    if (!this.enabled) {
      console.warn('⚠️  WhatsApp service (Twilio) niet geconfigureerd. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN en TWILIO_WHATSAPP_FROM environment variables.');
    }
  }

  /**
   * Format telefoonnummer naar internationaal formaat (bijv. +31612345678)
   * @param {string} phone - Telefoonnummer in verschillende formaten
   * @returns {string} Geformatteerd nummer met + prefix
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If already starts with +, return as is
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // If starts with 0, replace with +31 (Nederlandse nummers)
    if (cleaned.startsWith('0')) {
      cleaned = '+31' + cleaned.substring(1);
    }
    // If starts with 31, add +
    else if (cleaned.startsWith('31')) {
      cleaned = '+' + cleaned;
    }
    // If starts with 6 (Nederlandse mobiel), add +31
    else if (cleaned.startsWith('6') && cleaned.length === 9) {
      cleaned = '+31' + cleaned;
    }
    // Default: assume Dutch number and add +31
    else if (!cleaned.startsWith('+')) {
      cleaned = '+31' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Verstuur WhatsApp bericht via Twilio API
   * @param {string} to - Telefoonnummer (geformatteerd met +)
   * @param {string} message - Bericht tekst
   * @param {object} options - Options voor template of vrije tekst
   * @returns {Promise<boolean>} Success status
   */
  async sendMessage(to, message, options = {}) {
    try {
      if (!this.enabled) {
        console.log('📱 WhatsApp service niet geconfigureerd, skipping WhatsApp message');
        return false;
      }

      const formattedPhone = this.formatPhoneNumber(to);
      if (!formattedPhone) {
        console.error('❌ Geen geldig telefoonnummer voor WhatsApp bericht');
        return false;
      }

      // Twilio WhatsApp vereist whatsapp: prefix voor nummers
      const whatsappTo = formattedPhone.startsWith('whatsapp:') 
        ? formattedPhone 
        : `whatsapp:${formattedPhone}`;

      console.log(`📱 Sending WhatsApp message via Twilio to ${whatsappTo}...`);

      // For business-initiated messages, Twilio requires Content Templates
      // But for sandbox/testing, we can try direct messages first
      // If that fails, we'll need to create a Content Template
      
      const messageData = {
        from: this.whatsappFrom,
        to: whatsappTo
      };

      // If Content Template SID is provided, use it
      if (options.contentSid) {
        messageData.contentSid = options.contentSid;
        if (options.contentVariables) {
          messageData.contentVariables = JSON.stringify(options.contentVariables);
        }
        console.log(`   Using Content Template: ${options.contentSid}`);
      } else {
        // Try direct message (works for user-initiated conversations or sandbox)
        messageData.body = message;
        console.log(`   Message: ${message.substring(0, 50)}...`);
      }

      const messageResult = await this.client.messages.create(messageData);

      if (messageResult && messageResult.sid) {
        console.log(`✅ WhatsApp message sent successfully via Twilio. Message SID: ${messageResult.sid}`);
        return true;
      }

      console.warn('⚠️  Twilio API response had geen message SID');
      return false;
    } catch (error) {
      console.error('❌ Error sending WhatsApp message via Twilio:', error.message);
      console.error('   Full error:', JSON.stringify(error, null, 2));
      
      // Log detailed error for debugging
      if (error.moreInfo) {
        console.error('   More info:', error.moreInfo);
      }
      if (error.code) {
        console.error('   Error code:', error.code);
      }
      if (error.status) {
        console.error('   Status:', error.status);
      }
      
      // If error is about templates, log helpful message
      if (error.code === 21608 || error.message.includes('template') || error.message.includes('Content')) {
        console.warn('💡 Tip: Business-initiated messages require Content Templates. Try creating one in Twilio Console or use user-initiated flow.');
      }
      
      return false;
    }
  }

  /**
   * Verstuur nieuwe lead notificatie via WhatsApp
   * @param {string} userId - User ID
   * @param {object} leadData - Lead gegevens
   * @returns {Promise<boolean>} Success status
   */
  async sendNewLeadNotification(userId, leadData) {
    try {
      // Haal gebruiker profiel op om telefoonnummer te krijgen
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('phone, first_name')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile for WhatsApp:', error);
        return false;
      }

      if (!profile) {
        console.log(`📱 No profile found for user ${userId}`);
        return false;
      }

      // Check of WhatsApp notificaties zijn ingeschakeld (via settings tabel)
      const { data: settings } = await supabaseAdmin
        .from('settings')
        .select('whatsapp_notification_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      const whatsappEnabled = settings?.whatsapp_notification_enabled === 1;
      
      if (!whatsappEnabled) {
        console.log(`📱 WhatsApp notifications disabled for user ${userId}`);
        return false;
      }

      if (!profile.phone) {
        console.log(`📱 No phone number found for user ${userId}`);
        return false;
      }

      // Build message text (Twilio heeft geen template vereisten)
      // OF gebruik Content Template met named variables als beschikbaar
      const contentSid = process.env.TWILIO_CONTENT_SID;
      
      if (contentSid) {
        // Use Content Template met named variables
        return await this.sendMessage(profile.phone, '', {
          contentSid: contentSid,
          contentVariables: {
            company_name: leadData.company_name || 'Onbekend bedrijf',
            contact_name: leadData.contact_name || 'Onbekend',
            email: leadData.email || 'Geen e-mail',
            dashboard_url: `${process.env.DASHBOARD_URL || 'http://localhost:3000/dashboard'}/leads/${leadData.lead_id}`
          }
        });
      } else {
        // Fallback naar vrije tekst bericht
        const message = `🎯 Je hebt een nieuwe aanvraag ontvangen!

Bedrijf: ${leadData.company_name || 'Onbekend bedrijf'}
Naam: ${leadData.contact_name || 'Onbekend'}
E-mail: ${leadData.email || 'Geen e-mail'}

Bekijk de details: ${process.env.DASHBOARD_URL || 'http://localhost:3000/dashboard'}/leads/${leadData.lead_id}

Met vriendelijke groet,
GrowSocial Team`;

        return await this.sendMessage(profile.phone, message);
      }
    } catch (error) {
      console.error('Error in sendNewLeadNotification:', error);
      return false;
    }
  }

  /**
   * Verstuur bericht van partner naar lead via WhatsApp
   * @param {string} leadPhone - Telefoonnummer van de lead
   * @param {string} partnerName - Naam van de partner
   * @param {string} message - Bericht tekst
   * @param {string} leadName - Naam van de lead
   * @param {string} leadUrl - URL naar de lead in dashboard
   * @returns {Promise<boolean>} Success status
   */
  async sendLeadMessage(leadPhone, partnerName, message, leadName = '', leadUrl = '') {
    try {
      const formattedPhone = this.formatPhoneNumber(leadPhone);
      if (!formattedPhone) {
        console.error('❌ Geen geldig telefoonnummer voor lead');
        return false;
      }

      // Build message text
      const whatsappMessage = `💬 Nieuw bericht van ${partnerName}

${message}

${leadName ? `Aanvraag: ${leadName}` : ''}
${leadUrl ? `Bekijk details: ${leadUrl}` : ''}

Met vriendelijke groet,
${partnerName}`;

      return await this.sendMessage(formattedPhone, whatsappMessage);
    } catch (error) {
      console.error('Error sending lead message via WhatsApp:', error);
      return false;
    }
  }

  /**
   * Test WhatsApp bericht verzenden
   * @param {string} phoneNumber - Telefoonnummer om naar te sturen
   * @param {string} testMessage - Test bericht tekst
   * @returns {Promise<boolean>} Success status
   */
  async sendTestMessage(phoneNumber, testMessage = 'Test bericht van GrowSocial') {
    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      if (!formattedPhone) {
        console.error('❌ Geen geldig telefoonnummer');
        return false;
      }

      return await this.sendMessage(formattedPhone, testMessage);
    } catch (error) {
      console.error('Error sending test WhatsApp message:', error);
      return false;
    }
  }
}

module.exports = WhatsAppService;
