(function () {
  var CONFIG_TEMPLATES = {
    trustoo: {
      mapping: {
        title: 'payload.company_name',
        company_name: 'payload.company_name',
        contact_name: 'payload.contact_name',
        email: 'payload.email',
        phone: 'payload.phone',
        description: 'payload.message'
      },
      defaults: { status: 'open', stage: 'nieuw', priority: 'medium' }
    },
    webhook: {
      mapping: {
        title: 'payload.company_name',
        company_name: 'payload.company_name',
        contact_name: 'payload.contact_name',
        email: 'payload.email',
        phone: 'payload.phone',
        description: 'payload.message'
      },
      defaults: { status: 'open', stage: 'nieuw', priority: 'medium' }
    },
    form: {
      mapping: {
        title: 'payload.company_name',
        company_name: 'payload.company_name',
        contact_name: 'payload.contact_name',
        email: 'payload.email',
        phone: 'payload.phone',
        description: 'payload.message'
      },
      defaults: { status: 'open', stage: 'nieuw', priority: 'medium' }
    }
  }

  function getConfigEl() {
    return document.getElementById('config')
  }

  function payloadFieldFromMapping(value) {
    if (!value || typeof value !== 'string') return ''
    var s = value.replace(/^payload\./, '').trim()
    var first = s.split('.')[0]
    return first || s
  }

  function buildConfigFromSimpleFields() {
    var company = document.getElementById('map_company_name') && document.getElementById('map_company_name').value.trim()
    var contact = document.getElementById('map_contact_name') && document.getElementById('map_contact_name').value.trim()
    var email = document.getElementById('map_email') && document.getElementById('map_email').value.trim()
    var phone = document.getElementById('map_phone') && document.getElementById('map_phone').value.trim()
    var message = document.getElementById('map_message') && document.getElementById('map_message').value.trim()
    var status = document.getElementById('default_status') && document.getElementById('default_status').value
    var priority = document.getElementById('default_priority') && document.getElementById('default_priority').value
    var mapping = {}
    var defaults = { status: status || 'open', stage: 'nieuw', priority: priority || 'medium' }
    if (company) mapping.company_name = 'payload.' + company
    if (company) mapping.title = 'payload.' + company
    if (contact) mapping.contact_name = 'payload.' + contact
    if (email) mapping.email = 'payload.' + email
    if (phone) mapping.phone = 'payload.' + phone
    if (message) mapping.description = 'payload.' + message
    return { mapping: mapping, defaults: defaults }
  }

  function fillSimpleFieldsFromConfig(config) {
    var m = config && config.mapping
    var d = config && config.defaults
    if (!m) return
    var set = function (id, value) {
      var el = document.getElementById(id)
      if (el) el.value = value || ''
    }
    set('map_company_name', payloadFieldFromMapping(m.company_name || m.title))
    set('map_contact_name', payloadFieldFromMapping(m.contact_name))
    set('map_email', payloadFieldFromMapping(m.email))
    set('map_phone', payloadFieldFromMapping(m.phone))
    set('map_message', payloadFieldFromMapping(m.description || m.message))
    if (d) {
      set('default_status', d.status)
      set('default_priority', d.priority)
    }
  }

  function applyTemplate(type) {
    var t = CONFIG_TEMPLATES[type] || CONFIG_TEMPLATES.webhook
    var configEl = getConfigEl()
    if (configEl) configEl.value = JSON.stringify(t, null, 2)
    fillSimpleFieldsFromConfig(t)
  }

  var typeEl = document.getElementById('type')
  if (typeEl) {
    typeEl.addEventListener('change', function () {
      applyTemplate(this.value)
    })
  }

  var moreOptionsBlock = document.getElementById('moreOptionsBlock')
  var toggleMoreBtn = document.getElementById('toggleMoreOptions')
  if (toggleMoreBtn && moreOptionsBlock) {
    toggleMoreBtn.addEventListener('click', function () {
      var isHidden = moreOptionsBlock.style.display === 'none'
      moreOptionsBlock.style.display = isHidden ? 'block' : 'none'
      toggleMoreBtn.innerHTML = isHidden ? '<i class="fas fa-cog"></i> Verberg extra opties' : '<i class="fas fa-cog"></i> Meer opties (veldkoppeling, standaardwaarden, JSON)'
    })
  }

  var advancedBlock = document.getElementById('advancedConfigBlock')
  var toggleBtn = document.getElementById('toggleAdvancedConfig')
  if (toggleBtn && advancedBlock) {
    toggleBtn.addEventListener('click', function () {
      var isHidden = advancedBlock.style.display === 'none'
      advancedBlock.style.display = isHidden ? 'block' : 'none'
      toggleBtn.innerHTML = isHidden ? '<i class="fas fa-code"></i> Verberg JSON' : '<i class="fas fa-code"></i> JSON bewerken'
    })
  }

  var configEl = getConfigEl()
  if (configEl && configEl.value.trim()) {
    try {
      var parsed = JSON.parse(configEl.value)
      fillSimpleFieldsFromConfig(parsed)
    } catch (e) {}
  } else if (typeEl) {
    applyTemplate(typeEl.value)
  }

  var form = document.getElementById('streamForm')
  if (!form) return

  form.addEventListener('submit', function (e) {
    e.preventDefault()
    var name = document.getElementById('name').value.trim()
    var type = document.getElementById('type').value
    var is_active = document.getElementById('is_active').checked
    var config
    if (advancedBlock && advancedBlock.style.display === 'block' && configEl) {
      try {
        config = JSON.parse(configEl.value || '{}')
      } catch (err) {
        alert('Ongeldige JSON in het Geavanceerd-veld. Pas de JSON aan of verberg Geavanceerd om de eenvoudige veldkoppeling te gebruiken.')
        return
      }
    } else {
      config = buildConfigFromSimpleFields()
      if (getConfigEl()) getConfigEl().value = JSON.stringify(config, null, 2)
    }
    var secret = document.getElementById('secret').value
    var streamId = form.getAttribute('data-stream-id')
    var isEdit = !!streamId
    var payload = { name: name, type: type, is_active: is_active, config: config }
    if (secret) payload.secret = secret

    var url = isEdit ? '/api/admin/opportunities/streams/' + streamId : '/api/admin/opportunities/streams'
    var method = isEdit ? 'PUT' : 'POST'
    fetch(url, {
      method: method,
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
        var base = window.location.origin.replace(/\/$/, '')
        var webhookUrl = base + '/api/ingest/opportunities/' + data.id
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
