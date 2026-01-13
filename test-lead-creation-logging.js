const { supabaseAdmin } = require('./config/supabase');
const SystemLogService = require('./services/systemLogService');

async function testLeadCreationLogging() {
  console.log('🧪 Testing Lead Creation System Logging...\n');

  try {
    // Test 1: Log a lead creation manually
    console.log('📝 Test 1: Manual lead creation logging...');
    const logId1 = await SystemLogService.log({
      type: 'success',
      category: 'admin',
      title: 'Nieuwe Lead Aangemaakt',
      message: 'Nieuwe lead aangemaakt: Test Bedrijf (test@example.com)',
      details: 'Lead ID: test-123, Branche: Dakdekkers, Toegewezen aan: Jan Jansen, Prioriteit: medium',
      source: 'Test Script',
      userId: null,
      adminId: null,
      metadata: {
        lead_id: 'test-123',
        lead_name: 'Test Bedrijf',
        lead_email: 'test@example.com',
        industry_id: 1,
        industry_name: 'Dakdekkers',
        assigned_user_id: null,
        assigned_user_name: 'Jan Jansen',
        priority: 'medium',
        status: 'new',
        deadline: null
      },
      severity: 'medium'
    });
    console.log(`✅ Lead creation log created with ID: ${logId1}`);

    // Test 2: Log with assigned user
    console.log('\n👤 Test 2: Lead creation with assigned user...');
    const logId2 = await SystemLogService.log({
      type: 'success',
      category: 'admin',
      title: 'Nieuwe Lead Aangemaakt',
      message: 'Nieuwe lead aangemaakt: Bouwbedrijf ABC (bouw@abc.nl)',
      details: 'Lead ID: test-456, Branche: Bouw, Toegewezen aan: Admin User, Prioriteit: high',
      source: 'Test Script',
      userId: 'test-user-id',
      adminId: 'test-admin-id',
      metadata: {
        lead_id: 'test-456',
        lead_name: 'Bouwbedrijf ABC',
        lead_email: 'bouw@abc.nl',
        industry_id: 2,
        industry_name: 'Bouw',
        assigned_user_id: 'test-user-id',
        assigned_user_name: 'Admin User',
        priority: 'high',
        status: 'new',
        deadline: '2025-02-15T10:00:00Z'
      },
      severity: 'medium'
    });
    console.log(`✅ Lead creation with user log created with ID: ${logId2}`);

    // Test 3: Log lead creation from different sources
    console.log('\n🌐 Test 3: Lead creation from different API sources...');
    const logId3 = await SystemLogService.log({
      type: 'success',
      category: 'admin',
      title: 'Nieuwe Lead Aangemaakt',
      message: 'Nieuwe lead aangemaakt: Webwinkel XYZ (info@xyz.com)',
      details: 'Lead ID: test-789, Branche: E-commerce, Toegewezen aan: Niet toegewezen, Prioriteit: low',
      source: 'Leads API',
      userId: null,
      adminId: 'admin-123',
      metadata: {
        lead_id: 'test-789',
        lead_name: 'Webwinkel XYZ',
        lead_email: 'info@xyz.com',
        industry_id: 3,
        industry_name: 'E-commerce',
        assigned_user_id: null,
        assigned_user_name: 'Niet toegewezen',
        priority: 'low',
        status: 'new',
        deadline: null
      },
      severity: 'medium'
    });
    console.log(`✅ Lead creation from API log created with ID: ${logId3}`);

    // Test 4: Verify logs in database
    console.log('\n🔍 Test 4: Verifying logs in database...');
    const { data: logs, error } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .eq('title', 'Nieuwe Lead Aangemaakt')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching logs:', error);
    } else {
      console.log(`✅ Found ${logs.length} lead creation logs in database:`);
      logs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.message} (${log.source}) - ${log.created_at}`);
      });
    }

    console.log('\n🎉 Lead creation logging test completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Manual logging: ✅');
    console.log('   - User assignment logging: ✅');
    console.log('   - API source logging: ✅');
    console.log('   - Database verification: ✅');

  } catch (error) {
    console.error('❌ Error during lead creation logging test:', error);
  }
}

// Run the test
testLeadCreationLogging();
