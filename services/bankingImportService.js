/**
 * Banking import service: CSV, MT940, CAMT.053 parsing → normalized bank_transactions.
 * Dedupe via reference_hash; inserts only new rows.
 */
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');

const DEFAULT_CURRENCY = 'EUR';

/**
 * Generate a stable hash for deduplication.
 * @param {object} row - { bank_account_id, booked_at, amount_cents, counterparty_iban?, end_to_end_id?, description? }
 */
function referenceHash(row) {
  const str = [
    row.bank_account_id,
    row.booked_at,
    row.amount_cents,
    row.counterparty_iban || '',
    row.end_to_end_id || '',
    (row.description || '').substring(0, 200),
  ].join('|');
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Parse a single CSV row (generic format).
 * Expected columns (flexible): date, amount, name, iban, description, reference, etc.
 * Amount: can be "123.45" or "-123.45" or "123,45" (EU).
 */
function parseCSVRow(headers, values) {
  const get = (keys) => {
    for (const k of keys) {
      const i = headers.findIndex(h => h && h.toLowerCase().replace(/\s/g, '').includes(k.toLowerCase().replace(/\s/g, '')));
      if (i >= 0 && values[i] !== undefined && values[i] !== '') return String(values[i]).trim();
    }
    return null;
  };
  const dateStr = get(['date', 'datum', 'booked', 'value']);
  const amountStr = get(['amount', 'bedrag', 'amount_cents', 'credit', 'debit']);
  const name = get(['name', 'naam', 'counterparty', 'tegenrekening', 'description']);
  const iban = get(['iban', 'counterparty_iban', 'tegenrekeningiban']);
  const description = get(['description', 'omschrijving', 'details', 'info']) || name;
  const ref = get(['reference', 'referentie', 'end_to_end', 'id']);

  let booked_at = null;
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) booked_at = d.toISOString();
  }
  if (!booked_at) return null;

  let amount_cents = 0;
  if (amountStr) {
    const normalized = String(amountStr).replace(',', '.').replace(/\s/g, '');
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      amount_cents = Math.round(num * 100);
    }
  }
  const direction = amount_cents >= 0 ? 'in' : 'out';
  amount_cents = Math.abs(amount_cents);
  if (amount_cents === 0) return null;

  return {
    booked_at: booked_at,
    amount_cents,
    direction,
    counterparty_name: name || null,
    counterparty_iban: iban ? iban.replace(/\s/g, '') : null,
    description: description || null,
    remittance_info: ref || null,
    end_to_end_id: ref || null,
  };
}

/**
 * Parse CSV buffer (UTF-8). First row = headers.
 * Returns array of normalized rows.
 */
function parseCSV(buffer) {
  const text = (buffer instanceof Buffer ? buffer.toString('utf8') : buffer).trim();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[,;\t]/).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/[,;\t]/).map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row = parseCSVRow(headers, values);
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * Parse MT940 (simplified). Looks for :61: and :86: blocks.
 */
function parseMT940(buffer) {
  const text = (buffer instanceof Buffer ? buffer.toString('utf8') : buffer);
  const rows = [];
  const lines = text.split(/\r?\n/);
  let current = null;
  for (const line of lines) {
    if (line.startsWith(':61:')) {
      const content = line.slice(4).trim();
      // 1601010101C123,45NTRFNONREF -> date 160101 = 2016-01-01, C/D, amount, NTRF...
      const match = content.match(/^(\d{6})(\d{4})?([CD])([\d,]+)/);
      if (match) {
        const [, d, , dr, am] = match;
        const y = d.slice(0, 2);
        const year = parseInt(y, 10) >= 50 ? `19${y}` : `20${y}`;
        const month = d.slice(2, 4);
        const day = d.slice(4, 6);
        const booked_at = `${year}-${month}-${day}T00:00:00.000Z`;
        const amountStr = am.replace(',', '.');
        const amount_cents = Math.round(parseFloat(amountStr) * 100);
        const direction = dr === 'C' ? 'in' : 'out';
        current = {
          booked_at,
          amount_cents: Math.abs(amount_cents),
          direction,
          counterparty_name: null,
          counterparty_iban: null,
          description: null,
          remittance_info: null,
          end_to_end_id: null,
        };
      }
    } else if (current && (line.startsWith(':86:') || line.startsWith(':86'))) {
      const info = line.replace(/^:86:?/, '').trim();
      current.remittance_info = info;
      current.description = info.substring(0, 500);
      rows.push(current);
      current = null;
    } else if (current && line.startsWith(':62')) {
      rows.push(current);
      current = null;
    }
  }
  if (current) rows.push(current);
  return rows;
}

/**
 * Parse CAMT.053 (XML) - simplified: Ntry with Amt and NtryDtls.
 */
function parseCAMT053(buffer) {
  const text = (buffer instanceof Buffer ? buffer.toString('utf8') : buffer);
  const rows = [];
  const dateMatch = text.match(/<Dt>(\d{4}-\d{2}-\d{2})<\/Dt>/);
  const bookedDate = dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10);
  const amountRegex = /<Amt Ccy="([A-Z]{3})">([-\d,.]+)<\/Amt>/g;
  const refRegex = /<Refs>[^]*?<EndToEndId>([^<]*)<\/EndToEndId>/g;
  const refs = [];
  let m;
  while ((m = refRegex.exec(text)) !== null) refs.push(m[1]);
  let idx = 0;
  while ((m = amountRegex.exec(text)) !== null) {
    const ccy = m[1];
    const amount = parseFloat(m[2].replace(',', '.'));
    const amount_cents = Math.abs(Math.round(amount * 100));
    const direction = amount >= 0 ? 'in' : 'out';
    const end_to_end_id = refs[idx] || null;
    idx++;
    rows.push({
      booked_at: `${bookedDate}T00:00:00.000Z`,
      amount_cents,
      direction,
      counterparty_name: null,
      counterparty_iban: null,
      description: null,
      remittance_info: end_to_end_id,
      end_to_end_id,
    });
  }
  return rows;
}

/**
 * Detect format and parse.
 * @param {Buffer} buffer
 * @param {string} filename - optional, for hint (e.g. .csv, .sta, .xml)
 */
function parseBankFile(buffer, filename = '') {
  const lower = (filename || '').toLowerCase();
  if (lower.endsWith('.sta') || lower.endsWith('.mt940') || buffer.toString('utf8', 0, 50).includes(':20:')) {
    return parseMT940(buffer);
  }
  if (lower.endsWith('.xml') || buffer.toString('utf8', 0, 200).includes('<BkToCstmrAcctRpt>')) {
    return parseCAMT053(buffer);
  }
  return parseCSV(buffer);
}

/**
 * Insert transactions for a bank account. Dedupe by reference_hash; skip existing.
 * @param {string} bankAccountId - UUID
 * @param {string|null} organizationId - optional
 * @param {Array<object>} rows - normalized rows from parseBankFile
 * @returns {Promise<{ inserted: number, skipped: number, errors: string[] }>}
 */
async function importTransactions(bankAccountId, organizationId, rows) {
  const errors = [];
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const refHash = referenceHash({
      bank_account_id: bankAccountId,
      booked_at: row.booked_at,
      amount_cents: row.amount_cents,
      counterparty_iban: row.counterparty_iban,
      end_to_end_id: row.end_to_end_id,
      description: row.description,
    });
    const payload = {
      bank_account_id: bankAccountId,
      organization_id: organizationId || null,
      booked_at: row.booked_at,
      amount_cents: row.amount_cents,
      currency: row.currency || DEFAULT_CURRENCY,
      direction: row.direction,
      counterparty_name: row.counterparty_name,
      counterparty_iban: row.counterparty_iban,
      description: row.description,
      remittance_info: row.remittance_info,
      end_to_end_id: row.end_to_end_id,
      reference_hash: refHash,
      raw_json: row.raw_json || null,
      status: 'new',
    };

    const { error } = await supabaseAdmin
      .from('bank_transactions')
      .insert(payload);

    if (error) {
      if (error.code === '23505') {
        skipped++;
      } else {
        errors.push(error.message);
      }
    } else {
      inserted++;
    }
  }

  return { inserted, skipped, errors };
}

/**
 * Create a bank account if not exists.
 * @param {object} params - { name, iban, currency?, organization_id?, provider?, provider_account_id?, connection_id?, is_active? }
 */
async function ensureBankAccount(params) {
  const ibanNorm = params.iban.replace(/\s/g, '');
  const existing = params.connection_id && params.provider_account_id
    ? (await supabaseAdmin.from('bank_accounts').select('id').eq('connection_id', params.connection_id).eq('provider_account_id', params.provider_account_id).maybeSingle()).data
    : (await supabaseAdmin.from('bank_accounts').select('id').eq('iban', ibanNorm).maybeSingle()).data;

  if (existing) return existing.id;

  const { data: inserted, error } = await supabaseAdmin
    .from('bank_accounts')
    .insert({
      name: params.name || 'Bankrekening',
      iban: ibanNorm,
      currency: params.currency || DEFAULT_CURRENCY,
      organization_id: params.organization_id || null,
      provider: params.provider || null,
      provider_account_id: params.provider_account_id || null,
      connection_id: params.connection_id || null,
      is_active: params.is_active !== false,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return inserted.id;
}

module.exports = {
  referenceHash,
  parseCSV,
  parseMT940,
  parseCAMT053,
  parseBankFile,
  importTransactions,
  ensureBankAccount,
};
