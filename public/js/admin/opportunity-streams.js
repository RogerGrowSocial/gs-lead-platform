(function () {
  const base = window.location.origin

  function webhookUrl(streamId) {
    return base.replace(/\/$/, '') + '/api/ingest/opportunities/' + streamId
  }

  document.querySelectorAll('.copy-webhook-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const streamId = btn.getAttribute('data-stream-id')
      const url = webhookUrl(streamId)
      navigator.clipboard.writeText(url).then(function () {
        alert('Webhook URL gekopieerd naar klembord.')
      }).catch(function () {
        prompt('Kopieer deze URL:', url)
      })
    })
  })

  document.querySelectorAll('.rotate-secret-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const streamId = btn.getAttribute('data-stream-id')
      if (!confirm('Weet je het zeker? Het oude secret werkt daarna niet meer. Je krijgt één keer het nieuwe secret te zien.')) return
      fetch('/api/admin/opportunities/streams/' + streamId + '/rotate-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      })
        .then(function (r) { return r.json() })
        .then(function (data) {
          if (data.success && data.secret) {
            var modal = document.getElementById('secretModal')
            var input = document.getElementById('secretModalValue')
            if (modal && input) {
              input.value = data.secret
              modal.style.display = 'flex'
            } else {
              alert('Nieuw secret (bewaar dit):\n\n' + data.secret)
            }
          } else {
            alert('Fout: ' + (data.error || 'Onbekend'))
          }
        })
        .catch(function (err) {
          console.error(err)
          alert('Fout bij roteren secret')
        })
    })
  })

  document.getElementById('secretModalCopyBtn')?.addEventListener('click', function () {
    var input = document.getElementById('secretModalValue')
    if (!input || !input.value) return
    navigator.clipboard.writeText(input.value).then(function () {
      var btn = document.getElementById('secretModalCopyBtn')
      if (btn) { btn.textContent = ' Gekopieerd!'; btn.disabled = true; setTimeout(function () { btn.innerHTML = '<i class="fas fa-copy"></i> Kopieer'; btn.disabled = false }, 2000) }
    })
  })
  document.getElementById('secretModalCloseBtn')?.addEventListener('click', function () {
    document.getElementById('secretModal').style.display = 'none'
  })
  document.getElementById('secretModal')?.addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none'
  })
})()
