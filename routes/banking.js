/**
 * Banking (AI Bankier) API routes.
 * Mounted at /admin/api/banking with requireAuth + isManagerOrAdmin.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabaseAdmin } = require('../config/supabase');
const bankingImportService = require('../services/bankingImportService');
const bankingSuggestionService = require('../services/bankingSuggestionService');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /admin/api/banking/accounts
router.get('/accounts', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('bank_accounts').select('*').order('name');
    if (error) throw error;
    res.json({ accounts: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to fetch accounts' });
  }
});

// GET /admin/api/banking/post-catalog
router.get('/post-catalog', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('finance_post_catalog').select('*').eq('is_active', true).order('code');
    if (error) throw error;
    res.json({ posts: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to fetch post catalog' });
  }
});

// GET /admin/api/banking/invoices-open
router.get('/invoices-open', async (req, res) => {
  try {
    const { q } = req.query;
    let query = supabaseAdmin
      .from('customer_invoices')
      .select('id, invoice_number, customer_id, deal_id, amount, outstanding_amount, open_amount_cents, due_date')
      .in('status', ['pending', 'overdue', 'partial'])
      .order('due_date', { ascending: false })
      .limit(50);
    if (q) {
      query = query.or(`invoice_number.ilike.%${q}%,id.eq.${q}`);
    }
    const { data, error } = await query;
    if (error) throw error;
    const ids = [...new Set((data || []).map(i => i.customer_id))];
    const { data: customers } = await supabaseAdmin.from('customers').select('id, name').in('id', ids);
    const custMap = (customers || []).reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {});
    const list = (data || []).map(inv => ({ ...inv, customer_name: custMap[inv.customer_id] || '' }));
    res.json({ invoices: list });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to fetch invoices' });
  }
});

// GET /admin/api/banking/transactions (list with filters, pagination)
router.get('/transactions', async (req, res) => {
  try {
    const { bank_account_id, status, from_date, to_date, search, page = 1, per_page = 25 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const perPage = Math.min(100, Math.max(1, parseInt(per_page, 10)));
    const from = (pageNum - 1) * perPage;

    let query = supabaseAdmin
      .from('bank_transactions')
      .select('id, bank_account_id, booked_at, amount_cents, currency, direction, counterparty_name, counterparty_iban, description, remittance_info, end_to_end_id, status, created_at', { count: 'exact' })
      .order('booked_at', { ascending: false })
      .range(from, from + perPage - 1);

    if (bank_account_id) query = query.eq('bank_account_id', bank_account_id);
    if (status) query = query.eq('status', status);
    if (from_date) query = query.gte('booked_at', from_date);
    if (to_date) query = query.lte('booked_at', to_date + 'T23:59:59.999Z');
    if (search) query = query.or(`counterparty_name.ilike.%${search}%,description.ilike.%${search}%,remittance_info.ilike.%${search}%`);

    const { data: rows, error, count } = await query;
    if (error) throw error;

    const ids = (rows || []).map(r => r.id);
    const { data: suggestions } = await supabaseAdmin
      .from('bank_transaction_suggestions')
      .select('transaction_id, suggested_type, suggested_invoice_ids, suggested_post_code, confidence, reasons')
      .in('transaction_id', ids);
    const suggMap = (suggestions || []).reduce((acc, s) => { acc[s.transaction_id] = s; return acc; }, {});

    const list = (rows || []).map(r => ({
      ...r,
      suggestion: suggMap[r.id] || null,
    }));

    res.json({ transactions: list, total: count ?? list.length, page: pageNum, per_page: perPage });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to fetch transactions' });
  }
});

// GET /admin/api/banking/transactions/:id (single + suggestion + matches)
router.get('/transactions/:id', async (req, res) => {
  try {
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('bank_transactions')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (txErr || !tx) return res.status(404).json({ error: 'Transaction not found' });

    const { data: suggestion } = await supabaseAdmin
      .from('bank_transaction_suggestions')
      .select('*')
      .eq('transaction_id', tx.id)
      .maybeSingle();

    const { data: matches } = await supabaseAdmin
      .from('bank_transaction_matches')
      .select('*')
      .eq('transaction_id', tx.id);

    const { data: postings } = await supabaseAdmin
      .from('bank_transaction_postings')
      .select('*')
      .eq('transaction_id', tx.id);

    let invoices = [];
    if (suggestion?.suggested_invoice_ids?.length) {
      const { data: invs } = await supabaseAdmin
        .from('customer_invoices')
        .select('id, invoice_number, customer_id, amount, outstanding_amount, open_amount_cents, due_date')
        .in('id', suggestion.suggested_invoice_ids);
      invoices = invs || [];
    }
    if (suggestion?.suggested_invoice_scores?.length) {
      const ids = suggestion.suggested_invoice_scores.map(s => s.invoice_id).filter(Boolean);
      if (ids.length) {
        const { data: invs } = await supabaseAdmin
          .from('customer_invoices')
          .select('id, invoice_number, customer_id, amount, outstanding_amount, open_amount_cents, due_date')
          .in('id', ids);
        const existing = (invs || []).reduce((acc, i) => { acc[i.id] = i; return acc; }, {});
        suggestion.suggested_invoice_scores.forEach(s => {
          if (existing[s.invoice_id] && !invoices.find(i => i.id === s.invoice_id)) invoices.push(existing[s.invoice_id]);
        });
      }
    }

    res.json({
      transaction: tx,
      suggestion: suggestion || null,
      matches: matches || [],
      postings: postings || [],
      invoices,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to fetch transaction' });
  }
});

// POST /admin/api/banking/import
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'No file uploaded' });
    const bankAccountId = req.body.bank_account_id || req.body.bankAccountId;
    if (!bankAccountId) return res.status(400).json({ error: 'bank_account_id required' });

    const rows = bankingImportService.parseBankFile(req.file.buffer, req.file.originalname);
    if (!rows.length) return res.status(400).json({ error: 'No valid transactions in file' });

    const result = await bankingImportService.importTransactions(bankAccountId, req.body.organization_id || null, rows);

    setImmediate(() => {
      bankingSuggestionService.runSuggestionsForNewTransactions(100).catch(err => console.error('Banking suggestions error:', err));
    });

    res.json({
      success: true,
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors,
      total_rows: rows.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Import failed' });
  }
});

// POST /admin/api/banking/transactions/:id/suggest
router.post('/transactions/:id/suggest', async (req, res) => {
  try {
    const suggestion = await bankingSuggestionService.runSuggestionForTransaction(req.params.id);
    res.json({ success: true, suggestion });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Suggestion failed' });
  }
});

// POST /admin/api/banking/transactions/:id/approve
router.post('/transactions/:id/approve', async (req, res) => {
  try {
    const userId = req.user?.id;
    const { allocation } = req.body;

    const { data: tx, error: txErr } = await supabaseAdmin
      .from('bank_transactions')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (txErr || !tx) return res.status(404).json({ error: 'Transaction not found' });

    const { data: suggestion } = await supabaseAdmin
      .from('bank_transaction_suggestions')
      .select('*')
      .eq('transaction_id', tx.id)
      .maybeSingle();

    if (suggestion?.suggested_type === 'invoice_match') {
      const allocations = allocation && Array.isArray(allocation) && allocation.length
        ? allocation
        : (suggestion.suggested_invoice_ids && suggestion.suggested_invoice_ids.length
          ? [{ invoice_id: suggestion.suggested_invoice_ids[0], allocated_cents: tx.amount_cents }]
          : []);

      if (!allocations.length) return res.status(400).json({ error: 'No invoice allocation' });

      for (const a of allocations) {
        await supabaseAdmin.from('bank_transaction_matches').insert({
          transaction_id: tx.id,
          invoice_id: a.invoice_id,
          allocated_cents: a.allocated_cents,
          created_by: userId,
        });

        const { data: inv } = await supabaseAdmin.from('customer_invoices').select('open_amount_cents, outstanding_amount').eq('id', a.invoice_id).single();
        const openCents = inv?.open_amount_cents ?? Math.round((inv?.outstanding_amount || 0) * 100);
        const newOpen = Math.max(0, openCents - a.allocated_cents);
        const newStatus = newOpen === 0 ? 'paid' : 'partial';
        await supabaseAdmin
          .from('customer_invoices')
          .update({
            outstanding_amount: newOpen / 100,
            open_amount_cents: newOpen,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', a.invoice_id);
      }

      await supabaseAdmin
        .from('bank_transactions')
        .update({ status: 'linked', updated_at: new Date().toISOString() })
        .eq('id', tx.id);
    } else if (suggestion?.suggested_type === 'ledger_post' || suggestion?.suggested_type === 'transfer') {
      const postCode = req.body.post_code || suggestion?.suggested_post_code || 'interne-overboeking';
      const vatType = req.body.vat_type || suggestion?.suggested_vat_type || null;

      await supabaseAdmin.from('bank_transaction_postings').insert({
        transaction_id: tx.id,
        post_code: postCode,
        vat_type: vatType,
        amount_cents: tx.amount_cents,
        created_by: userId,
      });

      await supabaseAdmin
        .from('bank_transactions')
        .update({ status: 'posted', updated_at: new Date().toISOString() })
        .eq('id', tx.id);
    } else {
      return res.status(400).json({ error: 'Suggestie type ondersteunt geen directe acceptatie; kies handmatig een post of factuur.' });
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Approve failed' });
  }
});

// POST /admin/api/banking/accounts (create)
router.post('/accounts', async (req, res) => {
  try {
    const { name, iban, currency, organization_id } = req.body || {};
    if (!iban) return res.status(400).json({ error: 'iban required' });
    const id = await bankingImportService.ensureBankAccount({ name, iban, currency, organization_id });
    const { data } = await supabaseAdmin.from('bank_accounts').select('*').eq('id', id).single();
    res.status(201).json({ account: data });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Create account failed' });
  }
});

module.exports = router;
