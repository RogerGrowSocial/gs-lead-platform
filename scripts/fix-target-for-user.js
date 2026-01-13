#!/usr/bin/env node

/**
 * Fix Target for User
 * 
 * Check en fix waarom target niet wordt bijgewerkt na subscription wijziging
 */

const LeadDemandPlannerService = require('../services/leadDemandPlannerService');
const LeadSegmentService = require('../services/leadSegmentService');
const { supabaseAdmin } = require('../config/supabase');

const TARGET_USER_ID = '465341c4-aea3-41e1-aba9-9c3b5d621602';

async function fixTargetForUser() {
  console.log('🔧 FIX: Target voor User\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Check profile
    console.log('\n📋 STAP 1: Check profile...');
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', TARGET_USER_ID)
      .single();
    
    if (!profile) {
      console.log('❌ Profile niet gevonden!');
      process.exit(1);
    }
    
    console.log(`   Company: ${profile.company_name || 'N/A'}`);
    console.log(`   is_active_for_routing: ${profile.is_active_for_routing}`);
    console.log(`   primary_branch: ${profile.primary_branch || 'N/A (NULL!)'}`);
    console.log(`   lead_industries: ${JSON.stringify(profile.lead_industries || [])}`);
    console.log(`   regions: ${JSON.stringify(profile.regions || [])}`);
    console.log(`   lead_locations: ${JSON.stringify(profile.lead_locations || [])}`);
    
    // Check of user een branch heeft
    if (!profile.primary_branch && (!profile.lead_industries || profile.lead_industries.length === 0)) {
      console.log('\n   ⚠️  PROBLEEM: User heeft GEEN branch!');
      console.log('   User moet een primary_branch OF lead_industries hebben om in segmenten te zitten');
      
      // Vind beschikbare branches uit actieve segmenten
      const segments = await LeadSegmentService.getAllActiveSegments();
      const availableBranches = [...new Set(segments.map(s => s.branch))];
      console.log(`   Beschikbare branches: ${availableBranches.join(', ')}`);
      
      // Vraag gebruiker om branch te kiezen (of gebruik eerste beschikbare)
      console.log('\n   🔧 OPLOSSING: Zet een branch voor deze user');
      console.log('   Bijvoorbeeld: UPDATE profiles SET primary_branch = \'schilder\' WHERE id = \'...\';');
      console.log('   OF: UPDATE profiles SET lead_industries = ARRAY[\'schilder\'] WHERE id = \'...\';');
      
      // Optioneel: auto-fix met eerste beschikbare branch (uncomment om te gebruiken)
      // if (availableBranches.length > 0) {
      //   const firstBranch = availableBranches[0];
      //   console.log(`   🔧 Auto-fix: Zet primary_branch op '${firstBranch}'...`);
      //   const { error: updateError } = await supabaseAdmin
      //     .from('profiles')
      //     .update({ primary_branch: firstBranch })
      //     .eq('id', TARGET_USER_ID);
      //   if (updateError) {
      //     console.log(`   ❌ Fout: ${updateError.message}`);
      //   } else {
      //     console.log(`   ✅ primary_branch is nu '${firstBranch}'`);
      //   }
      // }
    }
    
    // 2. Check subscription
    console.log('\n📋 STAP 2: Check subscription...');
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', TARGET_USER_ID)
      .eq('status', 'active')
      .eq('is_paused', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!subscription) {
      console.log('❌ Geen actieve subscription gevonden!');
      process.exit(1);
    }
    
    console.log(`   leads_per_month: ${subscription.leads_per_month}`);
    
    // 3. Check of user actief is voor routing
    console.log('\n🔧 STAP 3: Check routing status...');
    if (!profile.is_active_for_routing) {
      console.log('   ⚠️  User is NIET actief voor routing!');
      console.log('   🔧 Zet is_active_for_routing = true...');
      
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ is_active_for_routing: true })
        .eq('id', TARGET_USER_ID);
      
      if (updateError) {
        console.log(`   ❌ Fout bij updaten: ${updateError.message}`);
      } else {
        console.log('   ✅ is_active_for_routing is nu true');
      }
    } else {
      console.log('   ✅ User is actief voor routing');
    }
    
    // 4. Vind segmenten waar user in zit
    console.log('\n📋 STAP 4: Vind segmenten...');
    const segments = await LeadSegmentService.getAllActiveSegments();
    
    const userSegments = segments.filter(segment => {
      const branchMatch = profile.primary_branch === segment.branch || 
                         (profile.lead_industries && profile.lead_industries.includes(segment.branch));
      const regionMatch = (profile.regions && profile.regions.includes(segment.region)) ||
                         (profile.lead_locations && profile.lead_locations.includes(segment.region));
      return branchMatch && regionMatch;
    });
    
    if (userSegments.length === 0) {
      console.log('   ⚠️  User zit in GEEN segmenten!');
      console.log('   Check of branch/region matcht met actieve segmenten');
      console.log(`   Actieve segmenten: ${segments.map(s => `${s.branch}-${s.region}`).join(', ')}`);
      process.exit(1);
    }
    
    console.log(`   ✅ User zit in ${userSegments.length} segment(en):`);
    userSegments.forEach(s => console.log(`      - ${s.branch} - ${s.region} (${s.id})`));
    
    // 5. Check capaciteit en target voor elk segment
    console.log('\n📊 STAP 5: Check capaciteit en target...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const segment of userSegments) {
      console.log(`\n   Segment: ${segment.branch} - ${segment.region}`);
      
      // Check capaciteit
      const capacity = await LeadSegmentService.getSegmentCapacity(segment.id);
      console.log(`      Capaciteit: ${capacity.capacity_total_leads} (${capacity.capacity_partners} partners)`);
      
      // Bereken target
      const target = await LeadDemandPlannerService.calculateTargetLeads(segment.id, today);
      const expectedTarget = Math.max(5, Math.floor(capacity.capacity_total_leads * 0.8));
      console.log(`      Target: ${target} (verwacht: ${expectedTarget})`);
      
      if (target === 5 && capacity.capacity_total_leads > 0) {
        console.log(`      ⚠️  PROBLEEM: Target is 5 maar capaciteit is ${capacity.capacity_total_leads}`);
        console.log(`      Dit betekent: floor(${capacity.capacity_total_leads} * 0.8) = ${Math.floor(capacity.capacity_total_leads * 0.8)} < 5`);
      }
      
      // Check opgeslagen plan
      const { data: plan } = await supabaseAdmin
        .from('lead_segment_plans')
        .select('*')
        .eq('segment_id', segment.id)
        .eq('date', today.toISOString().split('T')[0])
        .single();
      
      if (plan) {
        console.log(`      Opgeslagen plan: ${plan.target_leads_per_day}`);
        if (plan.target_leads_per_day !== target) {
          console.log(`      🔧 Plan bijwerken naar ${target}...`);
          
          // Update plan
          await LeadDemandPlannerService.planSegment(segment.id, today);
          console.log(`      ✅ Plan bijgewerkt!`);
        }
      } else {
        console.log(`      Geen plan gevonden, aanmaken...`);
        await LeadDemandPlannerService.planSegment(segment.id, today);
        console.log(`      ✅ Plan aangemaakt!`);
      }
    }
    
    // 6. Herbereken alle targets
    console.log('\n🔄 STAP 6: Herbereken alle targets...');
    const result = await LeadDemandPlannerService.planAllSegments(today);
    console.log(`   ✅ ${result.segmentsPlanned}/${result.totalSegments} segmenten gepland`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ FIX COMPLETE');
    console.log('='.repeat(60));
    console.log('\n💡 Ververs nu het dashboard om de nieuwe targets te zien!');
    
  } catch (error) {
    console.error('\n❌ FOUT:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run fix
if (require.main === module) {
  fixTargetForUser()
    .then(() => {
      console.log('\n✅ Fix voltooid!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fix gefaald:', error);
      process.exit(1);
    });
}

module.exports = fixTargetForUser;

