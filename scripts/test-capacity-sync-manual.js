#!/usr/bin/env node
/**
 * Manual Test Script voor Capacity-Based Segment Sync
 * 
 * Dit script helpt je om handmatig te testen of de capacity-based sync werkt.
 * 
 * Gebruik:
 * 1. Voeg een nieuwe partner toe met branch + locatie (zie stappen hieronder)
 * 2. Run dit script om de sync te triggeren
 * 3. Verifieer dat nieuwe segmenten zijn aangemaakt
 */

const { supabaseAdmin } = require('../config/supabase');
const SegmentSyncService = require('../services/segmentSyncService');
const LeadSegmentService = require('../services/leadSegmentService');

async function main() {
  console.log('🧪 Manual Test: Capacity-Based Segment Sync\n');
  console.log('='.repeat(60));
  
  // Stap 1: Toon huidige situatie
  console.log('\n📊 STAP 1: Huidige situatie\n');
  
  const combosBefore = await SegmentSyncService.fetchBranchRegionCapacityCombos();
  const segmentsBefore = await SegmentSyncService.fetchAllSegments();
  
  console.log(`Huidige capacity combinaties: ${combosBefore.length}`);
  combosBefore.forEach(c => {
    console.log(`  - ${c.branch} + ${c.region}: ${c.capacity_partners} partners, ${c.capacity_total_leads} leads/maand`);
  });
  
  console.log(`\nHuidige segmenten: ${segmentsBefore.length} (${segmentsBefore.filter(s => s.is_active).length} actief)`);
  segmentsBefore.filter(s => s.is_active).forEach(s => {
    console.log(`  - ${s.code} (${s.branch} • ${s.region})`);
  });
  
  // Stap 2: Instructies voor handmatige test
  console.log('\n\n📝 STAP 2: Hoe voeg je een nieuwe combinatie toe?\n');
  console.log('OPTIE A: Via Supabase Dashboard (SQL Editor)');
  console.log(`
-- 1. Vind een bestaande partner (of maak er een)
SELECT id, email, company_name, is_active_for_routing 
FROM profiles 
WHERE is_admin = false 
LIMIT 5;

-- 2. Voeg industry preference toe (bijv. "loodgieter")
-- Eerst vind de industry_id:
SELECT id, name FROM industries WHERE name ILIKE '%loodgieter%';

-- 3. Voeg preference toe:
INSERT INTO user_industry_preferences (user_id, industry_id, is_enabled)
VALUES (
  'PARTNER_USER_ID_HIER',  -- Vervang met echte user_id
  (SELECT id FROM industries WHERE name ILIKE '%loodgieter%' LIMIT 1),
  true
)
ON CONFLICT (user_id, industry_id) DO UPDATE SET is_enabled = true;

-- 4. Voeg location preference toe (bijv. "zuid-holland")
INSERT INTO user_location_preferences (user_id, location_code, location_name, is_enabled)
VALUES (
  'PARTNER_USER_ID_HIER',  -- Vervang met echte user_id
  'zuid-holland',
  'Zuid-Holland',
  true
)
ON CONFLICT (user_id, location_code) DO UPDATE SET is_enabled = true;

-- 5. Zorg dat partner capacity heeft (max_open_leads of subscription)
UPDATE profiles 
SET max_open_leads = 50  -- Bijv. 50 leads per maand
WHERE id = 'PARTNER_USER_ID_HIER';

-- OF voeg subscription toe:
INSERT INTO subscriptions (user_id, status, leads_per_month, is_paused)
VALUES (
  'PARTNER_USER_ID_HIER',
  'active',
  50,
  false
)
ON CONFLICT DO NOTHING;

-- 6. Zorg dat partner actief is voor routing
UPDATE profiles 
SET is_active_for_routing = true
WHERE id = 'PARTNER_USER_ID_HIER';
  `);
  
  console.log('\nOPTIE B: Via API (als je een test partner hebt)\n');
  console.log(`
POST /users/current/industry-preferences
Body: {
  "preferences": [
    { "industry_id": INDUSTRY_ID, "is_enabled": true }
  ]
}

POST /users/current/location-preferences  
Body: {
  "preferences": [
    { "location_code": "zuid-holland", "location_name": "Zuid-Holland", "is_enabled": true }
  ]
}
  `);
  
  // Stap 3: Run sync
  console.log('\n\n🔄 STAP 3: Run capacity-based sync\n');
  console.log('Triggering sync...\n');
  
  try {
    const result = await SegmentSyncService.syncSegmentsFromCapacity();
    
    console.log('✅ Sync completed!\n');
    console.log('Results:');
    console.log(`  - Combinations with capacity: ${result.totalCombinations}`);
    console.log(`  - New segments created: ${result.segmentsCreated}`);
    console.log(`  - Segments activated: ${result.segmentsActivated}`);
    console.log(`  - Segments deactivated: ${result.segmentsDeactivated}`);
    console.log(`  - Segments already existed: ${result.segmentsExisting}`);
    
    // Stap 4: Verifieer resultaten
    console.log('\n\n📊 STAP 4: Verifieer resultaten\n');
    
    const combosAfter = await SegmentSyncService.fetchBranchRegionCapacityCombos();
    const segmentsAfter = await SegmentSyncService.fetchAllSegments();
    
    console.log(`Capacity combinaties na sync: ${combosAfter.length}`);
    if (combosAfter.length > combosBefore.length) {
      console.log('✅ Nieuwe combinaties gevonden!');
      combosAfter.forEach(c => {
        const existed = combosBefore.some(b => b.branch === c.branch && b.region === c.region);
        if (!existed) {
          console.log(`  🆕 NIEUW: ${c.branch} + ${c.region} (${c.capacity_partners} partners, ${c.capacity_total_leads} leads/maand)`);
        }
      });
    }
    
    console.log(`\nSegmenten na sync: ${segmentsAfter.length} (${segmentsAfter.filter(s => s.is_active).length} actief)`);
    if (segmentsAfter.length > segmentsBefore.length) {
      console.log('✅ Nieuwe segmenten aangemaakt!');
      segmentsAfter.forEach(s => {
        const existed = segmentsBefore.some(b => b.code === s.code);
        if (!existed) {
          console.log(`  🆕 NIEUW: ${s.code} (${s.branch} • ${s.region}) - ${s.is_active ? 'ACTIEF' : 'INACTIEF'}`);
        }
      });
    }
    
    // Stap 5: Check targets
    console.log('\n\n🎯 STAP 5: Check targets (optioneel)\n');
    console.log('Targets worden automatisch berekend wanneer er een plan wordt aangemaakt.');
    console.log('Dit gebeurt wanneer de orchestrator draait of wanneer een lead wordt toegewezen.\n');
    
    const activeSegments = segmentsAfter.filter(s => s.is_active);
    if (activeSegments.length > 0) {
      console.log('Voorbeeld: Check capacity voor een segment:');
      const sampleSegment = activeSegments[0];
      const capacity = await LeadSegmentService.getSegmentCapacity(sampleSegment.id);
      console.log(`\nSegment: ${sampleSegment.code}`);
      console.log(`  - Partners: ${capacity.capacity_partners}`);
      console.log(`  - Total leads/maand: ${capacity.capacity_total_leads}`);
      console.log(`  - Target (80%): ${Math.floor(capacity.capacity_total_leads * 0.8)} leads/maand`);
      console.log(`  - Target per dag: ${Math.floor(capacity.capacity_total_leads * 0.8 / 30)} leads/dag`);
    }
    
    console.log('\n\n✅ Test voltooid!\n');
    console.log('='.repeat(60));
    console.log('\n💡 Tips:');
    console.log('  - Run dit script opnieuw na het toevoegen van een nieuwe combinatie');
    console.log('  - Check de database om te zien of segmenten zijn aangemaakt');
    console.log('  - Targets worden automatisch berekend bij de volgende orchestrator run');
    console.log('  - Je kunt ook handmatig sync triggeren via: POST /admin/leadstroom/sync-segments\n');
    
  } catch (error) {
    console.error('\n❌ Error tijdens sync:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = main;

