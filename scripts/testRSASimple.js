#!/usr/bin/env node

/**
 * Simple test to verify RSA Engine works
 */

console.log('Testing RSA Asset Engine...\n');

try {
  const RSAAssetEngine = require('../services/rsaAssetEngine');
  
  console.log('Generating assets for: glaszetter, Friesland');
  const assets = RSAAssetEngine.generateAssets({
    businessName: 'GrowSocial',
    service: 'glaszetter',
    location: 'Friesland',
    keywordList: ['glaszetter Friesland', 'glaszetter offerte'],
    uspList: [],
    finalUrl: 'https://growsocialmedia.nl/offerte/friesland',
    tone: 'direct'
  });

  console.log(`\n✅ Generated ${assets.headlines.length} headlines`);
  console.log(`✅ Generated ${assets.descriptions.length} descriptions`);
  
  // Show first 3 headlines
  console.log('\nFirst 3 headlines:');
  assets.headlines.slice(0, 3).forEach((h, i) => {
    console.log(`  ${i + 1}. [${h.length}] ${h}`);
  });
  
  console.log('\n✅ Test passed!');
  
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}

