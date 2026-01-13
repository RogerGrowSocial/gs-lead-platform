const { supabaseAdmin } = require('../config/supabase');

async function checkTypeConstraint() {
  console.log('🔍 CHECK TYPE CONSTRAINT OP lead_activities.type\n');
  
  try {
    // Haal een echte lead op
    const { data: realLead } = await supabaseAdmin
      .from('leads')
      .select('id')
      .limit(1)
      .single();
    
    if (!realLead) {
      console.log('❌ Geen leads gevonden om te testen');
      return;
    }
    
    console.log(`Test met lead: ${realLead.id}\n`);
    
    // Test 1: Probeer ongeldig type
    console.log('Test 1: Ongeldig type "INVALID_TYPE_XYZ"...');
    const { error: invalidError } = await supabaseAdmin
      .from('lead_activities')
      .insert({
        lead_id: realLead.id,
        type: 'INVALID_TYPE_XYZ',
        description: 'Test invalid type',
        created_by: '00000000-0000-0000-0000-000000000000'
      });
    
    if (invalidError) {
      if (invalidError.message.includes('check constraint') || invalidError.message.includes('type')) {
        console.log('✅ CHECK CONSTRAINT BESTAAT op type veld');
        console.log(`   Error: ${invalidError.message}`);
      } else {
        console.log('⚠️ Error, maar niet duidelijk of het type constraint is:');
        console.log(`   ${invalidError.message}`);
      }
    } else {
      console.log('❌ GEEN CONSTRAINT - invalid type werd geaccepteerd!');
    }
    
    // Test 2: Probeer geldig type (created)
    console.log('\nTest 2: Geldig type "created"...');
    const { data: validActivity, error: validError } = await supabaseAdmin
      .from('lead_activities')
      .insert({
        lead_id: realLead.id,
        type: 'created',
        description: 'Test valid type - wordt verwijderd',
        created_by: '00000000-0000-0000-0000-000000000000'
      })
      .select()
      .single();
    
    if (!validError && validActivity) {
      console.log('✅ Geldig type "created" werd geaccepteerd');
      
      // Cleanup
      await supabaseAdmin
        .from('lead_activities')
        .delete()
        .eq('id', validActivity.id);
      console.log('   → Test activity verwijderd');
    } else {
      console.log('❌ Geldig type werd geweigerd:', validError?.message);
    }
    
    // Test 3: Probeer nieuwe type (phone_call) - dit zou moeten falen als constraint alleen oude types toestaat
    console.log('\nTest 3: Nieuw type "phone_call"...');
    const { data: newTypeActivity, error: newTypeError } = await supabaseAdmin
      .from('lead_activities')
      .insert({
        lead_id: realLead.id,
        type: 'phone_call',
        description: 'Test new type - wordt verwijderd',
        created_by: '00000000-0000-0000-0000-000000000000'
      })
      .select()
      .single();
    
    if (!newTypeError && newTypeActivity) {
      console.log('✅ Nieuw type "phone_call" werd geaccepteerd');
      console.log('   → Constraint moet uitgebreid worden of bestaat niet');
      
      // Cleanup
      await supabaseAdmin
        .from('lead_activities')
        .delete()
        .eq('id', newTypeActivity.id);
      console.log('   → Test activity verwijderd');
    } else {
      if (newTypeError && (newTypeError.message.includes('check constraint') || newTypeError.message.includes('type'))) {
        console.log('❌ Nieuw type "phone_call" werd geweigerd door constraint');
        console.log(`   Error: ${newTypeError.message}`);
        console.log('   → Constraint moet uitgebreid worden met nieuwe types');
      } else {
        console.log('⚠️ Error (mogelijk andere oorzaak):', newTypeError?.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Fout:', error);
  }
}

checkTypeConstraint().then(() => {
  console.log('\n✅ Test voltooid');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

