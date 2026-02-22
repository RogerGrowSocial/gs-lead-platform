/**
 * AI Kansen Router – settings modal (mirrors AI Lead Router UI).
 * Endpoints: GET/PUT /api/admin/router/opportunities/settings
 */
(function () {
  const MODAL_ID = 'aiKansenRouterSettingsModal';
  const SETTINGS_GET = '/api/admin/router/opportunities/settings';
  const SETTINGS_PUT = '/api/admin/router/opportunities/settings';

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'flex';
      modal.style.visibility = 'visible';
      modal.style.opacity = '1';
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  function setupSlider(id) {
    const slider = document.getElementById(id);
    const valueEl = document.getElementById(id + 'Value');
    const range = document.getElementById(id + 'Range');
    const thumb = document.getElementById(id + 'Thumb');
    if (!slider || !valueEl) return;
    const update = () => {
      const v = parseInt(slider.value, 10);
      valueEl.textContent = v + '%';
      if (range) range.style.right = (100 - v) + '%';
      if (thumb) thumb.style.left = v + '%';
    };
    slider.addEventListener('input', update);
    slider.addEventListener('change', update);
    update();
  }

  function setupSliders() {
    ['kansenRegionWeight', 'kansenPerformanceWeight', 'kansenFairnessWeight'].forEach(setupSlider);
  }

  async function loadSettings() {
    try {
      const res = await fetch(SETTINGS_GET, { credentials: 'include' });
      if (!res.ok) throw new Error('Instellingen laden mislukt');
      const json = await res.json();
      if (!json.success || !json.data) return;
      const d = json.data;
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      const setVal = (id, val) => { const el = document.getElementById(id + 'Value'); if (el) el.textContent = val + '%'; };
      const setRange = (id, val) => {
        const r = document.getElementById(id + 'Range');
        const t = document.getElementById(id + 'Thumb');
        if (r) r.style.right = (100 - val) + '%';
        if (t) t.style.left = val + '%';
      };
      set('kansenRegionWeight', d.regionWeight ?? 40);
      setVal('kansenRegionWeight', d.regionWeight ?? 40);
      setRange('kansenRegionWeight', d.regionWeight ?? 40);
      set('kansenPerformanceWeight', d.performanceWeight ?? 50);
      setVal('kansenPerformanceWeight', d.performanceWeight ?? 50);
      setRange('kansenPerformanceWeight', d.performanceWeight ?? 50);
      set('kansenFairnessWeight', d.fairnessWeight ?? 30);
      setVal('kansenFairnessWeight', d.fairnessWeight ?? 30);
      setRange('kansenFairnessWeight', d.fairnessWeight ?? 30);
      const toggle = document.getElementById('kansenAutoAssignToggle');
      if (toggle) toggle.checked = d.autoAssignEnabled !== false;
      const th = document.getElementById('kansenAutoAssignThreshold');
      if (th) th.value = d.autoAssignThreshold ?? 60;
      const thVal = document.getElementById('kansenAutoAssignThresholdValue');
      if (thVal) thVal.textContent = d.autoAssignThreshold ?? 60;
      setupSliders();
    } catch (e) {
      console.error('Load Kansen settings:', e);
    }
  }

  async function saveSettings() {
    const regionWeight = parseInt(document.getElementById('kansenRegionWeight')?.value || '40', 10);
    const performanceWeight = parseInt(document.getElementById('kansenPerformanceWeight')?.value || '50', 10);
    const fairnessWeight = parseInt(document.getElementById('kansenFairnessWeight')?.value || '30', 10);
    const autoAssignEnabled = document.getElementById('kansenAutoAssignToggle')?.checked !== false;
    const autoAssignThreshold = parseInt(document.getElementById('kansenAutoAssignThreshold')?.value || '60', 10);
    try {
      const res = await fetch(SETTINGS_PUT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          regionWeight,
          performanceWeight,
          fairnessWeight,
          autoAssignEnabled,
          autoAssignThreshold
        })
      });
      const json = await res.json();
      if (json.success) {
        if (typeof window.showNotification === 'function') {
          window.showNotification('Instellingen opgeslagen', 'success');
        } else {
          alert('Instellingen opgeslagen');
        }
        closeModal(MODAL_ID);
      } else {
        throw new Error(json.error || 'Opslaan mislukt');
      }
    } catch (e) {
      console.error('Save Kansen settings:', e);
      if (typeof window.showNotification === 'function') {
        window.showNotification('Fout bij opslaan: ' + e.message, 'error');
      } else {
        alert('Fout bij opslaan: ' + e.message);
      }
    }
  }

  function init() {
    const btn = document.getElementById('aiKansenRouterSettingsBtn');
    if (btn && !btn.dataset.inited) {
      btn.dataset.inited = '1';
      btn.addEventListener('click', () => {
        openModal(MODAL_ID);
        setupSliders();
        loadSettings();
      });
    }
    const closeBtn = document.querySelector(`#${MODAL_ID} .ai-router-modal-close`);
    if (closeBtn) {
      closeBtn.addEventListener('click', () => closeModal(MODAL_ID));
    }
    const saveBtn = document.getElementById('kansenRouterSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveSettings);
    }
    const cancelBtn = document.querySelector(`#${MODAL_ID} .ai-router-modal-cancel`);
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => closeModal(MODAL_ID));
    }
    document.addEventListener('click', (e) => {
      if (e.target.id === MODAL_ID) closeModal(MODAL_ID);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
