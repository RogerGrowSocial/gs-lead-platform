const { supabaseAdmin } = require('../config/supabase');

async function inspectDatabase() {
  console.log('🔍 DATABASE INSPECTIE VOOR LEAD WORKSPACE\n');
  console.log('='.repeat(80));
  
  try {
    // 1. Inspecteer kolommen van relevante tabellen
    console.log('\n📊 1. TABEL KOLOMMEN INSPECTIE\n');
    
    const tables = ['leads', 'profiles', 'lead_activities', 'lead_feedback', 'support_tickets'];
    
    for (const table of tables) {
      console.log(`\n--- ${table.toUpperCase()} ---`);
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .limit(0);
      
      if (error) {
        console.log(`❌ Tabel ${table} bestaat niet of is niet toegankelijk:`, error.message);
      } else {
        // Probeer een sample record op te halen om structuur te zien
        const { data: sample, error: sampleError } = await supabaseAdmin
          .from(table)
          .select('*')
          .limit(1);
        
        if (!sampleError && sample && sample.length > 0) {
          console.log('Kolommen:', Object.keys(sample[0]).join(', '));
          console.log('Sample data:', JSON.stringify(sample[0], null, 2));
        } else {
          console.log('Tabel bestaat maar is leeg');
        }
      }
    }
    
    // 2. Check specifieke kolommen in leads
    console.log('\n\n📋 2. LEADS TABEL SPECIFIEKE KOLOMMEN\n');
    const { data: leadSample } = await supabaseAdmin
      .from('leads')
      .select('*')
      .limit(1);
    
    if (leadSample && leadSample.length > 0) {
      const lead = leadSample[0];
      console.log('Beschikbare kolommen:', Object.keys(lead).join(', '));
      console.log('\nRelevante velden:');
      console.log('- id:', lead.id ? '✅' : '❌');
      console.log('- name:', lead.name ? '✅' : '❌');
      console.log('- email:', lead.email ? '✅' : '❌');
      console.log('- phone:', lead.phone ? '✅' : '❌');
      console.log('- message:', lead.message ? '✅' : '❌');
      console.log('- status:', lead.status ? `✅ (${lead.status})` : '❌');
      console.log('- user_id:', lead.user_id ? '✅' : '❌');
      console.log('- assigned_to:', lead.assigned_to ? '✅' : '❌');
      console.log('- first_contact_at:', lead.first_contact_at !== undefined ? '✅' : '❌');
      console.log('- deal_value:', lead.deal_value !== undefined ? '✅' : '❌');
      console.log('- price_at_purchase:', lead.price_at_purchase !== undefined ? '✅' : '❌');
      console.log('- province:', lead.province ? '✅' : '❌');
      console.log('- industry_id:', lead.industry_id ? '✅' : '❌');
    }
    
    // 3. Check lead_activities structuur
    console.log('\n\n📋 3. LEAD_ACTIVITIES TABEL STRUCTUUR\n');
    const { data: activitySample } = await supabaseAdmin
      .from('lead_activities')
      .select('*')
      .limit(5);
    
    if (activitySample && activitySample.length > 0) {
      console.log('Beschikbare kolommen:', Object.keys(activitySample[0]).join(', '));
      console.log('\nSample activities:');
      activitySample.forEach((act, idx) => {
        console.log(`\nActivity ${idx + 1}:`);
        console.log('- id:', act.id);
        console.log('- lead_id:', act.lead_id);
        console.log('- type:', act.type);
        console.log('- description:', act.description);
        console.log('- created_by:', act.created_by);
        console.log('- partner_id:', act.partner_id || 'N/A');
        console.log('- created_at:', act.created_at);
        console.log('- metadata:', act.metadata ? JSON.stringify(act.metadata) : 'N/A');
      });
      
      // Check welke types er gebruikt worden
      const types = [...new Set(activitySample.map(a => a.type))];
      console.log('\nGebruikte activity types:', types.join(', '));
    } else {
      console.log('Geen activities gevonden');
    }
    
    // 4. Check constraints op lead_activities.type
    console.log('\n\n📋 4. CHECK ACTIVITY TYPES\n');
    const { data: allTypes } = await supabaseAdmin
      .from('lead_activities')
      .select('type');
    
    if (allTypes) {
      const uniqueTypes = [...new Set(allTypes.map(a => a.type).filter(Boolean))];
      console.log('Unieke activity types in database:', uniqueTypes.join(', '));
    }
    
    // 5. Check lead_feedback structuur
    console.log('\n\n📋 5. LEAD_FEEDBACK TABEL\n');
    const { data: feedbackSample } = await supabaseAdmin
      .from('lead_feedback')
      .select('*')
      .limit(1);
    
    if (feedbackSample && feedbackSample.length > 0) {
      console.log('Kolommen:', Object.keys(feedbackSample[0]).join(', '));
      console.log('Sample:', JSON.stringify(feedbackSample[0], null, 2));
    } else {
      console.log('Tabel bestaat maar is leeg of bestaat niet');
    }
    
    // 6. Check support_tickets structuur
    console.log('\n\n📋 6. SUPPORT_TICKETS TABEL\n');
    const { data: ticketSample } = await supabaseAdmin
      .from('support_tickets')
      .select('*')
      .limit(1);
    
    if (ticketSample && ticketSample.length > 0) {
      console.log('Kolommen:', Object.keys(ticketSample[0]).join(', '));
      console.log('Sample:', JSON.stringify(ticketSample[0], null, 2));
    } else {
      console.log('Tabel bestaat maar is leeg of bestaat niet');
    }
    
    console.log('\n\n' + '='.repeat(80));
    console.log('✅ INSPECTIE VOLTOOID');
    
  } catch (error) {
    console.error('❌ Fout bij inspectie:', error);
  }
}

inspectDatabase().then(() => {
  console.log('\nKlaar!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

