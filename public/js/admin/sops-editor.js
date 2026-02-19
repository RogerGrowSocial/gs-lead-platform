(function () {
  const base = '/admin/api/sops';
  const categoriesList = document.getElementById('sop-categories-list');
  const sopsList = document.getElementById('sop-sops-list');
  const modalCat = document.getElementById('sop-modal-category');
  const modalSop = document.getElementById('sop-modal-sop');
  const formCat = document.getElementById('sop-form-category');
  const formSop = document.getElementById('sop-form-sop');

  function showModal(modal) {
    if (modal) modal.style.display = 'flex';
  }
  function hideModal(modal) {
    if (modal) modal.style.display = 'none';
  }

  function slugify(text) {
    return (text || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  async function fetchCategories() {
    const res = await fetch(base + '/categories');
    return res.ok ? res.json() : [];
  }
  async function fetchSops() {
    const res = await fetch(base + '/list');
    return res.ok ? res.json() : [];
  }

  function reloadLists() {
    Promise.all([fetchCategories(), fetchSops()]).then(function (arr) {
      var cats = arr[0] || [];
      var sops = arr[1] || [];
      var countByCat = {};
      sops.forEach(function (s) {
        countByCat[s.category_id] = (countByCat[s.category_id] || 0) + 1;
      });
      var catMap = {};
      cats.forEach(function (c) { catMap[c.id] = c.title; });
      if (categoriesList) {
        categoriesList.innerHTML = cats.map(function (c) {
          return '<li class="sops-editor-item" data-id="' + c.id + '">' +
            '<div class="sops-editor-item-main">' +
            '<span class="sops-editor-item-title">' + (c.title || '').replace(/</g, '&lt;') + '</span>' +
            '<span class="sops-editor-item-meta">' + (countByCat[c.id] || 0) + ' handleiding(en)</span>' +
            '</div>' +
            '<div class="sops-editor-item-actions">' +
            '<button type="button" class="sop-edit-category" data-id="' + c.id + '" title="Bewerken">✎</button>' +
            '<button type="button" class="sop-delete-category" data-id="' + c.id + '" title="Verwijderen">×</button>' +
            '</div></li>';
        }).join('');
        bindCategoryButtons();
      }
      if (sopsList) {
        sopsList.innerHTML = sops.map(function (s) {
          var catTitle = catMap[s.category_id] || '-';
          return '<li class="sops-editor-item" data-id="' + s.id + '">' +
            '<div class="sops-editor-item-main">' +
            '<span class="sops-editor-item-title">' + (s.title || '').replace(/</g, '&lt;') + '</span>' +
            '<span class="sops-editor-item-meta">' + catTitle + ' · ' + (s.published ? 'Gepubliceerd' : 'Concept') + '</span>' +
            '</div>' +
            '<div class="sops-editor-item-actions">' +
            '<a href="/admin/sops/' + s.id + '" target="_blank" class="sop-view-sop" title="Bekijken">👁</a>' +
            '<button type="button" class="sop-edit-sop" data-id="' + s.id + '" title="Bewerken">✎</button>' +
            '<button type="button" class="sop-delete-sop" data-id="' + s.id + '" title="Verwijderen">×</button>' +
            '</div></li>';
        }).join('');
        bindSopButtons();
      }
    });
  }

  function bindCategoryButtons() {
    if (!categoriesList) return;
    categoriesList.querySelectorAll('.sop-edit-category').forEach(function (btn) {
      btn.onclick = function () { openEditCategory(btn.getAttribute('data-id')); };
    });
    categoriesList.querySelectorAll('.sop-delete-category').forEach(function (btn) {
      btn.onclick = function () { deleteCategory(btn.getAttribute('data-id')); };
    });
  }
  function bindSopButtons() {
    if (!sopsList) return;
    sopsList.querySelectorAll('.sop-edit-sop').forEach(function (btn) {
      btn.onclick = function () { openEditSop(btn.getAttribute('data-id')); };
    });
    sopsList.querySelectorAll('.sop-delete-sop').forEach(function (btn) {
      btn.onclick = function () { deleteSop(btn.getAttribute('data-id')); };
    });
  }

  function openNewCategory() {
    document.getElementById('sop-modal-category-title').textContent = 'Nieuwe categorie';
    document.getElementById('sop-cat-id').value = '';
    document.getElementById('sop-cat-title').value = '';
    document.getElementById('sop-cat-slug').value = '';
    document.getElementById('sop-cat-description').value = '';
    document.getElementById('sop-cat-image_url').value = '';
    showModal(modalCat);
  }
  function openEditCategory(id) {
    fetch(base + '/categories').then(function (res) { return res.json(); }).then(function (cats) {
      var c = cats.find(function (x) { return x.id === id; });
      if (!c) return;
      document.getElementById('sop-modal-category-title').textContent = 'Categorie bewerken';
      document.getElementById('sop-cat-id').value = c.id;
      document.getElementById('sop-cat-title').value = c.title || '';
      document.getElementById('sop-cat-slug').value = c.slug || '';
      document.getElementById('sop-cat-description').value = c.description || '';
      document.getElementById('sop-cat-image_url').value = c.image_url || '';
      showModal(modalCat);
    });
  }
  function deleteCategory(id) {
    if (!confirm('Categorie verwijderen? Alle handleidingen in deze categorie worden ook verwijderd.')) return;
    fetch(base + '/categories/' + id, { method: 'DELETE' }).then(function (res) {
      if (res.ok) reloadLists();
      else res.json().then(function (d) { alert(d.error || 'Fout'); });
    });
  }

  function openNewSop() {
    fetchCategories().then(function (cats) {
      var sel = document.getElementById('sop-sop-category_id');
      sel.innerHTML = '<option value="">Kies categorie</option>' + (cats || []).map(function (c) {
        return '<option value="' + c.id + '">' + (c.title || '').replace(/</g, '&lt;') + '</option>';
      }).join('');
      document.getElementById('sop-modal-sop-title').textContent = 'Nieuwe handleiding';
      document.getElementById('sop-sop-id').value = '';
      document.getElementById('sop-sop-title').value = '';
      document.getElementById('sop-sop-slug').value = '';
      document.getElementById('sop-sop-excerpt').value = '';
      document.getElementById('sop-sop-content').value = '';
      document.getElementById('sop-sop-illustration_url').value = '';
      document.getElementById('sop-sop-published').checked = true;
      showModal(modalSop);
    });
  }
  function openEditSop(id) {
    fetch(base + '/list').then(function (res) { return res.json(); }).then(function (sops) {
      var s = sops.find(function (x) { return x.id === id; });
      if (!s) return;
      fetchCategories().then(function (cats) {
        var sel = document.getElementById('sop-sop-category_id');
        sel.innerHTML = (cats || []).map(function (c) {
          return '<option value="' + c.id + '"' + (c.id === s.category_id ? ' selected' : '') + '>' + (c.title || '').replace(/</g, '&lt;') + '</option>';
        }).join('');
        document.getElementById('sop-modal-sop-title').textContent = 'Handleiding bewerken';
        document.getElementById('sop-sop-id').value = s.id;
        document.getElementById('sop-sop-title').value = s.title || '';
        document.getElementById('sop-sop-slug').value = s.slug || '';
        document.getElementById('sop-sop-excerpt').value = s.excerpt || '';
        document.getElementById('sop-sop-content').value = s.content || '';
        document.getElementById('sop-sop-illustration_url').value = s.illustration_url || '';
        document.getElementById('sop-sop-published').checked = s.published !== false;
        showModal(modalSop);
      });
    });
  }
  function deleteSop(id) {
    if (!confirm('Handleiding verwijderen?')) return;
    fetch(base + '/' + id, { method: 'DELETE' }).then(function (res) {
      if (res.ok) reloadLists();
      else res.json().then(function (d) { alert(d.error || 'Fout'); });
    });
  }

  if (formCat) {
    formCat.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = document.getElementById('sop-cat-id').value;
      var payload = {
        title: document.getElementById('sop-cat-title').value,
        slug: document.getElementById('sop-cat-slug').value || slugify(document.getElementById('sop-cat-title').value),
        description: document.getElementById('sop-cat-description').value || null,
        image_url: document.getElementById('sop-cat-image_url').value || null
      };
      var url = id ? base + '/categories/' + id : base + '/categories';
      var method = id ? 'PUT' : 'POST';
      fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (res.ok) { hideModal(modalCat); reloadLists(); }
        else res.json().then(function (d) { alert(d.error || 'Fout'); });
      });
    });
  }
  if (formSop) {
    formSop.addEventListener('submit', function (e) {
      e.preventDefault();
      var id = document.getElementById('sop-sop-id').value;
      var payload = {
        category_id: document.getElementById('sop-sop-category_id').value,
        title: document.getElementById('sop-sop-title').value,
        slug: document.getElementById('sop-sop-slug').value || slugify(document.getElementById('sop-sop-title').value),
        excerpt: document.getElementById('sop-sop-excerpt').value || null,
        content: document.getElementById('sop-sop-content').value || '',
        illustration_url: document.getElementById('sop-sop-illustration_url').value || null,
        published: document.getElementById('sop-sop-published').checked
      };
      var url = id ? base + '/' + id : base;
      var method = id ? 'PUT' : 'POST';
      fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (res.ok) { hideModal(modalSop); reloadLists(); }
        else res.json().then(function (d) { alert(d.error || 'Fout'); });
      });
    });
  }

  modalCat.querySelectorAll('.sop-modal-backdrop, .sop-modal-cancel').forEach(function (el) {
    el.addEventListener('click', function () { hideModal(modalCat); });
  });
  modalSop.querySelectorAll('.sop-modal-backdrop, .sop-modal-cancel').forEach(function (el) {
    el.addEventListener('click', function () { hideModal(modalSop); });
  });

  var btnNewCat = document.getElementById('sop-editor-new-category');
  var btnNewSop = document.getElementById('sop-editor-new-sop');
  if (btnNewCat) btnNewCat.addEventListener('click', openNewCategory);
  if (btnNewSop) btnNewSop.addEventListener('click', openNewSop);
})();
