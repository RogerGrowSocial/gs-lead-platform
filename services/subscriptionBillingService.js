const { mollieClient } = require('../lib/mollie');
const supabaseAdmin = require('../config/supabase').supabaseAdmin;

// Simple logger for this service
const logger = {
    info: (message, ...args) => console.log(`[SubscriptionBillingService] ${message}`, ...args),
    error: (message, ...args) => console.error(`[SubscriptionBillingService] ${message}`, ...args),
    warn: (message, ...args) => console.warn(`[SubscriptionBillingService] ${message}`, ...args)
};

class SubscriptionBillingService {
    /**
     * Create a Mollie subscription for monthly billing
     */
    async createSubscription({ user, subscription, amount }) {
        try {
            // Get user's SEPA mandate
            const { data: mandates, error: mandateError } = await supabaseAdmin
                .from('payment_methods')
                .select('provider_payment_method_id')
                .eq('user_id', user.id)
                .eq('type', 'sepa')
                .eq('provider', 'mollie')
                .single();
                
            if (mandateError || !mandates) {
                throw new Error('Geen geldige SEPA mandate gevonden');
            }
            
            const mandateId = mandates.provider_payment_method_id;
            
            // Create Mollie subscription
            const mollieSubscription = await mollieClient.customers_subscriptions.create({
                customerId: user.mollie_customer_id,
                amount: {
                    currency: 'EUR',
                    value: amount.toFixed(2)
                },
                interval: '1 month',
                description: `GrowSocial Leads - ${subscription.name}`,
                mandateId: mandateId,
                metadata: {
                    user_id: user.id,
                    subscription_id: subscription.id,
                    company_name: user.company_name
                }
            });
            
            logger.info(`Mollie subscription created for user ${user.id}: ${mollieSubscription.id}`);
            
            // Store subscription in database
            const { error: dbError } = await supabaseAdmin
                .from('user_subscriptions')
                .insert({
                    user_id: user.id,
                    subscription_id: subscription.id,
                    mollie_subscription_id: mollieSubscription.id,
                    status: 'active',
                    amount: amount,
                    created_at: new Date().toISOString()
                });
                
            if (dbError) {
                logger.error('Error storing subscription:', dbError);
                throw dbError;
            }
            
            return mollieSubscription;
            
        } catch (error) {
            logger.error(`Error creating subscription for user ${user.id}:`, error);
            throw error;
        }
    }
    
    /**
     * Cancel a Mollie subscription
     */
    async cancelSubscription(userId, subscriptionId) {
        try {
            // Get subscription from database
            const { data: userSub, error: subError } = await supabaseAdmin
                .from('user_subscriptions')
                .select('mollie_subscription_id, user_id')
                .eq('user_id', userId)
                .eq('subscription_id', subscriptionId)
                .single();
                
            if (subError || !userSub) {
                throw new Error('Subscription niet gevonden');
            }
            
            // Cancel in Mollie
            await mollieClient.customers_subscriptions.delete({
                customerId: userSub.user_id,
                subscriptionId: userSub.mollie_subscription_id
            });
            
            // Update in database
            await supabaseAdmin
                .from('user_subscriptions')
                .update({ 
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString()
                })
                .eq('user_id', userId)
                .eq('subscription_id', subscriptionId);
                
            logger.info(`Subscription cancelled for user ${userId}`);
            
        } catch (error) {
            logger.error(`Error cancelling subscription for user ${userId}:`, error);
            throw error;
        }
    }
    
    /**
     * Get user's active subscriptions
     */
    async getUserSubscriptions(userId) {
        try {
            const { data: subscriptions, error } = await supabaseAdmin
                .from('user_subscriptions')
                .select(`
                    *,
                    subscriptions (
                        id,
                        name,
                        price
                    )
                `)
                .eq('user_id', userId)
                .eq('status', 'active');
                
            if (error) {
                throw error;
            }
            
            return subscriptions || [];
            
        } catch (error) {
            logger.error(`Error getting subscriptions for user ${userId}:`, error);
            throw error;
        }
    }
    
    /**
     * Update subscription status from webhook
     */
    async updateSubscriptionStatus(mollieSubscriptionId, status) {
        try {
            const { error } = await supabaseAdmin
                .from('user_subscriptions')
                .update({ 
                    status: status,
                    updated_at: new Date().toISOString()
                })
                .eq('mollie_subscription_id', mollieSubscriptionId);
                
            if (error) {
                logger.error('Error updating subscription status:', error);
                throw error;
            }
            
            logger.info(`Subscription status updated to ${status} for ${mollieSubscriptionId}`);
            
        } catch (error) {
            logger.error(`Error updating subscription status:`, error);
            throw error;
        }
    }
}

module.exports = new SubscriptionBillingService();
