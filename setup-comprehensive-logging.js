const ComprehensiveLoggingService = require('./services/comprehensiveLoggingService');

async function setupComprehensiveLogging() {
  console.log('🚀 Setting up comprehensive logging across entire project...\n');
  
  try {
    const loggingService = new ComprehensiveLoggingService();
    await loggingService.addComprehensiveLogging();
    
    console.log('\n📋 Comprehensive logging categories added:');
    console.log('✅ Authentication & User Management');
    console.log('✅ Lead Management');
    console.log('✅ Payment Operations');
    console.log('✅ Subscription Management');
    console.log('✅ Admin Operations');
    console.log('✅ System Operations');
    console.log('✅ API Usage');
    console.log('✅ Security Events');
    
    console.log('\n🎯 What you can now monitor:');
    console.log('• User registrations, logins, logouts');
    console.log('• Lead creation, assignment, deletion');
    console.log('• Payment processing and failures');
    console.log('• Subscription changes and quota updates');
    console.log('• Admin actions and bulk operations');
    console.log('• Database operations and cron jobs');
    console.log('• API usage and rate limiting');
    console.log('• Security events and suspicious activity');
    
    console.log('\n📊 Go to Admin → Settings → System Logs to see all logs!');
    
  } catch (error) {
    console.error('💥 Error setting up comprehensive logging:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  setupComprehensiveLogging();
}

module.exports = setupComprehensiveLogging;
