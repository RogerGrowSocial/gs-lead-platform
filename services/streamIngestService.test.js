/**
 * Unit tests for StreamIngestService (idempotency, signature verification, mapping)
 * Run with: node services/streamIngestService.test.js
 */

const StreamIngestService = require('./streamIngestService')
const assert = require('assert')

function testBuildIdempotencyKey() {
  console.log('Testing buildIdempotencyKey...')
  const key1 = StreamIngestService.buildIdempotencyKey({ idempotency_key: 'abc-123' })
  assert.strictEqual(key1, 'abc-123', 'Should use payload.idempotency_key')
  const key2 = StreamIngestService.buildIdempotencyKey({ external_id: 'ext-456' })
  assert.strictEqual(key2, 'ext-456', 'Should use payload.external_id when no idempotency_key')
  const key3 = StreamIngestService.buildIdempotencyKey({ email: 'a@b.nl', phone: '1', message: 'hi' })
  assert(key3 && key3.length === 64 && /^[a-f0-9]+$/.test(key3), 'Should return SHA256 hex when no idempotency/external_id')
  console.log('✅ buildIdempotencyKey: PASS')
}

function testMapPayloadToOpportunity() {
  console.log('Testing mapPayloadToOpportunity...')
  const payload = { company_name: 'Acme', contact_name: 'Jane', email: 'j@acme.nl', message: 'Hello' }
  const config = {
    mapping: {
      title: 'payload.company_name',
      company_name: 'payload.company_name',
      contact_name: 'payload.contact_name',
      email: 'payload.email',
      description: 'payload.message',
      status: 'open'
    },
    defaults: { stage: 'nieuw', priority: 'medium' }
  }
  const mapped = StreamIngestService.mapPayloadToOpportunity(payload, config)
  assert.strictEqual(mapped.company_name, 'Acme')
  assert.strictEqual(mapped.contact_name, 'Jane')
  assert.strictEqual(mapped.email, 'j@acme.nl')
  assert.strictEqual(mapped.description, 'Hello')
  assert.strictEqual(mapped.stage, 'nieuw')
  assert.strictEqual(mapped.priority, 'medium')
  console.log('✅ mapPayloadToOpportunity: PASS')
}

function testValidateMappedFields() {
  console.log('Testing validateMappedFields...')
  assert.strictEqual(StreamIngestService.validateMappedFields({}).valid, false)
  assert.strictEqual(StreamIngestService.validateMappedFields({ title: 'x' }).valid, true)
  assert.strictEqual(StreamIngestService.validateMappedFields({ company_name: 'x' }).valid, true)
  assert.strictEqual(StreamIngestService.validateMappedFields({ email: 'x' }).valid, true)
  assert.strictEqual(StreamIngestService.validateMappedFields({ contact_name: 'x' }).valid, true)
  console.log('✅ validateMappedFields: PASS')
}

async function testVerifySecret() {
  console.log('Testing verifySecret...')
  const streamNoSecret = { secret_hash: null }
  const r1 = await StreamIngestService.verifySecret(streamNoSecret, null, null, null)
  assert.strictEqual(r1.valid, true, 'No secret -> valid')
  const streamWithHash = { secret_hash: '$2b$10$dummyhashwhichwontmatchanythingreal' }
  const r2 = await StreamIngestService.verifySecret(streamWithHash, null, 'wrong', null)
  assert.strictEqual(r2.valid, false, 'Wrong X-Stream-Secret -> invalid')
  console.log('✅ verifySecret: PASS')
}

function run() {
  testBuildIdempotencyKey()
  testMapPayloadToOpportunity()
  testValidateMappedFields()
  testVerifySecret().then(() => {
    console.log('\nAll StreamIngestService tests passed.')
  }).catch(err => {
    console.error(err)
    process.exit(1)
  })
}

run()
