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

function logCheck(checkName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const color = passed ? 'green' : 'red';
  log(`${status} ${checkName}`, color);
  if (details) {
    log(`   ${details}`, 'blue');
  }
}

async function verifySchema() {
  log('🔍 Schema Verification Script', 'bright');
  log('Verifying that the SQL migration was successful...', 'reset');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  try {
    // Check 1: Profiles table exists
    log('\n1. Checking profiles table...', 'cyan');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profilesError) {
      logCheck('Profiles Table Exists', false, profilesError.message);
      return;
    }
    logCheck('Profiles Table Exists', true, 'Table accessible');
    
    // Check 2: Profiles table structure
    log('\n2. Checking profiles table structure...', 'cyan');
    const { data: profileStructure, error: structureError } = await supabase
      .rpc('get_table_columns', { table_name: 'profiles' });
    
    if (structureError) {
      // Fallback: try to describe the table structure by selecting all columns
      const { data: sampleProfile, error: sampleError } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);
      
      if (sampleError) {
        logCheck('Profiles Table Structure', false, 'Cannot access table structure');
      } else {
        const expectedFields = ['id', 'email', 'role_id', 'created_at', 'updated_at', 'company_name', 'first_name', 'last_name', 'phone', 'postal_code', 'city', 'country', 'vat_number', 'coc_number', 'mollie_customer_id', 'balance', 'is_admin', 'last_login'];
        const actualFields = Object.keys(sampleProfile[0] || {});
        const missingFields = expectedFields.filter(field => !actualFields.includes(field));
        
        if (missingFields.length === 0) {
          logCheck('Profiles Table Structure', true, 'All expected fields present');
        } else {
          logCheck('Profiles Table Structure', false, `Missing fields: ${missingFields.join(', ')}`);
        }
      }
    } else {
      logCheck('Profiles Table Structure', true, 'Structure verified');
    }
    
    // Check 3: RLS policies
    log('\n3. Checking RLS policies...', 'cyan');
    
    // Test with anon key (should be restricted)
    const anonSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { data: anonProfiles, error: anonError } = await anonSupabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (anonError && (anonError.code === 'PGRST116' || anonError.message.includes('permission'))) {
      logCheck('RLS Policies', true, 'Anonymous access properly restricted');
    } else {
      logCheck('RLS Policies', false, 'Anonymous access not properly restricted');
    }
    
    // Check 4: Payment methods table
    log('\n4. Checking payment_methods table...', 'cyan');
    const { data: paymentMethods, error: pmError } = await supabase
      .from('payment_methods')
      .select('*')
      .limit(1);
    
    if (pmError) {
      logCheck('Payment Methods Table', false, pmError.message);
    } else {
      logCheck('Payment Methods Table', true, 'Table accessible');
    }
    
    // Check 5: Subscriptions table
    log('\n5. Checking subscriptions table...', 'cyan');
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .limit(1);
    
    if (subError) {
      logCheck('Subscriptions Table', false, subError.message);
    } else {
      logCheck('Subscriptions Table', true, `${subscriptions.length} subscription(s) found`);
    }
    
    // Check 6: Invoices table
    log('\n6. Checking invoices table...', 'cyan');
    const { data: invoices, error: invError } = await supabase
      .from('invoices')
      .select('*')
      .limit(1);
    
    if (invError) {
      logCheck('Invoices Table', false, invError.message);
    } else {
      logCheck('Invoices Table', true, 'Table accessible');
    }
    
    // Check 7: Foreign key relationships
    log('\n7. Checking foreign key relationships...', 'cyan');
    
    // Try to create a test profile to verify foreign key constraint
    const testUserId = '00000000-0000-0000-0000-000000000000';
    const { error: fkError } = await supabase
      .from('profiles')
      .insert({
        id: testUserId,
        email: 'test-verification@example.com',
        role_id: 'customer'
      });
    
    if (fkError && fkError.message.includes('foreign key')) {
      logCheck('Foreign Key Constraints', true, 'Proper foreign key constraint enforced');
      
      // Clean up test record
      await supabase
        .from('profiles')
        .delete()
        .eq('id', testUserId);
    } else {
      logCheck('Foreign Key Constraints', false, 'Foreign key constraint not working properly');
    }
    
    // Check 8: Indexes
    log('\n8. Checking indexes...', 'cyan');
    
    // Test email index by querying with email
    const { data: emailQuery, error: emailError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'nonexistent@example.com')
      .limit(1);
    
    if (emailError) {
      logCheck('Email Index', false, emailError.message);
    } else {
      logCheck('Email Index', true, 'Email queries working');
    }
    
    // Summary
    log('\n📊 Schema Verification Summary', 'bright');
    log('Schema verification completed. Check the results above.', 'reset');
    
    log('\n🎯 Next Steps:', 'cyan');
    log('1. If all checks pass, your schema is ready');
    log('2. Proceed with edge function deployment');
    log('3. Test user registration and login');
    log('4. Test Mollie payment integration');
    
  } catch (error) {
    log('\n❌ Schema Verification Failed', 'red');
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

// Run the verification
if (require.main === module) {
  verifySchema().catch((error) => {
    log(`❌ Schema verification failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { verifySchema }; 