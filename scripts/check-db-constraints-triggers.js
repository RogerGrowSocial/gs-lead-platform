const { supabaseAdmin } = require('../config/supabase');

async function checkConstraintsAndTriggers() {
  console.log('🔍 DATABASE CONSTRAINTS & TRIGGERS INSPECTIE\n');
  console.log('='.repeat(80));
  
  try {
    // 1. Check constraints op lead_activities.type
    console.log('\n📋 1. CHECK CONSTRAINT OP lead_activities.type\n');
    
    // Query om constraints te vinden
    const constraintQuery = `
      SELECT 
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS constraint_definition
      FROM pg_constraint
      WHERE conrelid = 'public.lead_activities'::regclass
        AND contype = 'c'
        AND conname LIKE '%type%';
    `;
    
    // We kunnen dit niet direct via Supabase doen, maar we kunnen wel proberen
    // een insert te doen met een ongeldig type om te zien wat de error is
    console.log('Test: proberen ongeldig activity type in te voegen...');
    const { error: testError } = await supabaseAdmin
      .from('lead_activities')
      .insert({
        lead_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
        type: 'INVALID_TEST_TYPE_XYZ',
        description: 'Test',
        created_by: '00000000-0000-0000-0000-000000000000'
      });
    
    if (testError) {
      console.log('✅ Constraint bestaat! Error:', testError.message);
      if (testError.message.includes('check constraint')) {
        console.log('   → Er is een CHECK constraint op het type veld');
      }
    } else {
      console.log('⚠️ Geen constraint gevonden - insert zou geslaagd zijn (maar lead_id is invalid)');
    }
    
    // 2. Check of first_contact_at trigger bestaat
    console.log('\n\n📋 2. CHECK TRIGGER VOOR first_contact_at\n');
    
    // Check of er een trigger functie bestaat
    const triggerFunctionQuery = `
      SELECT 
        proname AS function_name,
        pg_get_functiondef(oid) AS function_definition
      FROM pg_proc
      WHERE proname LIKE '%first_contact%';
    `;
    
    // Check of er triggers zijn op lead_activities
    const triggerQuery = `
      SELECT 
        tgname AS trigger_name,
        tgtype,
        tgenabled,
        pg_get_triggerdef(oid) AS trigger_definition
      FROM pg_trigger
      WHERE tgrelid = 'public.lead_activities'::regclass
        AND tgname LIKE '%first_contact%';
    `;
    
    // We kunnen dit niet direct via Supabase doen, maar we kunnen testen
    // door een activity in te voegen en te kijken of first_contact_at wordt gezet
    console.log('Test: check of trigger automatisch first_contact_at zet...');
    
    // Eerst een test lead ophalen die nog geen first_contact_at heeft
    const { data: testLead } = await supabaseAdmin
      .from('leads')
      .select('id, first_contact_at')
      .is('first_contact_at', null)
      .limit(1);
    
    if (testLead && testLead.length > 0) {
      const leadId = testLead[0].id;
      const originalFirstContact = testLead[0].first_contact_at;
      
      console.log(`   Test lead gevonden: ${leadId}`);
      console.log(`   Huidige first_contact_at: ${originalFirstContact || 'NULL'}`);
      
      // Probeer een contact activity in te voegen
      const { data: newActivity, error: activityError } = await supabaseAdmin
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          type: 'phone_call',
          description: 'Test trigger - wordt verwijderd',
          created_by: '00000000-0000-0000-0000-000000000000'
        })
        .select()
        .single();
      
      if (!activityError && newActivity) {
        // Check of first_contact_at nu is gezet
        const { data: updatedLead } = await supabaseAdmin
          .from('leads')
          .select('first_contact_at')
          .eq('id', leadId)
          .single();
        
        if (updatedLead && updatedLead.first_contact_at && !originalFirstContact) {
          console.log('✅ TRIGGER BESTAAT! first_contact_at is automatisch gezet');
          console.log(`   Nieuwe first_contact_at: ${updatedLead.first_contact_at}`);
          
          // Cleanup: verwijder test activity en reset first_contact_at
          await supabaseAdmin
            .from('lead_activities')
            .delete()
            .eq('id', newActivity.id);
          
          await supabaseAdmin
            .from('leads')
            .update({ first_contact_at: null })
            .eq('id', leadId);
          
          console.log('   → Test activity verwijderd en first_contact_at gereset');
        } else {
          console.log('❌ GEEN TRIGGER GEVONDEN');
          console.log(`   first_contact_at is nog steeds: ${updatedLead?.first_contact_at || 'NULL'}`);
          
          // Cleanup
          await supabaseAdmin
            .from('lead_activities')
            .delete()
            .eq('id', newActivity.id);
        }
      } else {
        console.log('⚠️ Kon test activity niet aanmaken:', activityError?.message);
      }
    } else {
      console.log('⚠️ Geen test lead gevonden zonder first_contact_at');
    }
    
    // 3. Check huidige activity types in gebruik
    console.log('\n\n📋 3. HUIDIGE ACTIVITY TYPES IN GEBRUIK\n');
    const { data: allActivities } = await supabaseAdmin
      .from('lead_activities')
      .select('type')
      .limit(1000);
    
    if (allActivities) {
      const typeCounts = {};
      allActivities.forEach(a => {
        typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
      });
      
      console.log('Activity types en aantal:');
      Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}x`);
      });
    }
    
    // 4. Check lead_activities tabel structuur
    console.log('\n\n📋 4. LEAD_ACTIVITIES TABEL STRUCTUUR\n');
    const { data: sampleActivity } = await supabaseAdmin
      .from('lead_activities')
      .select('*')
      .limit(1)
      .single();
    
    if (sampleActivity) {
      console.log('Kolommen:', Object.keys(sampleActivity).join(', '));
      console.log('\nSample record:');
      console.log(JSON.stringify(sampleActivity, null, 2));
    }
    
    console.log('\n\n' + '='.repeat(80));
    console.log('✅ INSPECTIE VOLTOOID');
    
  } catch (error) {
    console.error('❌ Fout bij inspectie:', error);
  }
}

checkConstraintsAndTriggers().then(() => {
  console.log('\nKlaar!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

