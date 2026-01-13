// Bulk actions functionality
// Global permissions object
let userPermissions = {
  is_admin: false,
  permissions: []
};

// Load user permissions on page load
async function loadUserPermissions() {
  try {
    const response = await fetch('/api/permissions');
    const result = await response.json();
    
    if (result.success) {
      userPermissions = {
        is_admin: result.is_admin,
        permissions: result.permissions
      };
      
      // Update UI based on permissions
      updateUIForPermissions();
    }
  } catch (error) {
    console.error('Error fetching permissions:', error);
  }
}

// Update UI elements based on user permissions
function updateUIForPermissions() {
  // Show/hide bulk actions based on permissions
  const bulkActions = document.querySelector('.bulk-actions');
  if (bulkActions) {
    if (userPermissions.permissions.includes('leads.bulk_delete')) {
      bulkActions.style.display = 'flex';
    } else {
      bulkActions.style.display = 'none';
    }
  }
  
  // Show/hide individual delete buttons
  const deleteButtons = document.querySelectorAll('.delete-btn');
  deleteButtons.forEach(btn => {
    if (userPermissions.permissions.includes('leads.delete')) {
      btn.style.display = 'inline-block';
    } else {
      btn.style.display = 'none';
    }
  });
  
  // Show/hide edit buttons
  const editButtons = document.querySelectorAll('.edit-btn');
  editButtons.forEach(btn => {
    if (userPermissions.permissions.includes('leads.update')) {
      btn.style.display = 'inline-block';
    } else {
      btn.style.display = 'none';
    }
  });
}

// Check if user has specific permission
function hasPermission(permission) {
  return userPermissions.permissions.includes(permission);
}

// Check if user is admin
function isAdmin() {
  return userPermissions.is_admin;
}

// Initialize permissions when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMContentLoaded event fired');
  
  // Load user permissions
  loadUserPermissions();

  // Add Request Modal functionality - will be initialized in DOMContentLoaded

  // Helper function to format date
  function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // Helper function to format time
  function formatTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  // Helper function to get status label
  function getStatusLabel(status) {
    switch(status) {
      case 'new':
        return 'Nieuw';
      case 'accepted':
        return 'Geaccepteerd';
      case 'rejected':
        return 'Afgewezen';
      case 'in_progress':
        return 'In behandeling';
      default:
        return 'Onbekend';
    }
  }

  // Helper function to get priority label
  function getPriorityLabel(priority) {
    switch(priority) {
      case 'low':
        return 'Laag';
      case 'medium':
        return 'Gemiddeld';
      case 'high':
        return 'Hoog';
      default:
        return 'Onbekend';
    }
  }

  // Minimal static avatars - no JavaScript needed

  // Helper function to add new lead to table
  function addLeadToTable(lead) {
    try {
      console.log('Adding lead to table:', lead);
      
      const tableBody = document.querySelector('.requests-table-body');
      if (!tableBody) {
        console.error('Table body not found for addLeadToTable');
        return;
      }

    const row = document.createElement('div');
    row.className = 'requests-row';
    row.setAttribute('data-id', lead.id);
    row.setAttribute('data-status', lead.status);
    row.setAttribute('data-priority', lead.priority || 'medium');
    row.setAttribute('data-industry', lead.industry_id || '');

    // Get industry info
    const industry = availableIndustries.find(ind => ind.id == lead.industry_id);
    const industryName = industry ? industry.name : 'Onbekend';

    row.innerHTML = `
      <div class="requests-cell checkbox-cell">
        <input type="checkbox" class="checkbox request-checkbox" data-id="${lead.id}">
      </div>
      <div class="requests-cell request-info-cell">
        <div class="request-details">
          <div class="lead-avatar" data-initials="${getInitials(lead.name)}">
            <i class="fas fa-user"></i>
          </div>
          <div class="request-info">
            <div class="request-company">${lead.name}</div>
            <div class="request-contact">${lead.phone || lead.email}</div>
          </div>
        </div>
      </div>
      <div class="requests-cell">
        <div class="industry-type" data-industry-id="${lead.industry_id || ''}">${industryName}</div>
      </div>
      <div class="requests-cell">
        <span class="status-badge ${lead.status}">
          ${getStatusLabel(lead.status)}
        </span>
      </div>
      <div class="requests-cell">
        <span class="priority-badge ${lead.priority || 'medium'}">
          ${getPriorityLabel(lead.priority || 'medium')}
        </span>
      </div>
      <div class="requests-cell">
        <div class="date-info">
          <div>${formatDate(lead.deadline)}</div>
          <div class="time-info">${formatTime(lead.deadline)}</div>
        </div>
      </div>
      <div class="requests-cell">
        <div class="date-info">
          <div>${formatDate(lead.created_at)}</div>
          <div class="time-info">${formatTime(lead.created_at)}</div>
        </div>
      </div>
      <div class="requests-cell">
        <div class="assigned-to">
          ${(() => {
            if (lead.assigned_to) {
              return `<span class="assigned-user">${lead.assigned_to}</span>`;
            } else if (lead.user_id) {
              const userName = getUserNameById(lead.user_id);
              return `<span class="assigned-user">${userName || 'Onbekende gebruiker'}</span>`;
            } else {
              return `<span class="not-assigned">Niet toegewezen</span>`;
            }
          })()}
        </div>
      </div>
      <div class="requests-cell actions-cell">
        <div class="action-buttons">
          ${lead.status !== 'accepted' ? `
            <button class="btn-icon view-request" data-id="${lead.id}" title="Bekijken">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn-icon accept-request" data-id="${lead.id}" title="Accepteren">
              <i class="fas fa-check"></i>
            </button>
            <button class="btn-icon reject-request" data-id="${lead.id}" title="Afwijzen">
              <i class="fas fa-times"></i>
            </button>
          ` : `
            <span class="status-locked" title="Geaccepteerde leads kunnen niet meer worden gewijzigd">
              <i class="fas fa-lock"></i>
            </span>
          `}
        </div>
      </div>
    `;

    // Add the new row at the top of the table
    tableBody.insertBefore(row, tableBody.firstChild);

    // Update total count
    const totalCount = document.getElementById('totalCount');
    if (totalCount) {
      const currentCount = parseInt(totalCount.textContent.match(/\d+/)[0]);
      totalCount.textContent = `Totaal: ${currentCount + 1} aanvragen`;
    }

    // Event listeners are now handled by event delegation, no need to add them individually

    // Add checkbox event listener
    const checkbox = row.querySelector('.request-checkbox');
    if (checkbox) {
      checkbox.addEventListener('change', function() {
        updateSelectedCount();
        
        // Update select all checkbox state
        const allCheckboxes = document.querySelectorAll('.request-checkbox');
        const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
        const someChecked = Array.from(allCheckboxes).some(cb => cb.checked);
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
          selectAllCheckbox.checked = allChecked;
          selectAllCheckbox.indeterminate = someChecked && !allChecked;
        }
      });
    }
    
    console.log('Successfully added lead to table');
  } catch (error) {
    console.error('Error in addLeadToTable:', error);
    console.error('AddLeadToTable error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      leadData: lead
    });
    
    // Don't show notification here as it might be confusing
    // The main error handler will show the appropriate message
    throw error; // Re-throw to be caught by the calling function
  }
}

  // Globale users cache
  let usersCache = [];
  let usersById = new Map();
  let isFetchingUsers = false; // Flag to prevent recursive calls
  let fetchUsersWaiters = [];

  // Helper functions for quota polling
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Wacht tot het quota van userId is bijgewerkt of tot timeout
  async function waitForQuotaUpdate(userId, { timeoutMs = 5000, intervalMs = 300 } = {}) {
    const start = Date.now();

    // baseline ophalen
    let baseline = null;
    try {
      const res = await fetch(`/api/users/${userId}/quota`, { credentials: 'include' });
      const js = await res.json();
      if (res.ok && js?.success) baseline = js.data; // {quota, used, remaining, canReceiveMore}
    } catch {}

    while (Date.now() - start < timeoutMs) {
      try {
        const r = await fetch(`/api/users/${userId}/quota`, { credentials: 'include', cache: 'no-store' });
        const j = await r.json();
        if (r.ok && j?.success) {
          if (!baseline) return j.data; // geen baseline, neem eerste hit
          // Als 'used' stijgt of 'remaining' daalt hebben we een update
          if (j.data.used !== baseline.used || j.data.remaining !== baseline.remaining) {
            return j.data;
          }
        }
      } catch {}
      await sleep(intervalMs);
    }
    return null; // timeout -> we verversen alsnog heel de userslijst
  }

  // --- Industry & Quota helpers ---
  function userHasIndustry(user, industryId) {
    if (!user || !industryId) return false;
    const ids = (user.industries || []).map(i => String(i.id ?? i.industry_id));
    return ids.includes(String(industryId));
  }

  // Huidige (geselecteerde) branche in het "Add Lead" formulier ophalen
  function getSelectedIndustryIdFromAddForm() {
    const el = document.querySelector('#addRequestForm [name="industry_id"]');
    return el && el.value ? el.value : null;
  }

  // ---- CENTRAL ASSIGNMENT VALIDATOR ----
  function validateAssignment({ user, industryId, quotaCheck = true }) {
    if (!user) return { ok: false, reason: 'user_not_found' };
    if (!industryId) return { ok: false, reason: 'no_industry' };

    // normalize id's naar string
    const want = String(industryId);
    const has = (user.industries || []).map(i => String(i.id ?? i.industry_id));
    if (!has.includes(want)) return { ok: false, reason: 'no_access_to_industry' };

    if (quotaCheck) {
      // Als quota-object ontbreekt of 0 → block
      if (!user.quota || user.quota.total === 0) return { ok: false, reason: 'no_subscription' };
      if (!user.quota.canReceiveLeads) return { ok: false, reason: 'quota_full' };
    }
    return { ok: true };
  }

  function showAssignmentError(reason, { industryId } = {}) {
    const industryName =
      (typeof availableIndustries !== 'undefined' &&
       availableIndustries.find(i => String(i.id) === String(industryId))?.name) || 'deze branche';

    const msgMap = {
      user_not_found: 'Geselecteerde gebruiker niet gevonden.',
      no_industry: 'Selecteer eerst een branche.',
      no_access_to_industry: `Deze gebruiker heeft géén toegang tot "${industryName}". Kies iemand anders.`,
      no_subscription: 'Gebruiker heeft geen actieve subscription.',
      quota_full: 'Gebruiker heeft geen beschikbare quota.',
      default: 'Toewijzen niet mogelijk.'
    };
    showNotification(msgMap[reason] || msgMap.default, 'error');
  }

  // Check authentication status
  function checkAuthStatus() {
    const cookies = document.cookie;
    
    // Check for various possible authentication cookies
    const hasAccessToken = cookies.includes('sb-access-token=');
    const hasRefreshToken = cookies.includes('sb-refresh-token=');
    const hasSessionCookie = cookies.includes('connect.sid=');
    const hasAuthCookie = cookies.includes('auth=');
    
    // Return true if any authentication method is found
    return hasAccessToken || hasRefreshToken || hasSessionCookie || hasAuthCookie;
  }

  // Handle authentication failure
  function handleAuthFailure(message = 'Je sessie is verlopen') {
    console.warn('Authentication failure:', message);
    
    // Show notification with options
    const notification = document.createElement('div');
    notification.className = 'notification notification--warning';
    notification.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span>${message}</span>
        <div style="display: flex; gap: 8px;">
          <button onclick="window.location.reload()" style="background: #ea5d0d; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
            Herlaad
          </button>
          <button onclick="window.location.href='/login?returnTo=' + encodeURIComponent(window.location.pathname)" style="background: #6b7280; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">
            Inloggen
          </button>
        </div>
      </div>
    `;
    
    // Add to notification container
    const container = document.querySelector('.notifications') || document.body;
    container.appendChild(notification);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 10000);
  }

  // Fetch users and populate searchable select
  window.fetchUsers = async function() {
    if (isFetchingUsers) {
      // Er draait al een fetch; wacht tot die klaar is
      return new Promise((resolve, reject) => {
        fetchUsersWaiters.push({ resolve, reject });
      });
    }
    
    isFetchingUsers = true;
    
    try {
      // Fetch users with quota information
      const response = await fetch(`/api/users?includeQuota=true&_=${Date.now()}`, {
        method: 'GET',
        credentials: 'include', // Include cookies for authentication
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
      
      // Check if we got redirected to login
      if (response.status === 302 || response.url.includes('/login')) {
        console.warn('Authentication required - redirecting to login');
        handleAuthFailure('Je sessie is verlopen. Log opnieuw in om verder te gaan.');
        return;
      }
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Je bent niet ingelogd. Log in om gebruikers op te halen.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const users = await response.json();
      usersCache = Array.isArray(users) ? users : [];
      
      // Populate user dropdown in add request modal
      populateUserDropdown();
      
      // Update assigned user data if needed (without causing flickering)
      // Only call this if we successfully fetched users (meaning we're authenticated)
      updateExistingLeadRows();

      // Resolve alle wachtenden
      fetchUsersWaiters.forEach(w => w.resolve(usersCache));
      fetchUsersWaiters = [];

      return usersCache;
    } catch (error) {
      console.error('Error fetching users:', error);
      console.error('FetchUsers error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      });
      
      // Check if it's a network error (connection refused)
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
        console.error('Network error detected in fetchUsers');
        showNotification('Kan geen verbinding maken met de server. Controleer je internetverbinding.', 'error');
      } else {
        console.error('General error in fetchUsers, showing generic message');
        showNotification('Er is een fout opgetreden bij het ophalen van de gebruikers', 'error');
      }

      fetchUsersWaiters.forEach(w => w.reject(error));
      fetchUsersWaiters = [];
      throw error;
    } finally {
      // Always reset the flag
      isFetchingUsers = false;
    }
  }



  // Helper om user naam op te zoeken
  async function ensureUsersCache() {
    if (!usersCache || usersCache.length === 0) {
      await fetchUsers();
    }
    if (!usersById || usersById.size === 0) {
      usersById = new Map(
        usersCache.map(u => {
          const key = String(u.id ?? u.uuid ?? u.user_id ?? u.auth_id ?? '');
          return [key, u];
        })
      );
    }
  }

  function getUserNameById(userId) {
    if (!userId) return null;
    const key = String(userId);
    const u = usersById.get(key);
    if (!u) return null;
    const full = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    return full || u.name || u.email || 'Onbekende gebruiker';
  }

  function syncLeadInUI(lead) {
    console.log('🔄 syncLeadInUI called for lead:', lead.id, 'assigned_to:', lead.assigned_to);
    
    // Update lead row (works with both old table structure and new card structure)
    const row = document.querySelector(`.requests-row[data-id="${lead.id}"], [data-lead-id="${lead.id}"]`);
    if (row) {
      console.log('✅ Found row for lead:', lead.id);
      // Be liberal in what we accept as the "assigned" cell
      const assignedToCell =
        row.querySelector('[data-col="assigned_to"]') ||
        row.querySelector('.assigned-to') ||
        row.querySelector('.assigned-cell');

      if (assignedToCell) {
        console.log('✅ Found assignedToCell for lead:', lead.id);
        if (lead.assigned_to) {
          const name = getUserNameById(lead.assigned_to) || String(lead.assigned_to);
          console.log('👤 Setting assigned user name:', name, 'for lead:', lead.id);
          assignedToCell.textContent = name;
          assignedToCell.className = 'text-xs text-gray-500 assigned-to';
        } else {
          console.log('❌ No assigned_to for lead:', lead.id);
          assignedToCell.textContent = 'Niet toegewezen';
          assignedToCell.className = 'text-xs text-gray-500 assigned-to';
        }
      } else {
        console.log('❌ No assignedToCell found for lead:', lead.id);
      }

      // Update status badge if it exists
      const statusBadges = row.querySelectorAll('[data-slot="badge"]');
      if (statusBadges.length > 0 && lead.status) {
        const statusLabel = getStatusLabel(lead.status);
        statusBadges[0].textContent = statusLabel;
      }
    }

    // Update the modal dropdown (if modal is open or next time it opens)
    const modal = document.getElementById('requestDetailModal');
    if (modal) {
      // Make sure the modal knows which lead it is
      modal.setAttribute('data-lead-id', lead.id);

      // Update assigned_to select
      const assignedSelect = modal.querySelector('select[name="assigned_to"]');
      if (assignedSelect) {
        assignedSelect.value = lead.assigned_to || '';
        // if value not present as an <option>, add it so it shows selected
        if (lead.assigned_to && !assignedSelect.querySelector(`option[value="${lead.assigned_to}"]`)) {
          const name = getUserNameById(lead.assigned_to) || lead.assigned_to;
          const opt = document.createElement('option');
          opt.value = lead.assigned_to;
          opt.textContent = name;
          assignedSelect.appendChild(opt);
          assignedSelect.value = lead.assigned_to;
        }
      }

      // (Optional) update other fields too if you keep modal open for any reason
      const industrySelect = modal.querySelector('select[name="industry_id"]');
      if (industrySelect && lead.industry_id != null) {
        industrySelect.value = String(lead.industry_id);
      }
      const budgetSelect = modal.querySelector('select[name="budget"]');
      if (budgetSelect && typeof lead.budget !== 'undefined') {
        budgetSelect.value = lead.budget || '';
      }
    }
  }

  // Function to populate searchable user dropdown in add request modal
  function populateUserDropdown() {
    const searchInput = document.getElementById('userSearchInput');
    const dropdownOptions = document.getElementById('userDropdownOptions');
    const hiddenInput = document.getElementById('requestAssignedTo');
    
    if (!searchInput || !dropdownOptions || !hiddenInput) {
      return;
    }
    
    // Clear existing options
    dropdownOptions.innerHTML = '';
    
    if (!usersCache.length) {
      const noResultsOption = document.createElement('div');
      noResultsOption.className = 'dropdown-option no-results';
      noResultsOption.textContent = 'Gebruikers worden geladen...';
      dropdownOptions.appendChild(noResultsOption);
      return;
    }
    
    // Add users to dropdown
    usersCache.forEach(user => {
      const option = document.createElement('div');
      option.className = 'dropdown-option';
      option.dataset.userId = user.id;
      
      // Add visual styling based on quota status
      // Check industry compatibility
      const selIndustryId = getSelectedIndustryIdFromAddForm();
      if (selIndustryId && !userHasIndustry(user, selIndustryId)) {
        option.classList.add("invalid-industry");
        option.setAttribute("aria-disabled", "true");
        option.setAttribute("title", "Geen toegang tot deze branche");
        // Hide invalid options when industry is selected
        if (selIndustryId) {
          option.style.display = 'none';
        }
      }      if (user.isPaused) {
        option.classList.add('quota-paused');
      } else if (user.quota && !user.quota.canReceiveLeads) {
        option.classList.add('no-quota');
      } else if (user.quota && user.quota.canReceiveLeads) {
        if (user.quota.remaining > user.quota.total * 0.5) {
          option.classList.add('quota-good');
        } else if (user.quota.remaining > user.quota.total * 0.2) {
          option.classList.add('quota-low');
        } else {
          option.classList.add('quota-critical');
        }
      }
      
      // Create two-column layout
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      const displayName = fullName ? `${fullName} (${user.email})` : user.email;
      
      // Create quota text
      let quotaText = '';
      if (user.isPaused) {
        quotaText = `⏸️ Aanvragen gepauzeerd`;
      } else if (user.quota) {
        console.log('User quota data:', {
          userId: user.id,
          total: user.quota.total,
          used: user.quota.used,
          remaining: user.quota.remaining,
          canReceiveLeads: user.quota.canReceiveLeads
        });
        
        if (user.quota.canReceiveLeads) {
          if (user.quota.remaining > user.quota.total * 0.5) {
            quotaText = `🟢 ${user.quota.remaining} van ${user.quota.total} leads beschikbaar`;
          } else if (user.quota.remaining > user.quota.total * 0.2) {
            quotaText = `🟡 ${user.quota.remaining} van ${user.quota.total} leads beschikbaar`;
          } else {
            quotaText = `🔴 ${user.quota.remaining} van ${user.quota.total} leads beschikbaar`;
          }
        } else {
          const used = user.quota.used ?? user.quota.usedAccepted ?? 0;
          const total = user.quota.total ?? 0;
          if (user.quota.remaining < 0) {
            // Over limit - show how much over
            const overLimit = Math.abs(user.quota.remaining);
            quotaText = `❌ ${overLimit} over limiet (${used}/${total})`;
          } else {
            quotaText = `❌ Quota bereikt (${used}/${total})`;
          }
        }
      } else {
        quotaText = `⚠️ Geen subscription`;
      }
      
      // Create branch text
      let branchText = '';
      if (user.industries && user.industries.length > 0) {
        const branchNames = user.industries.map(industry => industry.name).join(', ');
        branchText = `Actieve branches: ${branchNames}`;
      } else {
        branchText = 'Geen branches ingesteld';
      }
      
      // Create HTML structure
      option.innerHTML = `
        <div class="user-info">
          <div class="user-name">${displayName}</div>
          <div class="quota-info">${quotaText}</div>
        </div>
        <div class="branch-info">${branchText}</div>
      `;
      
      // Add click handler
      option.addEventListener('click', () => {
        const selIndustryId = getSelectedIndustryIdFromAddForm();
        const verdict = validateAssignment({
          user,
          industryId: selIndustryId ? parseInt(selIndustryId, 10) : null,
          quotaCheck: true
        });
        if (!verdict.ok) return showAssignmentError(verdict.reason, { industryId: selIndustryId });
        selectUser(user, option); // bestaande flow
      });
      
      dropdownOptions.appendChild(option);
    });
    
    // Initialize search functionality
    initializeSearchableDropdown();
  }

  // Function to populate searchable user dropdown in assign modal
  async function populateAssignUserDropdown(modal) {
    const searchInput = modal.querySelector('#assignUserSearchInput');
    const dropdownOptions = modal.querySelector('#assignUserDropdownOptions');
    const hiddenInput = modal.querySelector('#assignUserSelect');
    
    if (!searchInput || !dropdownOptions || !hiddenInput) {
      return;
    }
    
    // Clear existing options
    dropdownOptions.innerHTML = '';
    
    if (!usersCache.length) {
      const noResultsOption = document.createElement('div');
      noResultsOption.className = 'dropdown-option no-results';
      noResultsOption.textContent = 'Gebruikers worden geladen...';
      dropdownOptions.appendChild(noResultsOption);
      return;
    }
    
    // Add users to dropdown
    usersCache.forEach(user => {
      const option = document.createElement('div');
      option.className = 'dropdown-option';
      option.dataset.userId = user.id;
      
      // Add visual styling based on quota status
      if (user.isPaused) {
        option.classList.add('quota-paused');
      } else if (user.quota && !user.quota.canReceiveLeads) {
        option.classList.add('no-quota');
      } else if (user.quota && user.quota.canReceiveLeads) {
        if (user.quota.remaining > user.quota.total * 0.5) {
          option.classList.add('quota-good');
        } else if (user.quota.remaining > user.quota.total * 0.2) {
          option.classList.add('quota-low');
        } else {
          option.classList.add('quota-critical');
        }
      }
      
      // Create two-column layout
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      const displayName = fullName ? `${fullName} (${user.email})` : user.email;
      
      // Create quota text
      let quotaText = '';
      if (user.isPaused) {
        quotaText = `⏸️ Aanvragen gepauzeerd`;
      } else if (user.quota) {
        quotaText = `Quota: ${user.quota.used}/${user.quota.total} (${user.quota.remaining} over)`;
      } else {
        quotaText = 'Quota: Onbekend';
      }
      
      // Create branch text
      let branchText = '';
      if (user.industries && user.industries.length > 0) {
        const branchNames = user.industries.map(industry => industry.name).join(', ');
        branchText = `Actieve branches: ${branchNames}`;
      } else {
        branchText = 'Geen branches ingesteld';
      }
      
      // Create HTML structure
      option.innerHTML = `
        <div class="user-info">
          <div class="user-name">${displayName}</div>
          <div class="quota-info">${quotaText}</div>
        </div>
        <div class="branch-info">${branchText}</div>
      `;
      
      // Add click handler
      option.addEventListener('click', async () => {
        // Haal de leadId uit de modal context
        const leadId = modal.getAttribute('data-lead-id');
        let leadIndustryId = null;

        try {
          const leadResp = await fetch(`/api/leads/${leadId}`, { credentials: 'include' });
          if (leadResp.ok) {
            const leadData = await leadResp.json();
            const lead = leadData.data || leadData;
            leadIndustryId = lead?.industry_id ?? null;
          }
        } catch(_) {}

        const verdict = validateAssignment({
          user,
          industryId: leadIndustryId ? parseInt(leadIndustryId, 10) : null,
          quotaCheck: true
        });
        if (!verdict.ok) return showAssignmentError(verdict.reason, { industryId: leadIndustryId });

        selectAssignUser(user, option, modal);
      });
      
      dropdownOptions.appendChild(option);
    });
    
    // Initialize search functionality for assign modal
    initializeAssignSearchableDropdown(modal);
  }

  // Function to select user in assign modal
  function selectAssignUser(user, option, modal) {
    const searchInput = modal.querySelector('#assignUserSearchInput');
    const hiddenInput = modal.querySelector('#assignUserSelect');
    const dropdown = modal.querySelector('.searchable-dropdown');
    
    // Update input field
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const displayName = fullName ? `${fullName} (${user.email})` : user.email;
    searchInput.value = displayName;
    
    // Update hidden input
    hiddenInput.value = user.id;
    
    // Close dropdown
    dropdown.classList.remove('open');
    
    // Remove highlight from all options
    modal.querySelectorAll('.dropdown-option').forEach(opt => {
      opt.classList.remove('highlighted');
    });
    
    // Highlight selected option
    option.classList.add('highlighted');
  }

  // Function to initialize searchable dropdown functionality for assign modal
  function initializeAssignSearchableDropdown(modal) {
    const searchInput = modal.querySelector('#assignUserSearchInput');
    const dropdownOptions = modal.querySelector('#assignUserDropdownOptions');
    const dropdown = modal.querySelector('.searchable-dropdown');
    
    if (!searchInput || !dropdownOptions || !dropdown) {
      return;
    }
    
    // Prevent multiple initializations
    if (searchInput.dataset.initialized === 'true') {
      return;
    }
    searchInput.dataset.initialized = 'true';
    
    // Handle input focus/click
    searchInput.addEventListener('focus', () => {
      dropdown.classList.add('open');
      filterAssignOptions('', modal);
    });
    
    searchInput.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.add('open');
      filterAssignOptions('', modal);
    });
    
    // Handle input typing
    searchInput.addEventListener('input', (e) => {
      filterAssignOptions(e.target.value, modal);
    });
    
    // Handle keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      const options = dropdownOptions.querySelectorAll('.dropdown-option:not(.no-results)');
      const highlighted = dropdownOptions.querySelector('.dropdown-option.highlighted');
      let highlightedIndex = -1;
      
      if (highlighted) {
        highlightedIndex = Array.from(options).indexOf(highlighted);
      }
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          highlightedIndex = Math.min(highlightedIndex + 1, options.length - 1);
          highlightAssignOption(options[highlightedIndex]);
          break;
        case 'ArrowUp':
          e.preventDefault();
          highlightedIndex = Math.max(highlightedIndex - 1, 0);
          highlightAssignOption(options[highlightedIndex]);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlighted) {
            highlighted.click();
          }
          break;
        case 'Escape':
          dropdown.classList.remove('open');
          searchInput.blur();
          break;
      }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  // Function to filter options in assign modal
  function filterAssignOptions(searchTerm, modal) {
    const dropdownOptions = modal.querySelector('#assignUserDropdownOptions');
    const options = dropdownOptions.querySelectorAll('.dropdown-option:not(.no-results)');
    
    let visibleCount = 0;
    
    options.forEach(option => {
      const userInfo = option.querySelector('.user-name');
      const branchInfo = option.querySelector('.branch-info');
      
      if (!userInfo || !branchInfo) {
        option.style.display = 'none';
        return;
      }
      
      const userText = userInfo.textContent.toLowerCase();
      const branchText = branchInfo.textContent.toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      const matches = userText.includes(searchLower) || branchText.includes(searchLower);
      
      if (matches) {
        option.style.display = 'block';
        visibleCount++;
      } else {
        option.style.display = 'none';
      }
    });
    
    // Show/hide no results message
    const noResults = dropdownOptions.querySelector('.no-results');
    if (noResults) {
      noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }

  // Function to highlight option in assign modal
  function highlightAssignOption(option) {
    if (!option) return;
    
    // Remove highlight from all options
    const dropdownOptions = option.parentElement;
    dropdownOptions.querySelectorAll('.dropdown-option').forEach(opt => {
      opt.classList.remove('highlighted');
    });
    
    // Add highlight to selected option
    option.classList.add('highlighted');
    
    // Scroll into view
    option.scrollIntoView({ block: 'nearest' });
  }

  // Function to select user in detail modal
  function selectDetailUser(user, option) {
    const searchInput = document.getElementById('detailUserSearchInput');
    const hiddenInput = document.getElementById('detailAssignedTo');
    const dropdown = document.querySelector('#requestDetailModal .searchable-dropdown');
    
    // Update input field
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const displayName = fullName ? `${fullName} (${user.email})` : user.email;
    searchInput.value = displayName;
    
    // Update hidden input
    hiddenInput.value = user.id;
    
    // Close dropdown
    dropdown.classList.remove('open');
    
    // Remove highlight from all options
    const dropdownOptions = document.getElementById('detailUserDropdownOptions');
    dropdownOptions.querySelectorAll('.dropdown-option').forEach(opt => {
      opt.classList.remove('highlighted');
    });
    
    // Highlight selected option
    option.classList.add('highlighted');
  }

  // Function to initialize searchable dropdown functionality for detail modal
  function initializeDetailSearchableDropdown() {
    const searchInput = document.getElementById('detailUserSearchInput');
    const dropdownOptions = document.getElementById('detailUserDropdownOptions');
    const dropdown = document.querySelector('#requestDetailModal .searchable-dropdown');
    
    if (!searchInput || !dropdownOptions || !dropdown) {
      console.warn('Detail searchable dropdown elements not found');
      return;
    }
    
    // Reset initialization flag to allow re-initialization after cloning
    searchInput.dataset.initialized = 'false';
    
    // Prevent multiple initializations
    if (searchInput.dataset.initialized === 'true') {
      return;
    }
    searchInput.dataset.initialized = 'true';
    
    console.log('Initializing detail searchable dropdown');
    
    // Populate dropdown with users
    populateDetailUserDropdown();
    
    // Handle input focus/click
    searchInput.addEventListener('focus', () => {
      dropdown.classList.add('open');
      filterDetailOptions('');
    });
    
    searchInput.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.add('open');
      filterDetailOptions('');
    });
    
    // Handle clicking outside to close
    document.addEventListener('mousedown', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
    
    // Handle input typing
    searchInput.addEventListener('input', (e) => {
      filterDetailOptions(e.target.value);
    });
    
    // Handle keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      const options = dropdownOptions.querySelectorAll('.dropdown-option:not(.no-results)');
      const highlighted = dropdownOptions.querySelector('.dropdown-option.highlighted');
      let highlightedIndex = -1;
      
      if (highlighted) {
        highlightedIndex = Array.from(options).indexOf(highlighted);
      }
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          highlightedIndex = Math.min(highlightedIndex + 1, options.length - 1);
          highlightDetailOption(options[highlightedIndex]);
          break;
        case 'ArrowUp':
          e.preventDefault();
          highlightedIndex = Math.max(highlightedIndex - 1, 0);
          highlightDetailOption(options[highlightedIndex]);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlighted) {
            highlighted.click();
          }
          break;
        case 'Escape':
          dropdown.classList.remove('open');
          searchInput.blur();
          break;
      }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  // Function to populate detail user dropdown
  function populateDetailUserDropdown() {
    const dropdownOptions = document.getElementById('detailUserDropdownOptions');
    if (!dropdownOptions) return;
    
    dropdownOptions.innerHTML = '';
    
    // Check if users are loaded
    if (!usersCache || usersCache.length === 0) {
      console.log('Users not loaded yet, fetching users...');
      fetchUsers().then(() => {
        // Retry populating after users are loaded
        populateDetailUserDropdown();
      });
      return;
    }
    
    usersCache.forEach(user => {
      const option = document.createElement('div');
      option.className = 'dropdown-option';
      option.setAttribute('data-user-id', user.id);
      
      // Add quota status class
      if (user.isPaused) {
        option.classList.add('quota-paused');
      } else if (user.quota && !user.quota.canReceiveLeads) {
        option.classList.add('no-quota');
      } else if (user.quota && user.quota.canReceiveLeads) {
        if (user.quota.remaining > user.quota.total * 0.5) {
          option.classList.add('quota-good');
        } else if (user.quota.remaining > user.quota.total * 0.2) {
          option.classList.add('quota-low');
        } else {
          option.classList.add('quota-critical');
        }
      }

      // Add disabled state and click guard
      option.dataset.disabled = (user.isPaused || !user.quota?.canReceiveLeads) ? '1' : '0';
      if (option.dataset.disabled === '1') {
        option.classList.add('disabled'); // style: cursor: not-allowed; opacity: .6;
      }

      // Add click event listener
      option.addEventListener('click', (e) => {
        if (option.dataset.disabled === '1') {
          e.stopPropagation();
          e.preventDefault();
          showNotification(
            user.isPaused
              ? 'Deze gebruiker heeft aanvragen gepauzeerd.'
              : `Quota bereikt (${user.quota.used ?? user.quota.usedAccepted ?? 0}/${user.quota.total ?? 0}).`,
            'warning'
          );
          return;
        }
        // ... selecteer deze user ...
      });
      
      // Create user info
      const userInfo = document.createElement('div');
      userInfo.className = 'user-info';
      
      const userName = document.createElement('div');
      userName.className = 'user-name';
      userName.textContent = `${user.first_name} ${user.last_name} (${user.email})`;
      
      const quotaInfo = document.createElement('div');
      quotaInfo.className = 'quota-info';
      
      if (user.isPaused) {
        quotaInfo.textContent = '⏸️ Aanvragen gepauzeerd';
      } else if (user.quota) {
        if (user.quota.canReceiveLeads) {
          if (user.quota.remaining > user.quota.total * 0.5) {
            quotaInfo.textContent = `🟢 ${user.quota.remaining} van ${user.quota.total} leads beschikbaar`;
          } else if (user.quota.remaining > user.quota.total * 0.2) {
            quotaInfo.textContent = `🟡 ${user.quota.remaining} van ${user.quota.total} leads beschikbaar`;
          } else {
            quotaInfo.textContent = `🔴 ${user.quota.remaining} van ${user.quota.total} leads beschikbaar`;
          }
        } else {
          const used = user.quota.used ?? user.quota.usedAccepted ?? 0;
          const total = user.quota.total ?? 0;
          if (user.quota.remaining < 0) {
            // Over limit - show how much over
            const overLimit = Math.abs(user.quota.remaining);
            quotaInfo.textContent = `❌ ${overLimit} over limiet (${used}/${total})`;
          } else {
            quotaInfo.textContent = `❌ Quota bereikt (${used}/${total})`;
          }
        }
      } else {
        quotaInfo.textContent = `⚠️ Geen subscription`;
      }
      
      userInfo.appendChild(userName);
      userInfo.appendChild(quotaInfo);
      
      // Create branch info
      const branchInfo = document.createElement('div');
      branchInfo.className = 'branch-info';
      
      if (user.industries && user.industries.length > 0) {
        const industryNames = user.industries.map(ind => ind.name).join(', ');
        branchInfo.textContent = `Actieve branches: ${industryNames}`;
      } else {
        branchInfo.textContent = 'Geen branches ingesteld';
      }
      
      option.appendChild(userInfo);
      option.appendChild(branchInfo);
      
      // Add click handler
      option.addEventListener('click', () => {
        selectDetailUser(user, option);
      });
      
      dropdownOptions.appendChild(option);
    });
  }

  // Function to filter options in detail modal
  function filterDetailOptions(searchTerm) {
    const dropdownOptions = document.getElementById('detailUserDropdownOptions');
    const options = dropdownOptions.querySelectorAll('.dropdown-option:not(.no-results)');
    
    let visibleCount = 0;
    
    options.forEach(option => {
      const userInfo = option.querySelector('.user-name');
      
      if (!userInfo) {
        option.style.display = 'none';
        return;
      }
      
      const userText = userInfo.textContent.toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      const matches = userText.includes(searchLower);
      
      if (matches) {
        option.style.display = 'block';
        visibleCount++;
      } else {
        option.style.display = 'none';
      }
    });
    
    // Show/hide no results message
    let noResultsEl = dropdownOptions.querySelector('.no-results');
    if (visibleCount === 0 && searchTerm.length > 0) {
      if (!noResultsEl) {
        noResultsEl = document.createElement('div');
        noResultsEl.className = 'dropdown-option no-results';
        noResultsEl.textContent = 'Geen gebruikers gevonden';
        dropdownOptions.appendChild(noResultsEl);
      }
      noResultsEl.style.display = 'block';
    } else if (noResultsEl) {
      noResultsEl.style.display = 'none';
    }
  }

  // Function to highlight option in detail modal
  function highlightDetailOption(option) {
    if (!option) return;
    
    // Remove highlight from all options
    const dropdownOptions = option.parentElement;
    dropdownOptions.querySelectorAll('.dropdown-option').forEach(opt => {
      opt.classList.remove('highlighted');
    });
    
    // Add highlight to selected option
    option.classList.add('highlighted');
    
    // Scroll into view
    option.scrollIntoView({ block: 'nearest' });
  }

  // Function to select user in edit modal
  function selectEditUser(user, option, dropdownContainer, element) {
    const searchInput = dropdownContainer.querySelector('.edit-user-search-input');
    const hiddenInput = dropdownContainer.querySelector('.edit-user-hidden-input');
    const dropdown = dropdownContainer;
    
    // Update input field
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    const displayName = fullName ? `${fullName} (${user.email})` : user.email;
    searchInput.value = displayName;
    
    // Update hidden input
    hiddenInput.value = user.id;
    
    // Close dropdown
    dropdown.classList.remove('open');
    
    // Remove highlight from all options
    dropdownContainer.querySelectorAll('.dropdown-option').forEach(opt => {
      opt.classList.remove('highlighted');
    });
    
    // Highlight selected option
    option.classList.add('highlighted');
    
    // Update element attributes
    element.setAttribute('data-temp-value', user.id);
    element.setAttribute('data-temp-display', displayName);
  }

  // Function to initialize searchable dropdown functionality for edit modal
  function initializeEditSearchableDropdown(dropdownContainer, element) {
    const searchInput = dropdownContainer.querySelector('.edit-user-search-input');
    const dropdownOptions = dropdownContainer.querySelector('.edit-user-dropdown-options');
    const dropdown = dropdownContainer;
    
    if (!searchInput || !dropdownOptions || !dropdown) {
      return;
    }
    
    // Prevent multiple initializations
    if (searchInput.dataset.initialized === 'true') {
      return;
    }
    searchInput.dataset.initialized = 'true';
    
    // Handle input focus/click
    searchInput.addEventListener('focus', () => {
      dropdown.classList.add('open');
      filterEditOptions('', dropdownContainer);
    });
    
    searchInput.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.add('open');
      filterEditOptions('', dropdownContainer);
    });
    
    // Handle input typing
    searchInput.addEventListener('input', (e) => {
      filterEditOptions(e.target.value, dropdownContainer);
    });
    
    // Handle keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      const options = dropdownOptions.querySelectorAll('.dropdown-option:not(.no-results)');
      const highlighted = dropdownOptions.querySelector('.dropdown-option.highlighted');
      let highlightedIndex = -1;
      
      if (highlighted) {
        highlightedIndex = Array.from(options).indexOf(highlighted);
      }
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          highlightedIndex = Math.min(highlightedIndex + 1, options.length - 1);
          highlightEditOption(options[highlightedIndex]);
          break;
        case 'ArrowUp':
          e.preventDefault();
          highlightedIndex = Math.max(highlightedIndex - 1, 0);
          highlightEditOption(options[highlightedIndex]);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlighted) {
            highlighted.click();
          }
          break;
        case 'Escape':
          dropdown.classList.remove('open');
          searchInput.blur();
          break;
      }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  // Function to filter options in edit modal
  function filterEditOptions(searchTerm, dropdownContainer) {
    const dropdownOptions = dropdownContainer.querySelector('.edit-user-dropdown-options');
    const options = dropdownOptions.querySelectorAll('.dropdown-option:not(.no-results)');
    
    let visibleCount = 0;
    
    options.forEach(option => {
      const userInfo = option.querySelector('.user-name');
      
      if (!userInfo) {
        option.style.display = 'none';
        return;
      }
      
      const userText = userInfo.textContent.toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      const matches = userText.includes(searchLower);
      
      if (matches) {
        option.style.display = 'block';
        visibleCount++;
      } else {
        option.style.display = 'none';
      }
    });
    
    // Show/hide no results message
    const noResults = dropdownOptions.querySelector('.no-results');
    if (noResults) {
      noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }

  // Function to highlight option in edit modal
  function highlightEditOption(option) {
    if (!option) return;
    
    // Remove highlight from all options
    const dropdownOptions = option.parentElement;
    dropdownOptions.querySelectorAll('.dropdown-option').forEach(opt => {
      opt.classList.remove('highlighted');
    });
    
    // Add highlight to selected option
    option.classList.add('highlighted');
    
    // Scroll into view
    option.scrollIntoView({ block: 'nearest' });
  }

  // Function to initialize searchable dropdown for a specific modal
  function initSearchableDropdownForModal(modal) {
    const dropdowns = modal.querySelectorAll('.searchable-dropdown');
    dropdowns.forEach(dd => {
      const input = dd.querySelector('input, .search-input');
      const opts = dd.querySelector('.dropdown-options');
      if (!input || !opts) return;
      
      const open = () => {
        dd.classList.add('open');
        // Force visible for debugging
        opts.style.position = 'absolute';
        opts.style.top = '100%';
        opts.style.left = '0';
        opts.style.right = '0';
        opts.style.display = 'block';
        opts.style.opacity = '1';
        opts.style.visibility = 'visible';
        opts.style.zIndex = '1200';
        console.log('Dropdown forced visible, computed styles:', {
          display: getComputedStyle(opts).display,
          zIndex: getComputedStyle(opts).zIndex,
          position: getComputedStyle(opts).position
        });
      };
      const close = () => dd.classList.remove('open');
      
      input.addEventListener('focus', open);
      input.addEventListener('click', (e) => {
        e.stopPropagation();
        open();
      });
      
      document.addEventListener('mousedown', (e) => {
        if (!dd.contains(e.target)) close();
      });
    });
  }

  // Function to initialize searchable dropdown functionality
  function initializeSearchableDropdown() {
    const searchInput = document.getElementById('userSearchInput');
    const dropdownOptions = document.getElementById('userDropdownOptions');
    const dropdown = document.querySelector('.searchable-dropdown');
    
    console.log('initializeSearchableDropdown called', {
      searchInput: !!searchInput,
      dropdownOptions: !!dropdownOptions,
      dropdown: !!dropdown,
      initialized: searchInput?.dataset.initialized,
      searchInputId: searchInput?.id,
      dropdownOptionsId: dropdownOptions?.id,
      dropdownClass: dropdown?.className
    });
    
    if (!searchInput || !dropdownOptions || !dropdown) {
      console.warn('Missing elements for searchable dropdown initialization');
      return;
    }
    
    // Prevent multiple initializations
    if (searchInput.dataset.initialized === 'true') {
      console.log('Searchable dropdown already initialized, skipping');
      return;
    }
    searchInput.dataset.initialized = 'true';
    console.log('Initializing searchable dropdown');
    
    // Handle input focus/click
    searchInput.addEventListener('focus', () => {
      console.log('Search input focused, opening dropdown');
      dropdown.classList.add('open');
      const dropdownOptions = dropdown.querySelector('.dropdown-options');
      dropdownOptions.style.display = 'block';
      dropdownOptions.style.visibility = 'visible';
      dropdownOptions.style.opacity = '1';
      console.log('Dropdown classes after focus:', dropdown.className);
      console.log('Dropdown options display:', dropdownOptions.style.display);
      filterOptions('');
    });
    
    searchInput.addEventListener('click', (e) => {
      console.log('Search input clicked, opening dropdown');
      e.stopPropagation();
      dropdown.classList.add('open');
      const dropdownOptions = dropdown.querySelector('.dropdown-options');
      dropdownOptions.style.display = 'block';
      dropdownOptions.style.visibility = 'visible';
      dropdownOptions.style.opacity = '1';
      console.log('Dropdown classes after click:', dropdown.className);
      console.log('Dropdown options display:', dropdownOptions.style.display);
      filterOptions('');
    });
    
    // Handle clicking outside to close
    document.addEventListener('mousedown', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
        const dropdownOptions = dropdown.querySelector('.dropdown-options');
        if (dropdownOptions) {
          dropdownOptions.style.display = 'none';
          dropdownOptions.style.visibility = 'hidden';
          dropdownOptions.style.opacity = '0';
        }
      }
    });
    
    // Handle input typing
    searchInput.addEventListener('input', (e) => {
      filterOptions(e.target.value);
    });
    
    // Handle keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      const options = dropdownOptions.querySelectorAll('.dropdown-option:not(.no-results)');
      const highlighted = dropdownOptions.querySelector('.dropdown-option.highlighted');
      let highlightedIndex = -1;
      
      if (highlighted) {
        highlightedIndex = Array.from(options).indexOf(highlighted);
      }
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          highlightedIndex = Math.min(highlightedIndex + 1, options.length - 1);
          highlightOption(options[highlightedIndex]);
          break;
        case 'ArrowUp':
          e.preventDefault();
          highlightedIndex = Math.max(highlightedIndex - 1, 0);
          highlightOption(options[highlightedIndex]);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlighted) {
            highlighted.click();
          }
          break;
        case 'Escape':
          dropdown.classList.remove('open');
          searchInput.blur();
          break;
      }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  // Function to filter dropdown options based on search term
  function filterOptions(searchTerm) {
    const dropdownOptions = document.getElementById('userDropdownOptions');
    const options = dropdownOptions.querySelectorAll('.dropdown-option');
    
    console.log('filterOptions called', {
      searchTerm,
      dropdownOptions: !!dropdownOptions,
      optionsCount: options.length
    });
    
    if (!searchTerm.trim()) {
      // Show all options
      options.forEach(option => {
        if (!option.classList.contains('no-results')) {
          option.style.display = 'block';
        }
      });
      return;
    }
    
    const searchLower = searchTerm.toLowerCase();
    let hasResults = false;
    
    options.forEach(option => {
      if (option.classList.contains('no-results')) {
        option.style.display = 'none';
        return;
      }
      
      const text = option.textContent.toLowerCase();
      if (text.includes(searchLower)) {
        option.style.display = 'block';
        hasResults = true;
      } else {
        option.style.display = 'none';
      }
    });
    
    // Show "no results" message if no matches
    if (!hasResults) {
      const noResultsOption = document.createElement('div');
      noResultsOption.className = 'dropdown-option no-results';
      noResultsOption.textContent = 'Geen gebruikers gevonden';
      dropdownOptions.appendChild(noResultsOption);
    } else {
      // Remove any existing "no results" message
      const existingNoResults = dropdownOptions.querySelector('.no-results');
      if (existingNoResults) {
        existingNoResults.remove();
      }
    }
  }

  // Function to highlight an option
  function highlightOption(option) {
    const dropdownOptions = document.getElementById('userDropdownOptions');
    const allOptions = dropdownOptions.querySelectorAll('.dropdown-option');
    
    allOptions.forEach(opt => opt.classList.remove('highlighted'));
    if (option) {
      option.classList.add('highlighted');
    }
  }

  // Function to select a user
  function selectUser(user, optionElement) {
    const searchInput = document.getElementById('userSearchInput');
    const hiddenInput = document.getElementById('requestAssignedTo');
    const dropdown = document.querySelector('.searchable-dropdown');

    // Validation is now handled in the click handler via validateAssignment
    // This function just handles the UI selection logic
    
    // Update input field with selected user
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    let displayText;
    
    if (fullName) {
      displayText = `${fullName} (${user.email})`;
    } else {
      displayText = user.email;
    }
    
    // Add quota information if available
    if (user.quota) {
      if (user.quota.canReceiveLeads) {
        displayText += ` - ${user.quota.remaining}/${user.quota.total} quota`;
      } else {
        displayText += ` - GEEN QUOTA (${user.quota.used}/${user.quota.total})`;
      }
    } else {
      displayText += ` - GEEN SUBSCRIPTION`;
    }
    
    searchInput.value = displayText;
    
    // Update hidden input with user ID
    hiddenInput.value = user.id;
    
    // Mark option as selected
    const dropdownOptions = document.getElementById('userDropdownOptions');
    const allOptions = dropdownOptions.querySelectorAll('.dropdown-option');
    allOptions.forEach(opt => opt.classList.remove('selected'));
    optionElement.classList.add('selected');
    
    // Close dropdown
    dropdown.classList.remove('open');
  }

  // Function to reset searchable dropdown
  function resetSearchableDropdown() {
    const searchInput = document.getElementById('userSearchInput');
    const hiddenInput = document.getElementById('requestAssignedTo');
    const dropdown = document.querySelector('.searchable-dropdown');
    const dropdownOptions = document.getElementById('userDropdownOptions');
    
    if (searchInput) {
      searchInput.value = '';
    }
    
    if (hiddenInput) {
      hiddenInput.value = '';
    }
    
    if (dropdown) {
      dropdown.classList.remove('open');
    }
    
    if (dropdownOptions) {
      const allOptions = dropdownOptions.querySelectorAll('.dropdown-option');
      allOptions.forEach(opt => {
        opt.classList.remove('selected', 'highlighted');
        opt.style.display = 'block';
      });
    }
  }

  // Function to update existing lead rows with user assignments
  async function updateExistingLeadRows(showLoader = false) {
    try {
      if (showLoader) showSkeletonLoader();
      
      await ensureUsersCache();

      const response = await fetch('/api/', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const leads = await response.json();
      if (!Array.isArray(leads)) return;

      leads.forEach(syncLeadInUI);
      
      if (showLoader) hideSkeletonLoader();
    } catch (error) {
      console.error('Error updating lead rows:', error);
      if (showLoader) hideSkeletonLoader();
    }
  }

  // Fetch users when page loads and when modal opens
  fetchUsers(); // Fetch users immediately when page loads

  // Show/hide skeleton loader
  function showSkeletonLoader() {
    const skeletonLoader = document.getElementById('skeletonLoader');
    const tableRows = document.querySelectorAll('.requests-row');
    
    if (skeletonLoader) {
      skeletonLoader.classList.remove('skeleton-hidden');
    }
    
    // Hide existing table rows
    tableRows.forEach(row => {
      row.style.display = 'none';
    });
  }

  function hideSkeletonLoader() {
    const skeletonLoader = document.getElementById('skeletonLoader');
    const tableRows = document.querySelectorAll('.requests-row');
    
    if (skeletonLoader) {
      skeletonLoader.classList.add('skeleton-hidden');
    }
    
    // Show existing table rows
    tableRows.forEach(row => {
      row.style.display = '';
    });
  }

  // Hydrate UI after page load to show correct assignments
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      showSkeletonLoader();             // Show loading skeleton
      await ensureUsersCache();         // laad usersCache + usersById
      await refreshLeadsUIFromServer(); // haal leads op en zet namen in de tabel
      hideSkeletonLoader();             // Hide loading skeleton
    } catch (e) {
      console.error('Init error:', e);
      hideSkeletonLoader();             // Hide skeleton even on error
    }
  });

  async function refreshLeadsUIFromServer() {
    try {
      console.log('🔄 Refreshing leads UI from server...');
      const res = await fetch('/api/?fields=id,name,assigned_to,industry_id,budget,status,created_at', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const leads = await res.json();
      console.log('📊 Leads received:', leads.length, 'leads');
      if (Array.isArray(leads)) {
        leads.forEach(lead => {
          console.log('🔄 Syncing lead:', lead.id, 'assigned_to:', lead.assigned_to);
          syncLeadInUI(lead);
        });
      }
    } catch (error) {
      console.error('Error refreshing leads UI from server:', error);
    }
  }
  

  
  // Minimal static avatars - no updates needed

  // Accept lead
  async function acceptLead(leadId) {
    try {
      // Show confirmation modal for accept action
      showAcceptConfirmationModal([leadId]);
      return; // Don't proceed with the API call yet
    } catch (error) {
      console.error('Error accepting lead:', error);
      showNotification('Er is een fout opgetreden bij het accepteren van het lead', 'error');
    }
  }

  // Reject lead
  async function rejectLead(leadId) {
    try {
      
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'rejected' })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        showNotification('Lead succesvol afgewezen!', 'success');
        setLeadStatusUI(leadId, 'rejected');
      } else {
        throw new Error(result.error || 'Er is een fout opgetreden');
      }
    } catch (error) {
      console.error('Error rejecting lead:', error);
      showNotification('Er is een fout opgetreden bij het afwijzen van het lead', 'error');
    }
  }

  // Assign lead
  async function assignLead(leadId) {
    
    // Find the lead row
    const leadRow = document.querySelector(`.requests-row[data-id="${leadId}"]`);
    if (!leadRow) {
      console.error('Lead row not found for ID:', leadId);
      return;
    }

    // Get current assigned user
    const assignedToCell = leadRow.querySelector('.assigned-to');
    const currentUser = assignedToCell ? assignedToCell.textContent.trim() : 'Niet toegewezen';

    // Create assign modal
    const assignModal = await createAssignModal(leadId, currentUser);
    document.body.appendChild(assignModal);
    
    // Show modal
    assignModal.style.display = 'flex';
  }

  // Show lead actions menu (similar to showUserActionsMenu)
  function showLeadActions(leadId, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    // Remove any existing dropdown
    const existingDropdown = document.querySelector('.actions-dropdown');
    if (existingDropdown) {
      existingDropdown.remove();
      return; // Exit early if we just closed a dropdown
    }

    // Find lead data - check multiple selectors
    const leadRow = document.querySelector(`[data-lead-id="${leadId}"]`) || 
                    document.querySelector(`.requests-row[data-id="${leadId}"]`) ||
                    document.querySelector(`tr[data-lead-id="${leadId}"]`) ||
                    document.querySelector(`.table-body-row[data-lead-id="${leadId}"]`);
    if (!leadRow) {
      console.error('Lead row not found for ID:', leadId);
      console.log('Available lead rows:', document.querySelectorAll('[data-lead-id]').length);
      return;
    }

    // Get lead status - check for status badge in the row
    const statusBadge = leadRow.querySelector('.status-badge') || leadRow.querySelector('[data-slot="badge"]');
    const statusText = statusBadge ? statusBadge.textContent.trim().toLowerCase() : 'new';
    // Map Dutch status labels to English status values
    let status = 'new';
    if (statusText.includes('geaccepteerd') || statusText.includes('accepted')) {
      status = 'accepted';
    } else if (statusText.includes('afgewezen') || statusText.includes('rejected')) {
      status = 'rejected';
    } else if (statusText.includes('in behandeling') || statusText.includes('in_progress')) {
      status = 'in_progress';
    } else {
      status = 'new';
    }

    // Create dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 'actions-dropdown';
    dropdown.style.cssText = `
      position: fixed;
      background: white;
      border: 0.5px solid #e5e7eb;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      min-width: 200px;
      padding: 4px 0;
    `;

    // Add menu items
    const menuItems = [];
    
    // Add "Bekijk details" as first item
    menuItems.push({
      label: 'Bekijk details',
      icon: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
      action: () => {
        if (typeof viewLeadDetailsModal === 'function') {
          viewLeadDetailsModal(leadId);
        } else {
          console.warn('viewLeadDetailsModal function not found');
        }
        dropdown.remove();
      }
    });
    
    // Add "Bekijk toewijzing" as second item
    menuItems.push({
      label: 'Bekijk toewijzing',
      icon: 'M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h-2a5 5 0 0 0-5-5h-1v1.27c.6.34 1 .99 1 1.73a2 2 0 1 1-4 0c0-.74.4-1.39 1-1.73V9h-1a5 5 0 0 0-5 5H3a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z',
      action: () => {
        if (typeof openAiAssignmentDrawer === 'function') {
          openAiAssignmentDrawer(leadId);
        } else {
          console.warn('openAiAssignmentDrawer function not found');
        }
        dropdown.remove();
      }
    });
    
    // Add divider after first items
    menuItems.push({ divider: true });
    
    if (status !== 'accepted') {
      menuItems.push({
        label: 'Accepteren',
        icon: 'M9 12l2 2 4-4 M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z',
        action: () => {
          acceptLead(leadId);
          dropdown.remove();
        }
      });
    }

    if (status !== 'rejected') {
      menuItems.push({
        label: 'Afwijzen',
        icon: 'M18 6L6 18M6 6l12 12',
        action: () => {
          rejectLead(leadId);
          dropdown.remove();
        }
      });
    }

    menuItems.push({
      label: 'Toewijzen',
      icon: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z',
      action: () => {
        assignLead(leadId);
        dropdown.remove();
      }
    });

    menuItems.push({
      label: 'Verwijderen',
      icon: 'M3 6h18 M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6 M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2',
      action: () => {
        deleteLead(leadId);
        dropdown.remove();
      },
      danger: true
    });

    // Create menu items
    menuItems.forEach((item, index) => {
      // Handle divider
      if (item.divider) {
        const separator = document.createElement('div');
        separator.className = 'dropdown-divider';
        separator.style.cssText = 'height: 1px; background: #e5e7eb; margin: 4px 0;';
        dropdown.appendChild(separator);
        return;
      }

      if (index > 0 && item.danger) {
        // Add separator before danger item
        const separator = document.createElement('div');
        separator.style.cssText = 'border-top: 1px solid #e5e7eb; margin: 4px 0;';
        dropdown.appendChild(separator);
      }

      const menuItem = document.createElement('div');
      menuItem.className = 'actions-menu-item';
      menuItem.style.cssText = `
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        color: ${item.danger ? '#dc2626' : '#374151'};
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
        dropdown.remove();
      });

      dropdown.appendChild(menuItem);
    });

    // Position dropdown - match payments dropdown positioning exactly
    const button = event ? event.target.closest('.actions-button') : null;
    if (button) {
      const rect = button.getBoundingClientRect();
      dropdown.style.left = `${rect.left - 150}px`;
      dropdown.style.top = `${rect.bottom + 4}px`;
    } else {
      // Fallback positioning
      dropdown.style.left = '50%';
      dropdown.style.top = '50%';
      dropdown.style.transform = 'translate(-50%, -50%)';
    }

    // Add to document
    document.body.appendChild(dropdown);

    // Close dropdown when clicking outside
    const closeDropdown = (e) => {
      if (!dropdown.contains(e.target) && (!button || !button.contains(e.target))) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    };

    setTimeout(() => {
      document.addEventListener('click', closeDropdown);
    }, 0);
  }

  // Make function globally available
  window.showLeadActions = showLeadActions;

  // Function to view lead details in a read-only modal
  async function viewLeadDetailsModal(leadId) {
    if (!leadId) {
      console.error('viewLeadDetailsModal called with undefined leadId');
      showNotification('Lead ID is niet geldig', 'error');
      return;
    }

    const modal = document.getElementById('leadDetailsViewModal');
    const modalBody = document.getElementById('leadDetailsModalBody');
    
    if (!modal || !modalBody) {
      console.error('Modal elements not found');
      return;
    }

    // Show loading state
    modalBody.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <div style="color: #6b7280;">Laden...</div>
      </div>
    `;
    modal.classList.add('show');
    document.body.classList.add('modal-open');

    try {
      // Fetch lead details from the server
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const lead = await response.json();

      if (!lead || !lead.id) {
        throw new Error('Invalid lead data received');
      }

      // Format dates
      const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('nl-NL', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      };

      // Get status label
      const getStatusLabel = (status) => {
        switch(status) {
          case 'new': return 'Nieuw';
          case 'accepted': return 'Geaccepteerd';
          case 'rejected': return 'Afgewezen';
          case 'in_progress': return 'In behandeling';
          case 'completed': return 'Voltooid';
          default: return status || 'Onbekend';
        }
      };

      // Get priority label
      const getPriorityLabel = (priority) => {
        switch(priority) {
          case 'low': return 'Laag';
          case 'medium': return 'Gemiddeld';
          case 'high': return 'Hoog';
          default: return priority || 'Onbekend';
        }
      };

      // Get industry name
      let industryName = '-';
      if (lead.industry_name) {
        industryName = lead.industry_name;
      } else if (lead.industry && lead.industry.name) {
        industryName = lead.industry.name;
      } else if (lead.industry_id === 1) {
        industryName = 'Dakdekkers';
      } else if (lead.industry_id === 2) {
        industryName = 'Schilders';
      }

      // Get budget label
      const getBudgetLabel = (budget) => {
        if (!budget) return '-';
        switch(budget) {
          case 'under_5k': return 'Onder €5.000';
          case '5k_10k': return '€5.000 - €10.000';
          case '10k_25k': return '€10.000 - €25.000';
          case '25k_50k': return '€25.000 - €50.000';
          case 'over_50k': return 'Boven €50.000';
          default: return budget;
        }
      };

      // Status badge class
      let statusBadgeClass = 'status-badge ';
      if (lead.status === 'accepted') {
        statusBadgeClass += 'status-paid';
      } else if (lead.status === 'rejected') {
        statusBadgeClass += 'status-failed';
      } else if (lead.status === 'in_progress') {
        statusBadgeClass += 'status-pending';
      } else {
        statusBadgeClass += 'status-new';
      }

      // Priority badge class
      let priorityBadgeClass = 'status-badge ';
      if (lead.priority === 'high') {
        priorityBadgeClass += 'status-failed';
      } else {
        priorityBadgeClass += 'status-pending';
      }

      // Render lead details
      modalBody.innerHTML = `
        <div style="display: grid; gap: 24px;">
          <!-- Header Section -->
          <div style="display: flex; justify-content: space-between; align-items: start; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
            <div>
              <h2 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #111827;">${lead.name || '-'}</h2>
              <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                <span class="${statusBadgeClass}">${getStatusLabel(lead.status)}</span>
                <span class="${priorityBadgeClass}">${getPriorityLabel(lead.priority)}</span>
              </div>
            </div>
          </div>

          <!-- Details Grid -->
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px;">
            <!-- Contact Information -->
            <div>
              <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">Contactgegevens</h3>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div>
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Naam</div>
                  <div style="font-size: 14px; color: #111827;">${lead.name || '-'}</div>
                </div>
                <div>
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">E-mail</div>
                  <div style="font-size: 14px; color: #111827;">
                    ${lead.email ? `<a href="mailto:${lead.email}" style="color: #ea5d0d; text-decoration: none;">${lead.email}</a>` : '-'}
                  </div>
                </div>
                <div>
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Telefoon</div>
                  <div style="font-size: 14px; color: #111827;">
                    ${lead.phone ? `<a href="tel:${lead.phone}" style="color: #ea5d0d; text-decoration: none;">${lead.phone}</a>` : '-'}
                  </div>
                </div>
              </div>
            </div>

            <!-- Lead Information -->
            <div>
              <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">Lead Informatie</h3>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div>
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Branche</div>
                  <div style="font-size: 14px; color: #111827;">${industryName}</div>
                </div>
                <div>
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Budget</div>
                  <div style="font-size: 14px; color: #111827;">${getBudgetLabel(lead.budget)}</div>
                </div>
                <div>
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Toegewezen aan</div>
                  <div style="font-size: 14px; color: #111827;">${lead.assigned_to || lead.assigned_user ? (lead.assigned_to || `${lead.assigned_user?.first_name || ''} ${lead.assigned_user?.last_name || ''}`.trim() || '-') : 'Niet toegewezen'}</div>
                </div>
                <div>
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Deadline</div>
                  <div style="font-size: 14px; color: #111827;">${lead.deadline ? formatDate(lead.deadline) : '-'}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Message Section -->
          ${lead.message ? `
            <div>
              <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">Bericht</h3>
              <div style="padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                <div style="font-size: 14px; color: #374151; white-space: pre-wrap; line-height: 1.6;">${lead.message}</div>
              </div>
            </div>
          ` : ''}

          <!-- Metadata Section -->
          <div style="padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">Metadata</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <div>
                <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Aangemaakt op</div>
                <div style="font-size: 14px; color: #111827;">${lead.created_at ? formatDate(lead.created_at) : '-'}</div>
              </div>
              ${lead.approved_at ? `
                <div>
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Goedgekeurd op</div>
                  <div style="font-size: 14px; color: #111827;">${formatDate(lead.approved_at)}</div>
                </div>
              ` : ''}
              ${lead.price_at_purchase ? `
                <div>
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Prijs bij aankoop</div>
                  <div style="font-size: 14px; color: #111827;">€${parseFloat(lead.price_at_purchase).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              ` : ''}
              ${lead.province ? `
                <div>
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Provincie</div>
                  <div style="font-size: 14px; color: #111827;">${lead.province}</div>
                </div>
              ` : ''}
              ${lead.postcode ? `
                <div>
                  <div style="font-size: 12px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Postcode</div>
                  <div style="font-size: 14px; color: #111827;">${lead.postcode}</div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error fetching lead details:', error);
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <div style="color: #dc2626; margin-bottom: 16px;">Er is een fout opgetreden bij het ophalen van de lead details</div>
          <button class="btn btn-outline" onclick="closeLeadDetailsModal()">Sluiten</button>
        </div>
      `;
    }
  }

  // Function to close the lead details modal
  function closeLeadDetailsModal() {
    const modal = document.getElementById('leadDetailsViewModal');
    if (modal) {
      modal.classList.remove('show');
      document.body.classList.remove('modal-open');
    }
  }

  // Close modal when clicking outside or pressing Escape
  document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('leadDetailsViewModal');
    if (modal) {
      // Close when clicking outside
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          closeLeadDetailsModal();
        }
      });
      
      // Close when pressing Escape
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
          closeLeadDetailsModal();
        }
      });
    }
  });

  // Make functions globally available
  window.viewLeadDetailsModal = viewLeadDetailsModal;
  window.closeLeadDetailsModal = closeLeadDetailsModal;

  // Delete lead
  function deleteLead(leadId) {
    
    // Find the lead row to get lead name
    const leadRow = document.querySelector(`.requests-row[data-id="${leadId}"], [data-lead-id="${leadId}"]`);
    const leadName = leadRow ? (leadRow.querySelector('.user-email')?.textContent || 'Unknown') : 'Unknown';
    
    // Create confirmation modal
    const confirmModal = createDeleteConfirmModal(leadId, leadName);
    document.body.appendChild(confirmModal);
    
    // Show modal
    confirmModal.style.display = 'flex';
  }

  // Update lead status in UI
  function updateLeadStatus(leadId, status) {
    const leadRow = document.querySelector(`.requests-row[data-id="${leadId}"]`);
    if (!leadRow) return;

    // Update status badge
    const statusBadge = leadRow.querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.className = `status-badge ${status}`;
      statusBadge.textContent = getStatusText(status);
    }

    // Update row data attribute
    leadRow.setAttribute('data-status', status);

    // Update action buttons based on new status
    const actionsCell = leadRow.querySelector('.actions-cell .action-buttons');
    if (actionsCell) {
      const isAssigned = leadRow.querySelector('.assigned-user') !== null;
      
      // Remove existing accept/reject/lock buttons
      const existingAccept = actionsCell.querySelector('.accept-request');
      const existingReject = actionsCell.querySelector('.reject-request');
      const existingLock = actionsCell.querySelector('.status-locked');
      
      if (existingAccept) existingAccept.remove();
      if (existingReject) existingReject.remove();
      if (existingLock) existingLock.remove();
      
      // Add appropriate buttons based on status and assignment
      if (status === 'accepted') {
        // Show lock icon for accepted leads
        const lockSpan = document.createElement('span');
        lockSpan.className = 'status-locked';
        lockSpan.setAttribute('title', 'Geaccepteerde leads kunnen niet meer worden gewijzigd');
        lockSpan.innerHTML = '<i class="fas fa-lock"></i>';
        actionsCell.appendChild(lockSpan);
      } else if (isAssigned) {
        // Show accept/reject buttons for assigned leads that are not accepted
        const viewButton = actionsCell.querySelector('.view-request');
        if (viewButton) {
          const acceptButton = document.createElement('button');
          acceptButton.className = 'btn-icon accept-request';
          acceptButton.setAttribute('data-id', leadId);
          acceptButton.setAttribute('title', 'Accepteren');
          acceptButton.innerHTML = '<i class="fas fa-check"></i>';
          
          const rejectButton = document.createElement('button');
          rejectButton.className = 'btn-icon reject-request';
          rejectButton.setAttribute('data-id', leadId);
          rejectButton.setAttribute('title', 'Afwijzen');
          rejectButton.innerHTML = '<i class="fas fa-times"></i>';
          
          // Insert after view button
          viewButton.insertAdjacentElement('afterend', acceptButton);
          acceptButton.insertAdjacentElement('afterend', rejectButton);
        }
      }
      // If not assigned and not accepted, no additional buttons (only view button)
    }
  }

  // Get status text
  function getStatusText(status) {
    const statusMap = {
      'new': 'Nieuw',
      'accepted': 'Geaccepteerd',
      'rejected': 'Afgewezen',
      'in_progress': 'In behandeling'
    };
    return statusMap[status] || status;
  }

  // Create assign modal
  async function createAssignModal(leadId, currentUser) {
    const modal = document.createElement('div');
    modal.className = 'modal assign-modal';
    modal.innerHTML = `
      <div class="modal-content modal-lg">
        <div class="modal-header">
          <h3>Lead Toewijzen</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <p>Wijs dit lead toe aan een gebruiker:</p>
          <div class="form-row">
            <div class="form-group col-12">
              <label for="assignUserSelect">Toewijzen aan</label>
              <div class="searchable-dropdown">
                <div class="dropdown-input-container">
                  <input type="text" id="assignUserSearchInput" class="form-control" placeholder="Zoek gebruiker..." autocomplete="off">
                </div>
                <div class="dropdown-options" id="assignUserDropdownOptions">
                  <!-- Options will be populated by JavaScript -->
                </div>
                <input type="hidden" id="assignUserSelect" name="assigned_to" value="">
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-outline" id="cancelAssign">Annuleren</button>
            <button type="button" class="btn btn-primary" id="confirmAssign">Toewijzen</button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('#cancelAssign').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('#confirmAssign').addEventListener('click', async () => {
      const userId = modal.querySelector('#assignUserSelect').value;
      if (!userId) {
        showNotification('Selecteer een gebruiker', 'error');
        return;
      }
      
      await assignLeadToUser(leadId, userId);
      // Modal will be closed automatically in assignLeadToUser on success
    });

    // Populate users dropdown with searchable functionality
    await populateAssignUserDropdown(modal);

    return modal;
  }

  // Create delete confirmation modal
  function createDeleteConfirmModal(leadId, leadName) {
    const modal = document.createElement('div');
    modal.className = 'modal delete-confirm-modal';
    modal.innerHTML = `
      <div class="modal-content modal-sm">
        <div class="modal-header">
          <h3>Lead Verwijderen</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="delete-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Weet je zeker dat je het lead "<strong>${leadName}</strong>" wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.</p>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-outline" id="cancelDelete">Annuleren</button>
            <button type="button" class="btn btn-danger" id="confirmDelete">Verwijderen</button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('#cancelDelete').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('#confirmDelete').addEventListener('click', async () => {
      await performDeleteLead(leadId);
      modal.remove();
    });

    return modal;
  }

  // Populate users list with quota and industry information
async function populateUsersList(usersListElement, searchTerm = '') {
  usersListElement.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Gebruikers laden...</div>';
  usersListElement.className = 'users-list loading';
  
  // Als de cache leeg is, eerst vers ophalen
  if (!usersCache || usersCache.length === 0) {
    try {
      await fetchUsers(); // vult usersCache opnieuw (server -> actuele quota via /assignable)
    } catch (e) {
      console.error('Kon users niet verversen:', e);
    }
  }
  
  try {
      // Fetch quota and industry information for each user
      const usersWithData = await Promise.all(
        usersCache.map(async (user) => {
          try {
            // Fetch quota information
            const quotaResponse = await fetch(`/api/users/${user.id}/quota`, {
              credentials: 'include'
            });
            
            // Fetch industry preferences
            const industryResponse = await fetch(`/api/users/${user.id}/industry-preferences`, {
              credentials: 'include'
            });
            
            let quotaData = { quota: 0, used: 0, remaining: 0, canReceiveMore: false };
            let industryData = [];
            
            if (quotaResponse.ok) {
              quotaData = await quotaResponse.json();
            }
            
            if (industryResponse.ok) {
              industryData = await industryResponse.json();
            }
            
            return {
              ...user,
              quota: quotaData.quota,
              used: quotaData.used,
              remaining: quotaData.remaining,
              canReceiveMore: quotaData.canReceiveMore,
              industries: industryData.filter(industry => industry.is_enabled)
            };
          } catch (error) {
            console.error(`Error fetching data for user ${user.id}:`, error);
            return {
              ...user,
              quota: 0,
              used: 0,
              remaining: 0,
              canReceiveMore: false,
              industries: []
            };
          }
        })
      );
      
      // Filter users based on search term
      const filteredUsers = usersWithData.filter(user => {
        if (!searchTerm) return true;
        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase());
      });
      
      if (filteredUsers.length === 0) {
        usersListElement.innerHTML = '<div class="empty"><i class="fas fa-search"></i><p>Geen gebruikers gevonden</p></div>';
        usersListElement.className = 'users-list empty';
        return;
      }
      
      // Generate HTML for users list
      usersListElement.innerHTML = filteredUsers.map(user => {
        const initials = `${user.first_name.charAt(0)}${user.last_name.charAt(0)}`.toUpperCase();
        const fullName = `${user.first_name} ${user.last_name}`;
        
        // Format industries
        const industryNames = (user.industries || []).map(industry => industry.industry_name).join(', ');
        const industriesText = industryNames ? `Beschikbare branches: ${industryNames}` : 'Geen branches geselecteerd';
        
        // Format quota
        let quotaText = '';
        let quotaBadgeClass = '';
        if (user.isPaused) {
          quotaText = 'Aanvragen gepauzeerd';
          quotaBadgeClass = 'paused';
        } else if (user.quota > 0) {
          quotaText = `Toe te wijzen leads: ${user.remaining}/${user.quota}`;
          quotaBadgeClass = user.canReceiveMore ? 'available' : 'full';
        } else {
          quotaText = 'Geen limiet ingesteld';
          quotaBadgeClass = 'no-limit';
        }
        
        // Status indicator
        const statusClass = user.isPaused ? 'paused' : (user.canReceiveMore ? 'online' : 'busy');
        const statusText = user.isPaused ? 'Gepauzeerd' : (user.canReceiveMore ? 'Beschikbaar' : 'Quota vol');
        
        return `
          <div class="user-item ${user.isPaused ? 'paused' : ''}" data-user-id="${user.id}">
            <div class="user-row-1">
              <div class="user-name" style="font-size: 12px !important;">${fullName}</div>
              <div class="user-industries" style="font-size: 12px !important;">${industriesText}</div>
            </div>
            <div class="user-row-2">
              <div class="user-quota" style="font-size: 12px !important;">
                <span style="font-size: 12px !important;">${quotaText}</span>
                <span class="quota-badge ${quotaBadgeClass}" style="font-size: 12px !important;">
                  ${user.isPaused ? 'Gepauzeerd' : (user.canReceiveMore ? 'Beschikbaar' : 'Vol')}
                </span>
              </div>
              <div class="user-status" style="font-size: 12px !important;">
                <div class="status-indicator ${statusClass}"></div>
                <span style="font-size: 12px !important;">${statusText}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
      
      usersListElement.className = 'users-list';
      
      // Add click event listeners
      usersListElement.querySelectorAll('.user-item').forEach(item => {
        item.addEventListener('click', () => {
          // Remove previous selection
          usersListElement.querySelectorAll('.user-item').forEach(i => i.classList.remove('selected'));
          
          // Add selection to clicked item
          item.classList.add('selected');
          
          // Enable confirm button
          const confirmBtn = document.getElementById('confirmAssignBtn');
          if (confirmBtn) {
            confirmBtn.disabled = false;
          }
        });
      });
      
    } catch (error) {
      console.error('Error populating users list:', error);
      usersListElement.innerHTML = '<div class="empty"><i class="fas fa-exclamation-triangle"></i><p>Fout bij laden van gebruikers</p></div>';
      usersListElement.className = 'users-list empty';
    }
  }

  // Assign lead to user
  async function assignLeadToUser(leadId, userId) {
    try {
      
      // First get the lead's industry information
      const leadResponse = await fetch(`/api/leads/${leadId}`, {
        credentials: 'include'
      });
      
      if (!leadResponse.ok) {
        throw new Error('Kon lead informatie niet ophalen');
      }
      
      const leadData = await leadResponse.json();
      const lead = leadData.data || leadData;
      
      if (!lead) {
        throw new Error('Lead niet gevonden');
      }
      
      // ✅ CRITICAL: Industry validation using helper function
      if (lead.industry_id) {
        // Get users with industries
        const usersResp = await fetch(`/api/users?includeQuota=true`, { credentials: 'include' });
        if (!usersResp.ok) throw new Error('Kon gebruikersdata niet ophalen');
        const usersData = await usersResp.json();
        const selectedUser = usersData.find(u => u.id === userId);
        if (!selectedUser) throw new Error('Gebruiker niet gevonden');

        // ✅ Use helper function for consistent validation
        if (!userHasIndustry(selectedUser, lead.industry_id)) {
          const industryName = availableIndustries.find(i => String(i.id) === String(lead.industry_id))?.name || `branche ID ${lead.industry_id}`;
          showNotification(`Deze gebruiker heeft géén toegang tot "${industryName}". Selecteer een andere gebruiker.`, 'error');
          return; // stop: géén API-call
        }
      }
      
      // Check if user can receive more leads
      const quotaResponse = await fetch(`/api/users/${userId}/quota`, {
        credentials: 'include'
      });
      
      if (quotaResponse.ok) {
        const quotaData = await quotaResponse.json();
        if (!quotaData.canReceiveMore) {
          showNotification(`Gebruiker heeft zijn quota bereikt (${quotaData.used}/${quotaData.quota})`, 'error');
          return; // Don't close modal, just show error
        }
      }
      
      const response = await fetch(`/api/leads/${leadId}/assign`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        showNotification('Lead succesvol toegewezen!', 'success');
        updateLeadAssignment(leadId, userId);
        
        const modal = document.querySelector('.modal.show');
        const usersList = modal?.querySelector('#assignUsersList');
        const detailDropdown = modal?.querySelector('#detailUserDropdownOptions');

        // 1) Wacht op DB-propagatie via quota-endpoint (poll)
        await waitForQuotaUpdate(userId, { timeoutMs: 5000, intervalMs: 300 });

        // 2) Cache legen en vers ophalen
        usersCache = []; // ongeldig maken
        usersById.clear();
        await fetchUsers(); // nieuwste quota ophalen

        // 3) Lijst opnieuw renderen met verse data (indien modal nog open)
        if (usersList) {
          // Assign modal
          await populateUsersList(usersList);
          setTimeout(() => {
            if (modal && modal.parentNode) modal.remove();
          }, 1200);
        } else if (detailDropdown) {
          // Detail modal - refresh the dropdown
          populateDetailUserDropdown(); // UI opnieuw tekenen
          setTimeout(() => {
            if (modal && modal.parentNode) modal.remove();
          }, 1200);
        } else if (modal) {
          modal.remove();
        }
      } else {
        throw new Error(result.error || 'Er is een fout opgetreden');
      }
    } catch (error) {
      console.error('Error assigning lead:', error);
      showNotification(error.message || 'Er is een fout opgetreden bij het toewijzen van het lead', 'error');
    }
  }

  // Update lead assignment in UI
  function updateLeadAssignment(leadId, userId) {
    const leadRow = document.querySelector(`.requests-row[data-id="${leadId}"]`);
    if (!leadRow) return;

    const assignedToCell = leadRow.querySelector('.assigned-to');
    if (assignedToCell) {
      const userName = getUserNameById(userId);
      if (userName) {
        assignedToCell.innerHTML = `<span class="assigned-user">${userName}</span>`;
      }
    }

    // Update action buttons - add accept/reject buttons if lead is not accepted
    const actionsCell = leadRow.querySelector('.actions-cell .action-buttons');
    if (actionsCell) {
      const status = leadRow.getAttribute('data-status') || 'new';
      
      // Only add accept/reject buttons if lead is not accepted
      if (status !== 'accepted') {
        // Check if accept/reject buttons already exist
        const existingAccept = actionsCell.querySelector('.accept-request');
        const existingReject = actionsCell.querySelector('.reject-request');
        
        if (!existingAccept && !existingReject) {
          // Add accept/reject buttons after the view button
          const viewButton = actionsCell.querySelector('.view-request');
          if (viewButton) {
            const acceptButton = document.createElement('button');
            acceptButton.className = 'btn-icon accept-request';
            acceptButton.setAttribute('data-id', leadId);
            acceptButton.setAttribute('title', 'Accepteren');
            acceptButton.innerHTML = '<i class="fas fa-check"></i>';
            
            const rejectButton = document.createElement('button');
            rejectButton.className = 'btn-icon reject-request';
            rejectButton.setAttribute('data-id', leadId);
            rejectButton.setAttribute('title', 'Afwijzen');
            rejectButton.innerHTML = '<i class="fas fa-times"></i>';
            
            // Insert after view button
            viewButton.insertAdjacentElement('afterend', acceptButton);
            acceptButton.insertAdjacentElement('afterend', rejectButton);
          }
        }
      }
    }
  }

  // Perform delete lead
  async function performDeleteLead(leadId) {
    try {
      
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        showNotification('Lead succesvol verwijderd!', 'success');
        removeLeadFromTable(leadId);
      } else {
        throw new Error(result.error || 'Er is een fout opgetreden');
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
      showNotification('Er is een fout opgetreden bij het verwijderen van het lead', 'error');
    }
  }

  // Remove lead from table
  function removeLeadFromTable(leadId) {
    const leadRow = document.querySelector(`.requests-row[data-id="${leadId}"]`);
    if (leadRow) {
      leadRow.remove();
    }
  }
  
  // Initialize Add Request Modal functionality
  const addRequestBtn = document.getElementById('addRequestBtn');
  const addRequestModal = document.getElementById('addRequestModal');
  const cancelAddRequestBtn = document.getElementById('cancelAddRequestBtn');
  const addRequestForm = document.getElementById('addRequestForm');
  const requestAssignedTo = document.getElementById('requestAssignedTo');
  
  console.log('Element check:', {
    addRequestBtn: !!addRequestBtn,
    addRequestModal: !!addRequestModal,
    cancelAddRequestBtn: !!cancelAddRequestBtn,
    addRequestForm: !!addRequestForm,
    requestAssignedTo: !!requestAssignedTo
  });
  
  if (addRequestBtn && addRequestModal) {
    console.log('Initializing add request modal');
    addRequestBtn.addEventListener('click', () => {
      console.log('Add request button clicked');
      
      // Reset initialization flag immediately when modal is opened
      const searchInput = document.getElementById('userSearchInput');
      if (searchInput) {
        searchInput.dataset.initialized = 'false';
        console.log('Reset initialization flag for userSearchInput');
      }
      
      addRequestModal.classList.add('show');
      
      // Wait for modal to be visible before initializing
      setTimeout(() => {
        fetchUsers(); // Also fetch users when modal opens (in case of refresh)
        
        // Populate user dropdown immediately if users are already cached
        populateUserDropdown();
        
        // Re-initialize searchable dropdown for this modal
        initSearchableDropdownForModal(addRequestModal);
        
        // Update industries dropdown when modal opens
        if (availableIndustries.length > 0) {
          updateIndustryDropdowns();
        } else {
          // If industries not loaded yet, load them
          loadIndustries();
        }
      }, 100);
    });

    // Close modal
    const closeModal = () => {
      addRequestModal.classList.remove('show');
      // Reset form
      if (addRequestForm) {
        addRequestForm.reset();
      }
      // Reset searchable dropdown
      resetSearchableDropdown();
    };

    // Close on cancel button
    if (cancelAddRequestBtn) {
      cancelAddRequestBtn.addEventListener('click', closeModal);
    }

    // Close on modal close button
    const modalCloseBtn = addRequestModal.querySelector('.modal-close');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeModal);
    }

    // Close on outside click
    addRequestModal.addEventListener('click', (e) => {
      if (e.target === addRequestModal) {
        closeModal();
      }
    });

    // Handle form submission
    if (addRequestForm) {
      addRequestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(addRequestForm);
        const data = Object.fromEntries(formData.entries());
        
        // ✅ Hard block met centrale validator
        if (data.assigned_to && data.industry_id) {
          const selectedUser = usersCache.find(u => u.id === data.assigned_to);
          const verdict = validateAssignment({
            user: selectedUser,
            industryId: parseInt(data.industry_id, 10),
            quotaCheck: true
          });
          if (!verdict.ok) {
            showAssignmentError(verdict.reason, { industryId: data.industry_id });
            return;
          }
        }
        
        // Prepare data with correct types
        const leadData = {
          name: data.name,
          email: data.email,
          phone: data.phone || null,
          message: data.message || null,
          status: 'new',
          priority: data.priority || 'medium',
          // Convert deadline to ISO string
          deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
          // Convert industry_id to integer
          industry_id: data.industry_id ? parseInt(data.industry_id) : null,
          // Keep user_id as UUID string
          user_id: data.assigned_to || null,
          // Add budget parameter
          budget: data.budget || null
        };
        
        // Prepare data with correct types
        
        try {
          console.log('Submitting lead data:', leadData);
          
          const response = await fetch('/api/leads', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(leadData)
          });
          
          console.log('Response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
          });
          
          const result = await response.json();
          console.log('Response JSON:', result);
          
          if (!response.ok) {
            throw new Error(result.error || `HTTP error! status: ${response.status}`);
          }
          
          // Check if we have a valid response with success and data
          if (result.success && result.data && result.data.id) {
            console.log('Lead successfully created, adding to table');
            showNotification('Aanvraag succesvol toegevoegd', 'success');
            closeModal();
            
            // Add the new lead to the table
            try {
              addLeadToTable(result.data);
              console.log('Lead successfully added to table');
            } catch (tableError) {
              console.error('Error adding lead to table:', tableError);
              // Don't fail the whole operation if table update fails
              showNotification('Lead is aangemaakt maar kon niet worden toegevoegd aan de tabel. Ververs de pagina.', 'warning');
            }
            
            // Refresh users cache to include any new users
            try {
              fetchUsers();
              console.log('Users cache refresh initiated');
            } catch (fetchError) {
              console.error('Error refreshing users cache:', fetchError);
              // This is not critical, so don't show notification
            }
          } else {
            throw new Error('Ongeldige response van de server');
          }
        } catch (error) {
          console.error('Error adding request:', error);
          console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            cause: error.cause
          });
          
          // Additional debugging
          console.error('Form data that was being submitted:', leadData);
          console.error('Response details if available:', error.response);
          
          const errorMessage = error.message || 'Er is een fout opgetreden bij het toevoegen van de aanvraag';
          console.error('Showing notification with message:', errorMessage);
          
          showNotification(errorMessage, 'error');
        }
      });
    }
  }

  // Dropdown toggle functionality
  const bulkActionsBtn = document.getElementById('bulkActionsBtn');
  const bulkActionsMenu = document.getElementById('bulkActionsMenu');

  if (bulkActionsBtn && bulkActionsMenu) {
    bulkActionsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      bulkActionsMenu.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
      if (!bulkActionsBtn.contains(e.target) && !bulkActionsMenu.contains(e.target)) {
        bulkActionsMenu.classList.remove('show');
      }
    });
  }

  // Select all checkbox - only initialize if elements exist
  const selectAllCheckbox = document.getElementById('selectAll');
  const requestCheckboxes = document.querySelectorAll('.request-checkbox');
  const selectedCountElement = document.getElementById('selectedCount');

  // Check if bulk actions elements exist (they may not be on all pages)
  if (!selectAllCheckbox || !bulkActionsBtn || !bulkActionsMenu || !selectedCountElement) {
    // Silently return - bulk actions are optional features
    return;
  }

  // Update selected count and bulk actions button
  function updateSelectedCount() {
    const selectedCount = document.querySelectorAll('.request-checkbox:checked').length;
    selectedCountElement.textContent = `${selectedCount} geselecteerd`;
    bulkActionsBtn.disabled = selectedCount === 0;
  }

  // Handle select all checkbox
  selectAllCheckbox.addEventListener('change', function() {
    requestCheckboxes.forEach(checkbox => {
      checkbox.checked = this.checked;
    });
    updateSelectedCount();
  });

  // Handle individual checkboxes
  requestCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      updateSelectedCount();
      
      // Update select all checkbox state
      const allChecked = Array.from(requestCheckboxes).every(cb => cb.checked);
      const someChecked = Array.from(requestCheckboxes).some(cb => cb.checked);
      selectAllCheckbox.checked = allChecked;
      selectAllCheckbox.indeterminate = someChecked && !allChecked;
    });
  });

  // Helper function to update UI after status change
  function setLeadStatusUI(leadId, newStatus) {
    const row = document.querySelector(`.requests-row[data-id="${leadId}"]`);
    if (row) {
      // Update data attribute
      row.setAttribute('data-status', newStatus);
      
      // Update status badge
      const statusBadge = row.querySelector('.status-badge');
      if (statusBadge) {
        statusBadge.className = `status-badge ${newStatus}`;
        statusBadge.textContent = getStatusLabel(newStatus);
      }

      // Update action buttons based on new status
      const actionsCell = row.querySelector('.actions-cell .action-buttons');
      if (actionsCell) {
        const isAssigned = row.querySelector('.assigned-user') !== null;
        
        // Remove existing accept/reject/lock buttons
        const existingAccept = actionsCell.querySelector('.accept-request');
        const existingReject = actionsCell.querySelector('.reject-request');
        const existingLock = actionsCell.querySelector('.status-locked');
        
        if (existingAccept) existingAccept.remove();
        if (existingReject) existingReject.remove();
        if (existingLock) existingLock.remove();
        
        // Add appropriate buttons based on status and assignment
        if (newStatus === 'accepted') {
          // Show lock icon for accepted leads
          const lockSpan = document.createElement('span');
          lockSpan.className = 'status-locked';
          lockSpan.setAttribute('title', 'Geaccepteerde leads kunnen niet meer worden gewijzigd');
          lockSpan.innerHTML = '<i class="fas fa-lock"></i>';
          actionsCell.appendChild(lockSpan);
        } else if (isAssigned) {
          // Show accept/reject buttons for assigned leads that are not accepted
          const viewButton = actionsCell.querySelector('.view-request');
          if (viewButton) {
            const acceptButton = document.createElement('button');
            acceptButton.className = 'btn-icon accept-request';
            acceptButton.setAttribute('data-id', leadId);
            acceptButton.setAttribute('title', 'Accepteren');
            acceptButton.innerHTML = '<i class="fas fa-check"></i>';
            
            const rejectButton = document.createElement('button');
            rejectButton.className = 'btn-icon reject-request';
            rejectButton.setAttribute('data-id', leadId);
            rejectButton.setAttribute('title', 'Afwijzen');
            rejectButton.innerHTML = '<i class="fas fa-times"></i>';
            
            // Insert after view button
            viewButton.insertAdjacentElement('afterend', acceptButton);
            acceptButton.insertAdjacentElement('afterend', rejectButton);
          }
        }
        // If not assigned and not accepted, no additional buttons (only view button)
      }
    }
  }

  // Helper function to attach event listeners to dropdown items
  function attachEventListeners() {
    // Event listeners voor status wijzigingen
    document.querySelectorAll('.accept-request').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const leadId = this.dataset.id;
        setLeadStatusUI(leadId, 'accepted');
      });
    });

    document.querySelectorAll('.reject-request').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const leadId = this.dataset.id;
        setLeadStatusUI(leadId, 'rejected');
      });
    });

    document.querySelectorAll('.pending-request').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const leadId = this.dataset.id;
        setLeadStatusUI(leadId, 'new');
      });
    });
  }

  // Add event delegation for dynamically created buttons
  document.addEventListener('click', function(e) {
    // Handle accept buttons
    if (e.target.closest('.accept-request')) {
      e.preventDefault();
      const btn = e.target.closest('.accept-request');
      const leadId = btn.dataset.id;
      acceptLead(leadId);
    }
    
    // Handle reject buttons
    if (e.target.closest('.reject-request')) {
      e.preventDefault();
      const btn = e.target.closest('.reject-request');
      const leadId = btn.dataset.id;
      rejectLead(leadId);
    }
    
    // Handle view buttons
    if (e.target.closest('.view-request')) {
      e.preventDefault();
      const btn = e.target.closest('.view-request');
      const leadId = btn.dataset.id;
      assignLead(leadId);
    }
  });

  // Handle bulk actions
  bulkActionsMenu.addEventListener('click', async function(e) {
    const action = e.target.closest('.dropdown-item')?.dataset.action;
    console.log('Bulk action clicked:', action);

    if (!action) return;

    e.preventDefault();
    const selectedIds = Array.from(document.querySelectorAll('.request-checkbox:checked'))
      .map(cb => cb.dataset.id);
    console.log('Selected IDs:', selectedIds);

    if (selectedIds.length === 0) {
      showNotification('Selecteer minimaal één lead', 'error');
      return;
    }

    try {


      let response;
      let successMessage;
      let newStatus;

      switch (action) {
        case 'accept':
          // Show confirmation modal for accept action
          showAcceptConfirmationModal(selectedIds);
          return; // Don't proceed with the API call yet

        case 'reject':
          newStatus = 'rejected';
          response = await fetch('/api/leads/bulk/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, ids: selectedIds })
          });
          successMessage = 'Leads succesvol afgewezen';
          break;

        case 'in_progress':
          newStatus = 'in_progress';
          response = await fetch('/api/leads/bulk/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, ids: selectedIds })
          });
          successMessage = 'Leads succesvol in behandeling gezet';
          break;

        case 'delete':
          console.log('Delete action triggered');
          
          // Check permissions
          if (!hasPermission('leads.bulk_delete')) {
            showNotification('Je hebt geen rechten om leads te verwijderen', 'error');
            return;
          }
          
          // Toon de delete confirmatie modal
          const deleteModal = document.getElementById('deleteConfirmModal');
          console.log('Delete modal element:', deleteModal);
          
          if (!deleteModal) {
            console.error('Delete modal not found');
            return;
          }

          const deleteLeadsList = deleteModal.querySelector('.delete-leads-list');
          console.log('Delete leads list element:', deleteLeadsList);
          
          if (!deleteLeadsList) {
            console.error('Delete leads list not found');
            return;
          }
          
          // Vul de lijst met geselecteerde leads
          deleteLeadsList.innerHTML = '';
          selectedIds.forEach(id => {
            const row = document.querySelector(`.requests-row[data-id="${id}"]`);
            if (row) {
              const name = row.querySelector('.request-company').textContent;
              const email = row.querySelector('.request-email')?.textContent || '';
              const phone = row.querySelector('.request-phone')?.textContent || '';
              const statusBadge = row.querySelector('.status-badge');
              const status = statusBadge ? statusBadge.textContent.trim() : 'new';
              
              // Maak avatar initialen
              const initials = name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().substring(0, 2);
              
              const item = document.createElement('div');
              const canDelete = status !== 'accepted' && status !== 'approved';
              item.className = `delete-lead-item ${canDelete ? 'can-delete' : 'cannot-delete'}`;
              
              const statusIcon = canDelete ? 'fas fa-check-circle' : 'fas fa-times-circle';
              const statusText = canDelete ? status : `${status} (toegewezen)`;
              
              item.innerHTML = `
                <div class="lead-avatar">
                  <i class="fas fa-user"></i>
                </div>
                <div class="lead-info">
                  <div class="lead-name">${name}</div>
                  <div class="lead-email">${email}</div>
                </div>
                <div class="lead-status ${status.toLowerCase()}">
                  <i class="${statusIcon}"></i>
                  ${statusText}
                </div>
              `;
              deleteLeadsList.appendChild(item);
            }
          });
          
          // Toon de modal
          deleteModal.classList.add('show');
          
          // Voeg event listeners toe voor de knoppen
          const cancelDeleteBtn = deleteModal.querySelector('#cancelDeleteBtn');
          const confirmDeleteBtn = deleteModal.querySelector('#confirmDeleteBtn');
          const modalCloseBtn = deleteModal.querySelector('.modal-close');
          
          console.log('Modal buttons:', {
            cancelDeleteBtn: !!cancelDeleteBtn,
            confirmDeleteBtn: !!confirmDeleteBtn,
            modalCloseBtn: !!modalCloseBtn
          });
          
          if (!cancelDeleteBtn || !confirmDeleteBtn || !modalCloseBtn) {
            console.error('Modal buttons not found');
            return;
          }
          
          // Functie om de modal te sluiten
          const closeModal = () => {
            deleteModal.classList.remove('show');
          };
          
          // Event listeners voor het sluiten van de modal
          cancelDeleteBtn.onclick = closeModal;
          modalCloseBtn.onclick = closeModal;
          window.onclick = (e) => {
            if (e.target === deleteModal) {
              closeModal();
            }
          };
          
          // Event listener voor het bevestigen van de verwijdering
          confirmDeleteBtn.onclick = async () => {
            try {
              console.log('Sending delete request with IDs:', selectedIds);
              
              // Ensure we have valid IDs
              if (!selectedIds || selectedIds.length === 0) {
                showNotification('Geen leads geselecteerd om te verwijderen', 'error');
                return;
              }
              
              // Log the request details
              console.log('Delete request details:', {
                url: '/api/leads/bulk/delete',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: { ids: selectedIds }
              });
              
              const response = await fetch('/api/leads/bulk/delete', {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({ ids: selectedIds })
              });
              
              console.log('Response status:', response.status);
              console.log('Response headers:', Object.fromEntries(response.headers.entries()));
              
              const result = await response.json();
              console.log('Delete response:', result);
              
              if (result.success) {
                showNotification('Leads succesvol verwijderd', 'success');
                closeModal();
                
                // Verwijder de rijen uit de tabel
                selectedIds.forEach(id => {
                  const row = document.querySelector(`.requests-row[data-id="${id}"]`);
                  if (row) {
                    row.remove();
                  }
                });
                
                // Update de teller
                const totalCount = document.querySelectorAll('.requests-row').length - 1; // Subtract header row
                document.getElementById('totalCount').textContent = `Totaal: ${totalCount} aanvragen`;
                
                // Reset selecties
                selectAllCheckbox.checked = false;
                updateSelectedCount();
              } else {
                // Handle special case for assigned leads
                if (result.assignedLeads && result.assignedLeads.length > 0) {
                  console.log('Some leads cannot be deleted:', result.assignedLeads);
                  
                  // Show detailed error message
                  let errorMessage = 'De volgende leads kunnen niet worden verwijderd omdat ze al zijn toegewezen:\n\n';
                  result.assignedLeads.forEach(lead => {
                    errorMessage += `• ${lead.name} (${lead.status})\n`;
                  });
                  
                  if (result.canDelete && result.canDelete.length > 0) {
                    errorMessage += '\nDe volgende leads kunnen wel worden verwijderd:\n';
                    result.canDelete.forEach(lead => {
                      errorMessage += `• ${lead.name} (${lead.status})\n`;
                    });
                    errorMessage += '\nSelecteer alleen de verwijderbare leads en probeer opnieuw.';
                  }
                  
                  showNotification(errorMessage, 'error');
                } else {
                  throw new Error(result.error || 'Er is een fout opgetreden');
                }
              }
            } catch (error) {
              console.error('Error deleting leads:', error);
              showNotification(error.message || 'Er is een fout opgetreden bij het verwijderen van de leads', 'error');
            }
          };
          
          return; // Stop hier om te voorkomen dat de pagina wordt ververst
      }

      const result = await response.json();

      if (result.success) {
        showNotification(successMessage, 'success');
        
        // Update UI voor elke geselecteerde lead
        selectedIds.forEach(id => {
          setLeadStatusUI(id, newStatus);
        });
        
        // Reset selecties
        selectAllCheckbox.checked = false;
        updateSelectedCount();
      } else {
        throw new Error(result.error || 'Er is een fout opgetreden');
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
      showNotification(error.message || 'Er is een fout opgetreden', 'error');
    }
  });

  // Helper function to show notifications
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
      </div>
      <button class="notification-close">
        <i class="fas fa-times"></i>
      </button>
      <div class="notification-progress"></div>
    `;

    let container = document.querySelector('.notification-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'notification-container';
      document.body.appendChild(container);
    }

    container.appendChild(notification);

    // Add close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        notification.classList.add('closing');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      });
    }

    // Add progress bar animation
    const progressBar = notification.querySelector('.notification-progress');
    if (progressBar) {
      progressBar.style.animation = 'progressShrink 3000ms linear forwards';
      
      // Auto close after 3 seconds
      setTimeout(() => {
        notification.classList.add('closing');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, 3000);
    }
  }

  // Filter functionality
  const searchInput = document.getElementById('searchRequests');
  const statusFilter = document.getElementById('statusFilter');
  const priorityFilter = document.getElementById('priorityFilter');
  const industryFilter = document.getElementById('industryFilter');
  const resetFiltersBtn = document.getElementById('resetFilters');
  const tableBody = document.querySelector('.requests-table-body');

  // Function to filter leads
  function filterLeads() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusValue = statusFilter.value;
    const priorityValue = priorityFilter.value;
    const industryValue = industryFilter.value;

    const rows = tableBody.querySelectorAll('.requests-row');

    rows.forEach(row => {
      const name = row.querySelector('.request-company').textContent.toLowerCase();
      const contact = row.querySelector('.request-contact').textContent.toLowerCase();
      const status = row.getAttribute('data-status');
      const priority = row.getAttribute('data-priority');
      const industry = row.getAttribute('data-industry');

      // Check if row matches all filters
      const matchesSearch = name.includes(searchTerm) || contact.includes(searchTerm);
      const matchesStatus = statusValue === 'all' || status === statusValue;
      const matchesPriority = priorityValue === 'all' || priority === priorityValue;
      const matchesIndustry = industryValue === 'all' || industry === industryValue;

      // Show/hide row based on filters
      if (matchesSearch && matchesStatus && matchesPriority && matchesIndustry) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });

    // Update total count
    updateTotalCount();
  }

  // Function to update total count
  function updateTotalCount() {
    const visibleRows = tableBody.querySelectorAll('.requests-row:not([style*="display: none"])').length;
    const totalCount = document.getElementById('totalCount');
    if (totalCount) {
      totalCount.textContent = `Totaal: ${visibleRows} aanvragen`;
    }
  }

  // Add event listeners
  if (searchInput) {
    searchInput.addEventListener('input', filterLeads);
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', filterLeads);
  }

  if (priorityFilter) {
    priorityFilter.addEventListener('change', filterLeads);
  }

  if (industryFilter) {
    industryFilter.addEventListener('change', filterLeads);
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', function() {
      // Reset all filters
      if (searchInput) searchInput.value = '';
      if (statusFilter) statusFilter.value = 'all';
      if (priorityFilter) priorityFilter.value = 'all';
      if (industryFilter) industryFilter.value = 'all';

      // Show all rows
      const rows = tableBody.querySelectorAll('.requests-row');
      rows.forEach(row => {
        row.style.display = '';
      });

      // Update total count
      updateTotalCount();
    });
  }

  // Export functionality
  const exportBtn = document.getElementById('exportRequestsBtn');

  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      // Get all selected checkboxes
      const selectedCheckboxes = document.querySelectorAll('.request-checkbox:checked');
      
      if (selectedCheckboxes.length === 0) {
        showNotification('Selecteer minimaal één lead om te exporteren', 'warning');
        return;
      }

      // Get the data for selected leads
      const selectedLeads = Array.from(selectedCheckboxes).map(checkbox => {
        const row = checkbox.closest('.requests-row');
        return {
          id: row.getAttribute('data-id'),
          name: row.querySelector('.request-company').textContent,
          contact: row.querySelector('.request-contact').textContent,
          industry: row.querySelector('.industry-type').textContent,
          status: row.querySelector('.status-badge').textContent,
          priority: row.querySelector('.priority-badge').textContent,
          deadline: row.querySelector('.date-info').textContent.trim(),
          created_at: row.querySelectorAll('.date-info')[1].textContent.trim(),
          assigned_to: row.querySelector('.assigned-to').textContent.trim()
        };
      });

      // Convert to CSV
      const csvContent = convertToCSV(selectedLeads);
      
      // Create and download the file
      downloadCSV(csvContent, 'leads-export.csv');
      
      showNotification(`${selectedLeads.length} leads succesvol geëxporteerd`, 'success');
    });
  }

  // Function to convert data to CSV format
  function convertToCSV(data) {
    const headers = [
      'ID',
      'Naam',
      'Contact',
      'Branche',
      'Status',
      'Prioriteit',
      'Deadline',
      'Aangemaakt op',
      'Toegewezen aan'
    ];

    const rows = data.map(lead => [
      lead.id,
      lead.name,
      lead.contact,
      lead.industry,
      lead.status,
      lead.priority,
      lead.deadline,
      lead.created_at,
      lead.assigned_to
    ]);

    // Add headers to the beginning
    rows.unshift(headers);

    // Convert to CSV string
    return rows.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma or newline
        const cellStr = String(cell).replace(/"/g, '""');
        return cellStr.includes(',') || cellStr.includes('\n') ? `"${cellStr}"` : cellStr;
      }).join(',')
    ).join('\n');
  }

  // Function to download CSV file
  function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Create download link
    if (navigator.msSaveBlob) { // IE10+
      navigator.msSaveBlob(blob, fileName);
    } else {
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Action buttons functionality using event delegation
  document.addEventListener('click', function(e) {
    console.log('Click event detected on:', e.target);
    
    // Handle view request clicks
    if (e.target.closest('.view-request')) {
      e.preventDefault();
      const button = e.target.closest('.view-request');
      const leadId = button.getAttribute('data-id');
      console.log('View request clicked for lead:', leadId);
      viewLeadDetails(leadId);
    }
    
    // Handle accept request clicks
    if (e.target.closest('.accept-request')) {
      e.preventDefault();
      const button = e.target.closest('.accept-request');
      const leadId = button.getAttribute('data-id');
      console.log('Accept request clicked for lead:', leadId);
      setLeadStatusUI(leadId, 'accepted');
    }
    
    // Handle reject request clicks
    if (e.target.closest('.reject-request')) {
      e.preventDefault();
      const button = e.target.closest('.reject-request');
      const leadId = button.getAttribute('data-id');
      console.log('Reject request clicked for lead:', leadId);
      setLeadStatusUI(leadId, 'rejected');
    }
    
    // Handle assign request clicks
    if (e.target.closest('.assign-request')) {
      e.preventDefault();
      const button = e.target.closest('.assign-request');
      const leadId = button.getAttribute('data-id');
      console.log('Assign request clicked for lead:', leadId);
      assignLead(leadId);
    }
    
    // Handle delete request clicks
    if (e.target.closest('.delete-request')) {
      e.preventDefault();
      const button = e.target.closest('.delete-request');
      const leadId = button.getAttribute('data-id');
      console.log('Delete request clicked for lead:', leadId);
      deleteLead(leadId);
    }
  });

  // Reject request functionality is now handled by event delegation above

  // Assign request functionality is now handled by event delegation above

  // Delete request functionality is now handled by event delegation above

  // Helper function to reset all detail-value fields to display mode
  function resetDetailFields(lead) {
    // Map of field IDs to lead property names
    const fieldMap = [
      { id: 'detailContactNameTitle', value: lead?.name || '' },
      { id: 'detailEmail', value: lead?.email || '' },
      { id: 'detailPhone', value: lead?.phone || '' },
      { id: 'detailDescription', value: lead?.message || '' },
      { 
        id: 'detailAssignedTo', 
        value: lead?.assigned_to ? 
          `<span class="assigned-user">${lead.assigned_to}</span>` : 
          lead?.user_id ? 
            `<span class="assigned-user">${getUserNameById(lead.user_id) || 'Onbekende gebruiker'}</span>` :
            '<span class="not-assigned">Niet toegewezen</span>'
      }
    ];
    fieldMap.forEach(field => {
      const el = document.getElementById(field.id);
      if (el) {
        el.classList.remove('editing', 'editable', 'disabled');
        el.removeAttribute('data-tooltip');
        el.removeAttribute('data-temp-value');
        el.removeAttribute('data-temp-display');
        el.innerHTML = field.value;
      }
    });
    // Zet de editknop terug
    const editBtn = document.getElementById('detailEditBtn');
    if (editBtn) {
      editBtn.classList.remove('editing');
      editBtn.innerHTML = '<i class="fas fa-edit"></i> Bewerken';
    }
  }

  // Function to view lead details
  function viewLeadDetails(leadId) {
    // Validate leadId
    if (!leadId) {
      console.error('viewLeadDetails called with undefined leadId');
      showNotification('Lead ID is niet geldig', 'error');
      return;
    }

    console.log('Fetching lead details for ID:', leadId);
    
    // Fetch lead details from the server
    fetch(`/api/leads/${leadId}`, {
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(async lead => {
        // Validate lead data
        if (!lead || !lead.id) {
          console.error('Invalid lead data received:', lead);
          showNotification('Lead data is niet geldig', 'error');
          return;
        }

        console.log('Lead details received:', lead);
        
        // Setup form submit handler (remove existing listeners first) - DO THIS BEFORE POPULATING
        const detailForm = document.getElementById('detailRequestForm');
        if (detailForm) {
          // Remove existing event listeners by cloning the form
          const newForm = detailForm.cloneNode(true);
          detailForm.parentNode.replaceChild(newForm, detailForm);
          
          // Add new event listener
          newForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveDetailChanges();
          });
        }
        
        // Setup cancel button handler (remove existing listeners first) - DO THIS BEFORE POPULATING
        const cancelBtn = document.getElementById('cancelDetailBtn');
        if (cancelBtn) {
          // Remove existing event listeners by cloning the button
          const newCancelBtn = cancelBtn.cloneNode(true);
          cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
          
          // Add new event listener
          newCancelBtn.addEventListener('click', function() {
            const modal = document.getElementById('requestDetailModal');
            if (modal) {
              modal.classList.remove('show');
            }
          });
        }
        
        // Populate the form fields with lead details
        const nameEl = document.getElementById('detailName');
        if (nameEl) nameEl.value = lead.name || '';
        else console.warn('detailName not found');

        const emailEl = document.getElementById('detailEmail');
        if (emailEl) emailEl.value = lead.email || '';
        else console.warn('detailEmail not found');

        const phoneEl = document.getElementById('detailPhone');
        if (phoneEl) phoneEl.value = lead.phone || '';
        else console.warn('detailPhone not found');

        // INDUSTRY
        const industryEl = document.getElementById('detailIndustry');
        if (industryEl) {
          await loadIndustries(); // haalt lijst op, geen UI-side effects
          
          console.log('🔍 Industry debug before fillSelect:', {
            leadIndustryId: lead.industry_id,
            leadIndustryIdType: typeof lead.industry_id,
            availableIndustries: availableIndustries.length,
            industries: availableIndustries.map(i => ({ id: i.id, name: i.name }))
          });
          
          fillSelect(industryEl, availableIndustries, {
            valueKey: 'id',
            labelKey: 'name',
            selected: lead.industry_id ? String(lead.industry_id) : ''
          });

          console.log('Industry after fillSelect', {
            leadIndustryId: lead.industry_id,
            finalValue: industryEl.value,
            options: Array.from(industryEl.options).map(o => ({ value: o.value, text: o.text }))
          });
        } else {
          console.warn('detailIndustry not found');
        }

        // BUDGET
        const budgetEl = document.getElementById('detailBudget');
        if (budgetEl) {
          const normalized = normalizeBudget(lead.budget);
          
          console.log('🔍 Budget debug before setting:', {
            raw: lead.budget,
            rawType: typeof lead.budget,
            normalized,
            normalizedType: typeof normalized,
            availableOptions: Array.from(budgetEl.options).map(o => ({ value: o.value, text: o.text }))
          });
          
          budgetEl.value = normalized;
          if (budgetEl.value !== normalized) {
            console.warn('Budget option not found for value', { raw: lead.budget, normalized });
            // optioneel: fallback naar placeholder
            budgetEl.value = '';
          }

          console.log('Budget after normalize', {
            raw: lead.budget,
            normalized,
            finalValue: budgetEl.value,
            options: Array.from(budgetEl.options).map(o => ({ value: o.value, text: o.text }))
          });
        } else {
          console.warn('detailBudget not found');
        }

        const deadlineEl = document.getElementById('detailDeadline');
        if (deadlineEl) {
          // Convert deadline to datetime-local format
          if (lead.deadline) {
            const deadlineDate = new Date(lead.deadline);
            const localDateTime = new Date(deadlineDate.getTime() - deadlineDate.getTimezoneOffset() * 60000);
            deadlineEl.value = localDateTime.toISOString().slice(0, 16);
          }
        } else {
          console.warn('detailDeadline not found');
        }

        const priorityEl = document.getElementById('detailPriority');
        if (priorityEl) priorityEl.value = lead.priority || 'medium';
        else console.warn('detailPriority not found');

        const messageEl = document.getElementById('detailMessage');
        if (messageEl) messageEl.value = lead.message || '';
        else console.warn('detailMessage not found');

        // Handle assigned user
        const assignedToEl = document.getElementById('detailAssignedTo');
        const userSearchInput = document.getElementById('detailUserSearchInput');
        if (assignedToEl && userSearchInput) {
          console.log('Setting assigned user display:', {
            lead: lead,
            assigned_to: lead.assigned_to,
            user_id: lead.user_id
          });
        }
          
        // Store the lead ID in the modal for later use
        const modal = document.getElementById('requestDetailModal');
        modal.setAttribute('data-lead-id', leadId);

        
        // Initialize the searchable dropdown AFTER cloning (so it works with new elements)
        setTimeout(() => {
          initializeDetailSearchableDropdown();
          
          // Set the assigned user if available (after initialization)
          const assignedToEl = document.getElementById('detailAssignedTo');
          const userSearchInput = document.getElementById('detailUserSearchInput');
          
          if (assignedToEl && userSearchInput) {
            if (lead.assigned_to) {
              console.log('Using assigned_to from API:', lead.assigned_to);
              assignedToEl.value = lead.assigned_to;
              userSearchInput.value = lead.assigned_to;
            } else if (lead.user_id) {
              // If no assigned_to but we have user_id, try to get user name from cache
              const userName = getUserNameById(lead.user_id);
              console.log('Looking up user by ID:', lead.user_id, 'result:', userName);
              if (userName) {
                assignedToEl.value = lead.user_id;
                userSearchInput.value = userName;
              }
            }
          } else {
            console.warn('detailAssignedTo or detailUserSearchInput not found after cloning');
          }
        }, 100); // Small delay to ensure DOM is updated

        // Show the modal
        modal.classList.add('show');
      })
      .catch(error => {
        console.error('Error fetching lead details:', error);
        showNotification('Er is een fout opgetreden bij het ophalen van de lead details', 'error');
      });
  }

  // Function to save detail changes
  function saveDetailChanges(leadId) {
    // Get lead ID from modal if not provided
    if (!leadId) {
      const modal = document.getElementById('requestDetailModal');
      leadId = modal ? modal.getAttribute('data-lead-id') : null;
    }
    
    console.log('saveDetailChanges called for lead:', leadId);
    
    if (!leadId) {
      console.error('No lead ID found');
      showNotification('Lead ID niet gevonden', 'error');
      return;
    }
    
    const form = document.getElementById('detailRequestForm');
    if (!form) {
      console.error('Detail form not found');
      return;
    }
    
    const formData = new FormData(form);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      industry_id: formData.get('industry_id'),
      budget: formData.get('budget'),
      assigned_to: formData.get('assigned_to'),
      deadline: formData.get('deadline'),
      priority: formData.get('priority'),
      message: formData.get('message')
    };
    
    console.log('Form data collected:', data);
    
    // Validate required fields
    if (!data.name || !data.email || !data.industry_id || !data.budget || !data.deadline) {
      console.error('Validation failed - missing required fields');
      showNotification('Vul alle verplichte velden in', 'error');
      return;
    }
    
    // Validate assignment if user is being assigned
    if (data.assigned_to && data.industry_id) {
      const selectedUser = usersCache.find(u => u.id === data.assigned_to);
      const verdict = validateAssignment({
        user: selectedUser,
        industryId: parseInt(data.industry_id, 10),
        quotaCheck: true
      });
      if (!verdict.ok) {
        showAssignmentError(verdict.reason, { industryId: data.industry_id });
        // Reset save button
        const saveBtn = document.getElementById('saveDetailBtn');
        if (saveBtn) {
          saveBtn.textContent = 'Opslaan';
          saveBtn.disabled = false;
        }
        return;
      }
    }
    
    console.log('Validation passed, sending request...');
    
    // Show loading state
    const saveBtn = document.getElementById('saveDetailBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Opslaan...';
    saveBtn.disabled = true;
    
    fetch(`/api/leads/${leadId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data)
    })
    .then(response => {
      console.log('API response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });
      return response.json();
    })
    .then(async result => {
      console.log('API result:', result);
      if (result.success && result.data) {
        console.log('Lead update successful');
        showNotification('Lead succesvol bijgewerkt', 'success');

        // Optimistic UI update with the just-updated lead
        await ensureUsersCache();                    // make sure users are loaded
        syncLeadInUI(result.data);                  // <- update row + dropdown

        // Close modal
        const modal = document.getElementById('requestDetailModal');
        modal?.classList.remove('show');
      } else {
        console.error('Lead update failed:', result.error || result.message);
        showNotification(result.error || result.message || 'Er is een fout opgetreden', 'error');
      }
    })
    .catch(error => {
      console.error('Error updating lead:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      showNotification('Er is een fout opgetreden bij het bijwerken van de lead', 'error');
    })
    .finally(() => {
      // Restore button state
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    });
  }

  // Function to setup edit mode
  function setupEditMode(lead) {
    console.log('Setting up edit mode for lead:', lead);
    
    // Validate lead data
    if (!lead || !lead.id) {
      console.error('setupEditMode called with invalid lead:', lead);
      return;
    }
    
    // Get the modal and set lead ID
    const modal = document.getElementById('requestDetailModal');
    if (!modal) return;
    modal.setAttribute('data-lead-id', lead.id);
    
    // Get the edit button
    const editBtn = document.getElementById('detailEditBtn');
    if (!editBtn) return;

    // Remove any existing click handlers
    editBtn.replaceWith(editBtn.cloneNode(true));
    const newEditBtn = document.getElementById('detailEditBtn');
    
    // Store original values
    const originalValues = {
      name: document.getElementById('detailContactNameTitle')?.textContent,
      email: document.getElementById('detailEmail')?.textContent,
      phone: document.getElementById('detailPhone')?.textContent,
      description: document.getElementById('detailDescription')?.textContent,
      assignedTo: document.getElementById('detailAssignedTo')?.textContent
    };
    
    // Add click handler for edit button
    newEditBtn.addEventListener('click', async function() {
      console.log('Edit button clicked');
      
      try {
        // Toggle edit mode state
        const isEditing = newEditBtn.classList.toggle('editing');
        
        // Update button text and icon
        if (isEditing) {
          newEditBtn.innerHTML = '<i class="fas fa-save"></i> Opslaan';
          
          // Fetch users first
          const usersResponse = await fetch('/api/users', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          if (!usersResponse.ok) {
            throw new Error('Failed to fetch users');
          }
          const users = await usersResponse.json();
          
          // Initialize enhanced user dropdown for edit mode
          console.log('Initialized enhanced user dropdown with', users.length, 'users');
      // Enhanced user dropdown removed - using simple select instead
          
          // Make all fields editable
          const editableFields = [
            { id: 'detailContactNameTitle', type: 'text', label: 'Naam' },
            { id: 'detailEmail', type: 'email', label: 'E-mail' },
            { id: 'detailPhone', type: 'tel', label: 'Telefoon' },
            { id: 'detailDescription', type: 'textarea', label: 'Beschrijving' }
          ];
          
          // Make each field editable
          editableFields.forEach(field => {
            const element = document.getElementById(field.id);
            if (element) {
              console.log('Making field editable:', field.id);
              element.classList.add('editable');
              element.addEventListener('click', () => {
                startEditing(element, field.type);
              });
            } else {
              console.warn('Field not found:', field.id);
            }
          });

          // Handle assigned to field separately with searchable dropdown
          const assignedToElement = document.getElementById('detailAssignedTo');
          if (assignedToElement) {
            console.log('Handling assigned to field with searchable dropdown');
            
            // Create searchable dropdown structure
            const dropdownContainer = document.createElement('div');
            dropdownContainer.className = 'searchable-dropdown';
            dropdownContainer.innerHTML = `
              <div class="dropdown-input-container">
                <input type="text" class="form-control detail-user-search-input" placeholder="Zoek gebruiker..." autocomplete="off">
              </div>
              <div class="dropdown-options detail-user-dropdown-options">
                <!-- Options will be populated by JavaScript -->
              </div>
              <input type="hidden" class="detail-user-hidden-input" value="">
            `;
            
            const searchInput = dropdownContainer.querySelector('.detail-user-search-input');
            const dropdownOptions = dropdownContainer.querySelector('.detail-user-dropdown-options');
            const hiddenInput = dropdownContainer.querySelector('.detail-user-hidden-input');
            
            // Add users to dropdown
            users.forEach(user => {
              const option = document.createElement('div');
              option.className = 'dropdown-option';
              option.dataset.userId = user.id;
              
              // Add visual styling based on quota status
              if (user.isPaused) {
                option.classList.add('quota-paused');
              } else if (user.quota && !user.quota.canReceiveLeads) {
                option.classList.add('no-quota');
              } else if (user.quota && user.quota.canReceiveLeads) {
                if (user.quota.remaining > user.quota.total * 0.5) {
                  option.classList.add('quota-good');
                } else if (user.quota.remaining > user.quota.total * 0.2) {
                  option.classList.add('quota-low');
                } else {
                  option.classList.add('quota-critical');
                }
              }
              
              const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
              const displayName = fullName ? `${fullName} (${user.email})` : user.email;
              
              // Create quota text
              let quotaText = '';
              if (user.isPaused) {
                quotaText = `⏸️ Aanvragen gepauzeerd`;
              } else if (user.quota) {
                quotaText = `Quota: ${user.quota.used}/${user.quota.total} (${user.quota.remaining} over)`;
              } else {
                quotaText = 'Quota: Onbekend';
              }
              
              // Create branch text
              let branchText = '';
              if (user.industries && user.industries.length > 0) {
                const branchNames = user.industries.map(industry => industry.name).join(', ');
                branchText = `Actieve branches: ${branchNames}`;
              } else {
                branchText = 'Geen branches ingesteld';
              }
              
              option.innerHTML = `
                <div class="user-info">
                  <div class="user-name">${displayName}</div>
                  <div class="quota-info">${quotaText}</div>
                </div>
                <div class="branch-info">${branchText}</div>
              `;
              
              option.addEventListener('click', () => {
                selectDetailUser(user, option, dropdownContainer);
              });
              
              dropdownOptions.appendChild(option);
            });
            
            // If there's a current assignment, select that user
            if (lead.user_id) {
              const currentUser = users.find(u => u.id === lead.user_id);
              if (currentUser) {
                const fullName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim();
                const displayName = fullName ? `${fullName} (${currentUser.email})` : currentUser.email;
                searchInput.value = displayName;
                hiddenInput.value = currentUser.id;
                searchInput.disabled = true;
                
                // Store original content and set tooltip
                assignedToElement.setAttribute('data-original-content', assignedToElement.innerHTML);
                assignedToElement.setAttribute('data-tooltip', 'Toegewezen leads kunnen niet opnieuw toegewezen worden');
                
                // Replace content with dropdown
                assignedToElement.innerHTML = '';
                assignedToElement.appendChild(dropdownContainer);
                assignedToElement.classList.add('editing', 'disabled');
              }
            } else {
              // Store original content
              assignedToElement.setAttribute('data-original-content', assignedToElement.innerHTML);
              
              // Replace content with dropdown
              assignedToElement.innerHTML = '';
              assignedToElement.appendChild(dropdownContainer);
              assignedToElement.classList.add('editing');
              
              // Initialize search functionality
              initializeDetailSearchableDropdown(dropdownContainer);
            }
          }
        } else {
          // Show confirmation modal before saving
          const confirmModal = document.createElement('div');
          confirmModal.className = 'modal show';
          confirmModal.innerHTML = `
            <div class="modal-content modal-sm">
              <div class="modal-header">
                <h2>Bewerken bevestigen</h2>
                <button class="modal-close">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <div class="modal-body">
                <p>Weet je zeker dat je deze aanvraag wilt bewerken?</p>
                <div class="form-actions">
                  <button type="button" class="btn-outline" id="cancelEditConfirm">Annuleren</button>
                  <button type="button" class="btn-primary" id="confirmEditConfirm">Bevestigen</button>
                </div>
              </div>
            </div>
          `;
          
          document.body.appendChild(confirmModal);
          
          // Handle confirmation
          const confirmBtn = confirmModal.querySelector('#confirmEditConfirm');
          const cancelBtn = confirmModal.querySelector('#cancelEditConfirm');
          const closeBtn = confirmModal.querySelector('.modal-close');
          
          const closeModal = () => {
            confirmModal.remove();
          };
          
          // Return a promise that resolves when the user confirms or cancels
          return new Promise((resolve) => {
            confirmBtn.onclick = async () => {
              try {
                // Only save changes after confirmation
                await saveAllChanges(lead.id);
                newEditBtn.innerHTML = '<i class="fas fa-edit"></i> Bewerken';
                closeModal();
                resolve(true);
              } catch (error) {
                console.error('Error saving changes:', error);
                showNotification('Er is een fout opgetreden bij het opslaan van de wijzigingen', 'error');
                // Revert to original state on error
                revertToOriginalState(originalValues);
                closeModal();
                resolve(false);
              }
            };
            
            const revertToOriginalState = (originalValues) => {
              // Reset edit button
              newEditBtn.classList.remove('editing');
              newEditBtn.innerHTML = '<i class="fas fa-edit"></i> Bewerken';
              
              // Restore original values
              if (originalValues.name) document.getElementById('detailContactNameTitle').textContent = originalValues.name;
              if (originalValues.email) document.getElementById('detailEmail').textContent = originalValues.email;
              if (originalValues.phone) document.getElementById('detailPhone').textContent = originalValues.phone;
              if (originalValues.description) document.getElementById('detailDescription').textContent = originalValues.description;
              if (originalValues.assignedTo) {
                const assignedToElement = document.getElementById('detailAssignedTo');
                if (assignedToElement) {
                  assignedToElement.innerHTML = originalValues.assignedTo;
                  assignedToElement.classList.remove('editing', 'disabled');
                  assignedToElement.removeAttribute('data-tooltip');
                }
              }
              
              // Reset all editable fields
              document.querySelectorAll('.detail-value.editable').forEach(el => {
                el.classList.remove('editable', 'editing');
              });
            };
            
            cancelBtn.onclick = () => {
              closeModal();
              revertToOriginalState(originalValues);
              resolve(false);
            };
            
            closeBtn.onclick = () => {
              closeModal();
              revertToOriginalState(originalValues);
              resolve(false);
            };
            
            confirmModal.onclick = (e) => {
              if (e.target === confirmModal) {
                closeModal();
                revertToOriginalState(originalValues);
                resolve(false);
              }
            };
          });
        }
      } catch (error) {
        console.error('Error in edit mode:', error);
        showNotification('Er is een fout opgetreden bij het bewerken van de aanvraag', 'error');
      }
    });
  }

  // Function to start editing a field
  function startEditing(element, type = 'text') {
    console.log('Starting edit for element:', element.id, 'with type:', type);
    
    const leadId = document.getElementById('requestDetailModal').getAttribute('data-lead-id');
    const currentValue = element.textContent.trim();
    
    // Create input element based on type
    let input;
    if (type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
    } else {
      input = document.createElement('input');
      input.type = type;
    }
    
    input.value = currentValue;
    input.className = 'form-control';
    
    // Clear element and add input
    element.textContent = '';
    element.appendChild(input);
    element.classList.add('editing');
    element.classList.remove('editable');
    
    // Focus input
    input.focus();
    
    // Add event listeners
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        // Just blur the input instead of saving
        input.blur();
      } else if (e.key === 'Escape') {
        element.textContent = currentValue;
        element.classList.remove('editing');
        element.classList.add('editable');
      }
    });
    
    input.addEventListener('blur', () => {
      if (element.classList.contains('editing')) {
        const newValue = input.value.trim();
        // Just update the display value, don't save to backend yet
        element.textContent = newValue;
        element.classList.remove('editing');
        element.classList.add('editable');
      }
    });
  }

  // Function to start editing with searchable dropdown
  function startEditingWithSelect(element, users, label) {
    console.log('Starting edit with searchable dropdown for element:', element.id);
    
    const leadId = document.getElementById('requestDetailModal').getAttribute('data-lead-id');
    const currentValue = element.textContent.trim();
    
    // Create searchable dropdown structure
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'searchable-dropdown';
    dropdownContainer.innerHTML = `
      <div class="dropdown-input-container">
        <input type="text" class="form-control edit-user-search-input" placeholder="Zoek gebruiker..." autocomplete="off">
      </div>
      <div class="dropdown-options edit-user-dropdown-options">
        <!-- Options will be populated by JavaScript -->
      </div>
      <input type="hidden" class="edit-user-hidden-input" value="">
    `;
    
    const searchInput = dropdownContainer.querySelector('.edit-user-search-input');
    const dropdownOptions = dropdownContainer.querySelector('.edit-user-dropdown-options');
    const hiddenInput = dropdownContainer.querySelector('.edit-user-hidden-input');
    
    // Add users to dropdown
    users.forEach(user => {
      const option = document.createElement('div');
      option.className = 'dropdown-option';
      option.dataset.userId = user.id;
      
      // Add visual styling based on quota status
      if (user.isPaused) {
        option.classList.add('quota-paused');
      } else if (user.quota && !user.quota.canReceiveLeads) {
        option.classList.add('no-quota');
      } else if (user.quota && user.quota.canReceiveLeads) {
        if (user.quota.remaining > user.quota.total * 0.5) {
          option.classList.add('quota-good');
        } else if (user.quota.remaining > user.quota.total * 0.2) {
          option.classList.add('quota-low');
        } else {
          option.classList.add('quota-critical');
        }
      }
      
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      const displayName = fullName ? `${fullName} (${user.email})` : user.email;
      
      // Create quota text
      let quotaText = '';
      if (user.isPaused) {
        quotaText = `⏸️ Aanvragen gepauzeerd`;
      } else if (user.quota) {
        quotaText = `Quota: ${user.quota.used}/${user.quota.total} (${user.quota.remaining} over)`;
      } else {
        quotaText = 'Quota: Onbekend';
      }
      
      // Create branch text
      let branchText = '';
      if (user.industries && user.industries.length > 0) {
        const branchNames = user.industries.map(industry => industry.name).join(', ');
        branchText = `Actieve branches: ${branchNames}`;
      } else {
        branchText = 'Geen branches ingesteld';
      }
      
      option.innerHTML = `
        <div class="user-info">
          <div class="user-name">${displayName}</div>
          <div class="quota-info">${quotaText}</div>
        </div>
        <div class="branch-info">${branchText}</div>
      `;
      
      option.addEventListener('click', () => {
        selectEditUser(user, option, dropdownContainer, element);
      });
      
      dropdownOptions.appendChild(option);
    });
    
    // Set current value
    const currentUser = users.find(user => {
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      const displayName = fullName ? `${fullName} (${user.email})` : user.email;
      return displayName === currentValue || `${user.first_name} ${user.last_name}` === currentValue;
    });
    
    if (currentUser) {
      const fullName = `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim();
      const displayName = fullName ? `${fullName} (${currentUser.email})` : currentUser.email;
      searchInput.value = displayName;
      hiddenInput.value = currentUser.id;
    }
    
    // Clear element and add dropdown
    element.textContent = '';
    element.appendChild(dropdownContainer);
    element.classList.add('editing');
    
    // Focus search input
    searchInput.focus();
    
    // Initialize search functionality
    initializeEditSearchableDropdown(dropdownContainer, element);
    
    // Update display value when changed
    hiddenInput.addEventListener('change', () => {
      const selectedUser = users.find(u => u.id === hiddenInput.value);
      if (selectedUser) {
        const fullName = `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim();
        const displayName = fullName ? `${fullName} (${selectedUser.email})` : selectedUser.email;
        element.setAttribute('data-temp-value', selectedUser.id);
        element.setAttribute('data-temp-display', displayName);
      } else {
        element.setAttribute('data-temp-value', '');
        element.setAttribute('data-temp-display', 'Niet toegewezen');
      }
    });
    
    // Only handle escape key
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        element.textContent = currentValue;
        element.classList.remove('editing');
        element.removeAttribute('data-temp-value');
        element.removeAttribute('data-temp-display');
      }
    });
  }

  // Function to cancel edit
  function cancelEdit(element, originalValue) {
    element.textContent = originalValue;
    element.classList.remove('editing');
  }

  // Function to save edit
  async function saveEdit(leadId, field, newValue) {
    try {
      // Validate leadId
      if (!leadId) {
        console.error('saveEdit called with undefined leadId');
        showNotification('Lead ID is niet geldig', 'error');
        return;
      }

      console.log('Saving edit for leadId:', leadId, 'field:', field, 'newValue:', newValue);
      
      // Get current values from the UI elements
      const nameElement = document.getElementById('detailContactNameTitle');
      const emailElement = document.getElementById('detailEmail');
      const phoneElement = document.getElementById('detailPhone');
      const descriptionElement = document.getElementById('detailDescription');
      const assignedToElement = document.getElementById('detailAssignedTo');

      // Get values, handling both text content and input elements
      const getValue = (element) => {
        if (!element) return '';
        if (element.classList.contains('editing')) {
          const input = element.querySelector('input, textarea, select');
          return input ? input.value : '';
        }
        return element.textContent.trim();
      };

      // Prepare data for API
      const data = {
        name: getValue(nameElement),
        email: getValue(emailElement),
        phone: getValue(phoneElement),
        message: getValue(descriptionElement),
        assigned_to: getValue(assignedToElement)
      };

      // Make API call to update the lead
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Er is een fout opgetreden bij het bijwerken');
      }

      // Update the UI elements
      if (field === 'contactname') {
        // Update both the title and the contactpersoon fields
        const titleEl = document.getElementById('detailCompanyName');
        const contactEl = document.getElementById('detailContactNameTitle');
        if (titleEl) {
          titleEl.textContent = newValue;
          titleEl.classList.remove('editing');
        }
        if (contactEl) {
          contactEl.textContent = newValue;
          contactEl.classList.remove('editing');
        }

        // Update the table row
        const row = document.querySelector(`.requests-row[data-id="${leadId}"]`);
        if (row) {
          const companyName = row.querySelector('.request-company');
          if (companyName) {
            companyName.textContent = newValue;
          }
        }
      } else {
        const fieldElement = document.getElementById(`detail${field.charAt(0).toUpperCase() + field.slice(1)}`);
        if (fieldElement) {
          fieldElement.textContent = newValue;
          fieldElement.classList.remove('editing');
        }

        // Update the table row based on the field
        const row = document.querySelector(`.requests-row[data-id="${leadId}"]`);
        if (row) {
          switch (field.toLowerCase()) {
            case 'email':
            case 'phone':
              const contactInfo = row.querySelector('.request-contact');
              if (contactInfo) {
                contactInfo.textContent = newValue;
              }
              break;
            case 'assignedto':
              const assignedCell = row.querySelector('.assigned-to');
              if (assignedCell) {
                assignedCell.textContent = newValue || 'Niet toegewezen';
              }
              break;
          }
        }
      }

      // Show success notification
      showNotification('Lead succesvol bijgewerkt', 'success');

    } catch (error) {
      console.error('Error updating lead:', error);
      showNotification(error.message || 'Er is een fout opgetreden bij het bijwerken', 'error');
      
      // Revert the UI change if there was an error
      const fieldElement = document.getElementById(`detail${field.charAt(0).toUpperCase() + field.slice(1)}`);
      if (fieldElement) {
        fieldElement.classList.remove('editing');
      }
    }
  }

  // Function to show assign modal
  async function showAssignModal(leadId) {
    const modal = document.getElementById('assignModal');
    const confirmBtn = document.getElementById('confirmAssignBtn');
    const usersList = document.getElementById('assignUsersList');
    const searchInput = document.getElementById('userSearchInput');
    
    if (!modal || !confirmBtn || !usersList || !searchInput) {
      console.error('Assign modal elements not found');
      return;
    }
    
    // Reset modal state
    confirmBtn.disabled = true;
    confirmBtn.removeAttribute('data-lead-id');
    usersList.querySelectorAll('.user-item').forEach(item => item.classList.remove('selected'));
    
    // Set the lead ID on the confirm button
    confirmBtn.setAttribute('data-lead-id', leadId);
    
    // Populate users list
    await populateUsersList(usersList);
    
    // Add search functionality
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        populateUsersList(usersList, e.target.value);
      }, 300);
    });
    
    // Show the modal
    modal.classList.add('show');
  }

  // Function to show delete confirmation
  function showDeleteConfirmation(leadId) {
    const modal = document.getElementById('deleteConfirmModal');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    
    if (!modal || !confirmBtn) {
      console.error('Delete modal or confirm button not found');
      return;
    }

    // Set the lead ID on the confirm button
    confirmBtn.setAttribute('data-lead-id', leadId);
    
    // Show the modal
    modal.classList.add('show');
  }

  // Event listener for delete confirmation
  document.getElementById('confirmDeleteBtn').addEventListener('click', async function() {
    const leadId = this.getAttribute('data-lead-id');
    
    if (!leadId) {
      showNotification('Geen lead ID gevonden', 'error');
      return;
    }
    
    // Check permissions
    if (!hasPermission('leads.delete')) {
      showNotification('Je hebt geen rechten om leads te verwijderen', 'error');
      return;
    }

    try {
      const response = await fetch('/api/leads/bulk/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [leadId] })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Remove the row from the table
        const row = document.querySelector(`.requests-row[data-id="${leadId}"]`);
        if (row) {
          row.remove();
        }

        // Update the total count
        const totalCount = document.querySelectorAll('.requests-row').length - 1; // Subtract header row
        document.getElementById('totalCount').textContent = `Totaal: ${totalCount} aanvragen`;

        showNotification('Lead succesvol verwijderd', 'success');
        // Close the modal
        document.getElementById('deleteConfirmModal').classList.remove('show');
      } else {
        throw new Error(result.error || 'Er is een fout opgetreden');
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
      showNotification(error.message || 'Er is een fout opgetreden bij het verwijderen van de lead', 'error');
    }
  });

  // Event listener for assign confirmation
  document.getElementById('confirmAssignBtn').addEventListener('click', async function() {
    const leadId = this.getAttribute('data-lead-id');
    const selectedUser = document.querySelector('.user-item.selected');
    
    if (!selectedUser) {
      showNotification('Selecteer een gebruiker om toe te wijzen', 'warning');
      return;
    }
    
    const userId = selectedUser.getAttribute('data-user-id');
    const userName = selectedUser.querySelector('.user-name').textContent;
    
    console.log('🔍 ASSIGN BTN: Starting validation for lead:', leadId, 'user:', userId);
    
    // Disable button during request
    this.disabled = true;
    this.textContent = 'Valideren...';
    
    try {
      // First get the lead's industry information
      const leadResponse = await fetch(`/api/leads/${leadId}`, {
        credentials: 'include'
      });
      
      if (!leadResponse.ok) {
        throw new Error('Kon lead informatie niet ophalen');
      }
      
      const leadData = await leadResponse.json();
      const lead = leadData.data || leadData;
      
      if (!lead) {
        throw new Error('Lead niet gevonden');
      }
      
      // ✅ CRITICAL: Industry validation using helper function
      if (lead.industry_id) {
        const usersResp = await fetch(`/api/users?includeQuota=true`, { credentials: 'include' });
        if (!usersResp.ok) throw new Error('Kon gebruikersdata niet ophalen');
        const usersData = await usersResp.json();
        const selectedUserData = usersData.find(u => u.id === userId);

        if (!userHasIndustry(selectedUserData, lead.industry_id)) {
          const industryName = availableIndustries.find(i => String(i.id) === String(lead.industry_id))?.name || `branche ID ${lead.industry_id}`;
          showNotification(`Deze gebruiker heeft géén toegang tot "${industryName}". Kies een andere gebruiker.`, 'error');
          this.disabled = false;
          this.textContent = 'Toewijzen';
          return;
        }
      }
      
      // If validation passes, proceed with assignment
      this.textContent = 'Toewijzen...';
      
      const response = await fetch(`/api/leads/${leadId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update de UI
        const row = document.querySelector(`.requests-row[data-id="${leadId}"]`);
        if (row) {
          const assignedToCell = row.querySelector('.assigned-to');
          if (assignedToCell) {
            assignedToCell.innerHTML = `<span class="assigned-user">${userName}</span>`;
          }
          
          // Update status if needed
          const statusCell = row.querySelector('.status-cell');
          if (statusCell) {
            statusCell.innerHTML = '<span class="status-badge status-assigned">Toegewezen</span>';
          }
        }
        
        // Update modal indien open
        const assignedToElement = document.getElementById('detailAssignedTo');
        if (assignedToElement) {
          assignedToElement.innerHTML = `<span class="assigned-user">${userName}</span>`;
        }
        
        showNotification(`Lead succesvol toegewezen aan ${userName}`, 'success');
        
        // Close modal
        document.getElementById('assignModal').classList.remove('show');
      } else {
        throw new Error(result.error || 'Er is een fout opgetreden');
      }
      
    } catch (error) {
      console.error('Error assigning lead:', error);
      showNotification(error.message || 'Er is een fout opgetreden bij het toewijzen van de lead', 'error');
    } finally {
      // Re-enable button
      this.disabled = false;
      this.textContent = 'Toewijzen';
    }
  });

  // Close modals when clicking outside
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('show');
      }
    });
  });

  // Close modals when clicking close button
  document.querySelectorAll('.modal-close').forEach(button => {
    button.addEventListener('click', function() {
      this.closest('.modal').classList.remove('show');
    });
  });

  // Function to save all changes
  async function saveAllChanges(leadId) {
    try {
      // Get current values from the UI elements
      const nameElement = document.getElementById('detailContactNameTitle');
      const emailElement = document.getElementById('detailEmail');
      const phoneElement = document.getElementById('detailPhone');
      const descriptionElement = document.getElementById('detailDescription');
      const assignedToElement = document.getElementById('detailAssignedTo');

      // Get values, handling both text content, input elements, and temporary values
      const getValue = (element) => {
        if (!element) return '';
        if (element.classList.contains('editing')) {
          // Check for temporary values first (for select elements)
          if (element.hasAttribute('data-temp-value')) {
            return element.getAttribute('data-temp-value');
          }
          const input = element.querySelector('input, textarea, select');
          return input ? input.value : '';
        }
        return element.textContent.trim();
      };

      // Get display value for assigned to
      const getDisplayValue = (element) => {
        if (!element) return '';
        if (element.classList.contains('editing')) {
          if (element.hasAttribute('data-temp-display')) {
            return element.getAttribute('data-temp-display');
          }
          const select = element.querySelector('select');
          if (select) {
            const selectedOption = select.options[select.selectedIndex];
            return selectedOption ? selectedOption.textContent : 'Niet toegewezen';
          }
        }
        return element.textContent.trim();
      };

      // Get the assigned_to value
      let assignedToValue = '';
      if (assignedToElement && assignedToElement.classList.contains('editing')) {
        const select = assignedToElement.querySelector('select');
        if (select) {
          assignedToValue = select.value;
        }
      }

      // Prepare data for API
      const data = {
        name: getValue(nameElement),
        email: getValue(emailElement),
        phone: getValue(phoneElement),
        message: getValue(descriptionElement),
        user_id: assignedToValue
      };

      // Update UI immediately for better UX
      const updateUI = () => {
        // Update modal fields
        if (nameElement) nameElement.textContent = data.name;
        if (emailElement) emailElement.textContent = data.email;
        if (phoneElement) phoneElement.textContent = data.phone || '-';
        if (descriptionElement) descriptionElement.textContent = data.message || 'Geen beschrijving beschikbaar';
        
        // Update assigned to display
        let assignedName = null;
        if (data.user_id) {
          assignedName = getUserNameById(data.user_id);
        }
        if (assignedToElement) {
          assignedToElement.innerHTML = assignedName ? 
            `<span class="assigned-user">${assignedName}</span>` : 
            '<span class="not-assigned">Niet toegewezen</span>';
        }

        // Update table row
        const row = document.querySelector(`.requests-row[data-id="${leadId}"]`);
        if (row) {
          const companyName = row.querySelector('.request-company');
          if (companyName) companyName.textContent = data.name;
          
          const contactInfo = row.querySelector('.request-contact');
          if (contactInfo) contactInfo.textContent = data.phone || data.email;
          
          const assignedCell = row.querySelector('.assigned-to');
          if (assignedCell) {
            assignedCell.innerHTML = assignedName ? 
              `<span class="assigned-user">${assignedName}</span>` : 
              '<span class="not-assigned">Niet toegewezen</span>';
          }
        }

        // Reset edit mode
        resetDetailFields({
          name: data.name,
          email: data.email,
          phone: data.phone,
          message: data.message,
          assigned_to: assignedName
        });
      };

      // Update UI immediately
      updateUI();

      // Make API call in the background
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        // If the API call fails, revert the UI changes
        throw new Error(result.error || 'Er is een fout opgetreden bij het bijwerken');
      }

      // Show success notification
      showNotification('Aanvraag succesvol bijgewerkt', 'success');

    } catch (error) {
      console.error('Error updating lead:', error);
      showNotification(error.message || 'Er is een fout opgetreden bij het bijwerken', 'error');
      
      // Revert UI changes on error by fetching the original data
      try {
        const response = await fetch(`/api/leads/${leadId}`);
        const lead = await response.json();
        resetDetailFields(lead);
        
        // Update table row with original data
        const row = document.querySelector(`.requests-row[data-id="${leadId}"]`);
        if (row) {
          const companyName = row.querySelector('.request-company');
          if (companyName) companyName.textContent = lead.name;
          
          const contactInfo = row.querySelector('.request-contact');
          if (contactInfo) contactInfo.textContent = lead.phone || lead.email;
          
          const assignedCell = row.querySelector('.assigned-to');
          if (assignedCell) {
            assignedCell.innerHTML = lead.assigned_to ? 
              `<span class="assigned-user">${lead.assigned_to}</span>` : 
              '<span class="not-assigned">Niet toegewezen</span>';
          }
        }
      } catch (revertError) {
        console.error('Error reverting changes:', revertError);
      }
      
      throw error;
    }
  }

  // --- Reset edit mode on modal close ---
  function resetEditMode() {
    // Remove editing class from all fields and reset to display mode
    const modal = document.getElementById('requestDetailModal');
    if (modal && modal.hasAttribute('data-lead-id')) {
      const leadId = modal.getAttribute('data-lead-id');
      if (leadId) {
        // Fetch the latest lead data to reset fields
        fetch(`/api/leads/${leadId}`)
          .then(response => response.json())
          .then(lead => {
            resetDetailFields(lead);
          });
      }
    }
  }

  // Attach resetEditMode to modal close events
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', resetEditMode);
  });
  document.getElementById('requestDetailModal').addEventListener('click', function(e) {
    if (e.target === this) resetEditMode();
  });

  // Helper: check if any modal is open
  function anyModalOpen() {
    return Array.from(document.querySelectorAll('.modal')).some(m => m.classList.contains('show'));
  }

  let scrollY = 0;
  function lockBodyScroll() {
    scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    // Keep scrollbar visible by not setting overflow: hidden
    // document.body.style.overflow = 'hidden';
    // document.documentElement.style.overflow = 'hidden';
  }
  function unlockBodyScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    // document.body.style.overflow = '';
    // document.documentElement.style.overflow = '';
    window.scrollTo(0, scrollY);
  }
  function updateBodyScroll() {
    if (anyModalOpen()) {
      lockBodyScroll();
    } else {
      unlockBodyScroll();
    }
  }

  // Update scroll when modals open/close
  document.querySelectorAll('.modal').forEach(modal => {
    // When modal is shown
    modal.addEventListener('classChange', updateBodyScroll);
    // Fallback for when class is added directly
    const observer = new MutationObserver(updateBodyScroll);
    observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
  });

  // Also update scroll on close button and background click
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(updateBodyScroll, 10);
    });
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) setTimeout(updateBodyScroll, 10);
    });
  });

  // Initial check
  updateBodyScroll();
});

// =====================================================
// INDUSTRIES MANAGEMENT FOR LEADS
// =====================================================

let availableIndustries = [];
let _industriesPromise = null;

async function loadIndustries() {
  if (availableIndustries.length) return availableIndustries;
  if (_industriesPromise) return _industriesPromise;

  _industriesPromise = (async () => {
    try {
      console.log('Loading industries for leads form...');
      const res = await fetch('/api/industries');
      const result = await res.json();
      if (result.success) {
        availableIndustries = result.data || [];
        console.log('Industries loaded:', availableIndustries);
        return availableIndustries;
      } else {
        console.error('Error loading industries:', result.error);
        return [];
      }
    } catch (e) {
      console.error('Error loading industries:', e);
      return [];
    } finally {
      _industriesPromise = null;
    }
  })();

  return _industriesPromise;
}

// Generic helper to safely fill a select element while preserving selection
function fillSelect(selectEl, options, {
  valueKey = 'id',
  labelKey = 'name',
  selected = undefined
} = {}) {
  if (!selectEl) return;

  // Bewaar placeholder (eerste lege option) als die er al is
  const hadPlaceholder = !!selectEl.querySelector('option[value=""]');
  const placeholderText = selectEl.querySelector('option[value=""]')?.textContent || 'Selecteer een optie';

  const prev = selected !== undefined ? String(selected) : String(selectEl.value || '');

  const frag = document.createDocumentFragment();

  // Placeholder
  const ph = document.createElement('option');
  ph.value = '';
  ph.textContent = placeholderText;
  frag.appendChild(ph);

  // Opties
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = String(opt[valueKey]);
    o.textContent = opt[labelKey];
    if (opt.price != null) o.dataset.price = opt.price;
    frag.appendChild(o);
  });

  // Vervang inhoud in één keer
  selectEl.innerHTML = '';
  selectEl.appendChild(frag);

  // Herstel selectie (als beschikbaar)
  if (prev) {
    console.log('🔍 fillSelect: trying to set value', { prev, prevType: typeof prev, selectEl: selectEl.id });
    selectEl.value = String(prev);
    console.log('🔍 fillSelect: after setting value', { 
      setValue: String(prev), 
      actualValue: selectEl.value, 
      success: selectEl.value === String(prev),
      allOptions: Array.from(selectEl.options).map(o => ({ value: o.value, text: o.text }))
    });
    if (selectEl.value !== String(prev)) {
      // Niet gevonden—log voor debug
      console.warn('fillSelect: selected value not found in options', { prev, optionsCount: options.length });
    }
  }
}

// Normalize budget value from database to match option values
function normalizeBudget(raw) {
  if (!raw) return '';

  // strip euro, spaties, woorden; unify dash types
  let s = String(raw)
    .toLowerCase()
    .replace(/[€\s]|eur|euros?/g, '')
    .replace(/[–—−]/g, '-'); // en-dash/em-dash naar hyphen

  // Matches "a-b"
  const m = s.match(/(\d{1,6})-(\d{1,6})/);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    return `${a}-${b}`;
  }

  // 5000+ achtige varianten
  if (s.includes('5000+') || s.includes('>5000') || s.includes('5000plus')) return '5000+';

  // Directe matches zonder tekens
  const whitelist = new Set(['0-500','500-1000','1000-2000','2000-5000','5000+']);
  if (whitelist.has(s)) return s;

  return ''; // fallback → placeholder
}

// Update all industry dropdowns on the page
function updateIndustryDropdowns() {
  document.querySelectorAll('select[name="industry_id"], #detailIndustry').forEach(el => {
    const keep = el.value; // huidige selectie
    fillSelect(el, availableIndustries, { selected: keep });
  });
}

// Update a specific industry dropdown
function updateIndustryDropdown(dropdown) {
  if (!dropdown || !availableIndustries.length) {
    console.log('Cannot update dropdown:', { dropdown: !!dropdown, industriesCount: availableIndustries.length });
    return;
  }
  
  console.log('Updating industry dropdown:', dropdown.id, 'with', availableIndustries.length, 'industries');
  
  // Clear existing options except the first one
  const firstOption = dropdown.querySelector('option[value=""]');
  dropdown.innerHTML = '';
  
  // Add the default option
  if (firstOption) {
    dropdown.appendChild(firstOption);
  } else {
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Selecteer een branche';
    dropdown.appendChild(defaultOption);
  }
  
  // Add industry options
  availableIndustries.forEach(industry => {
    if (industry.is_active !== false) { // Only show active industries
      const option = document.createElement('option');
      option.value = industry.id;
      option.textContent = industry.name;
      
      // Add price info as data attribute for potential future use
      if (industry.price_per_lead) {
        option.setAttribute('data-price', industry.price_per_lead);
      }
      
      dropdown.appendChild(option);
    }
  });
  
  console.log('Dropdown updated with', dropdown.children.length, 'options');
}

// Update industry filter dropdown
function updateIndustryFilterDropdown(dropdown) {
  if (!dropdown || !availableIndustries.length) return;
  
  // Clear existing options except the first one
  const firstOption = dropdown.querySelector('option[value="all"]');
  dropdown.innerHTML = '';
  
  // Add the default "all" option
  if (firstOption) {
    dropdown.appendChild(firstOption);
  } else {
    const defaultOption = document.createElement('option');
    defaultOption.value = 'all';
    defaultOption.textContent = 'Alle branches';
    dropdown.appendChild(defaultOption);
  }
  
  // Add industry options
  availableIndustries.forEach(industry => {
    if (industry.is_active !== false) { // Only show active industries
      const option = document.createElement('option');
      option.value = industry.id;
      option.textContent = industry.name;
      dropdown.appendChild(option);
    }
  });
}

// Update industry display in existing leads
function updateIndustryDisplay() {
  // Update industry badges in the leads table
  const industryCells = document.querySelectorAll('.industry-type');
  industryCells.forEach(cell => {
    const industryId = cell.getAttribute('data-industry-id');
    const industry = availableIndustries.find(ind => ind.id == industryId);
    
    if (industry) {
      cell.textContent = industry.name;
    } else if (industryId) {
      cell.textContent = 'Onbekend';
    }
  });
  
  // Update lead avatars to show initials
  updateLeadAvatars();
}

// Helper function to get initials (global scope)
function getInitials(name) {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
}

// ✅ CRITICAL: Check if user has access to specific industry
function userHasIndustry(user, industryId) {
  if (!user || !industryId) return false;
  if (!Array.isArray(user.industries)) return false;
  return user.industries.some(ind => {
    // Cover all possible data shapes
    const uid = ind?.id ?? ind?.industry_id ?? ind?.industryId;
    return String(uid) === String(industryId);
  });
}

// Update all lead avatars to show initials instead of icons
function updateLeadAvatars() {
  const leadAvatars = document.querySelectorAll('.lead-avatar');
  leadAvatars.forEach(avatar => {
    // Find the lead name from the request-company div
    const requestInfo = avatar.parentElement.querySelector('.request-company');
    if (requestInfo) {
      const leadName = requestInfo.textContent;
      avatar.setAttribute('data-initials', getInitials(leadName));
    }
  });
}

// Initialize industries when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Load industries after a short delay to ensure DOM is ready
  setTimeout(() => {
    loadIndustries();
    // Update existing lead avatars
    updateLeadAvatars();
  }, 100);
  
  // Also listen for modal open events to refresh industries
  const addRequestModal = document.getElementById('addRequestModal');
  if (addRequestModal) {
    // Use MutationObserver to detect when modal becomes visible
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (addRequestModal.classList.contains('show')) {
            // Modal opened, refresh industries dropdown
            setTimeout(() => {
              refreshIndustriesForModal();
            }, 100);
          }
        }
      });
    });
    
    observer.observe(addRequestModal, { 
      attributes: true, 
      attributeFilter: ['class'] 
    });
  }
});

// Listen for industry changes in forms
document.addEventListener('change', (e) => {
  if (e.target.name === 'industry_id' || e.target.id === 'requestIndustry') {
    console.log('Industry changed to:', e.target.value);
    
    // You can add additional logic here if needed
    // For example, updating pricing display, etc.
  }
});

// Function to refresh industry display after leads are updated
function refreshIndustryDisplay() {
  if (availableIndustries.length > 0) {
    updateIndustryDisplay();
  }
}

// Make refreshIndustryDisplay available globally for other scripts
window.refreshIndustryDisplay = refreshIndustryDisplay;

// Function to refresh industries when modal opens
function refreshIndustriesForModal() {
  console.log('Refreshing industries for modal...');
  console.log('Available industries:', availableIndustries);
  
  if (availableIndustries.length > 0) {
    updateIndustryDropdowns();
    console.log('Industries dropdown updated');
  } else {
    console.log('No industries available, loading...');
    loadIndustries();
  }
}

// Make refreshIndustriesForModal available globally
window.refreshIndustriesForModal = refreshIndustriesForModal;

// Debug function to test industries loading
window.testIndustries = function() {
  console.log('=== Industries Debug Test ===');
  console.log('Available industries:', availableIndustries);
  console.log('Request industry dropdown:', document.getElementById('requestIndustry'));
  console.log('Industry filter dropdown:', document.getElementById('industryFilter'));
  
  if (availableIndustries.length > 0) {
    console.log('✅ Industries loaded successfully');
    updateIndustryDropdowns();
  } else {
    console.log('❌ No industries loaded, attempting to load...');
    loadIndustries();
  }
};

// Avatars and assigned users now load normally from server - no animations needed

  // Show accept confirmation modal
  function showAcceptConfirmationModal(selectedIds) {
    console.log('showAcceptConfirmationModal called with IDs:', selectedIds);
    
    const modal = document.getElementById('acceptConfirmModal');
    console.log('Modal element:', modal);
    
    if (!modal) {
      console.error('Accept confirmation modal not found!');
      return;
    }
    
    const leadsList = modal.querySelector('.accept-leads-list');
    console.log('Leads list element:', leadsList);
    
    // Store the selected IDs in the modal for later use
    modal.dataset.selectedIds = JSON.stringify(selectedIds);
    
    // Get lead data for selected IDs
    const selectedLeads = selectedIds.map(id => {
      const row = document.querySelector(`.requests-row[data-id="${id}"]`);
      if (row) {
        const name = row.querySelector('.requests-cell:nth-child(2)').textContent.trim();
        const email = row.querySelector('.requests-cell:nth-child(3)').textContent.trim();
        const status = row.getAttribute('data-status') || 'new';
        return { id, name, email, status };
      }
      return null;
    }).filter(lead => lead !== null);

    console.log('Selected leads:', selectedLeads);

    // Check if any leads are already accepted
    const acceptedLeads = selectedLeads.filter(lead => lead.status === 'accepted');
    if (acceptedLeads.length > 0) {
      showNotification(`Er zijn ${acceptedLeads.length} lead(s) die al geaccepteerd zijn en niet opnieuw geaccepteerd kunnen worden.`, 'error');
      return;
    }

    // Helper function to get status label
    const getStatusLabel = (status) => {
      switch(status) {
        case 'new': return 'Nieuw';
        case 'accepted': return 'Geaccepteerd';
        case 'rejected': return 'Afgewezen';
        case 'in_progress': return 'In behandeling';
        default: return status;
      }
    };

    // Populate the leads list
    leadsList.innerHTML = selectedLeads.map(lead => `
      <div class="accept-lead-item">
        <div class="accept-lead-info">
          <div class="accept-lead-name">${lead.name}</div>
          <div class="accept-lead-contact">${lead.email}</div>
        </div>
        <div class="accept-lead-status ${lead.status}">${getStatusLabel(lead.status)}</div>
      </div>
    `).join('');

    // Show modal
    console.log('Showing modal...');
    modal.style.display = 'flex';
    modal.classList.add('show');
    console.log('Modal display style:', modal.style.display);
    console.log('Modal classes:', modal.className);
  }

  // Handle accept confirmation
  async function confirmAcceptLeads(selectedIds) {
    try {
      const response = await fetch('/api/leads/bulk/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted', ids: selectedIds })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Er is een fout opgetreden');
      }

      const result = await response.json();
      showNotification(result.message || 'Leads succesvol geaccepteerd', 'success');
      
      // Refresh the leads list
      window.location.reload();
      
      // Close modal
      const modal = document.getElementById('acceptConfirmModal');
      modal.style.display = 'none';
      modal.classList.remove('show');
      
    } catch (error) {
      console.error('Error accepting leads:', error);
      showNotification(error.message || 'Er is een fout opgetreden bij het accepteren van de leads', 'error');
    }
  }

  // Event listeners for accept confirmation modal
  document.addEventListener('DOMContentLoaded', function() {
    // Cancel accept button
    const cancelAcceptBtn = document.getElementById('cancelAcceptBtn');
    if (cancelAcceptBtn) {
      cancelAcceptBtn.addEventListener('click', function() {
        const modal = document.getElementById('acceptConfirmModal');
        modal.style.display = 'none';
        modal.classList.remove('show');
      });
    }

    // Confirm accept button
    const confirmAcceptBtn = document.getElementById('confirmAcceptBtn');
    if (confirmAcceptBtn) {
      confirmAcceptBtn.addEventListener('click', function() {
        const modal = document.getElementById('acceptConfirmModal');
        const selectedIds = JSON.parse(modal.dataset.selectedIds || '[]');
        
        if (selectedIds.length > 0) {
          confirmAcceptLeads(selectedIds);
        }
      });
    }

    // Close modal when clicking outside
    const acceptModal = document.getElementById('acceptConfirmModal');
    if (acceptModal) {
      acceptModal.addEventListener('click', function(e) {
        if (e.target === acceptModal) {
          acceptModal.style.display = 'none';
          acceptModal.classList.remove('show');
        }
      });
    }

    // Close modal when clicking close button
    const acceptModalClose = acceptModal?.querySelector('.modal-close');
    if (acceptModalClose) {
      acceptModalClose.addEventListener('click', function() {
        acceptModal.style.display = 'none';
        acceptModal.classList.remove('show');
      });
    }
  });

