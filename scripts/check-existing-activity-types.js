const { supabaseAdmin } = require('../config/supabase');

async function checkExistingTypes() {
  console.log('🔍 Check bestaande activity types in database\n');
  
  try {
    const { data: activities, error } = await supabaseAdmin
      .from('lead_activities')
      .select('type, id, lead_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    const typeCounts = {};
    const invalidTypes = [];
    const validTypes = [
      'phone_call',
      'email_sent',
      'whatsapp',
      'meeting',
      'status_change_contacted',
      'note',
      'message',
      'created',
      'status_changed',
      'appointment_attended',
      'no_show_customer',
      'status_change_won',
      'status_change_lost'
    ];
    
    activities.forEach(act => {
      typeCounts[act.type] = (typeCounts[act.type] || 0) + 1;
      if (!validTypes.includes(act.type)) {
        invalidTypes.push({
          id: act.id,
          type: act.type,
          lead_id: act.lead_id,
          created_at: act.created_at
        });
      }
    });
    
    console.log('📊 Activity types in database:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      const isValid = validTypes.includes(type);
      console.log(`  ${isValid ? '✅' : '❌'} ${type}: ${count}x ${isValid ? '' : '(INVALID)'}`);
    });
    
    if (invalidTypes.length > 0) {
      console.log(`\n⚠️  ${invalidTypes.length} activiteiten met ongeldige types gevonden:`);
      invalidTypes.slice(0, 10).forEach(inv => {
        console.log(`  - ID: ${inv.id}, Type: "${inv.type}", Lead: ${inv.lead_id}`);
      });
      if (invalidTypes.length > 10) {
        console.log(`  ... en ${invalidTypes.length - 10} meer`);
      }
    } else {
      console.log('\n✅ Alle activity types zijn geldig!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkExistingTypes().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

