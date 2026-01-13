'use strict'

/**
 * KVK API Service
 * 
 * Handles interactions with the KVK (Kamer van Koophandel) API for business verification.
 * Provides methods to retrieve company information, verify KVK numbers, and get company details.
 */
class KvkApiService {
  // API Configuration
  static getApiBaseUrl() {
    const testMode = process.env.KVK_API_TEST_MODE === 'true'
    // KVK API base URLs
    // According to KVK API documentation: https://developers.kvk.nl/nl/documentation
    // Test: https://api.kvk.nl/test/api/v1/basisprofielen/{kvkNumber}
    // Production: https://api.kvk.nl/api/v1/basisprofielen/{kvkNumber}
    return testMode
      ? 'https://api.kvk.nl/test/api/v1' // Test environment
      : 'https://api.kvk.nl/api/v1' // Production environment
  }

  /**
   * Get API key from environment
   * @returns {string|null}
   */
  static getApiKey() {
    return process.env.KVK_API_KEY || null
  }

  /**
   * Check if KVK API is configured
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
   * Make HTTP request to KVK API
   * @param {string} endpoint - API endpoint path
   * @param {Object} options - Request options
   * @returns {Promise<Object>}
   */
  static async makeRequest(endpoint, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('KVK API key is not configured. Set KVK_API_KEY environment variable.')
    }

    const apiKey = this.getApiKey()
    const baseUrl = this.getApiBaseUrl()
    const url = `${baseUrl}${endpoint}`

    const fetchFunction = this.getFetchFunction()

    const defaultHeaders = {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    }

    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      },
      ...(options.body && { body: JSON.stringify(options.body) })
    }

    try {
      console.log(`[KVK API] Making request to: ${url}`)
      console.log(`[KVK API] Headers:`, { apikey: apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET' })
      
      const response = await fetchFunction(url, requestOptions)

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        const status = response.status

        console.error(`[KVK API] Request failed: ${status} - ${errorText}`)

        // Handle specific error cases
        if (status === 401) {
          throw new Error('KVK API: Invalid API key')
        } else if (status === 404) {
          throw new Error('KVK API: Resource not found')
        } else if (status === 429) {
          throw new Error('KVK API: Rate limit exceeded')
        } else if (status >= 500) {
          throw new Error(`KVK API: Server error (${status})`)
        } else {
          throw new Error(`KVK API: Request failed (${status}): ${errorText}`)
        }
      }

      const data = await response.json()
      return data
    } catch (error) {
      // Re-throw if it's already our custom error
      if (error.message && error.message.startsWith('KVK API:')) {
        throw error
      }

      // Handle network errors with more detail
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('[KVK API] Network error details:', {
          url: url,
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack
        })
        throw new Error(`KVK API: Network error - could not connect to KVK API. URL: ${url}. Error: ${error.message}`)
      }

      // Handle other fetch errors (ENOTFOUND, ECONNREFUSED, etc.)
      if (error.code) {
        console.error('[KVK API] Connection error:', {
          code: error.code,
          url: url,
          message: error.message
        })
        throw new Error(`KVK API: Connection error (${error.code}): ${error.message}. URL: ${url}`)
      }

      console.error('[KVK API] Request error:', error)
      throw new Error(`KVK API: ${error.message || 'Unknown error'}`)
    }
  }

  /**
   * Normalize KVK number (remove spaces, dashes, dots)
   * @param {string} kvkNumber - KVK number
   * @returns {string}
   */
  static normalizeKvkNumber(kvkNumber) {
    if (!kvkNumber) {
      return null
    }
    return kvkNumber.toString().replace(/\s+/g, '').replace(/\./g, '').replace(/-/g, '')
  }

  /**
   * Validate KVK number format (8 digits for Netherlands)
   * @param {string} kvkNumber - KVK number
   * @returns {boolean}
   */
  static validateKvkNumberFormat(kvkNumber) {
    const normalized = this.normalizeKvkNumber(kvkNumber)
    if (!normalized) {
      return false
    }
    // Netherlands KVK numbers are 8 digits
    return /^\d{8}$/.test(normalized)
  }

  /**
   * Get company profile by KVK number
   * Uses Basisprofiel API
   * 
   * @param {string} kvkNumber - KVK number (8 digits)
   * @returns {Promise<Object|null>} Company profile data or null if not found
   */
  static async getCompanyProfile(kvkNumber) {
    if (!kvkNumber) {
      throw new Error('KVK number is required')
    }

    const normalized = this.normalizeKvkNumber(kvkNumber)
    if (!this.validateKvkNumberFormat(normalized)) {
      throw new Error(`Invalid KVK number format: ${kvkNumber}. Expected 8 digits.`)
    }

    try {
      // KVK Basisprofiel API endpoint
      // According to KVK API documentation: https://developers.kvk.nl/nl/documentation
      // Endpoint: /basisprofielen/{kvkNumber} (meervoud, niet basisprofiel)
      const endpoint = `/basisprofielen/${normalized}`
      const data = await this.makeRequest(endpoint)

      // Parse and normalize the response
      return this.parseCompanyProfile(data)
    } catch (error) {
      // If company not found, return null instead of throwing
      if (error.message && error.message.includes('not found')) {
        console.log(`[KVK API] Company not found for KVK number: ${normalized}`)
        return null
      }
      throw error
    }
  }

  /**
   * Parse and normalize KVK API response
   * Adapts the response structure to a consistent format
   * Based on actual KVK API response structure from https://developers.kvk.nl/nl/documentation
   * 
   * @param {Object} apiResponse - Raw API response
   * @returns {Object} Normalized company profile
   */
  static parseCompanyProfile(apiResponse) {
    // KVK API response structure (from documentation):
    // - Top level: kvkNummer, naam, formeleRegistratiedatum, materieleRegistratie, etc.
    // - _embedded.hoofdvestiging: Contains address and other details
    // - _embedded.eigenaar: Contains legal form (rechtsvorm)
    
    const profile = apiResponse
    
    // Get address from hoofdvestiging (main establishment)
    let address = {
      street: '',
      houseNumber: '',
      postalCode: '',
      city: '',
      country: 'NL'
    }
    
    if (profile._embedded?.hoofdvestiging?.adressen && profile._embedded.hoofdvestiging.adressen.length > 0) {
      const hoofdvestigingAdres = profile._embedded.hoofdvestiging.adressen[0]
      address = {
        street: hoofdvestigingAdres.straatnaam || '',
        houseNumber: hoofdvestigingAdres.huisnummer?.toString() || '',
        postalCode: hoofdvestigingAdres.postcode || '',
        city: hoofdvestigingAdres.plaats || '',
        country: hoofdvestigingAdres.land || 'NL'
      }
    }
    
    // Get founding date (materieleRegistratie.datumAanvang or formeleRegistratiedatum)
    let foundingDate = null
    if (profile.materieleRegistratie?.datumAanvang) {
      // Format: YYYYMMDD (e.g., "20210120")
      const dateStr = profile.materieleRegistratie.datumAanvang.toString()
      if (dateStr.length === 8 && dateStr !== '00000000') {
        foundingDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
      }
    } else if (profile.formeleRegistratiedatum) {
      const dateStr = profile.formeleRegistratiedatum.toString()
      if (dateStr.length === 8 && dateStr !== '00000000') {
        foundingDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
      }
    }
    
    // Get legal form from eigenaar (owner)
    const legalForm = profile._embedded?.eigenaar?.rechtsvorm || 
                     profile._embedded?.eigenaar?.uitgebreideRechtsvorm || 
                     null
    
    // Get main activity from sbiActiviteiten
    const mainActivity = profile.sbiActiviteiten?.find(sbi => sbi.indHoofdactiviteit === 'Ja')?.sbiOmschrijving || null
    
    // Get trade names
    const tradeNames = profile.handelsnamen?.map(h => h.naam) || []
    
    // Determine status (active if not dissolved)
    // Note: KVK API doesn't explicitly provide status, but we can infer from data
    const status = profile.indNonMailing === 'Ja' ? 'Actief' : 'Actief' // Default to active if registered

    return {
      kvkNumber: profile.kvkNummer || profile.kvk_number || profile.kvk,
      companyName: profile.naam || profile.handelsnaam || profile.companyName || profile.name,
      tradeNames: tradeNames,
      address: address,
      foundingDate: foundingDate,
      status: status,
      legalForm: legalForm,
      mainActivity: mainActivity,
      numberOfEmployees: profile.totaalWerkzamePersonen || null,
      vatNumber: profile.btwNummer || profile.vatNumber || null,
      rawData: apiResponse // Store raw response for reference
    }
  }

  /**
   * Search companies by name
   * Uses Zoeken API
   * 
   * @param {string} companyName - Company name to search for
   * @param {string} city - Optional city filter
   * @param {number} limit - Maximum number of results (default: 10)
   * @returns {Promise<Array>} Array of matching companies
   */
  static async searchCompanies(companyName, city = null, limit = 10) {
    if (!companyName || companyName.trim().length === 0) {
      throw new Error('Company name is required for search')
    }

    try {
      // KVK Zoeken API v2
      // According to KVK documentation: "Gebruik voor free format zoeken de overige inputparameters (bijvoorbeeld handelsnaam of straatnaam)"
      // Parameters should be lowercase according to the examples in the documentation
      const testMode = process.env.KVK_API_TEST_MODE === 'true'
      const searchBaseUrl = testMode
        ? 'https://api.kvk.nl/test/api/v2'
        : 'https://api.kvk.nl/api/v2'
      
      // Build query parameters - use 'naam' parameter as shown in KVK Quickstart documentation
      // Example from docs: curl https://api.kvk.nl/api/v2/zoeken?naam=test -H "apikey: JOUWAPIKEY"
      const params = new URLSearchParams()
      
      // Use 'naam' parameter for company name search (not 'handelsnaam')
      params.append('naam', companyName.trim())
      
      if (city) {
        params.append('plaats', city)
      }
      if (limit) {
        params.append('resultatenperpagina', limit.toString())
      }
      params.append('pagina', '1')
      
      const endpoint = `${searchBaseUrl}/zoeken?${params.toString()}`
      
      console.log('[KVK API] Search endpoint:', endpoint);
      console.log('[KVK API] Search params:', params.toString());
      
      // Use direct fetch for search API
      const apiKey = this.getApiKey()
      const fetchFunction = this.getFetchFunction()
      
      const response = await fetchFunction(endpoint, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error(`KVK API search failed: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      // Parse results - KVK Zoeken API returns: { resultaten: [...], totaal: number, ... }
      const results = data.resultaten || []
      
      // For search results, we need to parse them differently than basisprofiel
      // Search results have: kvkNummer, naam, adres, type, links
      return results.map(result => ({
        kvkNumber: result.kvkNummer,
        companyName: result.naam,
        address: result.adres?.binnenlandsAdres ? {
          street: result.adres.binnenlandsAdres.straatnaam || '',
          houseNumber: result.adres.binnenlandsAdres.huisnummer?.toString() || '',
          postalCode: result.adres.binnenlandsAdres.postcode || '',
          city: result.adres.binnenlandsAdres.plaats || '',
          country: 'NL'
        } : null,
        type: result.type, // 'hoofdvestiging', 'nevenvestiging', 'rechtspersoon'
        links: result.links || [],
        rawData: result
      }))
    } catch (error) {
      console.error('[KVK API] Search error:', error)
      throw error
    }
  }

  /**
   * Verify if a KVK number exists and is valid
   * 
   * @param {string} kvkNumber - KVK number to verify
   * @returns {Promise<Object>} { valid: boolean, exists: boolean, profile: Object|null }
   */
  static async verifyKvkNumber(kvkNumber) {
    if (!kvkNumber) {
      return {
        valid: false,
        exists: false,
        profile: null,
        error: 'KVK number is required'
      }
    }

    // First validate format
    const normalized = this.normalizeKvkNumber(kvkNumber)
    if (!this.validateKvkNumberFormat(normalized)) {
      return {
        valid: false,
        exists: false,
        profile: null,
        error: `Invalid KVK number format: ${kvkNumber}. Expected 8 digits.`
      }
    }

    try {
      // Try to fetch company profile
      const profile = await this.getCompanyProfile(normalized)
      
      if (profile) {
        return {
          valid: true,
          exists: true,
          profile: profile,
          error: null
        }
      } else {
        return {
          valid: true, // Format is valid
          exists: false, // But company doesn't exist
          profile: null,
          error: 'KVK number not found in KVK database'
        }
      }
    } catch (error) {
      return {
        valid: true, // Format might be valid
        exists: false,
        profile: null,
        error: error.message || 'Error verifying KVK number'
      }
    }
  }

  /**
   * Get company age/founding date from KVK number
   * 
   * @param {string} kvkNumber - KVK number
   * @returns {Promise<Object|null>} { age: string, founded: string } or null
   */
  static async getCompanyAge(kvkNumber) {
    try {
      const profile = await this.getCompanyProfile(kvkNumber)
      
      if (!profile || !profile.foundingDate) {
        return null
      }

      // Parse founding date
      const foundedDate = new Date(profile.foundingDate)
      if (isNaN(foundedDate.getTime())) {
        return null
      }

      // Calculate age in years
      const currentDate = new Date()
      const ageInYears = currentDate.getFullYear() - foundedDate.getFullYear()
      const monthDiff = currentDate.getMonth() - foundedDate.getMonth()
      const dayDiff = currentDate.getDate() - foundedDate.getDate()
      
      // Adjust if birthday hasn't occurred this year
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) 
        ? ageInYears - 1 
        : ageInYears

      return {
        founded: profile.foundingDate,
        age: `${actualAge} jaar`,
        ageInYears: actualAge
      }
    } catch (error) {
      console.error('[KVK API] Error getting company age:', error)
      return null
    }
  }

  /**
   * Compare user-provided data with KVK data
   * Returns mismatches and matches
   * 
   * @param {Object} userData - User-provided company data
   * @param {Object} kvkProfile - KVK company profile
   * @returns {Object} Comparison results
   */
  static compareWithKvkData(userData, kvkProfile) {
    if (!kvkProfile) {
      return {
        matches: {},
        mismatches: {},
        score: 0
      }
    }

    const matches = {}
    const mismatches = {}
    let score = 0

    // Compare company name
    // Check against both official name AND trade names (handelsnamen)
    const userCompanyName = (userData.company_name || '').toLowerCase().trim()
    const kvkCompanyName = (kvkProfile.companyName || '').toLowerCase().trim()
    const kvkTradeNames = (kvkProfile.tradeNames || []).map(name => name.toLowerCase().trim())
    
    // Check all possible name matches
    const allKvkNames = [kvkCompanyName, ...kvkTradeNames].filter(Boolean)
    let nameMatch = false
    let nameMatchType = null
    
    if (userCompanyName && allKvkNames.length > 0) {
      // Check for exact match
      if (allKvkNames.includes(userCompanyName)) {
        nameMatch = true
        nameMatchType = 'exact'
        matches.companyName = true
        score += 10
      } else {
        // Check for partial matches
        for (const kvkName of allKvkNames) {
          if (kvkName.includes(userCompanyName) || userCompanyName.includes(kvkName)) {
            nameMatch = true
            nameMatchType = 'partial'
            matches.companyName = 'partial'
            score += 5
            break
          }
        }
        
        // If no match found, check if user name is similar to any trade name
        if (!nameMatch) {
          // Check if user name contains key words from KVK names
          const userWords = userCompanyName.split(/\s+/).filter(w => w.length > 2)
          const kvkWords = allKvkNames.flatMap(name => name.split(/\s+/).filter(w => w.length > 2))
          const commonWords = userWords.filter(w => kvkWords.includes(w))
          
          if (commonWords.length >= 2) {
            // At least 2 common words - likely a variation
            nameMatch = true
            nameMatchType = 'variation'
            matches.companyName = 'variation'
            score += 3
          } else {
            // No match - this is a mismatch
            mismatches.companyName = {
              user: userData.company_name,
              kvk: kvkProfile.companyName,
              tradeNames: kvkProfile.tradeNames || []
            }
            score -= 5
          }
        }
      }
    }

    // Compare address (postal code and city)
    const userPostalCode = (userData.postal_code || '').toUpperCase().replace(/\s+/g, '')
    const kvkPostalCode = (kvkProfile.address?.postalCode || '').toUpperCase().replace(/\s+/g, '')
    
    if (userPostalCode && kvkPostalCode) {
      if (userPostalCode === kvkPostalCode) {
        matches.postalCode = true
        score += 5
      } else {
        mismatches.postalCode = {
          user: userData.postal_code,
          kvk: kvkProfile.address.postalCode
        }
        score -= 3
      }
    }

    const userCity = (userData.city || '').toLowerCase().trim()
    const kvkCity = (kvkProfile.address?.city || '').toLowerCase().trim()
    
    if (userCity && kvkCity) {
      if (userCity === kvkCity) {
        matches.city = true
        score += 3
      } else {
        mismatches.city = {
          user: userData.city,
          kvk: kvkProfile.address.city
        }
        score -= 2
      }
    }

    return {
      matches,
      mismatches,
      score,
      kvkProfile: kvkProfile
    }
  }
}

module.exports = KvkApiService

