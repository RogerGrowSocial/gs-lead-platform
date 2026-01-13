const SystemLogService = require('./services/systemLogService');

async function testBillingSettingsLogging() {
    console.log('🧪 Testing billing settings logging...\n');
    
    try {
        // Test billing settings change logging
        console.log('📝 Testing billing settings change logging...');
        
        await SystemLogService.logBilling(
            'info',
            'Betalingsinstellingen Gewijzigd',
            'Admin heeft betalingsinstellingen gewijzigd voor test',
            'Test wijzigingen: Datum: 2025-01-31 → 2025-02-28, Tijd: 09:00 → 10:00',
            null, // userId
            null, // adminId - would be real admin ID in production
            {
                old_settings: {
                    billing_date: '2025-01-31',
                    billing_time: '09:00',
                    timezone: 'Europe/Amsterdam',
                    is_active: true
                },
                new_settings: {
                    billing_date: '2025-02-28',
                    billing_time: '10:00',
                    timezone: 'Europe/Amsterdam',
                    is_active: true
                },
                changes: {
                    billing_date: true,
                    billing_time: true,
                    timezone: false,
                    is_active: false
                },
                change_description: 'Incasso datum: 2025-01-31 → 2025-02-28, Incasso tijd: 09:00 → 10:00'
            }
        );
        console.log('✅ Billing settings change logged');

        // Test cron job restart logging
        console.log('📝 Testing cron job restart logging...');
        
        await SystemLogService.logBilling(
            'info',
            'Cron Job Herstart',
            'Automatische incasso cron job herstart met nieuwe instellingen',
            'Nieuwe cron expressie voor 2025-02-28 10:00',
            null, // userId
            null, // adminId
            {
                cron_restarted: true,
                new_date: '2025-02-28',
                new_time: '10:00',
                new_timezone: 'Europe/Amsterdam'
            }
        );
        console.log('✅ Cron job restart logged');

        console.log('\n🎉 Billing settings logging tests completed!');
        console.log('📊 Check the admin panel → Settings → System Logs to see:');
        console.log('• "Betalingsinstellingen Gewijzigd" entries');
        console.log('• "Cron Job Herstart" entries');
        console.log('• Detailed change information in metadata');
        console.log('• Admin user information (if admin ID was provided)');

    } catch (error) {
        console.error('💥 Test failed:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    testBillingSettingsLogging()
        .then(() => {
            console.log('\n✅ Test completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = testBillingSettingsLogging;
