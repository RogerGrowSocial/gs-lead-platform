# Google Ads RSA Ad Strength Diagnostic Report

**Date:** 2025-01-27  
**Branch:** timmerman  
**Region:** Noord-Brabant  
**Issue:** Ad Strength showing "Slecht / Poor" despite multiple refactors

---

## A. Current RSA & Keyword Code Paths

### File: `services/googleAdsCampaignBuilderService.js`

### 1. `generateRSAContent()` - Main RSA Content Generator

**Location:** Lines 586-806

```javascript
static generateRSAContent(branch, region, landingPageUrl, adGroupType = 'location', keywordTexts = []) {
  const branchLower = (branch || '').toLowerCase().trim();
  const regionRaw = (region || '').trim();

  // Use getRegionDisplayName for proper capitalization
  let regionName = regionRaw;
  if (typeof GoogleAdsCampaignBuilderService.getRegionDisplayName === 'function') {
    regionName = GoogleAdsCampaignBuilderService.getRegionDisplayName(regionRaw.toLowerCase()) || regionRaw;
  }

  const capitalizeWords = (str) => {
    return (str || '')
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const regionCap = regionName ? capitalizeWords(regionName) : '';
  const keywordPhrases = GoogleAdsCampaignBuilderService.buildNormalizedKeywordPhrases(keywordTexts || []);

  // Helper to get shorter main word for certain branches
  const getBranchMainWord = (branchLower) => {
    if (!branchLower) return '';
    if (branchLower.includes('installatiebedrijven')) return 'installateur';
    if (branchLower.includes('loodgieters')) return 'loodgieter';
    if (branchLower.includes('schoonmaakbedrijven')) return 'schoonmaker';
    return branchLower;
  };

  const branchMainWord = getBranchMainWord(branchLower);
  const branchCap = capitalizeWords(branchLower);
  const branchMainCap = capitalizeWords(branchMainWord);
  const regionLabel = regionCap || 'Uw Regio';
  const baseWithRegion = regionCap && branchCap ? `${branchCap} ${regionCap}` : branchCap || branchMainCap;

  // Local helpers
  const cleanKeywordText = (text) => {
    if (!text) return '';
    let s = String(text).trim();
    s = s.replace(/[\[\]"]/g, '');
    s = s.replace(/\s+/g, ' ');
    return s.trim();
  };

  const toTitleCase = (text) => {
    return cleanKeywordText(text)
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const headlineTooSimilar = (h1, h2) => {
    const t1 = (h1 || '').toLowerCase().split(/\s+/).filter(Boolean);
    const t2 = (h2 || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!t1.length || !t2.length) return false;
    const minLen = Math.min(t1.length, t2.length);
    const same = t1.filter((tok, idx) => t2[idx] === tok).length;
    return (same / minLen) >= 0.8;
  };

  const pushHeadline = (arr, text, used) => {
    if (!text) return;
    const trimmed = GoogleAdsCampaignBuilderService.trimHeadlineTo30(text);
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (/\b(in|met|zonder)$/.test(lower)) return;
    for (const existing of arr) {
      if (headlineTooSimilar(existing, trimmed)) return;
    }
    const key = lower;
    if (used.has(key)) return;
    used.add(key);
    arr.push(trimmed);
  };

  // 2) Extract keyword-based modifiers
  const modifiers = {
    offerte: false,
    prijs: false,
    prijzen: false,
    kosten: false,
    recensies: false,
    ervaring: false,
    ervaringen: false,
    goedkoop: false,
  };

  for (const phrase of keywordPhrases) {
    const p = phrase.toLowerCase();
    if (p.includes('offerte')) modifiers.offerte = true;
    if (p.includes('prijs')) modifiers.prijs = true;
    if (p.includes('prijzen')) modifiers.prijzen = true;
    if (p.includes('kosten')) modifiers.kosten = true;
    if (p.includes('recensie')) modifiers.recensies = true;
    if (p.includes('ervaring')) modifiers.ervaring = true;
    if (p.includes('ervaringen')) modifiers.ervaringen = true;
    if (p.includes('goedkope') || p.includes('goedkoop')) modifiers.goedkoop = true;
  }

  // 3) Build keyword-mirroring headlines
  const headlines = [];
  const usedHeadlines = new Set();

  // 3.1 base exact phrase
  if (baseWithRegion) {
    pushHeadline(headlines, baseWithRegion, usedHeadlines);
  }

  // 3.2 keyword-style combinations with modifiers
  const keywordStyleCombos = [];
  if (baseWithRegion) {
    keywordStyleCombos.push(`${baseWithRegion} Offerte`);
    keywordStyleCombos.push(`${baseWithRegion} Prijs`);
    keywordStyleCombos.push(`${baseWithRegion} Kosten`);
    keywordStyleCombos.push(`${baseWithRegion} Recensies`);
    keywordStyleCombos.push(`${baseWithRegion} Ervaring`);
  }
  if (modifiers.goedkoop && regionCap) {
    keywordStyleCombos.push(`Goedkope ${branchCap} ${regionCap}`);
  }

  for (const combo of keywordStyleCombos) {
    if (combo.length <= 30) {
      pushHeadline(headlines, combo, usedHeadlines);
    }
  }

  // 3.3 actual keyword phrases if fit
  for (const phrase of keywordPhrases) {
    const lower = phrase.toLowerCase();
    if (!branchMainWord || !regionName) continue;
    if (!lower.includes(branchMainWord) && !lower.includes(branchLower)) continue;
    if (!lower.includes(regionName.toLowerCase())) continue;
    const cap = toTitleCase(phrase);
    if (cap.length <= 30) {
      pushHeadline(headlines, cap, usedHeadlines);
    }
    if (headlines.length >= 8) break;
  }

  // 4) Variation headlines
  const uspHeadlines = [
    `Lokale ${branchMainCap} In ${regionLabel}`,
    `Ervaren ${branchMainCap}`,
    `9+ Beoordelingen In ${regionLabel}`,
    `Transparante Prijzen, Geen Verrassingen`,
    `Afspraak Is Afspraak`,
    `Binnen 24u Reactie`,
    `Vandaag Nog Geholpen`,
    `Altijd Duidelijke Offerte Vooraf`,
    `Vakwerk Binnen En Buiten`
  ];
  for (const h of uspHeadlines) {
    if (headlines.length >= 15) break;
    pushHeadline(headlines, h, usedHeadlines);
  }

  const ctaHeadlines = [
    `Vrijblijvende Offerte Aanvragen`,
    `Direct ${branchMainCap} Nodig?`,
    `Professionele ${branchMainCap}`,
    `Vraag Nu Je Offerte Aan`,
    `Direct Vrijblijvend Advies`
  ];
  for (const h of ctaHeadlines) {
    if (headlines.length >= 15) break;
    pushHeadline(headlines, h, usedHeadlines);
  }

  // Ensure min 10 headlines by adding region/core variants
  if (headlines.length < 10 && baseWithRegion) {
    const fillers = [
      `${branchMainCap} In ${regionLabel}`,
      `${branchMainCap} ${regionCap}`.trim(),
      `${branchCap} ${regionCap}`.trim()
    ];
    for (const f of fillers) {
      if (headlines.length >= 10) break;
      pushHeadline(headlines, f, usedHeadlines);
    }
  }

  const finalHeadlines = headlines.slice(0, 15);

  // 5) Descriptions with varied angles
  const branchLabel = branchMainWord || branchLower || 'vakman';
  const descriptionsRaw = [
    `Vind snel een ${branchLabel} in ${regionLabel}. Vrijblijvende offerte en snelle reactie.`,
    `Heldere prijzen voor ${branchLabel} in ${regionLabel}. Geen verrassingen achteraf.`,
    `Klanten in ${regionLabel} beoordelen onze ${branchLabel} met een 9+. Kies voor kwaliteit.`,
    `Spoedklus in ${regionLabel}? Binnen 24u een ${branchLabel} ter plaatse, ook in het weekend.`,
  ];

  const descriptions = descriptionsRaw
    .map(d => GoogleAdsCampaignBuilderService.trimDescriptionTo90(d))
    .filter(d => d && d.length >= 60 && d.length <= 90);

  if (descriptions.length < 2) {
    const fallback = `Zoek je een ${branchLabel} in ${regionLabel}? Vraag een vrijblijvende offerte aan.`;
    descriptions.push(GoogleAdsCampaignBuilderService.trimDescriptionTo90(fallback));
  }

  // 6) Preserve path1/path2 and return structure
  const finalUrls = [landingPageUrl || 'https://growsocialmedia.nl'];

  const path1 = 'offerte';
  let path2 = regionName.toLowerCase() || '';
  if (path2.length > 15) {
    path2 = path2.slice(0, 15);
  }

  return {
    headlines: finalHeadlines,
    descriptions,
    finalUrls,
    path1,
    path2
  };
}
```

### 2. Helper Functions Used by RSA Generation

#### `normalizeKeywordText()` - Lines 494-501

```javascript
static normalizeKeywordText(keyword) {
  if (!keyword) return '';
  let s = String(keyword).trim();
  s = s.replace(/[\[\]"]/g, '');   // remove [] and "
  s = s.replace(/\+/g, '');        // remove +
  s = s.replace(/\s+/g, ' ');
  return s.toLowerCase().trim();
}
```

#### `buildNormalizedKeywordPhrases()` - Lines 504-517

```javascript
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
```

#### `trimHeadlineTo30()` - Lines 520-550

```javascript
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
```

#### `trimDescriptionTo90()` - Lines 553-575

```javascript
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
```

### 3. `createResponsiveSearchAd()` - RSA Creation Function

**Location:** Lines 1741-1824

```javascript
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
```

### 4. Keyword Generation Functions

#### `generateKeywords()` - Lines 366-414

```javascript
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
```

#### `filterKeywordsForAdGroup()` - Lines 445-491

```javascript
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
```

### 5. RSA Content Generation Call Site

**Location:** Lines 1182-1188 (within `createCompleteCampaign()`)

```javascript
const keywordTexts = (relevantKeywords || []).map(k => k.text || k);
logger.info('RSA keywordTexts for ad group', {
  adGroupType: adGroupConfig.type,
  branch,
  region,
  keywordTexts
});
const rsaContent = this.generateRSAContent(
  branch,
  region,
  validatedLandingPageUrl,
  adGroupConfig.type,
  keywordTexts
);
```

---

## B. RSA Sample Output (timmerman Noord-Brabant)

**Test Parameters:**
- Branch: `timmerman`
- Region: `Noord-Brabant`
- Landing Page URL: `https://growsocialmedia.nl/offerte/noord-brabant`
- Ad Group Type: `location`
- Keywords: `['timmerman Noord-Brabant', 'timmerman Noord-Brabant offerte', 'timmerman Noord-Brabant prijs', 'timmerman Noord-Brabant kosten', 'timmerman in Noord-Brabant']`

**Generated RSA Content:**

```json
{
  "headlines": [
    "Timmerman Noord-Brabant",
    "Timmerman In Noord-brabant",
    "Ervaren Timmerman",
    "Transparante Prijzen, Geen",
    "Afspraak Is Afspraak",
    "Binnen 24u Reactie",
    "Vandaag Nog Geholpen",
    "Altijd Duidelijke Offerte",
    "Vakwerk Binnen En Buiten",
    "Vrijblijvende Offerte",
    "Direct Timmerman Nodig?",
    "Professionele Timmerman",
    "Vraag Nu Je Offerte Aan",
    "Direct Vrijblijvend Advies"
  ],
  "descriptions": [
    "Vind snel een timmerman in Noord-Brabant. Vrijblijvende offerte en snelle reactie.",
    "Heldere prijzen voor timmerman in Noord-Brabant. Geen verrassingen achteraf.",
    "Klanten in Noord-Brabant beoordelen onze timmerman met een 9+. Kies voor kwaliteit.",
    "Spoedklus in Noord-Brabant? Binnen 24u een timmerman ter plaatse, ook in het weekend."
  ],
  "finalUrls": [
    "https://growsocialmedia.nl/offerte/noord-brabant"
  ],
  "path1": "offerte",
  "path2": "noord-brabant"
}
```

**Observations:**
- **Total Headlines:** 14 (Google requires minimum 3, recommends 15)
- **Total Descriptions:** 4 (Google requires minimum 2, maximum 4)
- **Headline Lengths:** All ≤ 30 characters ✅
- **Description Lengths:** All between 60-90 characters ✅

---

## C. Automated Sanity Check on RSA Content

**Sanity Check Results:**

```
HEADLINE ISSUES:
  - [NO_KEYWORD_OR_REGION] Headline 4: "Transparante Prijzen, Geen"
  - [NO_KEYWORD_OR_REGION] Headline 5: "Afspraak Is Afspraak"
  - [NO_KEYWORD_OR_REGION] Headline 6: "Binnen 24u Reactie"
  - [NO_KEYWORD_OR_REGION] Headline 7: "Vandaag Nog Geholpen"
  - [NO_KEYWORD_OR_REGION] Headline 8: "Altijd Duidelijke Offerte"
  - [NO_KEYWORD_OR_REGION] Headline 9: "Vakwerk Binnen En Buiten"
  - [NO_KEYWORD_OR_REGION] Headline 10: "Vrijblijvende Offerte"
  - [NO_KEYWORD_OR_REGION] Headline 13: "Vraag Nu Je Offerte Aan"
  - [NO_KEYWORD_OR_REGION] Headline 14: "Direct Vrijblijvend Advies"

DESCRIPTION ISSUES:
  ✅ No issues found

=== SUMMARY ===
Headlines: 14 total, 9 issues
Descriptions: 4 total, 0 issues
```

**Key Findings:**
1. **9 out of 14 headlines (64%)** do NOT contain the branch word ("timmerman"), region word ("noord-brabant"), or any keyword phrase
2. **All descriptions** contain both branch and region ✅
3. **No duplicate or overly similar descriptions** ✅
4. **Headline 4 is truncated:** "Transparante Prijzen, Geen" (should be "Transparante Prijzen, Geen Verrassingen" but was cut at 30 chars)

---

## D. Brief Analysis

Based on the code review, generated content, and sanity checks, here are the most likely reasons Google's Ad Strength shows "Slecht / Poor":

### 1. **Low Keyword Relevance in Headlines (CRITICAL)**
   - **64% of headlines (9/14) lack branch/region/keywords** - Google's Ad Strength algorithm heavily weights keyword relevance
   - Generic headlines like "Afspraak Is Afspraak" and "Binnen 24u Reactie" don't signal relevance to search queries
   - Google requires headlines to be "relevant to your keywords" for good Ad Strength

### 2. **Insufficient Headline Variation with Keywords**
   - Only 3 headlines (21%) contain both branch AND region: "Timmerman Noord-Brabant", "Timmerman In Noord-brabant", "Ervaren Timmerman"
   - Google recommends at least 8-10 headlines with keyword variations for optimal Ad Strength
   - The keyword-mirroring logic (lines 715-726) breaks early at `headlines.length >= 8`, preventing more keyword-based headlines

### 3. **Truncated Headline**
   - Headline 4: "Transparante Prijzen, Geen" is incomplete (cut mid-sentence)
   - Google penalizes incomplete/truncated headlines in Ad Strength calculations
   - The original text "Transparante Prijzen, Geen Verrassingen" (35 chars) was trimmed to 30, breaking the sentence

### 4. **Generic USP Headlines Override Keyword Headlines**
   - The code prioritizes generic USP headlines (lines 729-743) over keyword-based headlines
   - USP headlines are added AFTER keyword headlines but fill up slots, leaving only 3 keyword-rich headlines
   - Google's algorithm needs more keyword density across headlines

### 5. **Missing Keyword Modifier Integration**
   - Keywords include modifiers like "offerte", "prijs", "kosten" but only 1 headline ("Vrijblijvende Offerte") uses them
   - The modifier detection logic (lines 664-685) exists but doesn't generate enough modifier-based headlines
   - Keyword-style combos (lines 697-713) are created but many exceed 30 chars and are rejected

### 6. **Headline Similarity Filter Too Aggressive**
   - The `headlineTooSimilar()` function (lines 639-646) uses 80% token similarity threshold
   - This may be filtering out valid variations that would improve Ad Strength
   - Google actually benefits from some headline variations even if they share words

### 7. **Insufficient Headline Count for Optimal Ad Strength**
   - Google recommends **15 headlines** for best Ad Strength (we have 14)
   - More headlines = more combinations Google can test = better Ad Strength
   - The code limits to 15 but stops early in some loops

### 8. **Keyword Phrase Matching Logic Too Restrictive**
   - Lines 718-720 require BOTH branch AND region in keyword phrases to create headlines
   - This excludes valid keyword variations like "timmerman offerte" (no region) that could improve relevance
   - The early break at line 725 (`if (headlines.length >= 8) break`) prevents exploring more keyword combinations

### 9. **Description Quality is Good, But Headlines Drive Ad Strength**
   - Descriptions are well-formed and contain keywords ✅
   - However, **Google's Ad Strength primarily evaluates headlines** (they appear more prominently)
   - Poor headline quality can't be compensated by good descriptions

### 10. **Missing Pin Strategy**
   - No pinned headlines (Google allows pinning 3 headlines to positions 1-3)
   - Pinning keyword-rich headlines to position 1 can improve Ad Strength
   - The current code doesn't implement pinning

---

## Recommendations for External Assistant

When fixing the Ad Strength issue, focus on:

1. **Increase keyword-rich headlines** from 3 to at least 8-10 (currently only 21% of headlines contain keywords)
2. **Fix truncated headline** "Transparante Prijzen, Geen" - either shorten the original text or use a different headline
3. **Reduce generic USP headlines** - replace some with keyword variations
4. **Improve keyword modifier integration** - create more headlines with "offerte", "prijs", "kosten" from keywords
5. **Relax similarity filter** or adjust logic to allow more keyword variations
6. **Ensure 15 headlines** are always generated (currently 14)
7. **Consider pinning strategy** for keyword-rich headlines to positions 1-3
8. **Review keyword phrase matching** - allow headlines with branch OR region, not always both

---

**End of Diagnostic Report**
