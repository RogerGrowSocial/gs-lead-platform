const cron = require('node-cron');
const { supabaseAdmin } = require('../config/supabase');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger') || console;

const notificationService = new NotificationService();

/**
 * Check and send subscription expiring notifications
 * Runs daily at 9:00 AM
 * Note: This assumes subscriptions have expiry tracking. 
 * If your system uses Mollie subscriptions, you may need to check Mollie API or webhooks.
 */
cron.schedule('0 9 * * *', async () => {
  try {
    logger.info('📧 Starting subscription expiring notification check...');
    
    // TODO: Adjust this query based on your actual subscription expiry tracking
    // For now, this is a placeholder that checks user_subscriptions with cancelled_at
    // You may need to check Mollie API for actual subscription end dates
    
    // Get subscriptions that will be cancelled soon (if cancelled_at is set in future)
    const { data: expiringSubscriptions, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select(`
        id,
        user_id,
        cancelled_at,
        status,
        subscriptions:subscription_id (
          name
        )
      `)
      .eq('status', 'active')
      .not('cancelled_at', 'is', null);
    
    if (error) {
      logger.error('Error fetching expiring subscriptions:', error);
      return;
    }
    
    if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
      logger.info('ℹ️ No subscriptions expiring soon found');
      return;
    }
    
    logger.info(`📧 Found ${expiringSubscriptions.length} subscription(s) with cancellation date`);
    
    let sentCount = 0;
    const now = new Date();
    
    for (const subscription of expiringSubscriptions) {
      try {
        if (!subscription.cancelled_at) continue;
        
        const cancelledDate = new Date(subscription.cancelled_at);
        const daysRemaining = Math.ceil((cancelledDate - now) / (1000 * 60 * 60 * 24));
        
        // Only send notification if expiring in 1, 3, or 7 days
        if (daysRemaining === 7 || daysRemaining === 3 || daysRemaining === 1) {
          await notificationService.sendSubscriptionExpiring(subscription.user_id, {
            name: subscription.subscriptions?.name || 'Je abonnement',
            expiry_date: cancelledDate.toLocaleDateString('nl-NL'),
            days_remaining: daysRemaining
          });
          
          sentCount++;
          logger.info(`✅ Sent expiring notification to user ${subscription.user_id} (${daysRemaining} days remaining)`);
        }
      } catch (notifError) {
        logger.error(`Error sending expiring notification to user ${subscription.user_id}:`, notifError);
      }
    }
    
    logger.info(`✅ Subscription expiring notifications sent: ${sentCount}/${expiringSubscriptions.length}`);
  } catch (error) {
    logger.error('Error in subscription expiring notification cron:', error);
  }
});

/**
 * Check and send subscription expired notifications
 * Runs daily at 9:05 AM (after expiring check)
 */
cron.schedule('5 9 * * *', async () => {
  try {
    logger.info('📧 Starting subscription expired notification check...');
    
    // Get subscriptions that expired recently (status changed to expired or cancelled_at passed)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: expiredSubscriptions, error } = await supabaseAdmin
      .from('user_subscriptions')
      .select(`
        id,
        user_id,
        cancelled_at,
        status,
        subscriptions:subscription_id (
          name
        )
      `)
      .in('status', ['expired', 'cancelled'])
      .lte('cancelled_at', now.toISOString())
      .gte('cancelled_at', yesterday.toISOString());
    
    if (error) {
      logger.error('Error fetching expired subscriptions:', error);
      return;
    }
    
    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      logger.info('ℹ️ No subscriptions expired recently');
      return;
    }
    
    logger.info(`📧 Found ${expiredSubscriptions.length} expired subscription(s)`);
    
    let sentCount = 0;
    
    for (const subscription of expiredSubscriptions) {
      try {
        const expiryDate = subscription.cancelled_at 
          ? new Date(subscription.cancelled_at)
          : new Date();
        
        await notificationService.sendSubscriptionExpired(subscription.user_id, {
          name: subscription.subscriptions?.name || 'Je abonnement',
          expiry_date: expiryDate.toLocaleDateString('nl-NL')
        });
        
        sentCount++;
        logger.info(`✅ Sent expired notification to user ${subscription.user_id}`);
      } catch (notifError) {
        logger.error(`Error sending expired notification to user ${subscription.user_id}:`, notifError);
      }
    }
    
    logger.info(`✅ Subscription expired notifications sent: ${sentCount}/${expiredSubscriptions.length}`);
  } catch (error) {
    logger.error('Error in subscription expired notification cron:', error);
  }
});

logger.info('📅 Subscription notification cron jobs scheduled');

