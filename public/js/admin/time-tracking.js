// Time Tracking Page JavaScript
(function() {
  'use strict';

  const data = window.timeTrackingData || {};
  const employeeId = data.employeeId;
  const isOwnPage = data.isOwnPage;
  const isAdmin = data.isAdmin;
  const canViewAll = data.canViewAll || false;
  let currentTab = 'own';

  if (!employeeId) {
    console.error('Employee ID not found');
    return;
  }

  let currentWeekStart = getWeekStart(new Date());
  currentWeekStart.setHours(0, 0, 0, 0);
  let activeTimer = null;
  let timerInterval = null;
  let currentView = 'list';

  // Initialize
  function init() {
    console.log('Time Tracking: Initializing...', { employeeId, isOwnPage });
    
    if (isOwnPage) {
      loadActiveTimer();
      startTimerUpdate();
    }
    
    loadWeekOverview();
    loadTimeEntries();
    setupEventListeners();
  }

  // Get week start (Monday)
  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    return new Date(d.setDate(diff));
  }

  // Format time
  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  // Format duration
  function formatDuration(minutes) {
    if (!minutes || minutes === 0) return '0min';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}u${mins > 0 ? ' ' + mins + 'min' : ''}`.trim();
    }
    return `${mins}min`;
  }

  // Load active timer
  async function loadActiveTimer() {
    try {
      console.log('Loading active timer for employee:', employeeId);
      const res = await fetch(`/api/employees/${employeeId}/time-entries/active-timer`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await res.json();
      
      console.log('Active timer response:', data);
      
      if (data.ok && data.data) {
        activeTimer = data.data;
        console.log('Active timer found:', activeTimer);
        console.log('Active timer start_at:', activeTimer.start_at);
        console.log('Active timer is_active_timer:', activeTimer.is_active_timer);
        
        // Make sure activeTimer is set before updating UI
        if (!activeTimer) {
          console.error('Active timer data is null or undefined');
          activeTimer = null;
          updateClockUI(false);
          return;
        }
        
        // Wait a tiny bit to ensure DOM is ready, then update everything
        setTimeout(() => {
          // Immediately update timer display BEFORE updating UI
          if (activeTimer.start_at) {
            const start = new Date(activeTimer.start_at);
            const now = new Date();
            const elapsed = Math.floor((now - start) / 1000);
            const timerEl = document.getElementById('clockTimer');
            if (timerEl) {
              timerEl.textContent = formatTime(elapsed);
              console.log('Timer updated to:', formatTime(elapsed), 'from start_at:', activeTimer.start_at, 'elapsed seconds:', elapsed);
            }
          }
          
          // Update UI (this will also start the timer)
          console.log('Calling updateClockUI(true) with activeTimer:', activeTimer);
          updateClockUI(true);
          updateActivityDisplay(); // Update activity badge
        }, 50);
      } else {
        console.log('No active timer found');
        activeTimer = null;
        updateClockUI(false);
      }
    } catch (error) {
      console.error('Error loading active timer:', error);
      activeTimer = null;
      updateClockUI(false);
    }
  }

  // Update clock UI
  function updateClockUI(isClockedIn) {
    console.log('updateClockUI called with:', { isClockedIn, activeTimer: !!activeTimer, activeTimerData: activeTimer });
    
    const statusText = document.getElementById('clockStatusText');
    const statusBadge = document.getElementById('clockStatusBadge');
    const timerEl = document.getElementById('clockTimer');
    const timerSubtitle = document.getElementById('clockTimerSubtitle');
    const activityForm = document.getElementById('clockActivityForm');
    const clockInBtn = document.getElementById('clockInBtn');
    const clockOutBtn = document.getElementById('clockOutBtn');
    const clockSecondaryActions = document.getElementById('clockSecondaryActions');

    if (!statusText || !statusBadge || !timerEl || !timerSubtitle || !clockInBtn || !clockOutBtn || !clockSecondaryActions) {
      console.error('Required DOM elements not found for updateClockUI', {
        statusText: !!statusText,
        statusBadge: !!statusBadge,
        timerEl: !!timerEl,
        timerSubtitle: !!timerSubtitle,
        clockInBtn: !!clockInBtn,
        clockOutBtn: !!clockOutBtn,
        clockSecondaryActions: !!clockSecondaryActions
      });
      return;
    }

    if (isClockedIn && activeTimer) {
      console.log('Setting UI to clocked in state');
      statusText.textContent = 'Ingeklokt';
      statusBadge.classList.add('active');
      statusBadge.setAttribute('data-slot', 'badge');
      const clockIcon = timerSubtitle.querySelector('.clock-icon');
      if (clockIcon) {
        timerSubtitle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="clock-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><span>Timer loopt...</span>';
      } else {
        timerSubtitle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="clock-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><span>Timer loopt...</span>';
      }
      clockInBtn.style.display = 'none';
      clockSecondaryActions.style.display = 'flex';
      if (activityForm) {
        activityForm.style.display = 'none'; // Form is collapsible
      }
      
      // Set form values
      const workTypeField = document.getElementById('activeWorkType');
      const taskField = document.getElementById('activeTask');
      const customerField = document.getElementById('activeCustomer');
      const contactField = document.getElementById('activeContact');
      const noteField = document.getElementById('activeNote');
      
      if (activeTimer.project_name) {
        workTypeField.value = activeTimer.project_name;
        handleWorkTypeChange(); // Trigger to show/hide fields
      }
      if (activeTimer.customer_id && customerField) {
        customerField.value = activeTimer.customer_id;
      }
      if (activeTimer.contact_id && contactField) {
        contactField.value = activeTimer.contact_id;
      }
      if (activeTimer.task_id && taskField) {
        taskField.value = activeTimer.task_id;
        handleTaskChange(); // Trigger to auto-populate customer/contact
      }
      if (activeTimer.note && noteField) {
        noteField.value = activeTimer.note;
      }

      // Start timer
      console.log('Starting timer interval...');
      startTimer();
      updateActivityDisplay(); // Show current activity
      
      // Auto-open form if no activity is set
      const hasActivity = activeTimer.project_name || activeTimer.customer_id || activeTimer.contact_id || activeTimer.task_id || activeTimer.note;
      if (!hasActivity) {
        setTimeout(() => {
          toggleActivityForm();
        }, 300);
      }
    } else {
      console.log('Setting UI to not clocked in state');
      statusText.textContent = 'Niet ingeklokt';
      statusBadge.classList.remove('active');
      if (statusBadge && statusBadge.hasAttribute('data-slot')) {
        statusBadge.removeAttribute('data-slot');
      }
      timerSubtitle.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="clock-icon"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><span>Klik op "Klok in" om te beginnen</span>';
      clockInBtn.style.display = 'inline-flex';
      clockSecondaryActions.style.display = 'none';
      const activityDisplay = document.getElementById('clockActivityDisplay');
      const activityForm = document.getElementById('clockActivityForm');
      if (activityDisplay) activityDisplay.style.display = 'none';
      if (activityForm) activityForm.style.display = 'none';
      timerEl.textContent = '00:00:00';
      stopTimer();
    }
  }

  // Start timer update
  function startTimer() {
    if (timerInterval) {
      console.log('Timer interval already running, skipping start');
      return;
    }
    
    console.log('Starting timer interval with activeTimer:', activeTimer);
    timerInterval = setInterval(() => {
      if (activeTimer && activeTimer.start_at) {
        const start = new Date(activeTimer.start_at);
        const now = new Date();
        const elapsed = Math.floor((now - start) / 1000);
        const timerEl = document.getElementById('clockTimer');
        if (timerEl) {
          timerEl.textContent = formatTime(elapsed);
        } else {
          console.error('Timer element not found, stopping interval');
          stopTimer();
        }
      } else {
        console.warn('Active timer or start_at missing in interval, stopping');
        stopTimer();
      }
    }, 1000);
    console.log('Timer interval started');
  }

  // Stop timer
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Start timer update (for page visibility)
  function startTimerUpdate() {
    setInterval(() => {
      if (isOwnPage && document.visibilityState === 'visible') {
        loadActiveTimer();
      }
    }, 30000); // Update every 30 seconds
  }

  // Clock in
  window.clockIn = async function() {
    try {
      const res = await fetch(`/api/employees/${employeeId}/time-entries/clock-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const data = await res.json();
      if (data.ok) {
        activeTimer = data.data;
        updateClockUI(true);
        if (typeof window.showNotification === 'function') {
          window.showNotification('Succesvol ingeklokt', 'success');
        }
      } else {
        const errorMsg = data.error || 'Onbekende fout';
        // If error is about existing active timer, reload it immediately
        if (errorMsg.includes('already has an active timer') || errorMsg.includes('active timer')) {
          console.log('Active timer already exists, reloading...');
          // Reload to show the existing active timer
          await loadActiveTimer();
          if (typeof window.showNotification === 'function') {
            window.showNotification('Je bent al ingeklokt', 'info');
          }
        } else {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Fout bij inklokken: ' + errorMsg, 'error');
          } else {
            console.error('Fout bij inklokken:', errorMsg);
          }
        }
      }
    } catch (error) {
      console.error('Error clocking in:', error);
      if (typeof window.showNotification === 'function') {
        window.showNotification('Fout bij inklokken: ' + (error.message || 'Onbekende fout'), 'error');
      } else {
        console.error('Fout bij inklokken:', error);
      }
    }
  };

  // Clock out
  window.clockOut = async function() {
    try {
      // Get current form values
      const workType = document.getElementById('activeWorkType').value;
      const taskId = document.getElementById('activeTask').value;
      const customerId = document.getElementById('activeCustomer').value;
      const contactId = document.getElementById('activeContact').value;
      const note = document.getElementById('activeNote').value;
      
      const updateData = {
        project_name: workType || null,
        customer_id: customerId || null,
        contact_id: contactId || null,
        task_id: taskId || null,
        note: note || null
      };

      const res = await fetch(`/api/employees/${employeeId}/time-entries/clock-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const data = await res.json();
      if (data.ok) {
        activeTimer = null;
        updateClockUI(false);
        loadTimeEntries(); // Refresh list
        loadWeekOverview(); // Refresh stats
        if (typeof window.showNotification === 'function') {
          window.showNotification('Succesvol uitgeklokt', 'success');
        }
      } else {
        const errorMsg = data.error || 'Onbekende fout';
        if (typeof window.showNotification === 'function') {
          window.showNotification('Fout bij uitklokken: ' + errorMsg, 'error');
        } else {
          console.error('Fout bij uitklokken:', errorMsg);
        }
      }
    } catch (error) {
      console.error('Error clocking out:', error);
      if (typeof window.showNotification === 'function') {
        window.showNotification('Fout bij uitklokken: ' + (error.message || 'Onbekende fout'), 'error');
      } else {
        console.error('Fout bij uitklokken:', error);
      }
    }
  };

  // Handle work type change
  window.handleWorkTypeChange = function() {
    const workType = document.getElementById('activeWorkType').value;
    const taskFieldContainer = document.getElementById('taskFieldContainer');
    const customerFieldContainer = document.getElementById('customerFieldContainer');
    const contactFieldContainer = document.getElementById('contactFieldContainer');
    const taskField = document.getElementById('activeTask');
    const taskSearchInput = document.getElementById('taskSearchInput');
    const customerField = document.getElementById('activeCustomer');
    const contactField = document.getElementById('activeContact');
    
    if (workType === 'klantenwerk') {
      // Show task field, customer and contact fields will be shown when task is selected
      taskFieldContainer.style.display = 'block';
      taskField.required = true;
      customerFieldContainer.style.display = 'none';
      contactFieldContainer.style.display = 'none';
      // Clear customer and contact when switching
      customerField.value = '';
      contactField.value = '';
      taskField.value = '';
      if (taskSearchInput) {
        taskSearchInput.value = '';
        filterTaskOptions('');
      }
    } else {
      // Hide task field and related fields for other work types
      taskFieldContainer.style.display = 'none';
      customerFieldContainer.style.display = 'none';
      contactFieldContainer.style.display = 'none';
      taskField.required = false;
      taskField.value = '';
      customerField.value = '';
      contactField.value = '';
      if (taskSearchInput) {
        taskSearchInput.value = '';
      }
    }
    
    updateActiveTimer();
  };

  // Filter task options based on search input
  window.filterTaskOptions = function(searchTerm) {
    const taskSelect = document.getElementById('activeTask');
    const options = taskSelect.querySelectorAll('option');
    const searchLower = (searchTerm || '').toLowerCase();
    
    options.forEach(option => {
      if (option.value === '') {
        // Always show the placeholder option
        option.style.display = '';
        return;
      }
      
      const taskTitle = option.getAttribute('data-task-title') || '';
      if (taskTitle.includes(searchLower)) {
        option.style.display = '';
      } else {
        option.style.display = 'none';
      }
    });
  };

  // Handle task change - auto-populate customer and contact
  window.handleTaskChange = function() {
    const taskId = document.getElementById('activeTask').value;
    const customerField = document.getElementById('activeCustomer');
    const contactField = document.getElementById('activeContact');
    const customerFieldContainer = document.getElementById('customerFieldContainer');
    const contactFieldContainer = document.getElementById('contactFieldContainer');
    const taskSearchInput = document.getElementById('taskSearchInput');
    
    if (taskId) {
      const taskOption = document.querySelector(`#activeTask option[value="${taskId}"]`);
      if (taskOption) {
        const customerId = taskOption.getAttribute('data-customer-id');
        const contactId = taskOption.getAttribute('data-contact-id');
        
        // Set search input to selected task title
        if (taskSearchInput) {
          taskSearchInput.value = taskOption.textContent;
        }
        
        // Show customer field
        customerFieldContainer.style.display = 'block';
        if (customerId) {
          customerField.value = customerId;
        } else {
          customerField.value = '';
        }
        
        // Show contact field
        contactFieldContainer.style.display = 'block';
        if (contactId) {
          contactField.value = contactId;
        } else {
          contactField.value = '';
        }
      }
    } else {
      // Hide fields if no task selected
      customerFieldContainer.style.display = 'none';
      contactFieldContainer.style.display = 'none';
      customerField.value = '';
      contactField.value = '';
      if (taskSearchInput) {
        taskSearchInput.value = '';
      }
    }
    
    updateActiveTimer();
  };

  // Update active timer
  window.updateActiveTimer = async function() {
    if (!activeTimer) return;

    try {
      const workType = document.getElementById('activeWorkType').value;
      const taskId = document.getElementById('activeTask').value;
      const customerId = document.getElementById('activeCustomer').value;
      const contactId = document.getElementById('activeContact').value;
      const note = document.getElementById('activeNote').value;
      
      const updateData = {
        project_name: workType || null,
        customer_id: customerId || null,
        contact_id: contactId || null,
        task_id: taskId || null,
        note: note || null
      };

      const res = await fetch(`/api/employees/${employeeId}/time-entries/active-timer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      
      const data = await res.json();
      if (data.ok) {
        activeTimer = { ...activeTimer, ...updateData };
        updateActivityDisplay(); // Update the activity badge
        showSaveIndicator(); // Show save confirmation
        loadActiveTimer(); // Refresh to get full data
      }
    } catch (error) {
      console.error('Error updating active timer:', error);
    }
  };

  // Update activity display
  function updateActivityDisplay() {
    const activityDisplay = document.getElementById('clockActivityDisplay');
    const activityText = document.getElementById('activityDisplayText');
    
    if (!activeTimer || !activityDisplay) return;

    const parts = [];
    if (activeTimer.project_name) {
      // Map work type to display name
      const workTypeMap = {
        'klantenwerk': 'Klantenwerk',
        'platform': 'Platform',
        'sales': 'Sales'
      };
      parts.push(workTypeMap[activeTimer.project_name] || activeTimer.project_name);
    }
    if (activeTimer.customer?.company_name) parts.push(activeTimer.customer.company_name);
    if (activeTimer.task?.title) parts.push(activeTimer.task.title);
    if (activeTimer.note) parts.push(activeTimer.note);
    
    if (parts.length > 0) {
      activityText.textContent = parts.join(' • ');
      activityText.classList.remove('empty');
    } else {
      activityText.textContent = 'Geen activiteit opgegeven';
      activityText.classList.add('empty');
    }
    
    activityDisplay.style.display = 'flex';
  }

  // Toggle activity form
  window.toggleActivityForm = function() {
    const form = document.getElementById('clockActivityForm');
    const btn = document.getElementById('activityEditBtn');
    const btnText = document.getElementById('activityEditBtnText');
    
    if (form.style.display === 'none' || !form.style.display) {
      form.style.display = 'flex';
      if (btnText) btnText.textContent = 'Sluiten';
    } else {
      form.style.display = 'none';
      if (btnText) btnText.textContent = 'Wijzig activiteit';
    }
  };

  // Show save indicator
  function showSaveIndicator() {
    const indicator = document.getElementById('activitySaveIndicator');
    if (indicator) {
      indicator.style.display = 'flex';
      setTimeout(() => {
        indicator.style.display = 'none';
      }, 2000);
    }
  }

  // Load week overview
  async function loadWeekOverview() {
    try {
      // Ensure currentWeekStart is set to Monday
      const monday = getWeekStart(currentWeekStart);
      monday.setHours(0, 0, 0, 0);
      currentWeekStart = monday;
      
      const weekStartISO = currentWeekStart.toISOString().split('T')[0];
      console.log('Loading week overview for:', weekStartISO);
      
      const res = await fetch(`/api/employees/${employeeId}/time-entries/week?week_start=${weekStartISO}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await res.json();
      
      console.log('Week overview response:', data);
      
      if (data.ok && data.data) {
        const totals = data.data.totals || {};
        console.log('Week totals:', totals);
        
        const weekTotalEl = document.getElementById('weekTotal');
        const weekDraftEl = document.getElementById('weekDraft');
        const weekSubmittedEl = document.getElementById('weekSubmitted');
        const weekApprovedEl = document.getElementById('weekApproved');
        
        if (weekTotalEl) weekTotalEl.textContent = formatDuration(totals.total?.minutes || 0);
        if (weekDraftEl) weekDraftEl.textContent = formatDuration(totals.draft?.minutes || 0);
        if (weekSubmittedEl) weekSubmittedEl.textContent = formatDuration(totals.submitted?.minutes || 0);
        if (weekApprovedEl) weekApprovedEl.textContent = formatDuration(totals.approved?.minutes || 0);
      } else {
        console.error('Error in week overview response:', data);
      }

      // Update week display
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const weekDisplay = `${currentWeekStart.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      const weekDisplayEl = document.getElementById('weekDisplay');
      if (weekDisplayEl) {
        weekDisplayEl.textContent = weekDisplay;
      }
    } catch (error) {
      console.error('Error loading week overview:', error);
      if (typeof window.showNotification === 'function') {
        window.showNotification('Fout bij laden weekoverzicht: ' + (error.message || 'Onbekende fout'), 'error');
      }
    }
  }

  // Load time entries
  async function loadTimeEntries() {
    try {
      const weekStartISO = currentWeekStart.toISOString();
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEndISO = weekEnd.toISOString();

      const res = await fetch(`/api/employees/${employeeId}/time-entries?start_date=${weekStartISO}&end_date=${weekEndISO}`);
      const data = await res.json();
      
      if (data.ok) {
        const entries = data.data?.time_entries || data.data || [];
        renderEntries(entries);
      } else {
        document.getElementById('entriesList').innerHTML = '<div class="empty-state">Fout bij laden</div>';
      }
    } catch (error) {
      console.error('Error loading time entries:', error);
      document.getElementById('entriesList').innerHTML = '<div class="empty-state">Fout bij laden</div>';
    }
  }

  // Render entries
  function renderEntries(entries) {
    const container = document.getElementById('entriesList');
    
    if (entries.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="fas fa-clock"></i></div>
          <h3>Geen urenregistraties</h3>
          <p>Er zijn nog geen urenregistraties voor deze week.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = entries.map(entry => {
      const start = new Date(entry.start_at);
      const end = entry.end_at ? new Date(entry.end_at) : null;
      const duration = formatDuration(entry.duration_minutes || 0);
      
      const meta = [];
      if (entry.project_name) meta.push(`<span class="entry-meta-item"><i class="fas fa-folder"></i> ${entry.project_name}</span>`);
      if (entry.customer?.company_name) meta.push(`<span class="entry-meta-item"><i class="fas fa-building"></i> ${entry.customer.company_name}</span>`);
      if (entry.task?.title) meta.push(`<span class="entry-meta-item"><i class="fas fa-tasks"></i> ${entry.task.title}</span>`);

      return `
        <div class="entry-item">
          <div class="entry-main">
            <div class="entry-header">
              <span class="entry-date">${start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span class="entry-time">${start.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}${end ? ' - ' + end.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              <span class="entry-duration">${duration}</span>
              <span class="entry-status ${entry.status}">${getStatusLabel(entry.status)}</span>
            </div>
            ${entry.note ? `<div class="entry-note">${escapeHtml(entry.note)}</div>` : ''}
            ${meta.length > 0 ? `<div class="entry-meta">${meta.join('')}</div>` : ''}
          </div>
          ${isOwnPage && entry.status === 'draft' ? `
          <div class="entry-actions">
            <button class="btn-sm" onclick="editEntry('${entry.id}')">Bewerken</button>
            <button class="btn-sm" onclick="deleteEntry('${entry.id}')">Verwijderen</button>
          </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // Get status label
  function getStatusLabel(status) {
    const labels = {
      draft: 'Concept',
      submitted: 'Ingediend',
      approved: 'Goedgekeurd',
      rejected: 'Afgewezen'
    };
    return labels[status] || status;
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Change week
  window.changeWeek = function(delta) {
    currentWeekStart = new Date(currentWeekStart);
    currentWeekStart.setDate(currentWeekStart.getDate() + (delta * 7));
    // Ensure it's Monday
    currentWeekStart = getWeekStart(currentWeekStart);
    currentWeekStart.setHours(0, 0, 0, 0);
    console.log('Changed week to:', currentWeekStart);
    loadWeekOverview();
    loadTimeEntries();
  };

  // Switch view
  window.switchView = function(view) {
    currentView = view;
    document.querySelectorAll('.btn-toggle').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.getElementById('listView').style.display = view === 'list' ? 'block' : 'none';
    document.getElementById('calendarView').style.display = view === 'calendar' ? 'block' : 'none';
    
    if (view === 'calendar') {
      renderCalendar();
    }
  };

  // Render calendar (simplified)
  function renderCalendar() {
    // TODO: Implement calendar view
    document.getElementById('calendarContainer').innerHTML = '<p>Kalenderweergave komt binnenkort</p>';
  }

  // Open manual entry drawer
  window.openManualEntryDrawer = function() {
    const drawer = document.getElementById('manualEntryDrawer');
    const overlay = document.getElementById('manualEntryDrawerOverlay');
    if (!drawer || !overlay) return;

    drawer.classList.add('is-open');
    overlay.classList.add('is-open');
    document.documentElement.classList.add('drawer-open');
    document.body.classList.add('drawer-open');

    drawer.style.transform = 'translateX(0)';
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';

    drawer.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');

    // Reset form
    const form = document.getElementById('manualEntryForm');
    if (form) {
      form.reset();
      document.getElementById('manualDate').value = new Date().toISOString().split('T')[0];
    }
    const errorEl = document.getElementById('manualEntryError');
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }
  };

  // Close manual entry drawer
  window.closeManualEntryDrawer = function() {
    const drawer = document.getElementById('manualEntryDrawer');
    const overlay = document.getElementById('manualEntryDrawerOverlay');
    if (!drawer || !overlay) return;

    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
    document.documentElement.classList.remove('drawer-open');
    document.body.classList.remove('drawer-open');

    drawer.style.transform = 'translateX(110%)';
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';

    drawer.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('aria-hidden', 'true');
  };

  // Submit manual entry
  window.submitManualEntry = async function() {
    const form = document.getElementById('manualEntryForm');
    if (!form) return;

    const submitBtn = document.getElementById('manualEntrySubmit');
    const errorEl = document.getElementById('manualEntryError');

    // Validate form
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Toevoegen...';
      }
      if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
      }

      const date = document.getElementById('manualDate').value;
      const start = document.getElementById('manualStart').value;
      const end = document.getElementById('manualEnd').value;
      const project = document.getElementById('manualProject').value;
      const customer = document.getElementById('manualCustomer').value;
      const task = document.getElementById('manualTask').value;
      const note = document.getElementById('manualNote').value;

      const startAt = new Date(`${date}T${start}`);
      const endAt = new Date(`${date}T${end}`);

      // Validate times
      if (endAt <= startAt) {
        throw new Error('Eind tijd moet na start tijd zijn');
      }

      const res = await fetch(`/api/employees/${employeeId}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          project_name: project || null,
          customer_id: customer || null,
          task_id: task || null,
          note: note || null
        })
      });

      const data = await res.json();
      if (data.ok) {
        closeManualEntryDrawer();
        loadTimeEntries();
        loadWeekOverview();
        if (typeof window.showNotification === 'function') {
          window.showNotification('Urenregistratie toegevoegd', 'success');
        }
      } else {
        const errorMsg = data.error || 'Onbekende fout';
        if (errorEl) {
          errorEl.textContent = errorMsg;
          errorEl.style.display = 'block';
        }
        if (typeof window.showNotification === 'function') {
          window.showNotification('Fout bij toevoegen: ' + errorMsg, 'error');
        }
      }
    } catch (error) {
      console.error('Error adding manual entry:', error);
      const errorMsg = error.message || 'Onbekende fout';
      if (errorEl) {
        errorEl.textContent = errorMsg;
        errorEl.style.display = 'block';
      }
      if (typeof window.showNotification === 'function') {
        window.showNotification('Fout bij toevoegen: ' + errorMsg, 'error');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Toevoegen';
      }
    }
  };

  // Setup event listeners
  function setupEventListeners() {
    // Debounce for updateActiveTimer
    let updateTimeout;
    ['activeProject', 'activeCustomer', 'activeTask', 'activeNote'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          clearTimeout(updateTimeout);
          updateTimeout = setTimeout(updateActiveTimer, 1000);
        });
      }
    });
  }

  // Initialize on load - wait for CSS to be loaded
  function initializeWhenReady() {
    // Check if CSS is loaded
    const isCSSLoaded = document.documentElement.classList.contains('css-loaded');
    
    if (isCSSLoaded) {
      console.log('CSS loaded, initializing...');
      init();
    } else {
      // Wait for CSS to load
      const checkCSS = setInterval(() => {
        if (document.documentElement.classList.contains('css-loaded')) {
          clearInterval(checkCSS);
          console.log('CSS loaded, initializing...');
          init();
        }
      }, 10);
      
      // Fallback: initialize after max 500ms
      setTimeout(() => {
        clearInterval(checkCSS);
        if (!document.documentElement.classList.contains('css-loaded')) {
          console.log('CSS load timeout, initializing anyway...');
          init();
        }
      }, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeWhenReady();
    });
  } else {
    // DOM already loaded
    initializeWhenReady();
  }
})();

