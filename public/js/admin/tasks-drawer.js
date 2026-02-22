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

  function openDrawer() {
    setOpen(true);
    // Focus first input
    const firstInput = qs('#taskTitle');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
    // Hide AI suggestion initially
    hideAiSuggestion();
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

      // Success - show notification and reload page
      if (window.showNotification) {
        window.showNotification('Taak succesvol aangemaakt', 'success');
      }

      // Close drawer and reload page to show new task
      closeDrawer();
      setTimeout(() => {
        window.location.reload();
      }, 500);

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
    
    // Get customer or contact (required)
    const relationType = fd.get('taskRelationType') || 'customer';
    const customerId = relationType === 'customer' ? (String(fd.get('customer_id') || '').trim() || null) : null;
    const contactId = relationType === 'contact' ? (qs('#taskContactId') ? qs('#taskContactId').value : null) : null;
    
    if (!customerId && !contactId) {
      const errorEl = qs('#taskCreateError');
      if (errorEl) {
        errorEl.textContent = 'Bij een taak moet je een bedrijf of contactpersoon selecteren';
        errorEl.style.display = 'block';
      }
      return;
    }
    
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
      customer_id: customerId,
      contact_id: contactId,
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
    // Task relation type toggle
    const taskRelationCustomer = qs('#taskRelationCustomer');
    const taskRelationContact = qs('#taskRelationContact');
    const taskCustomerContainer = qs('#taskCustomerContainer');
    const taskContactContainer = qs('#taskContactContainer');
    
    if (taskRelationCustomer && taskRelationContact) {
      taskRelationCustomer.addEventListener('change', function() {
        if (this.checked) {
          if (taskCustomerContainer) taskCustomerContainer.style.display = 'block';
          if (taskContactContainer) taskContactContainer.style.display = 'none';
        }
      });
      
      taskRelationContact.addEventListener('change', function() {
        if (this.checked) {
          if (taskCustomerContainer) taskCustomerContainer.style.display = 'none';
          if (taskContactContainer) taskContactContainer.style.display = 'block';
        }
      });
    }
    
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
    
    // Contact search for tasks
    var taskContactSearchTimeout = null;
    const taskContactSearch = qs('#taskContactSearch');
    const taskContactSearchResults = qs('#taskContactSearchResults');
    
    if (taskContactSearch && taskContactSearchResults) {
      taskContactSearch.addEventListener('input', function() {
        const query = this.value.trim();
        
        if (taskContactSearchTimeout) {
          clearTimeout(taskContactSearchTimeout);
        }
        
        if (query.length < 2) {
          taskContactSearchResults.style.display = 'none';
          return;
        }
        
        taskContactSearchTimeout = setTimeout(function() {
          fetch('/admin/api/contacts/search?q=' + encodeURIComponent(query))
            .then(function(response) {
              return response.json();
            })
            .then(function(data) {
              if (data.success && data.contacts && data.contacts.length > 0) {
                taskContactSearchResults.innerHTML = data.contacts.map(function(contact) {
                  return '<div class="customer-result-item" data-id="' + contact.id + '" data-name="' + 
                    (contact.name || '') + '">' +
                    '<div class="customer-name">' + (contact.name || 'Onbekend') + '</div>' +
                    (contact.email ? '<div class="customer-email">' + contact.email + '</div>' : '') +
                    '</div>';
                }).join('');
                taskContactSearchResults.style.display = 'block';
              } else {
                taskContactSearchResults.innerHTML = '<div class="customer-result-item">Geen resultaten gevonden</div>';
                taskContactSearchResults.style.display = 'block';
              }
            })
            .catch(function(error) {
              console.error('Error searching contacts:', error);
            });
        }, 300);
      });
      
      // Handle contact selection
      taskContactSearchResults.addEventListener('click', function(e) {
        const resultItem = e.target.closest('.customer-result-item');
        if (resultItem) {
          const contactId = resultItem.getAttribute('data-id');
          const contactName = resultItem.getAttribute('data-name');
          
          const taskContactId = qs('#taskContactId');
          if (taskContactId) {
            taskContactId.value = contactId;
          }
          if (taskContactSearch) {
            taskContactSearch.value = contactName;
          }
          taskContactSearchResults.style.display = 'none';
        }
      });
    }
    
    // Auto-fill customer if user belongs to a company
    if (typeof window.userCustomerData !== 'undefined' && window.userCustomerData) {
      const taskCustomerSelect = qs('#taskCustomer');
      if (taskCustomerSelect && taskRelationCustomer) {
        taskRelationCustomer.checked = true;
        if (taskRelationCustomer.dispatchEvent) {
          taskRelationCustomer.dispatchEvent(new Event('change'));
        }
        taskCustomerSelect.value = window.userCustomerData.id;
      }
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
    const customerSelect = qs('#taskCustomer');
    const prioritySelect = qs('#taskPriority');
    const approveBtn = qs('#taskAiApproveBtn');
    const dismissBtn = qs('#taskAiDismissBtn');

    // Check if user can view all (manager/admin) - only show AI for them
    const tasksPage = qs('.tasks-page');
    const canViewAll = tasksPage?.getAttribute('data-can-view-all') === 'true';

    if (canViewAll && titleInput) {
      const triggerAiSuggestion = () => {
        // Clear existing timeout
        if (aiSuggestionTimeout) {
          clearTimeout(aiSuggestionTimeout);
        }
        
        // Debounce: wait 800ms after user stops typing
        aiSuggestionTimeout = setTimeout(() => {
          const title = titleInput.value || '';
          const description = descriptionInput?.value || '';
          const customer_id = customerSelect?.value || '';
          const priority = prioritySelect?.value || 'medium';
          
          fetchAiSuggestion(title, description, customer_id, priority);
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

    // Open drawer from URL (e.g. time-tracker "Taak toevoegen")
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
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

