/**
 * Tests for AI Kansen Router (opportunity assignment + decision logging).
 * Run with: node services/opportunityAssignmentService.test.js
 *
 * Covers:
 * - getKansenSettings returns defaults when DB fails
 * - logRoutingDecision / assignOpportunity require DB (integration); manual test: create opportunity, PATCH clear assigned_to -> auto-assign runs -> check opportunity_routing_decisions.
 * - API GET /api/admin/opportunities/:id/routing-decisions returns newest first (integration).
 * - Permissions: GET routing-decisions and GET/PUT router settings require isAdmin (mirror Leads).
 */

const assert = require('assert');
const path = require('path');

const mockSettings = [
  { setting_key: 'kansen_auto_assign_enabled', setting_value: 'true' },
  { setting_key: 'kansen_auto_assign_threshold', setting_value: '70' },
  { setting_key: 'kansen_region_weight', setting_value: '40' },
  { setting_key: 'kansen_performance_weight', setting_value: '50' },
  { setting_key: 'kansen_fairness_weight', setting_value: '30' }
];

let mockError = null;
let mockData = mockSettings;

const supabasePath = path.join(__dirname, '../config/supabase.js');
require.cache[supabasePath] = {
  id: supabasePath,
  exports: {
    supabaseAdmin: {
      from: () => ({
        select: () => ({
          in: () =>
            Promise.resolve(
              mockError ? { data: null, error: mockError } : { data: mockData, error: null }
            )
        })
      })
    }
  },
  loaded: true,
  filename: supabasePath,
  children: [],
  paths: require('module')._nodeModulePaths(__dirname)
};

const opportunityAssignmentService = require('./opportunityAssignmentService');

function testGetKansenSettings() {
  console.log('Testing getKansenSettings...');
  return opportunityAssignmentService.getKansenSettings().then((s) => {
    assert.strictEqual(s.autoAssignEnabled, true);
    assert.strictEqual(s.autoAssignThreshold, 70);
    assert.strictEqual(s.regionWeight, 40);
    assert.strictEqual(s.performanceWeight, 50);
    assert.strictEqual(s.fairnessWeight, 30);
    console.log('✅ getKansenSettings (with data): PASS');
  });
}

function testGetKansenSettingsDefaultsOnError() {
  console.log('Testing getKansenSettings defaults on error...');
  mockError = new Error('DB fail');
  mockData = null;
  return opportunityAssignmentService.getKansenSettings().then((s) => {
    assert.strictEqual(s.autoAssignThreshold, 60, 'Should fallback to 60');
    assert.strictEqual(s.autoAssignEnabled, true);
    mockError = null;
    mockData = mockSettings;
    console.log('✅ getKansenSettings (defaults on error): PASS');
  });
}

function run() {
  testGetKansenSettings()
    .then(testGetKansenSettingsDefaultsOnError)
    .then(() => {
      console.log('\nAll opportunityAssignmentService tests passed.');
      console.log('Manual checks: (1) Assign opportunity -> verify row in opportunity_routing_decisions. (2) GET /api/admin/opportunities/:id/routing-decisions as admin (200) and as employee (403). (3) Decisions ordered created_at DESC.');
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

run();
