#!/usr/bin/env node
/**
 * Test Script: Google Ads Campaign Creation
 * 
 * Test het volledige proces van AI recommendation tot campaign creation
 */

require('dotenv').config();
const PartnerMarketingOrchestratorService = require('../services/partnerMarketingOrchestratorService');
const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

async function testCampaignCreation() {
  try {
    console.log('🧪 Testing Google Ads Campaign Creation...\n');

    // Step 1: Check for segments with gaps but no campaign
    console.log('1️⃣ Checking for segments with gaps but no campaign...');
    const { data: segments, error: segmentsError } = await supabaseAdmin
      .from('lead_segments')
      .select('id, code, branch, region, google_ads_campaign_id')
      .eq('is_active', true)
      .is('google_ads_campaign_id', null)
      .limit(5);

    if (segmentsError) {
      throw new Error(`Error fetching segments: ${segmentsError.message}`);
    }

    if (!segments || segments.length === 0) {
      console.log('⚠️  No segments found without campaigns. Creating test scenario...');
      // You might want to create a test segment here
      return;
    }

    console.log(`✅ Found ${segments.length} segments without campaigns\n`);

    // Step 2: Generate recommendations
    console.log('2️⃣ Generating AI recommendations...');
    const today = new Date();
    const actions = await PartnerMarketingOrchestratorService.generatePlatformMarketingActions(today);
    
    const campaignActions = actions.filter(a => a.action_type === 'create_campaign');
    console.log(`✅ Generated ${campaignActions.length} create_campaign recommendations\n`);

    if (campaignActions.length === 0) {
      console.log('⚠️  No create_campaign recommendations generated.');
      console.log('   This might be because:');
      console.log('   - No segments have gaps > 3');
      console.log('   - All segments already have campaigns');
      console.log('   - No active sites/segments found\n');
      return;
    }

    // Step 3: Show recommendations
    console.log('3️⃣ Recommendations to test:');
    campaignActions.forEach((action, index) => {
      const details = action.action_details || {};
      console.log(`\n   ${index + 1}. ${details.campaign_name || 'Unknown'}`);
      console.log(`      Segment: ${action.segment_id}`);
      console.log(`      Budget: €${details.daily_budget || 'N/A'}/day`);
      console.log(`      Locations: ${(details.target_locations || []).join(', ')}`);
      console.log(`      Priority: ${action.priority}`);
    });

    console.log('\n4️⃣ Next steps:');
    console.log('   - Go to: http://localhost:3000/admin/leads/engine/ai-actions');
    console.log('   - Find a create_campaign recommendation');
    console.log('   - Click to open modal');
    console.log('   - Click "Goedkeuren" to create the campaign');
    console.log('\n   OR use API:');
    console.log('   - Get recommendation ID from database');
    console.log('   - POST /api/marketing-recommendations/:recId/approve');

    // Step 4: Check existing recommendations in database
    console.log('\n5️⃣ Checking existing recommendations in database...');
    const { data: existingRecs, error: recsError } = await supabaseAdmin
      .from('ai_marketing_recommendations')
      .select('id, action_type, status, action_details, created_at')
      .eq('action_type', 'create_campaign')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recsError) {
      console.log(`⚠️  Error fetching recommendations: ${recsError.message}`);
    } else if (existingRecs && existingRecs.length > 0) {
      console.log(`✅ Found ${existingRecs.length} pending create_campaign recommendations:`);
      existingRecs.forEach((rec, index) => {
        const details = rec.action_details || {};
        console.log(`\n   ${index + 1}. ID: ${rec.id}`);
        console.log(`      Campaign: ${details.campaign_name || 'Unknown'}`);
        console.log(`      Budget: €${details.daily_budget || 'N/A'}/day`);
        console.log(`      Created: ${new Date(rec.created_at).toLocaleString('nl-NL')}`);
        console.log(`      API: POST /api/marketing-recommendations/${rec.id}/approve`);
      });
    } else {
      console.log('⚠️  No pending recommendations found. They may have been saved already.');
    }

    console.log('\n✅ Test script completed!\n');

  } catch (error) {
    console.error('❌ Error in test:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testCampaignCreation()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = testCampaignCreation;

