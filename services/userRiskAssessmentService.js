'use strict'

const OpenAI = require('openai')
const KvkApiService = require('./kvkApiService')
const GooglePlacesService = require('./googlePlacesService')

/**
 * User Risk Assessment Service
 * 
 * Evaluates user trustworthiness/quality using AI based on company information.
 * Reuses existing OpenAI integration from AiMailService.
 */
class UserRiskAssessmentService {
  // Default configuration
  static DEFAULT_CONFIG = {
    model: 'gpt-4o-mini',
    riskThresholdLow: 40,
    riskThresholdMedium: 70,
    temperature: 0.3, // Lower temperature for more consistent scoring
    maxTokens: 500
  }

  /**
   * Get OpenAI client (reuse from AiMailService pattern)
   */
  static getOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return null
    }
    return new OpenAI({ apiKey })
  }

  /**
   * Check if OpenAI is configured
   */
  static isOpenAIAvailable() {
    return !!process.env.OPENAI_API_KEY
  }

  /**
   * Get risk assessment settings from database
   * Falls back to defaults if not found
   */
  static async getRiskSettings(supabaseClient) {
    try {
      const { data: settings, error } = await supabaseClient
        .from('user_risk_settings')
        .select('setting_key, setting_value')

      if (error) {
        console.warn('⚠️ Could not fetch risk settings, using defaults:', error.message)
        return this.DEFAULT_CONFIG
      }

      // Convert settings array to object
      const settingsObj = {}
      if (settings) {
        settings.forEach(setting => {
          settingsObj[setting.setting_key] = setting.setting_value
        })
      }

      return {
        model: settingsObj.ai_model || this.DEFAULT_CONFIG.model,
        riskThresholdLow: parseInt(settingsObj.ai_risk_threshold_low || this.DEFAULT_CONFIG.riskThresholdLow, 10),
        riskThresholdMedium: parseInt(settingsObj.ai_risk_threshold_medium || this.DEFAULT_CONFIG.riskThresholdMedium, 10),
        temperature: this.DEFAULT_CONFIG.temperature,
        maxTokens: this.DEFAULT_CONFIG.maxTokens
      }
    } catch (err) {
      console.warn('⚠️ Error fetching risk settings, using defaults:', err.message)
      return this.DEFAULT_CONFIG
    }
  }

  /**
   * Prepare user data for AI evaluation
   * Extracts relevant fields from profile
   */
  static prepareUserData(profile) {
    // Check if billing address exists (any of the billing fields)
    const hasBillingAddress = !!(
      profile.billing_address ||
      profile.billing_postal_code ||
      profile.billing_city ||
      profile.billing_country ||
      profile.billing_company_name
    )

    // Format billing address string
    const billingAddressParts = []
    if (profile.billing_address) billingAddressParts.push(profile.billing_address)
    if (profile.billing_postal_code) billingAddressParts.push(profile.billing_postal_code)
    if (profile.billing_city) billingAddressParts.push(profile.billing_city)
    if (profile.billing_country) billingAddressParts.push(profile.billing_country)
    const billingAddressFull = billingAddressParts.length > 0 
      ? billingAddressParts.join(', ')
      : (profile.billing_company_name || 'Niet opgegeven')

    return {
      email: profile.email || '',
      company_name: profile.company_name || '',
      coc_number: profile.coc_number || '', // KVK nummer
      vat_number: profile.vat_number || '',
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      phone: profile.phone || '',
      street: profile.street || '',
      postal_code: profile.postal_code || '',
      city: profile.city || '',
      country: profile.country || '',
      billing_company_name: profile.billing_company_name || '',
      billing_address: profile.billing_address || '',
      billing_postal_code: profile.billing_postal_code || '',
      billing_city: profile.billing_city || '',
      billing_country: profile.billing_country || '',
      has_billing_address: hasBillingAddress,
      billing_address_full: billingAddressFull
    }
  }

  /**
   * Build AI prompt for risk assessment
   */
  static buildRiskAssessmentPrompt(userData, additionalInfo = {}) {
    const billingInfo = userData.has_billing_address 
      ? userData.billing_address_full
      : 'Niet opgegeven'

    // KVK verification info
    let kvkInfo = ''
    if (additionalInfo.kvk_data) {
      const kvk = additionalInfo.kvk_data
      kvkInfo = '\n\n**KVK Verificatie (officiële gegevens uit Handelsregister):**\n'
      kvkInfo += '- KVK nummer: ' + (userData.coc_number || 'Niet opgegeven') + '\n'
      kvkInfo += '- Officiële bedrijfsnaam (KVK): ' + (kvk.companyName || 'Niet beschikbaar') + '\n'
      // Include trade names (handelsnamen) - these are alternative names the company uses
      if (kvk.tradeNames && kvk.tradeNames.length > 0) {
        kvkInfo += '- Handelsnamen (alternatieve namen): ' + kvk.tradeNames.join(', ') + '\n'
        kvkInfo += '  **BELANGRIJK**: De gebruiker kan een handelsnaam hebben ingevuld in plaats van de officiële naam. Dit is NORMAAL en NIET een risicofactor als de ingevulde naam overeenkomt met een handelsnaam.\n'
      }
      kvkInfo += '- Bedrijfsstatus: ' + (kvk.status || 'Niet beschikbaar') + '\n'
      if (kvk.foundingDate) {
        kvkInfo += '- Oprichtingsdatum: ' + kvk.foundingDate + '\n'
      }
      if (kvk.address) {
        kvkInfo += '- KVK adres: ' + (kvk.address.street || '') + ' ' + (kvk.address.houseNumber || '') + ', ' + (kvk.address.postalCode || '') + ' ' + (kvk.address.city || '') + '\n'
      }
      if (additionalInfo.company_age) {
        kvkInfo += '- Bedrijfsleeftijd: ' + additionalInfo.company_age.age + ' (opgericht: ' + additionalInfo.company_age.founded + ')\n'
      }
    }

    // Company age info (from KVK)
    const companyAgeInfo = additionalInfo.company_age 
      ? '\n- Bedrijfsleeftijd: ' + additionalInfo.company_age.age + ' (opgericht: ' + additionalInfo.company_age.founded + ')'
      : ''

    // Google Reviews from Places API (most accurate)
    const googleReviewsInfo = additionalInfo.google_reviews
      ? '\n\n' + additionalInfo.google_reviews
      : ''

    // Only include internet search if we actually have results (and no Google Reviews from Places API)
    const internetSearchInfo = additionalInfo.internet_search_results && !additionalInfo.google_reviews
      ? '\n\n**Internet verificatie (online gevonden informatie):**\n' + additionalInfo.internet_search_results
      : ''

    return 'Je bent een expert in het beoordelen van de betrouwbaarheid van B2B bedrijven op basis van beschikbare informatie.\n\n' +
      'Analyseer de volgende bedrijfsgegevens en geef een risicobeoordeling:\n\n' +
      '**Bedrijfsgegevens:**\n' +
      '- Bedrijfsnaam: ' + (userData.company_name || 'Niet opgegeven') + '\n' +
      '- KVK nummer: ' + (userData.coc_number || 'Niet opgegeven') + '\n' +
      '- BTW nummer: ' + (userData.vat_number || 'Niet opgegeven (optioneel veld)') + '\n' +
      '- E-mail: ' + (userData.email || 'Niet opgegeven') + '\n' +
      '- Telefoon: ' + (userData.phone || 'Niet opgegeven') + '\n' +
      '- Adres: ' + (userData.street || '') + ' ' + (userData.postal_code || '') + ' ' + (userData.city || '') + ' ' + (userData.country || '') + '\n' +
      '- Factuuradres: ' + billingInfo + companyAgeInfo + kvkInfo + googleReviewsInfo + internetSearchInfo + '\n\n' +

      '**Beoordelingscriteria:**\n' +
      '1. **Volledigheid (0-30 punten)**: Hoe compleet zijn de bedrijfsgegevens?\n' +
      '   - Bedrijfsnaam aanwezig: +10 punten\n' +
      (additionalInfo.kvk_data ? '   - KVK nummer geverifieerd via KVK API: +10 punten (ZEER BELANGRIJK - officiële verificatie)' : '   - KVK nummer aanwezig maar niet geverifieerd: +5 punten') + '\n' +
      '   - Adres compleet (straat, postcode, stad): +10 punten\n' +
      '   - Telefoon of e-mail aanwezig: +5 punten\n\n' +
      '2. **Consistentie (0-25 punten)**: Zijn de gegevens consistent?\n' +
      '   - Bedrijfsnaam match tussen factuur en profiel: +10 punten\n' +
      (additionalInfo.kvk_data ? '   - Bedrijfsnaam match met KVK officiële naam: +10 punten (ZEER BELANGRIJK - officiële verificatie)' : '') + '\n' +
      (additionalInfo.kvk_data ? '   - Adres match met KVK officieel adres: +5 punten (officiële verificatie)' : '') + '\n' +
      '   - E-mail domein match met bedrijfsnaam (geen free providers voor business): +10 punten\n' +
      '   - Adres consistentie: +5 punten\n\n' +
      '3. **Legitimiteit indicatoren (0-25 punten)**: Zijn er indicatoren van een legitiem bedrijf?\n' +
      (additionalInfo.kvk_data ? '   - KVK verificatie succesvol (bedrijf bestaat officieel): +10 punten (ZEER BELANGRIJK)' : '') + '\n' +
      (additionalInfo.kvk_data && additionalInfo.kvk_data.status === 'Actief' ? '   - Bedrijf is actief volgens KVK: +5 punten' : '') + '\n' +
      (additionalInfo.company_age && additionalInfo.company_age.ageInYears >= 2 ? '   - Bedrijfsleeftijd > 2 jaar (van KVK): +5 punten' : '') + '\n' +
      '   - Professioneel e-mail domein (geen gmail/yahoo/hotmail voor business): +5 punten\n' +
      (additionalInfo.google_reviews ? '   - Google Reviews via Places API: +10 punten (officiële Google Business profiel met exacte reviews)' : '') +
      (additionalInfo.internet_search_results && !additionalInfo.google_reviews ? '   - Internet verificatie: +5 punten (online aanwezigheid gevonden)' : '') + '\n\n' +
      '4. **Risico indicatoren (0-20 punten, negatief)**: Zijn er waarschuwingssignalen?\n' +
      (additionalInfo.kvk_data && additionalInfo.kvk_data.status && additionalInfo.kvk_data.status.toLowerCase().includes('opgeheven') ? '   - Bedrijf is opgeheven volgens KVK: -15 punten (ZEER RISICOVOL)' : '') + '\n' +
      (additionalInfo.kvk_data && additionalInfo.kvk_data.status && additionalInfo.kvk_data.status.toLowerCase().includes('failliet') ? '   - Bedrijf is failliet volgens KVK: -15 punten (ZEER RISICOVOL)' : '') + '\n' +
      (additionalInfo.kvk_data && additionalInfo.kvk_data.companyName && userData.company_name ? 
       '   - Bedrijfsnaam komt NIET overeen met KVK officiële naam OF handelsnamen: -10 punten (RISICOVOL)\n' +
       '     **LET OP**: Als de naam overeenkomt met een handelsnaam, is dit NORMAAL en NIET risicovol' : '') + '\n' +
      '   - Verdachte patronen in e-mail/naam: -10 punten\n' +
      '   - Ontbrekende kritieke bedrijfsinfo: -5 punten\n' +
      '   - Inconsistente data: -5 punten\n\n' +
      '**BELANGRIJKE REGELS:**\n' +
      '- BTW nummer (VAT) is OPTIONEEL en mag NIET als risicofactor worden gezien als het ontbreekt\n' +
      '- Factuuradres wordt als aanwezig beschouwd als MINSTENS ÉÉN van de volgende velden is ingevuld: billing_address, billing_postal_code, billing_city, billing_country, billing_company_name\n' +
      (additionalInfo.kvk_data ? '- KVK verificatie is beschikbaar - gebruik deze informatie in je beoordeling. Dit is officiële data uit het Handelsregister.\n' +
      '- Als KVK verificatie beschikbaar is, geef dit ZEER HOOG gewicht in je beoordeling.\n' +
      '- **BELANGRIJK - Bedrijfsnaam vergelijking**:\n' +
      '  * Bedrijven hebben vaak meerdere namen: een officiële naam en handelsnamen (alternatieve namen)\n' +
      '  * Als de gebruiker een handelsnaam heeft ingevuld die in de KVK handelsnamen lijst staat, is dit NORMAAL en NIET een risicofactor\n' +
      '  * Alleen als de ingevulde naam NIET overeenkomt met de officiële naam EN ook niet met een handelsnaam, dan is dit een risicofactor\n' +
      '  * Bijvoorbeeld: Officiële naam "AG Schilder Den Haag" met handelsnaam "ACG Schildersbedrijf" betekent dat "ACG Schildersbedrijf" een geldige handelsnaam is\n' +
      '- Als bedrijfsnaam of adres niet matcht met KVK gegevens (ook niet met handelsnamen), vermeld dit expliciet als risicofactor.\n' +
      '- Als bedrijfsstatus "Opgeheven" of "Failliet" is, geef dit ZEER HOOG gewicht als risicofactor.\n' : '- KVK verificatie is NIET beschikbaar - vermeld dit NIET in je uitleg als ontbrekend\n') +
      (additionalInfo.company_age ? '- Bedrijfsleeftijd is beschikbaar via KVK - gebruik dit in je beoordeling. Oudere bedrijven zijn meestal betrouwbaarder.\n' : '- Bedrijfsleeftijd is NIET beschikbaar - vermeld dit NIET in je uitleg als ontbrekend\n') +
      (additionalInfo.google_reviews ? '- Google Reviews via Places API is beschikbaar - dit is OFFICIËLE data van Google Business profiel. Gebruik de EXACTE rating en aantal reviews zoals vermeld. Rond NIET af.\n' : '') +
      (additionalInfo.internet_search_results && !additionalInfo.google_reviews ? '- Internet verificatie is beschikbaar - gebruik dit in je beoordeling. De internet verificatie bevat informatie over website, social media, en online aanwezigheid.' : '') +
      (!additionalInfo.google_reviews && !additionalInfo.internet_search_results ? '- Internet verificatie is NIET beschikbaar - vermeld dit NIET in je uitleg als ontbrekend' : '') + '\n' +
      '- Vermeld ALLEEN informatie die daadwerkelijk beschikbaar is in de bovenstaande gegevens\n' +
      '- Zeg NIET dat informatie ontbreekt als het niet expliciet in de gegevens staat\n' +
      '- Als de internet verificatie informatie bevat, gebruik deze informatie in je beoordeling\n' +
      (additionalInfo.google_reviews ? '- **KRITIEK BELANGRIJK - GOOGLE REVIEWS (Places API)**:\n' +
      '  * Google Reviews data komt van het OFFICIËLE Google Business profiel via Google Places API\n' +
      '  * **EXACTE RATING**: Gebruik de EXACTE rating zoals vermeld. "4.9" = "4.9 sterren", NIET "5.0" of "5 sterren"\n' +
      '  * **EXACT AANTAL**: Gebruik het EXACTE aantal reviews zoals vermeld. "15 reviews" = "15 reviews", NIET "4" of "enkele"\n' +
      '  * **VOORBEELD CORRECT**: "Het bedrijf heeft 15 Google Reviews met een gemiddelde beoordeling van 4.9 sterren"\n' +
      '  * **ROND NIET AF**: De rating is exact zoals van Google - rond NIET af naar hele getallen\n' +
      '  * Website: vermeld de URL als gewone tekst (GEEN markdown links zoals [tekst](url), gewoon "Website: https://example.nl")\n' : '') +
      (additionalInfo.internet_search_results && !additionalInfo.google_reviews ? '- **Internet verificatie**:\n' +
      '  * Website: vermeld de URL als gewone tekst (GEEN markdown links zoals [tekst](url), gewoon "Website: https://example.nl")\n' +
      '  * Bedrijfsgidsen: vermeld waar het bedrijf staat vermeld\n' +
      '  * **NIET vermelden**: Social media aanwezigheid is GEEN factor in de beoordeling - vermeld dit NIET' : '') + '\n\n' +
      '**Output formaat:**\n' +
      'Geef je antwoord ALLEEN als JSON in dit exacte formaat:\n' +
      '{\n' +
      '  "score": <nummer 0-100>,\n' +
      '  "risk_level": "<low|medium|high>",\n' +
      '  "explanation": "<korte uitleg in het Nederlands, max 200 woorden>",\n' +
      '  "strengths": ["<sterk punt 1>", "<sterk punt 2>"],\n' +
      '  "concerns": ["<zorgpunt 1>", "<zorgpunt 2>"]\n' +
      '}\n\n' +
      'Belangrijk:\n' +
      '- Score 0-39 = high risk\n' +
      '- Score 40-69 = medium risk\n' +
      '- Score 70-100 = low risk\n' +
      '- Geef altijd een score tussen 0-100\n' +
      '- Wees objectief en gebaseerd op beschikbare data\n' +
      '- Als veel data ontbreekt, geef een lagere score'
  }

  /**
   * Evaluate user risk using AI
   * 
   * @param {Object} profile - User profile object from database
   * @param {Object} supabaseClient - Supabase client for fetching settings
   * @returns {Promise<Object>} Risk assessment result
   */
  static async evaluateUserRisk(profile, supabaseClient) {
    if (!this.isOpenAIAvailable()) {
      console.warn('⚠️ OpenAI not configured, skipping risk assessment')
      return {
        success: false,
        error: 'OpenAI not configured',
        score: null,
        risk_level: null,
        explanation: null
      }
    }

    try {
      const openai = this.getOpenAIClient()
      if (!openai) {
        throw new Error('Failed to initialize OpenAI client')
      }

      // Get settings
      const config = await this.getRiskSettings(supabaseClient)

      // Prepare user data
      const userData = this.prepareUserData(profile)

      // Gather additional information (KVK data, company age, internet search) if we have accurate data
      const additionalInfo = {}
      
      // Fetch KVK data if KVK number is available and KVK API is configured
      if (userData.coc_number && KvkApiService.isAvailable()) {
        try {
          console.log('Fetching KVK data for: ' + userData.coc_number)
          
          // Try to get KVK profile (use cached data from database if available, otherwise fetch)
          let kvkProfile = null
          
          // Check if profile already has KVK verification data
          if (profile.kvk_verified && profile.kvk_data) {
            // Use existing KVK data from profile
            console.log('Using existing KVK verification data from profile')
            kvkProfile = {
              kvkNumber: userData.coc_number,
              companyName: profile.kvk_company_name || null,
              foundingDate: profile.kvk_founding_date || null,
              status: profile.kvk_status || null,
              address: profile.kvk_data?.address || null,
              rawData: profile.kvk_data
            }
          } else {
            // Fetch fresh KVK data
            kvkProfile = await KvkApiService.getCompanyProfile(userData.coc_number)
            if (kvkProfile) {
              console.log('KVK profile fetched: ' + kvkProfile.companyName)
            }
          }
          
          if (kvkProfile) {
            additionalInfo.kvk_data = kvkProfile
            
            // Get company age from KVK data
            if (kvkProfile.foundingDate) {
              const ageInfo = await KvkApiService.getCompanyAge(userData.coc_number)
              if (ageInfo) {
                additionalInfo.company_age = ageInfo
                console.log('Company age from KVK: ' + ageInfo.age)
              }
            }
          } else {
            console.log('KVK profile not found for: ' + userData.coc_number)
          }
        } catch (err) {
          console.warn('Could not fetch KVK data: ' + err.message)
          // Don't fail the assessment if KVK API fails
        }
      }
      
      // Get Google Reviews using Google Places API (most accurate)
      if (userData.company_name && GooglePlacesService.isAvailable()) {
        try {
          console.log('Searching Google Places for: ' + userData.company_name)
          
          // Use KVK address if available for better matching
          let kvkAddress = null
          if (additionalInfo.kvk_data && additionalInfo.kvk_data.address) {
            kvkAddress = additionalInfo.kvk_data.address
          }
          
          const placeDetails = await GooglePlacesService.findBusinessWithReviews(
            userData.company_name,
            userData.street || '',
            userData.city || '',
            userData.postal_code || '',
            kvkAddress
          )
          
          if (placeDetails) {
            const reviewsInfo = GooglePlacesService.formatReviewsForPrompt(placeDetails)
            if (reviewsInfo) {
              additionalInfo.google_reviews = reviewsInfo
              additionalInfo.google_place_data = GooglePlacesService.formatPlaceData(placeDetails)
              console.log('Found Google Reviews: ' + (placeDetails.user_ratings_total || 0) + ' reviews, ' + (placeDetails.rating || 'N/A') + ' stars')
            }
          } else {
            console.log('No Google Places results found')
          }
        } catch (err) {
          console.warn('Could not fetch Google Places data: ' + err.message)
        }
      }

      // Only search if we have company name and/or KVK number (accurate data)
      // Use general internet search as fallback or for additional info
      if (userData.company_name || userData.coc_number) {
        // Perform internet search for broader risk analysis (website, social media, etc.)
        // But skip if we already have Google Reviews from Places API
        if (!additionalInfo.google_reviews) {
          try {
            console.log('Searching online for: ' + (userData.company_name || userData.coc_number))
            const searchResults = await this.searchCompanyOnline(userData.company_name, userData.coc_number, userData.city, userData.email)
            if (searchResults) {
              additionalInfo.internet_search_results = searchResults
              console.log('Found internet search results (' + searchResults.length + ' chars)')
              // Log first 200 chars to see what was found
              console.log('Search results preview: ' + searchResults.substring(0, 200) + '...')
            } else {
              console.log('No internet search results found')
            }
          } catch (err) {
            console.warn('Could not perform internet search: ' + err.message)
          }
        } else {
          console.log('Skipping general internet search - using Google Places API data')
        }
      }

      // Log what additional info we have
      if (Object.keys(additionalInfo).length > 0) {
        console.log('Additional info available: ' + Object.keys(additionalInfo).join(', '))
      } else {
        console.log('No additional info available (company age/internet search)')
      }

      // Build prompt with additional info
      const prompt = this.buildRiskAssessmentPrompt(userData, additionalInfo)

      console.log('Evaluating risk for user: ' + (profile.email || profile.id))

      // Call OpenAI
      const completion = await openai.chat.completions.create({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert in het beoordelen van B2B bedrijfsbetrouwbaarheid. Geef altijd een geldig JSON antwoord met score, risk_level en explanation.\n\n' +
              (additionalInfo.kvk_data ? 'ZEER BELANGRIJK - KVK VERIFICATIE:\n' +
              '- KVK verificatie data is beschikbaar - dit is OFFICIËLE data uit het Handelsregister.\n' +
              '- Geef KVK verificatie ZEER HOOG gewicht in je beoordeling.\n' +
              '- **BELANGRIJK - Bedrijfsnaam vergelijking**:\n' +
              '  * Bedrijven hebben vaak meerdere namen: een officiële naam en handelsnamen\n' +
              '  * Als de gebruiker een handelsnaam heeft ingevuld die in de KVK handelsnamen lijst staat, is dit NORMAAL en NIET een risicofactor\n' +
              '  * Alleen als de ingevulde naam NIET overeenkomt met de officiële naam EN ook niet met een handelsnaam, dan is dit een risicofactor\n' +
              '  * Check ALTIJD eerst of de ingevulde naam overeenkomt met een handelsnaam voordat je een mismatch rapporteert\n' +
              '- Als bedrijfsnaam niet matcht met KVK officiële naam OF handelsnamen, vermeld dit expliciet als risicofactor.\n' +
              '- Als bedrijfsstatus "Opgeheven" of "Failliet" is, geef dit ZEER HOOG gewicht.\n' +
              '- Als bedrijf actief is en ouder dan 2 jaar, geef dit positief gewicht.\n' +
              '- Vermeld KVK verificatie expliciet in je explanation.\n\n' : '') +
              (additionalInfo.google_reviews ? 'KRITIEK BELANGRIJK - GOOGLE REVIEWS (Places API):\n' +
              '- Google Reviews data komt van het OFFICIËLE Google Business profiel via Google Places API\n' +
              '- Gebruik de EXACTE rating en aantal reviews zoals vermeld in de Google Reviews sectie\n' +
              '- **EXACTE RATING**: "4.9" = "4.9 sterren", NIET "5.0" of "5 sterren" - rond NIET af\n' +
              '- **EXACT AANTAL**: Gebruik het exacte aantal reviews zoals vermeld - rond NIET af, schat NIET\n' +
              '- **VOORBEELD**: "Het bedrijf heeft 15 Google Reviews met een gemiddelde beoordeling van 4.9 sterren"\n' +
              '- Vermeld websites als gewone tekst met URL (GEEN markdown links zoals [tekst](url))\n\n' : '') +
              (additionalInfo.internet_search_results && !additionalInfo.google_reviews ? 'BELANGRIJK - INTERNET VERIFICATIE:\n' +
              '- Als de internet verificatie informatie bevat, gebruik dit in je beoordeling\n' +
              '- Vermeld websites als gewone tekst met URL (GEEN markdown links zoals [tekst](url))\n' +
              '- Social media aanwezigheid is GEEN factor - vermeld dit NIET in je beoordeling\n\n' : '')
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: { type: 'json_object' } // Force JSON response
      })

      const responseText = completion.choices[0].message.content.trim()
      let assessment

      try {
        assessment = JSON.parse(responseText)
      } catch (parseError) {
        // Try to extract JSON from markdown code blocks if present
        // Use String.fromCharCode to avoid backtick issues in regex
        const backtick = String.fromCharCode(96)
        const codeBlockPattern = new RegExp(backtick + backtick + backtick + 'json\\s*(\\{[\\s\\S]*?\\})\\s*' + backtick + backtick + backtick)
        let jsonMatch = responseText.match(codeBlockPattern)
        if (!jsonMatch) {
          const simpleCodeBlockPattern = new RegExp(backtick + backtick + backtick + '\\s*(\\{[\\s\\S]*?\\})\\s*' + backtick + backtick + backtick)
          jsonMatch = responseText.match(simpleCodeBlockPattern)
        }
        if (jsonMatch) {
          assessment = JSON.parse(jsonMatch[1])
        } else {
          throw new Error('Failed to parse AI response as JSON')
        }
      }

      // Validate and normalize response
      const score = Math.max(0, Math.min(100, parseInt(assessment.score, 10) || 50))
      let riskLevel = (assessment.risk_level || '').toLowerCase()

      // Determine risk level if not provided or invalid
      if (!['low', 'medium', 'high'].includes(riskLevel)) {
        if (score < config.riskThresholdLow) {
          riskLevel = 'high'
        } else if (score < config.riskThresholdMedium) {
          riskLevel = 'medium'
        } else {
          riskLevel = 'low'
        }
      }

      const explanation = assessment.explanation || 'Geen uitleg beschikbaar'

      console.log('Risk assessment completed: score=' + score + ', level=' + riskLevel)

      return {
        success: true,
        score,
        risk_level: riskLevel,
        explanation,
        strengths: assessment.strengths || [],
        concerns: assessment.concerns || [],
        assessed_at: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Error in AI risk assessment:', error)
      return {
        success: false,
        error: error.message || 'Unknown error',
        score: null,
        risk_level: null,
        explanation: null
      }
    }
  }

  /**
   * Determine if user requires manual review based on risk score
   * 
   * @param {number} riskScore - AI risk score (0-100)
   * @param {Object} config - Risk assessment configuration
   * @returns {boolean}
   */
  static shouldFlagForReview(riskScore, config) {
    if (riskScore === null || riskScore === undefined) {
      return false // Don't flag if no score available
    }
    return riskScore < config.riskThresholdLow
  }

  /**
   * Check if user is "new" (for MVP: only based on is_new flag)
   * 
   * @param {Object} profile - User profile
   * @returns {boolean}
   */
  static isUserNew(profile) {
    return profile.is_new === true
  }

  /**
   * Save risk assessment to database
   * 
   * @param {Object} supabaseClient - Supabase client
   * @param {string} userId - User ID
   * @param {Object} assessment - Risk assessment result
   * @param {Object} config - Risk assessment configuration
   * @returns {Promise<Object>}
   */
  static async saveRiskAssessment(supabaseClient, userId, assessment, config) {
    if (!assessment.success) {
      console.warn('Not saving failed assessment for user ' + userId)
      return { success: false, error: assessment.error }
    }

    try {
      const requiresReview = this.shouldFlagForReview(assessment.score, config)

      const { data, error } = await supabaseClient
        .from('profiles')
        .update({
          ai_risk_score: assessment.score,
          ai_risk_level: assessment.risk_level,
          ai_risk_explanation: assessment.explanation,
          ai_risk_assessed_at: assessment.assessed_at,
          requires_manual_review: requiresReview,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        throw error
      }

      console.log('Risk assessment saved for user ' + userId + ': score=' + assessment.score + ', requires_review=' + requiresReview)

      return {
        success: true,
        data,
        requires_manual_review: requiresReview
      }
    } catch (error) {
      console.error('Error saving risk assessment for user ' + userId + ':', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Evaluate and save risk assessment for a user
   * Main entry point for risk assessment
   * 
   * @param {Object} supabaseClient - Supabase client
   * @param {Object} profile - User profile object
   * @returns {Promise<Object>}
   */
  static async evaluateAndSaveRisk(supabaseClient, profile) {
    try {
      // Evaluate risk
      const assessment = await this.evaluateUserRisk(profile, supabaseClient)

      if (!assessment.success) {
        return assessment
      }

      // Get config for determining review flag
      const config = await this.getRiskSettings(supabaseClient)

      // Save to database
      const saveResult = await this.saveRiskAssessment(
        supabaseClient,
        profile.id,
        assessment,
        config
      )

      return {
        ...assessment,
        saved: saveResult.success,
        requires_manual_review: saveResult.requires_manual_review
      }
    } catch (error) {
      console.error('Error in evaluateAndSaveRisk:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get company age from KVK number using KVK API
   * 
   * @param {string} cocNumber - KVK number
   * @param {string} companyName - Company name (optional, not used but kept for compatibility)
   * @returns {Promise<Object|null>} { age: string, founded: string, ageInYears: number } or null
   */
  static async getCompanyAge(cocNumber, companyName = '') {
    // Use KVK API to get company age
    if (!cocNumber || !cocNumber.trim()) {
      return null
    }

    // Check if KVK API is available
    if (!KvkApiService.isAvailable()) {
      console.warn('KVK API not available, cannot fetch company age')
      return null
    }

    try {
      // Use KVK API service to get company age
      const ageInfo = await KvkApiService.getCompanyAge(cocNumber.trim())
      
      if (ageInfo) {
        console.log(`Company age from KVK: ${ageInfo.age} (founded: ${ageInfo.founded})`)
        return ageInfo
      }
      
      return null
    } catch (error) {
      console.warn('Error fetching company age from KVK API: ' + error.message)
      return null
    }
  }

  /**
   * Search company online using Google Custom Search API (if available) or OpenAI
   * Only performs search if we have accurate data (company name or KVK)
   * 
   * @param {string} companyName - Company name
   * @param {string} cocNumber - KVK number (optional)
   * @param {string} city - City (optional, for better search results)
   * @param {string} email - Email address (optional, for better website matching)
   * @returns {Promise<string|null>} Search results summary or null
   */
  static async searchCompanyOnline(companyName, cocNumber = '', city = '', email = '') {
    // Only search if we have at least company name or KVK number
    if (!companyName && !cocNumber) {
      return null
    }

    // Extract email domain if available for better website matching
    const emailDomain = email ? email.split('@')[1] : ''
    
    // Try Tavily AI Search API first (fastest, AI-powered search + summarization in one call)
    // Tavily is specifically designed for AI agents and combines search + AI summarization
    if (process.env.TAVILY_API_KEY) {
      try {
        console.log('Using Tavily AI Search for faster results...')
        const tavilyResult = await this.searchWithTavily(companyName, cocNumber, emailDomain)
        if (tavilyResult) {
          console.log('Tavily search completed successfully (' + tavilyResult.length + ' chars)')
          return tavilyResult
        }
      } catch (err) {
        console.warn('Tavily search failed, falling back to Google Search: ' + err.message)
        // Fall through to Google Search
      }
    }

    // Fallback to Google Custom Search API (if configured) - slower but more accurate
    if (process.env.GOOGLE_CUSTOM_SEARCH_API_KEY && process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID) {
      try {
        // Perform multiple targeted searches for better results
        const searchQueries = []
        
        // Main search with company name - use fewer, more targeted queries for speed
        if (companyName) {
          // Try exact match first
          searchQueries.push('"' + companyName + '"')
          // If we have email domain, search specifically for that domain
          if (emailDomain && emailDomain !== 'gmail.com' && emailDomain !== 'hotmail.com' && emailDomain !== 'outlook.com') {
            searchQueries.push('site:' + emailDomain)
            searchQueries.push(companyName + ' ' + emailDomain)
          }
          // Try with .nl domain (common for Dutch companies)
          searchQueries.push(companyName + ' site:.nl')
          // Try with .com domain
          searchQueries.push(companyName + ' site:.com')
          // Search for website
          searchQueries.push(companyName + ' website')
          // Search for Google Reviews
          searchQueries.push(companyName + ' google reviews')
          // Search for Google Maps
          searchQueries.push(companyName + ' google maps')
          // Search for social media
          searchQueries.push(companyName + ' linkedin OR ' + companyName + ' facebook OR ' + companyName + ' instagram')
        }
        
        // Search with KVK if available
        if (cocNumber) {
          searchQueries.push((companyName || '') + ' KVK ' + cocNumber)
          searchQueries.push('KVK ' + cocNumber + ' ' + (companyName || ''))
        }
        
        // Combine all results - use fewer queries (2-3) for speed, execute in parallel
        const uniqueUrls = new Set() // Track URLs to avoid duplicates
        
        // Prioritize most important queries: exact match, email domain, and reviews
        const priorityQueries = searchQueries.slice(0, 3) // Only top 3 queries for speed
        
        // Execute queries in parallel for faster results
        const searchPromises = priorityQueries.map(query => 
          this.searchWithGoogleCustomSearch(query, companyName, uniqueUrls, emailDomain)
            .catch(err => {
              console.warn('Search query "' + query + '" failed: ' + err.message)
              return null
            })
        )
        
        const allResults = await Promise.all(searchPromises)
        
        // Filter out null results and combine
        const validResults = allResults.filter(result => result && result.length > 50)
        
        if (validResults.length > 0) {
          // Combine and deduplicate results
          const combinedResults = validResults.join('\n\n---\n\n')
          console.log('Google Custom Search found results from ' + validResults.length + ' queries (' + combinedResults.length + ' chars)')
          return combinedResults
        }
      } catch (err) {
        console.warn('Google Custom Search failed, falling back to OpenAI: ' + err.message)
        // Continue to OpenAI fallback
      }
    }

    // Final fallback: OpenAI knowledge base (if Google Search not configured or failed)
    // NOTE: OpenAI API cannot search the internet - it only uses training data (may be outdated)
    // This is a last resort and may not have current information
    if (!this.isOpenAIAvailable()) {
      return null
    }

    try {
      const openai = this.getOpenAIClient()
      if (!openai) {
        return null
      }

      console.warn('⚠️ Google Search not available, using OpenAI knowledge base (may be outdated)')
      const searchQuery = companyName || cocNumber || ''
      
      // Use OpenAI knowledge base (training data only - not real-time search)
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert in bedrijfsinformatie. Gebruik je kennis om informatie te geven over bedrijven. LET OP: Je hebt alleen toegang tot training data, geen real-time internet search.'
          },
          {
            role: 'user',
            content: 'Geef informatie over dit Nederlandse bedrijf op basis van je kennis: ' + searchQuery + 
              (emailDomain ? ' (email domein: ' + emailDomain + ')' : '') + '\n\n' +
              'BELANGRIJK: Gebruik je kennis en zoekcapaciteiten om ALLE beschikbare informatie te vinden.\n\n' +
              'Zoek SPECIFIEK en GRONDIG naar:\n' +
              '1. **Officiële website**: Zoek naar de bedrijfswebsite, vermeld de exacte URL als je deze vindt\n' +
              '2. **Google Reviews**: Zoek expliciet op Google Maps en Google Reviews. Vermeld:\n' +
              '   - Aantal reviews\n' +
              '   - Gemiddelde beoordeling (sterren)\n' +
              '   - Enkele voorbeelden van reviews indien relevant\n' +
              '3. **Google Maps/Bedrijfsprofiel**: Check of het bedrijf een Google Business profiel heeft\n' +
              '4. **Social media**: LinkedIn, Facebook, Instagram, etc.\n' +
              '5. **Bedrijfsgidsen**: 123bedrijven.nl, bedrijfsgidsen, etc.\n' +
              '6. **Nieuws/Media**: Artikelen, vermeldingen, etc.\n\n' +
              'INSTRUCTIES:\n' +
              '- Wees ZEER grondig - dit bedrijf bestaat en heeft waarschijnlijk online aanwezigheid\n' +
              '- Als je een website vindt, geef de EXACTE URL\n' +
              '- Als je Google Reviews vindt, vermeld het EXACTE aantal en de beoordeling\n' +
              '- Als je meerdere bronnen vindt, vermeld ze allemaal\n' +
              '- Geef een gedetailleerde samenvatting (250-350 woorden) van ALLES wat je vindt\n' +
              '- Begin met een conclusie over de online aanwezigheid, gevolgd door gedetailleerde informatie\n\n' +
              'Als je echt NIETS kunt vinden na grondig zoeken, geef dan expliciet aan: "Na uitgebreide zoektocht: Geen online informatie gevonden."'
          }
        ],
        temperature: 0.5, // Slightly higher for better search results
        max_tokens: 400 // More tokens for detailed results
      })

      const summary = completion.choices[0].message.content.trim()
      
      // Check if we actually found something useful
      const lowerSummary = summary.toLowerCase()
      const hasNoInfo = lowerSummary.includes('geen online informatie') || 
                       lowerSummary.includes('niets gevonden') ||
                       lowerSummary.includes('geen informatie') ||
                       (lowerSummary.includes('niet gevonden') && !lowerSummary.includes('website'))
      
      if (summary && !hasNoInfo && summary.length > 50) {
        return summary
      }

      // If summary is too short or explicitly says nothing found, return null
      if (hasNoInfo || summary.length < 50) {
        console.log('Internet search returned no useful results (summary: ' + summary.substring(0, 100) + '...)')
        return null
      }

      return summary
    } catch (error) {
      console.warn('Error performing internet search: ' + error.message)
      return null
    }
  }

  /**
   * Search using Tavily AI Search API (fastest option - AI-powered search + summarization)
   * 
   * @param {string} companyName - Company name
   * @param {string} cocNumber - KVK number (optional)
   * @param {string} emailDomain - Email domain (optional, for better website matching)
   * @returns {Promise<string|null>} Search results summary or null
   */
  static async searchWithTavily(companyName, cocNumber = '', emailDomain = '') {
    const apiKey = process.env.TAVILY_API_KEY

    if (!apiKey) {
      return null
    }

    try {
      // Check if fetch is available
      let fetchFunction = null
      if (typeof fetch !== 'undefined') {
        fetchFunction = fetch
      } else {
        try {
          fetchFunction = require('node-fetch')
        } catch (e) {
          throw new Error('fetch is not available. Install node-fetch or use Node.js 18+')
        }
      }

      // Build search query - prioritize Google Reviews and website
      let searchQuery = companyName || ''
      if (cocNumber) {
        searchQuery += ' KVK ' + cocNumber
      }
      if (emailDomain && emailDomain !== 'gmail.com' && emailDomain !== 'hotmail.com' && emailDomain !== 'outlook.com') {
        searchQuery += ' ' + emailDomain
      }
      // Explicitly add Google Reviews to general search
      if (companyName) {
        searchQuery += ' Google Reviews Google Maps'
      }

      // Tavily API endpoint
      const tavilyUrl = 'https://api.tavily.com/search'
      
      // First search: General company info + website
      const response = await fetchFunction(tavilyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: searchQuery,
          search_depth: 'advanced', // Get more comprehensive results
          include_answer: true, // Get AI-generated answer
          include_raw_content: true, // Need raw content to extract Google Reviews
          max_results: 10, // More results to find Google Reviews
          include_domains: emailDomain ? [emailDomain] : undefined, // Prioritize email domain
          exclude_domains: ['gmail.com', 'hotmail.com', 'outlook.com'] // Exclude email providers
        })
      })
      
      // Second search: Specifically for Google Reviews (multiple queries for better coverage)
      let googleMapsResults = null
      let googleReviewsResults = null
      if (companyName) {
        try {
          // Query 1: Google Maps/Reviews (simpler query without site: operator)
          const googleMapsQuery = companyName + ' Google Maps Google Reviews'
          const googleMapsResponse = await fetchFunction(tavilyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              api_key: apiKey,
              query: googleMapsQuery,
              search_depth: 'advanced',
              include_answer: false,
              include_raw_content: true,
              max_results: 5,
              include_domains: ['google.com', 'google.nl', 'maps.google.com', 'maps.google.nl', 'business.google.com', 'business.google.nl']
            })
          })
          
          if (googleMapsResponse.ok) {
            googleMapsResults = await googleMapsResponse.json()
          }
          
          // Query 2: Google Reviews in Dutch (for Dutch companies)
          const googleReviewsQuery = companyName + ' Google beoordelingen reviews'
          const googleReviewsResponse = await fetchFunction(tavilyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              api_key: apiKey,
              query: googleReviewsQuery,
              search_depth: 'advanced',
              include_answer: false,
              include_raw_content: true,
              max_results: 5
            })
          })
          
          if (googleReviewsResponse && googleReviewsResponse.ok) {
            googleReviewsResults = await googleReviewsResponse.json()
          }
        } catch (err) {
          console.warn('Google Maps/Reviews specific search failed: ' + err.message)
        }
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error('Tavily API error: ' + response.status + ' - ' + errorText)
      }

      const data = await response.json()
      
      // Combine results from all searches
      const allResults = data.results || []
      const existingUrls = new Set(allResults.map(r => r.url))
      
      // Add Google Maps results
      if (googleMapsResults && googleMapsResults.results) {
        for (const result of googleMapsResults.results) {
          if (result.url && !existingUrls.has(result.url)) {
            allResults.push(result)
            existingUrls.add(result.url)
          }
        }
      }
      
      // Add Google Reviews results
      if (googleReviewsResults && googleReviewsResults.results) {
        for (const result of googleReviewsResults.results) {
          if (result.url && !existingUrls.has(result.url)) {
            allResults.push(result)
            existingUrls.add(result.url)
          }
        }
      }
      
      // Extract Google Reviews information from ALL results (not just Google Maps URLs)
      // Search through all content for review information
      let googleReviewsInfo = null
      let bestRating = null
      let bestCount = null
      
      // First pass: Look through all results for review information
      for (const resultItem of allResults) {
        const content = (resultItem.content || resultItem.raw_content || '').toLowerCase()
        const title = (resultItem.title || '').toLowerCase()
        const url = (resultItem.url || '').toLowerCase()
        const fullText = (content + ' ' + title).toLowerCase()
        
        // Look for Google Maps/Reviews indicators - expanded patterns
        const isGoogleMaps = url.includes('google.com/maps') || url.includes('google.nl/maps') || 
                            url.includes('maps.google.com') || url.includes('maps.google.nl') ||
                            url.includes('business.google.com') || url.includes('business.google.nl') ||
                            url.includes('google.com/place') || url.includes('google.nl/place')
        
        // Check if this result mentions reviews (broader search)
        const hasReviewKeywords = fullText.includes('review') || fullText.includes('beoordeling') || 
                                 fullText.includes('rating') || fullText.includes('sterren') ||
                                 fullText.includes('stars') || fullText.includes('google reviews') ||
                                 fullText.includes('google beoordelingen') || fullText.includes('google maps') ||
                                 isGoogleMaps
        
        // Search in ALL results, but prioritize Google Maps results
        if (hasReviewKeywords || allResults.length < 5) { // If we have few results, search all
          // Try different rating patterns (more comprehensive)
          const ratingPatterns = [
            /(\d+(?:[.,]\d+)?)\s*(?:sterren?|stars?|★|⭐)/i,
            /(\d+(?:[.,]\d+)?)\s*\/\s*5/i,
            /rating[:\s]+(\d+(?:[.,]\d+)?)/i,
            /beoordeling[:\s]+(\d+(?:[.,]\d+)?)/i,
            /(\d+(?:[.,]\d+)?)\s*out\s*of\s*5/i,
            /(\d+(?:[.,]\d+)?)\s*van\s*5/i,
            /gemiddeld[:\s]+(\d+(?:[.,]\d+)?)/i,
            /average[:\s]+(\d+(?:[.,]\d+)?)/i,
            /(\d+(?:[.,]\d+)?)\s*(?:ster|star)/i,
            /google\s+reviews?[:\s]+(\d+(?:[.,]\d+)?)/i,
            /google\s+beoordelingen?[:\s]+(\d+(?:[.,]\d+)?)/i
          ]
          
          for (const pattern of ratingPatterns) {
            const match = fullText.match(pattern)
            if (match) {
              const foundRating = parseFloat(match[1].replace(',', '.'))
              if (foundRating && foundRating >= 1 && foundRating <= 5) {
                const ratingStr = foundRating.toString()
                // Prioritize ratings from Google Maps URLs
                if (isGoogleMaps && !bestRating) {
                  bestRating = ratingStr
                } else if (!bestRating) {
                  bestRating = ratingStr
                }
                break
              }
            }
          }
          
          // Try different count patterns (more comprehensive)
          const countPatterns = [
            /(\d+)\s*(?:google\s+)?reviews?/i,
            /(\d+)\s*(?:google\s+)?beoordelingen?/i,
            /(\d+)\s*(?:ratings?|waarderingen?)/i,
            /(\d+)\s*(?:klanten?|customers?)\s*(?:hebben|have|rated|beoordeeld)/i,
            /(\d+)\s*(?:personen?|people)\s*(?:hebben|have)/i,
            /(\d+)\s*(?:keer|times)\s*(?:beoordeeld|rated)/i,
            /(\d+)\s*(?:reviews?|beoordelingen?)\s*(?:op|on|van|from)/i
          ]
          
          for (const pattern of countPatterns) {
            const match = fullText.match(pattern)
            if (match) {
              const foundCount = parseInt(match[1])
              if (foundCount && foundCount > 0) {
                const countStr = foundCount.toString()
                // Prioritize counts from Google Maps URLs
                if (isGoogleMaps && !bestCount) {
                  bestCount = countStr
                } else if (!bestCount) {
                  bestCount = countStr
                }
                break
              }
            }
          }
        }
      }
      
      // Create review info from best found data
      if (bestRating || bestCount) {
        if (bestRating && bestCount) {
          googleReviewsInfo = bestCount + ' Google Reviews met een gemiddelde beoordeling van ' + bestRating + ' sterren'
        } else if (bestRating) {
          googleReviewsInfo = 'Google Reviews met een gemiddelde beoordeling van ' + bestRating + ' sterren'
        } else if (bestCount) {
          googleReviewsInfo = bestCount + ' Google Reviews'
        }
      }
      
      // Tavily returns an AI-generated answer + sources
      let result = ''
      if (data.answer) {
        // Use the AI-generated answer (already summarized)
        result = data.answer
        
        // Check if answer already mentions reviews
        const answerLower = result.toLowerCase()
        const hasReviewsInAnswer = answerLower.includes('review') || answerLower.includes('beoordeling') || 
                                   answerLower.includes('rating') || answerLower.includes('sterren')
        
        // If we found Google Reviews but answer doesn't mention them, add them prominently
        if (googleReviewsInfo && !hasReviewsInAnswer) {
          result = googleReviewsInfo + '\n\n' + result
        } else if (googleReviewsInfo && hasReviewsInAnswer) {
          // If answer mentions reviews but our extraction is more specific, prepend it
          result = googleReviewsInfo + '\n\n' + result
        }
      } else {
        // No AI answer, build from results
        if (googleReviewsInfo) {
          result = googleReviewsInfo + '\n\n'
        }
        // Add other results
        if (allResults.length > 0) {
          const otherResults = allResults.slice(0, 3).map((r, index) => {
            return (r.title || 'Geen titel') + '\nURL: ' + r.url + '\n' + (r.content ? r.content.substring(0, 200) : '')
          })
          result += otherResults.join('\n\n')
        }
      }
      
      // Final check: if we still don't have reviews info in result, add it
      if (googleReviewsInfo && result && !result.toLowerCase().includes('google reviews')) {
        result = googleReviewsInfo + '\n\n' + result
      }
      
      // Add source URLs for transparency (but don't duplicate website info)
      if (allResults.length > 0) {
        const sources = allResults.slice(0, 3).map(r => r.url).filter(Boolean)
        if (sources.length > 0) {
          result += '\n\nBronnen: ' + sources.join(', ')
        }
      }
      
      return result || null
    } catch (error) {
      console.warn('Error in Tavily Search: ' + error.message)
      return null
    }
  }

  /**
   * Search using Google Custom Search API
   * 
   * @param {string} query - Search query
   * @param {string} companyName - Company name for context
   * @param {Set} seenUrls - Set of URLs already seen (to avoid duplicates)
   * @returns {Promise<string|null>} Formatted search results or null
   */
  static async searchWithGoogleCustomSearch(query, companyName, seenUrls = new Set(), emailDomain = '') {
    const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY
    const engineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID

    if (!apiKey || !engineId) {
      return null
    }

    try {
      // Check if fetch is available (Node.js 18+ has native fetch)
      let fetchFunction = null
      if (typeof fetch !== 'undefined') {
        fetchFunction = fetch
      } else {
        // Try to require node-fetch if available
        try {
          fetchFunction = require('node-fetch')
        } catch (e) {
          throw new Error('fetch is not available. Install node-fetch or use Node.js 18+')
        }
      }

      // Search for company website and reviews
      // Use more results and better search parameters (max 10 per query, but we do multiple queries)
      const searchUrl = 'https://www.googleapis.com/customsearch/v1?key=' + apiKey + '&cx=' + engineId + '&q=' + encodeURIComponent(query) + '&num=10&safe=active'
      
      const response = await fetchFunction(searchUrl)
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        throw new Error('Google Search API error: ' + response.status + ' - ' + errorText)
      }

      const data = await response.json()
      
      // Check for API errors in response
      if (data.error) {
        throw new Error('Google Search API error: ' + (data.error.message || JSON.stringify(data.error)))
      }
      
      if (!data.items || data.items.length === 0) {
        return null
      }

      // Format results for AI analysis - collect ALL relevant results, not just first match
      const results = []
      const websites = []
      const reviews = []
      const socialMedia = []
      const otherResults = []

      // Normalize company name for matching
      const normalizedCompanyName = companyName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
      
      for (const item of data.items) {
        const title = item.title || ''
        const snippet = item.snippet || ''
        const link = item.link || ''
        const displayLink = item.displayLink || ''
        
        // Skip if we've seen this URL before
        if (seenUrls.has(link)) {
          continue
        }
        seenUrls.add(link)

        // Check for website - be more specific about matching
        const normalizedLink = link.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
        const normalizedDisplayLink = displayLink.toLowerCase().replace(/^www\./, '')
        
        // Better matching: check if company name is in the domain
        // For "GrowSocial Media" we want to match "growsocialmedia" not just "growsocial"
        const companyWords = companyName.toLowerCase().split(/\s+/).filter(w => w.length > 2)
        const allWordsInLink = companyWords.every(word => normalizedLink.includes(word.replace(/[^a-z0-9]/g, '')))
        const exactMatch = normalizedLink.includes(normalizedCompanyName)
        const partialMatch = normalizedLink.includes(normalizedCompanyName.substring(0, Math.max(5, normalizedCompanyName.length - 2)))
        const titleMatch = title.toLowerCase().includes(companyName.toLowerCase())
        
        // Check if email domain matches (strong indicator of correct website)
        // For growsocialmedia.nl email, we want to match growsocialmedia.nl website
        const emailDomainMatch = emailDomain && (
          normalizedLink === emailDomain.toLowerCase().replace(/^www\./, '') || // Exact match
          normalizedLink.includes(emailDomain.toLowerCase().replace(/^www\./, '')) // Contains match
        )
        
        // Score the match quality
        // Email domain match gets ABSOLUTE highest priority (300 points)
        // This ensures growsocialmedia.nl always beats growsocial.com when email is @growsocialmedia.nl
        let matchScore = 0
        if (emailDomainMatch) {
          // Check if it's an exact match (growsocialmedia.nl === growsocialmedia.nl)
          const exactEmailMatch = normalizedLink === emailDomain.toLowerCase().replace(/^www\./, '')
          matchScore = exactEmailMatch ? 300 : 250 // Exact email domain match = highest priority
        } else if (exactMatch) matchScore = 100
        else if (allWordsInLink) matchScore = 80
        else if (partialMatch) matchScore = 50
        else if (titleMatch) matchScore = 30
        
        if (matchScore >= 30) {
          // Prioritize .nl domains for Dutch companies (check if user is Dutch based on country or .nl email)
          const isNlDomain = link.includes('.nl')
          const userIsDutch = emailDomain && emailDomain.includes('.nl') // If email is .nl, user is likely Dutch
          const nlBoost = (isNlDomain && userIsDutch) ? 20 : (isNlDomain ? 10 : 0) // Extra boost for .nl if user is Dutch
          const websiteInfo = {
            title,
            link,
            snippet,
            isNlDomain,
            matchScore: matchScore + nlBoost,
            priority: isNlDomain ? 1 : 2,
            emailDomainMatch: emailDomainMatch || false
          }
          websites.push(websiteInfo)
        }

        // Check for Google Reviews - look for Google Maps links or review mentions
        if (link.includes('google.com/maps') ||
            link.includes('google.nl/maps') ||
            (title.toLowerCase().includes('google') && (title.toLowerCase().includes('review') || title.toLowerCase().includes('maps'))) ||
            snippet.toLowerCase().includes('google') && (snippet.toLowerCase().includes('review') || snippet.match(/\d+.*review/i))) {
          
          // Extract review count and rating from snippet if available
          // Look for patterns like "4.9", "4.9/5", "4.9 stars", etc.
          const reviewCountMatch = snippet.match(/(\d+)\s*(?:google\s*)?reviews?/i) || snippet.match(/(\d+)\s*beoordelingen?/i)
          // More precise rating match - look for decimal numbers (4.9, 4.8, etc.) not just any number
          const ratingMatch = snippet.match(/([0-9]\.[0-9])\s*(?:sterren?|\/5|stars?|out\s*of\s*5)/i) || 
                             snippet.match(/([0-9]\.[0-9])\/5/i) ||
                             snippet.match(/([0-9]\.[0-9])\s*stars?/i) ||
                             // Also match standalone decimal ratings like "4.9" near review text
                             (snippet.match(/review/i) && snippet.match(/([0-9]\.[0-9])/))
          
          const reviewInfo = {
            title,
            link,
            snippet,
            reviewCount: reviewCountMatch ? reviewCountMatch[1] : null,
            rating: ratingMatch ? ratingMatch[1] : null
          }
          reviews.push(reviewInfo)
        }

        // Check for social media
        if (link.includes('linkedin.com') ||
            link.includes('facebook.com') ||
            link.includes('instagram.com') ||
            link.includes('twitter.com') ||
            link.includes('x.com') ||
            title.toLowerCase().includes('linkedin') ||
            title.toLowerCase().includes('facebook') ||
            title.toLowerCase().includes('instagram')) {
          socialMedia.push({
            title,
            link,
            snippet,
            platform: link.includes('linkedin') ? 'LinkedIn' :
                     link.includes('facebook') ? 'Facebook' :
                     link.includes('instagram') ? 'Instagram' :
                     link.includes('twitter') || link.includes('x.com') ? 'Twitter/X' : 'Social Media'
          })
        }

        // Other relevant results (bedrijfsgidsen, etc.)
        if (link.includes('bedrijfsgids') ||
            link.includes('123bedrijven') ||
            link.includes('bedrijvengids') ||
            title.toLowerCase().includes('bedrijfsgids')) {
          otherResults.push({
            title,
            link,
            snippet
          })
        }
      }

      // Sort websites by match score (best match first), then by .nl priority
      // Sort websites: email domain matches ALWAYS come first, then by match score
      websites.sort((a, b) => {
        // Email domain matches get absolute priority
        if (a.emailDomainMatch && !b.emailDomainMatch) return -1
        if (!a.emailDomainMatch && b.emailDomainMatch) return 1
        
        // If both or neither have email domain match, sort by match score
        if (b.matchScore !== a.matchScore) {
          return b.matchScore - a.matchScore // Higher score first
        }
        return a.priority - b.priority // .nl first if same score
      })

      // Format results for AI
      if (websites.length > 0) {
        // Include all website matches, but prioritize email domain matches
        websites.forEach((website, index) => {
          // Mark email domain matches explicitly
          const isEmailDomainMatch = website.emailDomainMatch
          const prefix = index === 0 
            ? (isEmailDomainMatch ? '**Website gevonden (matcht met email domein - DE JUISTE WEBSITE)**' : '**Website gevonden**')
            : '**Alternatieve website ' + (index + 1) + (isEmailDomainMatch ? ' (matcht met email domein)' : '') + '**'
          results.push(prefix + ': ' + website.title + '\nURL: ' + website.link + '\n' + website.snippet)
        })
      }

      if (reviews.length > 0) {
        reviews.forEach((review, index) => {
          let reviewInfo = (index === 0 ? '**Google Reviews gevonden**' : '**Google Reviews (extra bron)**') + ': ' + review.title + '\nURL: ' + review.link + '\n' + review.snippet
          if (review.reviewCount || review.rating) {
            reviewInfo += '\n\n**Review Details:**'
            if (review.reviewCount) reviewInfo += '\n- Aantal reviews: ' + review.reviewCount
            if (review.rating) {
              // Ensure we use the exact rating, not rounded
              const exactRating = review.rating
              reviewInfo += '\n- Gemiddelde beoordeling: ' + exactRating + ' sterren (EXACT - niet afronden!)'
            }
          }
          results.push(reviewInfo)
        })
      }

      if (socialMedia.length > 0) {
        socialMedia.forEach((social) => {
          results.push('**' + social.platform + ' gevonden**: ' + social.title + '\nURL: ' + social.link + '\n' + social.snippet)
        })
      }

      // Add other results
      otherResults.forEach((other) => {
        results.push('**Bedrijfsgids/Verwijzing**: ' + other.title + '\nURL: ' + other.link + '\n' + other.snippet)
      })

      // If we still don't have enough results, add some general ones
      if (results.length < 3) {
        for (const item of data.items.slice(0, 3)) {
          if (!seenUrls.has(item.link)) {
            results.push('- ' + item.title + '\n  ' + item.snippet + '\n  ' + item.link)
            seenUrls.add(item.link)
          }
        }
      }

      if (results.length === 0) {
        return null
      }

      // Use OpenAI to summarize the search results
      if (this.isOpenAIAvailable()) {
        try {
          const openai = this.getOpenAIClient()
          if (openai) {
            const summaryPrompt = 'Je hebt de volgende Google zoekresultaten gevonden voor het bedrijf "' + companyName + '":\n\n' +
              results.join('\n\n') + '\n\n' +
              'BELANGRIJK: Analyseer de zoekresultaten GRONDIG en geef een gedetailleerde samenvatting (250-350 woorden) met:\n\n' +
              '1. **Website** (ZEER BELANGRIJK - kies de JUISTE website):\n' +
              '   - **ABSOLUTE PRIORITEIT**: Als het email domein van de gebruiker een website domein is (bijv. email@growsocialmedia.nl betekent dat growsocialmedia.nl DE JUISTE website is, NIET growsocial.com), gebruik DIT als de primaire website\n' +
              '   - Als er meerdere websites zijn gevonden, de website die matcht met het email domein is ALTIJD de juiste, ongeacht andere matches\n' +
              '   - Voor Nederlandse bedrijven: .nl domains hebben meestal prioriteit\n' +
              '   - Als er meerdere websites zijn, vermeld de JUISTE website als primair (de website die matcht met het email domein)\n' +
              '   - Vermeld de exacte URL van de JUISTE website\n' +
              '   - Als er een alternatieve website is gevonden die NIET matcht met het email domein, vermeld dit ook maar zeg duidelijk welke de JUISTE is (degene die matcht met email domein)\n\n' +
              '2. **Google Reviews** (ZEER BELANGRIJK - zoek hier expliciet naar):\n' +
              '   - Zoek in ALLE resultaten naar Google Maps links, review informatie, sterren, ratings\n' +
              '   - Aantal reviews (bijv. "15 reviews", "50+ reviews", "23 beoordelingen")\n' +
              '   - Gemiddelde beoordeling in sterren - gebruik EXACT de rating zoals gevonden (bijv. "4.9 sterren", "4.8/5", "4.7 stars")\n' +
              '   - BELANGRIJK: Als je "4.9" ziet, zeg NIET "5.0" of "5 sterren" - gebruik de exacte rating\n' +
              '   - Als je deze informatie in de snippet ziet, vermeld het EXACT zoals het er staat\n' +
              '   - Bijvoorbeeld: "Het bedrijf heeft 23 Google Reviews met een gemiddelde beoordeling van 4.9 sterren" (niet 5.0!)\n' +
              '   - Als je Google Maps links ziet, betekent dit meestal dat er reviews zijn\n' +
              '   - Als er meerdere review bronnen zijn, combineer de informatie maar gebruik de exacte ratings\n\n' +
              '3. **Social Media & Online Aanwezigheid** (zoek expliciet naar):\n' +
              '   - LinkedIn, Facebook, Instagram, Twitter/X\n' +
              '   - Als er social media links zijn gevonden, vermeld ze ALLEMAAL met de platform naam\n' +
              '   - Bedrijfsgidsen (123bedrijven.nl, etc.)\n' +
              '   - Andere vermeldingen\n\n' +
              '4. **Bedrijfsleeftijd/Oprichtingsjaar**:\n' +
              '   - VERMIJD dit - we hebben geen betrouwbare bron voor bedrijfsleeftijd\n' +
              '   - Zeg NIET dat het bedrijf "sinds X jaar actief is" tenzij dit expliciet in de zoekresultaten staat\n' +
              '   - Als je geen concrete informatie vindt over oprichtingsjaar, vermeld dit NIET\n\n' +
              'REGELS:\n' +
              '- Wees ZEER grondig - dit bedrijf bestaat en heeft waarschijnlijk online aanwezigheid\n' +
              '- **ABSOLUTE PRIORITEIT**: Als er meerdere websites zijn, de website die matcht met het email domein is ALTIJD de juiste, ongeacht andere matches\n' +
              '- Als er meerdere websites zijn, identificeer de JUISTE website die matcht met het email domein (bijv. email@growsocialmedia.nl = growsocialmedia.nl is de juiste website, NIET growsocial.com)\n' +
              '- **KRITIEK - GOOGLE REVIEWS**: Als je review informatie ziet, MOET je dit EXACT vermelden\n' +
              '- **EXACTE CIJFERS**: Gebruik de EXACTE cijfers zoals ze in de zoekresultaten staan. "4.9" = "4.9 sterren", NIET "5.0"\n' +
              '- **EXACT AANTAL**: Gebruik het EXACTE aantal reviews. "15 reviews" = "15 reviews", NIET "4" of "enkele"\n' +
              '- **ROND NIET AF**: Rond ratings NIET af naar hele getallen. "4.9" blijft "4.9", niet "5.0"\n' +
              '- **LEES CAREFULLY**: Scan de tekst GRONDIG voor exacte cijfers voordat je ze rapporteert\n' +
              '- Als je Google Maps links ziet, betekent dit meestal dat er een Google Business profiel is met reviews\n' +
              '- Als je social media links ziet, vermeld ze ALLEMAAL\n' +
              '- Als er geen review informatie is na grondig zoeken, zeg dat expliciet\n' +
              '- Wees zeer specifiek met cijfers, URLs en jaartallen\n' +
              '- Als je informatie vindt, gebruik het - zeg NIET dat iets ontbreekt als je het wel hebt gevonden'

            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: 'Je bent een expert in het analyseren van zoekresultaten. Geef een duidelijke, gestructureerde samenvatting van de gevonden informatie. Wees beknopt maar compleet.'
                },
                {
                  role: 'user',
                  content: summaryPrompt
                }
              ],
              temperature: 0.3,
              max_tokens: 300 // Reduced for faster response
            })

            return completion.choices[0].message.content.trim()
          }
        } catch (openaiError) {
          console.warn('Error summarizing Google results with OpenAI: ' + openaiError.message)
          // Fall through to return raw results
        }
      }

      // Fallback: return raw results if OpenAI not available
      return '**Online aanwezigheid gevonden voor ' + companyName + ':**\n\n' + results.join('\n\n')
    } catch (error) {
      console.warn('Error in Google Custom Search: ' + error.message)
      return null
    }
  }

  /**
   * Check if profile update should trigger re-evaluation
   * 
   * @param {Object} oldProfile - Previous profile state
   * @param {Object} newProfile - Updated profile state
   * @returns {boolean}
   */
  static shouldReevaluate(oldProfile, newProfile) {
    const relevantFields = [
      'company_name',
      'coc_number',
      'vat_number',
      'email',
      'street',
      'postal_code',
      'city',
      'country',
      'billing_company_name',
      'billing_address',
      'phone'
    ]

    // Check if any relevant field changed
    for (const field of relevantFields) {
      const oldValue = oldProfile[field] || ''
      const newValue = newProfile[field] || ''
      if (oldValue !== newValue) {
        return true
      }
    }

    return false
  }
}

module.exports = UserRiskAssessmentService

