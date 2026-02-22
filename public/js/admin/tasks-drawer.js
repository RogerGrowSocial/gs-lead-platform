// Tasks Drawer - Right drawer modal for creating a new task
(function () {
  'use strict';

  // Prevent double-init
  if (window.__gsTasksDrawerInit) return;
  window.__gsTasksDrawerInit = true;

  const DRAWER_ID = 'taskDrawer';
  const OVERLAY_ID = 'taskDrawerOverlay';

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function setOpen(isOpen) {
    const drawer = qs(`#${DRAWER_ID}`);
    const overlay = qs(`#${OVERLAY_ID}`);
    if (!drawer || !overlay) return;

    drawer.classList.toggle('is-open', isOpen);
    overlay.classList.toggle('is-open', isOpen);
    document.documentElement.classList.toggle('drawer-open', isOpen);
    document.body.classList.toggle('drawer-open', isOpen);

    // Inline-style fallback
    drawer.style.transform = isOpen ? 'translateX(0)' : 'translateX(110%)';
    overlay.style.opacity = isOpen ? '1' : '0';
    overlay.style.pointerEvents = isOpen ? 'auto' : 'none';

    drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }

  let aiSuggestion = null;
  let aiSuggestionTimeout = null;

  function resetForm() {
    const form = qs('#taskCreateForm');
    if (!form) return;
    form.reset();
    const submit = qs('#taskCreateSubmit');
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Taak aanmaken';
    }
    const err = qs('#taskCreateError');
    if (err) {
      err.textContent = '';
      err.style.display = 'none';
    }
    // Reset AI suggestion
    aiSuggestion = null;
    hideAiSuggestion();
  }

  function hideAiSuggestion() {
    const aiSection = qs('#taskAiSuggestion');
    if (aiSection) {
      aiSection.style.display = 'none';
    }
    const loading = qs('#taskAiLoading');
    const primary = qs('#taskAiSuggestionPrimary');
    if (loading) loading.style.display = 'none';
    if (primary) primary.style.display = 'none';
  }

  function showAiLoading() {
    const aiSection = qs('#taskAiSuggestion');
    const loading = qs('#taskAiLoading');
    const primary = qs('#taskAiSuggestionPrimary');
    if (!aiSection || !loading || !primary) return;
    
    aiSection.style.display = 'block';
    loading.style.display = 'flex';
    primary.style.display = 'none';
  }

  function showAiSuggestion(suggestion) {
    const aiSection = qs('#taskAiSuggestion');
    const loading = qs('#taskAiLoading');
    const primary = qs('#taskAiSuggestionPrimary');
    const employeeName = qs('#taskAiEmployeeName');
    const matchBadge = qs('#taskAiMatchBadge');
    const reason = qs('#taskAiReason');
    
    if (!aiSection || !loading || !primary || !employeeName || !matchBadge || !reason) return;
    
    aiSuggestion = suggestion;
    aiSection.style.display = 'block';
    loading.style.display = 'none';
    primary.style.display = 'block';
    
    employeeName.textContent = suggestion.employee_name;
    matchBadge.textContent = `${suggestion.match_percentage}% match`;
    reason.textContent = suggestion.reason;
  }

  async function fetchAiSuggestion(title, description, customer_id, priority) {
    if (!title || title.trim().length < 3) {
      hideAiSuggestion();
      return;
    }

    showAiLoading();

    try {
      const response = await fetch('/api/tasks/ai-suggest-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description || '',
          customer_id: customer_id || null,
          priority: priority || 'medium'
        })
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Fout bij ophalen AI suggestie');
      }

      if (result.data && result.data.suggestion) {
        showAiSuggestion(result.data.suggestion);
      } else {
        hideAiSuggestion();
      }
    } catch (error) {
      console.error('Error fetching AI suggestion:', error);
      hideAiSuggestion();
    }
  }

  function onAiApprove() {
    if (!aiSuggestion) return;
    
    const employeeSelect = qs('#taskEmployee');
    if (employeeSelect && employeeSelect.tagName === 'SELECT') {
      employeeSelect.value = aiSuggestion.employee_id;
      // Trigger change event to ensure form recognizes the change
      employeeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    if (window.showNotification) {
      window.showNotification(`Taak wordt toegewezen aan ${aiSuggestion.employee_name}`, 'success');
    }
    
    hideAiSuggestion();
  }

  function onAiDismiss() {
    hideAiSuggestion();
  }

  let drawerDataLoaded = false;

  async function ensureDrawerData() {
    const empSel = qs('#taskEmployee');
    if (drawerDataLoaded || (empSel && empSel.tagName === 'SELECT' && empSel.options.length > 1)) {
      drawerDataLoaded = true;
      return;
    }
    try {
      const r = await fetch('/admin/api/tasks/drawer-data', { credentials: 'include' });
      const data = await r.json();
      if (!data.ok || !data.employees) {
        drawerDataLoaded = true;
        return;
      }
      const drawer = qs('#' + DRAWER_ID);
      if (drawer) drawer.setAttribute('data-can-view-all', data.canViewAll ? 'true' : 'false');

      if (empSel && empSel.tagName === 'SELECT') {
        empSel.innerHTML = '<option value="">Selecteer werknemer...</option>';
        (data.employees || []).forEach(function(emp) {
          const opt = document.createElement('option');
          opt.value = emp.id;
          opt.textContent = (emp.first_name || '') + ' ' + (emp.last_name || '') + (emp.email ? ' (' + emp.email + ')' : '');
          empSel.appendChild(opt);
        });
      }
      if (!data.canViewAll) {
        const group = qs('#taskEmployeeGroup');
        if (group) group.style.display = 'none';
        const sel = qs('#taskEmployee');
        if (sel && sel.tagName === 'SELECT') {
          const hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = 'employee_id';
          hidden.id = 'taskEmployee';
          hidden.value = data.currentUserId || '';
          sel.parentNode.replaceChild(hidden, sel);
        }
        const ai = qs('#taskAiSuggestion');
        if (ai) ai.style.display = 'none';
      } else {
        const group = qs('#taskEmployeeGroup');
        if (group) group.style.display = '';
        const ai = qs('#taskAiSuggestion');
        if (ai) ai.style.display = 'none'; /* show on demand by AI */
      }
      drawerDataLoaded = true;
    } catch (e) {
      console.error('Task drawer data:', e);
      drawerDataLoaded = true;
    }
  }

  function openDrawer() {
    setOpen(true);
    const firstInput = qs('#taskTitle');
    if (firstInput) setTimeout(function() { firstInput.focus(); }, 100);
    hideAiSuggestion();
    ensureDrawerData();
  }

  function closeDrawer() {
    setOpen(false);
    resetForm();
  }

  async function submitTask(payload) {
    const submit = qs('#taskCreateSubmit');
    const errorEl = qs('#taskCreateError');

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Aanmaken...';
    }

    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Fout bij aanmaken taak');
      }

      if (window.showNotification) {
        window.showNotification('Taak succesvol aangemaakt', 'success');
      }

      closeDrawer();

      // If drawer was opened from time tracker, reopen time tracker popover instead of reloading
      if (lastOpenOpts && lastOpenOpts.openedFromTimeTracker && typeof window.timeTracker === 'object' && window.timeTracker.openPopover) {
        lastOpenOpts = null;
        setTimeout(function() {
          window.timeTracker.openPopover();
          if (window.timeTracker.loadTasks) {
            window.timeTracker.loadTasks().then(function() {
              if (window.timeTracker.handleActivityChange) {
                window.timeTracker.handleActivityChange();
              }
            });
          }
        }, 150);
      } else {
        setTimeout(function() {
          window.location.reload();
        }, 500);
      }

    } catch (error) {
      console.error('Error creating task:', error);
      if (errorEl) {
        errorEl.textContent = error.message || 'Er is een fout opgetreden bij het aanmaken van de taak';
        errorEl.style.display = 'block';
      }
      if (window.showNotification) {
        window.showNotification(error.message || 'Fout bij aanmaken taak', 'error');
      }
    } finally {
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Taak aanmaken';
      }
    }
  }

  function onDocumentClick(e) {
    const openBtn = e.target.closest('#addTaskBtn, [data-action="add-task"]');
    if (openBtn) {
      e.preventDefault();
      e.stopPropagation();
      openDrawer();
      return;
    }

    const closeBtn = e.target.closest('[data-drawer-close]');
    if (closeBtn) {
      e.preventDefault();
      closeDrawer();
      return;
    }

    // Click on overlay closes
    const overlay = e.target.closest(`#${OVERLAY_ID}`);
    if (overlay) {
      closeDrawer();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      const drawer = qs(`#${DRAWER_ID}`);
      if (drawer && drawer.classList.contains('is-open')) {
        e.preventDefault();
        closeDrawer();
      }
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    const form = qs('#taskCreateForm');
    if (!form) return;
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

    const fd = new FormData(form);
    
    // Get employee_id - if hidden field exists (for employees), use that, otherwise use select
    const employeeIdInput = qs('#taskEmployee[type="hidden"]');
    const employeeId = employeeIdInput ? employeeIdInput.value : String(fd.get('employee_id') || '').trim();

    // Get recurrence data
    const isRecurring = fd.get('is_recurring') === 'on';
    const recurrenceFrequency = isRecurring ? (fd.get('recurrence_frequency') || null) : null;
    const recurrenceInterval = isRecurring ? (parseInt(fd.get('recurrence_interval')) || 1) : null;
    const recurrenceEndType = isRecurring ? (fd.get('recurrence_end_type') || 'never') : null;
    const recurrenceEndDate = (recurrenceEndType === 'date' && fd.get('recurrence_end_date')) ? fd.get('recurrence_end_date') : null;
    const recurrenceCount = (recurrenceEndType === 'count' && fd.get('recurrence_count')) ? parseInt(fd.get('recurrence_count')) : null;
    const recurrenceDaysOfWeek = (recurrenceFrequency === 'weekly' && fd.getAll('recurrence_days_of_week').length > 0) 
      ? fd.getAll('recurrence_days_of_week').map(function(d) { return parseInt(d); })
      : null;
    
    const payload = {
      employee_id: employeeId,
      customer_id: null,
      contact_id: null,
      title: String(fd.get('title') || '').trim(),
      description: String(fd.get('description') || '').trim() || null,
      priority: String(fd.get('priority') || 'medium').trim(),
      due_at: fd.get('due_at') || null,
      is_recurring: isRecurring,
      recurrence_frequency: recurrenceFrequency,
      recurrence_interval: recurrenceInterval,
      recurrence_end_date: recurrenceEndDate,
      recurrence_count: recurrenceCount,
      recurrence_days_of_week: recurrenceDaysOfWeek
    };

    if (!payload.employee_id || !payload.title) {
      const errorEl = qs('#taskCreateError');
      if (errorEl) {
        errorEl.textContent = 'Werknemer en titel zijn verplicht';
        errorEl.style.display = 'block';
      }
      return;
    }

    submitTask(payload);
  }
  
  // Initialize task drawer functionality
  function initTaskDrawer() {
    // Recurrence toggle
    const taskIsRecurring = qs('#taskIsRecurring');
    const taskRecurrenceOptions = qs('#taskRecurrenceOptions');
    if (taskIsRecurring && taskRecurrenceOptions) {
      taskIsRecurring.addEventListener('change', function() {
        taskRecurrenceOptions.style.display = this.checked ? 'block' : 'none';
      });
    }
    
    // Recurrence frequency change
    const taskRecurrenceFrequency = qs('#taskRecurrenceFrequency');
    const taskWeeklyDaysGroup = qs('#taskWeeklyDaysGroup');
    if (taskRecurrenceFrequency && taskWeeklyDaysGroup) {
      taskRecurrenceFrequency.addEventListener('change', function() {
        taskWeeklyDaysGroup.style.display = (this.value === 'weekly') ? 'block' : 'none';
      });
    }
    
    // Recurrence end type change
    const taskRecurrenceEndType = qs('#taskRecurrenceEndType');
    const taskRecurrenceEndDateGroup = qs('#taskRecurrenceEndDateGroup');
    const taskRecurrenceEndCountGroup = qs('#taskRecurrenceEndCountGroup');
    if (taskRecurrenceEndType) {
      taskRecurrenceEndType.addEventListener('change', function() {
        const endType = this.value;
        if (taskRecurrenceEndDateGroup) {
          taskRecurrenceEndDateGroup.style.display = (endType === 'date') ? 'block' : 'none';
        }
        if (taskRecurrenceEndCountGroup) {
          taskRecurrenceEndCountGroup.style.display = (endType === 'count') ? 'block' : 'none';
        }
      });
    }
    
  }

  function init() {
    const drawer = qs(`#${DRAWER_ID}`);
    const overlay = qs(`#${OVERLAY_ID}`);
    if (!drawer || !overlay) return;

    const form = qs('#taskCreateForm');
    if (form) {
      form.addEventListener('submit', onSubmit);
    }

    // AI suggestion handlers
    const titleInput = qs('#taskTitle');
    const descriptionInput = qs('#taskDescription');
    const prioritySelect = qs('#taskPriority');
    const approveBtn = qs('#taskAiApproveBtn');
    const dismissBtn = qs('#taskAiDismissBtn');

    // Check if user can view all (manager/admin) - from tasks page or set by ensureDrawerData()
    const tasksPage = qs('.tasks-page');
    const canViewAll = (tasksPage && tasksPage.getAttribute('data-can-view-all') === 'true') ||
      (drawer && drawer.getAttribute('data-can-view-all') === 'true');

    if (canViewAll && titleInput) {
      const triggerAiSuggestion = () => {
        if (aiSuggestionTimeout) {
          clearTimeout(aiSuggestionTimeout);
        }
        aiSuggestionTimeout = setTimeout(() => {
          const title = titleInput.value || '';
          const description = descriptionInput?.value || '';
          const priority = prioritySelect?.value || 'medium';
          fetchAiSuggestion(title, description, null, priority);
        }, 800);
      };

      titleInput.addEventListener('input', triggerAiSuggestion);
      if (descriptionInput) {
        descriptionInput.addEventListener('input', triggerAiSuggestion);
      }
    }

    if (approveBtn) {
      approveBtn.addEventListener('click', onAiApprove);
    }
    if (dismissBtn) {
      dismissBtn.addEventListener('click', onAiDismiss);
    }

    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);

    // Open drawer from URL (e.g. bookmark /admin/tasks?openTaskDrawer=1)
    const params = new URLSearchParams(window.location.search);
    if (params.get('openTaskDrawer') === '1') {
      const title = params.get('title') || '';
      openDrawer();
      const titleEl = qs('#taskTitle');
      if (titleEl) titleEl.value = title;
      if (window.history && window.history.replaceState) {
        const view = params.get('view') || 'board';
        window.history.replaceState({}, '', window.location.pathname + '?view=' + view);
      }
    }

    initTaskDrawer();
  }

  var lastOpenOpts = null;

  window.openTaskDrawer = function(opts) {
    lastOpenOpts = opts || null;
    setOpen(true);
    const firstInput = qs('#taskTitle');
    if (firstInput) {
      firstInput.value = (opts && opts.prefilledTitle) ? opts.prefilledTitle : '';
      setTimeout(function() { firstInput.focus(); }, 80);
    }
    hideAiSuggestion();
    ensureDrawerData();
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

