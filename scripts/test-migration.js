#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const color = passed ? 'green' : 'red';
  log(`${status} ${testName}`, color);
  if (details) {
    log(`   ${details}`, 'blue');
  }
}

async function testMigration() {
  log('🧪 Migration Test Suite', 'bright');
  log('Testing the new Supabase setup...', 'reset');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Test 1: Database Connection
    log('\n1. Testing database connection...', 'cyan');
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) {
      logTest('Database Connection', false, usersError.message);
      return;
    }
    logTest('Database Connection', true, `${users.users.length} users found`);
    
    // Test 2: Profiles Table Access
    log('\n2. Testing profiles table access...', 'cyan');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, role_id')
      .limit(5);
    
    if (profilesError) {
      logTest('Profiles Table Access', false, profilesError.message);
      return;
    }
    logTest('Profiles Table Access', true, `${profiles.length} profiles found`);
    
    // Test 3: RLS Policies
    log('\n3. Testing RLS policies...', 'cyan');
    
    // Test with anon key (should be restricted)
    const anonSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { data: anonProfiles, error: anonError } = await anonSupabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (anonError && anonError.code === 'PGRST116') {
      logTest('RLS Policies (Anonymous)', true, 'Properly restricted access');
    } else {
      logTest('RLS Policies (Anonymous)', false, 'Should be restricted but got data');
    }
    
    // Test 4: Edge Function URL
    log('\n4. Testing edge function availability...', 'cyan');
    const functionUrl = `${process.env.SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co')}/create-profile`;
    
    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          type: 'test',
          record: { id: 'test', email: 'test@example.com' }
        })
      });
      
      if (response.status === 400) {
        logTest('Edge Function', true, 'Function responds (expected 400 for test data)');
      } else {
        logTest('Edge Function', false, `Unexpected status: ${response.status}`);
      }
    } catch (error) {
      logTest('Edge Function', false, error.message);
    }
    
    // Test 5: Schema Validation
    log('\n5. Testing schema structure...', 'cyan');
    
    if (profiles.length > 0) {
      const profile = profiles[0];
      const requiredFields = ['id', 'email', 'role_id', 'created_at', 'updated_at'];
      const missingFields = requiredFields.filter(field => !(field in profile));
      
      if (missingFields.length === 0) {
        logTest('Schema Structure', true, 'All required fields present');
      } else {
        logTest('Schema Structure', false, `Missing fields: ${missingFields.join(', ')}`);
      }
    } else {
      logTest('Schema Structure', true, 'No profiles to test, but table exists');
    }
    
    // Test 6: Auth Integration
    log('\n6. Testing auth integration...', 'cyan');
    
    // Try to create a test user
    const testEmail = `test-${Date.now()}@example.com`;
    const { data: testUser, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!',
      email_confirm: true
    });
    
    if (createError) {
      logTest('Auth Integration', false, createError.message);
    } else {
      logTest('Auth Integration', true, 'Test user created successfully');
      
      // Clean up test user
      await supabase.auth.admin.deleteUser(testUser.user.id);
    }
    
    // Summary
    log('\n📊 Test Summary', 'bright');
    log('Migration validation completed. Check the results above.', 'reset');
    
    log('\n🎯 Next Steps:', 'cyan');
    log('1. If all tests pass, your migration is successful');
    log('2. Test user registration and login manually');
    log('3. Test Mollie payment integration');
    log('4. Test admin dashboard functionality');
    
  } catch (error) {
    log('\n❌ Test Suite Failed', 'red');
    log(`Error: ${error.message}`, 'red');
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  log(`❌ Unhandled promise rejection: ${error.message}`, 'red');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log(`❌ Uncaught exception: ${error.message}`, 'red');
  process.exit(1);
});

// Run the tests
if (require.main === module) {
  testMigration().catch((error) => {
    log(`❌ Test suite failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { testMigration }; 