'use strict';

/**
 * Banking sync service: fetch transactions from Rabobank API for org_bank_connections,
 * normalize, dedupe (reference_hash), insert into bank_transactions, run suggestion pipeline.
 */
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const RabobankApiService = require('./rabobankApiService');
const bankingSuggestionService = require('./bankingSuggestionService');

const INITIAL_DAYS_BACK = 90;
const OVERLAP_DAYS = 2;

function referenceHash(providerAccountId, bookedAt, amountCents, endToEndId, description) {
  const str = [providerAccountId, bookedAt, amountCents, endToEndId || '', (description || '').substring(0, 200)].join('|');
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Normalize Rabobank transaction item to our bank_transactions row shape.
 * Handles common PSD2 shapes: amount with creditDebitIndicator or signed amount.
 */
function normalizeTransaction(apiTx, bankAccountId, organizationId, providerAccountId) {
  let bookedAt = apiTx.bookingDate || apiTx.bookedAt || apiTx.date;
  if (!bookedAt) return null;
  if (typeof bookedAt === 'string' && bookedAt.length === 10) bookedAt = bookedAt + 'T12:00:00.000Z';
  else if (typeof bookedAt === 'string') bookedAt = new Date(bookedAt).toISOString();
  else bookedAt = new Date(bookedAt).toISOString();

  let amount = apiTx.amount || apiTx.transactionAmount?.amount;
  const currency = (apiTx.transactionAmount?.currency || apiTx.currency || 'EUR').toUpperCase();
  if (amount == null && apiTx.amountCents != null) {
    amount = apiTx.amountCents / 100;
  }
  if (amount == null) return null;
  const num = typeof amount === 'string' ? parseFloat(amount.replace(',', '.')) : Number(amount);
  if (isNaN(num)) return null;

  const creditDebit = (apiTx.creditDebitIndicator || apiTx.creditDebit || '').toLowerCase();
  const direction = creditDebit === 'credit' || num >= 0 ? 'in' : 'out';
  const amountCents = Math.round(Math.abs(num) * 100);

  const counterpartyName = apiTx.debtorName || apiTx.creditorName || apiTx.counterpartyName || apiTx.name || null;
  const counterpartyIban = (apiTx.debtorAccount?.iban || apiTx.creditorAccount?.iban || apiTx.counterpartyIban || apiTx.counterpartyAccount || '').replace(/\s/g, '') || null;
  const description = apiTx.remittanceInformationUnstructured || apiTx.remittanceInformation || apiTx.details || apiTx.description || null;
  const endToEndId = apiTx.endToEndId || apiTx.transactionId || null;

  const refHash = referenceHash(providerAccountId, bookedAt, amountCents, endToEndId, description);

  return {
    bank_account_id: bankAccountId,
    organization_id: organizationId || null,
    booked_at: bookedAt,
    amount_cents: amountCents,
    currency: currency === 'EUR' ? 'EUR' : currency,
    direction,
    counterparty_name: counterpartyName,
    counterparty_iban: counterpartyIban,
    description: description ? String(description).substring(0, 1000) : null,
    remittance_info: description,
    end_to_end_id: endToEndId,
    reference_hash: refHash,
    raw_json: apiTx,
    status: 'new',
  };
}

/**
 * Ensure we have a valid access token; refresh if expired.
 */
async function ensureAccessToken(connection) {
  if (!connection.access_token) return null;
  const expiresAt = connection.expires_at ? new Date(connection.expires_at) : null;
  const now = new Date();
  if (expiresAt && expiresAt.getTime() - now.getTime() < 5 * 60 * 1000 && connection.refresh_token) {
    const tokenData = await RabobankApiService.refreshAccessToken(connection.refresh_token);
    const newExpires = new Date();
    newExpires.setSeconds(newExpires.getSeconds() + (tokenData.expires_in || 3600));
    await supabaseAdmin
      .from('org_bank_connections')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || connection.refresh_token,
        expires_at: newExpires.toISOString(),
        last_error: null,
        status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);
    return tokenData.access_token;
  }
  return connection.access_token;
}

/**
 * Sync one org_bank_connection: fetch transactions for all linked bank_accounts, insert new, update last_synced_at.
 * @param {string} connectionId - org_bank_connections.id
 * @returns {Promise<{ newTransactions: number, error?: string }>}
 */
async function syncConnection(connectionId) {
  const { data: conn, error: connErr } = await supabaseAdmin
    .from('org_bank_connections')
    .select('*')
    .eq('id', connectionId)
    .single();

  if (connErr || !conn) {
    throw new Error('Connection not found');
  }
  if (conn.provider !== 'rabobank') {
    throw new Error('Only Rabobank sync is implemented');
  }

  const accessToken = await ensureAccessToken(conn);
  if (!accessToken) {
    await supabaseAdmin
      .from('org_bank_connections')
      .update({ status: 'action_required', last_error: 'Geen toegangstoken', updated_at: new Date().toISOString() })
      .eq('id', connectionId);
    throw new Error('No access token');
  }

  const runId = (await supabaseAdmin.from('bank_sync_runs').insert({
    organization_id: conn.organization_id,
    connection_id: connectionId,
    status: 'running',
    new_transactions: 0,
  }).select('id').single()).data?.id;

  let totalNew = 0;
  let lastError = null;

  try {
    const { data: accounts } = await supabaseAdmin
      .from('bank_accounts')
      .select('id, provider_account_id, organization_id')
      .eq('connection_id', connectionId)
      .eq('is_active', true);

    if (!accounts || accounts.length === 0) {
      await supabaseAdmin.from('bank_sync_runs').update({
        status: 'success',
        finished_at: new Date().toISOString(),
        new_transactions: 0,
      }).eq('id', runId);
      await supabaseAdmin.from('org_bank_connections').update({
        last_synced_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', connectionId);
      return { newTransactions: 0 };
    }

    const now = new Date();
    const toDate = now.toISOString().slice(0, 10);
    const lastSynced = conn.last_synced_at ? new Date(conn.last_synced_at) : null;
    const fromDate = lastSynced
      ? new Date(lastSynced.getTime() - OVERLAP_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : new Date(now.getTime() - INITIAL_DAYS_BACK * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    for (const acc of accounts) {
      const providerAccountId = acc.provider_account_id || acc.id;
      try {
        const txResponse = await RabobankApiService.getAccountTransactions(accessToken, providerAccountId, {
          dateFrom: fromDate,
          dateTo: toDate,
          bookingStatus: 'booked',
        });

        let rawList = txResponse.transactions || txResponse.transactionList || txResponse.accountTransactions || [];
        if (rawList && !Array.isArray(rawList) && typeof rawList === 'object') {
          rawList = rawList.booked || rawList.transactions || rawList.transactionList || [];
        }
        const list = Array.isArray(rawList) ? rawList : [];

        for (const apiTx of list) {
          const row = normalizeTransaction(apiTx, acc.id, acc.organization_id || conn.organization_id, providerAccountId);
          if (!row) continue;
          const { error } = await supabaseAdmin.from('bank_transactions').insert(row);
          if (!error) totalNew++;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    await supabaseAdmin.from('bank_sync_runs').update({
      status: lastError ? 'failed' : 'success',
      finished_at: new Date().toISOString(),
      new_transactions: totalNew,
      error: lastError,
    }).eq('id', runId);

    await supabaseAdmin.from('org_bank_connections').update({
      last_synced_at: new Date().toISOString(),
      last_error: lastError,
      status: lastError ? 'error' : 'connected',
      updated_at: new Date().toISOString(),
    }).eq('id', connectionId);

    if (totalNew > 0) {
      setImmediate(() => {
        bankingSuggestionService.runSuggestionsForNewTransactions(100).catch(e => console.error('Banking suggestions error:', e));
      });
    }

    return { newTransactions: totalNew, error: lastError || undefined };
  } catch (err) {
    lastError = err.message;
    await supabaseAdmin.from('bank_sync_runs').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error: lastError,
    }).eq('id', runId);
    await supabaseAdmin.from('org_bank_connections').update({
      last_error: lastError,
      status: 'error',
      updated_at: new Date().toISOString(),
    }).eq('id', connectionId);
    throw err;
  }
}

/**
 * Sync all connected org_bank_connections (for cron).
 */
async function syncAllConnections() {
  const { data: connections } = await supabaseAdmin
    .from('org_bank_connections')
    .select('id')
    .eq('status', 'connected');

  const results = [];
  for (const c of connections || []) {
    try {
      const r = await syncConnection(c.id);
      results.push({ connectionId: c.id, ...r });
    } catch (e) {
      results.push({ connectionId: c.id, error: e.message });
    }
  }
  return results;
}

module.exports = {
  syncConnection,
  syncAllConnections,
  referenceHash,
  normalizeTransaction,
};
