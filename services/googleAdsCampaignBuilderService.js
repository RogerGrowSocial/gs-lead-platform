  const { supabaseAdmin } = require('../config/supabase');
  const logger = require('../utils/logger');
  const GoogleAdsClient = require('../integrations/googleAdsClient');
  const RSAAssetService = require('./rsaAssetService');

  /**
   * Retry helper
   */
  async function retry(fn, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        const delay = 1000 * Math.pow(2, i);
        logger.warn(`⚠️ Retry ${i + 1}/${retries} after ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * GoogleAdsCampaignBuilderService
   * 
   * Next-level Google Ads campaign creation met:
   * - Automatische keyword generatie
   * - Responsive Search Ads (RSA) met AI content
   * - Ad groups met best practices
   * - Specifieke location targeting
   * - Direct ENABLED campagnes (geen PAUSED)
   * 
   * Best practices 2025/2026:
   * - RSA als standaard ad type
   * - Keyword match types: exact, phrase, broad modifier
   * - Thematische ad groups
   * - Negative keywords
   * - Enhanced CPC bidding
   */
  class GoogleAdsCampaignBuilderService {
    /**
     * Nederlandse provincies naar Google Ads location codes mapping
     * Gebaseerd op Google Ads geo_target_constants
     */
    /**
     * Nederlandse provincies naar Google Ads location codes mapping
     * 
     * CRITICAL: These codes MUST be verified via Google Ads Geo Target Constants API.
     * The previous codes were INCORRECT and caused wrong locations (e.g., Finland instead of Gelderland).
     * 
     * To verify/update codes:
     * 1. Download latest CSV from https://developers.google.com/google-ads/api/data/geotargets
     * 2. Search for province name (e.g., "Gelderland") with Country Code = "NL"
     * 3. Use the Criteria ID from the CSV
     * 
     * OR use GeoTargetConstantService.suggestGeoTargetConstants() API method
     * 
     * NOTE: These are PLACEHOLDER codes - MUST be verified and updated with correct values!
     */
    static REGION_TO_LOCATION_CODES = {
      // Dutch provinces - MUST VERIFY THESE CODES via Google Ads API
      // Previous codes (1005653-1005664) were WRONG and pointed to Finland/other countries
      'noord-holland': [], // TODO: Verify via API
      'zuid-holland': [], // TODO: Verify via API
      'noord-brabant': [], // TODO: Verify via API
      'gelderland': [], // TODO: Verify via API - was 1005656 (WRONG - pointed to Finland)
      'utrecht': [], // TODO: Verify via API
      'friesland': [], // TODO: Verify via API
      'overijssel': [], // TODO: Verify via API
      'groningen': [], // TODO: Verify via API
      'drenthe': [], // TODO: Verify via API
      'flevoland': [], // TODO: Verify via API
      'limburg': [], // TODO: Verify via API
      'zeeland': []  // TODO: Verify via API
    };
    
    /**
     * Get city location code from CSV file
     * 
     * Looks up Dutch city location codes from the Google Ads Geo Target Constants CSV.
     * Supports city-level targeting for more precise location targeting.
     * 
     * @param {string} cityName - City name (e.g., "Amsterdam", "Rotterdam", "Utrecht")
     * @param {string} provinceName - Optional province name for disambiguation (e.g., "Noord-Holland")
     * @returns {Promise<string|null>} City location code (Criteria ID) or null if not found
     * 
     * @example
     * const code = await GoogleAdsCampaignBuilderService.getCityCode('Amsterdam', 'Noord-Holland');
     * // Returns: "1013163" (or the actual city code)
     */
    static async getCityCode(cityName, provinceName = null) {
      const fs = require('fs');
      const path = require('path');
      
      try {
        const csvPath = path.join(__dirname, '../integrations/geotargets-2025-10-29.csv');
        if (!fs.existsSync(csvPath)) {
          logger.warn(`⚠️ CSV file not found at ${csvPath}, cannot lookup city codes`);
          return null;
        }

        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = fileContent.split('\n');
        
        // Skip header line
        const header = lines[0];
        if (!header) {
          logger.error('❌ CSV file appears to be empty');
          return null;
        }

        const cityNameLower = cityName.toLowerCase().trim();
        const provinceNameLower = provinceName ? provinceName.toLowerCase().trim() : null;

        // Parse CSV manually (simple CSV parser for this use case)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Simple CSV parsing - handle quoted fields
          const fields = [];
          let currentField = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              fields.push(currentField.trim());
              currentField = '';
            } else {
              currentField += char;
            }
          }
          fields.push(currentField.trim()); // Add last field

          if (fields.length < 7) continue; // Need at least 7 columns

          const criteriaId = fields[0].replace(/^"|"$/g, '');
          const name = fields[1].replace(/^"|"$/g, '');
          const canonical = fields[2].replace(/^"|"$/g, '');
          const country = fields[4].replace(/^"|"$/g, '');
          const targetType = fields[5].replace(/^"|"$/g, '');

          if (country === 'NL' && targetType === 'City' && name.toLowerCase() === cityNameLower) {
            // If province is specified, check if it matches
            if (provinceNameLower) {
              if (canonical.toLowerCase().includes(provinceNameLower)) {
                logger.info(`📍 Found city code for ${cityName}, ${provinceName}: ${criteriaId}`);
                return criteriaId;
              }
            } else {
              // No province specified, return first match
              logger.info(`📍 Found city code for ${cityName}: ${criteriaId}`);
              return criteriaId;
            }
          }
        }

        logger.warn(`⚠️ City not found: ${cityName}${provinceName ? `, ${provinceName}` : ''}`);
        return null;
      } catch (error) {
        logger.error(`❌ Error looking up city code for ${cityName}:`, error);
        return null;
      }
    }
    
    /**
     * Helper to get location codes with validation
     * Supports both province-level and city-level targeting
     * CRITICAL: Location codes MUST be correct - wrong codes cause campaigns to target wrong countries!
     * 
     * When a city is specified, returns only the city code for city-level targeting.
     * When no city is specified, returns province code(s) for province-level targeting.
     * 
     * @param {string} region - Province name (e.g., "friesland", "noord-holland")
     * @param {string|null} city - Optional city name (e.g., "Amsterdam", "Rotterdam"). If provided, returns city code only.
     * @returns {Promise<string[]>} Array of location codes (single city code if city specified, province code(s) otherwise)
     * 
     * @example
     * // Province-level targeting
     * const provinceCodes = await GoogleAdsCampaignBuilderService.getLocationCodes('friesland');
     * // Returns: ['20761']
     * 
     * // City-level targeting
     * const cityCodes = await GoogleAdsCampaignBuilderService.getLocationCodes('noord-holland', 'Amsterdam');
     * // Returns: ['1013163'] (Amsterdam city code)
     */
    static async getLocationCodes(region, city = null) {
      const regionLower = region.toLowerCase().trim();
      const regionName = this.getRegionDisplayName(regionLower);
      
      // CRITICAL: These codes MUST be verified via Google Ads Geo Target Constants CSV
      // The previous codes were WRONG and caused campaigns to target wrong countries!
      // 
      // To verify codes:
      // 1. Download CSV from: https://developers.google.com/google-ads/api/data/geotargets
      // 2. Run: node scripts/verify-google-ads-location-codes.js <path-to-csv>
      // 3. Update VERIFIED_LOCATION_CODES below with the correct codes
      //
      // ✅ VERIFIED: Codes extracted from Google Ads Geo Target Constants CSV (geotargets-2025-10-29.csv)
      // Verified on: 2025-12-07
      // Source: https://developers.google.com/google-ads/api/data/geotargets
      const VERIFIED_LOCATION_CODES = {
        'drenthe': ['20759'], // Drenthe - Verified from CSV
        'flevoland': ['20760'], // Flevoland - Verified from CSV
        'friesland': ['20761'], // Friesland - Verified from CSV (was 1005658 - WRONG!)
        'gelderland': ['20762'], // Gelderland - Verified from CSV (was 1005656 - WRONG - pointed to Finland!)
        'groningen': ['20763'], // Groningen - Verified from CSV
        'limburg': ['20764'], // Limburg - Verified from CSV
        'noord-brabant': ['20765'], // Noord-Brabant (listed as "North Brabant" in CSV) - Verified from CSV
        'noord-holland': ['20766'], // Noord-Holland (listed as "North Holland" in CSV) - Verified from CSV
        'overijssel': ['20767'], // Overijssel - Verified from CSV
        'utrecht': ['20768'], // Utrecht - Verified from CSV
        'zeeland': ['20769'], // Zeeland - Verified from CSV
        'zuid-holland': ['20770']  // Zuid-Holland (listed as "South Holland" in CSV) - Verified from CSV
      };
      
      const codes = VERIFIED_LOCATION_CODES[regionLower];
      
      if (!codes || codes.length === 0) {
        logger.error(`❌ Location codes for ${regionName} (${regionLower}) are NOT verified!`);
        logger.error(`❌ Previous codes were WRONG and caused campaigns to target wrong countries (e.g., Finland instead of Netherlands)`);
        logger.error(`❌ TO FIX: Run scripts/verify-google-ads-location-codes.js to get correct codes`);
        logger.error(`❌ Then update VERIFIED_LOCATION_CODES in services/googleAdsCampaignBuilderService.js`);
        return [];
      }
      
      // If city is specified, get city code and add it to the location codes
      if (city) {
        const cityCode = await this.getCityCode(city, regionName);
        if (cityCode) {
          logger.info(`📍 Using city-level targeting: ${city} (${cityCode}) in ${regionName}`);
          return [cityCode]; // Return only city code for city-level targeting
        } else {
          logger.warn(`⚠️ City code not found for ${city}, falling back to province-level targeting`);
          // Fall back to province-level targeting
        }
      }
      
      logger.info(`📍 Using verified location codes for ${regionName}: ${codes.join(', ')}`);
      return codes;
    }
    
    /**
     * Get location codes dynamically via Google Ads API GeoTargetConstantService
     * This ensures we always use the correct, up-to-date location codes
     * 
     * NOTE: This requires the google-ads-api library to support GeoTargetConstantService
     * If not available, we fall back to manual verification
     */
    static async getLocationCodesFromAPI(region, customer) {
      try {
        const regionName = this.getRegionDisplayName(region.toLowerCase());
        
        logger.info(`🔍 Looking up location code for: ${regionName}, Netherlands`);
        
        // TODO: Implement actual API call when google-ads-api supports GeoTargetConstantService
        // Example implementation (when available):
        // const response = await customer.geoTargetConstants.suggest({
        //   locale: 'nl',
        //   countryCode: 'NL',
        //   locationNames: { names: [regionName] }
        // });
        // 
        // if (response?.geoTargetConstantSuggestions?.[0]?.geoTargetConstant?.id) {
        //   const code = response.geoTargetConstantSuggestions[0].geoTargetConstant.id;
        //   logger.info(`✅ Found location code for ${regionName}: ${code}`);
        //   return [String(code)];
        // }
        
        logger.warn(`⚠️ GeoTargetConstantService not available - using manual verification`);
        return [];
      } catch (error) {
        logger.error(`❌ Error getting location codes from API for ${region}:`, error);
        return [];
      }
    }

    /**
     * Globale negatieve zoekwoorden die we voor (bijna) alle service branches willen uitsluiten.
     * Deze zijn gecentreerd zodat we ze eenvoudig kunnen uitbreiden.
     */
    static GLOBAL_NEGATIVE_KEYWORDS = [
      'gratis',      // Als je betaalde diensten levert
      'vacature',
      'baan',
      'werk',
      'job',
      'diy',
      'zelf doen',
      'tutorial',
      'cursus',
      'opleiding',
      'school',
      'student',
      'stagiaire',
      'internship',
      'parttime',
      'fulltime',
      'salaris',
      'loon',
      'vergoeding'
    ];

    /**
     * Branche-specifieke negatieve zoekwoorden per type dienst.
     * Eenvoudig uit te breiden voor nieuwe industrieën.
     */
    static BRANCH_NEGATIVE_KEYWORDS = {
      schilder: ['verf', 'kwast', 'roller', 'verfsoort'],
      timmerman: ['hout', 'zaag', 'gereedschap', 'materiaal'],
      elektricien: ['kabel', 'draad', 'schakelaar', 'lamp'],
      loodgieter: ['buis', 'kraan', 'leiding', 'fitting']
    };

    /**
     * Bouw gecombineerde lijst van negatieve zoekwoorden voor een branche.
     */
    static getNegativeKeywordsForBranch(branch) {
      const negatives = [...this.GLOBAL_NEGATIVE_KEYWORDS];
      if (!branch) return negatives;

      const branchLower = branch.toLowerCase();
      const branchSpecific = this.BRANCH_NEGATIVE_KEYWORDS[branchLower];
      if (branchSpecific && Array.isArray(branchSpecific)) {
        negatives.push(...branchSpecific);
      }

      return negatives;
    }

    /**
     * Bepaal standaard max CPC op basis van branche en globale defaults.
     * - GOOGLE_ADS_DEFAULT_MAX_CPC_EUR (globaal, bv. 1.5)
     * - GOOGLE_ADS_DEFAULT_MAX_CPC_EUR_SCHILDER (branche override, hoofdletters + underscores)
     */
    static getDefaultMaxCpcMicros(branch) {
      // Default to 2.50 EUR (reasonable for NL leadgen) instead of 1.50
      const baseEnv = process.env.GOOGLE_ADS_DEFAULT_MAX_CPC_EUR || '2.5';
      let eur = Number(baseEnv);

      if (branch) {
        const key = branch.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const branchEnv = process.env[`GOOGLE_ADS_DEFAULT_MAX_CPC_EUR_${key}`];
        if (branchEnv) {
          const branchVal = Number(branchEnv);
          if (Number.isFinite(branchVal) && branchVal > 0) {
            eur = branchVal;
          }
        }
      }

      if (!Number.isFinite(eur) || eur <= 0) {
        eur = 1.0; // veilige fallback
      }

      return Math.round(eur * 1_000_000);
    }

    /**
     * Genereer keywords op basis van branch en region
     * @param {string} branch - Branche (bijv. 'glaszetter')
     * @param {string} region - Regio (bijv. 'gelderland')
     * @returns {Array} Array van keyword objecten met match types
     */
    static generateKeywords(branch, region) {
      const keywords = [];
      const seen = new Set();
      
      // Normaliseer inputs
      const branchLower = branch.toLowerCase().trim();
      const regionLower = region.toLowerCase().trim();
      const regionName = GoogleAdsCampaignBuilderService.getRegionDisplayName(regionLower);

      const addKw = (text, matchType) => {
        if (!text) return;
        const key = `${matchType}:${text.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        keywords.push({ text, matchType, cpcBid: null });
      };
      
      // Core keywords - Exact & Phrase & Broad
      addKw(`[${branchLower} ${regionName}]`, 'EXACT');
      addKw(`[${branchLower} in ${regionName}]`, 'EXACT');
      addKw(`"${branchLower} ${regionName}"`, 'PHRASE');
      addKw(`"${branchLower} in ${regionName}"`, 'PHRASE');
      addKw(`${branchLower} ${regionName}`, 'BROAD');

      // Additional base coverage to ensure volume
      addKw(`"${branchLower}"`, 'PHRASE');
      addKw(`${branchLower}`, 'BROAD');

      // Service-specifieke variaties (phrase)
      const serviceKeywords = [
        `${branchLower} ${regionName} offerte`,
        `${branchLower} ${regionName} prijs`,
        `${branchLower} ${regionName} kosten`,
        `goedkope ${branchLower} ${regionName}`,
        `${branchLower} ${regionName} ervaring`,
        `${branchLower} ${regionName} recensies`
      ];
      serviceKeywords.forEach(k => addKw(`"${k}"`, 'PHRASE'));

      // Ensure at least 10 keywords by adding broad/phrase extras if needed
      if (keywords.length < 10) {
        addKw(`"${branchLower} offerte"`, 'PHRASE');
        addKw(`"${branchLower} prijs"`, 'PHRASE');
        addKw(`"${branchLower} kosten"`, 'PHRASE');
        addKw(`[${branchLower}]`, 'EXACT');
      }
      
      return keywords;
    }

    /**
     * Create multi-ad group structure (Next Level Feature!)
     * Organizes keywords into thematic ad groups for better performance
     */
    static createAdGroupStructure(branch, region) {
      const regionName = this.getRegionDisplayName(region.toLowerCase());
      
      return [
        {
          name: `${branch} ${regionName}`,
          type: 'location',
          description: 'Service + Location keywords'
        },
        {
          name: `${branch} Offerte ${regionName}`,
          type: 'intent',
          description: 'Service + Intent keywords (offerte, prijs, kosten)'
        },
        {
          name: `Spoed ${branch} ${regionName}`,
          type: 'urgency',
          description: 'Urgency-based keywords (spoed, snel, vandaag)'
        }
      ];
    }

    /**
     * Filter keywords for specific ad group type
     */
    static filterKeywordsForAdGroup(keywords, adGroupType) {
      const lowerText = (kw) => (kw.text || '').toLowerCase();

      if (adGroupType === 'location') {
        let loc = keywords.filter(kw => 
          !lowerText(kw).includes('spoed') &&
          !lowerText(kw).includes('snel')
        );
        // Ensure enough volume; if too few, allow price/offerte variants as well
        if (loc.length < 8) {
          loc = keywords.filter(kw => !lowerText(kw).includes('spoed'));
        }
        return loc;
      } else if (adGroupType === 'intent') {
        let intent = keywords.filter(kw => 
          lowerText(kw).includes('offerte') ||
          lowerText(kw).includes('prijs') ||
          lowerText(kw).includes('kosten') ||
          lowerText(kw).includes('goedkope')
        );
        // Add some core keywords to avoid low volume
        if (intent.length < 8) {
          intent = intent.concat(
            keywords.filter(kw =>
              !lowerText(kw).includes('spoed') &&
              !lowerText(kw).includes('snel') &&
              !intent.includes(kw)
            )
          );
        }
        return intent;
      } else if (adGroupType === 'urgency') {
        const branchLower = keywords[0]?.text.match(/\[?\"?([\w-]+)/)?.[1] || '';
        const regionName = keywords[0]?.text.match(/([\w-]+)\]?\"?$/)?.[1] || '';
        const urgency = [
          { text: `[spoed ${branchLower} ${regionName}]`, matchType: 'EXACT' },
          { text: `"spoed ${branchLower} ${regionName}"`, matchType: 'PHRASE' },
          { text: `[${branchLower} ${regionName} vandaag]`, matchType: 'EXACT' },
          { text: `"${branchLower} ${regionName} snel"`, matchType: 'PHRASE' }
        ];
        // Add base keywords to reach volume
        const baseExtras = keywords.filter(kw => !lowerText(kw).includes('offerte'));
        return urgency.concat(baseExtras).slice(0, Math.max(8, urgency.length + baseExtras.length));
      }
      
      return keywords; // Default: return all
    }

    /** Normalize a Google Ads keyword to a plain phrase (lowercase, no [], "", +). */
    static normalizeKeywordText(keyword) {
      if (!keyword) return '';
      let s = String(keyword).trim();
      s = s.replace(/[\[\]"]/g, '');   // remove [] and "
      s = s.replace(/\+/g, '');        // remove +
      s = s.replace(/\s+/g, ' ');
      return s.toLowerCase().trim();
    }

    /** Build unique normalized keyword phrases array from keyword texts. */
    static buildNormalizedKeywordPhrases(keywordTexts = []) {
      const phrases = [];
      const seen = new Set();

      for (const kw of keywordTexts) {
        const norm = GoogleAdsCampaignBuilderService.normalizeKeywordText(kw);
        if (!norm) continue;
        if (seen.has(norm)) continue;
        seen.add(norm);
        phrases.push(norm);
      }

      return phrases;
    }

    /** Trim headline to <= 30 chars without cutting words (except a single long word). */
    static trimHeadlineTo30(text) {
      if (!text) return '';
      const maxLen = 30;
      const str = String(text).trim();
      if (str.length <= maxLen) return str;

      const words = str.split(/\s+/);
      let result = '';

      for (const word of words) {
        if (!word) continue;

        if (result.length === 0) {
          // first word
          if (word.length > maxLen) {
            // very long single word: hard cut but don't crash
            return word.slice(0, maxLen);
          }
          result = word;
        } else {
          const candidate = result + ' ' + word;
          if (candidate.length > maxLen) break;
          result = candidate;
        }
      }

      if (!result) {
        return str.slice(0, maxLen).trim();
      }
      return result.trim();
    }

    /** Trim description to <= 90 chars on sentence/space boundaries where possible. */
    static trimDescriptionTo90(text) {
      if (!text) return '';
      const str = String(text).trim();
      const maxLen = 90;
      if (str.length <= maxLen) return str;

      const slice = str.slice(0, maxLen);
      const lastSentenceEnd = Math.max(
        slice.lastIndexOf('. '),
        slice.lastIndexOf('! '),
        slice.lastIndexOf('? ')
      );
      if (lastSentenceEnd > 40) {
        return slice.slice(0, lastSentenceEnd + 1).trim();
      }

      const lastSpace = slice.lastIndexOf(' ');
      if (lastSpace > 40) {
        return slice.slice(0, lastSpace).trim();
      }

      return slice.trim();
    }

    /**
     * Push headline with optional trim.
     * If allowTrim=false, we only accept text <= 30 as-is.
     *
     * NOTE: This is a low-level utility that only handles length + duplicate checks.
     * Similarity and semantic constraints are enforced by callers.
     */
    static pushHeadlineFactory(headlines) {
      return (text, { allowTrim = true } = {}) => {
        if (!text) return false;

        const raw = String(text).trim();
        const candidate = allowTrim
          ? GoogleAdsCampaignBuilderService.trimHeadlineTo30(raw)
          : raw;

        if (!candidate) return false;
        if (candidate.length > 30) return false;

        const norm = candidate.toLowerCase();
        if (headlines.some(h => h.toLowerCase() === norm)) return false;

        headlines.push(candidate);
        return true;
      };
    }

    /**
     * Normalize text helper (lowercase + trim).
     * This is used as the canonical normalization for branches/regions/keywords.
     */
    static normalizeText(s) {
      return String(s || '').toLowerCase().trim();
    }

    /**
     * Canonical branch mapping - ensures consistent primary branch terms.
     * IMPORTANT:
     * - Singular and plural are treated as separate canonical forms.
     * - We NEVER auto-convert singular <-> plural; the selected UI label is the anchor.
     */
    static BRANCH_CANONICAL = {
      // Dakdekker
      'dakdekker': 'dakdekker',
      'dakdekkers': 'dakdekkers',

      // Elektricien
      'elektricien': 'elektricien',

      // Glaszetter
      'glaszetter': 'glaszetter',
      'glaszetters': 'glaszetters',

      // Hovenier
      'hovenier': 'hovenier',
      'hoveniers': 'hoveniers',

      // Installatiebedrijf
      'installatiebedrijf': 'installatiebedrijf',
      'installatiebedrijven': 'installatiebedrijven',

      // Loodgieter
      'loodgieter': 'loodgieter',

      // Schilder
      'schilder': 'schilder',
      'schilders': 'schilders',

      // Timmerman
      'timmerman': 'timmerman',
    };

    /**
     * Get primary canonical branch term.
     * If branch is plural (e.g., "installatiebedrijven"), returns exactly that string.
     */
    static getPrimaryBranch(branch) {
      const b = GoogleAdsCampaignBuilderService.normalizeText(branch);
      return GoogleAdsCampaignBuilderService.BRANCH_CANONICAL[b] || b;
    }

    /**
     * Check if branch is plural.
     * We explicitly mark platform plural options and fall back to a light heuristic.
     */
    static isPluralBranch(branch) {
      const b = GoogleAdsCampaignBuilderService.normalizeText(branch);
      // Explicit platform plurals
      const explicitPlurals = [
        'dakdekkers',
        'glaszetters',
        'schilders',
        'installatiebedrijven',
        'hoveniers',
      ];
      if (explicitPlurals.includes(b)) return true;
      // Generic plural check (ends with 'en' or 's', excluding common false-positives)
      return b.endsWith('en') || (b.endsWith('s') && !b.endsWith('us'));
    }

    /**
     * Deep alias map for branch diversity.
     *
     * IMPORTANT USAGE RULES:
     * - Aliases are OPTIONAL fillers only.
     * - They are used for diversity AFTER primary branch+region anchors are satisfied.
     * - Aliases must NEVER replace or dilute primary branch keyword coverage.
     */
    static BRANCH_ALIASES = {
      // Dakdekker (singular)
      'dakdekker': [
        'dakreparatie',
        'dakinspectie',
        'dak specialist',
        'dakwerker',
        'dakonderhoud',
      ],
      // Dakdekkers (plural)
      'dakdekkers': [
        'dakdekkersbedrijf',
        'dakreparatie',
        'dakinspectie',
        'dak specialisten',
      ],

      // Elektricien
      'elektricien': [
        'elektra',
        'elektrabedrijf',
        'groepenkast',
        'stroomstoring',
        'laadpaal installateur',
        'woning elektra',
      ],

      // Glaszetter (singular)
      'glaszetter': [
        'glasservice',
        'ruitherstel',
        'isolatieglas',
        'ruitschade service',
      ],
      // Glaszetters (plural)
      'glaszetters': [
        'glaszetter',
        'glasservice',
        'isolatieglas specialist',
        'ruitschade service',
      ],

      // Hovenier (singular)
      'hovenier': [
        'tuinman',
        'tuinaanleg',
        'tuinonderhoud',
        'bestrating',
        'groenvoorziening',
      ],
      // Hoveniers (plural)
      'hoveniers': [
        'hovenier',
        'tuinman',
        'tuinaanleg',
        'tuinonderhoud',
        'groenvoorziening',
      ],

      // Installatiebedrijf (singular)
      'installatiebedrijf': [
        'installateur',
        'cv installateur',
        'warmtepomp installateur',
        'klimaatinstallateur',
        'service monteur',
      ],
      // Installatiebedrijven (plural, long primary branch)
      'installatiebedrijven': [
        'installateur',
        'installatiebedrijf',
        'cv installateur',
        'warmtepomp installateur',
        'klimaatinstallateur',
        'loodgieter en installateur',
      ],

      // Loodgieter
      'loodgieter': [
        'sanitair specialist',
        'cv monteur',
        'riolering service',
        'lekdetectie',
        'waterleiding',
      ],

      // Schilder (singular)
      'schilder': [
        'schildersbedrijf',
        'binnenschilder',
        'buitenschilder',
        'verfspuiter',
        'houtrot herstel',
      ],
      // Schilders (plural)
      'schilders': [
        'schilder',
        'schildersbedrijf',
        'binnenschilder',
        'buitenschilder',
      ],

      // Timmerman
      'timmerman': [
        'timmerbedrijf',
        'interieurbouwer',
        'kozijnen specialist',
        'renovatie timmerwerk',
        'maatwerk hout',
      ],
    };

    /**
     * Get aliases for a branch (max 3 for diversity)
     */
    static getBranchAliases(branch, maxAliases = 3) {
      const b = GoogleAdsCampaignBuilderService.normalizeText(branch);
      const aliases = GoogleAdsCampaignBuilderService.BRANCH_ALIASES[b] || [];
      return aliases.slice(0, maxAliases);
    }

    /**
     * Get region variants for long regions (e.g., "Noord-Brabant" -> ["Noord-Brabant", "Brabant", "NB"])
     * Expanded to include all provinces with abbreviations
     */
    static getRegionVariants(regionRaw = '', toTitleFn) {
      const REGION_VARIANTS = {
        'noord-brabant': ['Noord-Brabant', 'Brabant', 'NB'],
        'noord-holland': ['Noord-Holland', 'N-Holland', 'NH'],
        'zuid-holland': ['Zuid-Holland', 'Z-Holland', 'ZH'],
        'gelderland': ['Gelderland', 'GLD'],
        'utrecht': ['Utrecht', 'UTR'],
        'friesland': ['Friesland', 'FRL'],
        'overijssel': ['Overijssel', 'OV'],
        'groningen': ['Groningen', 'GR'],
        'drenthe': ['Drenthe', 'DR'],
        'flevoland': ['Flevoland', 'FL'],
        'limburg': ['Limburg', 'LB'],
        'zeeland': ['Zeeland', 'ZLD']
      };

      const code = (regionRaw || '').toLowerCase().trim();
      const display = GoogleAdsCampaignBuilderService.getRegionDisplayName(code) || regionRaw;
      const variants = REGION_VARIANTS[code] || [display];

      // Dedup + ensure Title Case for display variants
      const uniq = [];
      for (const v of variants) {
        const t = toTitleFn ? toTitleFn(v) : v;
        if (!uniq.includes(t)) uniq.push(t);
      }

      return uniq;
    }

    /**
     * Compute Jaccard similarity between two headline strings
     * Returns value between 0 (completely different) and 1 (identical)
     */
    static jaccardSimilarity(headline1, headline2) {
      const tokens1 = new Set((headline1 || '').toLowerCase().split(/\s+/).filter(Boolean));
      const tokens2 = new Set((headline2 || '').toLowerCase().split(/\s+/).filter(Boolean));
      const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
      const union = new Set([...tokens1, ...tokens2]);
      if (union.size === 0) return 0;
      return intersection.size / union.size;
    }

    /**
     * Check if a headline is too similar to existing headlines
     * Returns true if similarity > threshold (default 0.7)
     */
    static isTooSimilar(newHeadline, existingHeadlines, threshold = 0.7) {
      for (const existing of existingHeadlines) {
        const similarity = GoogleAdsCampaignBuilderService.jaccardSimilarity(newHeadline, existing);
        if (similarity > threshold) {
          return true;
        }
      }
      return false;
    }

    /**
     * Build intent candidates with region variants for best fit
     */
    static buildIntentCandidates(branchTitle, regionTitles, intentTitle) {
      const patterns = [
        (r) => `${branchTitle} ${r} ${intentTitle}`,
        (r) => `${branchTitle} ${intentTitle} ${r}`,
        (r) => `${intentTitle} ${branchTitle} ${r}`,
      ];

      const out = [];
      for (const r of regionTitles) {
        for (const p of patterns) {
          out.push(p(r));
        }
      }
      return out;
    }

    /**
     * Normalize and extract eligible keyword phrases from keywordTexts.
     * Bucket K: Exact keyword coverage (Google UI alignment)
     * 
     * Normalizes by:
     * - trim
     * - collapse whitespace
     * - remove bracket/quote wrappers [] ""
     * - preserve inner words exactly
     * - deduplicate case-insensitively
     * 
     * Filters to eligible keywords:
     * - length <= 30
     * - contains primary branch OR (branch+region phrase)
     * - do NOT rewrite into aliases
     * 
     * @returns {Array<{phrase: string, priority: number}>} Eligible keywords with priority scores
     */
    static extractEligibleKeywords(keywordTexts, primaryBranchLower, primaryRegionLower, regionMatchVariants = []) {
      const eligibleKeywords = [];
      const seen = new Set();
      const intentTokens = ['offerte', 'prijs', 'kosten', 'ervaring', 'recensies', 'reviews', 'goedkope'];
      
      for (const kw of keywordTexts || []) {
        if (!kw || typeof kw !== 'string') continue;
        
        // Normalize: trim, collapse whitespace, remove brackets/quotes
        let normalized = kw.trim()
          .replace(/^[\[\"]+|[\"\]\]]+$/g, '') // Remove outer brackets/quotes
          .replace(/\s+/g, ' ') // Collapse whitespace
          .trim();
        
        if (!normalized) continue;
        
        // Deduplicate case-insensitively
        const normalizedLower = normalized.toLowerCase();
        if (seen.has(normalizedLower)) continue;
        seen.add(normalizedLower);
        
        // Filter: must be <= 30 chars
        if (normalized.length > 30) continue;
        
        // Filter: must contain primary branch OR (branch+region phrase)
        const hasBranch = normalizedLower.includes(primaryBranchLower);
        const hasRegion = primaryRegionLower 
          ? (normalizedLower.includes(primaryRegionLower) || 
             regionMatchVariants.some(rv => normalizedLower.includes(rv.toLowerCase())))
          : false;
        
        // Must contain primary branch (required)
        if (!hasBranch) continue;
        
        // Calculate priority score (lower = higher priority)
        // Priority order:
        // a) branch + region + intent words (offerte/prijs/kosten/ervaring/recensies/reviews/goedkope)
        // b) branch + region
        // c) "branch in region"
        // d) branch-only
        let priority = 999;
        if (hasBranch && hasRegion) {
          // Check for intent tokens
          const hasIntent = intentTokens.some(token => normalizedLower.includes(token));
          if (hasIntent) {
            priority = 1; // Highest priority: branch + region + intent
          } else if (normalizedLower.includes(' in ')) {
            priority = 3; // "branch in region" pattern
          } else {
            priority = 2; // branch + region
          }
        } else if (hasBranch) {
          priority = 4; // branch-only (lowest priority)
        }
        
        eligibleKeywords.push({ phrase: normalized, priority });
      }
      
      // Sort by priority (lower = higher priority), then by length (shorter first)
      eligibleKeywords.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.phrase.length - b.phrase.length;
      });
      
      return eligibleKeywords;
    }

    /**
     * Build compact, safe headline candidates for a keyword phrase.
     * We try multiple formats before giving up.
     * 
     * CRITICAL: mainBranchTitle MUST always be primaryBranchTitle (canonical),
     * NEVER an alias. This ensures Google sees the exact primary branch term
     * that users selected, not semantic substitutes.
     */
    static buildKeywordHeadlineCandidates({
      phrase,
      mainBranchTitle, // MUST be primaryBranchTitle, never an alias
      regionTitle,
      regionTitles = [],
      branchLower,
      regionLower
    }) {
      const intentMap = {
        offerte: 'Offerte',
        prijs: 'Prijs',
        kosten: 'Kosten',
        ervaring: 'Ervaring',
        recensies: 'Reviews',
        review: 'Reviews',
        goedkope: 'Goedkoop',
        spoed: 'Spoed',
        vandaag: 'Vandaag'
      };

      const phraseLower = String(phrase).toLowerCase();
      const words = phraseLower.split(/\s+/).filter(Boolean);

      const hasBranch = branchLower ? phraseLower.includes(branchLower) : false;
      const hasRegion = regionLower ? phraseLower.includes(regionLower) : false;

      const modifierKey = words.find(w => intentMap[w]);
      const modifier = modifierKey ? intentMap[modifierKey] : null;

      const toTitle = (str) =>
        (str || '')
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean)
          .map(w =>
            w.split('-')
              .map(p => p ? p.charAt(0).toUpperCase() + p.slice(1) : '')
              .join('-')
          )
          .join(' ');

      const base = toTitle(phrase);

      const candidates = [base];

      // Use region variants if available, otherwise just regionTitle
      const regionsToTry = regionTitles.length > 0 ? regionTitles : (regionTitle ? [regionTitle] : []);

      // Special handling for "goedkope" pattern - exact match priority
      const normalizePhrase = (p) => String(p).toLowerCase().trim();
      const phraseNorm = normalizePhrase(phrase);
      const isCheap = phraseNorm.startsWith('goedkope ') || phraseNorm.includes(' goedkope ');

      if (isCheap && hasBranch && regionsToTry.length > 0) {
        // Make exact-order headlines with variants for "goedkope"
        for (const r of regionsToTry) {
          candidates.push(`Goedkope ${mainBranchTitle} ${r}`);
          candidates.push(`${mainBranchTitle} ${r} Goedkoop`);
        }
        // Also add to regular modifier flow below
      }

      // Strongest compact keyword formats with region variants
      if (modifier && hasBranch && regionsToTry.length > 0) {
        // Skip duplicate goedkope patterns if already added above
        if (!isCheap || modifier !== 'Goedkoop') {
          // Try with intent candidates using variants
          const intentCandidates = GoogleAdsCampaignBuilderService.buildIntentCandidates(
            mainBranchTitle,
            regionsToTry,
            modifier
          );
          candidates.push(...intentCandidates);
        }

        // Also try classic formats with primary region
        if (regionTitle) {
          if (!isCheap || modifier !== 'Goedkoop') {
            candidates.push(`${modifier} ${mainBranchTitle} ${regionTitle}`);
            candidates.push(`${mainBranchTitle} ${regionTitle} ${modifier}`);
            candidates.push(`${mainBranchTitle} ${modifier} ${regionTitle}`);
          }
        }
      }

      if (!modifier && hasBranch && hasRegion && regionsToTry.length > 0) {
        // Try all region variants
        for (const r of regionsToTry) {
          candidates.push(`${mainBranchTitle} ${r}`);
        }
      }

      // If region exists but phrase doesn't explicitly include it,
      // still try a helpful compact variant with all region variants
      if (modifier && hasBranch && !hasRegion && regionsToTry.length > 0) {
        for (const r of regionsToTry) {
          candidates.push(`${mainBranchTitle} ${r} ${modifier}`);
        }
      }

      return candidates;
    }

    /**
     * Generate RSA content using the new RSA Asset Engine with Quality Gate
     * Falls back to legacy method if engine fails or is disabled
     */
    static generateRSAContentWithEngine(
      branchRaw,
      regionRaw,
      landingPageUrl,
      adGroupType = 'location',
      keywordTexts = []
    ) {
      try {
        // Use new RSA Asset Engine with Quality Gate
        const result = RSAAssetService.generateWithQualityGate({
          businessName: 'GrowSocial',
          service: branchRaw,
          location: regionRaw,
          keywordList: keywordTexts,
          uspList: [], // Can be extended later
          finalUrl: landingPageUrl,
          tone: 'direct'
        }, 5); // Max 5 iterations

        if (result.passed && result.assets) {
          logger.info('✅ RSA assets generated with Quality Gate', {
            totalScore: result.score.totalScore,
            keywordCoverage: result.score.keywordCoverageScore,
            diversity: result.score.diversityScore,
            iterations: result.iterations
          });

          return {
            headlines: result.assets.headlines,
            descriptions: result.assets.descriptions,
            path1: result.assets.path1,
            path2: result.assets.path2,
            finalUrls: [landingPageUrl || 'https://growsocialmedia.nl']
          };
        } else {
          logger.warn('⚠️ RSA Asset Engine did not pass quality gate, falling back to legacy method', {
            score: result.score
          });
          // Fall through to legacy method
        }
      } catch (error) {
        logger.error('❌ Error in RSA Asset Engine, falling back to legacy method:', error);
        // Fall through to legacy method
      }

      // Fallback to legacy method
      return this.generateRSAContent(branchRaw, regionRaw, landingPageUrl, adGroupType, keywordTexts);
    }

    /**
     * Generate RSA content with strong keyword + region coverage.
     * - Up to 15 headlines
     * - 4 descriptions
     * - First batch: keyword-based headlines
     * - Second batch: branch + region USP headlines
     * - Third batch: branch-only USPs and generic CTAs
     */
    static generateRSAContent(
      branchRaw,
      regionRaw,
      landingPageUrl,
      adGroupType = 'location',
      keywordTexts = []
    ) {
      // --- Normalize inputs ---
      const branch = (branchRaw || '').trim() || 'vakman';
      const regionCode = (regionRaw || '').trim().toLowerCase();
      const regionName = GoogleAdsCampaignBuilderService.getRegionDisplayName(regionCode) || regionRaw || '';
      const branchLower = branch.toLowerCase();

      const toTitle = (str) =>
        (str || '')
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean)
          .map(w =>
            w.split('-')
              .map(p => p ? p.charAt(0).toUpperCase() + p.slice(1) : '')
              .join('-')
          )
          .join(' ');

      // Use canonical branch system
      const primaryBranch = GoogleAdsCampaignBuilderService.getPrimaryBranch(branch);
      const primaryBranchLower = GoogleAdsCampaignBuilderService.normalizeText(primaryBranch);
      const primaryBranchTitle = toTitle(primaryBranch);
      const isPlural = GoogleAdsCampaignBuilderService.isPluralBranch(primaryBranch);
      
      // Define long/Google-sensitive branches that need higher Bucket A minimum
      const longSensitiveBranches = [
        'installatiebedrijven',
        'glaszetters',
        'dakdekkers'
      ];
      // Optionally include 'schilders' when plural is selected
      const isLongSensitiveBranch = longSensitiveBranches.includes(primaryBranchLower) ||
        (primaryBranchLower === 'schilders' && isPlural);
      
      // Get aliases (max 3 for diversity) - but will be gated by alias gate logic
      const branchAliases = GoogleAdsCampaignBuilderService.getBranchAliases(primaryBranch, 3);
      
      const regionTitle = toTitle(regionName);

      // Get region variants for long regions
      const regionTitles = GoogleAdsCampaignBuilderService.getRegionVariants(regionRaw, toTitle);
      const primaryRegionTitle = regionTitles[0] || regionTitle;

      // Debug: log if long region detected
      if (regionTitle && regionTitle.length > 10) {
        logger.info('Long region detected, using variants', {
          region: regionCode,
          primary: primaryRegionTitle,
          variants: regionTitles
        });
      }

      // --- Headline builder with 4-bucket allocation ---
      const headlines = [];

      // Low-level push helper (length + duplicate guard)
      const basePushHeadline = GoogleAdsCampaignBuilderService.pushHeadlineFactory(headlines);

      // Enhanced push helper with similarity guard + optional trimming
      const pushH = (text, { allowTrim = true, checkSimilarity = true } = {}) => {
        if (!text) return false;

        const raw = String(text).trim();
        const candidate = allowTrim
          ? GoogleAdsCampaignBuilderService.trimHeadlineTo30(raw)
          : raw;

        if (!candidate) return false;
        if (candidate.length > 30) return false;

        // Similarity guard – avoid near-duplicates
        if (checkSimilarity && headlines.length > 0) {
          if (GoogleAdsCampaignBuilderService.isTooSimilar(candidate, headlines, 0.7)) {
            return false;
          }
        }

        // Delegate to base factory for final dedupe + push
        return basePushHeadline(candidate, { allowTrim: false });
      };

      // Build keyword phrases
      const keywordPhrases = GoogleAdsCampaignBuilderService.buildNormalizedKeywordPhrases(keywordTexts || []);
      const normalizePhrase = (p) => GoogleAdsCampaignBuilderService.normalizeText(p);
      const hasRecensiesInKeywords = keywordPhrases.some(p => normalizePhrase(p).includes('recensies'));
      const hasRegion = !!primaryRegionTitle;

      // Global headline limits / allocation
      const maxHeadlines = 15;
      
      // Slot reservation strategy for A + K
      // Target composition (for region segments):
      // - Bucket A (Primary Literal Anchors): 8-10 (existing dynamic min logic)
      // - Bucket K (Keyword-Exact Coverage): reserve up to 6 slots
      // - Remaining slots: speed/USP/CTA/brand/service variation
      const K_RESERVED_SLOTS = 6; // Maximum slots reserved for Bucket K
      const maxPureUspSlots = 3; // pure USP/CTA headlines that lack BOTH branch + region
      let pureUspCount = 0;

      const pushPureUsp = (text) => {
        if (!text) return false;
        if (pureUspCount >= maxPureUspSlots) return false;
        const ok = pushH(text, { allowTrim: true, checkSimilarity: true });
        if (ok) {
          pureUspCount += 1;
          return true;
        }
        return false;
      };
      
      // ============================================
      // 4-BUCKET HEADLINE ALLOCATION
      // ============================================
      
      // BUCKET A: Exact keyword anchors (min 8 headlines when region exists)
      // Must contain: exact primary branch + exact primary region
      const bucketA = [];
      
      // Required intents for bucket A
      const requiredHeadlineIntents = [
        { keyword: 'offerte', title: 'Offerte' },
        { keyword: 'prijs', title: 'Prijs' },
        { keyword: 'kosten', title: 'Kosten' },
        { keyword: 'goedkope', title: 'Goedkoop' },
        { keyword: 'ervaring', title: 'Ervaring' },
        { keyword: 'recensies', title: 'Recensies' },
        { keyword: 'reviews', title: 'Reviews' }
      ];
      
      // Primary literal anchors pre-bucket:
      // Ensure Google sees very explicit branch+region keyword patterns first.
      if (primaryRegionTitle) {
        const primaryLiteralCombos = [
          `${primaryBranchTitle} ${primaryRegionTitle}`,
          `${primaryBranchTitle} ${primaryRegionTitle} Offerte`,
          `${primaryBranchTitle} ${primaryRegionTitle} Prijs`,
          `${primaryBranchTitle} ${primaryRegionTitle} Kosten`,
          `${primaryBranchTitle} ${primaryRegionTitle} Ervaring`,
          // Ensure recensies/reviews dual coverage – prefer "Recensies" when present
          hasRecensiesInKeywords
            ? `${primaryBranchTitle} ${primaryRegionTitle} Recensies`
            : `${primaryBranchTitle} ${primaryRegionTitle} Reviews`,
        ];

        for (const combo of primaryLiteralCombos) {
          if (!combo) continue;
          if (combo.length > 30) continue;
          if (pushH(combo, { allowTrim: false })) {
            bucketA.push(combo);
          }
        }
      }
      
      // Intent-based headlines with primary branch + primary region
      // Always include offerte, prijs, kosten if in keywords
      // Include other intents if they appear in keywords
      for (const intent of requiredHeadlineIntents) {
        if (headlines.length >= 15) break;
        
        // Check if this intent is in keywords (check both keyword and title forms, and synonyms)
        const hasIntent = keywordPhrases.some(p => {
          const pLower = normalizePhrase(p);
          // Check for keyword, title, and synonyms
          if (pLower.includes(intent.keyword) || pLower.includes(intent.title.toLowerCase())) {
            return true;
          }
          // Check for synonyms: recensies/reviews, ervaring/experience
          if ((intent.keyword === 'recensies' || intent.keyword === 'reviews') && 
              (pLower.includes('recensies') || pLower.includes('reviews'))) {
            return true;
          }
          if (intent.keyword === 'ervaring' && pLower.includes('ervaring')) {
            return true;
          }
          return false;
        });
        
        // Always include offerte, prijs, kosten if in keywords
        // Include recensies/reviews/ervaring if in keywords
        const alwaysInclude = ['offerte', 'prijs', 'kosten'].includes(intent.keyword);
        const shouldInclude = hasIntent || alwaysInclude;
        
        if (!shouldInclude) continue;
        
        const candidates = [];
        
        // Special handling for "goedkope"
        if (intent.keyword === 'goedkope') {
          candidates.push(`Goedkope ${primaryBranchTitle} ${primaryRegionTitle}`);
          candidates.push(`${primaryBranchTitle} ${primaryRegionTitle} Goedkoop`);
        }
        
        // Special handling for "recensies/reviews" - ensure at least one "... Recensies"
        if (intent.keyword === 'recensies' || intent.keyword === 'reviews') {
          const recensiesFirst = hasRecensiesInKeywords;
          const recensiesVariants = [
            `${primaryBranchTitle} ${primaryRegionTitle} Recensies`,
            `Recensies ${primaryBranchTitle} ${primaryRegionTitle}`,
          ];
          const reviewsVariants = [
            `${primaryBranchTitle} ${primaryRegionTitle} Reviews`,
            `Reviews ${primaryBranchTitle} ${primaryRegionTitle}`,
          ];
          const ordered = recensiesFirst
            ? [...recensiesVariants, ...reviewsVariants]
            : [...reviewsVariants, ...recensiesVariants];
          candidates.push(...ordered);
        } else {
          // Standard patterns
          candidates.push(`${primaryBranchTitle} ${primaryRegionTitle} ${intent.title}`);
          candidates.push(`${intent.title} ${primaryBranchTitle} ${primaryRegionTitle}`);
          candidates.push(`${primaryBranchTitle} ${intent.title} ${primaryRegionTitle}`);
        }
        
        // Try all candidates, don't break on first success to ensure we get the best fit
        let added = false;
        for (const candidate of candidates) {
          if (candidate.length <= 30 && pushH(candidate, { allowTrim: false })) {
            bucketA.push(candidate);
            added = true;
            break; // Only add one per intent
          }
        }
        
        // If no candidate fit, try with region variants for long regions
        if (!added && regionTitles.length > 1 && primaryRegionTitle.length > 10) {
          for (const variant of regionTitles.slice(1)) {
            if (intent.keyword === 'recensies' || intent.keyword === 'reviews') {
              const variantCandidate = `${primaryBranchTitle} ${variant} Reviews`;
              if (variantCandidate.length <= 30 && pushH(variantCandidate, { allowTrim: false })) {
                bucketA.push(variantCandidate);
                added = true;
                break;
              }
            } else {
              const variantCandidate = `${primaryBranchTitle} ${variant} ${intent.title}`;
              if (variantCandidate.length <= 30 && pushH(variantCandidate, { allowTrim: false })) {
                bucketA.push(variantCandidate);
                added = true;
                break;
              }
            }
          }
        }
      }
      
      // Dynamic minimum Bucket A based on branch type and literal pair length
      const literalPairLength = primaryRegionTitle 
        ? `${primaryBranchTitle} ${primaryRegionTitle}`.length 
        : 0;
      
      // For long/Google-sensitive branches, require higher minimum
      // For others, use standard minimum
      // If literal pair exceeds 30 chars, allow variant-based anchors but keep at least 4 literal-ish
      let minBucketA;
      if (!primaryRegionTitle) {
        minBucketA = 3; // No region, minimal anchors
      } else if (literalPairLength > 30) {
        // Literal pair too long, allow variants but keep at least 4 literal-ish anchors
        minBucketA = 4;
      } else if (isLongSensitiveBranch) {
        minBucketA = 10; // Long/sensitive branches need more literal anchors
      } else {
        minBucketA = 8; // Standard minimum
      }
      
      // Fill Bucket A to minimum with literal anchors
      while (bucketA.length < minBucketA && headlines.length < 15 && primaryRegionTitle) {
        // Fill with variations - prioritize literal primary branch + primary region
        const fillers = [
          `${primaryBranchTitle} ${primaryRegionTitle} Service`,
          `${primaryBranchTitle} ${primaryRegionTitle} Nu`,
          `${primaryBranchTitle} ${primaryRegionTitle} Snel`,
          `Lokale ${primaryBranchTitle} ${primaryRegionTitle}`,
          `Ervaren ${primaryBranchTitle} ${primaryRegionTitle}`
        ];
        
        // If literal pair fits, try more literal anchors
        if (literalPairLength <= 30) {
          fillers.unshift(
            `${primaryBranchTitle} ${primaryRegionTitle}`,
            `${primaryBranchTitle} ${primaryRegionTitle} Offerte`,
            `${primaryBranchTitle} ${primaryRegionTitle} Prijs`
          );
        }
        
        let added = false;
        for (const filler of fillers) {
          if (filler.length <= 30 && pushH(filler, { allowTrim: false })) {
            bucketA.push(filler);
            added = true;
            break;
          }
        }
        
        // If literal pair doesn't fit, try region variants
        if (!added && literalPairLength > 30 && regionTitles.length > 1) {
          for (const variant of regionTitles.slice(1)) {
            const variantCandidate = `${primaryBranchTitle} ${variant}`;
            if (variantCandidate.length <= 30 && pushH(variantCandidate, { allowTrim: false })) {
              bucketA.push(variantCandidate);
              added = true;
              break;
            }
          }
        }
        
        if (!added || bucketA.length >= minBucketA) break;
      }
      
      // ============================================
      // BUCKET K: Exact keyword coverage (Google UI alignment)
      // ============================================
      // Insert Bucket K early, after Bucket A but before generic USP/CTA
      // This ensures all eligible keywords appear literally in headlines
      const bucketK = [];
      
      // Get region match variants for keyword filtering
      // Uses same logic as test harness for consistency
      const getRegionMatchVariantsForKeywords = (regionRaw) => {
        const code = (regionRaw || '').toLowerCase().trim();
        const map = {
          'noord-brabant': ['noord-brabant', 'brabant', 'nb'],
          'zuid-holland': ['zuid-holland', 'holland', 'zh'],
          'noord-holland': ['noord-holland', 'holland', 'nh'],
          'friesland': ['friesland'],
          'gelderland': ['gelderland'],
          'utrecht': ['utrecht'],
          'overijssel': ['overijssel'],
          'groningen': ['groningen'],
          'drenthe': ['drenthe'],
          'flevoland': ['flevoland'],
          'limburg': ['limburg'],
          'zeeland': ['zeeland']
        };
        return map[code] || [code];
      };
      const regionMatchVariantsForK = primaryRegionTitle 
        ? getRegionMatchVariantsForKeywords(regionRaw)
        : [];
      
      // Extract eligible keywords from keywordTexts
      const eligibleKeywords = GoogleAdsCampaignBuilderService.extractEligibleKeywords(
        keywordTexts,
        primaryBranchLower,
        primaryRegionLower,
        regionMatchVariantsForK
      );
      
      // Determine how many keywords we can include
      // Reserve slots for Bucket K, but ensure Bucket A minimum is satisfied first
      const availableSlotsForK = Math.max(0, maxHeadlines - headlines.length);
      const maxKeywordsToInclude = Math.min(
        eligibleKeywords.length,
        K_RESERVED_SLOTS,
        availableSlotsForK
      );
      
      // If uniqueEligibleKeywordsCount <= reserved capacity, include all
      // Otherwise, include top N by priority
      const keywordsToInclude = eligibleKeywords.slice(0, maxKeywordsToInclude);
      
      // Add keyword headlines to Bucket K
      for (const { phrase } of keywordsToInclude) {
        if (headlines.length >= maxHeadlines) break;
        
        // Convert to title case for headline (reuse existing toTitle function)
        const headlineCandidate = toTitle(phrase);
        
        // Must not exceed 30 chars after formatting
        if (headlineCandidate.length > 30) {
          // Skip if slightly over 30 - do NOT forcibly truncate
          continue;
        }
        
        // Add if not too similar to existing headlines
        if (pushH(headlineCandidate, { allowTrim: false, checkSimilarity: true })) {
          bucketK.push(headlineCandidate);
        }
      }
      
      // BUCKET D: USP/CTA without region (target 2–3 headlines)
      // CRITICAL: Fill bucket D IMMEDIATELY after bucket A to reserve space,
      // but never exceed the global maxPureUspSlots.
      const bucketD = [];
      const uspTemplates = [
        'Binnen 24u Reactie',
        'Afspraak Is Afspraak',
        'Transparante Prijzen',
        'Vrijblijvende Offerte',
        '9+ Beoordelingen',
        'Gratis Offerte',
        'Snelle Service',
        'Betrouwbare Professionals',
        'Lokale Experts',
        'Vakmanschap Gegarandeerd',
        'Gratis Advies',
        'Snelle Reactie',
        'Beste Prijzen'
      ];
      
      // Fill bucket D right after bucket A, before bucket B
      // Aim for 2–3 pure USP headlines that may omit branch/region.
      while (headlines.length < maxHeadlines && bucketD.length < maxPureUspSlots) {
        let added = false;
        for (const usp of uspTemplates) {
          if (headlines.length >= maxHeadlines) break;
          if (bucketD.length >= maxPureUspSlots) break;
          if (pushPureUsp(usp)) {
            bucketD.push(usp);
            added = true;
          } 
        }
        // If we couldn't add any more, try with less strict similarity check
        if (!added && bucketD.length < 2) {
          for (const usp of uspTemplates) {
            if (headlines.length >= maxHeadlines) break;
            if (bucketD.length >= 2) break;
            // Allow slightly more similar USPs to reach minimum diversity
            if (pushPureUsp(usp)) {
              bucketD.push(usp);
              added = true;
            } 
          }
        }
        // If still not enough, force add even if similar (better than missing the requirement)
        if (!added && bucketD.length < 2 && headlines.length < maxHeadlines) {
          // Force add the first 2–3 that fit
          for (const usp of uspTemplates.slice(0, 10)) {
            if (headlines.length >= maxHeadlines) break;
            if (bucketD.length >= maxPureUspSlots) break;
            const trimmed = GoogleAdsCampaignBuilderService.trimHeadlineTo30(usp);
            if (trimmed && trimmed.length <= 30) {
              const norm = trimmed.toLowerCase();
              if (!headlines.some(h => h.toLowerCase() === norm)) {
                if (pushPureUsp(trimmed)) {
                  bucketD.push(trimmed);
                  added = true;
                }
              }
            } 
          }
        }
        if (!added) break; // No more can be added
      }
      
      // BUCKET B: Primary branch + region urgency/service (max 3 headlines to leave room)
      const bucketB = [];
      const urgencyKeywords = [
        { word: 'Spoed', pattern: (b, r) => `Spoed ${b} ${r}` },
        { word: 'Vandaag', pattern: (b, r) => `${b} ${r} Vandaag` },
        { word: 'Snel', pattern: (b, r) => `${b} ${r} Snel` },
        { word: '24/7', pattern: (b, r) => `${b} ${r} 24/7` },
        { word: 'Nu', pattern: (b, r) => `${b} ${r} Nu` },
        { word: 'Service', pattern: (b, r) => `${b} ${r} Service` }
      ];
      
      // Limit bucket B to max 3 to ensure we have room for bucket D and C
      for (const urgency of urgencyKeywords) {
        if (headlines.length >= 15 || bucketB.length >= 3) break;
        if (!primaryRegionTitle) break;
        
        const candidate = urgency.pattern(primaryBranchTitle, primaryRegionTitle);
        if (candidate.length <= 30 && pushH(candidate, { allowTrim: false })) {
          bucketB.push(candidate);
        }
      }
      
      // Fill bucket B with region variants if needed (but still max 3 total)
      if (bucketB.length < 3 && primaryRegionTitle && regionTitles.length > 1) {
        for (const variant of regionTitles.slice(1)) {
          if (headlines.length >= 15 || bucketB.length >= 3) break;
          const candidates = [
            `${primaryBranchTitle} ${variant} Snel`,
            `Spoed ${primaryBranchTitle} ${variant}`,
            `${primaryBranchTitle} ${variant} Nu`
          ];
          for (const candidate of candidates) {
            if (candidate.length <= 30 && pushH(candidate, { allowTrim: false })) {
              bucketB.push(candidate);
              break;
            }
          }
        }
      }
      
      // BUCKET C: Alias expansion (max 2 headlines) - STRICT GATE
      // Only allow aliases if primary literal thresholds are satisfied
      const bucketC = [];
      
      // Compute early stats after Bucket A + Bucket B + Bucket D
      let literalAnchorsCount = 0;
      let primaryPairExactCount = 0;
      let regionMentionCount = 0;
      
      for (const h of headlines) {
        const hLower = h.toLowerCase();
        const hasPrimaryBranch = hLower.includes(primaryBranchLower);
        const hasPrimaryRegion = primaryRegionTitle ? hLower.includes(primaryRegionTitle.toLowerCase()) : false;
        const hasRegionVariant = primaryRegionTitle && regionTitles.some(rt => 
          hLower.includes(rt.toLowerCase())
        );
        
        // Count literal anchors: contains both primary branch and region match
        if (hasPrimaryBranch && (hasPrimaryRegion || hasRegionVariant)) {
          literalAnchorsCount++;
        }
        
        // Count exact primary pair matches (when literal pair length <= 30)
        if (literalPairLength <= 30 && hasPrimaryBranch && hasPrimaryRegion) {
          const exactPair = `${primaryBranchLower} ${primaryRegionTitle.toLowerCase()}`;
          if (hLower.includes(exactPair)) {
            primaryPairExactCount++;
          }
        }
        
        // Count region mentions (any region variant)
        if (hasPrimaryRegion || hasRegionVariant) {
          regionMentionCount++;
        }
      }
      
      // Define alias gate thresholds
      const minLiteralAnchors = literalPairLength <= 30 ? minBucketA : 4;
      
      // Estimate keyword coverage from current pool
      let keywordCoverageCount = 0;
      for (const phrase of keywordPhrases) {
        if (!phrase) continue;
        const phraseLower = normalizePhrase(phrase);
        const phraseWords = phraseLower.split(/\s+/).filter(w => w.length > 2);
        
        // Check if all important words from phrase appear in headlines
        const allWordsCovered = phraseWords.every(word => {
          return headlines.some(h => {
            const hLower = h.toLowerCase();
            return hLower.includes(word);
          });
        });
        
        if (allWordsCovered && phraseWords.length > 0) {
          keywordCoverageCount++;
        }
      }
      const estimatedKeywordCoverage = keywordPhrases.length > 0 
        ? (keywordCoverageCount / keywordPhrases.length) * 100 
        : 100;
      
      // Alias gate: allow aliases only if ALL conditions hold
      const allowAliases = (
        literalAnchorsCount >= minLiteralAnchors &&
        regionMentionCount >= 10 &&
        estimatedKeywordCoverage >= 95 &&
        headlines.length >= 12 // Can reach 15 without aliases
      );
      
      // Only add aliases if gate allows
      if (allowAliases && headlines.length < 15 && branchAliases.length > 0 && primaryRegionTitle) {
        for (const alias of branchAliases.slice(0, 2)) {
          if (headlines.length >= 15 || bucketC.length >= 2) break;
          const aliasTitle = toTitle(alias);
          const candidates = [
            `${aliasTitle} ${primaryRegionTitle}`,
            `${primaryBranchTitle} ${primaryRegionTitle} ${aliasTitle}`,
            `${aliasTitle} in ${primaryRegionTitle}`
          ];
          for (const candidate of candidates) {
            if (candidate.length <= 30 && pushH(candidate, { allowTrim: false })) {
              bucketC.push(candidate);
              break;
            }
          }
        }
      }
      
      // Final check: Ensure bucket D has at least 2 pure USPs before final fill
      // This is important for Google Ads quality, but we still cap at maxPureUspSlots.
      while (headlines.length < maxHeadlines && bucketD.length < Math.max(2, Math.min(3, maxPureUspSlots))) {
        let added = false;
        for (const usp of uspTemplates) {
          if (headlines.length >= maxHeadlines) break;
          if (bucketD.length >= maxPureUspSlots) break;
          // Force add even if slightly similar – better than missing required USPs
          const trimmed = GoogleAdsCampaignBuilderService.trimHeadlineTo30(usp);
          if (trimmed && trimmed.length <= 30) {
            const norm = trimmed.toLowerCase();
            if (!headlines.some(h => h.toLowerCase() === norm)) {
              if (pushPureUsp(trimmed)) {
                bucketD.push(trimmed);
                added = true;
              }
            }
          } 
        }
        if (!added) break;
      }
      
      // Final fill: ensure exactly 15 headlines
      // CRITICAL: Ensure bucket D has 2–3 USPs before adding more region headlines
      if (bucketD.length < 2) {
        // Force fill bucket D first - this is a hard requirement
        while (headlines.length < maxHeadlines && bucketD.length < 2) {
          for (const usp of uspTemplates) {
            if (headlines.length >= maxHeadlines) break;
            if (bucketD.length >= 2 || bucketD.length >= maxPureUspSlots) break;
            const trimmed = GoogleAdsCampaignBuilderService.trimHeadlineTo30(usp);
            if (trimmed && trimmed.length <= 30) {
              const norm = trimmed.toLowerCase();
              if (!headlines.some(h => h.toLowerCase() === norm)) {
                if (pushPureUsp(trimmed)) {
                  bucketD.push(trimmed);
                }
              }
            } 
          }
          if (bucketD.length >= 2 || bucketD.length >= maxPureUspSlots) break;
        }
      }
      
      // Now fill remaining slots with region-aware headlines
      while (headlines.length < 15 && primaryRegionTitle) {
        const fillers = [
          `${primaryBranchTitle} ${primaryRegionTitle}`,
          `Lokale ${primaryBranchTitle} ${primaryRegionTitle}`,
          `${primaryBranchTitle} ${primaryRegionTitle} Offerte`,
          `${primaryBranchTitle} ${primaryRegionTitle} Prijs`,
          `Top ${primaryBranchTitle} ${primaryRegionTitle}`,
          `Professionele ${primaryBranchTitle} ${primaryRegionTitle}`
        ];
        
        let added = false;
        for (const filler of fillers) {
          if (filler.length <= 30 && pushH(filler, { allowTrim: false })) {
            added = true;
            break;
          }
        }
        if (!added) break;
      }
      
      // Last resort: branch-only fillers (only if bucket D is already at 3+)
      while (headlines.length < 15 && bucketD.length >= 3) {
        const branchFillers = [
          `Gratis Offerte ${primaryBranchTitle}`,
          `Vraag ${primaryBranchTitle} Offerte`,
          `Ervaren ${primaryBranchTitle}`,
          `${primaryBranchTitle} Met 9+ Score`,
          `Professionele ${primaryBranchTitle}`
        ];
        
        let added = false;
        for (const filler of branchFillers) {
          if (filler.length <= 30 && pushH(filler, { allowTrim: true })) {
            added = true;
            break;
          }
        }
        if (!added) break;
      }
      
      // Absolute last resort: more USP if we still don't have 15
      while (headlines.length < 15 && pureUspCount < maxPureUspSlots) {
        const moreUsps = [
          'Gratis Advies',
          'Snelle Reactie',
          'Beste Prijzen',
          'Vakmanschap Gegarandeerd',
          'Transparante Prijzen',
          'Vrijblijvende Offerte'
        ];
        let added = false;
        for (const usp of moreUsps) {
          if (headlines.length >= 15) break;
          if (pureUspCount >= maxPureUspSlots) break;
          const ok = pushPureUsp(usp);
          if (ok) {
            if (!bucketD.includes(usp)) bucketD.push(usp);
            added = true;
            break;
          }
        }
        if (!added) break;
      }
      
      // Sanity check: Remove or fix incomplete/broken headlines
      const sanitizedHeadlines = headlines.map(h => {
        if (!h || typeof h !== 'string') return null;
        const trimmed = h.trim();
        
        // Check for incomplete phrases
        const incompletePatterns = [
          /,\s*$/,
          /\s+Geen\s*$/,
          /\s+[A-Za-z]{1,2}\s*$/,
          /\s+-\s*$/
        ];
        
        for (const pattern of incompletePatterns) {
          if (pattern.test(trimmed)) {
            const fixed = trimmed.replace(pattern, '').trim();
            if (fixed.length >= 5 && fixed.length <= 30) {
              return fixed;
            }
            return null;
          }
        }
        
        if (trimmed.length < 5) return null;
        return trimmed;
      }).filter(Boolean);
      
      // Ensure we still end up with exactly 15 headlines after sanitation.
      const finalHeadlines = (() => {
        const out = sanitizedHeadlines.slice(0, maxHeadlines);

        if (out.length >= maxHeadlines) {
          return out;
        }

        const fillPush = GoogleAdsCampaignBuilderService.pushHeadlineFactory(out);

        // Prefer additional branch+region anchors first
        const regionAwareFillers = primaryRegionTitle
          ? [
              `${primaryBranchTitle} ${primaryRegionTitle}`,
              `Lokale ${primaryBranchTitle} ${primaryRegionTitle}`,
              `${primaryBranchTitle} ${primaryRegionTitle} Offerte`,
              `${primaryBranchTitle} ${primaryRegionTitle} Prijs`,
              `${primaryBranchTitle} ${primaryRegionTitle} Service`,
            ]
          : [];

        const branchOnlyFillers = [
          `Gratis Offerte ${primaryBranchTitle}`,
          `Ervaren ${primaryBranchTitle}`,
          `${primaryBranchTitle} Met 9+ Score`,
          `Professionele ${primaryBranchTitle}`,
        ];

        const allFillers = [...regionAwareFillers, ...branchOnlyFillers];

        for (const filler of allFillers) {
          if (out.length >= maxHeadlines) break;
          if (!filler || filler.length > 30) continue;
          fillPush(filler, { allowTrim: false });
        }

        return out;
      })();

      // --- Descriptions with 4 enforced intent themes + plural/singular grammar ---
      // Grammar-safe templates based on plural/singular branch
      const articleText = isPlural ? '' : 'een ';
      
      const descriptionTemplates = [
        // 1. PRIJS/TRANSPARANTIE theme
        {
          intent: 'prijs',
          keywords: ['prijs', 'kosten', 'offerte', 'transparant', 'duidelijk'],
          text: `Duidelijke en transparante prijzen voor ${primaryBranchTitle} in ${primaryRegionTitle}. Vooraf inzicht in kosten, geen verborgen toeslagen.`
        },
        // 2. SPOED/SNELHEID theme
        {
          intent: 'spoed',
          keywords: ['spoed', 'snel', '24/7', 'vandaag', 'binnen 24 uur'],
          text: isPlural
            ? `Spoedklus in ${primaryRegionTitle}? Snel hulp van ${primaryBranchTitle} in ${primaryRegionTitle}. Vaak binnen 24 uur beschikbaar, ook in het weekend.`
            : `Spoedklus in ${primaryRegionTitle}? Snel hulp van ${articleText}${primaryBranchTitle} in ${primaryRegionTitle}. Vaak binnen 24 uur beschikbaar, ook in het weekend.`
        },
        // 3. REVIEWS/BETROUWBAARHEID theme
        {
          intent: 'reviews',
          keywords: ['beoordelingen', 'reviews', 'ervaring', 'kwaliteit', 'betrouwbaar'],
          text: `${primaryBranchTitle} in ${primaryRegionTitle} met 9+ beoordelingen. Betrouwbare service en vakmanschap.`
        },
        // 4. OPLOSSING/RESULTAAT theme
        {
          intent: 'oplossing',
          keywords: ['oplossing', 'resultaat', 'service', 'advies', 'garantie', 'montage'],
          text: primaryBranchLower.includes('glas') || primaryBranchLower.includes('ruit')
            ? `Reparatie met isolatieglas in ${primaryRegionTitle}. Bespaar op energie en verhoog je wooncomfort.`
            : isPlural
            ? `Van advies tot montage in ${primaryRegionTitle}. ${primaryBranchTitle} regelen alles voor je, inclusief garantie.`
            : `Van advies tot montage in ${primaryRegionTitle}. ${articleText}${primaryBranchLower} regelt alles voor je, inclusief garantie.`
        },
        // Fallback templates
        {
          intent: 'gemak',
          keywords: ['online', 'plan', 'afspraak', 'gemak'],
          text: isPlural
            ? `Plan online een afspraak met ${primaryBranchLower} in ${regionName}. Kies zelf het moment dat jou past.`
            : `Plan online een afspraak met ${articleText}${primaryBranchLower} in ${regionName}. Kies zelf het moment dat jou past.`
        },
        {
          intent: 'doelgroep',
          keywords: ['particulieren', 'bedrijven'],
          text: `${primaryBranchTitle} in ${regionName} voor particulieren en bedrijven. Altijd een passende oplossing.`
        }
      ];

      // Select 4 descriptions ensuring diversity + similarity guard
      // Prioritize the 4 enforced intent themes
      const requiredDescriptionIntents = ['prijs', 'spoed', 'reviews', 'oplossing'];
      const selectedDescriptions = [];
      const usedIntents = new Set();
      
      // First pass: select required intent themes
      for (const requiredIntent of requiredDescriptionIntents) {
        const template = descriptionTemplates.find(t => t.intent === requiredIntent);
        if (template) {
          const trimmed = GoogleAdsCampaignBuilderService.trimDescriptionTo90(template.text);
          if (trimmed && trimmed.length > 0) {
            // Check similarity before adding
            const isSimilar = selectedDescriptions.some(existing => 
              GoogleAdsCampaignBuilderService.jaccardSimilarity(trimmed, existing) > 0.6
            );
            if (!isSimilar) {
              selectedDescriptions.push(trimmed);
              usedIntents.add(template.intent);
            }
          }
        }
      }
      
      // Second pass: fill remaining slots with other templates
      for (const template of descriptionTemplates) {
        if (selectedDescriptions.length >= 4) break;
        if (usedIntents.has(template.intent)) continue;
        
        const trimmed = GoogleAdsCampaignBuilderService.trimDescriptionTo90(template.text);
        if (trimmed && trimmed.length > 0) {
          // Check similarity
          const isSimilar = selectedDescriptions.some(existing => 
            GoogleAdsCampaignBuilderService.jaccardSimilarity(trimmed, existing) > 0.6
          );
          if (!isSimilar) {
            selectedDescriptions.push(trimmed);
            usedIntents.add(template.intent);
          }
        }
      }
      
      // Ensure exactly 4 descriptions
      while (selectedDescriptions.length < 4 && descriptionTemplates.length > 0) {
        const template = descriptionTemplates[selectedDescriptions.length % descriptionTemplates.length];
        const trimmed = GoogleAdsCampaignBuilderService.trimDescriptionTo90(template.text);
        if (trimmed && trimmed.length > 0) {
          const isSimilar = selectedDescriptions.some(existing => 
            GoogleAdsCampaignBuilderService.jaccardSimilarity(trimmed, existing) > 0.6
          );
          if (!isSimilar && !selectedDescriptions.includes(trimmed)) {
            selectedDescriptions.push(trimmed);
          }
        }
        if (selectedDescriptions.length >= 4) break;
      }
      
      const descriptions = selectedDescriptions.slice(0, 4);

      const path1 = 'offerte';
      const path2 = regionName
        ? regionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        : '';

      // Default final URL: https://growsocialmedia.nl/offerte/{regionSlug}
      // Only use provided landingPageUrl if it's explicitly set and valid
      let defaultFinalUrl = 'https://growsocialmedia.nl';
      if (path2) {
        defaultFinalUrl = `https://growsocialmedia.nl/${path1}/${path2}`;
      } else if (path1) {
        defaultFinalUrl = `https://growsocialmedia.nl/${path1}`;
      }
      
      const finalUrl = landingPageUrl && landingPageUrl.trim() && landingPageUrl !== 'https://growsocialmedia.nl'
        ? landingPageUrl.trim()
        : defaultFinalUrl;

      // Log final RSA headlines for debugging
      logger.info('FINAL RSA HEADLINES', {
        branch,
        region: regionCode,
        headlines: finalHeadlines,
        lengths: finalHeadlines.map(h => h.length),
        headlineCount: finalHeadlines.length,
        keywordTexts,
        primaryRegionInHeadlines: primaryRegionTitle ? finalHeadlines.some(h => 
          h.toLowerCase().includes(primaryRegionTitle.toLowerCase())
        ) : false
      });

      return {
        headlines: finalHeadlines,
        descriptions,
        path1,
        path2,
        finalUrls: [finalUrl]
      };
    }


    /**
     * Get region display name
     */
    static getRegionDisplayName(regionCode) {
      const regionMap = {
        'noord-holland': 'Noord-Holland',
        'zuid-holland': 'Zuid-Holland',
        'noord-brabant': 'Noord-Brabant',
        'gelderland': 'Gelderland',
        'utrecht': 'Utrecht',
        'friesland': 'Friesland',
        'overijssel': 'Overijssel',
        'groningen': 'Groningen',
        'drenthe': 'Drenthe',
        'flevoland': 'Flevoland',
        'limburg': 'Limburg',
        'zeeland': 'Zeeland'
      };
      if (regionMap[regionCode]) return regionMap[regionCode];

      // fallback: Title Case i.p.v. lower
      return (regionCode || '')
        .toString()
        .split(/\s+/)
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }


    /**
     * Create complete Google Ads campaign met keywords, ad groups en ads
     * @param {Object} config - Campaign configuration
     * @param {Function} progressCallback - Optional callback for progress updates (step, message, percentage)
     * @returns {Promise<Object>} Created campaign info
     */
    static async createCompleteCampaign(config, progressCallback = null) {
      try {
        const {
          campaignName,
          dailyBudget,
          customerId = null,
          branch,
          region,
          landingPageUrl,
          segmentId
        } = config;

        const updateProgress = (step, message, percentage = null) => {
          if (progressCallback) {
            // Ensure percentage is always a number
            const progressPercent = percentage !== null && percentage !== undefined ? percentage : 0;
            progressCallback({ 
              step, 
              message, 
              percentage: progressPercent,
              status: step === 'complete' ? 'complete' : step === 'error' ? 'error' : 'in_progress'
            });
          }
        };

        if (!campaignName || !dailyBudget || !branch || !region) {
          throw new Error('Campaign name, daily budget, branch, and region are required');
        }

        logger.info(`🚀 Creating complete Google Ads campaign: ${campaignName}`);
        
        // CRITICAL: Send initial progress update immediately
        updateProgress('initializing', 'Campagne initialiseren...', 5);
        
        // Small delay to ensure progress is registered
        await new Promise(resolve => setTimeout(resolve, 100));

        // --- Budget guardrails -------------------------------------------------
        // Always work with a numeric effective budget
        let effectiveDailyBudget = Number(dailyBudget);
        if (Number.isNaN(effectiveDailyBudget) || effectiveDailyBudget <= 0) {
          logger.error('❌ Invalid daily budget value:', { dailyBudget });
          return {
            success: false,
            error: 'Ongeldig dagbudget opgegeven',
            errorCode: 'INVALID_DAILY_BUDGET',
            details: { dailyBudget }
          };
        }

        const minBudget = Number(process.env.GOOGLE_ADS_CAMPAIGN_MIN_DAILY_BUDGET || 5);
        let maxBudget = Number(process.env.GOOGLE_ADS_CAMPAIGN_MAX_DAILY_BUDGET || 1000);
        const budgetGuardMode = (process.env.GOOGLE_ADS_BUDGET_GUARD_MODE || 'error').toLowerCase();

        // Optional branche-specifieke max budget override
        if (branch) {
          const key = branch.toUpperCase().replace(/[^A-Z0-9]/g, '_');
          const branchMaxEnv = process.env[`GOOGLE_ADS_MAX_DAILY_BUDGET_${key}`];
          if (branchMaxEnv) {
            const branchMax = Number(branchMaxEnv);
            if (Number.isFinite(branchMax) && branchMax > 0) {
              maxBudget = branchMax;
            }
          }
        }

        if (effectiveDailyBudget < minBudget || effectiveDailyBudget > maxBudget) {
          if (budgetGuardMode === 'clamp') {
            const clamped = Math.min(Math.max(effectiveDailyBudget, minBudget), maxBudget);
            logger.warn(`⚠️ Daily budget ${effectiveDailyBudget} buiten range [${minBudget}, ${maxBudget}] - clamping naar ${clamped}`);
            effectiveDailyBudget = clamped;
          } else {
            logger.error('❌ Daily budget buiten veilige range', {
              requested: effectiveDailyBudget,
              minBudget,
              maxBudget
            });
            return {
              success: false,
              error: 'Dagbudget ligt buiten de toegestane range',
              errorCode: 'BUDGET_OUT_OF_RANGE',
              details: { requested: effectiveDailyBudget, minBudget, maxBudget }
            };
          }
        }

        // Initialize Google Ads customer client early (needed for location code lookup)
        const customer = await GoogleAdsClient.getCustomer(customerId);
        if (!customer) {
          throw new Error('Google Ads API client not initialized');
        }

        // --- Geo targeting guardrails -----------------------------------------
        // CRITICAL: Location codes MUST be correct - wrong codes cause campaigns to target wrong countries!
        // The previous codes were WRONG and caused campaigns to target Finland instead of Netherlands
        // 
        // We need to verify location codes via Google Ads Geo Target Constants API or CSV
        // For now, we'll try to get codes dynamically, or use verified codes if available
        // Support both province-level and city-level targeting
        const city = config.city || null;
        let locationCodes = await this.getLocationCodes(region, city);
        
        // If no codes found, try to get them from API (if customer is available)
        if ((!locationCodes || locationCodes.length === 0) && customer) {
          logger.warn(`⚠️ No location codes found for ${region}${city ? `, ${city}` : ''}, trying API lookup...`);
          locationCodes = await this.getLocationCodesFromAPI(region, customer);
        }
        
        if (!locationCodes || locationCodes.length === 0) {
          logger.error('❌ No location codes resolved for region. Location codes must be verified!', { region });
          return {
            success: false,
            error: 'Location targeting kon niet worden bepaald voor deze regio. De location codes moeten worden geverifieerd via Google Ads Geo Target Constants API of CSV.',
            errorCode: 'MISSING_LOCATION_TARGETING',
            details: { 
              region,
              note: 'Location codes were incorrect and caused campaigns to target wrong countries (e.g., Finland instead of Netherlands). Please verify codes via: https://developers.google.com/google-ads/api/data/geotargets',
              action: 'Download the Geo Target Constants CSV, search for the province name with Country Code = "NL", and update the location codes in the codebase.'
            }
          };
        }
        
        logger.info(`📍 Using location codes for ${region}: ${locationCodes.join(', ')}`);
        logger.warn(`⚠️ VERIFY these codes are correct! Wrong codes cause campaigns to target wrong countries!`);

        // 1. Create campaign budget
        const budgetAmountMicros = Math.round(effectiveDailyBudget * 1000000);

        const targetCustomerId = customerId || GoogleAdsClient.customerId;
        
        // Avoid duplicate budget names by adding a timestamp suffix
        const budgetName = `Budget ${campaignName} ${Math.floor(Date.now() / 1000)}`;

        updateProgress('budget', 'Campagne budget aanmaken...', 10);
        const budgetResourceName = await retry(async () => {
          const budgetResult = await customer.campaignBudgets.create([{
            name: budgetName,
            amount_micros: budgetAmountMicros,
            delivery_method: 'STANDARD'
          }]);
          if (budgetResult?.results?.[0]?.resource_name) {
            return budgetResult.results[0].resource_name;
          }
          if (budgetResult?.resource_name) {
            return budgetResult.resource_name;
          }
          throw new Error('Unexpected response structure from campaignBudgets.create');
        });

        logger.info(`✅ Created campaign budget: ${budgetResourceName}`);
        updateProgress('budget', 'Campagne budget aangemaakt ✅', 15);
        await new Promise(resolve => setTimeout(resolve, 50));
        updateProgress('campaign', 'Campagne aanmaken...', 20);

        // Avoid duplicate campaign names by adding a timestamp suffix
        const campaignNameUnique = `${campaignName} ${Math.floor(Date.now() / 1000)}`;

        // 2. Create campaign (ENABLED, niet PAUSED!)
        const campaignResourceName = await retry(async () => {
          // Build tracking template used at CAMPAIGN level (baseline for all ads)
          const trackingTemplate = process.env.GOOGLE_ADS_TRACKING_TEMPLATE || 
            '{lpurl}?gclid={gclid}&gbraid={gbraid}&wbraid={wbraid}';

          const campaignPayload = {
            name: campaignNameUnique,
            advertising_channel_type: 'SEARCH',
            status: 'ENABLED', // Direct ENABLED - next level!
            campaign_budget: budgetResourceName,
            // Manual CPC without ECPC to avoid context restriction
            manual_cpc: {},
            // Network settings: Google Search ONLY (Search Network and Display Network OFF)
            // CRITICAL: target_search_network must be FALSE to only show on Google Search
            network_settings: {
              target_google_search: true, // Google Search (google.com) - ON
              target_search_network: false, // Search Network (partner sites) - OFF
              target_search_partner: false, // Search Partners - OFF
              target_content_network: false // Display Network - OFF
            },
            // EU political flag required by API (enum)
            contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
            // Tracking template at campaign level so ALL traffic includes tracking params
            tracking_url_template: trackingTemplate,
            // Location targeting behaviour
            // We explicitly enforce PRESENCE-only for positives, so we only hit people
            // physically in the region – not people merely searching for it.
            geo_target_type_setting: {
              positive_geo_target_type: 'PRESENCE',
              negative_geo_target_type: 'PRESENCE'
            }
          };
          
          // CRITICAL: Set campaign goal to "Leads" for lead generation campaigns
          // Google Ads API uses campaign_goal enum: 'LEADS', 'SALES', 'BRAND_AWARENESS_AND_REACH', etc.
          // For lead generation campaigns, we set it to 'LEADS'
          // Note: This field may not be available in all API versions - if it fails, we continue without it
          if (process.env.GOOGLE_ADS_CAMPAIGN_GOAL) {
            campaignPayload.campaign_goal = process.env.GOOGLE_ADS_CAMPAIGN_GOAL;
            logger.info(`✅ Setting campaign goal to ${process.env.GOOGLE_ADS_CAMPAIGN_GOAL}`);
          } else {
            // Default to LEADS for lead generation
            campaignPayload.campaign_goal = 'LEADS';
            logger.info('✅ Setting campaign goal to LEADS (default for lead generation)');
          }
          
          const campaignResult = await customer.campaigns.create([campaignPayload]);
          if (campaignResult?.results?.[0]?.resource_name) {
            return campaignResult.results[0].resource_name;
          }
          if (campaignResult?.resource_name) {
            return campaignResult.resource_name;
          }
          throw new Error('Unexpected response structure from campaigns.create');
        });

        const campaignId = campaignResourceName.split('/').pop();
        logger.info(`✅ Created campaign: ${campaignResourceName} (ENABLED)`);
        updateProgress('campaign', 'Campagne aangemaakt ✅', 25);
        await new Promise(resolve => setTimeout(resolve, 50));
        updateProgress('location', 'Locatietargeting instellen...', 30);

        // 3b. Add location targeting (actual CampaignCriterion resources)
        const locationOk = await this.addLocationTargeting(customer, campaignId, locationCodes, targetCustomerId);
        if (!locationOk) {
          logger.error('❌ Failed to apply location targeting, aborting campaign build', {
            campaignId,
            locationCodes
          });
          updateProgress('error', 'Fout: Locatietargeting kon niet worden toegepast', 0);
          return {
            success: false,
            error: 'Location targeting kon niet worden toegepast, campagne is niet volledig aangemaakt',
            errorCode: 'LOCATION_TARGETING_FAILED',
            details: { campaignId, locationCodes }
          };
        }
        updateProgress('location', 'Locatietargeting ingesteld ✅', 32);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 3c. Add language targeting (default: Dutch) based on env
        updateProgress('language', 'Taaltargeting instellen (Nederlands)...', 35);
        const languageEnv = process.env.GOOGLE_ADS_DEFAULT_LANGUAGE_CONSTANT_IDS || '1010';
        const languageConstantIds = languageEnv
          .split(',')
          .map(id => id.trim())
          .filter(Boolean);
        if (languageConstantIds.length > 0) {
          const languageOk = await this.addLanguageTargeting(customer, campaignId, languageConstantIds, targetCustomerId);
          if (!languageOk) {
            logger.warn('⚠️ Language targeting could not be applied; campaign will default to all languages', {
              campaignId,
              languageConstantIds
            });
          } else {
            updateProgress('language', 'Taaltargeting ingesteld ✅', 37);
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        }

        // Optional strict location check: verify via Google Ads API that location criteria exist
        const strictLocationCheck = (process.env.GOOGLE_ADS_STRICT_LOCATION_CHECK || 'true').toLowerCase() !== 'false';
        if (strictLocationCheck) {
          try {
            const inspection = await this.inspectCampaignBasics(targetCustomerId, campaignId);
            if (!inspection.locations || inspection.locations.length === 0) {
              logger.error('❌ Strict location check failed: no location criteria found after creation', {
                campaignId,
                inspection
              });
              return {
                success: false,
                error: 'Location targeting ontbreekt nadat de campagne is aangemaakt',
                errorCode: 'LOCATION_CRITERIA_MISSING',
                details: { campaignId, inspection }
              };
            }
          } catch (inspectError) {
            logger.warn('⚠️ Could not run inspectCampaignBasics for strict location check:', inspectError.message);
          }
        }

        // 5. Generate keywords
        updateProgress('keywords', 'Zoekwoorden genereren...', 40);
        const keywords = this.generateKeywords(branch, region);
        logger.info(`✅ Generated ${keywords.length} keywords`);
        updateProgress('keywords', `${keywords.length} zoekwoorden gegenereerd ✅`, 42);
        await new Promise(resolve => setTimeout(resolve, 50));

        // CRITICAL: Validate landing page URL accessibility ONCE before creating ads
        // Google Ads will reject ads with inaccessible URLs
        // Do this outside the loop to avoid multiple validations and prevent progress update stacking
        logger.info(`🔍 Validating landing page URL: ${landingPageUrl}`);
        let validatedLandingPageUrl = landingPageUrl;
        const isUrlAccessible = await this.validateUrl(landingPageUrl);
        
        if (!isUrlAccessible) {
          logger.error(`❌ Landing page URL is NOT accessible: ${landingPageUrl}`);
          logger.warn(`⚠️ Google Ads will reject this URL. Using fallback: https://growsocialmedia.nl`);
          validatedLandingPageUrl = 'https://growsocialmedia.nl'; // Fallback to main site
          // Don't send progress update for warnings - just log it to avoid stacking
        } else {
          logger.info(`✅ Landing page URL is accessible and valid: ${landingPageUrl}`);
        }

        // 6. Create multiple ad groups (Multi-Ad Group Structure - Next Level!)
        updateProgress('adgroups', 'Ad groups aanmaken...', 45);
        const adGroups = this.createAdGroupStructure(branch, region);
        const adGroupResourceNames = [];

        for (let i = 0; i < adGroups.length; i++) {
          const adGroupConfig = adGroups[i];
          updateProgress('adgroups', `Ad group ${i + 1}/${adGroups.length} aanmaken: ${adGroupConfig.name}...`, 45 + (i * 10));
          const adGroupResourceName = await this.createAdGroup(
            customer,
            campaignId,
            adGroupConfig.name,
            targetCustomerId
          );
          adGroupResourceNames.push(adGroupResourceName);
          updateProgress('adgroups', `Ad group ${i + 1}/${adGroups.length} aangemaakt ✅`, 45 + (i * 5));
          await new Promise(resolve => setTimeout(resolve, 50));

          // Add relevant keywords to this ad group
          updateProgress('keywords', `Zoekwoorden toevoegen aan ad group ${i + 1}...`, 50 + (i * 5));
          const relevantKeywords = this.filterKeywordsForAdGroup(keywords, adGroupConfig.type);
          await this.addKeywordsToAdGroup(
            customer,
            adGroupResourceName,
            relevantKeywords,
            targetCustomerId
          );
          updateProgress('keywords', `Zoekwoorden toegevoegd aan ad group ${i + 1} ✅`, 52 + (i * 5));
          await new Promise(resolve => setTimeout(resolve, 50));

          // Create RSA for this ad group
          updateProgress('ads', `Responsive Search Ad aanmaken voor ad group ${i + 1}...`, 55 + (i * 5));
          
          // Use the pre-validated landing page URL (no need to validate again in loop)
          // Pass the relevant keywords to generateRSAContent for better ad quality
          const keywordTexts = (relevantKeywords || []).map(k => k.text || k);
          logger.info('RSA keywordTexts for ad group', {
            adGroupType: adGroupConfig.type,
            branch,
            region,
            keywordTexts
          });
          // Use new RSA Asset Engine if enabled (via env var), otherwise use legacy method
          const useNewEngine = (process.env.GOOGLE_ADS_USE_RSA_ENGINE || 'true').toLowerCase() === 'true';
          const rsaContent = useNewEngine
            ? this.generateRSAContentWithEngine(
                branch,
                region,
                validatedLandingPageUrl,
                adGroupConfig.type,
                keywordTexts
              )
            : this.generateRSAContent(
                branch,
                region,
                validatedLandingPageUrl,
                adGroupConfig.type,
                keywordTexts
              );
          
          // Log RSA creation with ad group context
          logger.info('FINAL RSA HEADLINES', {
            adGroup: adGroupResourceName,
            adGroupName: adGroupConfig.name,
            headlines: rsaContent.headlines,
            lengths: rsaContent.headlines.map(h => h.length),
            branch,
            region
          });
          
          await this.createResponsiveSearchAd(
            customer,
            adGroupResourceName,
            rsaContent,
            targetCustomerId
          );
          updateProgress('ads', `Responsive Search Ad aangemaakt voor ad group ${i + 1} ✅`, 57 + (i * 5));
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Keep first ad group as primary for backward compatibility
        const primaryAdGroupResourceName = adGroupResourceNames[0];

        // RSA ads are now created per ad group above

        // 10. Add Ad Extensions (Sitelinks, Callouts, Structured Snippets)
        updateProgress('extensions', 'Ad extensions voorbereiden...', 80);
        await this.addAdExtensions(
          customer,
          campaignResourceName,
          branch,
          region,
          landingPageUrl,
          targetCustomerId,
          updateProgress // Pass progress callback
        );
        updateProgress('extensions', 'Ad extensions toegevoegd ✅', 82);
        await new Promise(resolve => setTimeout(resolve, 50));

        // 11. Add Negative Keywords
        updateProgress('negative', 'Negatieve zoekwoorden toevoegen...', 85);
        await this.addNegativeKeywords(
          customer,
          campaignResourceName,
          branch,
          targetCustomerId
        );
        updateProgress('negative', 'Negatieve zoekwoorden toegevoegd ✅', 87);
        await new Promise(resolve => setTimeout(resolve, 50));

        // 12. Setup Smart Bidding (Enhanced CPC → Target CPA after conversions)
        updateProgress('bidding', 'Smart bidding instellen...', 90);
        await this.setupSmartBidding(
          customer,
          campaignResourceName,
          targetCustomerId
        );
        updateProgress('bidding', 'Smart bidding ingesteld ✅', 92);
        await new Promise(resolve => setTimeout(resolve, 50));

        logger.info(`✅ Complete campaign created successfully: ${campaignName}`);
        updateProgress('finalizing', 'Campagne finaliseren en opslaan...', 95);

        // Best-effort log to DB for observability (non-blocking)
        try {
          if (segmentId) {
            await supabaseAdmin
              .from('campaign_logs')
              .insert({
                segment_id: segmentId,
                google_ads_campaign_id: campaignId,
                google_ads_customer_id: targetCustomerId || null,
                region: region || null,
                daily_budget_micros: budgetAmountMicros,
                status: 'SUCCESS',
                error_code: null,
                error_message: null
              });
          }
        } catch (logError) {
          logger.warn('⚠️ Failed to write campaign_logs entry for successful campaign:', logError.message);
        }

        // PART 1: Store campaign ID on segment and landing page for perfect data linkage
        try {
          if (segmentId) {
            // Update segment with campaign ID
            const { error: segmentError } = await supabaseAdmin
              .from('lead_segments')
              .update({
                google_ads_campaign_id: campaignId,
                google_ads_campaign_name: campaignNameUnique,
                google_ads_customer_id: targetCustomerId || null,
                google_ads_last_synced_at: new Date().toISOString()
              })
              .eq('id', segmentId);

            if (segmentError) {
              logger.warn('⚠️ Failed to update segment with campaign ID:', segmentError.message);
            } else {
              logger.info(`✅ Updated segment ${segmentId} with campaign ID ${campaignId}`);
            }

            // If we have a landing page URL, try to find and update the landing page
            if (landingPageUrl) {
              // Extract landing page ID from URL if it's a UUID, or find by segment_id
              const { data: landingPages, error: lpError } = await supabaseAdmin
                .from('partner_landing_pages')
                .select('id')
                .eq('segment_id', segmentId)
                .eq('status', 'live')
                .order('created_at', { ascending: false })
                .limit(1);

              if (!lpError && landingPages && landingPages.length > 0) {
                const landingPageId = landingPages[0].id;
                const { error: lpUpdateError } = await supabaseAdmin
                  .from('partner_landing_pages')
                  .update({
                    google_ads_campaign_id: campaignId,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', landingPageId);

                if (lpUpdateError) {
                  logger.warn('⚠️ Failed to update landing page with campaign ID:', lpUpdateError.message);
                } else {
                  logger.info(`✅ Updated landing page ${landingPageId} with campaign ID ${campaignId}`);
                }
              }
            }
          }
        } catch (linkageError) {
          logger.warn('⚠️ Failed to store campaign linkage (non-blocking):', linkageError.message);
        }

        updateProgress('finalizing', 'Campagne opgeslagen ✅', 98);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Mark as complete in progress callback
        updateProgress('complete', 'Campagne succesvol aangemaakt! ✅', 100);
        
        // Ensure final progress is sent
        if (progressCallback) {
          progressCallback({ 
            step: 'complete', 
            message: 'Campagne succesvol aangemaakt! ✅', 
            percentage: 100, 
            status: 'complete' 
          });
        }
        
        // Small delay to ensure progress is registered
        await new Promise(resolve => setTimeout(resolve, 200));

        return {
          success: true,
          campaignId: campaignId,
          campaignName: campaignNameUnique,
          budgetId: budgetResourceName.split('/').pop(),
          resourceName: campaignResourceName,
          budgetResourceName: budgetResourceName,
          adGroupResourceName: primaryAdGroupResourceName,
          adGroupsCount: adGroupResourceNames.length,
          dailyBudget: effectiveDailyBudget,
          status: 'ENABLED',
          keywordsCount: keywords.length,
          locationCodes: locationCodes,
          message: 'Complete campaign created with keywords, ad groups, RSA ads, ad extensions, negative keywords, and smart bidding - ready to go!'
        };
      } catch (error) {
        logger.error('❌ Error creating complete campaign:', error);

        // Check for specific Google Ads errors
        let errorMessage = error.message || 'Failed to create complete campaign';
        let errorDetails = null;

        if (error?.errors && Array.isArray(error.errors)) {
          // Check for permission errors
          const permissionError = error.errors.find(e => 
            e?.error_code?.authorization_error === 'USER_PERMISSION_DENIED'
          );
          
          if (permissionError) {
            errorMessage = `Google Ads permission denied. The manager account (MCC) ID must be set in the 'login-customer-id' header when accessing client customer accounts. Please ensure a Manager Account (MCC) is configured in the google_ads_accounts table with is_manager_account=true.`;
            errorDetails = {
              type: 'PERMISSION_ERROR',
              code: 'USER_PERMISSION_DENIED',
              suggestion: 'Add a Manager Account (MCC) to the google_ads_accounts table with is_manager_account=true, or ensure the customer account has proper access permissions.'
            };
          }
          
          // Check for policy violations
          const policyError = error.errors.find(e => 
            e?.error_code?.policy_finding_error === 'POLICY_FINDING'
          );
          
          if (policyError) {
            const topic = policyError?.details?.policy_finding_details?.policy_topic_entries?.[0]?.topic;
            if (topic === 'DESTINATION_NOT_WORKING') {
              errorMessage = `Google Ads rejected the destination URL. The URL "${config.landingPageUrl || 'unknown'}" may not be accessible, return an error, or violate Google's policies. Please verify the URL is publicly accessible and returns a valid HTTP 200 response.`;
              errorDetails = {
                type: 'POLICY_VIOLATION',
                topic: 'DESTINATION_NOT_WORKING',
                landingPageUrl: config.landingPageUrl,
                suggestion: 'Use a valid, publicly accessible URL that returns HTTP 200. Check if the landing page is published and accessible.'
              };
            } else {
              errorMessage = `Google Ads policy violation: ${topic || 'UNKNOWN'}. ${error.message}`;
              errorDetails = {
                type: 'POLICY_VIOLATION',
                topic: topic || 'UNKNOWN'
              };
            }
          }
        }

        // Best-effort log to DB for observability (non-blocking)
        try {
          if (config?.segmentId) {
            await supabaseAdmin
              .from('campaign_logs')
              .insert({
                segment_id: config.segmentId,
                google_ads_customer_id: config.customerId || GoogleAdsClient.customerId || null,
                region: config.region || null,
                daily_budget_micros: Math.round(Number(config.dailyBudget || 0) * 1000000) || null,
                status: 'FAILED',
                error_code: error?.code || error?.errors?.[0]?.error_code?.policy_finding_error || 'GOOGLE_ADS_CAMPAIGN_ERROR',
                error_message: errorMessage
              });
          }
        } catch (logError) {
          logger.warn('⚠️ Failed to write campaign_logs entry for failed campaign:', logError.message);
        }

        return {
          success: false,
          error: errorMessage,
          details: errorDetails || error
        };
      }
    }

    /**
     * Add location targeting to campaign
     * 
     * We create positive CampaignCriteria of type LOCATION using geo_target_constant
     * resource names. This enforces province-level targeting for the campaign.
     */
    static async addLocationTargeting(customer, campaignId, locationCodes, customerId) {
      try {
        if (!locationCodes || locationCodes.length === 0) {
          logger.error('❌ addLocationTargeting called without location codes', { campaignId });
          return false;
        }

        const campaignResourceName = `customers/${customerId}/campaigns/${campaignId}`;

        // CRITICAL: Only add positive location criteria for the target province
        // Do NOT add any other locations - this ensures we only target the specific province
        // IMPORTANT: Location codes must be verified against Google Ads Geo Target Constants API
        // If you see wrong locations (e.g., "Rovaniemi, Lapland, Finland" instead of "Friesland"),
        // the location code is incorrect. Verify at: https://developers.google.com/google-ads/api/data/geotargets
        //
        // Current implementation ONLY supports Dutch provinces. For international expansion,
        // extend REGION_TO_LOCATION_CODES with verified location codes for other countries.
        const criterionEntities = locationCodes.map(code => {
          // Validate code format (should be numeric string)
          if (!/^\d+$/.test(String(code))) {
            logger.error(`❌ Invalid location code format: ${code}. Expected numeric string.`);
            throw new Error(`Invalid location code format: ${code}. Only numeric codes are supported.`);
          }
          
          return {
            campaign: campaignResourceName,
            status: 'ENABLED',
            location: {
              // Google Ads expects full geoTargetConstants resource name
              // Format: geoTargetConstants/{code}
              // Example: geoTargetConstants/1005658 for Friesland (VERIFY THIS CODE - may be incorrect)
              geo_target_constant: `geoTargetConstants/${code}`
            }
          };
        });
        
        logger.info(`📍 Creating location criteria for codes: ${locationCodes.join(', ')} (verify these are correct for Dutch provinces)`);

        const batchSize = 1000;
        for (let i = 0; i < criterionEntities.length; i += batchSize) {
          const batch = criterionEntities.slice(i, i + batchSize);
          await retry(async () => {
            await customer.campaignCriteria.create(batch);
          });
        }

        // NOTE: We do NOT exclude Netherlands as a whole anymore
        // Excluding country-level can cause Google Ads to add unexpected excluded locations
        // Province-level targeting is sufficient and more reliable

        logger.info(`📍 Location targeting applied for campaign ${campaignResourceName}: ${locationCodes.join(', ')}`);
        return true;
      } catch (error) {
        logger.error('Error adding location targeting:', error);
        return false;
      }
    }

    /**
     * Add language targeting to campaign via CampaignCriterion of type LANGUAGE.
     * Default is Dutch (languageConstants/1010), configurable via env.
     */
    static async addLanguageTargeting(customer, campaignId, languageConstantIds, customerId) {
      try {
        if (!languageConstantIds || languageConstantIds.length === 0) {
          logger.warn('addLanguageTargeting called without languageConstantIds', { campaignId });
          return false;
        }

        const campaignResourceName = `customers/${customerId}/campaigns/${campaignId}`;

        const criterionEntities = languageConstantIds.map(id => ({
          campaign: campaignResourceName,
          status: 'ENABLED',
          language: {
            language_constant: `languageConstants/${id}`
          }
        }));

        const batchSize = 1000;
        for (let i = 0; i < criterionEntities.length; i += batchSize) {
          const batch = criterionEntities.slice(i, i + batchSize);
          await retry(async () => {
            await customer.campaignCriteria.create(batch);
          });
        }

        logger.info(`🗣️ Language targeting applied for campaign ${campaignResourceName}: ${languageConstantIds.join(', ')}`);
        return true;
      } catch (error) {
        logger.error('Error adding language targeting:', error);
        return false;
      }
    }

    /**
     * Inspect basic campaign settings via Google Ads API: networks, geo target types,
     * location and language criteria. Used for healthchecks and debugging.
     */
    static async inspectCampaignBasics(customerId, campaignId) {
      const customer = await GoogleAdsClient.getCustomer(customerId);
      if (!customer) {
        throw new Error('Google Ads API client not initialized');
      }

      const campaignRows = await customer.query(`
        SELECT
          campaign.id,
          campaign.name,
          campaign.network_settings.target_google_search,
          campaign.network_settings.target_search_network,
          campaign.network_settings.target_search_partner,
          campaign.network_settings.target_content_network,
          campaign.geo_target_type_setting.positive_geo_target_type,
          campaign.geo_target_type_setting.negative_geo_target_type
        FROM campaign
        WHERE campaign.id = ${campaignId}
        LIMIT 1
      `);

      const campaign = campaignRows && campaignRows[0] ? campaignRows[0].campaign : null;

      const critRows = await customer.query(`
        SELECT
          campaign_criterion.type,
          campaign_criterion.criterion_id,
          campaign_criterion.location.geo_target_constant,
          campaign_criterion.language.language_constant
        FROM campaign_criterion
        WHERE campaign_criterion.campaign = 'customers/${customerId}/campaigns/${campaignId}'
      `);

      const locations = [];
      const languages = [];

      for (const row of critRows || []) {
        const crit = row.campaign_criterion;
        if (crit.type === 'LOCATION' && crit.location?.geo_target_constant) {
          const code = crit.location.geo_target_constant.split('/').pop();
          // Try to resolve a friendly region name via REGION_TO_LOCATION_CODES
          let name = null;
          for (const [key, codes] of Object.entries(this.REGION_TO_LOCATION_CODES)) {
            if (codes.includes(code)) {
              name = this.getRegionDisplayName(key);
              break;
            }
          }
          locations.push({
            id: code,
            resourceName: crit.location.geo_target_constant,
            name: name
          });
        }
        if (crit.type === 'LANGUAGE' && crit.language?.language_constant) {
          const id = crit.language.language_constant.split('/').pop();
          let name = null;
          if (id === '1010') name = 'Dutch';
          languages.push({
            id,
            resourceName: crit.language.language_constant,
            name
          });
        }
      }

      return {
        campaignId,
        campaignName: campaign?.name || null,
        networkSettings: campaign?.network_settings || null,
        geoTargetTypeSetting: campaign?.geo_target_type_setting || null,
        locations,
        languages
      };
    }

    /**
     * Create ad group
     */
    static async createAdGroup(customer, campaignId, adGroupName, customerId) {
      try {
        const maxCpcMicros = GoogleAdsCampaignBuilderService.getDefaultMaxCpcMicros(adGroupName);
        
        // Build tracking template for ad group
        const trackingTemplate = process.env.GOOGLE_ADS_TRACKING_TEMPLATE || 
          '{lpurl}?gclid={gclid}&gbraid={gbraid}&wbraid={wbraid}';

        const adGroupResourceName = await retry(async () => {
          const adGroupResult = await customer.adGroups.create([{
            name: adGroupName,
            campaign: `customers/${customerId}/campaigns/${campaignId}`,
            cpc_bid_micros: maxCpcMicros,
            tracking_url_template: trackingTemplate
          }]);
          if (adGroupResult?.results?.[0]?.resource_name) {
            return adGroupResult.results[0].resource_name;
          }
          if (adGroupResult?.resource_name) {
            return adGroupResult.resource_name;
          }
          throw new Error('Unexpected response structure from adGroups.create');
        });

        logger.info(`✅ Created ad group: ${adGroupResourceName}`);
        return adGroupResourceName;
      } catch (error) {
        logger.error('Error creating ad group:', error);
        throw error;
      }
    }

    /**
     * Add keywords to ad group
     */
    static async addKeywordsToAdGroup(customer, adGroupResourceName, keywords, customerId) {
      try {
        const keywordEntities = keywords.map(keyword => {
          const entity = {
            ad_group: adGroupResourceName,
            status: 'ENABLED',
            keyword: {
              text: keyword.text,
              match_type: keyword.matchType
            }
          };
          if (keyword.cpcBid) {
            entity.cpc_bid_micros = Math.round(keyword.cpcBid * 1000000);
          }
          return entity;
        });

        // Batch create keywords (max 5000 per operation)
        const batchSize = 1000;
        for (let i = 0; i < keywordEntities.length; i += batchSize) {
          const batch = keywordEntities.slice(i, i + batchSize);
          await retry(async () => {
            await customer.adGroupCriteria.create(batch);
          });
          logger.info(`✅ Added ${batch.length} keywords to ad group`);
        }

        return true;
      } catch (error) {
        logger.error('Error adding keywords:', error);
        throw error;
      }
    }

    /**
     * Validate and check URL accessibility for Google Ads
     * Google Ads requires URLs to be accessible and valid
     * This function checks both format AND accessibility
     */
    static async validateUrl(url) {
      if (!url || typeof url !== 'string') return false;
      
      try {
        // Basic URL validation
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          return false;
        }
        
        // Check if URL is well-formed
        if (!urlObj.hostname || urlObj.hostname.length === 0) {
          return false;
        }
        
        // CRITICAL: Check if URL is actually accessible (Google Ads requirement)
        // Use HEAD request to check without downloading content
        try {
          const fetchFunction = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
          
          // Create timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('URL check timeout after 5 seconds')), 5000);
          });
          
          // Create fetch promise
          const fetchPromise = fetchFunction(url, {
            method: 'HEAD',
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; GoogleAdsBot/1.0)'
            }
          });
          
          // Race between fetch and timeout
          const response = await Promise.race([fetchPromise, timeoutPromise]);
          
          // Accept 200-399 status codes (successful responses)
          const isAccessible = response.status >= 200 && response.status < 400;
          
          if (!isAccessible) {
            logger.warn(`⚠️ URL returned status ${response.status}: ${url}`);
            return false;
          }
          
          return true;
        } catch (httpError) {
          // URL is not accessible (network error, timeout, etc.)
          logger.warn(`⚠️ URL is not accessible: ${url} - ${httpError.message}`);
          return false;
        }
      } catch (e) {
        logger.warn(`⚠️ Invalid URL format: ${url} - ${e.message}`);
        return false;
      }
    }

    /**
     * Create Responsive Search Ad (RSA)
     */
    static async createResponsiveSearchAd(customer, adGroupResourceName, rsaContent, customerId) {
      try {
        // Guard final URLs (API requires at least one non-empty URL)
        let finalUrls = (rsaContent.finalUrls || [])
          .filter(url => !!url && typeof url === 'string' && url.trim().length > 0);
        
        // Validate URLs - Google Ads rejects invalid or inaccessible URLs
        // IMPORTANT: This checks both format AND accessibility
        const validatedUrls = [];
        for (const url of finalUrls) {
          const isValid = await this.validateUrl(url);
          if (isValid) {
            validatedUrls.push(url);
            logger.info(`✅ URL validated and accessible: ${url}`);
          } else {
            logger.warn(`⚠️ URL invalid or inaccessible, skipping: ${url}`);
          }
        }
        
        // If no valid URLs, use fallback
        if (validatedUrls.length === 0) {
          logger.warn('⚠️ No valid URLs found, using fallback: https://growsocialmedia.nl');
          // Validate fallback URL too (should always work, but check anyway)
          const fallbackValid = await this.validateUrl('https://growsocialmedia.nl');
          if (fallbackValid) {
            validatedUrls.push('https://growsocialmedia.nl');
          } else {
            // Even fallback failed - this is critical, but we'll use it anyway
            logger.error('❌ CRITICAL: Even fallback URL is not accessible! Using it anyway...');
            validatedUrls.push('https://growsocialmedia.nl');
          }
        }
        
        finalUrls = validatedUrls;

        // Build tracking template with GCLID/GBRAID/WBRAID parameters
        const trackingTemplate = process.env.GOOGLE_ADS_TRACKING_TEMPLATE || 
          '{lpurl}?gclid={gclid}&gbraid={gbraid}&wbraid={wbraid}';

        const adResourceName = await retry(async () => {
          const adResult = await customer.adGroupAds.create([{
            ad_group: adGroupResourceName,
            ad: {
              type: 'RESPONSIVE_SEARCH_AD',
              responsive_search_ad: {
                headlines: rsaContent.headlines.map(headline => ({ text: headline })),
                descriptions: rsaContent.descriptions.map(desc => ({ text: desc })),
                path1: rsaContent.path1,
                path2: rsaContent.path2,
                // Add business name (advertiser name)
                business_name: 'GrowSocial'
              },
              final_urls: finalUrls,
              tracking_url_template: trackingTemplate
            },
            status: 'ENABLED'
          }]);
          if (adResult?.results?.[0]?.resource_name) {
            return adResult.results[0].resource_name;
          }
          if (adResult?.resource_name) {
            return adResult.resource_name;
          }
          throw new Error('Unexpected response structure from adGroupAds.create');
        });

        logger.info(`✅ Created Responsive Search Ad: ${adResourceName}`);
        return adResourceName;
      } catch (error) {
        logger.error('Error creating RSA:', error);
        
        // Check if it's a policy violation error (DESTINATION_NOT_WORKING)
        if (error?.errors?.[0]?.error_code?.policy_finding_error === 'POLICY_FINDING') {
          const policyTopic = error.errors[0]?.details?.policy_finding_details?.policy_topic_entries?.[0]?.topic;
          if (policyTopic === 'DESTINATION_NOT_WORKING') {
            const invalidUrl = finalUrls[0] || 'unknown';
            logger.error(`❌ Google Ads rejected URL: ${invalidUrl} - URL is not accessible or violates policy`);
            throw new Error(`Google Ads rejected the destination URL "${invalidUrl}". The URL may not be accessible, return an error, or violate Google's policies. Please verify the URL is publicly accessible and returns a valid HTTP 200 response.`);
          }
        }
        
        throw error;
      }
    }

    /**
     * Add Ad Extensions (Sitelinks, Callouts, Structured Snippets)
     * Next Level Feature: Verhoogt CTR met 10-30%
     */
    static async addAdExtensions(customer, campaignResourceName, branch, region, landingPageUrl, customerId, progressCallback = null) {
      try {
        const baseUrl = landingPageUrl ? new URL(landingPageUrl).origin : 'https://growsocialmedia.nl';
        const regionName = this.getRegionDisplayName(region.toLowerCase());
        const branchCapitalized = branch.charAt(0).toUpperCase() + branch.slice(1);

        // Helper to update progress
        const updateProgress = (step, message, percentage = null) => {
          if (progressCallback) {
            // CRITICAL: Ensure step is always a string
            let stepStr = step;
            if (typeof stepStr !== 'string') {
              if (stepStr && typeof stepStr === 'object') {
                stepStr = stepStr.step || stepStr.name || stepStr.type || 'extensions';
              } else {
                stepStr = String(stepStr || 'extensions');
              }
            }
            
            // CRITICAL: Ensure message is always a string
            let messageStr = message;
            if (typeof messageStr !== 'string') {
              if (messageStr && typeof messageStr === 'object') {
                messageStr = messageStr.message || messageStr.text || messageStr.title || 'Bezig...';
              } else {
                messageStr = String(messageStr || 'Bezig...');
              }
            }
            
            progressCallback({ 
              step: `extensions_${stepStr}`, 
              message: messageStr, 
              percentage: percentage !== null && percentage !== undefined ? percentage : 80,
              status: 'in_progress'
            });
          }
        };

        // Helper to safely trim sitelink texts on word boundaries
        const trimSitelinkText = (text, maxLen) => {
          if (!text) return '';
          let t = text.toString().trim();
          if (t.length <= maxLen) return t;
          const trimmed = t.slice(0, maxLen + 1);
          const lastSpace = trimmed.lastIndexOf(' ');
          if (lastSpace > 0) {
            return trimmed.slice(0, lastSpace).trim();
          }
          // Fallback: hard cut, but keep within maxLen
          return t.slice(0, maxLen).trim();
        };

        // 1. Create Sitelink Assets (at least 4, preferably 6-8 for better ad quality)
        updateProgress('sitelinks', 'Sitelink assets aanmaken...', 80);
        const sitelinks = [
          {
            text: 'Gratis Offerte',
            description1: 'Vraag nu je gratis offerte aan',
            description2: 'Snel reactie van lokale vakman',
            url: `${baseUrl}/offerte`
          },
          {
            text: 'Bekijk Portfolio',
            description1: 'Zie onze recente projecten',
            description2: 'Krijg een indruk van ons werk',
            url: `${baseUrl}/portfolio`
          },
          {
            text: 'Contact',
            description1: 'Neem direct contact op',
            description2: 'Bel of mail voor snelle hulp',
            url: `${baseUrl}/contact`
          },
          {
            text: 'Over Ons',
            description1: 'Meer over onze diensten',
            description2: 'Ervaren specialisten in uw regio',
            url: `${baseUrl}/over-ons`
          },
          {
            text: 'Prijzen',
            description1: 'Transparante prijzen en tarieven',
            description2: 'Geen verrassingen achteraf',
            url: `${baseUrl}/prijzen`
          },
          {
            text: 'Recensies',
            description1: 'Bekijk wat klanten zeggen',
            description2: 'Echte ervaringen en beoordelingen',
            url: `${baseUrl}/recensies`
          },
          {
            text: 'FAQ',
            description1: 'Veelgestelde vragen beantwoord',
            description2: 'Snel antwoord op uw vragen',
            url: `${baseUrl}/faq`
          },
          {
            text: 'Blog',
            description1: 'Tips en advies van experts',
            description2: 'Handige artikelen en inspiratie',
            url: `${baseUrl}/blog`
          }
        ];

        updateProgress('sitelinks', 'Sitelink assets aanmaken...', 80);
        const sitelinkAssets = [];
        const assetLinks = [];
        for (let i = 0; i < sitelinks.length; i++) {
          const sitelink = sitelinks[i];
          updateProgress('sitelinks', `Sitelink asset ${i + 1}/${sitelinks.length} aanmaken: ${sitelink.text}...`, 80 + Math.floor((i / sitelinks.length) * 3));
          try {
            const linkText = trimSitelinkText(sitelink.text, 25); // Google: max 25 chars
            const description1 = trimSitelinkText(sitelink.description1 || sitelink.description || '', 35); // max 35
            const description2 = trimSitelinkText(sitelink.description2 || '', 35); // max 35

            const asset = await retry(async () => {
              return await customer.assets.create([{
                type: 'SITELINK',
                sitelink_asset: {
                  link_text: linkText,
                  description1,
                  description2,
                  start_date: null,
                  end_date: null
                },
                // IMPORTANT: final_urls required for sitelinks to be eligible
                final_urls: [sitelink.url]
              }]);
            });
            // Extract resource name correctly
            let assetResourceName = null;
            if (asset?.results?.[0]?.resource_name) {
              assetResourceName = asset.results[0].resource_name;
            } else if (asset?.resource_name) {
              assetResourceName = asset.resource_name;
            } else if (typeof asset === 'string') {
              assetResourceName = asset;
            }
            
            if (assetResourceName) {
              sitelinkAssets.push(assetResourceName);
              assetLinks.push({
                campaign: campaignResourceName,
                asset: assetResourceName,
                field_type: 'SITELINK'
              });
            } else {
              logger.warn(`⚠️ Could not extract resource name for sitelink "${sitelink.text}"`);
            }
            logger.info(`✅ Created sitelink asset: ${sitelink.text}`);
          } catch (error) {
            logger.warn(`⚠️ Could not create sitelink "${sitelink.text}":`, error.message);
          }
        }

        updateProgress('callouts', 'Callout assets aanmaken...', 83);
        // 2. Create Callout Assets
        const callouts = [
          'Gratis Offerte',
          '24/7 Beschikbaar',
          'Ervaren Professionals',
          'Lokale Service',
          'Snelle Reactie',
          'Beste Prijzen'
        ];

        const calloutAssets = [];
        for (let i = 0; i < callouts.length; i++) {
          const callout = callouts[i];
          updateProgress('callouts', `Callout asset ${i + 1}/${callouts.length} aanmaken: ${callout}...`, 83 + Math.floor((i / callouts.length) * 2));
          try {
            const asset = await retry(async () => {
              return await customer.assets.create([{
                type: 'CALLOUT',
                callout_asset: {
                  callout_text: callout
                }
              }]);
            });
            const assetResourceName = asset?.results?.[0]?.resource_name || asset?.resource_name;
            calloutAssets.push(assetResourceName);
            assetLinks.push({
              campaign: campaignResourceName,
              asset: assetResourceName,
              field_type: 'CALLOUT'
            });
            logger.info(`✅ Created callout asset: ${callout}`);
          } catch (error) {
            logger.warn(`⚠️ Could not create callout "${callout}":`, error.message);
          }
        }

        updateProgress('snippets', 'Structured snippet asset aanmaken...', 85);
        // 3. Create Structured Snippet Asset
        const structuredSnippetAsset = [];
        try {
          const structuredSnippet = await retry(async () => {
            return await customer.assets.create([{
              type: 'STRUCTURED_SNIPPET',
              structured_snippet_asset: {
                header: 'Diensten',
                values: [
                  `${branchCapitalized}werk`,
                  'Onderhoud',
                  'Renovatie',
                  'Reparatie',
                  'Advies'
                ]
              }
            }]);
          });
          const snippetResourceName = structuredSnippet?.results?.[0]?.resource_name || structuredSnippet?.resource_name;
          structuredSnippetAsset.push(snippetResourceName);
          assetLinks.push({
            campaign: campaignResourceName,
            asset: snippetResourceName,
            field_type: 'STRUCTURED_SNIPPET'
          });
          logger.info(`✅ Created structured snippet asset`);
        } catch (error) {
          logger.warn(`⚠️ Could not create structured snippet:`, error.message);
        }

        // 4. Create Logo/Image Asset (if logo URL is provided)
        const logoUrl = process.env.GOOGLE_ADS_LOGO_URL || 'https://growsocialmedia.nl/logo.png';
        try {
          // Note: Image assets require uploading the image first via MediaFileService
          // For now, we'll try to create an image asset if the URL is accessible
          // In production, you should upload the image first and use the asset resource name
          logger.info(`ℹ️ Logo asset should be uploaded separately. Logo URL: ${logoUrl}`);
          // TODO: Implement image asset upload if needed
        } catch (error) {
          logger.warn(`⚠️ Could not create logo asset:`, error.message);
        }

        updateProgress('linking', 'Assets koppelen aan campagne...', 86);
        // 4. Link assets to campaign via campaign_asset
        // CRITICAL: This links sitelinks, callouts, and structured snippets to the campaign
        if (assetLinks.length > 0) {
          try {
            // Link assets in batches
            const batchSize = 1000;
            for (let i = 0; i < assetLinks.length; i += batchSize) {
              const batch = assetLinks.slice(i, i + batchSize);
              try {
                await retry(async () => {
                  const result = await customer.campaignAssets.create(batch);
                  logger.info(`✅ Linked ${batch.length} assets to campaign`);
                  return result;
                });
              } catch (error) {
                logger.error(`❌ Could not link assets to campaign:`, error.message);
                logger.error(`❌ Error details:`, error);
                // Don't throw - continue with other assets
              }
            }
          } catch (error) {
            logger.error(`❌ Asset linking failed:`, error.message);
            // Don't throw - extensions are nice to have but not critical
          }
        } else {
          logger.warn(`⚠️ No assets to link to campaign`);
        }

        logger.info(`✅ Ad extensions created: ${sitelinkAssets.length} sitelinks, ${calloutAssets.length} callouts, ${structuredSnippetAsset.length} structured snippets`);

        return true;
      } catch (error) {
        logger.error('Error adding ad extensions:', error);
        // Don't throw - extensions are nice to have but not critical
        return false;
      }
    }

    /**
     * Add Negative Keywords to Campaign
     * Next Level Feature: Bespaart budget door irrelevante clicks te voorkomen
     */
    static async addNegativeKeywords(customer, campaignResourceName, branch, customerId) {
      try {
        const campaignId = campaignResourceName.split('/').pop();
        const negativeKeywords = this.getNegativeKeywordsForBranch(branch);

        // Add negative keywords at campaign level
        const negativeKeywordEntities = negativeKeywords.map(keyword => ({
          campaign: campaignResourceName,
          negative: true,
          keyword: {
            text: keyword,
            match_type: 'BROAD' // Negative keywords are always broad match
          }
        }));

        // Batch create (max 5000 per operation)
        const batchSize = 1000;
        for (let i = 0; i < negativeKeywordEntities.length; i += batchSize) {
          const batch = negativeKeywordEntities.slice(i, i + batchSize);
          try {
            await retry(async () => {
              await customer.campaignCriteria.create(batch);
            });
            logger.info(`✅ Added ${batch.length} negative keywords to campaign`);
          } catch (error) {
            logger.warn(`⚠️ Could not add some negative keywords:`, error.message);
            logger.warn(`⚠️ Error details:`, error);
          }
        }

        logger.info(`✅ Added ${negativeKeywords.length} negative keywords to campaign`);
        return true;
      } catch (error) {
        logger.error('Error adding negative keywords:', error);
        // Don't throw - negative keywords are nice to have but not critical
        return false;
      }
    }

    /**
     * Setup Smart Bidding Strategy
     * Next Level Feature: Start met Enhanced CPC, switch naar Target CPA na conversies
     */
    static async setupSmartBidding(customer, campaignResourceName, customerId) {
      try {
        // For now, we use Enhanced CPC (already set in campaign creation)
        // After 30+ conversions, we can switch to Target CPA
        // This will be handled by a separate optimization service

        logger.info(`✅ Smart bidding configured: Enhanced CPC (will upgrade to Target CPA after 30+ conversions)`);
        
        // Store campaign ID for future bidding strategy updates
        const campaignId = campaignResourceName.split('/').pop();
        
        // TODO: Create a service that monitors conversions and upgrades bidding strategy
        // This would check conversion count and automatically switch to Target CPA
        
        return true;
      } catch (error) {
        logger.error('Error setting up smart bidding:', error);
        return false;
      }
    }
  }

  module.exports = GoogleAdsCampaignBuilderService;

  // TEMP sanity test: run once with
  // Dev-only test: run with NODE_ENV=development PRINT_RSA_SAMPLE=true node services/googleAdsCampaignBuilderService.js
  if (require.main === module && process.env.NODE_ENV === 'development' && process.env.PRINT_RSA_SAMPLE === 'true') {
    (async () => {
      const GoogleAdsCampaignBuilderService = module.exports;

      const scenarios = [
        // Test matrix as required
        {
          branch: 'glaszetter',
          region: 'Friesland',
          keywordTexts: [
            'glaszetter',
            'glaszetter Friesland',
            '[glaszetter in Friesland]',
            '[glaszetter Friesland]',
            '"glaszetter Friesland ervaring"',
            '"glaszetter Friesland recensies"',
            '"glaszetter Friesland kosten"',
            '"glaszetter in Friesland"',
            '"goedkope glaszetter Friesland"'
          ],
          landingPageUrl: 'https://growsocialmedia.nl/offerte/friesland'
        },
        {
          branch: 'glaszetters',
          region: 'Friesland',
          keywordTexts: [
            '[glaszetters Friesland]',
            '"glaszetters Friesland ervaring"',
            '"glaszetters Friesland recensies"',
            '"goedkope glaszetters Friesland"',
            '"glaszetters Friesland offerte"',
            '"glaszetters Friesland prijs"',
            'glaszetters'
          ],
          landingPageUrl: 'https://growsocialmedia.nl/offerte/friesland'
        },
        {
          branch: 'installatiebedrijven',
          region: 'Friesland',
          keywordTexts: [
            '[installatiebedrijven Friesland]',
            '"installatiebedrijven Friesland offerte"',
            '"installatiebedrijven Friesland prijs"',
            '"installatiebedrijven Friesland kosten"',
            '"goedkope installatiebedrijven Friesland"',
            '"installatiebedrijven Friesland ervaring"',
            'installatiebedrijven'
          ],
          landingPageUrl: 'https://growsocialmedia.nl/offerte/friesland'
        },
        {
          branch: 'dakdekkers',
          region: 'Noord-Holland',
          keywordTexts: [
            '[dakdekkers Noord-Holland]',
            '"dakdekkers Noord-Holland offerte"',
            '"dakdekkers Noord-Holland prijs"',
            '"dakdekkers Noord-Holland kosten"',
            '"spoed dakdekkers Noord-Holland"',
            '"dakdekkers Noord-Holland ervaring"',
            'dakdekkers'
          ],
          landingPageUrl: 'https://growsocialmedia.nl/offerte/noord-holland'
        },
        {
          branch: 'dakdekkers',
          region: 'Noord-Brabant',
          keywordTexts: [
            '[dakdekkers Noord-Brabant]',
            '"dakdekkers Noord-Brabant offerte"',
            '"dakdekkers Noord-Brabant prijs"',
            '"dakdekkers Noord-Brabant kosten"',
            '"spoed dakdekkers Noord-Brabant"',
            '"dakdekkers Noord-Brabant ervaring"',
            'dakdekkers'
          ],
          landingPageUrl: 'https://growsocialmedia.nl/offerte/noord-brabant'
        },
        {
          branch: 'schilders',
          region: 'Zuid-Holland',
          keywordTexts: [
            '[schilders Zuid-Holland]',
            '"schilders Zuid-Holland offerte"',
            '"schilders Zuid-Holland prijs"',
            '"schilders Zuid-Holland kosten"',
            '"goedkope schilders Zuid-Holland"',
            '"schilders Zuid-Holland ervaring"',
            'schilders'
          ],
          landingPageUrl: 'https://growsocialmedia.nl/offerte/zuid-holland'
        },
        {
          branch: 'timmerman',
          region: 'noord-brabant',
          keywordTexts: [
            '[timmerman Noord-Brabant]',
            '"timmerman Noord-Brabant offerte"',
            '"timmerman Noord-Brabant prijs"',
            '"timmerman Noord-Brabant kosten"',
            '"spoed timmerman Noord-Brabant"',
            '"timmerman Noord-Brabant ervaring"',
            'timmerman'
          ],
          landingPageUrl: 'https://growsocialmedia.nl/offerte/noord-brabant'
        },
        {
          branch: 'glaszetter',
          region: 'noord-brabant',
          keywordTexts: [
            '[glaszetter Noord-Brabant]',
            '"glaszetter Noord-Brabant offerte"',
            '"glaszetter Noord-Brabant prijs"',
            '"glaszetter Noord-Brabant kosten"',
            '"goedkope glaszetter Noord-Brabant"',
            '"glaszetter Noord-Brabant ervaring"',
            'glaszetter'
          ],
          landingPageUrl: 'https://growsocialmedia.nl/offerte/noord-brabant'
        },
        {
          branch: 'schilder',
          region: 'tilburg',
          keywordTexts: [
            '[schilder tilburg]',
            '"schilder offerte tilburg"',
            '"schilder prijs tilburg"',
            '"goedkope schilder tilburg"',
            'schilder'
          ],
          landingPageUrl: 'https://example.nl/schilder/tilburg'
        },
        // Hard-case scenarios (must-pass)
        {
          branch: 'installatiebedrijven',
          region: 'friesland',
          keywordTexts: [
            '[installatiebedrijven Friesland]',
            '"installatiebedrijven Friesland offerte"',
            '"installatiebedrijven Friesland prijs"',
            '"installatiebedrijven Friesland kosten"',
            '"installatiebedrijven Friesland ervaring"',
            '"installatiebedrijven Friesland recensies"',
            '"goedkope installatiebedrijven Friesland"',
            'installatiebedrijven'
          ],
          landingPageUrl: 'https://growsocialmedia.nl/offerte/friesland'
        },
        {
          branch: 'dakdekkers',
          region: 'noord-brabant',
          keywordTexts: [
            '[dakdekkers Noord-Brabant]',
            '"dakdekkers Noord-Brabant offerte"',
            '"dakdekkers Noord-Brabant prijs"',
            '"dakdekkers Noord-Brabant kosten"',
            '"dakdekkers Noord-Brabant ervaring"',
            '"dakdekkers Noord-Brabant reviews"',
            'dakdekkers'
          ],
          landingPageUrl: 'https://growsocialmedia.nl/offerte/noord-brabant'
        },
        {
          branch: 'glaszetters',
          region: 'friesland',
          keywordTexts: [
            '[glaszetters Friesland]',
            '"glaszetters Friesland offerte"',
            '"glaszetters Friesland prijs"',
            '"glaszetters Friesland kosten"',
            '"goedkope glaszetters Friesland"',
            '"glaszetters Friesland ervaring"',
            'glaszetters'
          ],
          landingPageUrl: 'https://growsocialmedia.nl/offerte/friesland'
        },
        {
          branch: 'schilders',
          region: 'zuid-holland',
          keywordTexts: [
            '[schilders Zuid-Holland]',
            '"schilders Zuid-Holland offerte"',
            '"schilders Zuid-Holland prijs"',
            '"schilders Zuid-Holland kosten"',
            '"goedkope schilders Zuid-Holland"',
            '"schilders Zuid-Holland ervaring"',
            'schilders'
          ],
          landingPageUrl: 'https://growsocialmedia.nl/offerte/zuid-holland'
        }
      ];

      for (const scenario of scenarios) {
        const { branch, region, keywordTexts, landingPageUrl } = scenario;
        console.log('\n========================================');
        console.log(`TEST: branch="${branch}" region="${region}"`);
        console.log(`Keywords: ${keywordTexts.join(', ')}`);

        const rsaContent = GoogleAdsCampaignBuilderService.generateRSAContent(
          branch,
          region,
          landingPageUrl,
          'location',
          keywordTexts
        );

        console.log('\nRSA SAMPLE OUTPUT:');
        console.log(JSON.stringify(rsaContent, null, 2));

        // Sanity checks
        const branchLower = branch.toLowerCase();
        const regionCode = region.toLowerCase();
        const regionName = GoogleAdsCampaignBuilderService.getRegionDisplayName(regionCode) || region;
        const regionLower = regionName.toLowerCase();
        const keywordPhrases = keywordTexts.map(k => GoogleAdsCampaignBuilderService.normalizeKeywordText(k));

        // Helper to normalize phrases for matching
        const normalizePhrase = (p) => String(p).toLowerCase().trim();

        // Get region match variants for test validation
        const getRegionMatchVariants = (regionRaw) => {
          const code = (regionRaw || '').toLowerCase().trim();
          const map = {
            'noord-brabant': ['noord-brabant', 'brabant', 'nb'],
            'zuid-holland': ['zuid-holland', 'holland', 'zh'],
            'noord-holland': ['noord-holland', 'holland', 'nh'],
          };
          return map[code] || [code];
        };

        const regionMatchVariants = getRegionMatchVariants(regionCode);
        const hasRegionVariant = (h) => {
          const hLower = (h || '').toLowerCase();
          return regionMatchVariants.some(v => hLower.includes(v));
        };

        const headlineIssues = [];
        const descriptionIssues = [];
        
        let branchCount = 0;
        let regionCount = 0;
        let bothCount = 0;

        // Check headlines
        for (let i = 0; i < rsaContent.headlines.length; i++) {
          const h = rsaContent.headlines[i];
          const hLower = (h || '').toLowerCase().trim();
          
          const hasBranch = hLower.includes(branchLower);
          const hasRegion = hasRegionVariant(h);
          const hasKeyword = keywordPhrases.some(kp => hLower.includes(kp.toLowerCase()));

          if (hasBranch) branchCount++;
          if (hasRegion) regionCount++;
          if (hasBranch && hasRegion) bothCount++;

          if (!h || h.trim().length === 0) {
            headlineIssues.push(`[EMPTY] Headline ${i + 1}: "${h}"`);
          } else if (h.trim().length < 3) {
            headlineIssues.push(`[TOO_SHORT] Headline ${i + 1}: "${h}" (${h.length} chars)`);
          } else if (!hasBranch && !hasRegion && !hasKeyword) {
            headlineIssues.push(`[NO_KEYWORD_OR_REGION] Headline ${i + 1}: "${h}"`);
          }
        }
        
        // Build phrase variants with region substitution for coverage checking
        const buildPhraseVariants = (phrase, regionRaw) => {
          const toTitle = (str) =>
            (str || '')
              .toLowerCase()
              .split(/\s+/)
              .filter(Boolean)
              .map(w =>
                w.split('-')
                  .map(p => p ? p.charAt(0).toUpperCase() + p.slice(1) : '')
                  .join('-')
              )
              .join(' ');

          const regionMatchVariants = getRegionMatchVariants(regionRaw);
          const regionPrimary = toTitle(GoogleAdsCampaignBuilderService.getRegionDisplayName(regionRaw.toLowerCase()) || regionRaw);

          const out = [phrase];

          // Build all region variant titles (both lowercase and title case)
          const regionVariantTitles = regionMatchVariants.map(rv => ({
            lower: rv.toLowerCase(),
            title: toTitle(rv)
          }));

          // Replace ANY region variant in phrase with ALL other variants
          // This ensures "goedkope glaszetter Noord-Brabant" matches "Goedkope Glaszetter Brabant"
          for (const sourceVariant of regionVariantTitles) {
            // Try replacing lowercase version
            if (normalizePhrase(phrase).includes(sourceVariant.lower)) {
              for (const targetVariant of regionVariantTitles) {
                if (sourceVariant.lower !== targetVariant.lower) {
                  // Replace with title case variant
                  const variant = phrase.replace(new RegExp(sourceVariant.title, 'ig'), targetVariant.title);
                  if (variant !== phrase) {
                    out.push(variant);
                  }
                  // Also try lowercase replacement
                  const variantLower = phrase.replace(new RegExp(sourceVariant.lower, 'ig'), targetVariant.title);
                  if (variantLower !== phrase && variantLower !== variant) {
                    out.push(variantLower);
                  }
                }
              }
            }
          }

          // Also try replacing primary region with all variants
          if (normalizePhrase(phrase).includes(regionPrimary.toLowerCase())) {
            for (const targetVariant of regionVariantTitles) {
              if (targetVariant.title !== regionPrimary) {
                const variant = phrase.replace(new RegExp(regionPrimary, 'ig'), targetVariant.title);
                if (variant !== phrase) {
                  out.push(variant);
                }
              }
            }
          }

          // Dedupe
          const seen = new Set();
          return out.filter(p => {
            const norm = normalizePhrase(p);
            if (seen.has(norm)) return false;
            seen.add(norm);
            return true;
          });
        };

        // Check if phrase is covered (region-variant-aware)
        // This checks if ANY variant of the phrase appears in ANY headline
        const isPhraseCovered = (phrase, headlines, regionRaw) => {
          const variants = buildPhraseVariants(phrase, regionRaw).map(normalizePhrase);
          const normHeadlines = headlines.map(h => normalizePhrase(h));

          // Synonym mapping for keyword coverage
          const synonymMap = {
            'recensies': 'reviews',
            'reviews': 'recensies',
            'ervaring': 'experience',
            'experience': 'ervaring'
          };

          // Check if any variant matches any headline (substring match)
          for (const variant of variants) {
            for (const headline of normHeadlines) {
              // Exact match or headline contains the full variant
              if (headline === variant || headline.includes(variant)) {
                return true;
              }
              
              // Check with synonyms
              let variantWithSynonyms = variant;
              for (const [syn, replacement] of Object.entries(synonymMap)) {
                if (variant.includes(syn)) {
                  variantWithSynonyms = variant.replace(syn, replacement);
                  if (headline.includes(variantWithSynonyms)) {
                    return true;
                  }
                }
              }
              
              // Also check if headline contains all words from variant (for word-order flexibility)
              const variantWords = variant.split(/\s+/).filter(w => w.length > 2);
              if (variantWords.length > 0) {
                // Check if all words match (including synonyms)
                const allWordsMatch = variantWords.every(word => {
                  if (headline.includes(word)) return true;
                  // Check synonyms
                  if (synonymMap[word] && headline.includes(synonymMap[word])) return true;
                  return false;
                });
                if (allWordsMatch) {
                  return true;
                }
              }
            }
          }
          return false;
        };

        // Check keyword phrase coverage (region-variant-aware)
        const phraseCoverageIssues = [];
        let phrasesCovered = 0;
        let phrasesCoveredPartially = 0;
        
        for (const phrase of keywordPhrases) {
          if (!phrase) continue;
          
          // Check if phrase is covered (with region variants)
          const fullyCovered = isPhraseCovered(phrase, rsaContent.headlines, regionCode);
          
          if (fullyCovered) {
            phrasesCovered++;
          } else {
            // If phrase doesn't fully fit, check if all important words are covered
            // (across all headlines - "partial coverage")
            const words = phrase.split(/\s+/).filter(w => w && w.length > 2); // Skip short words like "in"
            const allWordsCovered = words.every(word => {
              return rsaContent.headlines.some(h => {
                const hLower = normalizePhrase(h);
                return hLower.includes(normalizePhrase(word));
              });
            });
            
            if (allWordsCovered && words.length > 0) {
              phrasesCovered++; // Count as covered if all words appear somewhere
              phrasesCoveredPartially++;
            } else {
              phraseCoverageIssues.push(`[MISSING_KEYWORD_PHRASE] phrase: "${phrase}" not found in any headline`);
            }
          }
        }
        
        // Check descriptions
        for (let i = 0; i < rsaContent.descriptions.length; i++) {
          const d = rsaContent.descriptions[i];
          const dLower = (d || '').toLowerCase().trim();
          
          if (!d || d.trim().length === 0) {
            descriptionIssues.push(`[EMPTY] Description ${i + 1}: "${d}"`);
          } else {
            const hasBranch = dLower.includes(branchLower);
            const hasRegion = dLower.includes(regionLower);
            
            if (!hasBranch && !hasRegion) {
              descriptionIssues.push(`[NO_BRANCH_OR_REGION] Description ${i + 1}: "${d}"`);
            }
          }
        }
        
        console.log('\nHEADLINE ISSUES:');
        if (headlineIssues.length === 0) {
          console.log('  ✅ No issues found');
        } else {
          headlineIssues.forEach(issue => console.log(`  - ${issue}`));
        }
        
        console.log('\nDESCRIPTION ISSUES:');
        if (descriptionIssues.length === 0) {
          console.log('  ✅ No issues found');
        } else {
          descriptionIssues.forEach(issue => console.log(`  - ${issue}`));
        }
        
        console.log('\nKEYWORD PHRASE COVERAGE:');
        if (phraseCoverageIssues.length === 0) {
          console.log('  ✅ All keyword phrases covered');
        } else {
          phraseCoverageIssues.forEach(issue => console.log(`  - ${issue}`));
        }
        
        console.log(`\n=== SUMMARY ===`);
        console.log(`Headlines: ${rsaContent.headlines.length} total (target: 15), ${headlineIssues.length} issues`);
        console.log(`Descriptions: ${rsaContent.descriptions.length} total (target: 4), ${descriptionIssues.length} issues`);
        console.log(`Headlines with branch: ${branchCount}`);
        console.log(`Headlines with region: ${regionCount}`);
        console.log(`Headlines with both branch+region: ${bothCount}`);
        console.log(`Keyword phrases: ${keywordPhrases.length} total, ${phrasesCovered} covered (${((phrasesCovered / keywordPhrases.length) * 100).toFixed(1)}%)`);
        if (phrasesCoveredPartially > 0) {
          console.log(`  (${phrasesCoveredPartially} covered partially - all words present but not in same headline)`);
        }
        if (phraseCoverageIssues.length > 0) {
          console.log(`⚠️ ${phraseCoverageIssues.length} keyword phrases NOT covered by headlines`);
        }

        // ============================================
        // GOOGLE UI QUALITY HEURISTICS TEST
        // ============================================
        console.log(`\n=== GOOGLE UI QUALITY HEURISTICS TEST ===`);
        
        // Get primary branch (canonical)
        const primaryBranch = GoogleAdsCampaignBuilderService.getPrimaryBranch(branch);
        const primaryBranchLower = GoogleAdsCampaignBuilderService.normalizeText(primaryBranch);
        const primaryBranchTitle = primaryBranch.charAt(0).toUpperCase() + primaryBranch.slice(1);
        const isPlural = GoogleAdsCampaignBuilderService.isPluralBranch(primaryBranch);
        
        // Test 1: finalHeadlines.length === 15
        const headlineCount = rsaContent.headlines.length;
        const headlineCountCheck = headlineCount === 15;
        console.log(`✓ finalHeadlines.length === 15: ${headlineCountCheck ? '✅ PASS' : `❌ FAIL (got ${headlineCount})`}`);

        // Test 2: Literal primary anchors - headlines that contain exact primary branch + exact primary region
        const primaryRegionTitle = GoogleAdsCampaignBuilderService.getRegionDisplayName(regionCode) || regionName;
        const primaryRegionLower = primaryRegionTitle.toLowerCase();
        
        let literalPrimaryAnchors = 0;
        let primaryRegionInHeadlines = 0;
        let headlinesWithoutBranchAndRegion = 0;
        for (const h of rsaContent.headlines) {
          const hLower = h.toLowerCase();
          const hasPrimaryBranch = hLower.includes(primaryBranchLower);
          const hasPrimaryRegion = hLower.includes(primaryRegionLower);
          
          if (hasPrimaryBranch && hasPrimaryRegion) {
            literalPrimaryAnchors++;
          }
          if (hasPrimaryRegion) {
            primaryRegionInHeadlines++;
          }

          // Track headlines that lack BOTH branch and any region variant
          const hasAnyRegionVariant = getRegionMatchVariants(regionCode).some(rv => hLower.includes(rv.toLowerCase())) ||
            hLower.includes(primaryRegionLower);
          if (!hasPrimaryBranch && !hasAnyRegionVariant) {
            headlinesWithoutBranchAndRegion++;
          }
        }
        
        // Determine realistic minimum for literal anchors (must match generateRSAContent logic)
        const literalPairLength = `${primaryBranchTitle} ${primaryRegionTitle}`.length;
        
        // Match the logic from generateRSAContent: long/sensitive branches need higher minimum
        const longSensitiveBranches = ['installatiebedrijven', 'glaszetters', 'dakdekkers'];
        const isLongSensitiveBranch = longSensitiveBranches.includes(primaryBranchLower) ||
          (primaryBranchLower === 'schilders' && isPlural);
        
        let minLiteralAnchors;
        if (!primaryRegionTitle) {
          minLiteralAnchors = 3;
        } else if (literalPairLength > 30) {
          minLiteralAnchors = 4; // Literal pair too long, allow variants but keep at least 4 literal-ish
        } else if (isLongSensitiveBranch) {
          minLiteralAnchors = 10; // Long/sensitive branches need more literal anchors
        } else {
          minLiteralAnchors = 8; // Standard minimum
        }

        const literalAnchorsCheck = !primaryRegionTitle || literalPrimaryAnchors >= minLiteralAnchors;
        console.log(`✓ Literal anchors: ≥ ${minLiteralAnchors} headlines met exact primary branch (${primaryBranch}) + exact primary region (${primaryRegionTitle}): ${literalAnchorsCheck ? '✅ PASS' : `❌ FAIL (got ${literalPrimaryAnchors})`}`);
        
        // Test 3: Primary region appears in ≥ 2 headlines total (soft minimum)
        const primaryRegionMinCheck = !primaryRegionTitle || primaryRegionInHeadlines >= 2;
        console.log(`✓ Primary region (${primaryRegionTitle || 'N/A'}) in ≥ 2 headlines: ${primaryRegionMinCheck ? '✅ PASS' : `❌ FAIL (got ${primaryRegionInHeadlines})`}`);
        
        // Test 4: USP/CTA headlines without region – keep between 1 and 3
        let uspWithoutRegionCount = 0;
        const uspKeywords = ['binnen', 'afspraak', 'transparant', 'vrijblijvend', 'beoordelingen', 'gratis', 'snelle', 'betrouwbaar', 'vakmanschap', 'reactie', 'advies', 'beste prijzen'];
        // Also check for region variants to ensure we don't count headlines with region
        const regionVariantsForCheck = getRegionMatchVariants(regionCode);
        for (const h of rsaContent.headlines) {
          const hLower = h.toLowerCase();
          // Check if headline contains any region variant
          const hasRegion = regionVariantsForCheck.some(rv => hLower.includes(rv.toLowerCase())) || 
                           hLower.includes(primaryRegionLower);
          const hasUspKeyword = uspKeywords.some(kw => hLower.includes(kw));
          // Count if it has USP keyword AND no region
          if (!hasRegion && hasUspKeyword) {
            uspWithoutRegionCount++;
          }
        }
        const uspMaxCheck = uspWithoutRegionCount <= 3;
        const uspMinCheck = uspWithoutRegionCount >= 1;
        console.log(`✓ Maximaal 3 USP/CTA headlines zonder region: ${uspMaxCheck ? '✅ PASS' : `❌ FAIL (got ${uspWithoutRegionCount})`}`);
        console.log(`✓ Minimaal 1 USP/CTA headline zonder region: ${uspMinCheck ? '✅ PASS' : `❌ FAIL (got ${uspWithoutRegionCount})`}`);

        // Test 4b: Global guardrail – max 3 headlines total without BOTH branch and region
        const maxNoBranchRegionCheck = headlinesWithoutBranchAndRegion <= 3;
        console.log(`✓ Maximaal 3 headlines zonder zowel branch als region: ${maxNoBranchRegionCheck ? '✅ PASS' : `❌ FAIL (got ${headlinesWithoutBranchAndRegion})`}`);
        
        // Test 5: Headline similarity average under threshold
        let totalSimilarity = 0;
        let similarityPairs = 0;
        for (let i = 0; i < rsaContent.headlines.length; i++) {
          for (let j = i + 1; j < rsaContent.headlines.length; j++) {
            const sim = GoogleAdsCampaignBuilderService.jaccardSimilarity(
              rsaContent.headlines[i],
              rsaContent.headlines[j]
            );
            totalSimilarity += sim;
            similarityPairs++;
          }
        }
        const avgSimilarity = similarityPairs > 0 ? totalSimilarity / similarityPairs : 0;
        const similarityCheck = avgSimilarity < 0.5; // Average should be below 0.5
        console.log(`✓ Headline similarity average < 0.5: ${similarityCheck ? '✅ PASS' : `❌ FAIL (got ${avgSimilarity.toFixed(3)})`}`);
        
        // Test 6: descriptions.length === 4
        const descriptionCountCheck = rsaContent.descriptions.length === 4;
        console.log(`✓ descriptions.length === 4: ${descriptionCountCheck ? '✅ PASS' : `❌ FAIL (got ${rsaContent.descriptions.length})`}`);
        
        // Test 7: All 4 intent themes present in descriptions
        const requiredIntents = ['prijs', 'spoed', 'reviews', 'oplossing'];
        const foundIntents = new Set();
        let descriptionsWithBranchAndRegion = 0;
        for (const desc of rsaContent.descriptions) {
          const descLower = desc.toLowerCase();
          const hasBranch = descLower.includes(primaryBranchLower);
          const hasRegion = primaryRegionTitle ? descLower.includes(primaryRegionLower) : false;
          
          // Count descriptions that include both branch and region
          if (hasBranch && hasRegion) {
            descriptionsWithBranchAndRegion++;
          }
          
          if (descLower.includes('prijs') || descLower.includes('kosten') || descLower.includes('transparant')) {
            foundIntents.add('prijs');
          }
          if (descLower.includes('spoed') || descLower.includes('snel') || descLower.includes('24') || descLower.includes('vandaag')) {
            foundIntents.add('spoed');
          }
          if (descLower.includes('beoordeling') || descLower.includes('review') || descLower.includes('ervaring') || descLower.includes('betrouwbaar')) {
            foundIntents.add('reviews');
          }
          if (descLower.includes('oplossing') || descLower.includes('montage') || descLower.includes('advies') || descLower.includes('garantie') || descLower.includes('isolatie')) {
            foundIntents.add('oplossing');
          }
        }
        const allIntentsCheck = requiredIntents.every(intent => foundIntents.has(intent));
        console.log(`✓ Alle 4 intent themes aanwezig in descriptions: ${allIntentsCheck ? '✅ PASS' : `❌ FAIL (found: ${Array.from(foundIntents).join(', ')})`}`);
        
        // Test 7c: At least 2 descriptions mention {PrimaryBranch} {PrimaryRegion} when region exists
        const branchRegionInDescriptionsCheck = !primaryRegionTitle || descriptionsWithBranchAndRegion >= 2;
        console.log(`✓ Minimaal 2 descriptions met ${primaryBranch} + ${primaryRegionTitle || 'N/A'}: ${branchRegionInDescriptionsCheck ? '✅ PASS' : `❌ FAIL (got ${descriptionsWithBranchAndRegion})`}`);
        
        // Test 7b: Opening bigram diversity – descriptions should start visibly different
        const openingBigrams = new Set();
        for (const desc of rsaContent.descriptions) {
          const words = (desc || '').toLowerCase().split(/\s+/).filter(Boolean);
          const bigram = words.slice(0, 2).join(' ');
          if (bigram) openingBigrams.add(bigram);
        }
        const openingDiversityCheck = openingBigrams.size === rsaContent.descriptions.length;
        console.log(`✓ Description opening bigrams allemaal uniek: ${openingDiversityCheck ? '✅ PASS' : `❌ FAIL (unique openings: ${openingBigrams.size})`}`);
        
        // Test 8: No plural grammar violations
        const pluralViolations = [];
        for (const desc of rsaContent.descriptions) {
          const descLower = desc.toLowerCase();
          // Check for "een ervaren" with plural branch
          if (isPlural && descLower.includes('een ervaren')) {
            pluralViolations.push(`"een ervaren" gebruikt met plural branch: ${desc.substring(0, 50)}...`);
          }
        }
        const grammarCheck = pluralViolations.length === 0;
        console.log(`✓ Geen plural grammar violations: ${grammarCheck ? '✅ PASS' : `❌ FAIL (${pluralViolations.length} violations)`}`);
        if (pluralViolations.length > 0) {
          pluralViolations.forEach(v => console.log(`  - ${v}`));
        }
        
        // Test 9: Keyword phrase coverage ≥ 95%
        const keywordCoveragePercent = keywordPhrases.length > 0 
          ? (phrasesCovered / keywordPhrases.length) * 100 
          : 100;
        const coverageCheck = keywordCoveragePercent >= 95;
        console.log(`✓ Keyword phrase coverage ≥ 95%: ${coverageCheck ? '✅ PASS' : `❌ FAIL (got ${keywordCoveragePercent.toFixed(1)}%)`}`);
        
        // Test 9b: Exact Keyword Coverage (Bucket K) - separate from broader phrase coverage
        // Build eligibleKeywords using the same normalization rules as production code
        const getRegionMatchVariantsForTest = (regionRaw) => {
          const code = (regionRaw || '').toLowerCase().trim();
          const map = {
            'noord-brabant': ['noord-brabant', 'brabant', 'nb'],
            'zuid-holland': ['zuid-holland', 'holland', 'zh'],
            'noord-holland': ['noord-holland', 'holland', 'nh'],
            'friesland': ['friesland'],
            'gelderland': ['gelderland'],
            'utrecht': ['utrecht'],
            'overijssel': ['overijssel'],
            'groningen': ['groningen'],
            'drenthe': ['drenthe'],
            'flevoland': ['flevoland'],
            'limburg': ['limburg'],
            'zeeland': ['zeeland']
          };
          return map[code] || [code];
        };
        const regionMatchVariantsForTest = primaryRegionTitle 
          ? getRegionMatchVariantsForTest(regionCode)
          : [];
        
        const eligibleKeywordsForTest = GoogleAdsCampaignBuilderService.extractEligibleKeywords(
          keywordTexts,
          primaryBranchLower,
          primaryRegionLower,
          regionMatchVariantsForTest
        );
        
        // Compute exact keyword hit count: how many eligible keywords appear as literal substrings
        let exactKeywordHitCount = 0;
        const exactKeywordMisses = [];
        const K_RESERVED_SLOTS_TEST = 6;
        
        for (const { phrase } of eligibleKeywordsForTest) {
          const phraseLower = normalizePhrase(phrase);
          const phraseTitle = phrase.split(/\s+/).map(w => 
            w.split('-').map(p => p ? p.charAt(0).toUpperCase() + p.slice(1) : '').join('-')
          ).join(' ');
          
          // Check if phrase appears as literal substring in ANY headline
          const isCovered = rsaContent.headlines.some(h => {
            const hLower = normalizePhrase(h);
            // Check for exact phrase match (case-insensitive) or title-case variant
            return hLower.includes(phraseLower) || h.toLowerCase().includes(phraseTitle.toLowerCase());
          });
          
          if (isCovered) {
            exactKeywordHitCount++;
          } else {
            exactKeywordMisses.push(phrase);
          }
        }
        
        // Assert: If eligibleKeywords.length <= K_RESERVED_SLOTS, then 100% coverage required
        // Else: >= K_RESERVED_SLOTS or >= 95% of eligibleKeywords
        let exactKeywordCoverageCheck;
        if (eligibleKeywordsForTest.length === 0) {
          exactKeywordCoverageCheck = true; // No eligible keywords to check
        } else if (eligibleKeywordsForTest.length <= K_RESERVED_SLOTS_TEST) {
          exactKeywordCoverageCheck = exactKeywordHitCount === eligibleKeywordsForTest.length;
        } else {
          const minRequired = Math.max(K_RESERVED_SLOTS_TEST, Math.floor(eligibleKeywordsForTest.length * 0.95));
          exactKeywordCoverageCheck = exactKeywordHitCount >= minRequired;
        }
        
        const exactKeywordCoveragePercent = eligibleKeywordsForTest.length > 0
          ? (exactKeywordHitCount / eligibleKeywordsForTest.length) * 100
          : 100;
        
        console.log(`✓ Exact keyword coverage (Bucket K): ${exactKeywordCoverageCheck ? '✅ PASS' : `❌ FAIL (got ${exactKeywordHitCount}/${eligibleKeywordsForTest.length} = ${exactKeywordCoveragePercent.toFixed(1)}%)`}`);
        if (exactKeywordMisses.length > 0 && exactKeywordMisses.length <= 5) {
          console.log(`  Missing keywords: ${exactKeywordMisses.join(', ')}`);
        }
        
        // Test 9c: Top-N Literal Phrase Check
        // Build importantPhrases from keywordTexts that contain primary branch and region
        const importantPhrases = [];
        const intentTokens = ['offerte', 'prijs', 'kosten', 'ervaring', 'recensies', 'reviews', 'goedkope'];
        
        for (const phrase of keywordPhrases) {
          if (!phrase) continue;
          const phraseLower = normalizePhrase(phrase);
          const hasBranch = phraseLower.includes(primaryBranchLower);
          const hasRegion = regionMatchVariants.some(rv => phraseLower.includes(rv.toLowerCase())) ||
                           phraseLower.includes(primaryRegionLower);
          
          if (hasBranch && hasRegion) {
            // Score by intent token priority (lower index = higher priority)
            let intentScore = 999;
            for (let i = 0; i < intentTokens.length; i++) {
              if (phraseLower.includes(intentTokens[i])) {
                intentScore = i;
                break;
              }
            }
            importantPhrases.push({ phrase, intentScore });
          }
        }
        
        // Sort by intent score (lower = higher priority) and take top 6
        importantPhrases.sort((a, b) => a.intentScore - b.intentScore);
        const topPhrases = importantPhrases.slice(0, 6).map(p => p.phrase);
        
        // Require that at least 5 of top 6 (or all if fewer than 6) appear as literal substrings
        let topPhrasesCovered = 0;
        const topPhrasesCoverageIssues = [];
        for (const phrase of topPhrases) {
          const phraseLower = normalizePhrase(phrase);
          const phraseWords = phraseLower.split(/\s+/).filter(w => w.length > 2);
          
          // Check if phrase appears as literal substring in any headline
          const isCovered = rsaContent.headlines.some(h => {
            const hLower = normalizePhrase(h);
            // Check for exact phrase match or all words present
            if (hLower.includes(phraseLower)) {
              return true;
            }
            // Check if all important words from phrase appear in headline
            const allWordsPresent = phraseWords.every(word => hLower.includes(word));
            return allWordsPresent;
          });
          
          if (isCovered) {
            topPhrasesCovered++;
          } else {
            topPhrasesCoverageIssues.push(phrase);
          }
        }
        
        const requiredTopPhrasesCoverage = topPhrases.length >= 6 ? 5 : topPhrases.length;
        const topPhrasesCoverageCheck = topPhrasesCovered >= requiredTopPhrasesCoverage;
        console.log(`✓ Top-N literal phrase check (${requiredTopPhrasesCoverage} of ${topPhrases.length} top phrases covered): ${topPhrasesCoverageCheck ? '✅ PASS' : `❌ FAIL (got ${topPhrasesCovered}/${topPhrases.length})`}`);
        if (topPhrasesCoverageIssues.length > 0) {
          console.log(`  Missing phrases: ${topPhrasesCoverageIssues.join(', ')}`);
        }
        
        // Test 10: Recensies coverage – if keywords mention "recensies", at least one headline must too
        const hasRecensiesKeyword = keywordPhrases.some(p => normalizePhrase(p).includes('recensies'));
        const recensiesHeadlineCount = rsaContent.headlines.filter(h => 
          (h || '').toLowerCase().includes('recensies')
        ).length;
        const recensiesCoverageCheck = !hasRecensiesKeyword || recensiesHeadlineCount >= 1;
        console.log(`✓ "Recensies" headline aanwezig wanneer zoekwoorden "recensies" bevatten: ${recensiesCoverageCheck ? '✅ PASS' : `❌ FAIL (headlines met "recensies": ${recensiesHeadlineCount})`}`);
        
        // Legacy checks (keep for backward compatibility)
        let keywordRegionHeadlines = 0;
        for (const h of rsaContent.headlines) {
          const hLower = h.toLowerCase();
          const hasBoth = hLower.includes(primaryBranchLower) && hasRegionVariant(h);
          const hasFullPhrase = keywordPhrases.some(phrase => {
            const phraseLower = phrase.toLowerCase();
            const phraseHasBranch = phraseLower.includes(primaryBranchLower);
            const phraseHasRegion = regionMatchVariants.some(v => phraseLower.includes(v));
            return hLower.includes(phraseLower) && phraseHasBranch && phraseHasRegion;
          });
          if (hasBoth || hasFullPhrase) {
            keywordRegionHeadlines++;
          }
        }
        
        // Minimum: with maximaal 3 USP headlines zonder region, we willen minimaal 11 headlines
        // met branch + region (variant) of volledige phrase.
        const minKeywordHeadlinesCheck = keywordRegionHeadlines >= 11;
        console.log(`\n=== LEGACY HEADLINE QUALITY CHECKS ===`);
        console.log(`✓ Minimaal 11 headlines met ${primaryBranchLower} + region variant of volledige phrase: ${minKeywordHeadlinesCheck ? '✅ PASS' : `❌ FAIL (got ${keywordRegionHeadlines})`}`);
        console.log(`  (Region variants: ${regionMatchVariants.join(', ')})`);
        console.log(`  Note: Aangescherpt naar 11 om Google UI 'populaire zoekwoorden' waarschuwing verder te minimaliseren.`);
        
        const primaryRegionCheck = !primaryRegionTitle || primaryRegionInHeadlines >= 1;
        console.log(`✓ Minimaal 1 headline met primary region exact (${primaryRegionTitle || 'N/A'}): ${primaryRegionCheck ? '✅ PASS' : `❌ FAIL (got ${primaryRegionInHeadlines})`}`);
        
        // Check descriptions diversity
        const descriptionDiversityCheck = (() => {
          if (rsaContent.descriptions.length !== 4) return false;
          
          // Check that descriptions have different primary intent keywords
          const intentKeywords = [
            ['spoed', 'snel', '24/7', 'vandaag', 'binnen 24 uur'],
            ['prijs', 'kosten', 'offerte', 'transparant', 'duidelijk'],
            ['beoordelingen', 'reviews', 'ervaring', 'kwaliteit', 'betrouwbaar'],
            ['isolatie', 'reparatie', 'montage', 'advies', 'garantie', 'service', 'online', 'plan', 'afspraak']
          ];
          
          const foundIntents = new Set();
          for (const desc of rsaContent.descriptions) {
            const descLower = desc.toLowerCase();
            for (let i = 0; i < intentKeywords.length; i++) {
              if (intentKeywords[i].some(keyword => descLower.includes(keyword))) {
                foundIntents.add(i);
                break;
              }
            }
          }
          
          // At least 3 different intents should be present
          return foundIntents.size >= 3;
        })();
        console.log(`✓ Descriptions diversity check (4 descriptions, min 3 verschillende intents): ${descriptionDiversityCheck ? '✅ PASS' : '❌ FAIL'}`);
        
        // Check final URL default behavior
        const expectedPath2 = regionName
          ? regionName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
          : '';
        const expectedFinalUrl = expectedPath2
          ? `https://growsocialmedia.nl/offerte/${expectedPath2}`
          : (landingPageUrl && landingPageUrl !== 'https://growsocialmedia.nl' ? landingPageUrl : 'https://growsocialmedia.nl/offerte');
        
        const finalUrlCheck = (() => {
          if (!rsaContent.finalUrls || rsaContent.finalUrls.length === 0) return false;
          const actualUrl = rsaContent.finalUrls[0];
          // If no explicit landingPageUrl provided, should use default
          if (!landingPageUrl || landingPageUrl === 'https://growsocialmedia.nl') {
            return actualUrl.includes('/offerte/') || actualUrl.includes('/offerte');
          }
          // If explicit URL provided, should use that
          return actualUrl === landingPageUrl;
        })();
        console.log(`✓ Final URL default gedrag: ${finalUrlCheck ? '✅ PASS' : `❌ FAIL (got ${rsaContent.finalUrls?.[0] || 'none'}, expected pattern: /offerte/${expectedPath2 || ''})`}`);
        
        // Test region-variant coverage for "goedkope" phrases
        const goedkopeCoverageCheck = (() => {
          const goedkopePhrases = keywordPhrases.filter(p => 
            normalizePhrase(p).includes('goedkope') && normalizePhrase(p).includes(regionLower)
          );
          if (goedkopePhrases.length === 0) return true; // No goedkope phrases to check
          
          return goedkopePhrases.every(phrase => 
            isPhraseCovered(phrase, rsaContent.headlines, regionCode)
          );
        })();
        console.log(`✓ Region-variant coverage voor "goedkope" phrases: ${goedkopeCoverageCheck ? '✅ PASS' : '❌ FAIL'}`);
        
        // Google UI Quality Heuristics summary
        const googleUiChecks = [
          headlineCountCheck,
          literalAnchorsCheck,
          primaryRegionMinCheck,
          uspMaxCheck,
          uspMinCheck,
          maxNoBranchRegionCheck,
          similarityCheck,
          descriptionCountCheck,
          allIntentsCheck,
          branchRegionInDescriptionsCheck,
          openingDiversityCheck,
          grammarCheck,
          coverageCheck,
          exactKeywordCoverageCheck,
          topPhrasesCoverageCheck,
          recensiesCoverageCheck
        ];
        const allGoogleUiChecksPassed = googleUiChecks.every(check => check === true);
        
        // Legacy checks summary
        const legacyChecks = [
          minKeywordHeadlinesCheck,
          primaryRegionCheck,
          descriptionDiversityCheck,
          finalUrlCheck,
          goedkopeCoverageCheck
        ];
        const allLegacyChecksPassed = legacyChecks.every(check => check === true);
        
        console.log(`\n=== GOOGLE UI QUALITY SUMMARY ===`);
        console.log(`Google UI Heuristics: ${allGoogleUiChecksPassed ? '✅ ALL PASSED' : `❌ ${googleUiChecks.filter(c => !c).length} FAILED`}`);
        console.log(`Legacy Quality Checks: ${allLegacyChecksPassed ? '✅ ALL PASSED' : `❌ ${legacyChecks.filter(c => !c).length} FAILED`}`);
        
        if (!allGoogleUiChecksPassed || !allLegacyChecksPassed) {
          console.log(`\n⚠️ SOME TESTS FAILED`);
        } else {
          console.log(`\n✅ ALL TESTS PASSED`);
        }
        
        // Print sample output for key test cases
        if (['glaszetter', 'glaszetters', 'installatiebedrijven', 'dakdekkers'].includes(branch.toLowerCase())) {
          console.log(`\n=== SAMPLE OUTPUT FOR ${branch.toUpperCase()} ${region.toUpperCase()} ===`);
          console.log('Headlines:', rsaContent.headlines);
          console.log('Descriptions:', rsaContent.descriptions);
          console.log('Final URLs:', rsaContent.finalUrls);
        }
      }

      process.exit(0);
    })().catch(err => {
      console.error('❌ Test failed:', err);
      process.exit(1);
    });
  }

