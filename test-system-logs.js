const { supabaseAdmin } = require('./config/supabase');
const SystemLogService = require('./services/systemLogService');

async function testSystemLogs() {
  console.log('🧪 Starting comprehensive system logs test...\n');

  try {
    // Test 1: Basic logging
    console.log('📝 Test 1: Basic system logging...');
    const logId1 = await SystemLogService.logSystem(
      'info',
      'System Test',
      'Testing basic system logging functionality',
      'This is a test log entry',
      { test: true, step: 1 }
    );
    console.log(`✅ Log created with ID: ${logId1}`);

    // Test 2: Billing logging
    console.log('\n💰 Test 2: Billing system logging...');
    const logId2 = await SystemLogService.logBilling(
      'info',
      'Billing Settings Test',
      'Testing billing settings logging',
      'Billing settings updated for testing',
      null,
      null,
      { 
        test: true, 
        step: 2,
        old_date: '2025-01-31',
        new_date: '2025-02-15'
      }
    );
    console.log(`✅ Billing log created with ID: ${logId2}`);

    // Test 3: User authentication logging
    console.log('\n🔐 Test 3: Authentication logging...');
    const logId3 = await SystemLogService.logAuth(
      null, // Use null instead of fake UUID
      'logged in',
      'Test user login for system testing',
      '127.0.0.1',
      'Test User Agent'
    );
    console.log(`✅ Auth log created with ID: ${logId3}`);

    // Test 4: Admin action logging
    console.log('\n👨‍💼 Test 4: Admin action logging...');
    const logId4 = await SystemLogService.logAdmin(
      'tested system logs',
      'Admin performed system logs testing',
      null, // Use null instead of fake UUID
      null,
      { test: true, step: 4 }
    );
    console.log(`✅ Admin log created with ID: ${logId4}`);

    // Test 5: Payment logging
    console.log('\n💳 Test 5: Payment logging...');
    const logId5 = await SystemLogService.logPayment(
      'success',
      'Test Payment',
      'Testing payment logging functionality',
      'Payment processed successfully for testing',
      null, // Use null instead of fake UUID
      { 
        test: true, 
        step: 5,
        amount: 29.99,
        currency: 'EUR'
      }
    );
    console.log(`✅ Payment log created with ID: ${logId5}`);

    // Test 6: Cron job logging
    console.log('\n⏰ Test 6: Cron job logging...');
    const logId6 = await SystemLogService.logCron(
      'success',
      'test_cron_job',
      'Testing cron job logging',
      'Cron job executed successfully',
      { test: true, step: 6, duration: '2.5s' }
    );
    console.log(`✅ Cron log created with ID: ${logId6}`);

    // Test 7: API logging
    console.log('\n🌐 Test 7: API logging...');
    const logId7 = await SystemLogService.logAPI(
      'info',
      '/api/test',
      'Testing API logging functionality',
      'API endpoint called successfully',
      null, // Use null instead of fake UUID
      '127.0.0.1',
      'Test API Client'
    );
    console.log(`✅ API log created with ID: ${logId7}`);

    // Test 8: Error logging
    console.log('\n❌ Test 8: Error logging...');
    const logId8 = await SystemLogService.logSystem(
      'error',
      'Test Error',
      'Testing error logging functionality',
      'This is a test error for system validation',
      { test: true, step: 8, error_code: 'TEST_ERROR' }
    );
    console.log(`✅ Error log created with ID: ${logId8}`);

    // Test 9: Critical logging
    console.log('\n🚨 Test 9: Critical logging...');
    const logId9 = await SystemLogService.log({
      type: 'critical',
      category: 'system',
      title: 'Test Critical Event',
      message: 'Testing critical event logging',
      details: 'This is a test critical event',
      source: 'System Test',
      metadata: { test: true, step: 9, critical: true },
      severity: 'critical'
    });
    console.log(`✅ Critical log created with ID: ${logId9}`);

    // Test 10: Retrieve logs
    console.log('\n📊 Test 10: Retrieving logs...');
    const logs = await SystemLogService.getLogs({ limit: 20 });
    console.log(`✅ Retrieved ${logs.logs.length} logs (total: ${logs.total})`);

    // Display summary
    console.log('\n📈 Test Summary:');
    console.log(`- Total logs in system: ${logs.total}`);
    console.log(`- Logs by type:`);
    
    const logsByType = logs.logs.reduce((acc, log) => {
      acc[log.log_type] = (acc[log.log_type] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(logsByType).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });

    console.log('\n🎉 All system logs tests completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to admin panel → Settings → System Logs');
    console.log('2. Verify all test logs are visible');
    console.log('3. Test filtering by type and category');
    console.log('4. Test billing settings changes to see real logging');

  } catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }
}

testSystemLogs();
