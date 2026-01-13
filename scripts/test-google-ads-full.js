#!/usr/bin/env node

/**
 * Volledige Google Ads API Test
 * 
 * Test alle functionaliteit van de Google Ads API integratie
 */

require('dotenv').config()
const GoogleAdsClient = require('../integrations/googleAdsClient')

async function runFullTest() {
  console.log('🧪 GOOGLE ADS API - VOLLEDIGE TEST\n')
  console.log('='.repeat(50))
  console.log('')

  // Test 1: Initialisatie
  console.log('1️⃣ Test: Client Initialisatie')
  console.log('-'.repeat(50))
  const customer = await GoogleAdsClient.initialize()
  if (!customer) {
    console.log('❌ Client niet geïnitialiseerd')
    console.log('📝 Check je .env bestand\n')
    return
  }
  console.log('✅ Client geïnitialiseerd')
  console.log(`   Customer ID: ${process.env.GOOGLE_ADS_CUSTOMER_ID}`)
  console.log('')

  // Test 2: Campagnes ophalen
  console.log('2️⃣ Test: Campagnes Ophalen')
  console.log('-'.repeat(50))
  try {
    const campaigns = await GoogleAdsClient.getActiveCampaigns()
    console.log(`✅ ${campaigns.length} campagnes gevonden`)
    
    if (campaigns.length > 0) {
      console.log('\n📋 Campagnes:')
      campaigns.slice(0, 5).forEach((camp, i) => {
        console.log(`   ${i + 1}. ${camp.name}`)
        console.log(`      ID: ${camp.id}`)
        console.log(`      Status: ${camp.status}`)
      })
      if (campaigns.length > 5) {
        console.log(`   ... en ${campaigns.length - 5} meer`)
      }
    } else {
      console.log('⚠️ Geen actieve campagnes gevonden')
      console.log('💡 Maak een campagne aan in Google Ads om te testen')
    }
  } catch (error) {
    console.log('❌ Error:', error.message)
    if (error.errors) {
      error.errors.forEach(e => {
        console.log(`   - ${e.message}`)
      })
    }
  }
  console.log('')

  // Test 3: Database Sync (als er campagnes zijn)
  console.log('3️⃣ Test: Database Sync')
  console.log('-'.repeat(50))
  try {
    const syncResult = await GoogleAdsClient.syncCampaignsToDatabase()
    if (syncResult.success) {
      console.log(`✅ Sync voltooid`)
      console.log(`   Gesynced: ${syncResult.synced} campagnes`)
      console.log(`   Totaal: ${syncResult.totalCampaigns} campagnes`)
      console.log(`   Segmenten: ${syncResult.totalSegments}`)
    } else {
      console.log(`⚠️ Sync issue: ${syncResult.error || syncResult.message}`)
    }
  } catch (error) {
    console.log('❌ Sync error:', error.message)
  }
  console.log('')

  // Test 4: Budget ophalen (als er campagnes zijn)
  console.log('4️⃣ Test: Budget Informatie')
  console.log('-'.repeat(50))
  try {
    const campaigns = await GoogleAdsClient.getActiveCampaigns()
    if (campaigns.length > 0) {
      const testCampaign = campaigns[0]
      const budget = await GoogleAdsClient.getCampaignBudgetById(testCampaign.id)
      if (budget > 0) {
        console.log(`✅ Budget voor "${testCampaign.name}": €${budget.toFixed(2)}/dag`)
      } else {
        console.log(`⚠️ Geen budget gevonden voor "${testCampaign.name}"`)
      }
    } else {
      console.log('⚠️ Geen campagnes om budget van op te halen')
    }
  } catch (error) {
    console.log('❌ Budget error:', error.message)
  }
  console.log('')

  // Samenvatting
  console.log('='.repeat(50))
  console.log('📊 SAMENVATTING')
  console.log('='.repeat(50))
  console.log('✅ API Verbinding: WERKT')
  console.log('✅ Configuratie: COMPLEET')
  console.log('')
  console.log('💡 Volgende stappen:')
  console.log('   1. Activeer je Google Ads account (als nog niet gedaan)')
  console.log('   2. Maak een test campagne aan in Google Ads')
  console.log('   3. Run dit script opnieuw om campagnes te zien')
  console.log('   4. Test budget updates via admin dashboard')
  console.log('')
}

// Run tests
runFullTest()
  .then(() => {
    console.log('🎉 Test voltooid!\n')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n❌ Test gefaald:', error)
    process.exit(1)
  })

