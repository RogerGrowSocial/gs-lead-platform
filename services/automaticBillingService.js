const { supabaseAdmin } = require('../config/supabase');
const { mollieClient } = require('../lib/mollie');
const SystemLogService = require('../services/systemLogService');
const logger = require('../utils/logger');

class AutomaticBillingService {
    constructor() {
        this.isRunning = false;
        this.lastRun = null;
        this.stats = {
            totalUsers: 0,
            successfulPayments: 0,
            failedPayments: 0,
            totalAmount: 0,
            totalLeads: 0
        };
    }

    /**
     * Start automatic billing process
     */
    async startBillingProcess() {
        if (this.isRunning) {
            await SystemLogService.logBilling(
                'warning',
                'Automatische Incasso Gestart',
                'Automatische incasso poging terwijl proces al actief is',
                'Voorkomt dubbele uitvoering',
                null,
                null,
                { 
                    already_running: true,
                    last_run: this.lastRun 
                }
            );
            return;
        }

        this.isRunning = true;
        const startTime = new Date();
        
        try {
            // Log start
            await SystemLogService.logBilling(
                'info',
                'Automatische Incasso Gestart',
                'Automatische incasso proces gestart',
                `Gestart op ${startTime.toLocaleString('nl-NL')}`,
                null,
                null,
                { 
                    start_time: startTime.toISOString(),
                    process_id: this.generateProcessId()
                }
            );

            // Get billing settings
            const billingSettings = await this.getBillingSettings();
            if (!billingSettings || !billingSettings.is_active) {
                await SystemLogService.logBilling(
                    'warning',
                    'Automatische Incasso Uitgeschakeld',
                    'Automatische incasso is uitgeschakeld in instellingen',
                    'Geen actie ondernomen',
                    null,
                    null,
                    { billing_settings: billingSettings }
                );
                return;
            }

            // Get active users with subscriptions
            const activeUsers = await this.getActiveUsers();
            this.stats.totalUsers = activeUsers.length;

            if (activeUsers.length === 0) {
                await SystemLogService.logBilling(
                    'info',
                    'Geen Actieve Gebruikers',
                    'Geen actieve gebruikers gevonden voor incasso',
                    'Geen betalingen verwerkt',
                    null,
                    null,
                    { 
                        total_users: 0,
                        billing_date: startTime.toISOString()
                    }
                );
                return;
            }

            // Process each active user for accepted leads billing
            for (const user of activeUsers) {
                await this.processUserBilling(user);
            }

            // Log completion
            await this.logBillingCompletion(
                startTime, 
                this.stats.successfulPayments, 
                this.stats.failedPayments, 
                this.stats.totalAmount, 
                this.stats.totalLeads
            );

            this.lastRun = new Date();

        } catch (error) {
            const endTime = new Date();
            const duration = endTime - startTime;

            await SystemLogService.logBilling(
                'error',
                'Automatische Incasso Gefaald',
                'Automatische incasso proces gefaald met fout',
                `Fout: ${error.message}`,
                null,
                null,
                {
                    error: error.message,
                    stack: error.stack,
                    duration_ms: duration,
                    stats: this.stats
                }
            );

            logger.error('Automatic billing failed:', error);
            throw error;

        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Process billing for a single user
     */
    async processUserBilling(user) {
        try {
            // Get user's subscription and payment method
            const subscription = await this.getUserSubscription(user.id);
            const paymentMethod = await this.getUserPaymentMethod(user.id);

            if (!subscription || !paymentMethod) {
                await SystemLogService.logBilling(
                    'warning',
                    'Gebruiker Geen Betalingsmethode',
                    `Gebruiker ${user.company_name} heeft geen actieve betalingsmethode`,
                    `Gebruiker ID: ${user.id}`,
                    user.id,
                    null,
                    { 
                        user_id: user.id,
                        company_name: user.company_name,
                        subscription: subscription,
                        payment_method: paymentMethod
                    }
                );
                this.stats.failedPayments++;
                return;
            }

            // Calculate amount based on actual accepted leads
            const billingData = await this.calculateBillingAmount(user.id);
            const amount = billingData.amount;
            const leadsCount = billingData.leadsCount;

            // Skip if no amount to charge
            if (amount <= 0) {
                await SystemLogService.logBilling(
                    'info',
                    'Geen Betaling Nodig',
                    `Geen betaling nodig voor ${user.company_name} - geen geaccepteerde leads deze maand`,
                    `Geaccepteerde leads count: ${leadsCount}`,
                    user.id,
                    null,
                    { 
                        user_id: user.id,
                        company_name: user.company_name,
                        accepted_leads_count: leadsCount,
                        amount: amount
                    }
                );
                return;
            }

            // Create Mollie payment
            const payment = await this.createMolliePayment({
                user,
                subscription,
                paymentMethod,
                amount,
                leadsCount
            });

            // Handle different payment statuses correctly
            if (payment.status === 'paid') {
                // Payment completed immediately (iDEAL, credit card)
                await this.markLeadsAsPaid(user.id, billingData.leads);
                await this.createInvoice(user, amount, leadsCount, payment.id);
                await this.updateUserBalance(user.id, amount);

                await SystemLogService.logBilling(
                    'success',
                    'Betaling Succesvol',
                    `Betaling van €${amount.toFixed(2)} succesvol voor ${user.company_name}`,
                    `Mollie Payment ID: ${payment.id}`,
                    user.id,
                    null,
                    {
                        user_id: user.id,
                        company_name: user.company_name,
                        amount: amount,
                        leads_count: leadsCount,
                        mollie_payment_id: payment.id,
                        payment_status: payment.status,
                        invoice_created: true,
                        leads_marked_paid: true
                    }
                );

                this.stats.successfulPayments++;
                this.stats.totalAmount += amount;
                this.stats.totalLeads += leadsCount;

            } else if (['open', 'pending', 'authorized'].includes(payment.status)) {
                // SEPA payment initiated - this is SUCCESS, not failure
                const statusDescription = {
                    'open': 'Geïnitieerd - wacht op bank verwerking',
                    'pending': 'In behandeling bij de bank',
                    'authorized': 'Geautoriseerd - wacht op verwerking'
                };
                
                await SystemLogService.logBilling(
                    'success',
                    'SEPA Betaling Geïnitieerd',
                    `SEPA betaling van €${amount.toFixed(2)} succesvol geïnitieerd voor ${user.company_name}`,
                    `Status: ${payment.status} (${statusDescription[payment.status]}), Mollie ID: ${payment.id}. Betaling wordt verwerkt door de bank.`,
                    user.id,
                    null,
                    {
                        user_id: user.id,
                        company_name: user.company_name,
                        amount: amount,
                        leads_count: leadsCount,
                        mollie_payment_id: payment.id,
                        payment_status: payment.status,
                        payment_type: 'sepa_recurring',
                        payment_method: payment.method,
                        note: 'SEPA betalingen hebben 1-3 werkdagen verwerkingstijd'
                    }
                );

                this.stats.successfulPayments++;
                this.stats.totalAmount += amount;
                this.stats.totalLeads += leadsCount;

            } else if (payment.status === 'failed' || payment.status === 'canceled' || payment.status === 'expired') {
                // Actual payment failure
                await SystemLogService.logBilling(
                    'error',
                    'Betaling Gefaald',
                    `Betaling van €${amount.toFixed(2)} gefaald voor ${user.company_name}`,
                    `Status: ${payment.status}, Mollie ID: ${payment.id}`,
                    user.id,
                    null,
                    {
                        user_id: user.id,
                        company_name: user.company_name,
                        amount: amount,
                        mollie_payment_id: payment.id,
                        payment_status: payment.status,
                        failure_reason: payment.failureReason || 'Unknown'
                    }
                );

                this.stats.failedPayments++;
            } else {
                // Unknown status - log as warning
                await SystemLogService.logBilling(
                    'warning',
                    'Onbekende Betalingsstatus',
                    `Betaling van €${amount.toFixed(2)} heeft onbekende status voor ${user.company_name}`,
                    `Status: ${payment.status}, Mollie ID: ${payment.id}`,
                    user.id,
                    null,
                    {
                        user_id: user.id,
                        company_name: user.company_name,
                        amount: amount,
                        mollie_payment_id: payment.id,
                        payment_status: payment.status,
                        note: 'Onbekende status - controleer handmatig'
                    }
                );
            }

        } catch (error) {
            await SystemLogService.logBilling(
                'error',
                'Gebruiker Betaling Fout',
                `Fout bij verwerken betaling voor ${user.company_name}`,
                `Fout: ${error.message}`,
                user.id,
                null,
                {
                    user_id: user.id,
                    company_name: user.company_name,
                    error: error.message,
                    stack: error.stack
                }
            );

            this.stats.failedPayments++;
            logger.error(`Billing error for user ${user.id}:`, error);
        }
    }

    /**
     * Get billing settings
     */
    async getBillingSettings() {
        const { data, error } = await supabaseAdmin
            .from('billing_settings')
            .select('*')
            .single();

        if (error && error.code !== 'PGRST116') {
            throw new Error(`Failed to get billing settings: ${error.message}`);
        }

        return data;
    }

    /**
     * Get active users with subscriptions
     */
    async getActiveUsers() {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select(`
                id,
                company_name,
                email,
                balance,
                mollie_customer_id,
                subscriptions!inner (
                    id,
                    leads_per_month,
                    status,
                    is_paused
                )
            `)
            .eq('subscriptions.status', 'active')
            .eq('subscriptions.is_paused', false);

        if (error) {
            throw new Error(`Failed to get active users: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Get user subscription
     */
    async getUserSubscription(userId) {
        const { data, error } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .eq('is_paused', false)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw new Error(`Failed to get user subscription: ${error.message}`);
        }

        return data;
    }

    /**
     * Get user payment method
     */
    async getUserPaymentMethod(userId) {
        const { data, error } = await supabaseAdmin
            .from('payment_methods')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .eq('is_default', true)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw new Error(`Failed to get user payment method: ${error.message}`);
        }

        return data;
    }

    /**
     * Calculate billing amount based on actual accepted leads
     */
    async calculateBillingAmount(userId) {
        try {
            // Get accepted leads for this month
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            
            const endOfMonth = new Date();
            endOfMonth.setMonth(endOfMonth.getMonth() + 1);
            endOfMonth.setDate(0);
            endOfMonth.setHours(23, 59, 59, 999);

            const { data: acceptedLeads, error } = await supabaseAdmin
                .from('leads')
                .select('price_at_purchase, industry_id, industries(price_per_lead)')
                .eq('user_id', userId)
                .eq('status', 'accepted')
                .gte('created_at', startOfMonth.toISOString())
                .lte('created_at', endOfMonth.toISOString());

            if (error) {
                throw new Error(`Failed to get accepted leads: ${error.message}`);
            }

            // Calculate total amount
            let totalAmount = 0;
            if (acceptedLeads && acceptedLeads.length > 0) {
                for (const lead of acceptedLeads) {
                    // Use price_at_purchase if set, otherwise use industry price
                    const amount = lead.price_at_purchase || 
                                 (lead.industries && lead.industries.price_per_lead) || 
                                 25.00; // Default fallback
                    totalAmount += amount;
                }
            }

            return {
                amount: totalAmount,
                leadsCount: acceptedLeads ? acceptedLeads.length : 0,
                leads: acceptedLeads || []
            };
        } catch (error) {
            logger.error(`Error calculating billing amount for user ${userId}:`, error);
            return { amount: 0, leadsCount: 0, leads: [] };
        }
    }

    /**
     * Create Mollie payment for automatic billing
     */
    async createMolliePayment({ user, subscription, paymentMethod, amount, leadsCount }) {
        try {
            const baseUrl = process.env.APP_URL || process.env.BASE_URL || 'https://growsocialmedia.nl';
            
            // Environment sanity check
            logger.info(`Environment check: NODE_ENV=${process.env.NODE_ENV}, APP_URL=${baseUrl}`);
            
            // Fix webhook URL for development (use public URL instead of localhost)
            const webhookUrl = process.env.NODE_ENV === 'development' 
                ? 'https://growsocialmedia.nl/api/webhooks/mollie'  // Use production webhook for development
                : `${baseUrl}/api/webhooks/mollie`;
            
            logger.info(`Webhook URL: ${webhookUrl}`);
            
            const { mollieClient } = require('../lib/mollie');
            
            // Mollie API key check
            const apiKey = process.env.MOLLIE_API_KEY || '';
            const isLiveKey = apiKey.startsWith('live_');
            const profileId = process.env.MOLLIE_PROFILE_ID || '';
            logger.info(`Mollie API key check: ${isLiveKey ? 'LIVE' : 'TEST'} (${apiKey.substring(0, 10)}...)`);
            logger.info(`Mollie Profile ID: ${profileId || 'NOT SET'}`);
            
            // Check if user has valid SEPA mandate
            const { data: mandates, error: mandateError } = await supabaseAdmin
                .from('payment_methods')
                .select('provider_payment_method_id, type, is_default')
                .eq('user_id', user.id)
                .eq('type', 'sepa')
                .eq('provider', 'mollie')
                .eq('status', 'active');
                
            if (mandateError || !mandates || mandates.length === 0) {
                throw new Error('Geen geldige SEPA mandate gevonden. Voeg eerst een SEPA mandate toe.');
            }
            
            // Use default mandate if available, otherwise use the first one
            const defaultMandate = mandates.find(m => m.is_default === true);
            const selectedMandate = defaultMandate || mandates[0];
            const mandateId = selectedMandate.provider_payment_method_id;
            
            logger.info(`Using SEPA mandate ${mandateId} for user ${user.id} (customer: ${user.mollie_customer_id})`);
            logger.info(`Mandate details: is_default=${selectedMandate.is_default}, type=${selectedMandate.type}`);
            
            // Verify mandate is still valid in Mollie
            try {
                logger.info(`Verifying mandate ${mandateId} for customer ${user.mollie_customer_id}`);
                
                const mandate = await mollieClient.customers_mandates.get(mandateId, {
                    customerId: user.mollie_customer_id
                });
                
                logger.info(`Mandate verification result: id=${mandate.id}, status=${mandate.status}, method=${mandate.method}`);
                
                if (mandate.status !== 'valid') {
                    throw new Error(`SEPA mandate is niet geldig (status: ${mandate.status})`);
                }
            } catch (mandateCheckError) {
                logger.error(`Mandate verification failed for ${mandateId}:`, mandateCheckError);
                throw new Error(`SEPA mandate verificatie mislukt: ${mandateCheckError.message}`);
            }
            
            // Create idempotency key to prevent duplicate payments
            const billingDate = new Date().toISOString().split('T')[0];
            const idempotencyKey = `billing_${user.id}_${billingDate}_${leadsCount}`;
            
            // Create recurring payment with proper sequenceType
            const payment = await mollieClient.payments.create({
                amount: {
                    currency: 'EUR',
                    value: amount.toFixed(2)
                },
                description: `GrowSocial Leads - ${leadsCount} geaccepteerde leads voor ${user.company_name}`,
                customerId: user.mollie_customer_id,
                mandateId: mandateId,
                sequenceType: 'recurring', // CRITICAL: This makes it recurring
                // No redirectUrl for recurring SEPA - webhook handles completion
                webhookUrl: webhookUrl,
                metadata: {
                    user_id: user.id,
                    company_name: user.company_name,
                    leads_count: leadsCount,
                    subscription_id: subscription.id,
                    billing_type: 'automatic_monthly_accepted_leads',
                    billing_date: billingDate,
                    payment_method: 'sepa_recurring',
                    idempotency_key: idempotencyKey
                }
            }, {
                idempotencyKey: idempotencyKey
            });
            
            logger.info(`Recurring SEPA payment created successfully for user ${user.id}: ${payment.id}`);
            logger.info(`Payment details: method=${payment.method}, status=${payment.status}, amount=${payment.amount.value} ${payment.amount.currency}, customer=${payment.customerId}, mandate=${payment.mandateId}`);
            
            // Hard production guard: ensure we got a SEPA payment
            if (process.env.NODE_ENV === 'production' && payment?.method !== 'directdebit') {
                throw new Error(`Unexpected method in production (not directdebit): ${payment?.method}`);
            }
            
            // Additional guard for any environment
            if (payment?.method === 'ideal') {
                throw new Error(`iDEAL payment created instead of SEPA - this should not happen!`);
            }
            
            // Store payment in database
            await this.storePaymentInDatabase(payment, user, subscription, amount, leadsCount);
            
            return payment;
            
        } catch (error) {
            // No fallback to iDEAL — ever
            throw new Error(`SEPA recurring payment creation failed: ${error.message}`);
        }
    }

    /**
     * Mark leads as paid after successful payment
     */
    async markLeadsAsPaid(userId, leads) {
        try {
            if (!leads || leads.length === 0) return;

            const leadIds = leads.map(lead => lead.id);
            
            const { error } = await supabaseAdmin
                .from('leads')
                .update({ 
                    status: 'paid',
                    paid_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .in('id', leadIds)
                .eq('user_id', userId)
                .eq('status', 'accepted');

            if (error) {
                throw new Error(`Failed to mark leads as paid: ${error.message}`);
            }

            logger.info(`Marked ${leads.length} leads as paid for user ${userId}`);
        } catch (error) {
            logger.error(`Error marking leads as paid for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Create invoice for successful payment
     */
    async createInvoice(user, amount, leadsCount, molliePaymentId) {
        try {
            // Generate invoice number
            const invoiceNumber = `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-6)}`;
            
            // Calculate due date (30 days from now)
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);

            // Prepare invoice data (matching actual database schema)
            const invoiceData = {
                user_id: user.id,
                invoice_number: invoiceNumber,
                amount: amount,
                due_date: dueDate.toISOString(),
                status: 'paid',
                description: `Maandelijkse factuur voor ${leadsCount} geaccepteerde leads`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            // Try to add mollie_payment_id if the column exists
            try {
                // First check if the column exists by trying to select it
                const { error: columnCheckError } = await supabaseAdmin
                    .from('invoices')
                    .select('mollie_payment_id')
                    .limit(1);
                
                if (!columnCheckError) {
                    // Column exists, add the mollie_payment_id
                    invoiceData.mollie_payment_id = molliePaymentId;
                } else if (columnCheckError.message.includes('column "mollie_payment_id" does not exist')) {
                    // Column doesn't exist, log warning but continue without it
                    logger.warn(`mollie_payment_id column does not exist in invoices table. Please run the migration: fix_mollie_payment_id_column.sql`);
                } else {
                    // Other error, log it but continue
                    logger.warn(`Error checking mollie_payment_id column: ${columnCheckError.message}`);
                }
            } catch (columnError) {
                logger.warn(`Error checking mollie_payment_id column: ${columnError.message}`);
            }

            // Create invoice record
            const { data: invoice, error } = await supabaseAdmin
                .from('invoices')
                .insert(invoiceData)
                .select()
                .single();

            if (error) {
                throw new Error(`Failed to create invoice: ${error.message}`);
            }

            logger.info(`Created invoice ${invoiceNumber} for user ${user.id} - €${amount.toFixed(2)}`);
            return invoice;
        } catch (error) {
            logger.error(`Error creating invoice for user ${user.id}:`, error);
            throw error;
        }
    }

    /**
     * Store payment in database
     */
    async storePaymentInDatabase(payment, user, subscription, amount, leadsCount) {
        try {
            // Generate a UUID for the database record
            const { v4: uuidv4 } = require('uuid');
            const paymentId = uuidv4();
            
            const { error: insertError } = await supabaseAdmin
                .from('payments')
                .insert({
                    id: paymentId,
                    user_id: user.id,
                    amount: amount,
                    status: payment.status === 'open' ? 'pending' : payment.status,
                    payment_method: null, // Store payment method info in payment_details instead
                    payment_details: {
                        mollie_payment_id: payment.id,
                        customer_id: payment.customerId,
                        mandate_id: payment.mandateId,
                        sequence_type: payment.sequenceType,
                        method: payment.method,
                        status: payment.status,
                        amount: payment.amount,
                        billing_type: 'automatic_monthly_accepted_leads',
                        payment_method: 'sepa_recurring',
                        subscription_id: subscription.id,
                        leads_count: leadsCount,
                        billing_date: new Date().toISOString().split('T')[0],
                        idempotency_key: payment.metadata?.idempotency_key,
                        description: `GrowSocial Leads - ${leadsCount} geaccepteerde leads voor ${user.company_name}`
                    },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (insertError) {
                logger.error(`Error storing payment ${payment.id} in database:`, insertError);
                throw new Error(`Failed to store payment in database: ${insertError.message}`);
            }

            logger.info(`Payment ${payment.id} stored in database successfully`);
        } catch (error) {
            logger.error(`Error storing payment in database:`, error);
            throw error;
        }
    }

    /**
     * Update user balance after successful payment
     */
    async updateUserBalance(userId, amount) {
        try {
            // First get current balance
            const { data: user, error: getUserError } = await supabaseAdmin
                .from('profiles')
                .select('balance')
                .eq('id', userId)
                .single();

            if (getUserError) {
                throw new Error(`Failed to get user balance: ${getUserError.message}`);
            }

            const newBalance = (user.balance || 0) - amount;

            // Update balance
            const { error } = await supabaseAdmin
                .from('profiles')
                .update({ 
                    balance: newBalance,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) {
                throw new Error(`Failed to update user balance: ${error.message}`);
            }

            logger.info(`Updated balance for user ${userId} - deducted €${amount} (new balance: €${newBalance})`);
        } catch (error) {
            logger.error(`Error updating balance for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Log billing completion
     */
    async logBillingCompletion(startTime, successfulPayments, failedPayments, totalAmount, totalLeads) {
        const endTime = new Date();
        const duration = endTime - startTime;
        
        const logLevel = failedPayments > 0 ? 'warning' : 'success';
        const title = successfulPayments === 0 && failedPayments === 0 
            ? 'Automatische Incasso Voltooid - Geen Betalingen'
            : 'Automatische Incasso Voltooid';
            
        const message = successfulPayments === 0 && failedPayments === 0
            ? 'Automatische incasso voltooid zonder betalingen'
            : 'Automatische incasso proces succesvol voltooid';
            
        const details = successfulPayments === 0 && failedPayments === 0
            ? 'Geen gebruikers met openstaande balansen gevonden'
            : `${successfulPayments} betalingen succesvol, ${failedPayments} gefaald`;

        await SystemLogService.logBilling(
            logLevel,
            title,
            message,
            details,
            null,
            null,
            {
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                duration_ms: duration,
                successful_payments: successfulPayments,
                failed_payments: failedPayments,
                total_amount: totalAmount,
                total_leads: totalLeads,
                total_users_processed: successfulPayments + failedPayments
            }
        );
    }

    /**
     * Update user lead quota
     */
    async updateUserLeadQuota(userId, leadsCount) {
        const { error } = await supabaseAdmin
            .from('subscriptions')
            .update({
                leads_used_this_month: 0, // Reset for new month
                last_billing_date: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (error) {
            throw new Error(`Failed to update user lead quota: ${error.message}`);
        }
    }

    /**
     * Generate unique process ID
     */
    generateProcessId() {
        return `billing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get billing statistics
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            lastRun: this.lastRun
        };
    }

    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalUsers: 0,
            successfulPayments: 0,
            failedPayments: 0,
            totalAmount: 0,
            totalLeads: 0
        };
    }
}

module.exports = AutomaticBillingService;
