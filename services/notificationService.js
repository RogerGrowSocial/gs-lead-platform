const EmailService = require('./emailService');
const WhatsAppService = require('./whatsappService');
const { supabaseAdmin } = require('../config/supabase');

class NotificationService {
  constructor() {
    this.emailService = new EmailService();
    this.whatsappService = new WhatsAppService();
  }

  /**
   * Get user notification settings
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User notification settings
   */
  async getUserNotificationSettings(userId) {
    try {
      const { data: settings, error } = await supabaseAdmin
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching notification settings:', error);
        return null;
      }

      // Return defaults if no settings exist
      if (!settings) {
        return {
          notifications_enabled: 1,
          new_lead_notification: 1,
          payment_notification: 1,
          account_notification: 1,
          marketing_notification: 0,
          quota_warning_notification: 1,
          quota_reached_notification: 1,
          lead_assigned_notification: 1,
          opportunity_assigned_notification: 1,
          lead_status_changed_notification: 0,
          subscription_expiring_notification: 1,
          subscription_expired_notification: 1,
          login_from_new_device_notification: 1
        };
      }

      // Ensure all notification fields exist with defaults
      return {
        notifications_enabled: settings.notifications_enabled ?? 1,
        new_lead_notification: settings.new_lead_notification ?? 1,
        payment_notification: settings.payment_notification ?? 1,
        account_notification: settings.account_notification ?? 1,
        marketing_notification: settings.marketing_notification ?? 0,
        quota_warning_notification: settings.quota_warning_notification ?? 1,
        quota_reached_notification: settings.quota_reached_notification ?? 1,
        lead_assigned_notification: settings.lead_assigned_notification ?? 1,
        opportunity_assigned_notification: settings.opportunity_assigned_notification ?? 1,
        lead_status_changed_notification: settings.lead_status_changed_notification ?? 0,
        subscription_expiring_notification: settings.subscription_expiring_notification ?? 1,
        subscription_expired_notification: settings.subscription_expired_notification ?? 1,
        login_from_new_device_notification: settings.login_from_new_device_notification ?? 1
      };
    } catch (error) {
      console.error('Error in getUserNotificationSettings:', error);
      return null;
    }
  }

  /**
   * Get user profile data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile(userId) {
    try {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('email, first_name, last_name, company_name')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return profile;
    } catch (error) {
      console.error('Error in getUserProfile:', error);
      return null;
    }
  }

  /**
   * Send notification email
   * @param {string} userId - User ID
   * @param {string} notificationType - Type of notification
   * @param {object} templateData - Data for email template
   * @param {object} options - Additional options
   * @returns {Promise<boolean>} Success status
   */
  async sendNotification(userId, notificationType, templateData = {}, options = {}) {
    try {
      // Get user settings
      const settings = await this.getUserNotificationSettings(userId);
      if (!settings) {
        console.error(`Could not fetch settings for user ${userId}`);
        return false;
      }

      // Check if notifications are enabled globally
      if (settings.notifications_enabled === 0 && !options.force) {
        console.log(`Notifications disabled for user ${userId}`);
        return false;
      }

      // Check if this specific notification type is enabled
      const settingKey = `${notificationType}_notification`;
      if (settings[settingKey] === 0 && !options.force) {
        console.log(`Notification type ${notificationType} disabled for user ${userId}`);
        return false;
      }

      // Get user profile
      const profile = await this.getUserProfile(userId);
      if (!profile || !profile.email) {
        console.error(`❌ No email found for user ${userId}`);
        console.error(`Profile data:`, profile);
        return false;
      }

      // Use override email if provided (for testing)
      const recipientEmail = options.overrideEmail || profile.email;

      console.log(`📧 Preparing to send ${notificationType} notification to: ${recipientEmail}`);

      // Prepare template data with user info
      const fullTemplateData = {
        ...templateData,
        first_name: profile.first_name || 'Gebruiker',
        last_name: profile.last_name || '',
        company_name: profile.company_name || '',
        dashboard_url: process.env.DASHBOARD_URL || (process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000') + '/dashboard',
        email: profile.email
      };

      // Map 'name' to 'subscription_name' for subscription templates if needed
      if (templateData.name && !templateData.subscription_name) {
        fullTemplateData.subscription_name = templateData.name;
      }

      // Ensure all required fields have defaults for quota templates
      if (notificationType === 'quota_warning' || notificationType === 'quota_reached') {
        fullTemplateData.leads_used = fullTemplateData.leads_used || 0;
        fullTemplateData.monthly_quota = fullTemplateData.monthly_quota || 0;
        fullTemplateData.leads_remaining = fullTemplateData.leads_remaining || 0;
        fullTemplateData.usage_percentage = fullTemplateData.usage_percentage || 0;
        fullTemplateData.quota_reset_date = fullTemplateData.quota_reset_date || 'Onbekend';
      }

      // Ensure all required fields have defaults for lead_assigned template
      if (notificationType === 'lead_assigned') {
        fullTemplateData.company_name = fullTemplateData.company_name || 'Onbekend bedrijf';
        fullTemplateData.contact_name = fullTemplateData.contact_name || 'Onbekend';
        fullTemplateData.email = fullTemplateData.email || '';
        fullTemplateData.phone = fullTemplateData.phone || '';
        fullTemplateData.industry = fullTemplateData.industry || 'Onbekend';
        fullTemplateData.lead_url = fullTemplateData.lead_url || fullTemplateData.dashboard_url;
      }

      if (notificationType === 'opportunity_assigned') {
        fullTemplateData.company_name = fullTemplateData.company_name || 'Onbekend bedrijf';
        fullTemplateData.contact_name = fullTemplateData.contact_name || 'Onbekend';
        fullTemplateData.email = fullTemplateData.email || '';
        fullTemplateData.phone = fullTemplateData.phone || '';
        fullTemplateData.location = fullTemplateData.location || '';
        fullTemplateData.message_summary = fullTemplateData.message_summary || '';
        fullTemplateData.stream_name = fullTemplateData.stream_name || 'Kans';
        fullTemplateData.opportunity_url = fullTemplateData.opportunity_url || fullTemplateData.dashboard_url;
        fullTemplateData.opportunity_status_url = fullTemplateData.opportunity_status_url || fullTemplateData.opportunity_url;
      }

      console.log(`📋 Template data for ${notificationType}:`, JSON.stringify(fullTemplateData, null, 2));

      // Render email template
      let htmlContent;
      let subject;

      switch (notificationType) {
        case 'quota_warning':
          htmlContent = this.emailService.renderTemplate('quota_warning', fullTemplateData);
          subject = `Quota waarschuwing - ${fullTemplateData.usage_percentage}% gebruikt`;
          break;

        case 'quota_reached':
          htmlContent = this.emailService.renderTemplate('quota_reached', fullTemplateData);
          subject = `Quota bereikt - Geen nieuwe leads meer deze maand`;
          break;

        case 'lead_assigned':
          htmlContent = this.emailService.renderTemplate('lead_assigned', fullTemplateData);
          subject = `Nieuwe lead toegewezen: ${fullTemplateData.company_name || 'Nieuwe lead'}`;
          break;

        case 'opportunity_assigned':
          htmlContent = this.emailService.renderTemplate('opportunity_assigned', fullTemplateData);
          subject = `Nieuwe kans aan jou toegewezen: ${fullTemplateData.company_name || fullTemplateData.contact_name || 'Nieuwe kans'}`;
          break;

        case 'subscription_expiring':
          htmlContent = this.emailService.renderTemplate('subscription_expiring', fullTemplateData);
          subject = `Je abonnement loopt binnenkort af`;
          break;

        case 'subscription_expired':
          htmlContent = this.emailService.renderTemplate('subscription_expired', fullTemplateData);
          subject = `Je abonnement is verlopen`;
          break;

        case 'login_from_new_device':
          htmlContent = this.emailService.renderTemplate('login_from_new_device', fullTemplateData);
          subject = `Nieuwe inlog vanaf nieuw apparaat`;
          break;

        default:
          console.error(`Unknown notification type: ${notificationType}`);
          return false;
      }

      // Allow subject customization (e.g., to avoid Gmail threading during tests)
      if (options && options.subjectSuffix) {
        subject = `${subject} ${options.subjectSuffix}`;
      }

      // Send email
      console.log(`📤 Sending email to: ${recipientEmail}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   HTML length: ${htmlContent.length} chars`);
      console.log(`   HTML preview (first 200 chars): ${htmlContent.substring(0, 200)}...`);
      
      const emailSent = await this.emailService.sendEmail({
        to: recipientEmail,
        subject: subject,
        html: htmlContent
      });

      if (!emailSent) {
        console.error(`❌ Failed to send ${notificationType} notification to ${recipientEmail}`);
        return false;
      }

      console.log(`✅ Successfully sent ${notificationType} notification to ${recipientEmail}`);
      return true;
    } catch (error) {
      console.error(`Error sending ${notificationType} notification:`, error);
      return false;
    }
  }

  /**
   * Send quota warning notification
   */
  async sendQuotaWarning(userId, usageData) {
    return this.sendNotification(userId, 'quota_warning', {
      leads_used: usageData.leads_used,
      monthly_quota: usageData.monthly_quota,
      leads_remaining: usageData.leads_remaining,
      usage_percentage: usageData.usage_percentage,
      quota_reset_date: usageData.quota_reset_date
    });
  }

  /**
   * Send quota reached notification
   */
  async sendQuotaReached(userId, usageData) {
    return this.sendNotification(userId, 'quota_reached', {
      leads_used: usageData.leads_used,
      monthly_quota: usageData.monthly_quota,
      quota_reset_date: usageData.quota_reset_date
    });
  }

  /**
   * Send lead assigned notification
   */
  async sendLeadAssigned(userId, leadData) {
    // Send email notification
    const emailSent = await this.sendNotification(userId, 'lead_assigned', {
      company_name: leadData.company_name,
      contact_name: leadData.contact_name,
      email: leadData.email,
      phone: leadData.phone,
      industry: leadData.industry,
      lead_url: `${process.env.DASHBOARD_URL || (process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000') + '/dashboard'}/leads/${leadData.lead_id}`
    });

    // Also send WhatsApp notification if enabled
    try {
      const { data: settings } = await supabaseAdmin
        .from('settings')
        .select('whatsapp_notification_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      if (settings?.whatsapp_notification_enabled === 1) {
        const whatsappSent = await this.whatsappService.sendNewLeadNotification(userId, {
          company_name: leadData.company_name,
          contact_name: leadData.contact_name,
          email: leadData.email,
          phone: leadData.phone,
          industry: leadData.industry,
          lead_id: leadData.lead_id
        });

        if (whatsappSent) {
          console.log(`✅ WhatsApp notification sent for lead assignment to user ${userId}`);
        } else {
          console.log(`⚠️  WhatsApp notification failed for user ${userId}, email notification still sent`);
        }
      }
    } catch (whatsappError) {
      console.error('Error sending WhatsApp notification:', whatsappError);
      // Don't fail the whole operation if WhatsApp fails
    }

    return emailSent;
  }

  /**
   * Send opportunity assigned notification (email only for MVP).
   */
  async sendOpportunityAssigned(userId, opportunityData) {
    const baseUrl = process.env.DASHBOARD_URL || (process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000') + '/dashboard';
    const oppId = opportunityData.opportunity_id;
    const opportunityUrl = `${baseUrl.replace(/\/$/, '')}/admin/opportunities/${oppId}`;
    const opportunityStatusUrl = `${opportunityUrl}#status`;
    return this.sendNotification(userId, 'opportunity_assigned', {
      company_name: opportunityData.company_name,
      contact_name: opportunityData.contact_name,
      email: opportunityData.email,
      phone: opportunityData.phone,
      location: opportunityData.location,
      message_summary: opportunityData.message_summary,
      stream_name: opportunityData.stream_name,
      opportunity_url: opportunityUrl,
      opportunity_status_url: opportunityStatusUrl
    });
  }

  /**
   * Send subscription expiring notification
   */
  async sendSubscriptionExpiring(userId, subscriptionData) {
    return this.sendNotification(userId, 'subscription_expiring', {
      subscription_name: subscriptionData.name,
      expiry_date: subscriptionData.expiry_date,
      days_remaining: subscriptionData.days_remaining
    });
  }

  /**
   * Send subscription expired notification
   */
  async sendSubscriptionExpired(userId, subscriptionData) {
    return this.sendNotification(userId, 'subscription_expired', {
      subscription_name: subscriptionData.name,
      expiry_date: subscriptionData.expiry_date
    });
  }

  /**
   * Send login from new device notification
   */
  async sendLoginFromNewDevice(userId, loginData) {
    return this.sendNotification(userId, 'login_from_new_device', {
      login_time: loginData.login_time,
      location: loginData.location,
      device: loginData.device,
      browser: loginData.browser
    });
  }
}

// Export the class so it can be instantiated with 'new NotificationService()'
module.exports = NotificationService;
// Also export a default instance for backward compatibility (routes/dashboard.js uses this)
const defaultInstance = new NotificationService();
// Attach instance methods directly to the exported class for direct usage
Object.getOwnPropertyNames(NotificationService.prototype).forEach(name => {
  if (name !== 'constructor' && typeof NotificationService.prototype[name] === 'function') {
    module.exports[name] = defaultInstance[name].bind(defaultInstance);
  }
});
// Also create a default instance property
module.exports.defaultInstance = defaultInstance;

