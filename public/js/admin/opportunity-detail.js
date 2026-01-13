// Auto-save functionality for editable fields
function setupEditableFields() {
  const editableFields = document.querySelectorAll('.editable-field');
  const saveTimeouts = {};

  editableFields.forEach(field => {
    field.addEventListener('focus', function() {
      this.style.borderColor = '#ea5d0d';
      this.style.background = '#fff7ed';
    });

    field.addEventListener('blur', function() {
      this.style.borderColor = '#e5e7eb';
      this.style.background = 'transparent';
    });

    field.addEventListener('input', function() {
      const fieldName = this.dataset.field;
      const oppId = this.dataset.oppId;

      if (!fieldName || !oppId) return;

      if (saveTimeouts[fieldName]) {
        clearTimeout(saveTimeouts[fieldName]);
      }

      this.style.borderColor = '#3b82f6';
      this.style.background = '#eff6ff';

      saveTimeouts[fieldName] = setTimeout(async () => {
        try {
          const rawValue = this.value;
          const value = this.type === 'number' ? parseFloat(rawValue) || 0 : rawValue;

          const response = await fetch(`/admin/opportunities/${oppId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [fieldName]: value })
          });

          const data = await response.json();

          if (data.success) {
            this.style.borderColor = '#10b981';
            this.style.background = '#d1fae5';
            setTimeout(() => {
              this.style.borderColor = '#e5e7eb';
              this.style.background = 'transparent';
            }, 1000);
          } else {
            throw new Error(data.error || 'Fout bij opslaan');
          }
        } catch (error) {
          console.error('Error saving field:', error);
          this.style.borderColor = '#ef4444';
          this.style.background = '#fee2e2';
          setTimeout(() => {
            this.style.borderColor = '#e5e7eb';
            this.style.background = 'transparent';
          }, 2000);
        }
      }, 800);
    });

    if (field.tagName === 'SELECT') {
      field.addEventListener('change', function() {
        const fieldName = this.dataset.field;
        const oppId = this.dataset.oppId;
        if (!fieldName || !oppId) return;

        this.style.borderColor = '#3b82f6';
        this.style.background = '#eff6ff';

        (async () => {
          try {
            const value = this.value === '' ? null : this.value;
            const response = await fetch(`/admin/opportunities/${oppId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ [fieldName]: value })
            });

            const data = await response.json();

            if (data.success) {
              this.style.borderColor = '#10b981';
              this.style.background = '#d1fae5';
              setTimeout(() => {
                this.style.borderColor = '#e5e7eb';
                this.style.background = '#ffffff';
              }, 1000);

              if (fieldName === 'assigned_to') {
                setTimeout(() => window.location.reload(), 1500);
              }
            } else {
              throw new Error(data.error || 'Fout bij opslaan');
            }
          } catch (error) {
            console.error('Error saving field:', error);
            this.style.borderColor = '#ef4444';
            this.style.background = '#fee2e2';
            setTimeout(() => {
              this.style.borderColor = '#e5e7eb';
              this.style.background = '#ffffff';
            }, 2000);
          }
        })();
      });
    }
  });
}

function setupTabs() {
  const buttons = Array.from(document.querySelectorAll('.tab-button'));
  const contents = Array.from(document.querySelectorAll('.tab-content'));

  if (!buttons.length || !contents.length) return;

  const activateTab = (name) => {
    buttons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === name));
    contents.forEach(content => content.classList.toggle('active', content.dataset.tabContent === name));
  };

  buttons.forEach(button => {
    button.addEventListener('click', () => activateTab(button.dataset.tab));
  });

  activateTab((buttons.find(btn => btn.classList.contains('active')) || buttons[0]).dataset.tab);
}

document.addEventListener('DOMContentLoaded', () => {
  setupEditableFields();
  setupTabs();
});

function editOpportunity() {
  const overviewTab = document.querySelector('.tab-button[data-tab="overview"]');
  if (overviewTab && !overviewTab.classList.contains('active')) {
    overviewTab.click();
  }

  const firstField = document.querySelector('.editable-field');
  if (firstField) {
    firstField.focus();
  }
}

// Create and show delete confirmation modal
function showDeleteConfirmModal(oppId, companyName) {
  const modal = document.createElement('div');
  modal.className = 'modal delete-confirm-modal';
  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="modal-content modal-sm">
      <div class="modal-header">
        <h3>Kans Verwijderen</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="delete-warning">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Weet je zeker dat je de kans "<strong>${companyName || 'deze kans'}</strong>" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.</p>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelDelete">Annuleren</button>
          <button type="button" class="btn btn-danger" id="confirmDelete">Verwijderen</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listeners
  modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
  });

  modal.querySelector('#cancelDelete').addEventListener('click', () => {
    modal.remove();
  });

  modal.querySelector('#confirmDelete').addEventListener('click', async () => {
    await deleteOpportunity(oppId);
    modal.remove();
  });

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

async function deleteOpportunity(oppId) {
  try {
    const response = await fetch(`/admin/opportunities/${oppId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (data.success) {
      if (typeof showNotification === 'function') {
        showNotification('Kans succesvol verwijderd', 'success');
      }
      setTimeout(() => {
        window.location.href = '/admin/opportunities';
      }, 1000);
    } else {
      throw new Error(data.error || 'Fout bij verwijderen');
    }
  } catch (error) {
    console.error('Error deleting opportunity:', error);
    if (typeof showNotification === 'function') {
      showNotification(error.message || 'Fout bij verwijderen van kans', 'error');
    } else {
      alert('Fout bij verwijderen: ' + error.message);
    }
  }
}

async function assignToSuggested(oppId, repId, evt) {
  const btn = evt ? evt.target : event.target;
  const originalText = btn.textContent;

  btn.disabled = true;
  btn.textContent = 'Bezig...';
  btn.style.opacity = '0.6';
  btn.style.cursor = 'not-allowed';

  try {
    const response = await fetch(`/admin/opportunities/${oppId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rep_id: repId })
    });

    const data = await response.json();

    if (data.success) {
      btn.textContent = 'Toegewezen!';
      btn.style.background = '#10b981';
      setTimeout(() => window.location.reload(), 1000);
    } else {
      throw new Error(data.error || 'Fout bij toewijzen');
    }
  } catch (error) {
    console.error('Error assigning:', error);
    btn.textContent = 'Fout';
    btn.style.background = '#ef4444';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = originalText;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.background = '#2563eb';
    }, 2000);
  }
}

