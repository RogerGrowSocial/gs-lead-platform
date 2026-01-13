const { supabaseAdmin } = require('./config/supabase');

async function checkSystemLogs() {
  console.log('🔍 Checking system logs in database...\n');

  try {
    // Direct database query
    const { data: logs, error } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    console.log(`📊 Found ${logs.length} logs in database:`);
    console.log('');

    logs.forEach((log, index) => {
      console.log(`${index + 1}. ${log.log_type.toUpperCase()} - ${log.title}`);
      console.log(`   Category: ${log.category}`);
      console.log(`   Message: ${log.message}`);
      console.log(`   Created: ${log.created_at}`);
      console.log(`   Source: ${log.source}`);
      console.log('');
    });

    // Test the get_system_logs function
    console.log('🧪 Testing get_system_logs function...');
    const { data: functionLogs, error: functionError } = await supabaseAdmin
      .rpc('get_system_logs', {
        p_limit: 5,
        p_offset: 0
      });

    if (functionError) {
      console.error('❌ Function error:', functionError);
    } else {
      console.log(`✅ Function returned ${functionLogs.length} logs`);
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkSystemLogs();
