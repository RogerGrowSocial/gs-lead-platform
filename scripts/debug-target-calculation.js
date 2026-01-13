#!/usr/bin/env node

/**
 * Debug Script: Target Calculation
 * 
 * Debug waarom target op 5 blijft staan na wijziging van subscriptions.leads_per_month
 */

const LeadDemandPlannerService = require('../services/leadDemandPlannerService');
const LeadSegmentService = require('../services/leadSegmentService');
const { supabaseAdmin } = require('../config/supabase');

async function debugTargetCalculation() {
  console.log('🔍 DEBUG: Target Calculation\n');
  console.log('='.repeat(60));
  
  // Check specific user if provided
  const targetUserId = process.argv[2] || '465341c4-aea3-41e1-aba9-9c3b5d621602';
  
  try {
    // 0. Check migration status
    console.log('\n🔍 STAP 0: Check migration status...');
    try {
      const { data: funcData, error: funcError } = await supabaseAdmin.rpc('exec_sql', {
        sql: `SELECT pg_get_functiondef(oid) as definition 
              FROM pg_proc 
              WHERE proname = 'get_segment_capacity' 
              LIMIT 1;`
      });
      
      if (funcData && funcData.length > 0) {
        const definition = funcData[0].definition || '';
        if (definition.includes('subscriptions')) {
          console.log('   ✅ Migration is gedraaid (functie gebruikt subscriptions)');
        } else {
          console.log('   ⚠️  Migration NIET gedraaid (functie gebruikt nog max_open_leads)');
          console.log('   📋 Run de migration: supabase/migrations/20250116000000_fix_segment_capacity_from_subscriptions.sql');
        }
      }
    } catch (err) {
      console.log('   ⚠️  Kon functie definitie niet checken:', err.message);
    }
    
    // 0b. Check specific user subscription
    console.log(`\n🔍 STAP 0b: Check subscription voor user ${targetUserId}...`);
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('status', 'active')
      .eq('is_paused', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (subscription) {
      console.log(`   ✅ Subscription gevonden:`);
      console.log(`      leads_per_month: ${subscription.leads_per_month}`);
      console.log(`      status: ${subscription.status}`);
      console.log(`      is_paused: ${subscription.is_paused}`);
    } else {
      console.log(`   ⚠️  Geen actieve subscription gevonden voor user ${targetUserId}`);
    }
    
    // 0c. Check user profile
    console.log(`\n🔍 STAP 0c: Check profile voor user ${targetUserId}...`);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();
    
    if (profile) {
      console.log(`   ✅ Profile gevonden:`);
      console.log(`      company_name: ${profile.company_name || 'N/A'}`);
      console.log(`      primary_branch: ${profile.primary_branch || 'N/A'}`);
      console.log(`      lead_industries: ${JSON.stringify(profile.lead_industries || [])}`);
      console.log(`      regions: ${JSON.stringify(profile.regions || [])}`);
      console.log(`      lead_locations: ${JSON.stringify(profile.lead_locations || [])}`);
      console.log(`      is_active_for_routing: ${profile.is_active_for_routing}`);
      console.log(`      max_open_leads: ${profile.max_open_leads || 0}`);
    } else {
      console.log(`   ⚠️  Geen profile gevonden voor user ${targetUserId}`);
    }
    
    // 1. Haal alle actieve segmenten op
    console.log('\n📋 STAP 1: Zoek actieve segmenten...');
    const segments = await LeadSegmentService.getAllActiveSegments();
    console.log(`✅ ${segments.length} actieve segmenten gevonden`);
    
    if (segments.length === 0) {
      console.log('❌ Geen actieve segmenten gevonden!');
      process.exit(1);
    }
    
    // Filter segments where this user should be active
    const userSegments = segments.filter(segment => {
      if (!profile) return false;
      const branchMatch = profile.primary_branch === segment.branch || 
                         (profile.lead_industries && profile.lead_industries.includes(segment.branch));
      const regionMatch = (profile.regions && profile.regions.includes(segment.region)) ||
                         (profile.lead_locations && profile.lead_locations.includes(segment.region));
      return branchMatch && regionMatch;
    });
    
    if (userSegments.length > 0) {
      console.log(`\n🎯 User zit in ${userSegments.length} segment(en):`);
      userSegments.forEach(s => console.log(`   - ${s.branch} - ${s.region} (${s.id})`));
    } else {
      console.log(`\n⚠️  User zit NIET in actieve segmenten!`);
      console.log(`   Check of branch/region matcht met segmenten`);
    }
    
    // 2. Voor elk segment: check capaciteit en target
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Focus op user segments first
    const segmentsToCheck = userSegments.length > 0 ? userSegments : segments;
    
    for (const segment of segmentsToCheck) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 SEGMENT: ${segment.branch} - ${segment.region} (${segment.id})`);
      console.log('='.repeat(60));
      
      // Check capaciteit
      console.log('\n🔍 Capaciteit check...');
      const capacity = await LeadSegmentService.getSegmentCapacity(segment.id);
      console.log(`   Partners: ${capacity.capacity_partners}`);
      console.log(`   Totale capaciteit: ${capacity.capacity_total_leads}`);
      console.log(`   Huidige open leads: ${capacity.current_open_leads}`);
      
      // Check subscriptions voor partners in dit segment
      console.log('\n🔍 Subscriptions check...');
      const { data: partners, error: partnersError } = await supabaseAdmin
        .from('profiles')
        .select('id, company_name, max_open_leads, is_active_for_routing')
        .eq('is_active_for_routing', true)
        .eq('is_admin', false)
        .or(`primary_branch.eq.${segment.branch},lead_industries.cs.{${segment.branch}}`);
      
      if (partners && partners.length > 0) {
        console.log(`   ${partners.length} actieve partners gevonden`);
        
        for (const partner of partners.slice(0, 5)) { // Eerste 5 partners
          const { data: subscription, error: subError } = await supabaseAdmin
            .from('subscriptions')
            .select('leads_per_month, status, is_paused')
            .eq('user_id', partner.id)
            .eq('status', 'active')
            .eq('is_paused', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          console.log(`\n   Partner: ${partner.company_name || partner.id}`);
          console.log(`     max_open_leads: ${partner.max_open_leads || 0}`);
          console.log(`     subscription.leads_per_month: ${subscription?.leads_per_month || 'GEEN'}`);
          console.log(`     subscription.status: ${subscription?.status || 'GEEN'}`);
        }
      } else {
        console.log('   ⚠️  Geen partners gevonden voor dit segment');
      }
      
      // Bereken target
      console.log('\n🎯 Target berekening...');
      const target = await LeadDemandPlannerService.calculateTargetLeads(segment.id, today);
      const expectedTarget = Math.max(5, Math.floor(capacity.capacity_total_leads * 0.8));
      
      console.log(`   Berekende target: ${target} leads/dag`);
      console.log(`   Verwachte target: ${expectedTarget} leads/dag (80% van ${capacity.capacity_total_leads})`);
      
      if (target === 5 && capacity.capacity_total_leads > 0) {
        console.log(`   ⚠️  PROBLEEM: Target is 5 maar capaciteit is ${capacity.capacity_total_leads}`);
        console.log(`   Dit betekent dat: floor(${capacity.capacity_total_leads} * 0.8) = ${Math.floor(capacity.capacity_total_leads * 0.8)} < 5`);
      }
      
      // Check opgeslagen plan
      console.log('\n💾 Opgeslagen plan check...');
      const { data: plan, error: planError } = await supabaseAdmin
        .from('lead_segment_plans')
        .select('*')
        .eq('segment_id', segment.id)
        .eq('date', today.toISOString().split('T')[0])
        .single();
      
      if (plan) {
        console.log(`   Plan gevonden: target = ${plan.target_leads_per_day}`);
        console.log(`   Gap: ${plan.lead_gap}`);
        console.log(`   Updated at: ${plan.updated_at}`);
      } else {
        console.log('   Geen plan gevonden voor vandaag');
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ DEBUG COMPLETE');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ FOUT:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run debug
if (require.main === module) {
  debugTargetCalculation()
    .then(() => {
      console.log('\n✅ Debug voltooid!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Debug gefaald:', error);
      process.exit(1);
    });
}

module.exports = debugTargetCalculation;

