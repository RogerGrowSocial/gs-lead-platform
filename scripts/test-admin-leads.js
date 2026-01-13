const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testAdminLeads() {
  console.log('🔍 Testing Admin Leads Setup...\n');

  // Test Supabase connection
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Test 1: Check if profiles table exists and has data
    console.log('1. Testing profiles table...');
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, company_name, is_admin')
      .limit(5);

    if (profilesError) {
      console.error('❌ Profiles table error:', profilesError);
      return;
    }

    console.log(`✅ Profiles table accessible. Found ${profiles.length} profiles:`);
    profiles.forEach(profile => {
      console.log(`   - ${profile.first_name} ${profile.last_name} (${profile.email}) - Admin: ${profile.is_admin}`);
    });

    // Test 2: Check if leads table exists and has data
    console.log('\n2. Testing leads table...');
    const { data: leads, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('id, name, email, status, created_at')
      .limit(5);

    if (leadsError) {
      console.error('❌ Leads table error:', leadsError);
      return;
    }

    console.log(`✅ Leads table accessible. Found ${leads.length} leads:`);
    leads.forEach(lead => {
      console.log(`   - ${lead.name} (${lead.email}) - Status: ${lead.status}`);
    });

    // Test 3: Test the API endpoint logic
    console.log('\n3. Testing API endpoint logic...');
    
    // Simulate the /api/users endpoint
    const { data: users, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, company_name, created_at')
      .order('first_name', { ascending: true });

    if (usersError) {
      console.error('❌ Users API simulation error:', usersError);
      return;
    }

    console.log(`✅ Users API simulation successful. Found ${users.length} users:`);
    users.forEach(user => {
      console.log(`   - ${user.first_name} ${user.last_name} (${user.company_name || 'No company'})`);
    });

    // Test 4: Test leads with user assignments
    console.log('\n4. Testing leads with user assignments...');
    const { data: leadsWithUsers, error: leadsWithUsersError } = await supabaseAdmin
      .from('leads')
      .select(`
        *,
        assigned_user:user_id (
          id,
          first_name,
          last_name,
          company_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (leadsWithUsersError) {
      console.error('❌ Leads with users error:', leadsWithUsersError);
      return;
    }

    console.log(`✅ Leads with users query successful. Found ${leadsWithUsers.length} leads:`);
    leadsWithUsers.forEach(lead => {
      const assignedTo = lead.assigned_user ? 
        `${lead.assigned_user.first_name} ${lead.assigned_user.last_name}` : 
        'Not assigned';
      console.log(`   - ${lead.name} - Assigned to: ${assignedTo}`);
    });

    console.log('\n🎉 All tests passed! Admin leads should work correctly.');
    console.log('\n📝 Next steps:');
    console.log('   1. Make sure you have admin users in the profiles table');
    console.log('   2. Set is_admin = true for admin users');
    console.log('   3. Test the /admin/leads page');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAdminLeads();
