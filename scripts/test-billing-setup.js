// Test script to verify billing API functionality
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testBillingFunctions() {
  console.log('🧪 Testing billing functions...');
  
  try {
    // Test 1: Check if tables exist
    console.log('\n📋 Checking required tables...');
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (profilesError) {
      console.error('❌ Profiles table error:', profilesError);
    } else {
      console.log('✅ Profiles table exists');
    }
    
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('subscriptions')
      .select('id')
      .limit(1);
    
    if (subscriptionsError) {
      console.error('❌ Subscriptions table error:', subscriptionsError);
    } else {
      console.log('✅ Subscriptions table exists');
    }
    
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id')
      .limit(1);
    
    if (leadsError) {
      console.error('❌ Leads table error:', leadsError);
    } else {
      console.log('✅ Leads table exists');
    }
    
    // Test 2: Check if functions exist
    console.log('\n🔧 Checking billing functions...');
    
    try {
      const { data: snapshotTest, error: snapshotError } = await supabase
        .rpc('get_billing_snapshot', { p_user: '00000000-0000-0000-0000-000000000000' });
      
      if (snapshotError) {
        console.log('⚠️  get_billing_snapshot function not found or has issues:', snapshotError.message);
      } else {
        console.log('✅ get_billing_snapshot function exists');
      }
    } catch (error) {
      console.log('⚠️  get_billing_snapshot function not found');
    }
    
    try {
      const { data: allocateTest, error: allocateError } = await supabase
        .rpc('can_allocate_lead', { p_user: '00000000-0000-0000-0000-000000000000', p_price: 5.0 });
      
      if (allocateError) {
        console.log('⚠️  can_allocate_lead function not found or has issues:', allocateError.message);
      } else {
        console.log('✅ can_allocate_lead function exists');
      }
    } catch (error) {
      console.log('⚠️  can_allocate_lead function not found');
    }
    
    // Test 3: Check if view exists
    console.log('\n👁️  Checking views...');
    
    try {
      const { data: viewTest, error: viewError } = await supabase
        .from('v_monthly_lead_usage')
        .select('*')
        .limit(1);
      
      if (viewError) {
        console.log('⚠️  v_monthly_lead_usage view not found or has issues:', viewError.message);
      } else {
        console.log('✅ v_monthly_lead_usage view exists');
      }
    } catch (error) {
      console.log('⚠️  v_monthly_lead_usage view not found');
    }
    
    console.log('\n📝 Next steps:');
    console.log('1. If functions are missing, run the SQL manually in Supabase dashboard');
    console.log('2. Check your .env file has correct SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    console.log('3. Test the API endpoints once functions are created');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testBillingFunctions();
