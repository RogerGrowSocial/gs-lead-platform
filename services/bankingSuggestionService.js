/**
 * Banking suggestion pipeline: rules → DB ranking → optional LLM.
 * Produces bank_transaction_suggestions for a given transaction.
 */
const { supabaseAdmin } = require('../config/supabase');

const MODEL_VERSION = 'rules-v1';
const INVOICE_WINDOW_DAYS = 120;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.92;

/**
 * Fetch counterparty rules (iban / name_contains / regex) for organization.
 */
async function getCounterpartyRules(organizationId) {
  const { data } = await supabaseAdmin
    .from('counterparty_rules')
    .select('*')
    .or(`organization_id.eq.${organizationId || ''},organization_id.is.null`);
  return data || [];
}

/**
 * Check if transaction is internal transfer (same IBANs / known internal).
 */
function isInternalTransfer(tx, ownIbans = []) {
  const iban = (tx.counterparty_iban || '').replace(/\s/g, '');
  if (!iban) return false;
  const normalized = ownIbans.map(i => (i || '').replace(/\s/g, ''));
  return normalized.some(o => o && iban === o);
}

/**
 * Match counterparty rules. Returns first matching rule.
 */
function matchCounterpartyRules(tx, rules) {
  const name = (tx.counterparty_name || '').toLowerCase();
  const iban = (tx.counterparty_iban || '').replace(/\s/g, '').toLowerCase();
  for (const r of rules) {
    if (r.match_type === 'iban' && r.match_value && iban.includes(r.match_value.toLowerCase().replace(/\s/g, ''))) return r;
    if (r.match_type === 'name_contains' && r.match_value && name.includes(r.match_value.toLowerCase())) return r;
    if (r.match_type === 'regex' && r.match_value) {
      try {
        const re = new RegExp(r.match_value, 'i');
        if (re.test(tx.counterparty_name || '') || re.test(tx.description || '')) return r;
      } catch (_) {}
    }
  }
  return null;
}

/**
 * Extract possible invoice numbers from description/remittance (e.g. GS-2026-0012, factuur 123).
 */
function extractInvoiceNumberCandidates(text) {
  if (!text) return [];
  const candidates = [];
  const gs = text.match(/(?:GS-|factuur\s*#?)\s*[\d\-]+/gi);
  if (gs) candidates.push(...gs.map(s => s.replace(/\s+/g, '').replace(/^.*?(GS-[\d\-]+|#?\d+)/i, '$1')));
  const num = text.match(/\b\d{4,10}\b/g);
  if (num) candidates.push(...num);
  return [...new Set(candidates)];
}

/**
 * Fetch open invoices (pending/overdue/partial, open_amount_cents > 0) in date window.
 */
async function getOpenInvoicesWindow(organizationId, bookedAt) {
  const from = new Date(bookedAt);
  from.setDate(from.getDate() - INVOICE_WINDOW_DAYS);
  const to = new Date(bookedAt);
  to.setDate(to.getDate() + INVOICE_WINDOW_DAYS);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from('customer_invoices')
    .select('id, invoice_number, customer_id, deal_id, amount, outstanding_amount, open_amount_cents, due_date, invoice_date')
    .in('status', ['pending', 'overdue', 'partial'])
    .gte('due_date', fromStr)
    .lte('due_date', toStr);

  if (error) return [];
  const withOpen = (data || []).filter(i => (i.open_amount_cents ?? Math.round((i.outstanding_amount || 0) * 100)) > 0);
  return withOpen;
}

/**
 * Fetch customer names for invoice list.
 */
async function getCustomerNames(customerIds) {
  if (!customerIds.length) return {};
  const { data } = await supabaseAdmin.from('customers').select('id, name, legal_name').in('id', customerIds);
  const map = {};
  (data || []).forEach(c => { map[c.id] = (c.legal_name || c.name || '').toLowerCase(); });
  return map;
}

/**
 * Score invoice candidates for a transaction (amount, invoice number, customer name).
 */
function scoreInvoiceCandidates(tx, invoices, customerNames) {
  const amount = tx.amount_cents;
  const desc = ((tx.description || '') + ' ' + (tx.remittance_info || '') + ' ' + (tx.counterparty_name || '')).toLowerCase();
  const invoiceCandidates = extractInvoiceNumberCandidates(desc);
  const counterpartyName = (tx.counterparty_name || '').toLowerCase();

  const scored = (invoices || []).map(inv => {
    const openCents = inv.open_amount_cents ?? Math.round((inv.outstanding_amount || 0) * 100);
    let score = 0;
    const reasons = [];

    if (openCents === amount) {
      score += 0.5;
      reasons.push('Exact bedrag match');
    } else if (Math.abs(openCents - amount) < 10) {
      score += 0.35;
      reasons.push('Bedrag bijna gelijk');
    } else if (openCents >= amount * 0.95 && openCents <= amount * 1.05) {
      score += 0.25;
      reasons.push('Bedrag in range');
    }

    const invNum = (inv.invoice_number || '').toLowerCase();
    if (invoiceCandidates.some(c => invNum.includes(c) || c.includes(invNum))) {
      score += 0.4;
      reasons.push(`Factuurnummer in omschrijving: ${inv.invoice_number}`);
    }
    if (invNum && desc.includes(invNum)) {
      score += 0.2;
      reasons.push('Factuurnummer in tekst');
    }

    const custName = customerNames[inv.customer_id] || '';
    if (custName && counterpartyName && (counterpartyName.includes(custName) || custName.includes(counterpartyName))) {
      score += 0.2;
      reasons.push('Klantnaam match');
    }

    return { invoice: inv, score: Math.min(1, score), reasons };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

/**
 * Build suggestion from rules + invoice ranking. No LLM call.
 * @param {object} tx - bank_transaction row
 * @param {object} opts - { organizationId, ownIbans, triggerSuggestionPipeline }
 * @returns {Promise<object>} suggestion row to insert
 */
async function buildSuggestion(tx, opts = {}) {
  const organizationId = opts.organizationId || null;
  const ownIbans = opts.ownIbans || [];
  const rules = await getCounterpartyRules(organizationId);
  const rule = matchCounterpartyRules(tx, rules);

  if (isInternalTransfer(tx, ownIbans)) {
    return {
      transaction_id: tx.id,
      model_version: MODEL_VERSION,
      suggested_type: 'transfer',
      suggested_invoice_ids: [],
      suggested_invoice_scores: null,
      suggested_customer_id: null,
      suggested_deal_id: null,
      suggested_post_code: 'interne-overboeking',
      suggested_vat_type: 'unknown',
      suggested_split: null,
      confidence: 0.98,
      reasons: ['Interne overboeking (eigen rekening gedetecteerd)'],
    };
  }

  if (rule) {
    const reasons = ['Counterparty rule match'];
    if (rule.default_post_code) reasons.push(`Post: ${rule.default_post_code}`);
    return {
      transaction_id: tx.id,
      model_version: MODEL_VERSION,
      suggested_type: rule.default_customer_id || rule.default_deal_id ? 'invoice_match' : 'ledger_post',
      suggested_invoice_ids: [],
      suggested_invoice_scores: null,
      suggested_customer_id: rule.default_customer_id || null,
      suggested_deal_id: rule.default_deal_id || null,
      suggested_post_code: rule.default_post_code || null,
      suggested_vat_type: null,
      suggested_split: null,
      confidence: rule.auto_accept ? 0.97 : 0.85,
      reasons,
    };
  }

  const openInvoices = await getOpenInvoicesWindow(organizationId, tx.booked_at);
  const customerIds = [...new Set(openInvoices.map(i => i.customer_id))];
  const customerNames = await getCustomerNames(customerIds);
  const scored = scoreInvoiceCandidates(tx, openInvoices, customerNames);
  const top = scored[0];

  if (top && top.score >= 0.5) {
    const invoiceMatches = scored.slice(0, 5).map(s => ({
      invoice_id: s.invoice.id,
      score: s.score,
      reason: s.reasons.join('; '),
    }));
    return {
      transaction_id: tx.id,
      model_version: MODEL_VERSION,
      suggested_type: 'invoice_match',
      suggested_invoice_ids: [top.invoice.id],
      suggested_invoice_scores: invoiceMatches,
      suggested_customer_id: top.invoice.customer_id,
      suggested_deal_id: top.invoice.deal_id || null,
      suggested_post_code: null,
      suggested_vat_type: null,
      suggested_split: top.score < 0.9 && top.invoice.open_amount_cents !== tx.amount_cents
        ? [{ kind: 'invoice', ref_id: top.invoice.id, allocated_cents: tx.amount_cents, vat_type: null }]
        : null,
      confidence: Math.min(0.98, top.score + 0.1),
      reasons: top.reasons,
    };
  }

  const paymentProcessors = ['mollie', 'stripe', 'paypal', 'ideal'];
  const desc = (tx.description || '').toLowerCase();
  const isProcessor = paymentProcessors.some(p => desc.includes(p));
  if (isProcessor && tx.direction === 'in') {
    return {
      transaction_id: tx.id,
      model_version: MODEL_VERSION,
      suggested_type: 'ledger_post',
      suggested_invoice_ids: [],
      suggested_invoice_scores: null,
      suggested_customer_id: null,
      suggested_deal_id: null,
      suggested_post_code: 'processor-payout',
      suggested_vat_type: 'vat_0',
      suggested_split: null,
      confidence: 0.75,
      reasons: ['Betaalprovider uitbetaling gedetecteerd'],
    };
  }

  return {
    transaction_id: tx.id,
    model_version: MODEL_VERSION,
    suggested_type: 'unknown',
    suggested_invoice_ids: [],
    suggested_invoice_scores: scored.length ? scored.slice(0, 3).map(s => ({ invoice_id: s.invoice.id, score: s.score, reason: s.reasons.join('; ') })) : null,
    suggested_customer_id: null,
    suggested_deal_id: null,
    suggested_post_code: null,
    suggested_vat_type: null,
    suggested_split: null,
    confidence: 0.3,
    reasons: ['Geen regel of factuurmatch; handmatige keuze nodig'],
  };
}

/**
 * Run suggestion for a transaction and upsert bank_transaction_suggestions; set status to 'suggested'.
 */
async function runSuggestionForTransaction(transactionId) {
  const { data: tx, error: txErr } = await supabaseAdmin
    .from('bank_transactions')
    .select('*')
    .eq('id', transactionId)
    .single();
  if (txErr || !tx) throw new Error('Transaction not found');

  const { data: accounts } = await supabaseAdmin.from('bank_accounts').select('iban');
  const ownIbans = (accounts || []).map(a => a.iban);

  const suggestion = await buildSuggestion(tx, { organizationId: tx.organization_id, ownIbans });

  await supabaseAdmin.from('bank_transaction_suggestions').upsert({
    transaction_id: suggestion.transaction_id,
    model_version: suggestion.model_version,
    suggested_type: suggestion.suggested_type,
    suggested_invoice_ids: suggestion.suggested_invoice_ids || [],
    suggested_invoice_scores: suggestion.suggested_invoice_scores || null,
    suggested_customer_id: suggestion.suggested_customer_id,
    suggested_deal_id: suggestion.suggested_deal_id,
    suggested_post_code: suggestion.suggested_post_code,
    suggested_vat_type: suggestion.suggested_vat_type,
    suggested_split: suggestion.suggested_split,
    confidence: suggestion.confidence,
    reasons: suggestion.reasons || [],
  }, { onConflict: 'transaction_id' });

  await supabaseAdmin
    .from('bank_transactions')
    .update({ status: 'suggested', updated_at: new Date().toISOString() })
    .eq('id', transactionId);

  return suggestion;
}

/**
 * Run suggestions for all transactions in status 'new' (optional limit).
 */
async function runSuggestionsForNewTransactions(limit = 50) {
  const { data: list } = await supabaseAdmin
    .from('bank_transactions')
    .select('id')
    .eq('status', 'new')
    .limit(limit);
  const results = [];
  for (const row of list || []) {
    try {
      const s = await runSuggestionForTransaction(row.id);
      results.push({ transaction_id: row.id, confidence: s.confidence });
    } catch (e) {
      results.push({ transaction_id: row.id, error: e.message });
    }
  }
  return results;
}

module.exports = {
  buildSuggestion,
  runSuggestionForTransaction,
  runSuggestionsForNewTransactions,
  getOpenInvoicesWindow,
  extractInvoiceNumberCandidates,
  DEFAULT_CONFIDENCE_THRESHOLD,
};
