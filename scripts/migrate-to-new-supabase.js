#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, description) {
  log(`\n${step}. ${description}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function main() {
  log('🚀 Supabase Migration Script', 'bright');
  log('This script will help you migrate to a new Supabase project', 'reset');
  
  // Check if we have the required environment variables
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY', 
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  
  logStep('1', 'Checking environment variables...');
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logError(`Missing required environment variables: ${missingVars.join(', ')}`);
    logInfo('Please create a .env file with the following variables:');
    missingVars.forEach(varName => {
      logInfo(`  ${varName}=your_value_here`);
    });
    process.exit(1);
  }
  
  logSuccess('All required environment variables are present');
  
  // Test connection to Supabase
  logStep('2', 'Testing connection to Supabase...');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    // Test the connection by trying to list users
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      throw error;
    }
    
    logSuccess(`Connected to Supabase successfully (${users.users.length} users found)`);
  } catch (error) {
    logError(`Failed to connect to Supabase: ${error.message}`);
    logInfo('Please check your Supabase URL and service role key');
    process.exit(1);
  }
  
  // Check if profiles table exists
  logStep('3', 'Checking database schema...');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116') {
        logWarning('Profiles table does not exist. You need to run the migration SQL first.');
        logInfo('Please run the SQL from migrations/new_supabase_setup.sql in your Supabase SQL editor');
      } else {
        throw error;
      }
    } else {
      logSuccess('Profiles table exists and is accessible');
    }
  } catch (error) {
    logError(`Error checking profiles table: ${error.message}`);
  }
  
  // Provide migration instructions
  logStep('4', 'Migration Instructions');
  
  logInfo('To complete the migration, follow these steps:');
  
  log('\n📋 Manual Steps Required:', 'bright');
  log('1. Create a new Supabase project in the Supabase dashboard');
  log('2. Copy the new project URL and keys');
  log('3. Update your .env file with the new credentials:');
  log('   SUPABASE_URL=https://your-new-project.supabase.co');
  log('   SUPABASE_ANON_KEY=your-new-anon-key');
  log('   SUPABASE_SERVICE_ROLE_KEY=your-new-service-role-key');
  
  log('\n🗄️ Database Setup:', 'bright');
  log('1. Go to your new Supabase project SQL editor');
  log('2. Run the SQL from migrations/new_supabase_setup.sql');
  log('3. This will create the profiles table with proper RLS policies');
  
  log('\n🔧 Edge Function Setup:', 'bright');
  log('1. Deploy the create-profile edge function:');
  log('   supabase functions deploy create-profile');
  log('2. Set up the auth webhook in Supabase dashboard:');
  log('   - Go to Authentication > Webhooks');
  log('   - Add webhook for user.created event');
  log('   - URL: https://your-project.functions.supabase.co/create-profile');
  
  log('\n🧪 Testing:', 'bright');
  log('1. Test user registration');
  log('2. Test user login');
  log('3. Test profile creation');
  log('4. Test Mollie payment integration');
  
  log('\n📊 Migration Checklist:', 'bright');
  log('□ New Supabase project created');
  log('□ Environment variables updated');
  log('□ Database schema applied');
  log('□ Edge function deployed');
  log('□ Auth webhook configured');
  log('□ Code changes applied (auth.js, admin.js, etc.)');
  log('□ Testing completed');
  
  log('\n🎯 Next Steps:', 'bright');
  log('1. Run this script again after setting up the new project');
  log('2. Test the migration with a few users');
  log('3. Monitor for any issues');
  log('4. Deploy to production when ready');
  
  log('\n💡 Tips:', 'bright');
  log('- Keep the old Supabase project running during migration');
  log('- Test thoroughly before switching over');
  log('- Have a rollback plan ready');
  log('- Monitor logs for any errors');
  
  log('\n✨ Migration script completed!', 'green');
}

// Handle errors
process.on('unhandledRejection', (error) => {
  logError(`Unhandled promise rejection: ${error.message}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    logError(`Script failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main }; 