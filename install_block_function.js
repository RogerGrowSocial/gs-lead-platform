const { supabaseAdmin } = require('./config/supabase');
const fs = require('fs');

async function installBlockFunction() {
  try {
    console.log('🔧 Installing should_block_user_for_status_change function...');
    
    // Read the SQL file
    const sql = fs.readFileSync('./create_should_block_function.sql', 'utf8');
    
    // Execute the SQL
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('❌ Error installing function:', error);
      return;
    }
    
    console.log('✅ Function installed successfully!');
    
    // Test the function
    console.log('🧪 Testing function...');
    const { data: testResult, error: testError } = await supabaseAdmin
      .rpc('should_block_user_for_status_change', { p_user_id: '00000000-0000-0000-0000-000000000000' });
    
    if (testError) {
      console.error('❌ Function test failed:', testError);
    } else {
      console.log('✅ Function test successful:', testResult);
    }
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

installBlockFunction();
