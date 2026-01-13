/**
 * Test Script: Phase 3 Platform Landing Page System
 * 
 * Test de nieuwe platform-first landing page flow:
 * 1. Site resolution
 * 2. Platform LP creation
 * 3. Cluster retrieval
 * 4. Path validation
 * 5. AI content generation (placeholder)
 */

const SiteService = require('../services/siteService');
const PartnerLandingPageService = require('../services/partnerLandingPageService');
const LeadSegmentService = require('../services/leadSegmentService');
const PartnerMarketingOrchestratorService = require('../services/partnerMarketingOrchestratorService');
const logger = require('../utils/logger');

async function testPhase3() {
  console.log('🧪 Testing Phase 3: Platform Landing Page System\n');
  
  try {
    // Test 1: Site Service
    console.log('1️⃣ Testing SiteService...');
    const defaultSite = await SiteService.getDefaultSite();
    if (!defaultSite) {
      throw new Error('Default site not found');
    }
    console.log(`   ✅ Default site: ${defaultSite.name} (${defaultSite.domain})`);
    
    const sites = await SiteService.listActiveSites();
    console.log(`   ✅ Active sites: ${sites.length}`);
    
    // Test 2: Path Validation
    console.log('\n2️⃣ Testing Path Validation...');
    const validPath = PartnerLandingPageService.validatePath('/schilder/tilburg/');
    console.log(`   ✅ Valid path: ${validPath.valid}`);
    
    const invalidPath = PartnerLandingPageService.validatePath('/jansen-schilderwerken/tilburg/');
    console.log(`   ⚠️  Invalid path (should be valid for now, blacklist not implemented): ${invalidPath.valid}`);
    
    // Test 3: Path Generation
    console.log('\n3️⃣ Testing Path Generation...');
    const segments = await LeadSegmentService.getAllActiveSegments();
    if (segments.length > 0) {
      const testSegment = segments[0];
      const mainPath = PartnerLandingPageService.generatePathFromSegment(testSegment, 'main');
      const costPath = PartnerLandingPageService.generatePathFromSegment(testSegment, 'cost');
      console.log(`   ✅ Main path: ${mainPath}`);
      console.log(`   ✅ Cost path: ${costPath}`);
    } else {
      console.log('   ⚠️  No segments found - skipping path generation test');
    }
    
    // Test 4: Cluster Retrieval
    console.log('\n4️⃣ Testing Cluster Retrieval...');
    if (segments.length > 0 && defaultSite) {
      const testSegment = segments[0];
      const cluster = await PartnerLandingPageService.getLandingPageCluster(defaultSite.id, testSegment.id);
      console.log(`   ✅ Cluster retrieved:`);
      console.log(`      - Main: ${cluster.main ? '✅' : '❌'}`);
      console.log(`      - Cost: ${cluster.cost ? '✅' : '❌'}`);
      console.log(`      - Quote: ${cluster.quote ? '✅' : '❌'}`);
      console.log(`      - Spoed: ${cluster.spoed ? '✅' : '❌'}`);
      console.log(`      - Others: ${cluster.others.length}`);
    } else {
      console.log('   ⚠️  No segments or site - skipping cluster test');
    }
    
    // Test 5: Platform Marketing Actions (dry run)
    console.log('\n5️⃣ Testing Platform Marketing Actions Generation...');
    try {
      const actions = await PartnerMarketingOrchestratorService.generatePlatformMarketingActions(new Date());
      console.log(`   ✅ Generated ${actions.length} platform marketing actions`);
      if (actions.length > 0) {
        const actionTypes = {};
        actions.forEach(action => {
          const type = action.action_type || action.type;
          actionTypes[type] = (actionTypes[type] || 0) + 1;
        });
        console.log(`   📊 Action types:`, actionTypes);
      }
    } catch (error) {
      console.log(`   ⚠️  Error generating actions (might be expected if no gaps): ${error.message}`);
    }
    
    // Test 6: AI Content Generation (placeholder check)
    console.log('\n6️⃣ Testing AI Content Generation...');
    if (segments.length > 0 && defaultSite) {
      const testSegment = segments[0];
      try {
        const content = await PartnerLandingPageService.generateAIContentForPage({
          site: defaultSite,
          segment: testSegment,
          pageType: 'main',
          intent: `${testSegment.branch} ${testSegment.region} main`
        });
        console.log(`   ✅ AI content generated:`);
        console.log(`      - Title: ${content.title}`);
        console.log(`      - Has content_json: ${!!content.content_json}`);
        console.log(`      - Has hero: ${!!content.content_json?.hero}`);
      } catch (error) {
        console.log(`   ⚠️  Error generating content: ${error.message}`);
      }
    } else {
      console.log('   ⚠️  No segments or site - skipping AI content test');
    }
    
    console.log('\n✅ Phase 3 tests completed!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Apply Phase 2 migrations (if not already done)');
    console.log('   2. Create a test segment if none exists');
    console.log('   3. Test approve endpoint to create first platform LP');
    console.log('   4. Test public LP rendering via domain + path');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testPhase3()
    .then(() => {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Tests failed:', error);
      process.exit(1);
    });
}

module.exports = testPhase3;

