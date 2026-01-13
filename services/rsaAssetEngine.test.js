/**
 * Unit tests for RSA Asset Engine
 * Run with: node services/rsaAssetEngine.test.js
 */

const RSAAssetEngine = require('./rsaAssetEngine');
const assert = require('assert');

function testHeadlineGeneration() {
  console.log('Testing headline generation...');
  
  const assets = RSAAssetEngine.generateAssets({
    businessName: 'GrowSocial',
    service: 'glaszetter',
    location: 'Friesland',
    keywordList: ['glaszetter Friesland', 'glaszetter offerte', 'glaszetter prijs'],
    uspList: [],
    finalUrl: 'https://growsocialmedia.nl/offerte/friesland',
    tone: 'direct'
  });

  // Test: Exactly 15 headlines
  assert.strictEqual(assets.headlines.length, 15, 'Should generate exactly 15 headlines');
  console.log('✅ Headline count: PASS');

  // Test: All headlines <= 30 chars
  const longHeadlines = assets.headlines.filter(h => h.length > 30);
  assert.strictEqual(longHeadlines.length, 0, 'All headlines should be <= 30 chars');
  console.log('✅ Headline length: PASS');

  // Test: No exact duplicates
  const normalized = assets.headlines.map(h => h.toLowerCase().trim());
  const unique = new Set(normalized);
  assert.strictEqual(unique.size, assets.headlines.length, 'No duplicate headlines');
  console.log('✅ Headline uniqueness: PASS');

  console.log('✅ All headline tests passed\n');
}

function testDescriptionGeneration() {
  console.log('Testing description generation...');
  
  const assets = RSAAssetEngine.generateAssets({
    businessName: 'GrowSocial',
    service: 'glaszetter',
    location: 'Friesland',
    keywordList: [],
    uspList: [],
    finalUrl: 'https://growsocialmedia.nl/offerte/friesland',
    tone: 'direct'
  });

  // Test: Exactly 4 descriptions
  assert.strictEqual(assets.descriptions.length, 4, 'Should generate exactly 4 descriptions');
  console.log('✅ Description count: PASS');

  // Test: All descriptions <= 90 chars
  const longDescriptions = assets.descriptions.filter(d => d.length > 90);
  assert.strictEqual(longDescriptions.length, 0, 'All descriptions should be <= 90 chars');
  console.log('✅ Description length: PASS');

  // Test: No exact duplicates
  const normalized = assets.descriptions.map(d => d.toLowerCase().trim());
  const unique = new Set(normalized);
  assert.strictEqual(unique.size, assets.descriptions.length, 'No duplicate descriptions');
  console.log('✅ Description uniqueness: PASS');

  console.log('✅ All description tests passed\n');
}

function testSitelinksGeneration() {
  console.log('Testing sitelinks generation...');
  
  const assets = RSAAssetEngine.generateAssets({
    businessName: 'GrowSocial',
    service: 'glaszetter',
    location: 'Friesland',
    keywordList: [],
    uspList: [],
    finalUrl: 'https://growsocialmedia.nl/offerte/friesland',
    tone: 'direct'
  });

  // Test: Sitelinks generated
  assert(assets.sitelinks && assets.sitelinks.length > 0, 'Should generate sitelinks');
  assert(assets.sitelinks.length <= 8, 'Should generate max 8 sitelinks');
  console.log('✅ Sitelinks count: PASS');

  // Test: Each sitelink has required fields
  assets.sitelinks.forEach((sl, i) => {
    assert(sl.text, `Sitelink ${i + 1} should have text`);
    assert(sl.text.length <= 25, `Sitelink ${i + 1} text should be <= 25 chars`);
    assert(sl.url, `Sitelink ${i + 1} should have URL`);
  });
  console.log('✅ Sitelinks structure: PASS');

  console.log('✅ All sitelinks tests passed\n');
}

function testCalloutsGeneration() {
  console.log('Testing callouts generation...');
  
  const assets = RSAAssetEngine.generateAssets({
    businessName: 'GrowSocial',
    service: 'glaszetter',
    location: 'Friesland',
    keywordList: [],
    uspList: [],
    finalUrl: 'https://growsocialmedia.nl/offerte/friesland',
    tone: 'direct'
  });

  // Test: Callouts generated
  assert(assets.callouts && assets.callouts.length > 0, 'Should generate callouts');
  assert(assets.callouts.length <= 10, 'Should generate max 10 callouts');
  console.log('✅ Callouts count: PASS');

  // Test: Each callout <= 25 chars
  assets.callouts.forEach((c, i) => {
    assert(c.length <= 25, `Callout ${i + 1} should be <= 25 chars`);
  });
  console.log('✅ Callouts length: PASS');

  console.log('✅ All callouts tests passed\n');
}

function testKeywordCoverage() {
  console.log('Testing keyword coverage...');
  
  const keywordList = ['glaszetter Friesland', 'glaszetter offerte', 'glaszetter prijs'];
  const assets = RSAAssetEngine.generateAssets({
    businessName: 'GrowSocial',
    service: 'glaszetter',
    location: 'Friesland',
    keywordList,
    uspList: [],
    finalUrl: 'https://growsocialmedia.nl/offerte/friesland',
    tone: 'direct'
  });

  // Test: At least 6 headlines contain service + location
  const serviceLower = 'glaszetter';
  const locationLower = 'friesland';
  const matchingHeadlines = assets.headlines.filter(h => {
    const hLower = h.toLowerCase();
    return hLower.includes(serviceLower) && hLower.includes(locationLower);
  });
  
  assert(matchingHeadlines.length >= 6, `Should have at least 6 headlines with service + location, got ${matchingHeadlines.length}`);
  console.log(`✅ Keyword coverage: PASS (${matchingHeadlines.length} headlines with service + location)`);

  console.log('✅ All keyword coverage tests passed\n');
}

// Run all tests
console.log('========================================');
console.log('RSA Asset Engine Tests');
console.log('========================================\n');

try {
  testHeadlineGeneration();
  testDescriptionGeneration();
  testSitelinksGeneration();
  testCalloutsGeneration();
  testKeywordCoverage();

  console.log('========================================');
  console.log('✅ ALL TESTS PASSED');
  console.log('========================================\n');
} catch (error) {
  console.error('❌ TEST FAILED:', error.message);
  console.error(error.stack);
  process.exit(1);
}
