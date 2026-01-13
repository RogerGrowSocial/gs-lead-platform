#!/usr/bin/env node

/**
 * Test KVK API connection
 * 
 * Usage:
 *   node scripts/test-kvk-connection.js [kvkNumber]
 */

'use strict'

require('dotenv').config()
const KvkApiService = require('../services/kvkApiService')

async function testConnection() {
  console.log('🧪 Testing KVK API Connection\n')
  console.log('='.repeat(50))

  // Check configuration
  console.log('\n📋 Configuration Check:')
  console.log('-'.repeat(50))
  const isAvailable = KvkApiService.isAvailable()
  console.log(`KVK API Available: ${isAvailable ? '✅' : '❌'}`)
  
  if (!isAvailable) {
    console.log('\n❌ KVK_API_KEY is not set in environment variables')
    console.log('   Make sure .env file contains: KVK_API_KEY=your-key')
    process.exit(1)
  }

  const apiKey = KvkApiService.getApiKey()
  console.log(`API Key: ${apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}` : 'NOT SET'}`)
  console.log(`Base URL: ${KvkApiService.getApiBaseUrl()}`)
  console.log(`Test Mode: ${process.env.KVK_API_TEST_MODE === 'true' ? 'Yes' : 'No'}`)

  // Test with a KVK number
  const kvkNumber = process.argv[2] || '12345678'
  console.log(`\n📋 Testing with KVK Number: ${kvkNumber}`)
  console.log('-'.repeat(50))

  try {
    console.log('\n1. Testing verifyKvkNumber...')
    const verification = await KvkApiService.verifyKvkNumber(kvkNumber)
    console.log('Result:', JSON.stringify(verification, null, 2))

    if (verification.profile) {
      console.log('\n2. Testing getCompanyProfile...')
      const profile = await KvkApiService.getCompanyProfile(kvkNumber)
      console.log('Result:', JSON.stringify(profile, null, 2))
    }

    console.log('\n✅ Connection test successful!')
  } catch (error) {
    console.error('\n❌ Connection test failed:')
    console.error('Error:', error.message)
    console.error('\nTroubleshooting:')
    console.error('1. Check if KVK_API_KEY is correct')
    console.error('2. Check if the API endpoint URL is correct')
    console.error('3. Check network connectivity')
    console.error('4. Check KVK API status: https://developers.kvk.nl/')
    console.error('\nFull error:', error)
    process.exit(1)
  }
}

testConnection()

