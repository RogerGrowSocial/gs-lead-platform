/**
 * Platform Settings — RBAC tab: role switch, search, save, reset, preview
 */
(function () {
  const el = (id) => document.getElementById(id)
  const dataEl = el('rbacMatrixData')
  const currentRoleEl = el('rbacCurrentRole')
  const searchEl = el('rbacSearch')
  const tablesEl = el('rbacTables')
  const previewListEl = el('rbacPreviewList')
  const saveBtn = el('rbacSave')
  const resetBtn = el('rbacReset')
  const toastEl = el('rbacToast')

  if (!dataEl || !tablesEl) return

  let matrix = {}
  try {
    matrix = JSON.parse(dataEl.textContent || '{}')
  } catch (e) {
    console.error('RBAC: invalid matrix JSON', e)
    return
  }

  const roles = matrix.roles || []
  function getBySection () { return matrix.bySection || {} }

  function getCurrentRole () {
    return (currentRoleEl && currentRoleEl.value) || 'admin'
  }

  function setCurrentRole (roleKey) {
    if (currentRoleEl) currentRoleEl.value = roleKey
    document.querySelectorAll('.rbac-role-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.getAttribute('data-role') === roleKey)
    })
  }

  function getRoleData (pageKey, roleKey) {
    var bySection = getBySection()
    for (var i = 0; i < (matrix.sections || []).length; i++) {
      var section = matrix.sections[i]
      const pages = bySection[section] || []
      const p = pages.find((x) => x.page_key === pageKey)
      if (p && p.roles && p.roles[roleKey]) return p.roles[roleKey]
      if (p) {
        return {
          can_access: (p.default_access_roles || []).includes(roleKey),
          in_sidebar: (p.default_sidebar_roles || []).includes(roleKey),
          sidebar_order: p.default_sidebar_order ?? 1000
        }
      }
    }
    return { can_access: false, in_sidebar: false, sidebar_order: 1000 }
  }

  function updateTableForRole (roleKey) {
    tablesEl.querySelectorAll('.rbac-row').forEach((row) => {
      const pageKey = row.getAttribute('data-page-key')
      const r = getRoleData(pageKey, roleKey)
      const accessCb = row.querySelector('.rbac-can-access')
      const sidebarCb = row.querySelector('.rbac-in-sidebar')
      const orderInput = row.querySelector('.rbac-order-input')
      if (accessCb) {
        accessCb.checked = r.can_access
        sidebarCb.checked = r.in_sidebar
        sidebarCb.disabled = !r.can_access
      }
      if (orderInput) {
        orderInput.value = r.sidebar_order
        orderInput.disabled = !r.can_access
      }
    })
    updatePreview(roleKey)
  }

  function updatePreview (roleKey) {
    if (!previewListEl) return
    const items = []
    var bySection = getBySection()
    for (var i = 0; i < (matrix.sections || []).length; i++) {
      var section = matrix.sections[i]
      const pages = (bySection[section] || []).filter((p) => {
        const r = getRoleData(p.page_key, roleKey)
        return r.can_access && r.in_sidebar
      })
      pages.sort((a, b) => (getRoleData(a.page_key, roleKey).sidebar_order || 0) - (getRoleData(b.page_key, roleKey).sidebar_order || 0))
      pages.forEach((p) => items.push({ label: p.label, path: p.path }))
    }
    if (items.length === 0) {
      previewListEl.innerHTML = '<p class="rbac-preview-empty">Geen sidebar-items voor deze rol.</p>'
    } else {
      previewListEl.innerHTML = items.map((i) => '<a href="' + i.path + '">' + escapeHtml(i.label) + '</a>').join('')
    }
  }

  function escapeHtml (s) {
    const div = document.createElement('div')
    div.textContent = s
    return div.innerHTML
  }

  function showToast (message, type) {
    if (!toastEl) return
    toastEl.textContent = message
    toastEl.className = 'rbac-toast show ' + (type || 'success')
    clearTimeout(toastEl._t)
    toastEl._t = setTimeout(function () {
      toastEl.classList.remove('show')
    }, 3500)
  }

  function collectChanges () {
    const roleKey = getCurrentRole()
    const updates = []
    tablesEl.querySelectorAll('.rbac-row').forEach((row) => {
      const pageKey = row.getAttribute('data-page-key')
      const current = getRoleData(pageKey, roleKey)
      const accessCb = row.querySelector('.rbac-can-access')
      const sidebarCb = row.querySelector('.rbac-in-sidebar')
      const orderInput = row.querySelector('.rbac-order-input')
      const can_access = accessCb ? accessCb.checked : current.can_access
      const in_sidebar = sidebarCb && can_access ? sidebarCb.checked : false
      const sidebar_order = orderInput ? parseInt(orderInput.value, 10) || 0 : current.sidebar_order
      if (current.can_access !== can_access || current.in_sidebar !== in_sidebar || current.sidebar_order !== sidebar_order) {
        updates.push({ page_key: pageKey, can_access: can_access, in_sidebar: in_sidebar, sidebar_order: sidebar_order })
      }
    })
    return updates
  }

  document.querySelectorAll('.rbac-role-tab').forEach((tab) => {
    tab.addEventListener('click', function () {
      const roleKey = tab.getAttribute('data-role')
      setCurrentRole(roleKey)
      updateTableForRole(roleKey)
    })
  })

  if (searchEl) {
    searchEl.addEventListener('input', function () {
      const q = (searchEl.value || '').toLowerCase().trim()
      tablesEl.querySelectorAll('.rbac-row').forEach((row) => {
        const label = (row.getAttribute('data-label') || '')
        const path = (row.getAttribute('data-path') || '')
        const match = !q || label.indexOf(q) !== -1 || path.indexOf(q) !== -1
        row.classList.toggle('hidden-by-search', !match)
      })
    })
  }

  tablesEl.querySelectorAll('.rbac-can-access').forEach((cb) => {
    cb.addEventListener('change', function () {
      const row = this.closest('.rbac-row')
      const sidebarCb = row.querySelector('.rbac-in-sidebar')
      const orderInput = row.querySelector('.rbac-order-input')
      const disabled = !this.checked
      if (sidebarCb) {
        sidebarCb.disabled = disabled
        if (disabled) sidebarCb.checked = false
      }
      if (orderInput) orderInput.disabled = disabled
      updatePreview(getCurrentRole())
    })
  })

  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      const roleKey = getCurrentRole()
      const updates = collectChanges()
      if (updates.length === 0) {
        showToast('Geen wijzigingen om op te slaan.', 'success')
        return
      }
      saveBtn.disabled = true
      fetch('/api/admin/platform-settings/rbac/' + roleKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        body: JSON.stringify({ updates: updates })
      })
        .then(function (res) { return res.json().then(function (data) { return { res: res, data: data } }) })
        .then(function (_) {
          var res = _.res
          var data = _.data
          if (res.ok && data.success) {
            showToast('Opgeslagen.')
            return fetch('/api/admin/platform-settings/rbac', { credentials: 'same-origin' })
              .then(function (r) { return r.json() })
              .then(function (fresh) {
            if (fresh.success && fresh.data) {
              matrix = fresh.data
              updateTableForRole(roleKey)
            }
              })
          } else {
            showToast(data.error || 'Opslaan mislukt', 'error')
          }
        })
        .catch(function (err) {
          showToast('Fout: ' + (err.message || 'netwerk'), 'error')
        })
        .finally(function () {
          saveBtn.disabled = false
        })
    })
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      const roleKey = getCurrentRole()
      if (!confirm('Rechten voor deze rol terugzetten naar standaard?')) return
      resetBtn.disabled = true
      fetch('/api/admin/platform-settings/rbac/' + roleKey + '/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin'
      })
        .then(function (res) { return res.json() })
        .then(function (data) {
          if (data.success) {
            showToast('Teruggezet naar standaard.')
            window.location.reload()
          } else {
            showToast(data.error || 'Reset mislukt', 'error')
          }
        })
        .catch(function (err) {
          showToast('Fout: ' + (err.message || 'netwerk'), 'error')
        })
        .finally(function () {
          resetBtn.disabled = false
        })
    })
  }

  updatePreview(getCurrentRole())
})()
