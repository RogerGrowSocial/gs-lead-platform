// Employee Detail Page JavaScript
(function() {
  'use strict';

  // Get employee ID from page data attribute or window variable
  const pageElement = document.querySelector('.user-detail-page');
  const employeeId = pageElement?.dataset?.employeeId || window.employeeData?.id;
  if (!employeeId) {
    console.error('❌ Employee ID not found');
    return;
  }

  const employeeData = window.employeeData || {};
  const isAdmin = window.isUserAdmin || false;
  const canEditSalary = window.canEditSalary || false;
  let currentWeekStart = getWeekStart(new Date());
  let currentTab = 'work';
  let currentTaskFilter = 'all';

  // Initialize - run immediately if DOM is ready, otherwise wait
  function initialize() {
    console.log('🔧 Employee Detail Page: Initializing...', { employeeId, isAdmin });
    
    if (!employeeId) {
      console.error('❌ Employee ID not found');
      return;
    }
    
    // Initialize profile picture upload
    initProfilePictureUpload();
    
    // Load all data (no tabs, direct sections)
    loadKPIs();
    loadTasks();
    loadCustomers();
    loadTimeEntries();
    loadSalaryData();
    loadQuickStats();
    if (isAdmin || canViewNotes()) {
      loadNotes();
    }
    
    // Calculate monthly salary
    updateMonthlySalary();
    
    console.log('✅ Employee Detail Page: Initialized');
  }

  // Initialize profile picture upload functionality
  function initProfilePictureUpload() {
    const avatarTrigger = document.getElementById('employeeAvatarTrigger');
    const profilePictureUpload = document.getElementById('employeeProfilePictureUpload');
    const employeeAvatar = document.getElementById('employeeAvatar');
    const profilePictureModal = document.getElementById('employeeProfilePictureModal');
    const profilePictureModalClose = document.getElementById('closeEmployeeProfilePictureModal');
    const profilePictureModalX = profilePictureModal ? profilePictureModal.querySelector('.modal-close') : null;
    const profilePicturePreview = document.getElementById('employeeProfilePicturePreview');
    const profilePicturePreviewContainer = document.getElementById('employeeProfilePicturePreviewContainer');
    const profilePictureEditPencil = document.getElementById('employeeProfilePictureEditPencil');
    
    // Check if user can edit (upload only available if canEditEmployee is true)
    const canEditEmployee = window.canEditEmployee !== undefined ? window.canEditEmployee : false;
    
    if (!avatarTrigger || !profilePictureUpload || !employeeAvatar || !canEditEmployee) {
      return; // Elements not found or user can't edit, skip initialization
    }
    
    // Modal functions
    function openProfilePictureModal() {
      if (!profilePictureModal) return;
      profilePictureModal.style.display = 'flex';
      document.body.classList.add('modal-open');
    }
    
    function closeProfilePictureModal() {
      if (!profilePictureModal) return;
      profilePictureModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }
    
    // Click handler for avatar trigger - opens modal
    avatarTrigger.addEventListener('click', openProfilePictureModal);
    
    // Modal close handlers
    if (profilePictureModalClose) {
      profilePictureModalClose.addEventListener('click', closeProfilePictureModal);
    }
    if (profilePictureModalX) {
      profilePictureModalX.addEventListener('click', closeProfilePictureModal);
    }
    if (profilePictureModal) {
      profilePictureModal.addEventListener('click', (e) => {
        if (e.target === profilePictureModal) closeProfilePictureModal();
      });
    }
    
    // Make preview container clickable for upload (when no profile picture exists)
    if (profilePicturePreviewContainer && profilePictureUpload) {
      // Click handler
      profilePicturePreviewContainer.addEventListener('click', () => {
        // Only trigger upload if no profile picture exists
        if (!profilePicturePreview || !profilePicturePreview.src || profilePicturePreview.style.display === 'none') {
          profilePictureUpload.click();
        }
      });
      
      // Drag and drop functionality
      let dragCounter = 0;
      
      profilePicturePreviewContainer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        if (!employeeAvatar || !employeeAvatar.querySelector('img')) {
          profilePicturePreviewContainer.style.borderColor = '#3b82f6';
          profilePicturePreviewContainer.style.background = '#eff6ff';
          profilePicturePreviewContainer.style.borderWidth = '3px';
          const placeholder = document.getElementById('profilePicturePlaceholderContent');
          if (placeholder) {
            placeholder.style.color = '#3b82f6';
            const svg = placeholder.querySelector('svg');
            if (svg) {
              svg.style.opacity = '1';
              svg.style.transform = 'scale(1.1)';
            }
          }
        }
      });
      
      profilePicturePreviewContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      
      profilePicturePreviewContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter === 0) {
          if (!employeeAvatar || !employeeAvatar.querySelector('img')) {
            profilePicturePreviewContainer.style.borderColor = '#e5e7eb';
            profilePicturePreviewContainer.style.background = '#f9fafb';
            profilePicturePreviewContainer.style.borderWidth = '2px';
            const placeholder = document.getElementById('profilePicturePlaceholderContent');
            if (placeholder) {
              placeholder.style.color = '#9ca3af';
              const svg = placeholder.querySelector('svg');
              if (svg) {
                svg.style.opacity = '0.5';
                svg.style.transform = 'scale(1)';
              }
            }
          }
        }
      });
      
      profilePicturePreviewContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        
        // Reset styling
        if (!employeeAvatar || !employeeAvatar.querySelector('img')) {
          profilePicturePreviewContainer.style.borderColor = '#e5e7eb';
          profilePicturePreviewContainer.style.background = '#f9fafb';
          profilePicturePreviewContainer.style.borderWidth = '2px';
          const placeholder = document.getElementById('profilePicturePlaceholderContent');
          if (placeholder) {
            placeholder.style.color = '#9ca3af';
            const svg = placeholder.querySelector('svg');
            if (svg) {
              svg.style.opacity = '0.5';
              svg.style.transform = 'scale(1)';
            }
          }
        }
        
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (file.type.startsWith('image/')) {
            // Validate file size
            if (file.size > 2 * 1024 * 1024) {
              window.showNotification?.('Bestand is te groot (max 2MB)', 'error');
              return;
            }
            // Validate file type (JPG/PNG only)
            if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
              window.showNotification?.('Ongeldig bestandstype. Alleen JPG en PNG toegestaan.', 'error');
              return;
            }
            // Create a FileList-like object and trigger upload
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            profilePictureUpload.files = dataTransfer.files;
            // Trigger change event to upload
            profilePictureUpload.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            window.showNotification?.('Alleen afbeeldingen zijn toegestaan', 'error');
          }
        }
      });
    }
    
    // File input change handler
    profilePictureUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        window.showNotification?.('Alleen afbeeldingen zijn toegestaan', 'error');
        return;
      }
      
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        window.showNotification?.('Bestand is te groot (max 2MB)', 'error');
        return;
      }
      
      // Validate file type (JPG/PNG only)
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        window.showNotification?.('Ongeldig bestandstype. Alleen JPG en PNG toegestaan.', 'error');
        return;
      }
      
      const formData = new FormData();
      formData.append('profilePicture', file);
      
      try {
        const response = await fetch(`/admin/api/employees/${employeeId}/profile-picture`, {
          method: 'POST',
          credentials: 'same-origin',
          body: formData
        });
        
        const data = await response.json();
        if (response.ok && data.success) {
          window.showNotification?.('Profielfoto geüpload', 'success');
          
          // Update main avatar
          if (employeeAvatar && data.profile_picture) {
            employeeAvatar.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            employeeAvatar.innerHTML = `<img src="${data.profile_picture}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />`;
          }
          
          // Update modal preview
          if (profilePicturePreview && data.profile_picture) {
            profilePicturePreview.src = data.profile_picture;
            profilePicturePreview.style.display = 'block';
            // Hide placeholder if exists
            const placeholder = profilePicturePreviewContainer ? profilePicturePreviewContainer.querySelector('#profilePicturePlaceholderContent') : null;
            if (placeholder) {
              placeholder.style.display = 'none';
            }
            // Update container to not be clickable anymore
            if (profilePicturePreviewContainer) {
              profilePicturePreviewContainer.style.cursor = 'default';
              profilePicturePreviewContainer.onclick = null;
            }
            // Show pencil icon for editing with orange color
            if (profilePictureEditPencil) {
              profilePictureEditPencil.style.display = 'flex';
              const pencilIcon = profilePictureEditPencil.querySelector('i');
              if (pencilIcon) {
                pencilIcon.style.color = '#ea5d0d';
              }
            }
          }
          
          closeProfilePictureModal();
        } else {
          throw new Error(data.error || 'Fout bij uploaden profielfoto');
        }
      } catch (error) {
        console.error('Error uploading profile picture:', error);
        window.showNotification?.(error.message || 'Fout bij uploaden profielfoto', 'error');
      }
    });
  }

  // Calculate and update monthly salary
  function updateMonthlySalary() {
    const hourlyRateCents = employeeData.hourly_rate_cents || 0;
    const hoursPerMonth = 160; // Standard full-time hours per month
    const monthlySalaryCents = hourlyRateCents * hoursPerMonth;
    const monthlySalaryDisplay = document.getElementById('monthlySalaryDisplay');
    if (monthlySalaryDisplay) {
      monthlySalaryDisplay.textContent = formatCurrency(monthlySalaryCents);
    }
  }

  // Run immediately if DOM is ready, otherwise wait
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // No tabs anymore - direct sections

  // Load KPI Cards
  async function loadKPIs() {
    try {
      const res = await fetch(`/api/employees/${employeeId}/summary`);
      const data = await res.json();
      
      if (!data.ok) {
        console.error('API Error:', data.error);
        throw new Error(data.error);
      }

      const kpis = data.data?.kpis || {};
      const role = data.data?.employee?.role_name || employeeData.role_name || 'employee';
      
      renderKPIs(kpis, role);
    } catch (error) {
      console.error('Error loading KPIs:', error);
      const container = document.getElementById('kpiCards');
      if (container) {
        container.innerHTML = 
          '<div style="text-align: center; padding: 2rem; color: #dc2626;">Fout bij laden KPI\'s: ' + error.message + '</div>';
      }
    }
  }

  function renderKPIs(kpis, role) {
    const container = document.getElementById('kpiCards');
    if (!container) return;
    
    const roleLower = role.toLowerCase();
    
    let cards = [];
    
    if (roleLower === 'ops' || roleLower === 'operations' || roleLower === 'employee' || roleLower === 'manager') {
      cards = [
        { title: 'Open taken', value: kpis.open_tasks || 0, icon: 'fa-tasks' },
        { title: 'In review', value: kpis.in_review || 0, icon: 'fa-eye' },
        { title: 'Uren deze week', value: `${kpis.hours_this_week || 0}h`, icon: 'fa-clock' },
        { title: 'Value delivered', value: formatCurrency(kpis.value_delivered_cents || 0), icon: 'fa-euro-sign' }
      ];
    } else if (roleLower === 'sales' || roleLower === 'account_manager') {
      cards = [
        { title: 'Deals gewonnen', value: kpis.deals_won || 0, icon: 'fa-trophy' },
        { title: 'Win rate', value: `${kpis.win_rate || 0}%`, icon: 'fa-percentage' },
        { title: 'Deal cycle', value: `${kpis.deal_cycle_days || 0} dagen`, icon: 'fa-calendar' },
        { title: 'Active prospects', value: kpis.active_prospects || 0, icon: 'fa-users' }
      ];
    } else if (roleLower === 'support' || roleLower === 'customer_support') {
      cards = [
        { title: 'Open tickets', value: kpis.open_tickets || 0, icon: 'fa-ticket-alt' },
        { title: 'First response', value: `${kpis.first_response_time_minutes || 0} min`, icon: 'fa-stopwatch' },
        { title: 'CSAT score', value: kpis.csat_score || 0, icon: 'fa-star' }
      ];
    } else {
      // Default KPIs
      cards = [
        { title: 'Open taken', value: kpis.open_tasks || 0, icon: 'fa-tasks' },
        { title: 'Uren deze week', value: `${kpis.hours_this_week || 0}h`, icon: 'fa-clock' }
      ];
    }

    container.innerHTML = cards.map(card => `
      <div style="padding: 1.25rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
        <p style="font-size: 0.875rem; color: #6b7280; margin: 0 0 0.5rem 0;">${card.title}</p>
        <p style="font-size: 1.75rem; font-weight: 700; color: #111827; margin: 0;">${card.value}</p>
      </div>
    `).join('');
  }

  // Load all sections directly (no tabs)

  // Tasks
  async function loadTasks() {
    try {
      const status = currentTaskFilter === 'all' ? undefined : currentTaskFilter;
      const url = `/api/employees/${employeeId}/tasks${status ? `?status=${status}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (!data.ok) throw new Error(data.error);
      
      // Handle different response structures
      const tasks = data.data?.tasks || data.data || [];
      renderTasks(tasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      const container = document.getElementById('tasksList');
      if (container) {
        container.innerHTML = 
          '<div style="text-align: center; padding: 2rem; color: #6b7280;"><p>Fout bij laden taken: ' + error.message + '</p></div>';
      }
    }
  }

  function renderTasks(tasks) {
    const container = document.getElementById('tasksList');
    
    if (tasks.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>Geen taken</h3><p>Er zijn nog geen taken voor deze werknemer.</p></div>';
      return;
    }

    container.innerHTML = tasks.map(task => `
      <div class="task-item" data-task-id="${task.id}">
        <div class="task-item-content">
          <h4 class="task-item-title">${escapeHtml(task.title)}</h4>
          <div class="task-item-meta">
            <span>Prioriteit: ${task.priority || 'medium'}</span>
            ${task.due_at ? `<span>Deadline: ${formatDate(task.due_at)}</span>` : ''}
            ${task.value_cents > 0 ? `<span>Waarde: ${formatCurrency(task.value_cents)}</span>` : ''}
          </div>
          ${task.description ? `<p class="task-item-description">${escapeHtml(task.description)}</p>` : ''}
        </div>
        <div class="task-item-actions">
          <span class="task-status-badge ${task.status}">${getTaskStatusLabel(task.status)}</span>
          ${task.status === 'in_review' && isAdmin ? `
            <button class="btn btn-success btn-sm" onclick="approveTask('${task.id}')">Goedkeuren</button>
            <button class="btn btn-secondary btn-sm" onclick="rejectTask('${task.id}')">Afwijzen</button>
          ` : ''}
          ${task.status === 'open' || task.status === 'in_progress' ? `
            <button class="btn btn-primary btn-sm" onclick="updateTaskStatus('${task.id}', 'in_review')">Markeer voor review</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  // Load customers for this employee
  async function loadCustomers() {
    try {
      // Get customers from tasks and time entries
      const tasksRes = await fetch(`/api/employees/${employeeId}/tasks`);
      const tasksData = await tasksRes.json();
      
      const timeRes = await fetch(`/api/employees/${employeeId}/time-entries?limit=1000`);
      const timeData = await timeRes.json();
      
      if (!tasksData.ok || !timeData.ok) {
        throw new Error('Failed to load data');
      }
      
      // Collect unique customers
      const customerMap = new Map();
      
      // From tasks
      if (tasksData.data?.tasks) {
        tasksData.data.tasks.forEach(task => {
          if (task.customer_id && task.customer) {
            const customerId = task.customer_id;
            if (!customerMap.has(customerId)) {
              customerMap.set(customerId, {
                customer: task.customer,
                tasks_count: 0,
                time_minutes: 0,
                tasks: []
              });
            }
            const customer = customerMap.get(customerId);
            customer.tasks_count += 1;
            customer.tasks.push(task);
          }
        });
      }
      
      // From time entries
      if (timeData.data?.time_entries) {
        timeData.data.time_entries.forEach(entry => {
          if (entry.customer_id && entry.customer) {
            const customerId = entry.customer_id;
            if (!customerMap.has(customerId)) {
              customerMap.set(customerId, {
                customer: entry.customer,
                tasks_count: 0,
                time_minutes: 0,
                tasks: []
              });
            }
            const customer = customerMap.get(customerId);
            customer.time_minutes += entry.duration_minutes || 0;
          }
        });
      }
      
      renderCustomers(Array.from(customerMap.values()));
    } catch (error) {
      console.error('Error loading customers:', error);
      document.getElementById('customersList').innerHTML = 
        '<div class="empty-state"><p>Fout bij laden klanten</p></div>';
    }
  }

  function renderCustomers(customers) {
    const container = document.getElementById('customersList');
    
    if (customers.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>Geen klanten</h3><p>Deze werknemer heeft nog geen klanten toegewezen gekregen.</p></div>';
      return;
    }

    container.innerHTML = customers.map(customerData => {
      const customer = customerData.customer;
      const hours = Math.floor(customerData.time_minutes / 60);
      const minutes = customerData.time_minutes % 60;
      const customerName = customer.company_name || customer.name || customer.email || 'Onbekend';
      
      return `
        <div class="task-item" style="cursor: pointer;" onclick="window.location.href='/admin/customers/${customer.id}'">
          <div class="task-item-content">
            <h4 class="task-item-title">${escapeHtml(customerName)}</h4>
            <div class="task-item-meta">
              ${customerData.tasks_count > 0 ? `<span><i class="fas fa-tasks"></i> ${customerData.tasks_count} taken</span>` : ''}
              ${customerData.time_minutes > 0 ? `<span><i class="fas fa-clock"></i> ${hours}u ${minutes}min</span>` : ''}
            </div>
          </div>
          <div class="task-item-actions">
            <a href="/admin/customers/${customer.id}" class="btn btn-primary btn-sm" onclick="event.stopPropagation();">
              Bekijk klant
            </a>
          </div>
        </div>
      `;
    }).join('');
  }

  // Time Entries
  async function loadTimeEntries() {
    try {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const url = `/api/employees/${employeeId}/time-entries?start_date=${currentWeekStart.toISOString()}&end_date=${weekEnd.toISOString()}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (!data.ok) throw new Error(data.error);
      
      // Also load week overview
      const weekRes = await fetch(`/api/employees/${employeeId}/time-entries/week?week_start=${currentWeekStart.toISOString()}`);
      const weekData = await weekRes.json();
      
      if (weekData.ok) {
        renderWeekTotals(weekData.data.totals || {});
      }
      
      renderTimeEntries(data.data.time_entries || []);
    } catch (error) {
      console.error('Error loading time entries:', error);
      document.getElementById('timeEntriesList').innerHTML = 
        '<div class="empty-state"><p>Fout bij laden urenregistraties</p></div>';
    }
  }

  function renderTimeEntries(entries) {
    const container = document.getElementById('timeEntriesList');
    
    if (entries.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>Geen urenregistraties</h3><p>Er zijn nog geen uren geregistreerd voor deze week.</p></div>';
      return;
    }

    container.innerHTML = entries.map(entry => `
      <div class="time-entry-item" data-entry-id="${entry.id}">
        <div class="time-entry-content">
          <h4 class="time-entry-date">${formatDateTime(entry.start_at)}</h4>
          <div class="time-entry-duration">${formatDuration(entry.duration_minutes || 0)}</div>
          ${entry.note ? `<p class="time-entry-note">${escapeHtml(entry.note)}</p>` : ''}
          ${entry.task ? `<p class="time-entry-note"><strong>Taak:</strong> ${escapeHtml(entry.task.title)}</p>` : ''}
        </div>
        <div class="time-entry-actions">
          <span class="time-entry-status-badge ${entry.status}">${getTimeEntryStatusLabel(entry.status)}</span>
          ${entry.status === 'submitted' && isAdmin ? `
            <button class="btn btn-success btn-sm" onclick="approveTimeEntry('${entry.id}')">Goedkeuren</button>
            <button class="btn btn-secondary btn-sm" onclick="rejectTimeEntry('${entry.id}')">Afwijzen</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  function renderWeekTotals(totals) {
    const totalHours = (totals.total?.hours || 0).toFixed(1);
    document.getElementById('totalHours').textContent = `${totalHours}h`;
  }

  // Salary/Payouts
  async function loadSalaryData() {
    try {
      // Load summary for quick stats
      const summaryRes = await fetch(`/api/employees/${employeeId}/summary`);
      const summaryData = await summaryRes.json();
      
      if (summaryData.ok && summaryData.data.quickCounts) {
        const unpaidBalanceEl = document.getElementById('unpaidBalance');
        if (unpaidBalanceEl) {
          unpaidBalanceEl.textContent = 
            formatCurrency(summaryData.data.quickCounts.unpaid_balance_cents || 0);
        }
      }

      // Load quick stats (next payout, remaining hours)
      await loadQuickStats();

      // Load payouts (if payoutsList exists - might be removed from main content)
      const payoutsList = document.getElementById('payoutsList');
      if (payoutsList) {
        const payoutsRes = await fetch(`/api/employees/${employeeId}/payouts`);
        const payoutsData = await payoutsRes.json();
        
        if (!payoutsData.ok) throw new Error(payoutsData.error);
        
        renderPayouts(payoutsData.data.payouts || []);
      }
    } catch (error) {
      console.error('Error loading salary data:', error);
      const payoutsList = document.getElementById('payoutsList');
      if (payoutsList) {
        payoutsList.innerHTML = 
          '<div class="empty-state"><p>Fout bij laden salarisgegevens</p></div>';
      }
    }
  }

  // Load quick stats for sidebar
  async function loadQuickStats() {
    try {
      const summaryRes = await fetch(`/api/employees/${employeeId}/summary`);
      const summaryData = await summaryRes.json();
      
      if (!summaryData.ok) return;
      
      const data = summaryData.data;
      
      // Next payout
      const nextPayoutEl = document.getElementById('nextPayoutDisplay');
      if (nextPayoutEl) {
        // Get next scheduled payout or calculate from unpaid balance
        const unpaidBalance = data.quickCounts?.unpaid_balance_cents || 0;
        if (unpaidBalance > 0) {
          nextPayoutEl.textContent = formatCurrency(unpaidBalance);
        } else {
          // Try to get next payout date from payouts
          const payoutsRes = await fetch(`/api/employees/${employeeId}/payouts`);
          const payoutsData = await payoutsRes.json();
          if (payoutsData.ok && payoutsData.data.payouts && payoutsData.data.payouts.length > 0) {
            const nextPayout = payoutsData.data.payouts.find(p => p.batch.status === 'approved' || p.batch.status === 'draft');
            if (nextPayout) {
              nextPayoutEl.textContent = formatCurrency(nextPayout.total_cents);
            } else {
              nextPayoutEl.textContent = '-';
            }
          } else {
            nextPayoutEl.textContent = '-';
          }
        }
      }
      
      // Remaining hours this month
      const remainingHoursEl = document.getElementById('remainingHoursDisplay');
      if (remainingHoursEl) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        // Get time entries for this month
        const timeRes = await fetch(`/api/employees/${employeeId}/time-entries?start_date=${monthStart.toISOString()}&end_date=${monthEnd.toISOString()}`);
        const timeData = await timeRes.json();
        
        if (timeData.ok && timeData.data.time_entries) {
          const totalMinutes = timeData.data.time_entries
            .filter(entry => entry.status === 'approved' || entry.status === 'submitted')
            .reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
          const totalHours = (totalMinutes / 60).toFixed(1);
          remainingHoursEl.textContent = `${totalHours}h`;
        } else {
          remainingHoursEl.textContent = '-';
        }
      }
    } catch (error) {
      console.error('Error loading quick stats:', error);
    }
  }

  function renderPayouts(payouts) {
    const container = document.getElementById('payoutsList');
    
    if (payouts.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>Geen uitbetalingen</h3><p>Er zijn nog geen uitbetalingen voor deze werknemer.</p></div>';
      return;
    }

    container.innerHTML = payouts.map(batch => `
      <div class="payout-item">
        <div class="payout-item-header">
          <div>
            <div class="payout-item-period">${formatDate(batch.batch.period_start)} - ${formatDate(batch.batch.period_end)}</div>
            <div class="payout-item-meta">Status: ${getPayoutStatusLabel(batch.batch.status)}</div>
          </div>
          <div class="payout-item-amount">${formatCurrency(batch.total_cents)}</div>
        </div>
        ${batch.batch.paid_at ? `<div class="payout-item-meta">Betaald op: ${formatDateTime(batch.batch.paid_at)}</div>` : ''}
        ${isAdmin && batch.batch.status === 'draft' ? `
          <div style="margin-top: 0.5rem;">
            <button class="btn btn-success btn-sm" onclick="approvePayout('${batch.batch.id}')">Goedkeuren</button>
          </div>
        ` : ''}
        ${isAdmin && batch.batch.status === 'approved' ? `
          <div style="margin-top: 0.5rem;">
            <button class="btn btn-primary btn-sm" onclick="markPayoutPaid('${batch.batch.id}')">Markeer als betaald</button>
          </div>
        ` : ''}
      </div>
    `).join('');
  }

  // Notes
  async function loadNotes() {
    try {
      const res = await fetch(`/api/employees/${employeeId}/notes`);
      const data = await res.json();
      
      if (!data.ok) {
        console.error('Notes API Error:', data.error);
        throw new Error(data.error);
      }
      
      const notes = data.data || [];
      renderNotes(notes);
    } catch (error) {
      console.error('Error loading notes:', error);
      const container = document.getElementById('notesList');
      if (container) {
        container.innerHTML = 
          '<div style="text-align: center; padding: 1rem; color: #dc2626; font-size: 0.875rem;">Fout bij laden notities: ' + error.message + '</div>';
      }
    }
  }

  function renderNotes(notes) {
    const container = document.getElementById('notesList');
    
    if (notes.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Geen notities</p></div>';
      return;
    }

    container.innerHTML = notes.map(note => `
      <div class="note-item">
        <div class="note-item-author">${note.created_by_profile ? 
          `${note.created_by_profile.first_name || ''} ${note.created_by_profile.last_name || ''}`.trim() || note.created_by_profile.email : 
          'Onbekend'}</div>
        <p class="note-item-text">${escapeHtml(note.note)}</p>
        <div class="note-item-date">${formatDateTime(note.created_at)}</div>
      </div>
    `).join('');
  }

  // Task Filter
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('filter-btn')) {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentTaskFilter = e.target.dataset.filter;
      loadTasks();
    }
  });

  // Week Navigation
  window.changeWeek = function(delta) {
    currentWeekStart = new Date(currentWeekStart);
    currentWeekStart.setDate(currentWeekStart.getDate() + (delta * 7));
    updateWeekDisplay();
    loadTimeEntries();
  };

  function updateWeekDisplay() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    document.getElementById('weekDisplay').textContent = 
      `${formatDate(currentWeekStart)} - ${formatDate(weekEnd)}`;
  }

  // Submit Week
  window.submitWeek = async function() {
    if (!confirm('Weet je zeker dat je deze week wilt indienen?')) return;
    
    try {
      const res = await fetch(`/api/employees/${employeeId}/time-entries/submit-week`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: currentWeekStart.toISOString() })
      });
      
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      
      alert('Week succesvol ingediend!');
      loadTimeEntries();
    } catch (error) {
      console.error('Error submitting week:', error);
      alert('Fout bij indienen week: ' + error.message);
    }
  };

  // Approve/Reject Actions
  window.approveTask = async function(taskId) {
    try {
      const res = await fetch(`/api/tasks/${taskId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadTasks();
    } catch (error) {
      console.error('Error approving task:', error);
      alert('Fout bij goedkeuren taak: ' + error.message);
    }
  };

  window.rejectTask = async function(taskId) {
    const reason = prompt('Reden voor afwijzing:');
    if (!reason) return;
    
    try {
      const res = await fetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadTasks();
    } catch (error) {
      console.error('Error rejecting task:', error);
      alert('Fout bij afwijzen taak: ' + error.message);
    }
  };

  window.approveTimeEntry = async function(entryId) {
    try {
      const res = await fetch(`/api/time-entries/${entryId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadTimeEntries();
    } catch (error) {
      console.error('Error approving time entry:', error);
      alert('Fout bij goedkeuren urenregistratie: ' + error.message);
    }
  };

  window.rejectTimeEntry = async function(entryId) {
    const reason = prompt('Reden voor afwijzing:');
    if (!reason) return;
    
    try {
      const res = await fetch(`/api/time-entries/${entryId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadTimeEntries();
    } catch (error) {
      console.error('Error rejecting time entry:', error);
      alert('Fout bij afwijzen urenregistratie: ' + error.message);
    }
  };

  window.updateTaskStatus = async function(taskId, status) {
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadTasks();
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Fout bij bijwerken taak: ' + error.message);
    }
  };

  // Notes Sidebar
  window.toggleNotesSidebar = function() {
    const sidebar = document.getElementById('notesSidebar');
    sidebar.classList.toggle('collapsed');
    const icon = document.getElementById('notesToggleIcon');
    icon.classList.toggle('fa-chevron-right');
    icon.classList.toggle('fa-chevron-left');
  };

  // Edit Mode functionality (similar to customer detail page)
  function initEditMode() {
    if (!employeeId) return;

    let isEditMode = false;
    let saveTimeout = null;
    const editBtn = document.getElementById('editEmployeeBtn');
    const employeeNameDisplay = document.getElementById('employeeNameDisplay');
    const originalData = {};
    const canEditEmployee = window.canEditEmployee !== false;

    // Check if user can edit (manager+)
    function checkCanEdit() {
      return canEditEmployee;
    }

    // Show confirmation modal
    function showConfirmModal(message, onConfirm) {
      return new Promise((resolve) => {
        if (confirm(message)) {
          if (onConfirm) onConfirm();
          resolve(true);
        } else {
          resolve(false);
        }
      });
    }

    // Toggle edit mode
    function toggleEditMode() {
      if (!checkCanEdit()) {
        window.showNotification?.('Alleen managers en admins kunnen werknemergegevens bewerken', 'error');
        return;
      }

      isEditMode = !isEditMode;
      
      if (isEditMode) {
        editBtn.innerHTML = '<i class="fas fa-save" style="font-size: 18px;"></i>';
        editBtn.style.color = '#10b981';
        enterEditMode();
      } else {
        editBtn.innerHTML = '<i class="fas fa-pencil-alt" style="font-size: 18px;"></i>';
        editBtn.style.color = '#9ca3af';
        exitEditMode();
      }
    }
    
    function enterEditMode() {
      // Make name editable
      if (employeeNameDisplay) {
        originalData.name = employeeNameDisplay.textContent.trim();
        originalData.first_name = employeeData.first_name || '';
        originalData.last_name = employeeData.last_name || '';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalData.name;
        input.className = 'user-info-name-new';
        input.style.border = '1px solid #d1d5db';
        input.style.borderRadius = '6px';
        input.style.padding = '4px 8px';
        input.style.width = '100%';
        input.id = 'employeeNameInput';
        input.addEventListener('input', debounceSave);
        employeeNameDisplay.replaceWith(input);
      }
      
      // Make contact fields editable (convert links to inputs)
      document.querySelectorAll('[data-field][data-edit-type="text"]').forEach(el => {
        const field = el.getAttribute('data-field');
        const text = el.textContent.trim();
        originalData[field] = text;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = text;
        input.className = el.className;
        input.style.border = '1px solid #d1d5db';
        input.style.borderRadius = '4px';
        input.style.padding = '2px 6px';
        input.style.flex = '1';
        input.style.width = '100%';
        input.dataset.field = field;
        input.addEventListener('input', debounceSave);
        el.replaceWith(input);
      });
      
      // Make status badge editable
      const statusBadge = document.getElementById('statusBadge');
      if (statusBadge) {
        originalData.employee_status = window.currentEmployeeStatus;
        const statusOptions = ['active', 'paused', 'inactive'];
        const select = document.createElement('select');
        select.id = 'statusSelect';
        select.style.border = '1px solid #d1d5db';
        select.style.borderRadius = '4px';
        select.style.padding = '4px 8px';
        select.style.fontSize = '0.8125rem';
        select.style.background = statusBadge.style.backgroundColor || '#10b98120';
        select.style.color = statusBadge.style.color || '#10b981';
        
        const statusLabels = {
          'active': 'Actief',
          'paused': 'Gepauzeerd',
          'inactive': 'Inactief'
        };
        
        statusOptions.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = statusLabels[opt] || opt;
          if (opt === window.currentEmployeeStatus) option.selected = true;
          select.appendChild(option);
        });
        select.addEventListener('change', debounceSave);
        statusBadge.replaceWith(select);
      }
      
      // Make "Sinds" editable (only for managers+)
      document.querySelectorAll('[data-field="created_at"]').forEach(el => {
        if (!checkCanEdit()) return;
        
        const isRestricted = el.getAttribute('data-restricted') === 'true';
        if (!isRestricted) return;
        
        const text = el.textContent.trim().replace('Sinds ', '');
        originalData.created_at = text;
        
        // Parse date and create date input
        const input = document.createElement('input');
        input.type = 'date';
        input.className = el.className;
        input.style.border = '1px solid #d1d5db';
        input.style.borderRadius = '4px';
        input.style.padding = '2px 6px';
        input.style.flex = '1';
        input.dataset.field = 'created_at';
        input.dataset.restricted = 'true';
        
        // Try to parse the date
        try {
          const date = new Date(text);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            input.value = `${year}-${month}-${day}`;
          }
        } catch (e) {
          console.error('Error parsing date:', e);
        }
        
        input.addEventListener('change', async () => {
          if (checkCanEdit()) {
            const confirmed = await showConfirmModal('Weet je zeker dat je de datum "Sinds" wilt aanpassen?');
            if (confirmed) {
              debounceSave();
            }
          }
        });
        
        el.replaceWith(input);
      });
    }
    
    function exitEditMode() {
      // Save changes when exiting edit mode (manual save)
      saveChanges(false);
    }
    
    // Debounce save function
    function debounceSave() {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      saveTimeout = setTimeout(() => {
        saveChanges(true); // true = auto-save, no confirmation
      }, 1000); // Save after 1 second of no changes
    }
    
    // Save changes (auto-save or manual)
    async function saveChanges(isAutoSave = false) {
      const updates = {};
      
      // Get name (split into first_name and last_name)
      const nameInput = document.getElementById('employeeNameInput');
      if (nameInput && nameInput.value !== originalData.name) {
        const nameParts = nameInput.value.trim().split(' ');
        updates.first_name = nameParts[0] || '';
        updates.last_name = nameParts.slice(1).join(' ') || '';
      }
      
      // Get contact fields
      document.querySelectorAll('input[data-field]').forEach(input => {
        const field = input.dataset.field;
        const isRestricted = input.dataset.restricted === 'true';
        
        if (input.value !== originalData[field]) {
          // For restricted fields, skip auto-save
          if (isRestricted && isAutoSave) return;
          updates[field] = input.value;
        }
      });
      
      // Get status
      const statusSelect = document.getElementById('statusSelect');
      if (statusSelect) {
        const statusValue = statusSelect.value;
        if (statusValue !== window.currentEmployeeStatus) {
          updates.employee_status = statusValue;
        }
      }
      
      if (Object.keys(updates).length > 0) {
        // Show confirmation for managers+ when manually saving
        if (!isAutoSave && checkCanEdit()) {
          const confirmed = await showConfirmModal('Weet je zeker dat je deze werknemergegevens wilt opslaan?');
          if (!confirmed) {
            // User cancelled, keep edit mode on
            isEditMode = true;
            editBtn.innerHTML = '<i class="fas fa-save" style="font-size: 18px;"></i>';
            editBtn.style.color = '#10b981';
            return;
          }
        }
        
        try {
          const response = await fetch(`/admin/api/employees/${employeeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(updates)
          });
          
          const data = await response.json();
          if (response.ok && data.success) {
            window.showNotification?.('Werknemer bijgewerkt', 'success');
            // Only reload if not auto-saving (auto-save keeps edit mode)
            if (!isAutoSave) {
              setTimeout(() => {
                location.reload();
              }, 500);
            } else {
              // Update originalData for auto-save
              Object.keys(updates).forEach(key => {
                const input = document.querySelector(`input[data-field="${key}"], select#${key}Select`);
                if (input) {
                  originalData[key] = input.value;
                }
              });
              if (updates.first_name || updates.last_name) {
                originalData.name = nameInput ? nameInput.value : originalData.name;
              }
              if (updates.employee_status) {
                window.currentEmployeeStatus = updates.employee_status;
              }
            }
          } else {
            throw new Error(data.error || 'Fout bij bijwerken');
          }
        } catch (error) {
          console.error('Error saving employee:', error);
          window.showNotification?.(error.message || 'Fout bij opslaan', 'error');
        }
      } else {
        // No changes, just exit edit mode
        if (!isAutoSave) {
          location.reload();
        }
      }
    }
    
    // Edit button
    if (editBtn) {
      editBtn.addEventListener('click', toggleEditMode);
    }
  }

  // Initialize edit mode
  initEditMode();

  window.toggleEmployeeStatus = async function() {
    const currentStatus = employeeData.employee_status || employeeData.status || 'active';
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    
    if (!confirm(`Werknemer ${newStatus === 'paused' ? 'pauzeren' : 'activeren'}?`)) return;
    
    try {
      const res = await fetch(`/api/employees/${employeeId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      location.reload();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Fout bij bijwerken status: ' + error.message);
    }
  };

  window.resendInvite = function() {
    alert('Uitnodiging opnieuw versturen (TODO)');
  };

  window.resetPassword = function() {
    alert('Wachtwoord resetten (TODO)');
  };

  window.assignManager = function() {
    alert('Manager toewijzen (TODO)');
  };

  window.openCreateTaskModal = function() {
    alert('Taak aanmaken modal (TODO)');
  };

  window.openCreateTimeEntryModal = function() {
    alert('Urenregistratie toevoegen modal (TODO)');
  };

  window.openPayoutModal = async function() {
    // Calculate earnings for current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    try {
      const res = await fetch(`/api/employees/${employeeId}/payouts/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_start: monthStart.toISOString(),
          period_end: monthEnd.toISOString()
        })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      
      const earnings = data.data;
      if (earnings.total_earnings_cents <= 0) {
        alert('Geen verdiensten voor deze periode.');
        return;
      }
      
      if (confirm(`Uitbetaling aanmaken voor ${formatCurrency(earnings.total_earnings_cents)}?`)) {
        // Create payout
        const createRes = await fetch(`/api/employees/${employeeId}/payouts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            period_start: monthStart.toISOString().split('T')[0],
            period_end: monthEnd.toISOString().split('T')[0]
          })
        });
        const createData = await createRes.json();
        if (!createData.ok) throw new Error(createData.error);
        
        alert('Uitbetaling aangemaakt!');
        loadSalaryData();
      }
    } catch (error) {
      console.error('Error creating payout:', error);
      alert('Fout bij aanmaken uitbetaling: ' + error.message);
    }
  };

  window.approvePayout = async function(batchId) {
    try {
      const res = await fetch(`/api/payouts/${batchId}/approve`, { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadSalaryData();
    } catch (error) {
      console.error('Error approving payout:', error);
      alert('Fout bij goedkeuren uitbetaling: ' + error.message);
    }
  };

  window.markPayoutPaid = async function(batchId) {
    if (!confirm('Uitbetaling markeren als betaald?')) return;
    
    try {
      const res = await fetch(`/api/payouts/${batchId}/paid`, { method: 'POST' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      loadSalaryData();
    } catch (error) {
      console.error('Error marking payout as paid:', error);
      alert('Fout bij markeren als betaald: ' + error.message);
    }
  };

  window.openCreateNoteModal = function() {
    const note = prompt('Notitie:');
    if (!note) return;
    
    fetch(`/api/employees/${employeeId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    })
    .then(res => res.json())
    .then(data => {
      if (data.ok) {
        loadNotes();
      } else {
        alert('Fout: ' + data.error);
      }
    })
    .catch(error => {
      console.error('Error creating note:', error);
      alert('Fout bij aanmaken notitie');
    });
  };

  window.openAllNotesModal = function() {
    // Load all notes and show in modal
    fetch(`/api/employees/${employeeId}/notes?all=true`)
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          const notes = data.data || [];
          const notesHtml = notes.map(note => `
            <div style="padding: 1rem; border-bottom: 1px solid #e5e7eb;">
              <div style="font-size: 0.75rem; color: #6b7280; margin-bottom: 0.5rem;">
                ${note.created_by_profile ? 
                  `${note.created_by_profile.first_name || ''} ${note.created_by_profile.last_name || ''}`.trim() || note.created_by_profile.email : 
                  'Onbekend'} • ${formatDateTime(note.created_at)}
              </div>
              <div>${escapeHtml(note.note)}</div>
            </div>
          `).join('');
          
          alert('Alle notities:\n\n' + notes.map(n => 
            `${formatDateTime(n.created_at)}: ${n.note}`
          ).join('\n\n'));
        }
      });
  };

  // Helper Functions
  function getWeekStart(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('nl-NL', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatCurrency(cents) {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2
    }).format((cents || 0) / 100);
  }

  function formatDuration(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}u ${mins}min`;
    }
    return `${mins}min`;
  }

  function getTaskStatusLabel(status) {
    const labels = {
      open: 'Open',
      in_progress: 'In uitvoering',
      in_review: 'In review',
      done: 'Afgerond',
      rejected: 'Afgewezen'
    };
    return labels[status] || status;
  }

  function getTimeEntryStatusLabel(status) {
    const labels = {
      draft: 'Concept',
      submitted: 'Ingediend',
      approved: 'Goedgekeurd',
      rejected: 'Afgewezen'
    };
    return labels[status] || status;
  }

  function getPayoutStatusLabel(status) {
    const labels = {
      draft: 'Concept',
      approved: 'Goedgekeurd',
      paid: 'Betaald'
    };
    return labels[status] || status;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function canViewNotes() {
    // Check if user is manager of this employee
    return employeeData.manager_id && employeeData.manager_id === (window.user?.id);
  }

  // Contract Upload Handler
  window.handleContractUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('contract', file);
    formData.append('employeeId', employeeId);
    
    const contractDisplay = document.getElementById('contractDisplay');
    const originalContent = contractDisplay.innerHTML;
    contractDisplay.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Uploaden...</div>';
    
    try {
      const res = await fetch(`/api/employees/${employeeId}/contract`, {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      
      if (data.ok) {
        // Update display with new UI
        const fileName = file.name;
        const displayFileName = fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName;
        contractDisplay.innerHTML = `
          <div style="position: relative; padding: 1.5rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            ${canEditSalary ? `
            <button onclick="showContractMenu(event)" class="contract-menu-btn" style="position: absolute; top: 0.75rem; right: 0.75rem; background: none; border: none; color: #6b7280; cursor: pointer; padding: 0.5rem; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#f3f4f6'; this.style.color='#374151';" onmouseout="this.style.background='none'; this.style.color='#6b7280';">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>
            ` : ''}
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <p id="contractFileName" style="margin: 0; font-size: 0.875rem; color: #374151; font-weight: 500; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(fileName)}">${escapeHtml(displayFileName)}</p>
            </div>
          </div>
        `;
        if (window.showNotification) {
          window.showNotification('Contract succesvol geüpload!', 'success');
        }
        // Update employee data
        employeeData.contract_document_url = data.url;
      } else {
        contractDisplay.innerHTML = originalContent;
        if (window.showNotification) {
          window.showNotification('Fout bij uploaden: ' + (data.error || 'Onbekende fout'), 'error');
        }
      }
    } catch (error) {
      contractDisplay.innerHTML = originalContent;
      console.error('Error uploading contract:', error);
      if (window.showNotification) {
        window.showNotification('Fout bij uploaden contract: ' + error.message, 'error');
      }
    }
    
    // Reset file input
    event.target.value = '';
  };

  // Open Contract File
  window.openContractFile = function() {
    const contractUrl = employeeData.contract_document_url;
    if (contractUrl) {
      window.open(contractUrl, '_blank');
    }
  };

  // Show Contract Menu (3 dots dropdown)
  window.showContractMenu = function(event) {
    event.stopPropagation();
    
    // Remove any existing dropdown
    const existingDropdown = document.querySelector('.contract-actions-dropdown');
    if (existingDropdown) {
      existingDropdown.remove();
      return;
    }
    
    const contractUrl = employeeData.contract_document_url;
    if (!contractUrl) return;
    
    // Create dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 'contract-actions-dropdown';
    dropdown.style.cssText = `
      position: fixed;
      background: white;
      border: 0.5px solid #e5e7eb;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      min-width: 180px;
      padding: 4px 0;
    `;
    
    // Get filename for display
    const fileName = contractUrl.split('/').pop() || 'contract';
    const decodedFileName = decodeURIComponent(fileName).replace(/%20/g, ' ');
    
    // Menu items
    const menuItems = [
      {
        label: 'Bekijken',
        icon: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
        action: () => {
          window.open(contractUrl, '_blank');
          dropdown.remove();
        }
      },
      {
        label: 'Downloaden',
        icon: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
        action: () => {
          const link = document.createElement('a');
          link.href = contractUrl;
          link.download = decodedFileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          dropdown.remove();
        }
      },
      {
        label: 'Vervangen',
        icon: 'M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
        action: () => {
          openReplaceContractModal();
          dropdown.remove();
        }
      }
    ];
    
    // Create menu items
    menuItems.forEach((item) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'contract-menu-item';
      menuItem.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        color: #374151;
        transition: background-color 0.15s;
      `;
      
      menuItem.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
          <path d="${item.icon}"/>
        </svg>
        ${item.label}
      `;
      
      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.backgroundColor = '#f9fafb';
      });
      
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = 'transparent';
      });
      
      menuItem.addEventListener('click', () => {
        item.action();
      });
      
      dropdown.appendChild(menuItem);
    });
    
    // Position dropdown
    const button = event.target.closest('.contract-menu-btn');
    const rect = button.getBoundingClientRect();
    dropdown.style.left = `${rect.right - 160}px`;
    dropdown.style.top = `${rect.bottom + 4}px`;
    
    // Add to document
    document.body.appendChild(dropdown);
    
    // Close dropdown when clicking outside
    const closeDropdown = (e) => {
      if (!dropdown.contains(e.target) && !button.contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeDropdown);
    }, 0);
  };

  // Contract Replace Modal Functions
  let selectedReplaceFile = null;

  window.openReplaceContractModal = function() {
    const modal = document.getElementById('contractReplaceModal');
    if (!modal) return;
    
    // Get current contract filename - use original name if available
    const contractUrl = employeeData.contract_document_url;
    if (contractUrl) {
      let fileName = '';
      if (employeeData.contract_document_name) {
        // Use original filename from database
        fileName = employeeData.contract_document_name;
      } else {
        // Fallback to extracting from URL
        fileName = contractUrl.split('/').pop() || 'contract';
        try {
          fileName = decodeURIComponent(fileName).replace(/%20/g, ' ');
        } catch (e) {
          // If decode fails, use as is
        }
      }
      document.getElementById('currentContractFileName').textContent = fileName;
    }
    
    // Reset file selection
    selectedReplaceFile = null;
    document.getElementById('contractReplaceUpload').value = '';
    document.getElementById('selectedFileDisplay').style.display = 'none';
    document.getElementById('replaceContractBtn').disabled = true;
    
    // Show modal
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    document.body.style.overflow = 'hidden';
    
    // Close modal when clicking outside
    const handleModalClick = (e) => {
      if (e.target === modal) {
        closeContractReplaceModal();
        modal.removeEventListener('click', handleModalClick);
      }
    };
    modal.addEventListener('click', handleModalClick);
  };

  window.closeContractReplaceModal = function() {
    const modal = document.getElementById('contractReplaceModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
    // Reset
    selectedReplaceFile = null;
    document.getElementById('contractReplaceUpload').value = '';
    document.getElementById('selectedFileDisplay').style.display = 'none';
    document.getElementById('replaceContractBtn').disabled = true;
  };

  window.handleContractReplaceFileSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      if (window.showNotification) {
        window.showNotification('Alleen PDF, DOC of DOCX bestanden zijn toegestaan', 'error');
      }
      event.target.value = '';
      return;
    }
    
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      if (window.showNotification) {
        window.showNotification('Bestand is te groot. Maximum 10MB toegestaan', 'error');
      }
      event.target.value = '';
      return;
    }
    
    selectedReplaceFile = file;
    document.getElementById('selectedFileName').textContent = file.name;
    document.getElementById('selectedFileDisplay').style.display = 'block';
    document.getElementById('replaceContractBtn').disabled = false;
  };

  window.clearSelectedFile = function() {
    selectedReplaceFile = null;
    document.getElementById('contractReplaceUpload').value = '';
    document.getElementById('selectedFileDisplay').style.display = 'none';
    document.getElementById('replaceContractBtn').disabled = true;
  };

  window.handleContractReplace = async function() {
    if (!selectedReplaceFile) {
      if (window.showNotification) {
        window.showNotification('Selecteer eerst een bestand', 'error');
      }
      return;
    }
    
    const formData = new FormData();
    formData.append('contract', selectedReplaceFile);
    formData.append('employeeId', employeeId);
    
    const replaceBtn = document.getElementById('replaceContractBtn');
    const originalText = replaceBtn.textContent;
    replaceBtn.disabled = true;
    replaceBtn.textContent = 'Vervangen...';
    
    try {
      const res = await fetch(`/api/employees/${employeeId}/contract`, {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      
      if (data.ok) {
        // Update display
        const fileName = data.filename || selectedReplaceFile.name;
        const displayFileName = fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName;
        const contractDisplay = document.getElementById('contractDisplay');
        contractDisplay.innerHTML = `
          <div style="position: relative; padding: 1.5rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            ${canEditSalary ? `
            <button onclick="showContractMenu(event)" class="contract-menu-btn" style="position: absolute; top: 0.75rem; right: 0.75rem; background: none; border: none; color: #6b7280; cursor: pointer; padding: 0.5rem; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10;" onmouseover="this.style.background='#f3f4f6'; this.style.color='#374151';" onmouseout="this.style.background='none'; this.style.color='#6b7280';">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>
            ` : ''}
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem; width: 100%;">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <p id="contractFileName" style="margin: 0; font-size: 0.875rem; color: #374151; font-weight: 500; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(fileName)}">${escapeHtml(displayFileName)}</p>
            </div>
          </div>
        `;
        
        if (window.showNotification) {
          window.showNotification('Contract succesvol vervangen!', 'success');
        }
        
        // Update employee data
        employeeData.contract_document_url = data.url;
        employeeData.contract_document_name = data.filename || selectedReplaceFile.name;
        
        // Close modal
        closeContractReplaceModal();
      } else {
        if (window.showNotification) {
          window.showNotification('Fout bij vervangen: ' + (data.error || 'Onbekende fout'), 'error');
        }
        replaceBtn.disabled = false;
        replaceBtn.textContent = originalText;
      }
    } catch (error) {
      console.error('Error replacing contract:', error);
      if (window.showNotification) {
        window.showNotification('Fout bij vervangen contract: ' + error.message, 'error');
      }
      replaceBtn.disabled = false;
      replaceBtn.textContent = originalText;
    }
  };

  // Delete Contract
  window.deleteContract = async function() {
    if (!confirm('Weet je zeker dat je dit contract wilt verwijderen?')) return;
    
    const contractDisplay = document.getElementById('contractDisplay');
    const originalContent = contractDisplay.innerHTML;
    contractDisplay.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Verwijderen...</div>';
    
    try {
      const res = await fetch(`/api/employees/${employeeId}/contract`, {
        method: 'DELETE'
      });
      
      const data = await res.json();
      
      if (data.ok) {
        // Update display with upload UI
        contractDisplay.innerHTML = `
          <label for="contractUpload" style="display: block; cursor: pointer;">
            <div style="padding: 2rem 1.5rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; transition: all 0.2s;" onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#d1d5db';" onmouseout="this.style.background='#f9fafb'; this.style.borderColor='#e5e7eb';">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #9ca3af;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <p style="margin: 0; font-size: 0.875rem; color: #6b7280; font-weight: 500;">Upload bestand</p>
            </div>
          </label>
          <input type="file" id="contractUpload" accept=".pdf,.doc,.docx" style="display: none;" onchange="handleContractUpload(event)">
        `;
        if (window.showNotification) {
          window.showNotification('Contract succesvol verwijderd', 'success');
        }
        employeeData.contract_document_url = null;
      } else {
        contractDisplay.innerHTML = originalContent;
        if (window.showNotification) {
          window.showNotification('Fout bij verwijderen: ' + (data.error || 'Onbekende fout'), 'error');
        }
      }
    } catch (error) {
      contractDisplay.innerHTML = originalContent;
      console.error('Error deleting contract:', error);
      if (window.showNotification) {
        window.showNotification('Fout bij verwijderen contract: ' + error.message, 'error');
      }
    }
  };

  // Edit Salary Modal
  let selectedScaleId = null;
  let selectedCustomRate = null;

  window.openEditSalaryModal = async function() {
    const modal = document.getElementById('salaryEditModal');
    if (!modal) return;
    
    const currentRate = employeeData.hourly_rate_cents || 0;
    const currentRateEuro = (currentRate / 100).toFixed(2);
    
    // Update current rate display
    document.getElementById('currentHourlyRateDisplay').textContent = formatCurrency(currentRate);
    
    // Show current scale if exists
    const currentScaleDisplay = document.getElementById('currentScaleDisplay');
    if (employeeData.payroll_scale) {
      currentScaleDisplay.textContent = `Huidige schaal: ${employeeData.payroll_scale.name}`;
      currentScaleDisplay.style.display = 'block';
    } else {
      currentScaleDisplay.style.display = 'none';
    }
    
    // Reset selections
    selectedScaleId = employeeData.payroll_scale_id || null;
    selectedCustomRate = null;
    document.getElementById('customHourlyRate').value = '';
    
    // Load scales
    await loadPayrollScales();
    
    // Show modal
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    document.body.style.overflow = 'hidden';
  };

  window.closeSalaryModal = function() {
    const modal = document.getElementById('salaryEditModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  };

  async function loadPayrollScales() {
    const scalesList = document.getElementById('scalesList');
    scalesList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;"><i class="fas fa-spinner fa-spin"></i> Laden...</div>';
    
    try {
      const res = await fetch('/api/payroll/scales');
      
      if (!res.ok) {
        // If response is not OK, try to get error message
        const text = await res.text();
        let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const json = JSON.parse(text);
          errorMsg = json.error || errorMsg;
        } catch (e) {
          // If it's HTML, show generic error
          if (text.includes('<!DOCTYPE')) {
            errorMsg = 'Server fout: Route niet gevonden. Controleer of de server correct draait.';
          }
        }
        throw new Error(errorMsg);
      }
      
      const data = await res.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Fout bij laden schalen');
      }
      
      const scales = data.data || [];
      
      if (scales.length === 0) {
        scalesList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Geen schalen beschikbaar</div>';
        return;
      }
      
      scalesList.innerHTML = scales.map(scale => {
        const isSelected = selectedScaleId === scale.id;
        const rateEuro = (scale.hourly_rate_cents / 100).toFixed(2);
        return `
          <div 
            class="scale-option ${isSelected ? 'selected' : ''}" 
            onclick="selectScale('${scale.id}', ${scale.hourly_rate_cents})"
            style="
              padding: 1rem; 
              border: 2px solid ${isSelected ? '#2563eb' : '#e5e7eb'}; 
              border-radius: 8px; 
              cursor: pointer; 
              background: ${isSelected ? '#eff6ff' : 'white'};
              transition: all 0.2s;
            "
            onmouseover="this.style.borderColor='${isSelected ? '#2563eb' : '#9ca3af'}'"
            onmouseout="this.style.borderColor='${isSelected ? '#2563eb' : '#e5e7eb'}'"
          >
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <p style="font-weight: 600; color: #111827; margin: 0 0 0.25rem 0; font-size: 1rem;">${escapeHtml(scale.name)}</p>
                ${scale.description ? `<p style="font-size: 0.875rem; color: #6b7280; margin: 0;">${escapeHtml(scale.description)}</p>` : ''}
              </div>
              <div style="text-align: right;">
                <p style="font-size: 1.25rem; font-weight: 700; color: #111827; margin: 0;">€${rateEuro}</p>
                <p style="font-size: 0.75rem; color: #6b7280; margin: 0;">/ uur</p>
              </div>
            </div>
            ${isSelected ? '<div style="margin-top: 0.5rem; color: #2563eb; font-size: 0.875rem;"><i class="fas fa-check-circle"></i> Geselecteerd</div>' : ''}
          </div>
        `;
      }).join('');
    } catch (error) {
      console.error('Error loading scales:', error);
      scalesList.innerHTML = `<div style="text-align: center; padding: 2rem; color: #dc2626;">Fout bij laden: ${error.message}</div>`;
    }
  }

  window.selectScale = function(scaleId, rateCents) {
    selectedScaleId = scaleId;
    selectedCustomRate = null;
    document.getElementById('customHourlyRate').value = '';
    
    // Reload scales to update UI
    loadPayrollScales();
  };

  window.updateCustomRate = function() {
    const customRateInput = document.getElementById('customHourlyRate');
    const value = parseFloat(customRateInput.value);
    
    if (!isNaN(value) && value > 0) {
      selectedCustomRate = Math.round(value * 100); // Convert to cents
      selectedScaleId = null; // Clear scale selection
      
      // Update scale options UI
      document.querySelectorAll('.scale-option').forEach(option => {
        option.classList.remove('selected');
        option.style.borderColor = '#e5e7eb';
        option.style.background = 'white';
      });
    } else {
      selectedCustomRate = null;
    }
  };

  window.saveSalary = async function() {
    const saveBtn = document.getElementById('saveSalaryBtn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Opslaan...';
    
    try {
      let body = {};
      
      if (selectedCustomRate !== null) {
        // Custom rate
        body.hourly_rate_cents = selectedCustomRate;
        body.payroll_scale_id = null;
      } else if (selectedScaleId) {
        // Scale selected
        body.payroll_scale_id = selectedScaleId;
      } else {
        alert('Selecteer een schaal of voer een handmatig uurtarief in.');
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
        return;
      }
      
      const res = await fetch(`/api/employees/${employeeId}/salary`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (data.ok) {
        // Update display
        const hourlyRateDisplay = document.getElementById('hourlyRateDisplay');
        hourlyRateDisplay.textContent = formatCurrency(data.hourly_rate_cents);
        employeeData.hourly_rate_cents = data.hourly_rate_cents;
        
        // Update monthly salary
        updateMonthlySalary();
        
        // Update monthly salary
        updateMonthlySalary();
        employeeData.payroll_scale_id = data.payroll_scale_id;
        employeeData.payroll_scale = data.payroll_scale;
        
        // Show success notification
        if (window.showNotification) {
          window.showNotification('Salaris succesvol bijgewerkt!', 'success');
        } else {
          alert('Salaris succesvol bijgewerkt!');
        }
        
        closeSalaryModal();
        
        // Reload page to show updated scale info
        setTimeout(() => location.reload(), 500);
      } else {
        alert('Fout bij bijwerken: ' + (data.error || 'Onbekende fout'));
      }
    } catch (error) {
      console.error('Error updating salary:', error);
      alert('Fout bij bijwerken salaris: ' + error.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText;
    }
  };

  // Close modal on backdrop click
  document.addEventListener('click', function(e) {
    const modal = document.getElementById('salaryEditModal');
    if (modal && e.target === modal) {
      closeSalaryModal();
    }
  });

  // Initialize week display
  updateWeekDisplay();
})();

