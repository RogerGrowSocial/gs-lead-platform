/**
 * Tests for Opportunity assignment follow-up (email + task idempotency, hash).
 * Run with: node services/opportunityAssignmentFollowUpService.test.js
 *
 * - assignmentHash is deterministic for same (opportunityId, assigneeUserId)
 * - PUT sales-status: lost requires reason (integration: hit API)
 * - Reminder job and escalation: manual / integration
 */

const assert = require('assert');
const { assignmentHash } = require('./opportunityAssignmentFollowUpService');

function testAssignmentHash() {
  const id1 = '11111111-1111-1111-1111-111111111111';
  const id2 = '22222222-2222-2222-2222-222222222222';
  const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  const h1 = assignmentHash(id1, userA);
  const h2 = assignmentHash(id1, userA);
  assert.strictEqual(h1, h2, 'Same inputs must produce same hash');
  assert.ok(h1.length === 64 && /^[a-f0-9]+$/.test(h1), 'Hash must be 64-char hex');

  const h3 = assignmentHash(id1, userB);
  assert.notStrictEqual(h1, h3, 'Different assignee must produce different hash');
  const h4 = assignmentHash(id2, userA);
  assert.notStrictEqual(h1, h4, 'Different opportunity must produce different hash');

  console.log('✅ assignmentHash: PASS');
}

testAssignmentHash();
console.log('\nFollow-up service unit tests passed.');
console.log('Manual: (1) Assign opportunity -> check email + task. (2) PUT sales-status lost without reason -> 400. (3) Run reminder job -> day1/day3/escale rows.');
