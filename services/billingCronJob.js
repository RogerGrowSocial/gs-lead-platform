const cron = require('node-cron');
const AutomaticBillingService = require('../services/automaticBillingService');
const SystemLogService = require('../services/systemLogService');
const logger = require('../utils/logger');

class BillingCronJob {
    constructor() {
        this.billingService = new AutomaticBillingService();
        this.job = null;
        this.isScheduled = false;
    }

    /**
     * Start the billing cron job
     */
    async start() {
        try {
            // Get billing settings
            const billingSettings = await this.getBillingSettings();
            
            if (!billingSettings || !billingSettings.is_active) {
                await SystemLogService.logCron(
                    'warning',
                    'billing_scheduler',
                    'Automatische incasso scheduler niet gestart - uitgeschakeld in instellingen',
                    'Billing settings: is_active = false',
                    { billing_settings: billingSettings }
                );
                return;
            }

            // Parse billing time
            const cronExpression = this.parseBillingTime(billingSettings);
            
            // Schedule the job
            this.job = cron.schedule(cronExpression, async () => {
                await this.executeBilling();
            }, {
                scheduled: false,
                timezone: billingSettings.timezone || 'Europe/Amsterdam'
            });

            // Start the job
            this.job.start();
            this.isScheduled = true;

            await SystemLogService.logCron(
                'success',
                'billing_scheduler',
                'Automatische incasso scheduler succesvol gestart',
                `Cron: ${cronExpression}, Tijdzone: ${billingSettings.timezone}`,
                {
                    cron_expression: cronExpression,
                    timezone: billingSettings.timezone,
                    billing_date: billingSettings.billing_date,
                    billing_time: billingSettings.billing_time
                }
            );

            logger.info(`Billing cron job started with schedule: ${cronExpression}`);

        } catch (error) {
            await SystemLogService.logCron(
                'error',
                'billing_scheduler',
                'Automatische incasso scheduler gefaald',
                `Fout: ${error.message}`,
                { error: error.message, stack: error.stack }
            );

            logger.error('Failed to start billing cron job:', error);
            throw error;
        }
    }

    /**
     * Stop the billing cron job
     */
    async stop() {
        if (this.job) {
            this.job.stop();
            this.job.destroy();
            this.job = null;
            this.isScheduled = false;

            await SystemLogService.logCron(
                'info',
                'billing_scheduler',
                'Automatische incasso scheduler gestopt',
                'Cron job gestopt en vernietigd',
                { stopped_at: new Date().toISOString() }
            );

            logger.info('Billing cron job stopped');
        }
    }

    /**
     * Execute billing process
     */
    async executeBilling() {
        try {
            await SystemLogService.logCron(
                'info',
                'automatic_billing',
                'Automatische incasso cron job gestart',
                'Cron job uitgevoerd volgens schema',
                { 
                    executed_at: new Date().toISOString(),
                    cron_triggered: true
                }
            );

            await this.billingService.startBillingProcess();

        } catch (error) {
            await SystemLogService.logCron(
                'error',
                'automatic_billing',
                'Automatische incasso cron job gefaald',
                `Fout: ${error.message}`,
                { 
                    error: error.message,
                    stack: error.stack,
                    executed_at: new Date().toISOString()
                }
            );

            logger.error('Billing cron job execution failed:', error);
        }
    }

    /**
     * Parse billing time to cron expression
     */
    parseBillingTime(billingSettings) {
        const { billing_date, billing_time } = billingSettings;
        
        // Parse date (format: YYYY-MM-DD)
        const dateParts = billing_date.split('-');
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]);
        const day = parseInt(dateParts[2]);
        
        // Parse time (format: HH:MM:SS)
        const timeParts = billing_time.split(':');
        const hour = parseInt(timeParts[0]);
        const minute = parseInt(timeParts[1]);
        
        // Create cron expression for monthly execution
        // Format: minute hour day month *
        // This will run on the specified day of each month at the specified time
        const cronExpression = `${minute} ${hour} ${day} * *`;
        
        return cronExpression;
    }

    /**
     * Get billing settings
     */
    async getBillingSettings() {
        const { supabaseAdmin } = require('../config/supabase');
        
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
     * Get job status
     */
    getStatus() {
        return {
            isScheduled: this.isScheduled,
            isRunning: this.billingService.isRunning,
            lastRun: this.billingService.lastRun,
            stats: this.billingService.getStats()
        };
    }

    /**
     * Manual trigger for testing
     */
    async manualTrigger() {
        await SystemLogService.logCron(
            'info',
            'manual_billing_trigger',
            'Handmatige automatische incasso trigger',
            'Admin heeft handmatig automatische incasso gestart',
            { 
                triggered_by: 'admin',
                triggered_at: new Date().toISOString(),
                manual: true
            }
        );

        await this.executeBilling();
    }
}

module.exports = BillingCronJob;
