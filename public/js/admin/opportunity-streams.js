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
      const streamName = btn.getAttribute('data-stream-name') || 'Deze stroom'
      if (!confirm('Weet je het zeker? Het oude secret werkt daarna niet meer. Je krijgt één keer het nieuwe secret te zien.')) return
      fetch('/api/admin/opportunities/streams/' + streamId + '/rotate-secret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      })
        .then(function (r) { return r.json() })
        .then(function (data) {
          if (data.success && data.secret) {
            alert('Nieuw secret (bewaar dit; wordt niet opnieuw getoond):\n\n' + data.secret)
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
})()
