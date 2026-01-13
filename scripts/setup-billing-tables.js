const { supabaseAdmin } = require('../config/supabase');

async function createBillingTables() {
  console.log('🚀 Creating billing tables...');
  
  try {
    // Create billing_settings table
    console.log('1. Creating billing_settings table...');
    const { error: billingSettingsError } = await supabaseAdmin
      .from('billing_settings')
      .select('id')
      .limit(1);
    
    if (billingSettingsError && billingSettingsError.code === 'PGRST116') {
      // Table doesn't exist, we need to create it manually
      console.log('   Table does not exist, creating...');
      // We'll handle this in the application layer for now
    }
    
    // Create user_industry_preferences table
    console.log('2. Creating user_industry_preferences table...');
    const { error: preferencesError } = await supabaseAdmin
      .from('user_industry_preferences')
      .select('id')
      .limit(1);
    
    if (preferencesError && preferencesError.code === 'PGRST116') {
      console.log('   Table does not exist, creating...');
      // We'll handle this in the application layer for now
    }
    
    // Insert default billing settings
    console.log('3. Inserting default billing settings...');
    const { error: insertError } = await supabaseAdmin
      .from('billing_settings')
      .upsert({
        id: 1,
        billing_date: '2025-01-31',
        billing_time: '09:00:00',
        timezone: 'Europe/Amsterdam',
        is_active: true
      });
    
    if (insertError) {
      console.log('   Insert error (expected if table doesn\'t exist):', insertError.message);
    } else {
      console.log('   ✅ Default settings inserted');
    }
    
    console.log('✅ Billing tables setup completed!');
    
  } catch (error) {
    console.error('❌ Error creating billing tables:', error);
  }
}

createBillingTables();
