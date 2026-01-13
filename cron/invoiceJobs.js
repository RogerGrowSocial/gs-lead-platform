const cron = require('node-cron');
const { generateMonthlyInvoices, sendPaymentReminders } = require('../services/automatedInvoiceService');
const PauseExpiryService = require('../services/pauseExpiryService');
const updatePartnerStats = require('./updatePartnerStats');
const logger = require('../utils/logger');

// Run invoice generation on the 1st of every month at 9:00 AM
cron.schedule('0 9 1 * *', async () => {
    try {
        logger.info('Starting monthly invoice generation...');
        const invoices = await generateMonthlyInvoices();
        logger.info(`Successfully generated ${invoices.length} monthly invoices`);
    } catch (error) {
        logger.error('Error generating monthly invoices:', error);
    }
});

// Run payment reminders every Monday at 10:00 AM
cron.schedule('0 10 * * 1', async () => {
    try {
        logger.info('Starting payment reminder check...');
        const remindedInvoices = await sendPaymentReminders();
        logger.info(`Sent payment reminders for ${remindedInvoices.length} overdue invoices`);
    } catch (error) {
        logger.error('Error sending payment reminders:', error);
    }
});

// Check for expired pauses every day at 8:00 AM
cron.schedule('0 8 * * *', async () => {
    try {
        logger.info('Starting expired pause check...');
        const resumedPauses = await PauseExpiryService.checkAndResumeExpiredPauses();
        logger.info(`Successfully resumed ${resumedPauses.length} expired pauses`);
    } catch (error) {
        logger.error('Error checking expired pauses:', error);
    }
});

// Update partner performance stats daily at 2:00 AM
cron.schedule('0 2 * * *', async () => {
    try {
        logger.info('Starting partner performance stats refresh...');
        const result = await updatePartnerStats();
        logger.info(`Successfully updated partner stats for ${result.partnersUpdated} partners`);
    } catch (error) {
        logger.error('Error updating partner performance stats:', error);
    }
});

// Log when cron jobs are initialized
logger.info('Invoice, pause expiry, and partner stats cron jobs initialized');

module.exports = {
    generateMonthlyInvoices,
    sendPaymentReminders
}; 