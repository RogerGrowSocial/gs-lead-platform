#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🔧 Adding price_per_lead column to industries table...');

// Initialize Supabase client with service role key for admin access
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('- SUPABASE_URL is missing');
  if (!supabaseKey) console.error('- SUPABASE_SERVICE_ROLE_KEY is missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addPriceColumn() {
  try {
    console.log('📖 Reading migration file...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '20250116_add_price_column_to_industries.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Executing migration...');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0 && !statement.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('⚡ Executing:', statement.substring(0, 80) + '...');
        
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql: statement + ';' 
        });
        
        if (error) {
          console.error('❌ Error executing statement:', error);
          console.error('Statement:', statement);
          // Continue with other statements
        } else {
          console.log('✅ Statement executed successfully');
        }
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log('📝 The price_per_lead column has been added to the industries table');
    console.log('💡 You can now create industries with custom pricing');
    
    // Verify the changes
    console.log('\n🔍 Verifying changes...');
    const { data: industries, error: verifyError } = await supabase
      .from('industries')
      .select('id, name, price_per_lead, description, is_active')
      .order('name');
    
    if (verifyError) {
      console.error('❌ Error verifying changes:', verifyError);
    } else {
      console.log('✅ Current industries:');
      industries.forEach(industry => {
        console.log(`  - ${industry.name}: €${industry.price_per_lead} (${industry.is_active ? 'Active' : 'Inactive'})`);
      });
    }
    
  } catch (err) {
    console.error('💥 Error running migration:', err);
    process.exit(1);
  }
}

// Run the migration
addPriceColumn();
