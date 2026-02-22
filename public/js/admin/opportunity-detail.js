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

function getOpportunityId() {
  const el = document.querySelector('[data-opportunity-id]');
  return el ? el.getAttribute('data-opportunity-id') : null;
}

async function fetchRoutingDecisions(opportunityId) {
  const res = await fetch(`/api/admin/opportunities/${opportunityId}/routing-decisions`, { credentials: 'include' });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.success && json.data) ? json.data : [];
}

function formatRouterDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderRouterSummary(decisions) {
  const container = document.getElementById('aiRouterSummaryContent');
  if (!container) return;
  if (!decisions.length) {
    container.innerHTML = '<p class="text-muted" style="margin: 0;">Nog geen routerbeslissingen voor deze kans.</p>';
    return;
  }
  const last = decisions[0];
  const confidencePct = last.confidence != null ? Math.round(Number(last.confidence) * 100) : null;
  const assignee = last.output_snapshot && last.output_snapshot.assignee_name ? last.output_snapshot.assignee_name : (last.applied_assignee_user_id ? 'Toegewezen' : '-');
  container.innerHTML = `
    <p style="margin: 0 0 4px 0;"><strong>Laatste:</strong> ${last.decision_summary || '-'}</p>
    <p style="margin: 0 0 4px 0;">Toegewezen aan: ${assignee}</p>
    ${confidencePct != null ? `<p style="margin: 0;"><span class="opportunity-badge opportunity-badge--match">${confidencePct}%</span></p>` : ''}
    <p class="text-muted" style="margin: 4px 0 0 0; font-size: 12px;">${formatRouterDate(last.created_at)}</p>
  `;
}

function openRouterDrawer(decisions, selectedDecision) {
  const drawer = document.getElementById('opportunityRouterDrawer');
  if (!drawer) return;
  const decision = selectedDecision || (decisions && decisions[0]) || null;
  if (decision) {
    document.getElementById('routerDrawerSubtitle').textContent = decision.decision_summary || 'Toewijzing';
    document.getElementById('routerDrawerSummary').textContent = decision.decision_summary || '-';
    const conf = decision.confidence != null ? Math.round(Number(decision.confidence) * 100) : null;
    document.getElementById('routerDrawerConfidence').textContent = conf != null ? conf + '%' : '-';
    document.getElementById('routerDrawerExplanation').textContent = decision.explanation || '-';
    document.getElementById('routerDrawerInputJson').textContent = JSON.stringify(decision.input_snapshot || {}, null, 2);
    document.getElementById('routerDrawerOutputJson').textContent = JSON.stringify(decision.output_snapshot || {}, null, 2);
    const timelineEl = document.getElementById('routerDrawerTimeline');
    timelineEl.innerHTML = (decisions || []).map(d => `
      <div class="router-timeline-item">
        <div class="router-timeline-dot"></div>
        <div class="router-timeline-content">
          <p class="router-timeline-summary">${d.decision_summary || '-'}</p>
          <p class="router-timeline-meta">${formatRouterDate(d.created_at)} ${d.is_manual_override ? '(handmatig)' : ''}</p>
        </div>
      </div>
    `).join('') || '<p class="text-muted">Geen beslissingen.</p>';
  }
  drawer.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeRouterDrawer() {
  const drawer = document.getElementById('opportunityRouterDrawer');
  if (drawer) {
    drawer.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function setupRouterDrawer() {
  const oppId = getOpportunityId();
  if (!oppId) return;
  let decisionsCache = [];
  fetchRoutingDecisions(oppId).then(decisions => {
    decisionsCache = decisions;
    renderRouterSummary(decisions);
  });
  const openBtn = document.getElementById('openOpportunityRouterDrawerBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      if (decisionsCache.length) openRouterDrawer(decisionsCache);
      else fetchRoutingDecisions(oppId).then(ds => { decisionsCache = ds; openRouterDrawer(ds); });
    });
  }
  const closeBtn = document.getElementById('closeOpportunityRouterDrawer');
  if (closeBtn) closeBtn.addEventListener('click', closeRouterDrawer);
  const overlay = document.getElementById('opportunityRouterDrawer');
  if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) closeRouterDrawer(); });
  if (typeof URLSearchParams !== 'undefined' && window.location.search.indexOf('open=router') !== -1) {
    fetchRoutingDecisions(oppId).then(ds => {
      decisionsCache = ds;
      openRouterDrawer(ds);
    });
  }
}

function setupSalesStatusPanel() {
  const select = document.getElementById('sales-status-select');
  const reasonWrap = document.getElementById('sales-outcome-reason-wrap');
  const reasonInput = document.getElementById('sales-outcome-reason');
  const saveBtn = document.getElementById('sales-status-save-btn');
  const attemptBtn = document.getElementById('contact-attempt-btn');

  if (select) {
    select.addEventListener('change', () => {
      if (reasonWrap) reasonWrap.style.display = select.value === 'lost' ? 'block' : 'none';
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const oppId = saveBtn.dataset.oppId;
      if (!oppId) return;
      const status = document.getElementById('sales-status-select')?.value;
      const reason = document.getElementById('sales-outcome-reason')?.value?.trim();
      if (status === 'lost' && !reason) {
        alert('Vul een reden in bij status Verloren.');
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = 'Opslaan...';
      try {
        const res = await fetch(`/api/admin/opportunities/${oppId}/sales-status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sales_status: status, sales_outcome_reason: status === 'lost' ? reason : null })
        });
        const data = await res.json();
        if (data.success) {
          saveBtn.textContent = 'Opgeslagen';
          setTimeout(() => { saveBtn.textContent = 'Opslaan'; saveBtn.disabled = false; }, 1500);
          if (document.getElementById('opportunity-stale-banner')) document.getElementById('opportunity-stale-banner').remove();
        } else throw new Error(data.error || 'Fout bij opslaan');
      } catch (e) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Opslaan';
        alert(e.message || 'Fout bij opslaan');
      }
    });
  }

  if (attemptBtn) {
    attemptBtn.addEventListener('click', async () => {
      const oppId = attemptBtn.dataset.oppId;
      if (!oppId) return;
      attemptBtn.disabled = true;
      try {
        const res = await fetch(`/api/admin/opportunities/${oppId}/contact-attempt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        const data = await res.json();
        if (data.success) window.location.reload();
        else throw new Error(data.error || 'Fout');
      } catch (e) {
        attemptBtn.disabled = false;
        alert(e.message || 'Fout bij bijwerken');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupEditableFields();
  setupTabs();
  setupRouterDrawer();
  setupSalesStatusPanel();
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

