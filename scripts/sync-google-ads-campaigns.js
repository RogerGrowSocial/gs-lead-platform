#!/usr/bin/env node

/**
 * Sync Google Ads Campaigns to Database
 * 
 * Sync alle actieve Google Ads campagnes naar de database
 * en koppel ze aan de juiste segmenten
 */

require('dotenv').config()
const GoogleAdsClient = require('../integrations/googleAdsClient')

async function syncCampaigns() {
  console.log('🔄 Starting Google Ads campaign sync...\n')

  // Test client initialization
  const customer = await GoogleAdsClient.initialize()
  if (!customer) {
    console.error('❌ Google Ads API not configured. Please check your .env file.')
    console.log('\n📝 Required environment variables:')
    console.log('   GOOGLE_ADS_DEVELOPER_TOKEN=...')
    console.log('   GOOGLE_ADS_CLIENT_ID=...')
    console.log('   GOOGLE_ADS_CLIENT_SECRET=...')
    console.log('   GOOGLE_ADS_REFRESH_TOKEN=...')
    console.log('   GOOGLE_ADS_CUSTOMER_ID=...\n')
    process.exit(1)
  }

  console.log('✅ Google Ads API client initialized\n')

  // Sync campaigns
  const result = await GoogleAdsClient.syncCampaignsToDatabase()

  if (result.success) {
    console.log(`\n✅ Sync completed successfully!`)
    console.log(`   Synced: ${result.synced} campaigns`)
    console.log(`   Total campaigns: ${result.totalCampaigns}`)
    console.log(`   Total segments: ${result.totalSegments}`)
  } else {
    console.error(`\n❌ Sync failed: ${result.error}`)
    process.exit(1)
  }
}

// Run sync
syncCampaigns()
  .then(() => {
    console.log('\n🎉 Campaign sync completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Sync failed:', error)
    process.exit(1)
  })

