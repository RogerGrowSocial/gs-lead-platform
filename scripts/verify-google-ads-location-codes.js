#!/usr/bin/env node

/**
 * Script to verify Google Ads location codes for Dutch provinces
 * 
 * This script helps verify the correct geo target constant IDs for Dutch provinces
 * to fix the issue where campaigns target wrong countries (e.g., Finland instead of Netherlands)
 * 
 * Usage:
 * 1. Download the latest Geo Target Constants CSV from:
 *    https://developers.google.com/google-ads/api/data/geotargets
 * 2. Extract the CSV file
 * 3. Run this script to search for Dutch provinces
 * 
 * OR use the Google Ads API GeoTargetConstantService (if available)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PROVINCES = [
  { name: 'Gelderland', searchTerms: ['Gelderland', 'Gelderland, Netherlands'] },
  { name: 'Noord-Holland', searchTerms: ['Noord-Holland', 'North Holland', 'Noord-Holland, Netherlands'] },
  { name: 'Zuid-Holland', searchTerms: ['Zuid-Holland', 'South Holland', 'Zuid-Holland, Netherlands'] },
  { name: 'Noord-Brabant', searchTerms: ['Noord-Brabant', 'North Brabant', 'Noord-Brabant, Netherlands'] },
  { name: 'Utrecht', searchTerms: ['Utrecht', 'Utrecht, Netherlands'] },
  { name: 'Friesland', searchTerms: ['Friesland', 'Friesland, Netherlands'] },
  { name: 'Overijssel', searchTerms: ['Overijssel', 'Overijssel, Netherlands'] },
  { name: 'Groningen', searchTerms: ['Groningen', 'Groningen, Netherlands'] },
  { name: 'Drenthe', searchTerms: ['Drenthe', 'Drenthe, Netherlands'] },
  { name: 'Flevoland', searchTerms: ['Flevoland', 'Flevoland, Netherlands'] },
  { name: 'Limburg', searchTerms: ['Limburg', 'Limburg, Netherlands'] },
  { name: 'Zeeland', searchTerms: ['Zeeland', 'Zeeland, Netherlands'] }
];

/**
 * Search CSV file for province location codes
 */
async function searchCSVForProvince(csvPath, province) {
  return new Promise((resolve, reject) => {
    const results = [];
    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      // CSV format: Criteria ID, Name, Canonical Name, Parent ID, Country Code, Target Type, Status
      const parts = line.split(',');
      if (parts.length >= 6) {
        const criteriaId = parts[0]?.trim();
        const name = parts[1]?.trim();
        const countryCode = parts[4]?.trim();
        const targetType = parts[5]?.trim();
        
        // Check if this line matches our province
        const matches = province.searchTerms.some(term => 
          name.toLowerCase().includes(term.toLowerCase())
        );
        
        // Must be Netherlands (NL) and a location (not a language, etc.)
        if (matches && countryCode === 'NL' && targetType === 'Location') {
          results.push({
            criteriaId,
            name,
            countryCode,
            targetType,
            fullLine: line
          });
        }
      }
    });

    rl.on('close', () => {
      resolve(results);
    });

    rl.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Google Ads Location Codes Verifier\n');
  console.log('This script helps verify correct location codes for Dutch provinces.\n');
  
  // Check if CSV path is provided
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.log('Usage: node verify-google-ads-location-codes.js <path-to-geotargets.csv>');
    console.log('\nTo get the CSV file:');
    console.log('1. Go to: https://developers.google.com/google-ads/api/data/geotargets');
    console.log('2. Download the latest zipped CSV file');
    console.log('3. Extract the CSV file');
    console.log('4. Run this script with the path to the CSV file\n');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📂 Reading CSV file: ${csvPath}\n`);

  const verifiedCodes = {};

  for (const province of PROVINCES) {
    console.log(`🔍 Searching for: ${province.name}...`);
    const results = await searchCSVForProvince(csvPath, province);
    
    if (results.length > 0) {
      // Find the best match (usually the one with exact province name)
      const bestMatch = results.find(r => 
        r.name.toLowerCase().includes(province.name.toLowerCase())
      ) || results[0];
      
      const regionKey = province.name.toLowerCase().replace(/\s+/g, '-');
      verifiedCodes[regionKey] = [bestMatch.criteriaId];
      
      console.log(`  ✅ Found: ${bestMatch.name} (Criteria ID: ${bestMatch.criteriaId})`);
      console.log(`     Code: ${bestMatch.criteriaId}`);
    } else {
      console.log(`  ⚠️  No match found for ${province.name}`);
    }
  }

  console.log('\n📋 Verified Location Codes:\n');
  console.log('static REGION_TO_LOCATION_CODES = {');
  for (const [key, codes] of Object.entries(verifiedCodes)) {
    console.log(`  '${key}': ['${codes[0]}'], // ${PROVINCES.find(p => p.name.toLowerCase().replace(/\s+/g, '-') === key)?.name || key}`);
  }
  console.log('};');
  console.log('\n✅ Copy these codes to services/googleAdsCampaignBuilderService.js\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
