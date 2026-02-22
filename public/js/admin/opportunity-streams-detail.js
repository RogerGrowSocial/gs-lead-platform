(function () {
  const streamId = document.querySelector('[data-stream-id]')?.getAttribute('data-stream-id') ||
    (function () {
      const m = window.location.pathname.match(/\/admin\/opportunities\/streams\/([a-f0-9-]+)/)
      return m ? m[1] : null
    })()
  if (!streamId) return

  const base = window.location.origin.replace(/\/$/, '')
  const webhookUrl = base + '/api/ingest/opportunities/' + streamId

  document.getElementById('copyWebhookUrlBtn')?.addEventListener('click', function () {
    navigator.clipboard.writeText(webhookUrl).then(function () {
      document.getElementById('rotateMessage').textContent = 'Gekopieerd.'
      setTimeout(function () { document.getElementById('rotateMessage').textContent = '' }, 2000)
    })
  })

  document.getElementById('rotateSecretBtn')?.addEventListener('click', function () {
    if (!confirm('Nieuw secret genereren? Het oude secret werkt daarna niet meer. Je krijgt één keer het nieuwe secret te zien.')) return
    fetch('/api/admin/opportunities/streams/' + streamId + '/rotate-secret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    })
      .then(function (r) { return r.json() })
      .then(function (data) {
        if (data.success && data.secret) {
          document.getElementById('rotateMessage').textContent = 'Nieuw secret: ' + data.secret + ' (bewaar dit)'
        } else {
          document.getElementById('rotateMessage').textContent = 'Fout: ' + (data.error || 'Onbekend')
        }
      })
      .catch(function () {
        document.getElementById('rotateMessage').textContent = 'Fout bij roteren'
      })
  })

  let currentStatus = ''
  function loadEvents(offset) {
    const tbody = document.getElementById('eventsTableBody')
    if (!tbody) return
    tbody.innerHTML = '<div class="admins-row"><div class="admins-cell">Laden…</div></div>'
    const limit = 20
    const url = '/api/admin/opportunities/streams/' + streamId + '/events?limit=' + limit + '&offset=' + (offset || 0) + (currentStatus ? '&status=' + currentStatus : '')
    fetch(url, { credentials: 'same-origin' })
      .then(function (r) { return r.json() })
      .then(function (data) {
        const events = data.events || []
        if (events.length === 0) {
          tbody.innerHTML = '<div class="admins-row"><div class="admins-cell">Geen events</div></div>'
          return
        }
        tbody.innerHTML = events.map(function (ev) {
          const received = ev.received_at ? new Date(ev.received_at).toLocaleString('nl-NL') : '—'
          const statusClass = ev.status === 'success' ? 'active' : 'expired'
          const oppLink = ev.created_opportunity_id
            ? '<a href="/admin/opportunities/' + ev.created_opportunity_id + '">' + ev.created_opportunity_id.slice(0, 8) + '…</a>'
            : '—'
          const err = ev.error_message ? ('<button type="button" class="btn-link view-payload-btn" data-payload="' + escapeAttr(JSON.stringify(ev.error_message)) + '">Bekijk</button>') : '—'
          const payloadBtn = ev.payload_raw
            ? '<button type="button" class="btn-link view-payload-btn" data-payload="' + escapeAttr(JSON.stringify(ev.payload_raw)) + '">Payload</button>'
            : '—'
          return '<div class="admins-row">' +
            '<div class="admins-cell">' + received + '</div>' +
            '<div class="admins-cell"><span class="status-badge ' + statusClass + '">' + ev.status + '</span></div>' +
            '<div class="admins-cell">' + (ev.http_status ?? '—') + '</div>' +
            '<div class="admins-cell">' + (ev.idempotency_key ? ev.idempotency_key.slice(0, 12) + '…' : '—') + '</div>' +
            '<div class="admins-cell">' + oppLink + '</div>' +
            '<div class="admins-cell">' + err + '</div>' +
            '<div class="admins-cell actions-cell">' + payloadBtn + '</div>' +
            '</div>'
        }).join('')
        tbody.querySelectorAll('.view-payload-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            let pl
            try { pl = JSON.parse(btn.getAttribute('data-payload')) } catch (_) { pl = btn.getAttribute('data-payload') }
            document.getElementById('payloadModalContent').textContent = typeof pl === 'string' ? pl : JSON.stringify(pl, null, 2)
            document.getElementById('payloadModal').style.display = 'flex'
          })
        })
      })
      .catch(function () {
        tbody.innerHTML = '<div class="admins-row"><div class="admins-cell">Fout bij laden</div></div>'
      })
  }
  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  document.querySelectorAll('.event-filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.event-filter-btn').forEach(function (b) { b.classList.remove('active') })
      btn.classList.add('active')
      currentStatus = btn.getAttribute('data-status') || ''
      loadEvents(0)
    })
  })

  document.getElementById('sendTestEventBtn')?.addEventListener('click', function () {
    var btn = this
    btn.disabled = true
    fetch('/api/admin/opportunities/streams/' + streamId + '/test-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ payload: { idempotency_key: 'test-' + Date.now(), email: 'test@example.com', company_name: 'Test Bedrijf', message: 'Test' } })
    })
      .then(function (r) { return r.json() })
      .then(function (data) {
        if (data.success) {
          loadEvents(0)
        }
        alert(data.success ? 'Test event verstuurd. Kans-ID: ' + (data.opportunity_id || 'duplicate') : 'Fout: ' + (data.error || 'Onbekend'))
      })
      .catch(function () { alert('Fout bij versturen'); })
      .finally(function () { btn.disabled = false })
  })

  document.getElementById('webhookUrlDisplay')?.setAttribute('value', webhookUrl)
  loadEvents(0)
})()
