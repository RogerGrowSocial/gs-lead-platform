const logger = require('../utils/logger');
const { isNearDuplicate, findNearDuplicates, jaccardSimilarity } = require('../utils/similarity');

/**
 * Quality Gate for RSA Assets
 * Scores and validates RSA assets to ensure they meet Google Ads quality standards
 * Returns PASS if totalScore >= 80, keywordCoverageScore >= 75, diversityScore >= 75, and all errors are zero
 */
class QualityGate {
  /**
   * Score RSA assets
   * 
   * @param {Object} assets - RSA assets to score
   * @param {string[]} assets.headlines - Array of headlines (must be 15)
   * @param {string[]} assets.descriptions - Array of descriptions (must be 4)
   * @param {string} assets.service - Service name
   * @param {string} assets.location - Location name
   * @param {string[]} assets.keywordList - Array of keywords
   * @returns {Object} Score object with errors and scores
   */
  static score(assets) {
    const { headlines = [], descriptions = [], service, location, keywordList = [] } = assets;

    // Initialize score object
    const score = {
      lengthErrors: 0,
      duplicateErrors: 0,
      nearDuplicateErrors: 0,
      keywordCoverageScore: 0,
      diversityScore: 0,
      totalScore: 0,
      errors: [],
      warnings: []
    };

    // 1. Length validation
    const lengthIssues = this.validateLengths(headlines, descriptions);
    score.lengthErrors = lengthIssues.length;
    score.errors.push(...lengthIssues);

    // 2. Duplicate validation
    const duplicateIssues = this.validateDuplicates(headlines, descriptions);
    score.duplicateErrors = duplicateIssues.length;
    score.errors.push(...duplicateIssues);

    // 3. Near-duplicate validation
    const nearDuplicateIssues = this.validateNearDuplicates(headlines, descriptions);
    score.nearDuplicateErrors = nearDuplicateIssues.length;
    score.errors.push(...nearDuplicateIssues);

    // 4. Keyword coverage scoring
    score.keywordCoverageScore = this.scoreKeywordCoverage(headlines, service, location, keywordList);

    // 5. Diversity scoring
    score.diversityScore = this.scoreDiversity(headlines, descriptions, service, location);

    // 6. Calculate total score (weighted)
    score.totalScore = this.calculateTotalScore(score);

    return score;
  }

  /**
   * Validate headline and description lengths
   */
  static validateLengths(headlines, descriptions) {
    const errors = [];

    // Headlines must be exactly 15
    if (headlines.length !== 15) {
      errors.push(`Headlines count must be 15, got ${headlines.length}`);
    }

    // Each headline must be <= 30 chars
    headlines.forEach((h, i) => {
      if (h.length > 30) {
        errors.push(`Headline ${i + 1} exceeds 30 chars: "${h}" (${h.length} chars)`);
      }
    });

    // Descriptions must be exactly 4
    if (descriptions.length !== 4) {
      errors.push(`Descriptions count must be 4, got ${descriptions.length}`);
    }

    // Each description must be <= 90 chars
    descriptions.forEach((d, i) => {
      if (d.length > 90) {
        errors.push(`Description ${i + 1} exceeds 90 chars: "${d}" (${d.length} chars)`);
      }
    });

    return errors;
  }

  /**
   * Validate exact duplicates (case-insensitive)
   */
  static validateDuplicates(headlines, descriptions) {
    const errors = [];

    // Check headline duplicates
    const headlineDupes = this.findExactDuplicates(headlines);
    headlineDupes.forEach(({ index1, index2, text }) => {
      errors.push(`Duplicate headlines at ${index1 + 1} and ${index2 + 1}: "${text}"`);
    });

    // Check description duplicates
    const descDupes = this.findExactDuplicates(descriptions);
    descDupes.forEach(({ index1, index2, text }) => {
      errors.push(`Duplicate descriptions at ${index1 + 1} and ${index2 + 1}: "${text}"`);
    });

    return errors;
  }

  /**
   * Find exact duplicates (case-insensitive, normalized)
   */
  static findExactDuplicates(strings) {
    const duplicates = [];
    const seen = new Map();

    strings.forEach((str, index) => {
      const normalized = str.toLowerCase().trim();
      if (seen.has(normalized)) {
        duplicates.push({
          index1: seen.get(normalized),
          index2: index,
          text: str
        });
      } else {
        seen.set(normalized, index);
      }
    });

    return duplicates;
  }

  /**
   * Validate near-duplicates
   */
  static validateNearDuplicates(headlines, descriptions) {
    const errors = [];

    // Check headline near-duplicates
    const headlineDupes = findNearDuplicates(headlines, 0.7, 0.3);
    headlineDupes.forEach(({ index1, index2, str1, str2 }) => {
      errors.push(`Near-duplicate headlines at ${index1 + 1} and ${index2 + 1}: "${str1}" ~ "${str2}"`);
    });

    // Check description near-duplicates
    const descDupes = findNearDuplicates(descriptions, 0.6, 0.3);
    descDupes.forEach(({ index1, index2, str1, str2 }) => {
      errors.push(`Near-duplicate descriptions at ${index1 + 1} and ${index2 + 1}: "${str1}" ~ "${str2}"`);
    });

    return errors;
  }

  /**
   * Score keyword coverage
   * At least 6/15 headlines must include primary keyword or "service + location"
   * At least 2 additional keyword variants must appear across remaining headlines
   */
  static scoreKeywordCoverage(headlines, service, location, keywordList) {
    if (!service || !location || headlines.length === 0) return 0;

    const serviceLower = service.toLowerCase();
    const locationLower = location.toLowerCase();
    const primaryPhrase = `${serviceLower} ${locationLower}`;
    
    // Count headlines with primary keyword or service + location
    let primaryCount = 0;
    const keywordVariantsFound = new Set();

    headlines.forEach(headline => {
      const headlineLower = headline.toLowerCase();
      
      // Check for primary phrase
      if (headlineLower.includes(primaryPhrase) || 
          (headlineLower.includes(serviceLower) && headlineLower.includes(locationLower))) {
        primaryCount++;
      }

      // Check for keyword variants
      keywordList.forEach(keyword => {
        const normalized = keyword.toLowerCase().replace(/[\[\]"]/g, '').trim();
        if (headlineLower.includes(normalized)) {
          keywordVariantsFound.add(normalized);
        }
      });
    });

    // Score calculation
    // - Primary coverage: 6/15 = 100%, each headline = 16.67 points (max 100)
    const primaryScore = Math.min(100, (primaryCount / 6) * 100);
    
    // - Variant coverage: 2+ variants = 100%, each variant = 50 points (max 100)
    const variantScore = Math.min(100, (keywordVariantsFound.size / 2) * 100);

    // Weighted average: 60% primary, 40% variants
    const totalScore = (primaryScore * 0.6) + (variantScore * 0.4);

    return Math.round(totalScore);
  }

  /**
   * Score diversity
   * Checks:
   * - Max 2 headlines start with same first word
   * - At least 3 benefit/USP headlines
   * - At least 2 price/offer headlines
   * - At least 2 CTA headlines
   * - At least 2 location-specific headlines
   * - Description diversity (different angles)
   */
  static scoreDiversity(headlines, descriptions, service, location) {
    if (headlines.length === 0 || descriptions.length === 0) return 0;

    let diversityScore = 0;
    const maxScore = 100;
    const checks = [];

    // 1. First word diversity (max 2 headlines with same first word)
    const firstWordCounts = new Map();
    headlines.forEach(h => {
      const firstWord = h.split(/\s+/)[0]?.toLowerCase();
      if (firstWord) {
        firstWordCounts.set(firstWord, (firstWordCounts.get(firstWord) || 0) + 1);
      }
    });

    const maxFirstWordCount = Math.max(...Array.from(firstWordCounts.values()), 0);
    const firstWordScore = maxFirstWordCount <= 2 ? 20 : Math.max(0, 20 - (maxFirstWordCount - 2) * 5);
    diversityScore += firstWordScore;
    checks.push({ name: 'First word diversity', score: firstWordScore, max: 20 });

    // 2. Benefit/USP headlines (at least 3)
    const uspKeywords = ['binnen', 'afspraak', 'transparant', 'vrijblijvend', 'snelle', 'betrouwbaar', 'vakmanschap', 'reactie', 'advies', 'beste prijzen'];
    const uspCount = headlines.filter(h => {
      const hLower = h.toLowerCase();
      return uspKeywords.some(kw => hLower.includes(kw));
    }).length;
    const uspScore = Math.min(20, (uspCount / 3) * 20);
    diversityScore += uspScore;
    checks.push({ name: 'USP headlines', score: uspScore, max: 20, count: uspCount, required: 3 });

    // 3. Price/Offer headlines (at least 2)
    const priceKeywords = ['prijs', 'kosten', 'offerte', 'gratis', 'transparant'];
    const priceCount = headlines.filter(h => {
      const hLower = h.toLowerCase();
      return priceKeywords.some(kw => hLower.includes(kw));
    }).length;
    const priceScore = Math.min(15, (priceCount / 2) * 15);
    diversityScore += priceScore;
    checks.push({ name: 'Price/Offer headlines', score: priceScore, max: 15, count: priceCount, required: 2 });

    // 4. CTA headlines (at least 2)
    const ctaKeywords = ['vraag', 'contact', 'direct', 'nu', 'aanvragen'];
    const ctaCount = headlines.filter(h => {
      const hLower = h.toLowerCase();
      return ctaKeywords.some(kw => hLower.includes(kw));
    }).length;
    const ctaScore = Math.min(15, (ctaCount / 2) * 15);
    diversityScore += ctaScore;
    checks.push({ name: 'CTA headlines', score: ctaScore, max: 15, count: ctaCount, required: 2 });

    // 5. Location-specific headlines (at least 2)
    const locationLower = location ? location.toLowerCase() : '';
    const locationCount = headlines.filter(h => {
      const hLower = h.toLowerCase();
      return locationLower && hLower.includes(locationLower);
    }).length;
    const locationScore = Math.min(15, (locationCount / 2) * 15);
    diversityScore += locationScore;
    checks.push({ name: 'Location headlines', score: locationScore, max: 15, count: locationCount, required: 2 });

    // 6. Description diversity (different angles)
    const descAngles = [];
    descriptions.forEach(desc => {
      const descLower = desc.toLowerCase();
      if (descLower.includes('spoed') || descLower.includes('snel') || descLower.includes('24')) {
        descAngles.push('speed');
      } else if (descLower.includes('prijs') || descLower.includes('kosten') || descLower.includes('transparant')) {
        descAngles.push('price');
      } else if (descLower.includes('beoordeling') || descLower.includes('review') || descLower.includes('kwaliteit')) {
        descAngles.push('quality');
      } else if (descLower.includes('advies') || descLower.includes('montage') || descLower.includes('garantie')) {
        descAngles.push('process');
      } else {
        descAngles.push('other');
      }
    });

    const uniqueAngles = new Set(descAngles).size;
    const descScore = Math.min(15, (uniqueAngles / 4) * 15);
    diversityScore += descScore;
    checks.push({ name: 'Description angles', score: descScore, max: 15, uniqueAngles, required: 4 });

    return Math.round(Math.min(maxScore, diversityScore));
  }

  /**
   * Calculate total weighted score
   */
  static calculateTotalScore(score) {
    // Weights:
    // - Errors: -10 points per error (capped at -50)
    // - Keyword coverage: 40% of total
    // - Diversity: 40% of total
    // - Base: 20% (if no errors)

    const errorPenalty = Math.min(50, (score.lengthErrors + score.duplicateErrors + score.nearDuplicateErrors) * 10);
    const baseScore = errorPenalty === 0 ? 20 : 0;

    const keywordWeight = 0.4;
    const diversityWeight = 0.4;
    const baseWeight = 0.2;

    const totalScore = 
      (baseScore * baseWeight) +
      (score.keywordCoverageScore * keywordWeight) +
      (score.diversityScore * diversityWeight) -
      errorPenalty;

    return Math.round(Math.max(0, Math.min(100, totalScore)));
  }

  /**
   * Check if assets pass quality gate
   * PASS if:
   * - totalScore >= 80
   * - keywordCoverageScore >= 75
   * - diversityScore >= 75
   * - All errors are zero
   */
  static passes(score) {
    return (
      score.totalScore >= 80 &&
      score.keywordCoverageScore >= 75 &&
      score.diversityScore >= 75 &&
      score.lengthErrors === 0 &&
      score.duplicateErrors === 0 &&
      score.nearDuplicateErrors === 0
    );
  }

  /**
   * Auto-iterate to fix failing dimensions
   * Returns suggestions for fixing issues
   */
  static suggestFixes(score, assets) {
    const suggestions = [];

    // Fix length errors
    if (score.lengthErrors > 0) {
      suggestions.push({
        type: 'length',
        action: 'Trim headlines to <= 30 chars and descriptions to <= 90 chars',
        priority: 'high'
      });
    }

    // Fix duplicate errors
    if (score.duplicateErrors > 0) {
      suggestions.push({
        type: 'duplicate',
        action: 'Remove or rewrite duplicate headlines/descriptions',
        priority: 'high'
      });
    }

    // Fix near-duplicate errors
    if (score.nearDuplicateErrors > 0) {
      suggestions.push({
        type: 'nearDuplicate',
        action: 'Increase variation in similar headlines/descriptions',
        priority: 'high'
      });
    }

    // Fix keyword coverage
    if (score.keywordCoverageScore < 75) {
      suggestions.push({
        type: 'keywordCoverage',
        action: 'Add more headlines with primary keyword or service + location phrase',
        priority: 'high'
      });
    }

    // Fix diversity
    if (score.diversityScore < 75) {
      suggestions.push({
        type: 'diversity',
        action: 'Increase headline diversity: add more USP, price, CTA, and location headlines',
        priority: 'medium'
      });
    }

    return suggestions;
  }
}

module.exports = QualityGate;
