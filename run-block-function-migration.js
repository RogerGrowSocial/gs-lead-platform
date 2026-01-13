const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  try {
    console.log('🔧 Starting should_block_user_for_status_change function migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '20250125_add_should_block_function.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 SQL to execute:');
    console.log(migrationSQL);
    
    // Execute the migration using a direct SQL query
    const { data, error } = await supabase
      .from('_sql')
      .select('*')
      .eq('query', migrationSQL);
    
    if (error) {
      console.error('❌ Migration failed:', error);
      console.log('💡 Please run this SQL manually in Supabase SQL Editor:');
      console.log(migrationSQL);
      process.exit(1);
    }
    
    console.log('✅ Migration completed successfully!');
    
    // Test the function
    console.log('🧪 Testing function...');
    const { data: testResult, error: testError } = await supabase
      .rpc('should_block_user_for_status_change', { p_user_id: '00000000-0000-0000-0000-000000000000' });
    
    if (testError) {
      console.error('❌ Function test failed:', testError);
    } else {
      console.log('✅ Function test successful:', testResult);
    }
    
  } catch (err) {
    console.error('❌ Error running migration:', err);
    console.log('💡 Please run the SQL manually in Supabase SQL Editor');
    process.exit(1);
  }
}

runMigration();
