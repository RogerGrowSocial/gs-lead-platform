#!/usr/bin/env node

/**
 * Test script for KVK API Service
 * 
 * Usage:
 *   node scripts/test-kvk-api.js [kvkNumber]
 * 
 * Example:
 *   node scripts/test-kvk-api.js 12345678
 */

'use strict'

require('dotenv').config()
const KvkApiService = require('../services/kvkApiService')

async function testKvkService() {
  console.log('🧪 Testing KVK API Service\n')
  console.log('=' .repeat(50))

  // Test 1: Check if API is configured
  console.log('\n📋 Test 1: API Configuration Check')
  console.log('-'.repeat(50))
  const isAvailable = KvkApiService.isAvailable()
  if (isAvailable) {
    console.log('✅ KVK API is configured')
    console.log(`   Base URL: ${KvkApiService.getApiBaseUrl()}`)
  } else {
    console.log('❌ KVK API key not found')
    console.log('   Set KVK_API_KEY in .env file')
    process.exit(1)
  }

  // Test 2: Validate KVK number format
  console.log('\n📋 Test 2: KVK Number Format Validation')
  console.log('-'.repeat(50))
  const testNumbers = [
    '12345678',      // Valid
    '1234 5678',     // Valid (with space)
    '1234-5678',     // Valid (with dash)
    '123',           // Invalid (too short)
    '123456789',     // Invalid (too long)
    'abc12345'       // Invalid (contains letters)
  ]

  testNumbers.forEach(num => {
    const normalized = KvkApiService.normalizeKvkNumber(num)
    const isValid = KvkApiService.validateKvkNumberFormat(num)
    console.log(`   "${num}" → "${normalized}" → ${isValid ? '✅ Valid' : '❌ Invalid'}`)
  })

  // Test 3: Get KVK number from command line or use default
  const kvkNumber = process.argv[2] || '12345678'
  console.log(`\n📋 Test 3: Verify KVK Number (${kvkNumber})`)
  console.log('-'.repeat(50))

  try {
    const verification = await KvkApiService.verifyKvkNumber(kvkNumber)
    console.log('Verification Result:')
    console.log(`   Valid: ${verification.valid ? '✅' : '❌'}`)
    console.log(`   Exists: ${verification.exists ? '✅' : '❌'}`)
    if (verification.error) {
      console.log(`   Error: ${verification.error}`)
    }
    if (verification.profile) {
      console.log(`   Company: ${verification.profile.companyName}`)
      console.log(`   Status: ${verification.profile.status}`)
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`)
  }

  // Test 4: Get Company Profile
  if (KvkApiService.validateKvkNumberFormat(kvkNumber)) {
    console.log(`\n📋 Test 4: Get Company Profile (${kvkNumber})`)
    console.log('-'.repeat(50))
    
    try {
      const profile = await KvkApiService.getCompanyProfile(kvkNumber)
      if (profile) {
        console.log('✅ Company Profile Retrieved:')
        console.log(`   KVK Number: ${profile.kvkNumber}`)
        console.log(`   Company Name: ${profile.companyName}`)
        console.log(`   Address: ${profile.address.street} ${profile.address.houseNumber}`)
        console.log(`   Postal Code: ${profile.address.postalCode}`)
        console.log(`   City: ${profile.address.city}`)
        console.log(`   Status: ${profile.status}`)
        console.log(`   Founding Date: ${profile.foundingDate || 'N/A'}`)
        console.log(`   Legal Form: ${profile.legalForm || 'N/A'}`)
      } else {
        console.log('❌ Company not found')
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`)
    }
  }

  // Test 5: Get Company Age
  if (KvkApiService.validateKvkNumberFormat(kvkNumber)) {
    console.log(`\n📋 Test 5: Get Company Age (${kvkNumber})`)
    console.log('-'.repeat(50))
    
    try {
      const ageInfo = await KvkApiService.getCompanyAge(kvkNumber)
      if (ageInfo) {
        console.log('✅ Company Age Retrieved:')
        console.log(`   Founded: ${ageInfo.founded}`)
        console.log(`   Age: ${ageInfo.age}`)
        console.log(`   Age in Years: ${ageInfo.ageInYears}`)
      } else {
        console.log('❌ Could not determine company age')
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`)
    }
  }

  // Test 6: Compare with User Data
  if (KvkApiService.validateKvkNumberFormat(kvkNumber)) {
    console.log(`\n📋 Test 6: Compare User Data with KVK Data`)
    console.log('-'.repeat(50))
    
    try {
      const profile = await KvkApiService.getCompanyProfile(kvkNumber)
      if (profile) {
        const userData = {
          company_name: 'Test Company B.V.',
          postal_code: '1234AB',
          city: 'Amsterdam'
        }
        
        const comparison = KvkApiService.compareWithKvkData(userData, profile)
        console.log('Comparison Result:')
        console.log(`   Matches:`, comparison.matches)
        console.log(`   Mismatches:`, comparison.mismatches)
        console.log(`   Score: ${comparison.score}`)
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`)
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('✅ Testing complete!')
  console.log('\n💡 Tip: Use a real KVK number to test with actual data')
  console.log('   Example: node scripts/test-kvk-api.js 12345678')
}

// Run tests
testKvkService().catch(error => {
  console.error('\n❌ Test failed:', error)
  process.exit(1)
})

