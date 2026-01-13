const SystemLogService = require('./services/systemLogService');

async function testUserInfoLogging() {
    console.log('🧪 Testing user information in system logs...\n');
    
    try {
        // Test 1: Admin action logging
        console.log('📝 Test 1: Admin action logging...');
        await SystemLogService.logAdmin(
            'test_admin_action',
            'Admin heeft test actie uitgevoerd',
            null, // Use null for test
            null,
            {
                action_type: 'test',
                test_data: 'admin test'
            }
        );
        console.log('✅ Admin action logged');

        // Test 2: Regular user action logging
        console.log('📝 Test 2: Regular user action logging...');
        await SystemLogService.logSystem(
            'info',
            'Test Gebruiker Actie',
            'Gebruiker heeft test actie uitgevoerd',
            'Test details voor gebruiker actie',
            null, // Use null for test
            {
                action_type: 'test',
                test_data: 'user test'
            }
        );
        console.log('✅ User action logged');

        // Test 3: System action logging
        console.log('📝 Test 3: System action logging...');
        await SystemLogService.logSystem(
            'info',
            'Test Systeem Actie',
            'Systeem heeft automatische actie uitgevoerd',
            'Automatische systeem actie zonder gebruiker',
            null,
            {
                action_type: 'automatic',
                test_data: 'system test'
            }
        );
        console.log('✅ System action logged');

        // Test 4: Billing action logging
        console.log('📝 Test 4: Billing action logging...');
        await SystemLogService.logBilling(
            'info',
            'Test Billing Actie',
            'Billing test actie uitgevoerd',
            'Test billing details',
            null, // Use null for test
            null,
            {
                action_type: 'billing_test',
                amount: 50.00,
                test_data: 'billing test'
            }
        );
        console.log('✅ Billing action logged');

        console.log('\n🎉 All user information logging tests completed!');
        console.log('📊 Check the admin panel → Settings → System Logs to see:');
        console.log('• Who performed each action');
        console.log('• Whether it was an admin action');
        console.log('• User email and company information');
        console.log('• System actions marked as "Systeem"');

    } catch (error) {
        console.error('💥 Test failed:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    testUserInfoLogging()
        .then(() => {
            console.log('\n✅ Test completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = testUserInfoLogging;
