#!/usr/bin/env node

/**
 * Test script for Google Places API
 * 
 * Usage:
 *   node scripts/test-google-places.js "Company Name" "City"
 *   node scripts/test-google-places.js "GrowSocial" "Amsterdam"
 */

require('dotenv').config()
const GooglePlacesService = require('../services/googlePlacesService')

async function testGooglePlaces() {
  const companyName = process.argv[2] || 'GrowSocial'
  const city = process.argv[3] || 'Amsterdam'
  const address = process.argv[4] || ''
  const postalCode = process.argv[5] || ''

  console.log('\n=== Google Places API Test ===\n')
  console.log(`Company: ${companyName}`)
  console.log(`City: ${city}`)
  if (address) console.log(`Address: ${address}`)
  if (postalCode) console.log(`Postal Code: ${postalCode}`)
  console.log('')

  // Check if API is available
  if (!GooglePlacesService.isAvailable()) {
    console.error('❌ Google Places API is not configured!')
    console.error('   Add GOOGLE_PLACES_API_KEY to your .env file')
    process.exit(1)
  }

  console.log('✅ Google Places API is configured\n')

  try {
    // Test 1: Search for place
    console.log('1. Searching for place...')
    const searchResults = await GooglePlacesService.searchPlace(companyName, address, city, postalCode)
    
    if (!searchResults || searchResults.length === 0) {
      console.log('   ❌ No results found')
      process.exit(1)
    }

    console.log(`   ✅ Found ${searchResults.length} result(s)\n`)
    
    // Show first 3 results
    searchResults.slice(0, 3).forEach((result, index) => {
      console.log(`   Result ${index + 1}:`)
      console.log(`   - Name: ${result.name}`)
      console.log(`   - Address: ${result.formatted_address || 'N/A'}`)
      console.log(`   - Rating: ${result.rating || 'N/A'}`)
      console.log(`   - Reviews: ${result.user_ratings_total || 0}`)
      console.log(`   - Place ID: ${result.place_id}`)
      console.log('')
    })

    // Test 2: Get place details (using first result)
    if (searchResults[0] && searchResults[0].place_id) {
      console.log('2. Getting place details...')
      const placeDetails = await GooglePlacesService.getPlaceDetails(searchResults[0].place_id)
      
      if (!placeDetails) {
        console.log('   ❌ Could not get place details')
        process.exit(1)
      }

      console.log('   ✅ Place details retrieved\n')
      console.log('   Details:')
      console.log(`   - Name: ${placeDetails.name}`)
      console.log(`   - Address: ${placeDetails.formatted_address || 'N/A'}`)
      console.log(`   - Rating: ${placeDetails.rating || 'N/A'} ⭐`)
      console.log(`   - Reviews: ${placeDetails.user_ratings_total || 0}`)
      console.log(`   - Website: ${placeDetails.website || 'N/A'}`)
      console.log(`   - Phone: ${placeDetails.international_phone_number || 'N/A'}`)
      
      if (placeDetails.reviews && placeDetails.reviews.length > 0) {
        console.log(`   - Sample Reviews: ${placeDetails.reviews.length} available`)
        placeDetails.reviews.slice(0, 2).forEach((review, index) => {
          console.log(`     Review ${index + 1}: ${review.rating}⭐ - ${review.text.substring(0, 100)}...`)
        })
      }
      console.log('')

      // Test 3: Format for prompt
      console.log('3. Formatting for risk assessment prompt...')
      const formatted = GooglePlacesService.formatReviewsForPrompt(placeDetails)
      if (formatted) {
        console.log('   ✅ Formatted successfully\n')
        console.log('   Formatted output:')
        console.log('   ' + formatted.split('\n').join('\n   '))
      } else {
        console.log('   ❌ Could not format')
      }
    }

    // Test 4: Full flow (findBusinessWithReviews)
    console.log('\n4. Testing full flow (findBusinessWithReviews)...')
    const businessData = await GooglePlacesService.findBusinessWithReviews(
      companyName,
      address,
      city,
      postalCode
    )

    if (businessData) {
      console.log('   ✅ Business found with reviews\n')
      const formatted = GooglePlacesService.formatPlaceData(businessData)
      console.log('   Formatted data:')
      console.log(`   - Name: ${formatted.name}`)
      console.log(`   - Rating: ${formatted.rating} ⭐`)
      console.log(`   - Review Count: ${formatted.reviewCount}`)
      console.log(`   - Reviews: ${formatted.reviews.length} available`)
      console.log(`   - Website: ${formatted.website || 'N/A'}`)
    } else {
      console.log('   ❌ Business not found')
    }

    console.log('\n=== Test Complete ===\n')

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

testGooglePlaces()

