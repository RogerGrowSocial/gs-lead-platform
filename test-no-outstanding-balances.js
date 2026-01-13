const AutomaticBillingService = require('./services/automaticBillingService');
const SystemLogService = require('./services/systemLogService');

async function testNoOutstandingBalances() {
    console.log('🧪 Testing "No Outstanding Balances" scenario...\n');
    
    try {
        const billingService = new AutomaticBillingService();
        
        // Test the scenario where there are no outstanding balances
        console.log('📝 Simulating billing process with no outstanding balances...');
        
        // This will trigger the new logging we added
        await billingService.startBillingProcess();
        
        console.log('✅ "No Outstanding Balances" test completed successfully!');
        console.log('📊 Check the system logs for the "Geen Openstaande Balansen" entry');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        throw error;
    }
}

// Run if this file is executed directly
if (require.main === module) {
    testNoOutstandingBalances()
        .then(() => {
            console.log('\n🎉 Test completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Test failed:', error);
            process.exit(1);
        });
}

module.exports = testNoOutstandingBalances;
