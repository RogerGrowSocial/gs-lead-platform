#!/usr/bin/env node

/**
 * RSA Asset Preview Script
 * Generates and displays RSA assets for manual review
 * 
 * Usage:
 *   node scripts/generateRSAPreview.js <service> <location> [keyword1] [keyword2] ...
 * 
 * Example:
 *   node scripts/generateRSAPreview.js glaszetter Friesland "glaszetter Friesland" "glaszetter offerte"
 */

const RSAAssetService = require('../services/rsaAssetService');

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node scripts/generateRSAPreview.js <service> <location> [keyword1] [keyword2] ...');
    console.error('Example: node scripts/generateRSAPreview.js glaszetter Friesland "glaszetter Friesland" "glaszetter offerte"');
    process.exit(1);
  }

  const service = args[0];
  const location = args[1];
  const keywordList = args.slice(2);

  console.log('\n========================================');
  console.log('RSA Asset Preview Generator');
  console.log('========================================\n');
  console.log(`Service: ${service}`);
  console.log(`Location: ${location}`);
  console.log(`Keywords: ${keywordList.length > 0 ? keywordList.join(', ') : 'None'}`);
  console.log('\n');

  try {
    console.log('Generating assets...\n');
    
    const result = RSAAssetService.generatePreview({
      businessName: 'GrowSocial',
      service,
      location,
      keywordList,
      uspList: [],
      finalUrl: `https://growsocialmedia.nl/offerte/${location.toLowerCase().replace(/\s+/g, '-')}`,
      tone: 'direct'
    });

    if (!result || !result.headlines) {
      throw new Error('Failed to generate assets - result is empty');
    }

    console.log('========================================');
    console.log('GENERATED ASSETS');
    console.log('========================================\n');

    console.log('HEADLINES (15):');
    console.log('─'.repeat(50));
    result.headlines.forEach((h, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. [${h.length.toString().padStart(2)}] ${h}`);
    });
    console.log('');

    console.log('DESCRIPTIONS (4):');
    console.log('─'.repeat(50));
    result.descriptions.forEach((d, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. [${d.length.toString().padStart(2)}] ${d}`);
    });
    console.log('');

    if (result.path1 || result.path2) {
      console.log('DISPLAY URL PATHS:');
      console.log('─'.repeat(50));
      console.log(`Path1: ${result.path1 || '(empty)'}`);
      console.log(`Path2: ${result.path2 || '(empty)'}`);
      console.log('');
    }

    if (result.sitelinks && result.sitelinks.length > 0) {
      console.log('SITELINKS:');
      console.log('─'.repeat(50));
      result.sitelinks.forEach((sl, i) => {
        console.log(`${(i + 1).toString().padStart(2)}. ${sl.text}`);
        console.log(`    ${sl.description1}`);
        console.log(`    ${sl.description2}`);
        console.log(`    ${sl.url}`);
      });
      console.log('');
    }

    if (result.callouts && result.callouts.length > 0) {
      console.log('CALLOUTS:');
      console.log('─'.repeat(50));
      result.callouts.forEach((c, i) => {
        console.log(`${(i + 1).toString().padStart(2)}. ${c}`);
      });
      console.log('');
    }

    if (result.structuredSnippets && result.structuredSnippets.length > 0) {
      console.log('STRUCTURED SNIPPETS:');
      console.log('─'.repeat(50));
      result.structuredSnippets.forEach((ss, i) => {
        console.log(`${(i + 1).toString().padStart(2)}. ${ss.header}:`);
        ss.values.forEach(v => console.log(`    - ${v}`));
      });
      console.log('');
    }

    console.log('========================================');
    console.log('QUALITY SCORE');
    console.log('========================================\n');

    if (result.qualityScore) {
      const score = result.qualityScore;
      console.log(`Total Score: ${score.totalScore}/100 ${score.totalScore >= 80 ? '✅' : '❌'}`);
      console.log(`Keyword Coverage: ${score.keywordCoverageScore}/100 ${score.keywordCoverageScore >= 75 ? '✅' : '❌'}`);
      console.log(`Diversity Score: ${score.diversityScore}/100 ${score.diversityScore >= 75 ? '✅' : '❌'}`);
      console.log(`Length Errors: ${score.lengthErrors} ${score.lengthErrors === 0 ? '✅' : '❌'}`);
      console.log(`Duplicate Errors: ${score.duplicateErrors} ${score.duplicateErrors === 0 ? '✅' : '❌'}`);
      console.log(`Near-Duplicate Errors: ${score.nearDuplicateErrors} ${score.nearDuplicateErrors === 0 ? '✅' : '❌'}`);
      console.log('');

      if (score.errors && score.errors.length > 0) {
        console.log('ERRORS:');
        console.log('─'.repeat(50));
        score.errors.forEach((err, i) => {
          console.log(`${(i + 1).toString().padStart(2)}. ${err}`);
        });
        console.log('');
      }

      if (score.warnings && score.warnings.length > 0) {
        console.log('WARNINGS:');
        console.log('─'.repeat(50));
        score.warnings.forEach((warn, i) => {
          console.log(`${(i + 1).toString().padStart(2)}. ${warn}`);
        });
        console.log('');
      }

      console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    } else {
      console.log('No quality score available');
    }

    console.log('\n========================================\n');

  } catch (error) {
    console.error('\n❌ Error generating RSA assets:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run main
try {
  main();
} catch (err) {
  console.error('❌ Fatal error:', err);
  console.error(err.stack);
  process.exit(1);
}
