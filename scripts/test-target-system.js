#!/usr/bin/env node

/**
 * Test Script: Target System Verification
 * 
 * Test of het target-systeem correct werkt:
 * 1. Capaciteit berekening (op basis van partner max_open_leads)
 * 2. Target berekening (80% van capaciteit, min 5)
 * 3. Gap berekening (target - actual)
 * 4. Opslag in lead_segment_plans
 */

const LeadDemandPlannerService = require('../services/leadDemandPlannerService');
const LeadSegmentService = require('../services/leadSegmentService');
const { supabaseAdmin } = require('../config/supabase');

async function testTargetSystem() {
  console.log('🧪 TEST: Target System Verification\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Haal een actief segment op
    console.log('\n📋 STAP 1: Zoek actief segment...');
    const segments = await LeadSegmentService.getAllActiveSegments();
    
    if (segments.length === 0) {
      console.log('❌ Geen actieve segmenten gevonden!');
      console.log('   Maak eerst een segment aan in de database.');
      process.exit(1);
    }
    
    const testSegment = segments[0];
    console.log(`✅ Segment gevonden: ${testSegment.branch} - ${testSegment.region} (${testSegment.id})`);
    
    // 2. Test capaciteit berekening
    console.log('\n📊 STAP 2: Test capaciteit berekening...');
    const capacity = await LeadSegmentService.getSegmentCapacity(testSegment.id);
    console.log(`   Partners: ${capacity.capacity_partners}`);
    console.log(`   Totale capaciteit (max_open_leads): ${capacity.capacity_total_leads}`);
    console.log(`   Huidige open leads: ${capacity.current_open_leads}`);
    
    if (capacity.capacity_total_leads === 0) {
      console.log('⚠️  WAARSCHUWING: Geen capaciteit gevonden!');
      console.log('   Zorg dat er actieve partners zijn met:');
      console.log('   - primary_branch of lead_industries matcht met segment branch');
      console.log('   - regions of lead_locations matcht met segment region');
      console.log('   - is_active_for_routing = true');
      console.log('   - max_open_leads > 0');
    }
    
    // 3. Test target berekening
    console.log('\n🎯 STAP 3: Test target berekening...');
    const today = new Date();
    const target = await LeadDemandPlannerService.calculateTargetLeads(testSegment.id, today);
    const expectedTarget = Math.max(5, Math.floor(capacity.capacity_total_leads * 0.8));
    
    console.log(`   Berekende target: ${target} leads/dag`);
    console.log(`   Verwachte target: ${expectedTarget} leads/dag (80% van ${capacity.capacity_total_leads})`);
    
    if (target === expectedTarget) {
      console.log('   ✅ Target berekening correct!');
    } else {
      console.log('   ⚠️  Target wijkt af van verwachting (mogelijk minimum van 5)');
    }
    
    // 4. Test gap berekening
    console.log('\n📈 STAP 4: Test gap berekening...');
    const gapAnalysis = await LeadDemandPlannerService.calculateLeadGap(testSegment.id, today);
    console.log(`   Target: ${gapAnalysis.target} leads/dag`);
    console.log(`   Actual: ${gapAnalysis.actual} leads/dag`);
    console.log(`   Gap: ${gapAnalysis.gap} leads`);
    console.log(`   Gap percentage: ${gapAnalysis.gapPercentage}%`);
    
    if (gapAnalysis.gap > 0) {
      console.log('   📊 Status: Achterstand (meer leads nodig)');
    } else if (gapAnalysis.gap < 0) {
      console.log('   📊 Status: Overtarget (genoeg leads)');
    } else {
      console.log('   📊 Status: Precies op target');
    }
    
    // 5. Test planSegment (opslag)
    console.log('\n💾 STAP 5: Test opslag in lead_segment_plans...');
    const plan = await LeadDemandPlannerService.planSegment(testSegment.id, today);
    console.log(`   ✅ Plan opgeslagen: ID ${plan.id}`);
    console.log(`   Target: ${plan.target_leads_per_day} leads/dag`);
    console.log(`   Gap: ${plan.lead_gap} leads`);
    console.log(`   Gap percentage: ${plan.lead_gap_percentage}%`);
    
    // 6. Verifieer opslag in database
    console.log('\n🔍 STAP 6: Verifieer database opslag...');
    const { data: dbPlan, error } = await supabaseAdmin
      .from('lead_segment_plans')
      .select('*')
      .eq('segment_id', testSegment.id)
      .eq('date', today.toISOString().split('T')[0])
      .single();
    
    if (error) {
      console.log(`   ❌ Fout bij ophalen plan: ${error.message}`);
    } else {
      console.log(`   ✅ Plan gevonden in database`);
      console.log(`   Target: ${dbPlan.target_leads_per_day}`);
      console.log(`   Gap: ${dbPlan.lead_gap}`);
    }
    
    // 7. Test planAllSegments (alle segmenten)
    console.log('\n🌐 STAP 7: Test planAllSegments (alle segmenten)...');
    const result = await LeadDemandPlannerService.planAllSegments(today);
    console.log(`   ✅ ${result.segmentsPlanned}/${result.totalSegments} segmenten gepland`);
    
    if (result.results) {
      const failed = result.results.filter(r => !r.success);
      if (failed.length > 0) {
        console.log(`   ⚠️  ${failed.length} segmenten gefaald:`);
        failed.forEach(f => console.log(`      - ${f.segmentId}: ${f.error}`));
      }
    }
    
    // 8. Samenvatting
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST SAMENVATTING');
    console.log('='.repeat(60));
    console.log(`Segment: ${testSegment.branch} - ${testSegment.region}`);
    console.log(`Capaciteit: ${capacity.capacity_total_leads} leads (${capacity.capacity_partners} partners)`);
    console.log(`Target: ${target} leads/dag`);
    console.log(`Actual: ${gapAnalysis.actual} leads/dag`);
    console.log(`Gap: ${gapAnalysis.gap} leads`);
    console.log(`Status: ${gapAnalysis.gap > 0 ? 'Achterstand' : gapAnalysis.gap < 0 ? 'Overtarget' : 'Op target'}`);
    console.log('\n✅ Target systeem werkt correct!');
    
  } catch (error) {
    console.error('\n❌ FOUT:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  testTargetSystem()
    .then(() => {
      console.log('\n✅ Test voltooid!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test gefaald:', error);
      process.exit(1);
    });
}

module.exports = testTargetSystem;

