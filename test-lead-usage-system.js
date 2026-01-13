const { supabaseAdmin } = require('./config/supabase');

async function testLeadUsageSystem() {
  console.log('🧪 Testing Lead Usage System...');
  
  try {
    // Test 1: Check if lead_usage table exists
    console.log('1️⃣ Checking if lead_usage table exists...');
    const { data: tables, error: tableError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'lead_usage')
      .eq('table_schema', 'public');
    
    if (tableError) {
      console.error('❌ Error checking tables:', tableError);
      return;
    }
    
    if (tables && tables.length > 0) {
      console.log('✅ lead_usage table exists');
    } else {
      console.log('❌ lead_usage table does not exist');
      return;
    }
    
    // Test 2: Check if trigger exists
    console.log('2️⃣ Checking if trigger exists...');
    const { data: triggers, error: triggerError } = await supabaseAdmin
      .from('information_schema.triggers')
      .select('trigger_name')
      .eq('trigger_name', 'trigger_update_lead_usage')
      .eq('event_object_table', 'leads');
    
    if (triggerError) {
      console.error('❌ Error checking triggers:', triggerError);
    } else if (triggers && triggers.length > 0) {
      console.log('✅ Trigger exists');
    } else {
      console.log('❌ Trigger does not exist');
    }
    
    // Test 3: Check existing data
    console.log('3️⃣ Checking existing lead_usage data...');
    const { data: usageData, error: usageError } = await supabaseAdmin
      .from('lead_usage')
      .select('*')
      .limit(5);
    
    if (usageError) {
      console.error('❌ Error fetching usage data:', usageError);
    } else {
      console.log(`✅ Found ${usageData ? usageData.length : 0} usage records`);
      if (usageData && usageData.length > 0) {
        console.log('Sample record:', JSON.stringify(usageData[0], null, 2));
      }
    }
    
    // Test 4: Test billing function
    console.log('4️⃣ Testing billing function...');
    const { data: users, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (userError) {
      console.error('❌ Error getting test user:', userError);
    } else if (users && users.length > 0) {
      const userId = users[0].id;
      console.log(`Testing with user: ${userId}`);
      
      const { data: snapshot, error: snapshotError } = await supabaseAdmin
        .rpc('get_billing_snapshot', { p_user: userId });
      
      if (snapshotError) {
        console.error('❌ Error calling billing function:', snapshotError);
      } else {
        console.log('✅ Billing function works');
        console.log('Snapshot:', JSON.stringify(snapshot, null, 2));
      }
    }
    
    // Test 5: Compare old vs new method
    console.log('5️⃣ Comparing old vs new method...');
    if (users && users.length > 0) {
      const userId = users[0].id;
      const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      
      // Old method (direct count)
      const { data: oldLeads, error: oldError } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'approved')
        .gte('created_at', currentMonth + 'T00:00:00.000Z')
        .lt('created_at', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString());
      
      // New method (lead_usage table)
      const { data: newUsage, error: newError } = await supabaseAdmin
        .from('lead_usage')
        .select('leads_count')
        .eq('user_id', userId)
        .eq('period_month', currentMonth)
        .single();
      
      const oldCount = oldLeads ? oldLeads.length : 0;
      const newCount = newUsage ? newUsage.leads_count : 0;
      
      console.log(`Old method count: ${oldCount}`);
      console.log(`New method count: ${newCount}`);
      
      if (oldCount === newCount) {
        console.log('✅ Counts match!');
      } else {
        console.log('⚠️ Counts differ - this might indicate data sync issues');
      }
    }
    
    console.log('🎉 Lead Usage System test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testLeadUsageSystem();
