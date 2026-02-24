'use strict'

const crypto = require('crypto')
const bcrypt = require('bcrypt')
const { supabaseAdmin } = require('../config/supabase')
// Lazy-load optional services so serverless (e.g. Vercel) can start even if they fail to load
let _opportunityAssignmentService = null
let _aiOpportunityDescriptionService = null
function getOpportunityAssignmentService() {
  if (!_opportunityAssignmentService) _opportunityAssignmentService = require('./opportunityAssignmentService')
  return _opportunityAssignmentService
}
function getAiOpportunityDescriptionService() {
  if (!_aiOpportunityDescriptionService) _aiOpportunityDescriptionService = require('./aiOpportunityDescriptionService')
  return _aiOpportunityDescriptionService
}

const STREAM_TYPES = ['trustoo', 'webhook', 'form']

/**
 * StreamIngestService
 * Handles inbound opportunity creation from streams (Trustoo, Webhook, Form).
 * - Verifies secret/signature
 * - Idempotency/deduplication via idempotency_key or external_id
 * - Maps payload to opportunity fields via stream.config.mapping and config.defaults
 * - Always logs to opportunity_stream_events
 */
class StreamIngestService {
  /**
   * Verify request: either X-Stream-Secret (bcrypt compare) or X-Signature (HMAC-SHA256 of raw body)
   * @param {object} stream - { secret_hash }
   * @param {string} rawBody - Raw request body (for HMAC)
   * @param {string} headerSecret - X-Stream-Secret header
   * @param {string} headerSignature - X-Signature header
   * @returns {{ valid: boolean, error?: string }}
   */
  static async verifySecret(stream, rawBody, headerSecret, headerSignature) {
    if (!stream.secret_hash && !headerSecret && !headerSignature) {
      return { valid: true }
    }
    if (stream.secret_hash && headerSecret) {
      const match = await bcrypt.compare(headerSecret, stream.secret_hash)
      if (match) return { valid: true }
      return { valid: false, error: 'Invalid X-Stream-Secret' }
    }
    if (stream.secret_hash && headerSignature && rawBody !== undefined) {
      const secret = await this._getSecretFromHashForHmac(stream.secret_hash)
      if (!secret) return { valid: false, error: 'HMAC verification not available (secret stored as hash only)' }
      const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
      if (crypto.timingSafeEqual(Buffer.from(headerSignature, 'utf8'), Buffer.from(expected, 'utf8'))) {
        return { valid: true }
      }
      return { valid: false, error: 'Invalid X-Signature' }
    }
    if (stream.secret_hash && !headerSecret && !headerSignature) {
      return { valid: false, error: 'Missing X-Stream-Secret or X-Signature' }
    }
    return { valid: true }
  }

  /**
   * We cannot derive plain secret from bcrypt hash. So HMAC is only supported when
   * the stream stores a reversible secret (e.g. encrypted). For MVP we only support
   * X-Stream-Secret for verification; HMAC would require storing secret encrypted.
   * Document this: HMAC supported only if config.store_secret_for_hmac is true and we store it (not in MVP).
   */
  static async _getSecretFromHashForHmac(secretHash) {
    return null
  }

  /**
   * Build idempotency key: 1) payload.idempotency_key 2) payload.external_id 3) hash of (email+phone+message+date_bucket)
   */
  static buildIdempotencyKey(payload) {
    if (payload && payload.idempotency_key && typeof payload.idempotency_key === 'string') {
      return payload.idempotency_key.trim()
    }
    if (payload && payload.external_id && typeof payload.external_id === 'string') {
      return payload.external_id.trim()
    }
    const email = (payload && payload.email) ? String(payload.email).trim() : ''
    const phone = (payload && payload.phone) ? String(payload.phone).trim() : ''
    const message = (payload && (payload.message || payload.description || payload.notes)) ? String(payload.message || payload.description || payload.notes).trim() : ''
    const dateBucket = new Date().toISOString().slice(0, 13)
    const combined = `${email}|${phone}|${message}|${dateBucket}`
    return crypto.createHash('sha256').update(combined).digest('hex')
  }

  /**
   * Normalize a payload key for matching: lowercase, spaces/commas to underscore
   */
  static _normalizePayloadKey(key) {
    if (typeof key !== 'string') return ''
    return key.toLowerCase().replace(/[\s,-]+/g, '_').replace(/_+/g, '_')
  }

  /**
   * Build a flat map from payload (first level + payload.data first level) with normalized keys
   * so Zapier/webhook payloads with "Company Name" or "company_name" both match company_name.
   */
  static _payloadKeyValueMap(payload) {
    const map = new Map()
    if (!payload || typeof payload !== 'object') return map
    const add = (obj) => {
      if (!obj || typeof obj !== 'object') return
      for (const [k, v] of Object.entries(obj)) {
        if (v === undefined || v === null) continue
        const n = this._normalizePayloadKey(k)
        if (n && !map.has(n)) map.set(n, v)
      }
    }
    add(payload)
    if (payload.data && typeof payload.data === 'object') add(payload.data)
    return map
  }

  /** Aliases for opportunity fields when falling back to raw payload (e.g. Zapier sends various key names) */
  static _payloadFieldAliases() {
    return {
      title: ['title', 'subject', 'onderwerp'],
      company_name: ['company_name', 'company', 'business_name', 'business', 'bedrijfsnaam', 'companyname'],
      contact_name: ['contact_name', 'contact', 'name', 'full_name', 'your_name', 'naam'],
      email: ['email', 'e_mail', 'e-mail', 'mail'],
      phone: ['phone', 'telephone', 'tel', 'phone_number', 'telefoon'],
      message: ['message', 'description', 'notes', 'body', 'comment', 'bericht', 'omschrijving'],
      address: ['address', 'adres', 'street'],
      city: ['city', 'plaats', 'woonplaats'],
      postcode: ['postcode', 'zip', 'zipcode', 'postal_code']
    }
  }

  /**
   * Map inbound payload to opportunity fields using stream.config.mapping and config.defaults.
   * If mapping leaves required fields empty, fill from payload using common key aliases (Zapier/webhook).
   * mapping: { opportunity_field: "payload.path.or.dot" } or { opportunity_field: "literal" }
   */
  static mapPayloadToOpportunity(payload, config) {
    const mapping = (config && config.mapping) || {}
    const defaults = (config && config.defaults) || {}
    const result = {}

    for (const [oppField, sourcePath] of Object.entries(mapping)) {
      if (typeof sourcePath !== 'string') continue
      let value
      if (sourcePath.startsWith('payload.') || sourcePath.includes('.')) {
        const path = sourcePath.replace(/^payload\./, '').split('.')
        value = path.reduce((obj, key) => (obj != null ? obj[key] : undefined), payload)
      } else {
        value = sourcePath
      }
      if (value !== undefined && value !== null && value !== '') {
        result[oppField] = typeof value === 'string' ? value.trim() : value
      }
    }

    for (const [key, val] of Object.entries(defaults)) {
      if (result[key] === undefined || result[key] === null || result[key] === '') {
        result[key] = val
      }
    }

    // Fallback: fill empty fields from payload using common key names (Zapier, webhooks, forms)
    const keyVal = this._payloadKeyValueMap(payload)
    const aliases = this._payloadFieldAliases()
    for (const [oppField, keys] of Object.entries(aliases)) {
      if (result[oppField] !== undefined && result[oppField] !== null && String(result[oppField]).trim() !== '') continue
      for (const key of keys) {
        const v = keyVal.get(this._normalizePayloadKey(key))
        if (v !== undefined && v !== null && (typeof v !== 'string' || v.trim() !== '')) {
          result[oppField] = typeof v === 'string' ? v.trim() : v
          break
        }
      }
    }

    return result
  }

  /**
   * Minimal validation: ensure we have at least one of title, company_name, or email/contact for an opportunity
   */
  static validateMappedFields(mapped) {
    const hasTitle = mapped.title && String(mapped.title).trim()
    const hasCompany = mapped.company_name && String(mapped.company_name).trim()
    const hasContact = (mapped.email && String(mapped.email).trim()) || (mapped.contact_name && String(mapped.contact_name).trim())
    if (hasTitle || hasCompany || hasContact) return { valid: true }
    return { valid: false, error: 'Payload must map to at least one of: title, company_name, or email/contact_name' }
  }

  /**
   * Main ingest: load stream, verify, dedupe, map, create opportunity, log event.
   * @param {string} streamId - UUID of opportunity_streams
   * @param {string} rawBody - Raw request body (for HMAC and logging)
   * @param {string} headerSecret - X-Stream-Secret
   * @param {string} headerSignature - X-Signature
   * @param {{ skipVerification?: boolean }} options - skipVerification: true for admin test-event (no plain secret available)
   * @returns {{ success: boolean, status: number, opportunityId?: string, duplicate?: boolean, error?: string }}
   */
  static async ingest(streamId, rawBody, headerSecret, headerSignature, options = {}) {
    let payload
    try {
      payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody
    } catch (e) {
      await logEvent(streamId, 'error', 400, null, payload || rawBody, 'Invalid JSON body', null)
      return { success: false, status: 400, error: 'Invalid JSON body' }
    }

    const { data: stream, error: streamError } = await supabaseAdmin
      .from('opportunity_streams')
      .select('id, name, type, is_active, config, secret_hash')
      .eq('id', streamId)
      .single()

    if (streamError || !stream) {
      await logEvent(streamId, 'error', 404, null, payload, 'Stream not found', null)
      return { success: false, status: 404, error: 'Stream not found' }
    }

    if (!stream.is_active) {
      await logEvent(streamId, 'error', 403, null, payload, 'Stream is inactive', null)
      return { success: false, status: 403, error: 'Stream is inactive' }
    }

    const config = stream.config || {}
    const requireSecret = config.require_secret !== false
    if (!options.skipVerification && requireSecret) {
      const verification = await this.verifySecret(stream, rawBody, headerSecret, headerSignature)
      if (!verification.valid) {
        let errMsg = verification.error
        if (errMsg && errMsg.includes('Missing')) {
          console.warn('[ingest] Request without X-Stream-Secret rejected. StreamId=', streamId, 'Payload keys:', payload && typeof payload === 'object' ? Object.keys(payload) : 'n/a')
          errMsg += ' Tip: header X-Stream-Secret meesturen; of zet in stream config: "require_secret": false.'
        }
        await logEvent(streamId, 'error', 401, null, payload, errMsg, null)
        return { success: false, status: 401, error: errMsg }
      }
    }

    const idempotencyKey = this.buildIdempotencyKey(payload)
    const externalId = (payload && payload.external_id) ? String(payload.external_id).trim() : null

    const existing = await findExistingEvent(streamId, idempotencyKey, externalId)
    if (existing) {
      return {
        success: true,
        status: 200,
        opportunityId: existing.created_opportunity_id,
        duplicate: true
      }
    }

    const mapped = this.mapPayloadToOpportunity(payload, config)
    const validation = this.validateMappedFields(mapped)
    if (!validation.valid) {
      await logEvent(streamId, 'error', 400, idempotencyKey, payload, validation.error, null, externalId)
      return { success: false, status: 400, error: validation.error }
    }

    // AI-beschrijving als er geen of een heel korte beschrijving is (lazy-load service)
    let description = mapped.description || mapped.notes || null
    if (!description || String(description).trim().length < 50) {
      try {
        const aiSvc = getAiOpportunityDescriptionService()
        const aiDesc = await aiSvc.generateOpportunityDescription(mapped, payload)
        if (aiDesc && aiDesc.trim()) description = aiDesc.trim()
      } catch (descErr) {
        console.warn('Stream ingest: AI beschrijving mislukt (kans wordt wel aangemaakt):', descErr.message)
      }
    }

    // Waarde: eerst uit stream (mapping), anders AI-inschatting (lazy-load service)
    let value = mapped.value != null ? Number(mapped.value) : null
    if (value == null || value === 0) {
      try {
        const aiSvc = getAiOpportunityDescriptionService()
        const payloadWithDescription = { ...payload }
        if (description && description.trim()) payloadWithDescription._generatedDescription = description
        const aiValue = await aiSvc.estimateOpportunityValue(mapped, payloadWithDescription)
        if (aiValue != null && aiValue > 0) value = aiValue
      } catch (valueErr) {
        console.warn('Stream ingest: AI waarde-inschatting mislukt (kans wordt wel aangemaakt):', valueErr.message)
      }
    }

    const title = mapped.title || mapped.company_name || mapped.email || 'Kans uit stream'
    const opportunityRow = {
      title: String(title).slice(0, 255),
      company_name: mapped.company_name || null,
      contact_name: mapped.contact_name || null,
      email: mapped.email || null,
      phone: mapped.phone || null,
      address: mapped.address || null,
      city: mapped.city || null,
      postcode: mapped.postcode || null,
      status: mapped.status || 'open',
      stage: mapped.stage || 'nieuw',
      priority: mapped.priority || 'medium',
      description: description || null,
      notes: mapped.notes || null,
      value: value != null ? value : null,
      source_stream_id: stream.id,
      meta: {
        source: 'stream',
        source_stream_id: stream.id,
        source_stream_name: stream.name,
        source_stream_type: stream.type,
        raw_source_payload: payload
      },
      owner_id: null,
      assigned_to: mapped.assignee_id || mapped.assigned_to || null
    }

    const { data: opportunity, error: insertErr } = await supabaseAdmin
      .from('opportunities')
      .insert(opportunityRow)
      .select('id')
      .single()

    if (insertErr) {
      const msg = insertErr.message || 'Failed to create opportunity'
      await logEvent(streamId, 'error', 500, idempotencyKey, payload, msg, null, externalId)
      return { success: false, status: 500, error: msg }
    }

    // Laat elke nieuwe kans via de AI Kansen Router lopen (lazy-load service)
    try {
      const assignSvc = getOpportunityAssignmentService()
      await assignSvc.assignOpportunity(opportunity.id, {
        assignedBy: 'auto',
        streamId
      })
    } catch (assignErr) {
      console.warn('Stream ingest: AI Kansen Router toewijzing mislukt (kans wel aangemaakt):', assignErr.message)
      // Ingest blijft geslaagd; kans kan later handmatig of opnieuw toegewezen worden
    }

    await logEvent(streamId, 'success', 200, idempotencyKey, payload, null, opportunity.id, externalId)
    return {
      success: true,
      status: 200,
      opportunityId: opportunity.id,
      duplicate: false
    }
  }
}

async function findExistingEvent(streamId, idempotencyKey, externalId) {
  if (idempotencyKey) {
    const { data } = await supabaseAdmin
      .from('opportunity_stream_events')
      .select('id, created_opportunity_id')
      .eq('stream_id', streamId)
      .eq('idempotency_key', idempotencyKey)
      .limit(1)
      .maybeSingle()
    if (data && data.created_opportunity_id) return data
  }
  if (externalId) {
    const { data } = await supabaseAdmin
      .from('opportunity_stream_events')
      .select('id, created_opportunity_id')
      .eq('stream_id', streamId)
      .eq('external_id', externalId)
      .limit(1)
      .maybeSingle()
    if (data && data.created_opportunity_id) return data
  }
  return null
}

async function logEvent(streamId, status, httpStatus, idempotencyKey, payloadRaw, errorMessage, createdOpportunityId, externalId) {
  const payloadSafe = payloadRaw && typeof payloadRaw === 'object' ? payloadRaw : (typeof payloadRaw === 'string' ? { _raw: payloadRaw } : null)
  await supabaseAdmin
    .from('opportunity_stream_events')
    .insert({
      stream_id: streamId,
      received_at: new Date().toISOString(),
      status,
      http_status: httpStatus,
      idempotency_key: idempotencyKey || null,
      external_id: externalId || null,
      payload_raw: payloadSafe,
      error_message: errorMessage || null,
      created_opportunity_id: createdOpportunityId || null
    })
}

module.exports = StreamIngestService
