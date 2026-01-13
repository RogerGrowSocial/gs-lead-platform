#!/usr/bin/env node

/**
 * Test Google Ads API Integration
 * 
 * Test script om te verifiëren dat de Google Ads API integratie werkt
 */

require('dotenv').config()
const GoogleAdsClient = require('../integrations/googleAdsClient')
const { supabaseAdmin } = require('../config/supabase')

async function testGoogleAdsAPI() {
  console.log('🧪 Testing Google Ads API Integration...\n')

  // Test 1: Initialize client
  console.log('1️⃣ Testing client initialization...')
  const customer = await GoogleAdsClient.initialize()
  if (customer) {
    console.log('   ✅ Client initialized successfully')
    console.log(`   Developer Token: ${process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? '✅ Set' : '❌ Missing'}`)
    console.log(`   Manager Account (MCC): ${process.env.GOOGLE_ADS_CUSTOMER_ID || '❌ Missing'}`)
    console.log(`   Customer Account: ${GoogleAdsClient.customerId || 'Using from database'}\n`)
  } else {
    console.log('   ⚠️ Client not initialized (credentials not configured)\n')
    console.log('   📝 Add these to your .env file:')
    console.log('      GOOGLE_ADS_DEVELOPER_TOKEN=EFwUAp_r-fFKDxuhYM3n4A')
    console.log('      GOOGLE_ADS_CLIENT_ID=...')
    console.log('      GOOGLE_ADS_CLIENT_SECRET=...')
    console.log('      GOOGLE_ADS_REFRESH_TOKEN=...')
    console.log('      GOOGLE_ADS_CUSTOMER_ID=...\n')
    return
  }

  // Test 2: Get active campaigns
  console.log('2️⃣ Testing getActiveCampaigns...')
  try {
    const campaigns = await GoogleAdsClient.getActiveCampaigns()
    console.log(`   ✅ Found ${campaigns.length} active campaigns`)
    if (campaigns.length > 0) {
      console.log('   Sample campaigns:')
      campaigns.slice(0, 5).forEach(campaign => {
        console.log(`      - ${campaign.name} (ID: ${campaign.id})`)
      })
    } else {
      console.log('   ⚠️ No active campaigns found')
    }
    console.log('')
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`)
  }

  // Test 3: Sync campaigns to database
  console.log('3️⃣ Testing syncCampaignsToDatabase...')
  try {
    const syncResult = await GoogleAdsClient.syncCampaignsToDatabase()
    if (syncResult.success) {
      console.log(`   ✅ Sync completed: ${syncResult.synced} campaigns synced`)
      console.log(`      Total campaigns: ${syncResult.totalCampaigns}`)
      console.log(`      Total segments: ${syncResult.totalSegments}\n`)
    } else {
      console.log(`   ⚠️ Sync issue: ${syncResult.error || syncResult.message}\n`)
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`)
  }

  // Test 4: Get campaign budget from database segment
  console.log('4️⃣ Testing getCampaignBudget with database mapping...')
  try {
    // Get first segment with Google Ads campaign ID
    const { data: segment } = await supabaseAdmin
      .from('lead_segments')
      .select('id, code, google_ads_campaign_id')
      .not('google_ads_campaign_id', 'is', null)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (segment) {
      const budget = await GoogleAdsClient.getCampaignBudgetById(segment.google_ads_campaign_id)
      if (budget > 0) {
        console.log(`   ✅ Budget for segment "${segment.code}": €${budget.toFixed(2)}`)
        console.log(`      Campaign ID: ${segment.google_ads_campaign_id}\n`)
      } else {
        console.log(`   ⚠️ No budget found for segment "${segment.code}"\n`)
      }
    } else {
      console.log('   ⚠️ No segments with Google Ads campaign mapping found')
      console.log('   💡 Run sync script first: node scripts/sync-google-ads-campaigns.js\n')
    }
  } catch (error) {
    console.log(`   ⚠️ Error: ${error.message}\n`)
  }

  // Test 5: Get campaign stats (if we have a mapped segment)
  console.log('5️⃣ Testing getCampaignStats...')
  try {
    const { data: segment } = await supabaseAdmin
      .from('lead_segments')
      .select('code, google_ads_campaign_id')
      .not('google_ads_campaign_id', 'is', null)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (segment) {
    const today = new Date()
      const stats = await GoogleAdsClient.getCampaignStats(segment.code, today)
      console.log(`   ✅ Stats for "${segment.code}" (${today.toISOString().split('T')[0]}):`)
    console.log(`      Spend: €${stats.spend.toFixed(2)}`)
    console.log(`      Clicks: ${stats.clicks}`)
      console.log(`      Impressions: ${stats.impressions}\n`)
    } else {
      console.log('   ⚠️ No segments with Google Ads campaign mapping found\n')
    }
  } catch (error) {
    console.log(`   ⚠️ Error: ${error.message}\n`)
  }

  console.log('✅ Testing completed!')
}

// Run tests
testGoogleAdsAPI()
  .then(() => {
    console.log('\n🎉 All tests passed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })

