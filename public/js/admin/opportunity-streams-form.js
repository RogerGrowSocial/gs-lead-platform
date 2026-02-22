(function () {
  const form = document.getElementById('streamForm')
  if (!form) return

  form.addEventListener('submit', function (e) {
    e.preventDefault()
    const name = document.getElementById('name').value.trim()
    const type = document.getElementById('type').value
    const is_active = document.getElementById('is_active').checked
    let config = {}
    try {
      config = JSON.parse(document.getElementById('config').value || '{}')
    } catch (err) {
      alert('Ongeldige JSON in config.')
      return
    }
    const secret = document.getElementById('secret').value
    const streamId = form.getAttribute('data-stream-id')
    const isEdit = !!streamId
    const payload = { name, type, is_active, config }
    if (secret) payload.secret = secret

    const url = isEdit ? '/api/admin/opportunities/streams/' + streamId : '/api/admin/opportunities/streams'
    const method = isEdit ? 'PUT' : 'POST'
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || r.statusText) })
        return r.json()
      })
      .then(function (data) {
        if (isEdit) {
          alert('Opgeslagen.')
          window.location.href = '/admin/opportunities/streams/' + data.id
          return
        }
        document.getElementById('afterCreateBlock').style.display = 'block'
        form.style.display = 'none'
        const base = window.location.origin.replace(/\/$/, '')
        const webhookUrl = base + '/api/ingest/opportunities/' + data.id
        document.getElementById('webhookUrlDisplay').value = webhookUrl
        if (data.secret) {
          document.getElementById('secretDisplay').value = data.secret
          document.getElementById('secretDisplay').parentElement.style.display = 'flex'
        } else {
          document.getElementById('secretDisplay').parentElement.style.display = 'none'
        }
      })
      .catch(function (err) {
        alert('Fout: ' + (err.message || err))
      })
  })
})()
