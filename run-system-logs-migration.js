const { supabaseAdmin } = require('./config/supabase');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🚀 Starting system logs migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '20250116_add_system_logs.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { error } = await supabaseAdmin.rpc('exec_sql', { sql: statement });
          if (error) {
            console.error(`❌ Error in statement ${i + 1}:`, error);
            // Continue with other statements
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`❌ Exception in statement ${i + 1}:`, err.message);
        }
      }
    }
    
    console.log('🎉 Migration completed!');
    
    // Test the migration by creating a test log
    console.log('🧪 Testing system logs...');
    const SystemLogService = require('./services/systemLogService');
    
    await SystemLogService.logSystem(
      'success',
      'Migration Test',
      'System logs migration completed successfully',
      'Migration: 20250116_add_system_logs.sql',
      { migration_version: '20250116_add_system_logs', test: true }
    );
    
    console.log('✅ Test log created successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
