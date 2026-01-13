#!/usr/bin/env node

/**
 * Test Script voor Lead Flow Intelligence System
 * 
 * Test alle onderdelen van het systeem:
 * 1. Segment assignment
 * 2. Stats aggregatie
 * 3. Demand planning
 * 4. Orchestration
 */

const { supabaseAdmin } = require('../config/supabase');
const LeadSegmentService = require('../services/leadSegmentService');
const LeadDemandPlannerService = require('../services/leadDemandPlannerService');
const ChannelOrchestratorService = require('../services/channelOrchestratorService');

async function testSegmentAssignment() {
  console.log('\n📋 TEST 1: Segment Assignment');
  console.log('─'.repeat(50));
  
  try {
    // Haal een recente lead op
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('id, industry_id, province, postcode, segment_id')
      .not('industry_id', 'is', null)
      .limit(1)
      .order('created_at', { ascending: false });
    
    if (error || !leads || leads.length === 0) {
      console.log('⚠️  Geen leads gevonden met industry_id');
      return;
    }
    
    const lead = leads[0];
    console.log(`✓ Lead gevonden: ${lead.id}`);
    console.log(`  Industry ID: ${lead.industry_id}`);
    console.log(`  Province: ${lead.province || 'N/A'}`);
    console.log(`  Postcode: ${lead.postcode || 'N/A'}`);
    console.log(`  Segment ID: ${lead.segment_id || 'Niet toegewezen'}`);
    
    // Test segment assignment
    if (!lead.segment_id) {
      console.log('  → Test segment assignment...');
      const segment = await LeadSegmentService.assignSegmentToLead(lead.id);
      if (segment) {
        console.log(`  ✓ Segment toegewezen: ${segment.code}`);
      } else {
        console.log('  ⚠️  Geen segment gevonden voor deze lead');
      }
    } else {
      const segment = await LeadSegmentService.getSegmentById(lead.segment_id);
      console.log(`  ✓ Segment al toegewezen: ${segment.code}`);
    }
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }
}

async function testSegments() {
  console.log('\n📋 TEST 2: Segmenten Overzicht');
  console.log('─'.repeat(50));
  
  try {
    const segments = await LeadSegmentService.getAllActiveSegments();
    console.log(`✓ ${segments.length} actieve segmenten gevonden`);
    
    if (segments.length > 0) {
      console.log('\n  Eerste 5 segmenten:');
      segments.slice(0, 5).forEach(seg => {
        console.log(`  - ${seg.code} (${seg.branch} / ${seg.region})`);
      });
      
      // Test capaciteit voor eerste segment
      if (segments.length > 0) {
        const capacity = await LeadSegmentService.getSegmentCapacity(segments[0].id);
        console.log(`\n  Capaciteit voor ${segments[0].code}:`);
        console.log(`    Partners: ${capacity.capacity_partners}`);
        console.log(`    Totale capaciteit: ${capacity.capacity_total_leads} leads`);
        console.log(`    Huidige open leads: ${capacity.current_open_leads}`);
      }
    } else {
      console.log('  ⚠️  Geen segmenten gevonden. Maak eerst een segment aan.');
    }
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }
}

async function testStats() {
  console.log('\n📋 TEST 3: Stats Overzicht');
  console.log('─'.repeat(50));
  
  try {
    const { data: stats, error } = await supabaseAdmin
      .from('lead_generation_stats')
      .select('*, lead_segments(code)')
      .order('date', { ascending: false })
      .limit(5);
    
    if (error) {
      throw error;
    }
    
    if (stats && stats.length > 0) {
      console.log(`✓ ${stats.length} stats records gevonden`);
      stats.forEach(stat => {
        console.log(`\n  ${stat.lead_segments?.code || 'Unknown'} - ${stat.date}:`);
        console.log(`    Leads: ${stat.leads_generated} (${stat.leads_accepted} accepted)`);
        console.log(`    CPL: €${stat.avg_cpl || 'N/A'}`);
        console.log(`    Google Ads spend: €${stat.google_ads_spend || 0}`);
      });
    } else {
      console.log('  ⚠️  Geen stats gevonden. Run eerst aggregateLeadStatsDaily.');
    }
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }
}

async function testPlans() {
  console.log('\n📋 TEST 4: Plans Overzicht');
  console.log('─'.repeat(50));
  
  try {
    const { data: plans, error } = await supabaseAdmin
      .from('lead_segment_plans')
      .select('*, lead_segments(code)')
      .order('date', { ascending: false })
      .limit(5);
    
    if (error) {
      throw error;
    }
    
    if (plans && plans.length > 0) {
      console.log(`✓ ${plans.length} plans gevonden`);
      plans.forEach(plan => {
        console.log(`\n  ${plan.lead_segments?.code || 'Unknown'} - ${plan.date}:`);
        console.log(`    Target: ${plan.target_leads_per_day} leads/dag`);
        console.log(`    Gap: ${plan.lead_gap || 0} (${plan.lead_gap_percentage || 0}%)`);
        console.log(`    Status: ${plan.orchestration_status || 'N/A'}`);
      });
    } else {
      console.log('  ⚠️  Geen plans gevonden. Run eerst runLeadDemandPlanningDaily.');
    }
  } catch (error) {
    console.error('  ❌ Error:', error.message);
  }
}

async function testDatabaseSchema() {
  console.log('\n📋 TEST 0: Database Schema Verificatie');
  console.log('─'.repeat(50));
  
  const tables = [
    'lead_segments',
    'lead_generation_stats',
    'lead_segment_plans',
    'channel_orchestration_log'
  ];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .limit(1);
      
      if (error && error.code === '42P01') {
        console.log(`  ❌ Tabel ${table} bestaat niet!`);
      } else {
        console.log(`  ✓ Tabel ${table} bestaat`);
      }
    } catch (error) {
      console.log(`  ❌ Error checking ${table}: ${error.message}`);
    }
  }
  
  // Check leads table columns
  try {
    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('segment_id, source_channel')
      .limit(1);
    
    if (error && error.message.includes('column')) {
      console.log('  ❌ Leads tabel mist nieuwe kolommen!');
    } else {
      console.log('  ✓ Leads tabel heeft nieuwe kolommen');
    }
  } catch (error) {
    console.log(`  ⚠️  Could not verify leads columns: ${error.message}`);
  }
}

async function runAllTests() {
  console.log('🧪 LEAD FLOW INTELLIGENCE - Test Suite');
  console.log('='.repeat(50));
  
  await testDatabaseSchema();
  await testSegments();
  await testSegmentAssignment();
  await testStats();
  await testPlans();
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Test suite voltooid!');
  console.log('\n💡 Tips:');
  console.log('  - Maak een test lead aan om segment assignment te testen');
  console.log('  - Run: node cron/aggregateLeadStatsDaily.js');
  console.log('  - Run: node cron/runLeadDemandPlanningDaily.js');
  console.log('  - Run: node cron/adjustGoogleAdsBudgetsDaily.js');
}

// Run tests
if (require.main === module) {
  runAllTests()
    .then(() => {
      console.log('\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testDatabaseSchema,
  testSegments,
  testSegmentAssignment,
  testStats,
  testPlans,
  runAllTests
};

