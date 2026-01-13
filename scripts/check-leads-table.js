const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkLeadsTable() {
  console.log('🔍 Checking leads table structure...\n');

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Check if leads table exists and get its structure
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .limit(1);

    if (leadsError) {
      console.error('❌ Leads table error:', leadsError);
      return;
    }

    if (leads.length === 0) {
      console.log('📝 Leads table is empty, creating a test lead...');
      
      // Create a test lead
      const { data: newLead, error: createError } = await supabaseAdmin
        .from('leads')
        .insert({
          name: 'Test Lead',
          email: 'test@example.com',
          phone: '0612345678',
          message: 'This is a test lead',
          status: 'new',
          priority: 'medium',
          industry_id: 1,
          user_id: null // No user assigned yet
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating test lead:', createError);
        return;
      }

      console.log('✅ Test lead created:', newLead);
    } else {
      console.log('✅ Leads table has data. Sample lead:', leads[0]);
    }

    // Check the table structure by trying to select all columns
    const { data: allLeads, error: allLeadsError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .limit(1);

    if (allLeadsError) {
      console.error('❌ Error selecting all leads:', allLeadsError);
      return;
    }

    if (allLeads.length > 0) {
      console.log('\n📋 Leads table columns:');
      Object.keys(allLeads[0]).forEach(column => {
        console.log(`   - ${column}: ${typeof allLeads[0][column]}`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

checkLeadsTable();
