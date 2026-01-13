// Tasks Page JavaScript
(function() {
  'use strict';

  let currentView = 'list';
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let tasksData = window.tasksData || { tasks: [], canViewAll: false, userId: null };

  // Initialize
  function init() {
    const viewParam = new URLSearchParams(window.location.search).get('view');
    if (viewParam && ['list', 'calendar', 'board'].includes(viewParam)) {
      currentView = viewParam;
    } else {
      currentView = 'board'; // Default to board
    }

    // Initialize view select dropdown
    initViewSelect();

    // Set active view
    switchView(currentView, false);

    // Initialize calendar if needed
    if (currentView === 'calendar') {
      renderCalendar();
    }

    // Initialize board if needed
    if (currentView === 'board') {
      renderKanban();
    }

    // Initialize list if needed
    if (currentView === 'list') {
      renderListView();
    }
  }

  // Initialize view select dropdown
  function initViewSelect() {
    const selectEl = document.getElementById('viewSelect');
    const trigger = document.getElementById('viewSelectTrigger');
    const valueEl = document.getElementById('viewSelectValue');
    const items = selectEl?.querySelectorAll('.custom-select-item');

    if (!selectEl || !trigger || !valueEl || !items) return;

    // Toggle dropdown on trigger click
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = selectEl.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) {
        selectEl.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    // Handle item selection
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const value = item.dataset.value;
        if (value && ['board', 'calendar', 'list'].includes(value)) {
          switchView(value, true);
          updateViewSelectDisplay(value);
          closeAllDropdowns();
        }
      });

      // Keyboard support
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!selectEl.contains(e.target)) {
        closeAllDropdowns();
      }
    });
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.custom-select.open').forEach(select => {
      select.classList.remove('open');
      const trigger = select.querySelector('.custom-select-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  }

  function updateViewSelectDisplay(view) {
    const selectEl = document.getElementById('viewSelect');
    const valueEl = document.getElementById('viewSelectValue');
    if (!selectEl || !valueEl) return;

    const viewLabels = {
      board: 'Bord',
      calendar: 'Kalender',
      list: 'Lijst'
    };

    const viewIcons = {
      board: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="7" height="9" x="3" y="3" rx="1"></rect>
        <rect width="7" height="5" x="14" y="3" rx="1"></rect>
        <rect width="7" height="9" x="14" y="12" rx="1"></rect>
        <rect width="7" height="5" x="3" y="16" rx="1"></rect>
      </svg>`,
      calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>`,
      list: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"></line>
        <line x1="8" y1="12" x2="21" y2="12"></line>
        <line x1="8" y1="18" x2="21" y2="18"></line>
        <line x1="3" y1="6" x2="3.01" y2="6"></line>
        <line x1="3" y1="12" x2="3.01" y2="12"></line>
        <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>`
    };

    // Update selected state in dropdown
    selectEl.querySelectorAll('.custom-select-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.value === view);
    });

    // Update trigger display
    valueEl.innerHTML = `
      <span class="view-select-icon-wrapper">${viewIcons[view] || ''}</span>
      <span class="view-select-text">${viewLabels[view] || view}</span>
    `;
  }

  // View switching
  window.switchView = function(view, updateURL = true) {
    if (!['list', 'calendar', 'board'].includes(view)) return;

    currentView = view;

    // Hide all views
    document.querySelectorAll('.tasks-view').forEach(v => {
      v.style.display = 'none';
    });

    // Show selected view - handle both 'board' and 'kanban' IDs for backward compatibility
    const viewEl = document.getElementById(`${view}View`) || document.getElementById(`${view === 'board' ? 'kanban' : view}View`);
    if (viewEl) {
      viewEl.style.display = 'block';
    }

    // Update dropdown display
    updateViewSelectDisplay(view);

    // Update hidden input
    const viewInput = document.getElementById('viewInput');
    if (viewInput) {
      viewInput.value = view;
    }

    // Render view content
    if (view === 'calendar') {
      renderCalendar();
    } else if (view === 'board') {
      renderKanban();
    }

    // Update URL without reload
    if (updateURL) {
      const url = new URL(window.location);
      url.searchParams.set('view', view);
      window.history.pushState({}, '', url);
    }
  };

  // Calendar functions
  function renderCalendar() {
    const monthNames = [
      'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
      'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
    ];

    const monthYearEl = document.getElementById('calendarMonthYear');
    if (monthYearEl) {
      monthYearEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    }

    const gridEl = document.getElementById('calendarGrid');
    if (!gridEl) return;

    // Clear grid
    gridEl.innerHTML = '';

    // Day headers
    const dayHeaders = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
    dayHeaders.forEach(day => {
      const header = document.createElement('div');
      header.className = 'calendar-day-header';
      header.textContent = day;
      gridEl.appendChild(header);
    });

    // Get first day of month and number of days
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0

    // Previous month days
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevLastDay = new Date(prevYear, prevMonth + 1, 0).getDate();

    for (let i = startDay - 1; i >= 0; i--) {
      const day = document.createElement('div');
      day.className = 'calendar-day other-month';
      day.innerHTML = `
        <div class="calendar-day-number">${prevLastDay - i}</div>
        <div class="calendar-day-tasks"></div>
      `;
      gridEl.appendChild(day);
    }

    // Current month days
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const isToday = date.toDateString() === today.toDateString();
      
      const dayEl = document.createElement('div');
      dayEl.className = `calendar-day ${isToday ? 'today' : ''}`;
      dayEl.dataset.date = date.toISOString().split('T')[0];
      
      // Find tasks for this day
      const dayTasks = tasksData.tasks.filter(task => {
        if (!task.due_at) return false;
        const taskDate = new Date(task.due_at).toISOString().split('T')[0];
        return taskDate === dayEl.dataset.date;
      });

      dayEl.innerHTML = `
        <div class="calendar-day-number">${day}</div>
        <div class="calendar-day-tasks">
          ${dayTasks.slice(0, 3).map(task => {
            const statusColors = {
              open: '#3b82f6',
              in_progress: '#f59e0b',
              in_review: '#8b5cf6',
              done: '#10b981',
              rejected: '#ef4444'
            };
            return `<div class="calendar-task-dot" data-task-id="${task.id}" style="background: ${statusColors[task.status] || '#6b7280'}; cursor: pointer;" title="${task.title}"></div>`;
          }).join('')}
          ${dayTasks.length > 3 ? `<div class="calendar-task-dot" style="background: #9ca3af; cursor: default;" title="+${dayTasks.length - 3} meer"></div>` : ''}
        </div>
      `;

      if (dayTasks.length > 0) {
        dayEl.style.cursor = 'pointer';
        // Click on day to show tasks, but clicking on task dots navigates to task
        dayEl.onclick = (e) => {
          // If clicking on a task dot, navigate to that task
          const taskDot = e.target.closest('.calendar-task-dot');
          if (taskDot && taskDot.dataset.taskId) {
            window.location.href = `/admin/tasks/${taskDot.dataset.taskId}`;
          } else {
            // Otherwise show all tasks for the day
            showDayTasks(date, dayTasks);
          }
        };
      }

      gridEl.appendChild(dayEl);
    }

    // Next month days
    const totalCells = gridEl.children.length - 7; // Subtract headers
    const remainingCells = 42 - totalCells; // 6 rows * 7 days
    for (let day = 1; day <= remainingCells; day++) {
      const dayEl = document.createElement('div');
      dayEl.className = 'calendar-day other-month';
      dayEl.innerHTML = `
        <div class="calendar-day-number">${day}</div>
        <div class="calendar-day-tasks"></div>
      `;
      gridEl.appendChild(dayEl);
    }
  }

  window.changeMonth = function(delta) {
    currentMonth += delta;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    } else if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  };

  function showDayTasks(date, tasks) {
    // Simple alert for now - could be a modal
    const dateStr = date.toLocaleDateString('nl-NL');
    const taskList = tasks.map(t => `• ${t.title} (${t.status})`).join('\n');
    if (window.showNotification) {
      window.showNotification(`Taken op ${dateStr}:\n${taskList}`, 'info');
    } else {
      alert(`Taken op ${dateStr}:\n${taskList}`);
    }
  }

  // Kanban functions
  function renderKanban() {
    console.log('📋 Rendering Kanban with tasks:', tasksData.tasks?.length || 0, 'tasks');
    console.log('📋 All tasks:', tasksData.tasks);
    
    // Include all possible statuses, including rejected
    const statuses = ['open', 'in_progress', 'in_review', 'done', 'rejected'];
    
    statuses.forEach(status => {
      const column = document.querySelector(`.kanban-column[data-status="${status}"] .kanban-column-content`);
      const countEl = document.getElementById(`count-${status}`);
      
      if (!column) {
        console.warn(`⚠️ Column not found for status: ${status}`);
        return;
      }

      // Clear column
      column.innerHTML = '';

      // Filter tasks by status
      const statusTasks = tasksData.tasks.filter(t => t.status === status);
      console.log(`📊 Status ${status}: ${statusTasks.length} tasks`);
      
      // Update count
      if (countEl) {
        countEl.textContent = statusTasks.length;
      }

      // Render task cards
      statusTasks.forEach(task => {
        const card = createKanbanCard(task);
        column.appendChild(card);
      });
    });
  }

  function createKanbanCard(task) {
    const card = document.createElement('div');
    card.className = 'kanban-task-card';
    card.draggable = true;
    card.dataset.taskId = task.id;
    card.dataset.status = task.status;
    card.style.cursor = 'pointer';

    const priorityColors = {
      low: '#6b7280',
      medium: '#3b82f6',
      high: '#f59e0b',
      urgent: '#ef4444'
    };

    const employeeName = task.employee ? 
      ((task.employee.first_name || '') + ' ' + (task.employee.last_name || '')).trim() || task.employee.email : 
      'Onbekend';

    card.innerHTML = `
      <div class="kanban-task-title">${task.title || 'Geen titel'}</div>
      ${task.description ? `<div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.5rem;">${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}</div>` : ''}
      <div class="kanban-task-meta">
        ${tasksData.canViewAll ? `<span><i class="fas fa-user"></i> ${employeeName}</span>` : ''}
        ${task.due_at ? `<span><i class="fas fa-calendar"></i> ${new Date(task.due_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>` : ''}
        <span class="kanban-task-priority" style="background: ${priorityColors[task.priority] || '#6b7280'};"></span>
      </div>
    `;

    // Click to navigate to task detail
    card.addEventListener('click', (e) => {
      // Don't navigate if clicking on drag handle or if dragging
      if (!card.classList.contains('dragging') && !e.target.closest('.kanban-task-priority')) {
        window.location.href = `/admin/tasks/${task.id}`;
      }
    });

    // Drag events
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    return card;
  }

  // Drag and drop
  let draggedElement = null;

  function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
  }

  function handleDragEnd(e) {
    this.classList.remove('dragging');
    draggedElement = null;
  }

  window.handleDragOver = function(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  };

  window.handleDrop = function(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }

    if (!draggedElement) return false;

    const column = e.currentTarget.closest('.kanban-column');
    const newStatus = column.dataset.status;

    if (draggedElement.dataset.status === newStatus) {
      return false;
    }

    // Move card visually
    e.currentTarget.appendChild(draggedElement);
    draggedElement.dataset.status = newStatus;

    // Update task status via API
    const taskId = draggedElement.dataset.taskId;
    updateTaskStatus(taskId, newStatus);

    // Update counts
    updateKanbanCounts();

    return false;
  };

  async function updateTaskStatus(taskId, newStatus) {
    try {
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update task status');
      }

      const data = await response.json();
      
      // Update local data
      const task = tasksData.tasks.find(t => t.id === taskId);
      if (task) {
        task.status = newStatus;
      }

      // Get status label for notification
      const statusLabels = {
        open: 'Open',
        in_progress: 'In uitvoering',
        in_review: 'In review',
        done: 'Afgerond',
        rejected: 'Afgewezen'
      };

      const statusLabel = statusLabels[newStatus] || newStatus;
      const notificationMessage = newStatus === 'done' 
        ? 'Taak afgerond' 
        : `Taak verandert naar ${statusLabel.toLowerCase()}`;

      if (window.showNotification) {
        window.showNotification(notificationMessage, 'success');
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      if (window.showNotification) {
        window.showNotification('Fout bij bijwerken taak status', 'error');
      }
      // Revert visual change
      renderKanban();
    }
  }

  function updateKanbanCounts() {
    const statuses = ['open', 'in_progress', 'in_review', 'done'];
    statuses.forEach(status => {
      const countEl = document.getElementById(`count-${status}`);
      if (countEl) {
        const column = document.querySelector(`.kanban-column[data-status="${status}"] .kanban-column-content`);
        const count = column ? column.children.length : 0;
        countEl.textContent = count;
      }
    });
  }

  // Filter handling with AJAX
  function initFilters() {
    const filterForm = document.getElementById('tasksFilterForm');
    if (!filterForm) return;

    const filterSelects = filterForm.querySelectorAll('.filter-select');
    
    filterSelects.forEach(select => {
      select.addEventListener('change', () => {
        applyFilters();
      });
    });

    // Prevent form submission
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      applyFilters();
    });
  }

  async function applyFilters() {
    const filterForm = document.getElementById('tasksFilterForm');
    if (!filterForm) return;

    // Show loading state
    const tasksContainer = document.querySelector('.tasks-content');
    if (tasksContainer) {
      tasksContainer.style.opacity = '0.5';
      tasksContainer.style.pointerEvents = 'none';
    }

    try {
      // Get filter values
      const formData = new FormData(filterForm);
      const params = new URLSearchParams();
      
      if (formData.get('employee_id')) {
        params.append('employee_id', formData.get('employee_id'));
      }
      if (formData.get('status')) {
        params.append('status', formData.get('status'));
      }
      if (formData.get('priority')) {
        params.append('priority', formData.get('priority'));
      }

      // Fetch filtered tasks
      const response = await fetch(`/api/tasks?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error || 'Failed to fetch tasks');
      }

      // Update tasks data
      tasksData.tasks = result.data.tasks || [];

      // Update URL without reload
      const url = new URL(window.location);
      params.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
      // Remove params that are not in the form
      ['employee_id', 'status', 'priority'].forEach(key => {
        if (!params.has(key)) {
          url.searchParams.delete(key);
        }
      });
      window.history.pushState({}, '', url);

      // Re-render current view
      if (currentView === 'calendar') {
        renderCalendar();
      } else if (currentView === 'board') {
        renderKanban();
      } else if (currentView === 'list') {
        renderListView();
      }

      // Update KPI counts if visible
      if (window.updateKPICounts) {
        window.updateKPICounts();
      }

    } catch (error) {
      console.error('Error applying filters:', error);
      if (window.showNotification) {
        window.showNotification('Fout bij toepassen filters', 'error');
      }
    } finally {
      // Remove loading state
      if (tasksContainer) {
        tasksContainer.style.opacity = '1';
        tasksContainer.style.pointerEvents = 'auto';
      }
    }
  }

  // List view rendering
  function renderListView() {
    const listView = document.getElementById('listView');
    if (!listView) return;

    const tbody = listView.querySelector('tbody');
    if (!tbody) return;

    // Clear existing rows
    tbody.innerHTML = '';

    if (tasksData.tasks.length === 0) {
      const colspan = tasksData.canViewAll ? '7' : '5';
      tbody.innerHTML = `
        <tr class="table-body-row">
          <td class="table-cell" colspan="${colspan}" style="text-align: center; padding: 3rem;">
            <div class="empty-state">
              <div class="empty-state-icon"><i class="fas fa-tasks"></i></div>
              <h3>Geen taken gevonden</h3>
              <p>Er zijn momenteel geen taken die voldoen aan de geselecteerde filters.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Render tasks
    tasksData.tasks.forEach(task => {
      const row = document.createElement('tr');
      row.className = 'table-body-row';
      row.dataset.taskId = task.id;
      row.style.cursor = 'pointer';
      
      const statusLabels = {
        open: 'Open',
        in_progress: 'In uitvoering',
        in_review: 'In review',
        done: 'Afgerond',
        rejected: 'Afgewezen'
      };

      const priorityLabels = {
        low: 'Laag',
        medium: 'Normaal',
        high: 'Hoog',
        urgent: 'Urgent'
      };

      const statusClasses = {
        open: 'status-new',
        in_progress: 'status-pending',
        in_review: 'status-pending',
        done: 'status-paid',
        rejected: 'status-failed'
      };

      const employeeName = task.employee ? 
        ((task.employee.first_name || '') + ' ' + (task.employee.last_name || '')).trim() || task.employee.email : 
        'Onbekend';

      const customerName = task.customer ? 
        (task.customer.company_name || ((task.customer.first_name || '') + ' ' + (task.customer.last_name || '')).trim()) : 
        null;

      const isOverdue = task.due_at && new Date(task.due_at) < new Date() && !['done', 'rejected'].includes(task.status);

      let rowHTML = `
        <td class="table-cell">
          <div class="cell-column">
            <span class="cell-text" style="font-weight: 500;">${escapeHtml(task.title || 'Geen titel')}</span>
            ${task.description ? `<span class="lead-title">${escapeHtml(task.description.substring(0, 80))}${task.description.length > 80 ? '...' : ''}</span>` : ''}
          </div>
        </td>
      `;

      if (tasksData.canViewAll) {
        rowHTML += `
          <td class="table-cell">
            <span class="cell-text">${escapeHtml(employeeName)}</span>
          </td>
        `;
      }

      rowHTML += `
        <td class="table-cell">
          ${customerName ? `<span class="customer-name">${escapeHtml(customerName)}</span>` : '<span class="cell-text" style="color: #9ca3af;">—</span>'}
        </td>
        <td class="table-cell">
          <span class="status-badge ${statusClasses[task.status] || ''}">${statusLabels[task.status] || task.status}</span>
        </td>
        <td class="table-cell">
          <span class="cell-text">${priorityLabels[task.priority] || task.priority}</span>
        </td>
        <td class="table-cell">
          ${task.due_at ? `
            <span class="cell-text ${isOverdue ? 'text-danger' : ''}">
              ${new Date(task.due_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
              ${isOverdue ? ' <i class="fas fa-exclamation-triangle" style="color: #ef4444;"></i>' : ''}
            </span>
          ` : '<span class="cell-text" style="color: #9ca3af;">—</span>'}
        </td>
      `;

      if (tasksData.canViewAll) {
        rowHTML += `
          <td class="table-cell actions-cell no-link">
            <div class="actions-button-group">
              <button class="actions-button" onclick="event.stopPropagation(); updateTaskStatus('${task.id}', 'done')" title="Afgerond">
                <i class="fas fa-check"></i>
              </button>
              <button class="actions-button" onclick="event.stopPropagation(); updateTaskStatus('${task.id}', 'rejected')" title="Afwijzen">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </td>
        `;
      }

      row.innerHTML = rowHTML;

      // Click to navigate to task detail (excluding action buttons)
      row.addEventListener('click', (e) => {
        if (!e.target.closest('.actions-cell, .actions-button')) {
          window.location.href = `/admin/tasks/${task.id}`;
        }
      });

      tbody.appendChild(row);
    });
  }

  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Update task status (for list view buttons)
  window.updateTaskStatus = async function(taskId, newStatus) {
    try {
      const response = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update task status');
      }

      // Update local data
      const task = tasksData.tasks.find(t => t.id === taskId);
      if (task) {
        task.status = newStatus;
      }

      // Get status label for notification
      const statusLabels = {
        open: 'Open',
        in_progress: 'In uitvoering',
        in_review: 'In review',
        done: 'Afgerond',
        rejected: 'Afgewezen'
      };

      const statusLabel = statusLabels[newStatus] || newStatus;
      const notificationMessage = newStatus === 'done' 
        ? 'Taak afgerond' 
        : `Taak verandert naar ${statusLabel.toLowerCase()}`;

      // Re-render current view
      if (currentView === 'calendar') {
        renderCalendar();
      } else if (currentView === 'board') {
        renderKanban();
      } else if (currentView === 'list') {
        renderListView();
      }

      if (window.showNotification) {
        window.showNotification(notificationMessage, 'success');
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      if (window.showNotification) {
        window.showNotification('Fout bij bijwerken taak status', 'error');
      }
    }
  };

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      initFilters();
    });
  } else {
    init();
    initFilters();
  }
})();

