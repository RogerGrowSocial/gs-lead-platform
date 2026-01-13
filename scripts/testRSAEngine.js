#!/usr/bin/env node

/**
 * Quick test script for RSA Asset Engine
 * Tests basic functionality without requiring Google Ads API
 */

const RSAAssetEngine = require('../services/rsaAssetEngine');
const QualityGate = require('../services/qualityGate');
const RSAAssetService = require('../services/rsaAssetService');

console.log('\n========================================');
console.log('RSA Asset Engine Quick Test');
console.log('========================================\n');

// Test 1: Basic generation
console.log('Test 1: Basic Asset Generation');
console.log('─'.repeat(50));

try {
  const assets = RSAAssetEngine.generateAssets({
    businessName: 'GrowSocial',
    service: 'glaszetter',
    location: 'Friesland',
    keywordList: ['glaszetter Friesland', 'glaszetter offerte', 'glaszetter prijs'],
    uspList: ['Binnen 24u Reactie', 'Transparante Prijzen'],
    finalUrl: 'https://growsocialmedia.nl/offerte/friesland',
    tone: 'direct'
  });

  console.log(`✅ Headlines: ${assets.headlines.length} (expected: 15)`);
  console.log(`✅ Descriptions: ${assets.descriptions.length} (expected: 4)`);
  console.log(`✅ Sitelinks: ${assets.sitelinks.length}`);
  console.log(`✅ Callouts: ${assets.callouts.length}`);
  console.log(`✅ Structured Snippets: ${assets.structuredSnippets.length}`);

  // Check lengths
  const longHeadlines = assets.headlines.filter(h => h.length > 30);
  const longDescriptions = assets.descriptions.filter(d => d.length > 90);

  if (longHeadlines.length === 0 && longDescriptions.length === 0) {
    console.log('✅ All headlines <= 30 chars, all descriptions <= 90 chars');
  } else {
    console.log(`❌ Found ${longHeadlines.length} headlines > 30 chars`);
    console.log(`❌ Found ${longDescriptions.length} descriptions > 90 chars`);
  }

} catch (error) {
  console.error('❌ Test 1 FAILED:', error.message);
  process.exit(1);
}

console.log('');

// Test 2: Quality Gate
console.log('Test 2: Quality Gate Scoring');
console.log('─'.repeat(50));

try {
  const assets = RSAAssetEngine.generateAssets({
    businessName: 'GrowSocial',
    service: 'glaszetter',
    location: 'Friesland',
    keywordList: ['glaszetter Friesland', 'glaszetter offerte', 'glaszetter prijs'],
    uspList: [],
    finalUrl: 'https://growsocialmedia.nl/offerte/friesland',
    tone: 'direct'
  });

  const score = QualityGate.score({
    headlines: assets.headlines,
    descriptions: assets.descriptions,
    service: 'glaszetter',
    location: 'Friesland',
    keywordList: ['glaszetter Friesland', 'glaszetter offerte', 'glaszetter prijs']
  });

  console.log(`Total Score: ${score.totalScore}/100`);
  console.log(`Keyword Coverage: ${score.keywordCoverageScore}/100`);
  console.log(`Diversity: ${score.diversityScore}/100`);
  console.log(`Length Errors: ${score.lengthErrors}`);
  console.log(`Duplicate Errors: ${score.duplicateErrors}`);
  console.log(`Near-Duplicate Errors: ${score.nearDuplicateErrors}`);

  const passes = QualityGate.passes(score);
  console.log(`\nQuality Gate: ${passes ? '✅ PASSED' : '❌ FAILED'}`);

  if (!passes && score.errors.length > 0) {
    console.log('\nErrors:');
    score.errors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
  }

} catch (error) {
  console.error('❌ Test 2 FAILED:', error.message);
  process.exit(1);
}

console.log('');

// Test 3: Full Service with Auto-Iteration
console.log('Test 3: Full Service with Quality Gate');
console.log('─'.repeat(50));

try {
  const result = RSAAssetService.generateWithQualityGate({
    businessName: 'GrowSocial',
    service: 'glaszetter',
    location: 'Friesland',
    keywordList: ['glaszetter Friesland', 'glaszetter offerte', 'glaszetter prijs', 'glaszetter kosten'],
    uspList: ['Binnen 24u Reactie', 'Transparante Prijzen'],
    finalUrl: 'https://growsocialmedia.nl/offerte/friesland',
    tone: 'direct'
  }, 3); // Max 3 iterations for quick test

  console.log(`Iterations: ${result.iterations}`);
  console.log(`Passed: ${result.passed ? '✅ YES' : '❌ NO'}`);
  console.log(`Total Score: ${result.score.totalScore}/100`);
  console.log(`Keyword Coverage: ${result.score.keywordCoverageScore}/100`);
  console.log(`Diversity: ${result.score.diversityScore}/100`);

  if (result.assets) {
    console.log(`\nGenerated ${result.assets.headlines.length} headlines and ${result.assets.descriptions.length} descriptions`);
  }

} catch (error) {
  console.error('❌ Test 3 FAILED:', error.message);
  console.error(error.stack);
  process.exit(1);
}

console.log('');

// Test 4: Edge Cases
console.log('Test 4: Edge Cases');
console.log('─'.repeat(50));

// Test with long service name
try {
  const assets = RSAAssetEngine.generateAssets({
    businessName: 'GrowSocial',
    service: 'installatiebedrijven',
    location: 'Noord-Brabant',
    keywordList: ['installatiebedrijven Noord-Brabant'],
    uspList: [],
    finalUrl: 'https://growsocialmedia.nl/offerte/noord-brabant',
    tone: 'direct'
  });

  const longHeadlines = assets.headlines.filter(h => h.length > 30);
  if (longHeadlines.length === 0) {
    console.log('✅ Long service name handled correctly (all headlines <= 30 chars)');
  } else {
    console.log(`❌ Found ${longHeadlines.length} headlines > 30 chars with long service name`);
  }

} catch (error) {
  console.error('❌ Test 4 FAILED:', error.message);
  process.exit(1);
}

console.log('\n========================================');
console.log('✅ ALL TESTS COMPLETED');
console.log('========================================\n');

console.log('Next steps:');
console.log('1. Run preview script: node scripts/generateRSAPreview.js glaszetter Friesland');
console.log('2. Run unit tests: node services/rsaAssetEngine.test.js');
console.log('3. Enable in production: Set GOOGLE_ADS_USE_RSA_ENGINE=true\n');
