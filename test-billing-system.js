 const BillingTestService = require('./services/billingTestService');
const SystemLogService = require('./services/systemLogService');

async function runBillingSystemTests() {
  console.log('🚀 Starting Complete Billing System Tests...\n');
  
  try {
    // Initialize test service
    const testService = new BillingTestService();
    
    // Run all tests
    const results = await testService.runAllTests();
    
    // Log test completion
    await SystemLogService.logSystem(
      'success',
      'Billing Systeem Tests Voltooid',
      'Alle billing systeem tests succesvol uitgevoerd',
      'Test suite completed successfully',
      {
        test_results: results,
        test_timestamp: new Date().toISOString(),
        all_tests_passed: Object.values(results).every(result => result.success)
      }
    );
    
    console.log('\n🎉 All billing system tests completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to admin panel → Settings → System Logs');
    console.log('2. Verify all test logs are visible');
    console.log('3. Test real billing settings changes');
    console.log('4. Monitor automatic billing execution');
    
    return results;
    
  } catch (error) {
    console.error('💥 Test suite failed:', error);
    
    await SystemLogService.logSystem(
      'error',
      'Billing Systeem Tests Gefaald',
      'Billing systeem tests gefaald met fout',
      `Fout: ${error.message}`,
      {
        error: error.message,
        stack: error.stack,
        test_timestamp: new Date().toISOString()
      }
    );
    
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runBillingSystemTests();
}

module.exports = runBillingSystemTests;
