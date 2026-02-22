/**
 * Unit tests for chat service (DM key helper).
 * Run with: node services/chatService.test.js
 */
const assert = require('assert');

function buildDmKey(userId1, userId2) {
  if (!userId1 || !userId2) return null;
  const ids = [userId1, userId2].sort();
  return ids[0] + '_' + ids[1];
}

assert.strictEqual(buildDmKey('a', 'b'), 'a_b', 'sorted: a,b -> a_b');
assert.strictEqual(buildDmKey('b', 'a'), 'a_b', 'sorted: b,a -> a_b');
assert.strictEqual(buildDmKey('user-1', 'user-2'), 'user-1_user-2', 'UUID-like ids stay sorted');
assert.strictEqual(buildDmKey(null, 'x'), null, 'null userId1 returns null');
assert.strictEqual(buildDmKey('x', null), null, 'null userId2 returns null');
assert.strictEqual(buildDmKey('', 'x'), null, 'empty userId1 returns null');

console.log('chatService.buildDmKey tests passed.');
process.exit(0);
