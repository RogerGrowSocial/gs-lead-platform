(function () {
  'use strict';
  const API = '/admin/api/banking';

  function qs(sel) { return document.querySelector(sel); }

  function maskIban(iban) {
    if (!iban || iban.length < 8) return '****';
    return '****' + iban.slice(-4);
  }

  function formatTimeAgo(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const sec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (sec < 60) return 'zojuist';
      if (sec < 3600) return Math.floor(sec / 60) + ' min geleden';
      if (sec < 86400) return Math.floor(sec / 3600) + ' uur geleden';
      return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return ''; }
  }

  function statusLabel(s) {
    const map = { connected: 'Verbonden', action_required: 'Actie vereist', error: 'Fout', disconnected: 'Ontkoppeld' };
    return map[s] || s;
  }

  async function loadConnections() {
    const res = await fetch(API + '/connections', { credentials: 'same-origin' });
    const data = await res.json().catch(function () { return {}; });
    return data.connections || [];
  }

  function render(connections) {
    const wrap = qs('#bankingConnectionsList');
    const loading = qs('#bankingConnectionsLoading');
    const empty = qs('#bankingConnectionsEmpty');
    if (!wrap) return;
    loading.style.display = 'none';
    if (!connections.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    wrap.innerHTML = connections.map(function (c) {
      const lastSync = c.last_synced_at ? formatTimeAgo(c.last_synced_at) : 'Nog niet gesynchroniseerd';
      const statusClass = 'banking-status-' + (c.status || 'disconnected');
      const accounts = (c.accounts || []).map(function (a) {
        return '<span class="banking-conn-account">' + (a.name || 'Rekening') + ' ' + maskIban(a.iban) + '</span>';
      }).join('');
      return (
        '<div class="banking-connection-card" data-connection-id="' + c.id + '">' +
          '<div class="banking-conn-header">' +
            '<span class="banking-conn-provider">' + (c.provider === 'rabobank' ? 'Rabobank' : c.provider) + '</span>' +
            '<span class="banking-status-badge ' + statusClass + '">' + statusLabel(c.status) + '</span>' +
          '</div>' +
          '<p class="banking-conn-sync">Laatst gesynchroniseerd: ' + lastSync + '</p>' +
          (c.last_error ? '<p class="banking-conn-error">' + c.last_error + '</p>' : '') +
          '<div class="banking-conn-accounts">' + accounts + '</div>' +
          '<div class="banking-conn-actions">' +
            '<button type="button" class="banking-btn banking-btn-primary banking-sync-now" data-connection-id="' + c.id + '">Sync nu</button>' +
            '<a href="/admin/payments/banking" class="banking-btn banking-btn-secondary">Naar Bankieren</a>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.banking-sync-now');
    if (!btn || !btn.dataset.connectionId) return;
    const id = btn.dataset.connectionId;
    btn.disabled = true;
    btn.textContent = 'Bezig…';
    fetch(API + '/sync?connection_id=' + encodeURIComponent(id), { method: 'POST', credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (typeof window.showNotification === 'function') {
          window.showNotification((data.newTransactions || 0) + ' nieuwe transacties.', 'success', 3000);
        }
        return loadConnections();
      })
      .then(render)
      .catch(function (err) {
        if (typeof window.showNotification === 'function') window.showNotification(err.message || 'Sync mislukt', 'error', 5000);
      })
      .finally(function () { btn.disabled = false; btn.textContent = 'Sync nu'; });
  });

  loadConnections().then(render);
})();
