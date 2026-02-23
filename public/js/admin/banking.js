(function () {
  'use strict';

  const API = '/admin/api/banking';
  let accounts = [];
  let transactions = [];
  let totalCount = 0;
  let currentPage = 1;
  const perPage = 25;
  let selectedTxId = null;
  let drawerOpen = false;
  let searchDebounce = null;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return '—'; }
  }

  function formatAmount(cents, direction) {
    const n = (cents || 0) / 100;
    const s = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Math.abs(n));
    return direction === 'in' ? '+' + s : '−' + s;
  }

  function maskIban(iban) {
    if (!iban || iban.length < 8) return '****';
    return '****' + iban.slice(-4);
  }

  function statusLabel(s) {
    const map = { new: 'Te verwerken', suggested: 'Voorstel klaar', linked: 'Gekoppeld', posted: 'Afgehandeld', exception: 'Uitzondering' };
    return map[s] || s;
  }

  function suggestionSummary(suggestion) {
    if (!suggestion) return '—';
    if (suggestion.suggested_type === 'invoice_match' && suggestion.suggested_invoice_ids && suggestion.suggested_invoice_ids.length)
      return 'Match: factuur';
    if (suggestion.suggested_type === 'ledger_post' && suggestion.suggested_post_code)
      return 'Post: ' + suggestion.suggested_post_code;
    if (suggestion.suggested_type === 'transfer') return 'Interne overboeking';
    return 'Handmatig';
  }

  async function fetchAccounts() {
    const res = await fetch(API + '/accounts', { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    accounts = data.accounts || [];
    return accounts;
  }

  async function fetchTransactions() {
    const params = new URLSearchParams();
    params.set('page', currentPage);
    params.set('per_page', perPage);
    const accountId = qs('#bankingAccountSelect')?.value;
    const status = qs('#bankingStatusSelect')?.value;
    const from = qs('#bankingFromDate')?.value;
    const to = qs('#bankingToDate')?.value;
    const search = qs('#bankingSearch')?.value?.trim();
    if (accountId) params.set('bank_account_id', accountId);
    if (status) params.set('status', status);
    if (from) params.set('from_date', from);
    if (to) params.set('to_date', to);
    if (search) params.set('search', search);

    const res = await fetch(API + '/transactions?' + params.toString(), { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    transactions = data.transactions || [];
    totalCount = data.total ?? transactions.length;
    return data;
  }

  async function fetchTransactionDetail(id) {
    const res = await fetch(API + '/transactions/' + id, { credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    return data;
  }

  function renderAccountsSelect() {
    const sel = qs('#bankingAccountSelect');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Alle rekeningen</option>';
    accounts.forEach(acc => {
      const opt = document.createElement('option');
      opt.value = acc.id;
      opt.textContent = (acc.name || 'Rekening') + ' ' + maskIban(acc.iban);
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  }

  function renderTable() {
    const tbody = qs('#bankingTableBody');
    const table = qs('#bankingTable');
    const loading = qs('#bankingListLoading');
    const empty = qs('#bankingListEmpty');
    if (!tbody || !table) return;

    loading.style.display = 'none';
    if (!transactions.length) {
      table.style.display = 'none';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    table.style.display = 'table';

    tbody.innerHTML = transactions.map(tx => {
      const s = tx.suggestion;
      const conf = s ? Math.round((s.confidence || 0) * 100) : 0;
      const summary = suggestionSummary(s);
      const statusClass = 'banking-status-' + (tx.status || 'new');
      return `
        <tr data-tx-id="${tx.id}" role="button" tabindex="0">
          <td onclick="event.stopPropagation()"><input type="checkbox" class="banking-row-check" data-tx-id="${tx.id}" aria-label="Selecteer"></td>
          <td>${formatDate(tx.booked_at)}</td>
          <td>${(tx.counterparty_name || '—').substring(0, 28)}</td>
          <td><span class="banking-suggestion-text" title="${(tx.description || '').replace(/"/g, '&quot;')}">${(tx.description || '—').substring(0, 40)}</span></td>
          <td class="${tx.direction === 'in' ? 'banking-amount-in' : 'banking-amount-out'}">${formatAmount(tx.amount_cents, tx.direction)}</td>
          <td><span class="banking-status-badge ${statusClass}">${statusLabel(tx.status)}</span></td>
          <td>${s ? `<span class="banking-confidence">${conf}%</span> ${summary}` : '—'}</td>
          <td><button type="button" class="banking-row-open" data-tx-id="${tx.id}" aria-label="Open">→</button></td>
        </tr>
      `;
    }).join('');
  }

  function renderPagination() {
    const el = qs('#bankingPagination');
    if (!el) return;
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    if (totalPages <= 1) {
      el.innerHTML = `<span>${totalCount} transacties</span>`;
      return;
    }
    el.innerHTML = `
      <span>${totalCount} transacties</span>
      <div>
        <button type="button" id="bankingPrevPage" ${currentPage <= 1 ? 'disabled' : ''}>← Vorige</button>
        <span style="margin: 0 8px">Pagina ${currentPage} / ${totalPages}</span>
        <button type="button" id="bankingNextPage" ${currentPage >= totalPages ? 'disabled' : ''}>Volgende →</button>
      </div>
    `;
  }

  function setDrawerOpen(open) {
    drawerOpen = open;
    const drawer = qs('#bankingDrawer');
    const overlay = qs('#bankingDrawerOverlay');
    if (drawer) {
      drawer.classList.toggle('is-open', open);
      drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    if (overlay) {
      overlay.classList.toggle('is-open', open);
      overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    document.documentElement.classList.toggle('banking-drawer-open', open);
    document.body.classList.toggle('banking-drawer-open', open);
  }

  function renderDrawerDetail(data) {
    const tx = data.transaction;
    const suggestion = data.suggestion;
    const matches = data.matches || [];
    const postings = data.postings || [];

    qs('#bankingDrawerTitle').textContent = formatAmount(tx.amount_cents, tx.direction) + ' – ' + (tx.counterparty_name || 'Onbekend');
    qs('#bankingDrawerSubtitle').textContent = formatDate(tx.booked_at) + (tx.description ? ' · ' + tx.description.substring(0, 50) : '');

    const voorstelPane = qs('#bankingTabVoorstel');
    const block = qs('#bankingSuggestionBlock');
    if (!block) return;

    if (suggestion) {
      const reasons = (suggestion.reasons || []);
      const canApprove = ['invoice_match', 'ledger_post', 'transfer'].includes(suggestion.suggested_type);
      block.innerHTML = `
        <h4>AI Voorstel</h4>
        <p><span class="banking-confidence">${Math.round((suggestion.confidence || 0) * 100)}%</span> ${suggestion.suggested_type || '—'}</p>
        ${reasons.length ? '<ul class="banking-suggestion-reasons">' + reasons.map(r => '<li>' + r + '</li>').join('') + '</ul>' : ''}
        ${suggestion.suggested_type === 'invoice_match' && (suggestion.suggested_invoice_ids && suggestion.suggested_invoice_ids.length) ? '<p><strong>Factuur:</strong> ' + (suggestion.suggested_invoice_ids[0] ? 'Geselecteerd' : '') + '</p>' : ''}
        ${suggestion.suggested_post_code ? '<p><strong>Post:</strong> ' + suggestion.suggested_post_code + '</p>' : ''}
      `;
      qs('#bankingApproveActions').style.display = canApprove ? 'flex' : 'none';
    } else {
      block.innerHTML = '<p>Geen voorstel. Klik op "Voorstel maken" of kies handmatig een post/factuur.</p>';
      qs('#bankingApproveActions').style.display = 'none';
    }

    const detailsList = qs('#bankingDetailsList');
    if (detailsList) {
      detailsList.innerHTML = `
        <dt>Bedrag</dt><dd>${formatAmount(tx.amount_cents, tx.direction)}</dd>
        <dt>Datum</dt><dd>${formatDate(tx.booked_at)}</dd>
        <dt>Valuta</dt><dd>${tx.currency || 'EUR'}</dd>
        <dt>Tegenrekening</dt><dd>${tx.counterparty_name || '—'} ${tx.counterparty_iban ? '(' + maskIban(tx.counterparty_iban) + ')' : ''}</dd>
        <dt>Omschrijving</dt><dd>${tx.description || '—'}</dd>
        <dt>Kenmerk</dt><dd>${tx.end_to_end_id || tx.remittance_info || '—'}</dd>
      `;
    }
    const rawPre = qs('#bankingRawJson');
    if (rawPre) rawPre.textContent = tx.raw_json ? JSON.stringify(tx.raw_json, null, 2) : '—';

    const auditEl = qs('#bankingAuditContent');
    if (auditEl) {
      const lines = [];
      if (matches.length) lines.push('Gekoppeld aan factuur(en).');
      if (postings.length) lines.push('Geboekt als post: ' + (postings[0]?.post_code || '—') + '.');
      auditEl.innerHTML = lines.length ? '<p>' + lines.join('</p><p>') + '</p>' : '<p>Nog geen wijzigingen.</p>';
    }
  }

  async function openDrawer(txId) {
    selectedTxId = txId;
    const url = new URL(window.location.href);
    url.searchParams.set('tx', txId);
    window.history.replaceState({}, '', url);

    setDrawerOpen(true);
    const loading = qs('#bankingSuggestionBlock');
    if (loading) loading.innerHTML = '<p>Laden…</p>';

    let data = await fetchTransactionDetail(txId);
    if (!data.transaction) return;

    if (!data.suggestion && data.transaction.status === 'new') {
      try {
        await fetch(API + '/transactions/' + txId + '/suggest', { method: 'POST', credentials: 'same-origin' });
        data = await fetchTransactionDetail(txId);
      } catch (e) {
        console.error('Suggest failed', e);
      }
    }

    renderDrawerDetail(data);
    qs('#bankingTabVoorstel').style.display = 'block';
    qs('#bankingTabDetails').style.display = 'none';
    qs('#bankingTabAudit').style.display = 'none';
    qs('#bankingDrawerTabs').querySelectorAll('.banking-tab').forEach(t => t.classList.remove('active'));
    qs('#bankingDrawerTabs').querySelector('[data-tab="voorstel"]').classList.add('active');
  }

  function closeDrawer() {
    selectedTxId = null;
    const url = new URL(window.location.href);
    url.searchParams.delete('tx');
    window.history.replaceState({}, '', url);
    setDrawerOpen(false);
  }

  async function approveTransaction() {
    if (!selectedTxId) return;
    const btn = qs('#bankingApproveBtn');
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(API + '/transactions/' + selectedTxId + '/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Approve mislukt');
      if (typeof window.showNotification === 'function') window.showNotification('Goedgekeurd.', 'success', 3000);
      closeDrawer();
      await loadTransactions();
      renderTable();
      renderPagination();
    } catch (e) {
      if (typeof window.showNotification === 'function') window.showNotification(e.message || 'Fout', 'error', 5000);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function loadTransactions() {
    const loading = qs('#bankingListLoading');
    if (loading) loading.style.display = 'block';
    await fetchTransactions();
    renderTable();
    renderPagination();
    if (loading) loading.style.display = 'none';
  }

  function setupImportModal() {
    const btn = qs('#bankingImportBtn');
    const modal = qs('#bankingImportModal');
    const form = qs('#bankingImportForm');
    const cancel = qs('#bankingImportCancel');
    const fileInput = qs('#bankingImportFile');
    const accountSelect = qs('#bankingImportAccount');

    if (!modal || !form) return;

    btn.addEventListener('click', () => {
      modal.style.display = 'flex';
      accountSelect.innerHTML = '<option value="">Kies rekening</option>';
      accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.id;
        opt.textContent = (acc.name || 'Rekening') + ' ' + maskIban(acc.iban);
        accountSelect.appendChild(opt);
      });
      if (accounts.length === 1) accountSelect.value = accounts[0].id;
    });

    cancel.addEventListener('click', () => { modal.style.display = 'none'; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const accountId = accountSelect.value;
      const file = fileInput.files && fileInput.files[0];
      const errEl = qs('#bankingImportError');
      if (!accountId || !file) {
        if (errEl) { errEl.textContent = 'Kies een rekening en een bestand.'; errEl.style.display = 'block'; }
        return;
      }
      if (errEl) errEl.style.display = 'none';
      const fd = new FormData();
      fd.append('bank_account_id', accountId);
      fd.append('file', file);
      try {
        const res = await fetch(API + '/import', { method: 'POST', credentials: 'same-origin', body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Import mislukt');
        modal.style.display = 'none';
        form.reset();
        if (typeof window.showNotification === 'function') window.showNotification('Geïmporteerd: ' + (data.inserted || 0) + ' nieuw.', 'success', 4000);
        await loadTransactions();
        renderTable();
        renderPagination();
      } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
      }
    });
  }

  function init() {
    fetchAccounts().then(() => {
      renderAccountsSelect();
      const accountSel = qs('#bankingAccountSelect');
      const statusSel = qs('#bankingStatusSelect');
      const fromInput = qs('#bankingFromDate');
      const toInput = qs('#bankingToDate');
      const searchInput = qs('#bankingSearch');

      function onFilter() {
        currentPage = 1;
        loadTransactions();
      }

      if (accountSel) accountSel.addEventListener('change', onFilter);
      if (statusSel) statusSel.addEventListener('change', onFilter);
      if (fromInput) fromInput.addEventListener('change', onFilter);
      if (toInput) toInput.addEventListener('change', onFilter);
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          clearTimeout(searchDebounce);
          searchDebounce = setTimeout(onFilter, 300);
        });
      }

      const txFromUrl = new URLSearchParams(window.location.search).get('tx');
      if (txFromUrl) openDrawer(txFromUrl);
      else loadTransactions();
    });

    qs('#bankingTableBody')?.addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-tx-id]');
      if (row && !e.target.closest('input[type="checkbox"]')) openDrawer(row.getAttribute('data-tx-id'));
    });

    qs('#bankingDrawerOverlay')?.addEventListener('click', closeDrawer);
    qs('[data-drawer-close]')?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawerOpen) closeDrawer(); });

    qs('#bankingDrawerTabs')?.addEventListener('click', (e) => {
      const t = e.target.closest('.banking-tab[data-tab]');
      if (!t) return;
      const tab = t.getAttribute('data-tab');
      qs('#bankingDrawerTabs').querySelectorAll('.banking-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      qs('#bankingTabVoorstel').style.display = tab === 'voorstel' ? 'block' : 'none';
      qs('#bankingTabDetails').style.display = tab === 'details' ? 'block' : 'none';
      qs('#bankingTabAudit').style.display = tab === 'audit' ? 'block' : 'none';
    });

    qs('#bankingApproveBtn')?.addEventListener('click', approveTransaction);
    qs('#bankingAdjustBtn')?.addEventListener('click', () => { /* TODO: open adjust form */ });

    qs('#bankingPagination')?.addEventListener('click', (e) => {
      if (e.target.id === 'bankingPrevPage' && currentPage > 1) { currentPage--; loadTransactions(); renderTable(); renderPagination(); }
      if (e.target.id === 'bankingNextPage' && currentPage < Math.ceil(totalCount / perPage)) { currentPage++; loadTransactions(); renderTable(); renderPagination(); }
    });

    setupImportModal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
