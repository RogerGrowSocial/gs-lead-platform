'use strict'

/**
 * Google Places API Service
 * 
 * Handles interactions with Google Places API for accurate business information,
 * including Google Reviews and ratings.
 * 
 * Documentation: https://developers.google.com/maps/documentation/places/web-service
 */
class GooglePlacesService {
  /**
   * Get API key from environment
   * @returns {string|null}
   */
  static getApiKey() {
    return process.env.GOOGLE_PLACES_API_KEY || null
  }

  /**
   * Check if Google Places API is configured
   * @returns {boolean}
   */
  static isAvailable() {
    return !!this.getApiKey()
  }

  /**
   * Get fetch function (native fetch or node-fetch)
   * @returns {Function}
   */
  static getFetchFunction() {
    if (typeof fetch !== 'undefined') {
      return fetch
    }
    try {
      return require('node-fetch')
    } catch (e) {
      throw new Error('fetch is not available. Install node-fetch or use Node.js 18+')
    }
  }

  /**
   * Search for a place using Text Search
   * Searches for businesses by name and location
   * 
   * @param {string} companyName - Company name
   * @param {string} address - Full address or city (optional)
   * @param {string} city - City name (optional)
   * @param {string} postalCode - Postal code (optional)
   * @returns {Promise<Array>} Array of matching places
   */
  static async searchPlace(companyName, address = '', city = '', postalCode = '') {
    if (!this.isAvailable()) {
      return null
    }

    if (!companyName || companyName.trim().length === 0) {
      return null
    }

    try {
      const apiKey = this.getApiKey()
      const fetchFunction = this.getFetchFunction()

      // Build search query: company name + location
      let query = companyName.trim()
      if (address) {
        query += ' ' + address.trim()
      }
      if (city) {
        query += ' ' + city.trim()
      }
      if (postalCode) {
        query += ' ' + postalCode.trim()
      }

      // Google Places API Text Search endpoint
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}&language=nl&region=nl`

      console.log(`[Google Places] Searching for: ${query}`)
      
      const response = await fetchFunction(url)
      
      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        console.log(`[Google Places] Found ${data.results.length} results`)
        return data.results
      } else if (data.status === 'ZERO_RESULTS') {
        console.log(`[Google Places] No results found for: ${query}`)
        return []
      } else {
        console.warn(`[Google Places] API error: ${data.status} - ${data.error_message || 'Unknown error'}`)
        return null
      }
    } catch (error) {
      console.error('[Google Places] Search error:', error.message)
      return null
    }
  }

  /**
   * Get place details including reviews
   * 
   * @param {string} placeId - Google Place ID
   * @returns {Promise<Object|null>} Place details with reviews
   */
  static async getPlaceDetails(placeId) {
    if (!this.isAvailable() || !placeId) {
      return null
    }

    try {
      const apiKey = this.getApiKey()
      const fetchFunction = this.getFetchFunction()

      // Request specific fields to reduce costs and get only what we need
      const fields = [
        'name',
        'formatted_address',
        'rating',
        'user_ratings_total',
        'reviews',
        'place_id',
        'website',
        'international_phone_number',
        'opening_hours'
      ].join(',')

      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}&language=nl`

      console.log(`[Google Places] Fetching details for place: ${placeId}`)
      
      const response = await fetchFunction(url)
      
      if (!response.ok) {
        throw new Error(`Google Places API error: ${response.status}`)
      }

      const data = await response.json()

      if (data.status === 'OK' && data.result) {
        console.log(`[Google Places] Found place: ${data.result.name}`)
        return data.result
      } else {
        console.warn(`[Google Places] Details error: ${data.status} - ${data.error_message || 'Unknown error'}`)
        return null
      }
    } catch (error) {
      console.error('[Google Places] Details error:', error.message)
      return null
    }
  }

  /**
   * Find business and get reviews
   * Combines search + details to get accurate reviews
   * 
   * @param {string} companyName - Company name
   * @param {string} address - Full address (optional)
   * @param {string} city - City name (optional)
   * @param {string} postalCode - Postal code (optional)
   * @param {string} kvkAddress - Address from KVK (optional, for better matching)
   * @returns {Promise<Object|null>} Business info with reviews
   */
  static async findBusinessWithReviews(companyName, address = '', city = '', postalCode = '', kvkAddress = null) {
    if (!this.isAvailable()) {
      return null
    }

    try {
      // Step 1: Search for the place
      const searchResults = await this.searchPlace(companyName, address, city, postalCode)
      
      if (!searchResults || searchResults.length === 0) {
        // Try with KVK address if available
        if (kvkAddress && kvkAddress.city) {
          console.log(`[Google Places] Retrying with KVK address: ${kvkAddress.city}`)
          const retryResults = await this.searchPlace(companyName, '', kvkAddress.city, kvkAddress.postalCode || '')
          if (retryResults && retryResults.length > 0) {
            return await this.getBestMatchAndDetails(retryResults, companyName, kvkAddress)
          }
        }
        return null
      }

      // Step 2: Find best match and get details
      return await this.getBestMatchAndDetails(searchResults, companyName, kvkAddress)
    } catch (error) {
      console.error('[Google Places] Error finding business:', error.message)
      return null
    }
  }

  /**
   * Find best matching place from search results and get details
   * 
   * @param {Array} searchResults - Search results from Google Places
   * @param {string} companyName - Original company name for matching
   * @param {Object} kvkAddress - KVK address for matching (optional)
   * @returns {Promise<Object|null>} Best match with details
   */
  static async getBestMatchAndDetails(searchResults, companyName, kvkAddress = null) {
    if (!searchResults || searchResults.length === 0) {
      return null
    }

    // Normalize company name for matching
    const normalizedCompanyName = companyName.toLowerCase().trim().replace(/\s+/g, ' ')

    // Score each result
    let bestMatch = null
    let bestScore = 0

    for (const result of searchResults) {
      let score = 0

      // Name matching
      const resultName = (result.name || '').toLowerCase().trim()
      if (resultName === normalizedCompanyName) {
        score += 100 // Exact match
      } else if (resultName.includes(normalizedCompanyName) || normalizedCompanyName.includes(resultName)) {
        score += 50 // Partial match
      }

      // Address matching (if KVK address available)
      if (kvkAddress) {
        const resultAddress = (result.formatted_address || '').toLowerCase()
        if (kvkAddress.city && resultAddress.includes(kvkAddress.city.toLowerCase())) {
          score += 30
        }
        if (kvkAddress.postalCode && resultAddress.includes(kvkAddress.postalCode.toLowerCase())) {
          score += 20
        }
      }

      // Rating boost (higher rating = more likely to be the right business)
      if (result.rating) {
        score += result.rating * 2
      }

      // More reviews = more likely to be the right business
      if (result.user_ratings_total) {
        score += Math.min(result.user_ratings_total / 10, 10) // Max 10 points
      }

      if (score > bestScore) {
        bestScore = score
        bestMatch = result
      }
    }

    if (!bestMatch) {
      // Fallback: use first result
      bestMatch = searchResults[0]
    }

    // Step 3: Get full details including reviews
    if (bestMatch.place_id) {
      const details = await this.getPlaceDetails(bestMatch.place_id)
      return details
    }

    return null
  }

  /**
   * Format Google Places data for risk assessment
   * 
   * @param {Object} placeDetails - Place details from Google Places API
   * @returns {Object} Formatted data
   */
  static formatPlaceData(placeDetails) {
    if (!placeDetails) {
      return null
    }

    return {
      name: placeDetails.name || null,
      address: placeDetails.formatted_address || null,
      rating: placeDetails.rating || null,
      reviewCount: placeDetails.user_ratings_total || 0,
      reviews: placeDetails.reviews ? placeDetails.reviews.map(review => ({
        rating: review.rating,
        text: review.text,
        author: review.author_name,
        time: review.time
      })) : [],
      website: placeDetails.website || null,
      phone: placeDetails.international_phone_number || null,
      placeId: placeDetails.place_id || null
    }
  }

  /**
   * Get formatted Google Reviews info for risk assessment prompt
   * 
   * @param {Object} placeDetails - Place details from Google Places API
   * @returns {string|null} Formatted review information
   */
  static formatReviewsForPrompt(placeDetails) {
    if (!placeDetails) {
      return null
    }

    const formatted = this.formatPlaceData(placeDetails)
    
    if (!formatted || !formatted.rating) {
      return null
    }

    let info = `**Google Business Profiel gevonden:**\n`
    info += `- Bedrijfsnaam: ${formatted.name || 'N/A'}\n`
    info += `- Adres: ${formatted.address || 'N/A'}\n`
    
    if (formatted.rating && formatted.reviewCount) {
      // Use EXACT rating and count - no rounding!
      info += `- Google Reviews: ${formatted.reviewCount} reviews met een gemiddelde beoordeling van ${formatted.rating} sterren (EXACT - niet afronden!)\n`
    } else if (formatted.rating) {
      info += `- Google Reviews: Gemiddelde beoordeling van ${formatted.rating} sterren (EXACT - niet afronden!)\n`
    } else if (formatted.reviewCount) {
      info += `- Google Reviews: ${formatted.reviewCount} reviews\n`
    }

    if (formatted.website) {
      info += `- Website: ${formatted.website}\n`
    }

    if (formatted.phone) {
      info += `- Telefoon: ${formatted.phone}\n`
    }

    return info
  }
}

module.exports = GooglePlacesService

