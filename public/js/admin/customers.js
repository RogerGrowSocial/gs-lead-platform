// Customers page JavaScript

(function() {
  'use strict';

  // Store sorting state outside function to persist between clicks
  // Initialize from URL on first load
  let currentSortBy = null;
  let currentSortOrder = null;

  // Initialize from URL immediately
  (function() {
    const url = new URL(window.location.href);
    currentSortBy = url.searchParams.get('sortBy') || 'name';
    currentSortOrder = url.searchParams.get('sortOrder') || 'asc';
  })();

  function initCustomersPage() {
    const searchInput = document.getElementById('searchInput');
    const statusSelect = document.getElementById('statusSelect');
    const prioritySelect = document.getElementById('prioritySelect');
    const createCustomerBtn = document.getElementById('createCustomerBtn');
    const customersTableBody = document.getElementById('customersTableBody');

    // Skip if page elements don't exist (wrong page)
    if (!customersTableBody) return;

    // Initialize sorting
    initSorting();

  // Filter customers - reload page with filters in URL (server-side filtering)
  function applyFiltersAndReload() {
    const search = searchInput?.value.trim() || '';
    const status = statusSelect?.value || 'all';
    const priority = prioritySelect?.value || 'all';
    
    // Build URL with filters
    const url = new URL(window.location.href);
    url.searchParams.set('page', '1'); // Reset to page 1 when filtering
    url.searchParams.set('status', status);
    url.searchParams.set('priority', priority);
    if (search) {
      url.searchParams.set('search', search);
    } else {
      url.searchParams.delete('search');
    }
    
    // Reload page with filters
    window.location.href = url.toString();
  }

  if (searchInput) {
    // Debounce search input
    let searchTimeout;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        applyFiltersAndReload();
      }, 500); // Wait 500ms after user stops typing
    });
  }
  if (statusSelect) statusSelect.addEventListener('change', applyFiltersAndReload);
  if (prioritySelect) prioritySelect.addEventListener('change', applyFiltersAndReload);

  // Make table rows clickable - navigate to customer detail page
  const customerRows = document.querySelectorAll('.table-body-row[data-customer-id]');
  customerRows.forEach(row => {
    row.addEventListener('click', function(e) {
      // Don't navigate if clicking on the actions button or drag handle
      if (e.target.closest('.actions-button') || e.target.closest('.customer-drag-handle') || e.target.closest('td[onclick]')) {
        return;
      }
      
      const customerId = this.getAttribute('data-customer-id');
      if (customerId) {
        window.location.href = `/admin/customers/${customerId}`;
      }
    });
  });
  
  // Drag and drop for sort order (Apple-style)
  let draggedRow = null;
  let draggedCustomerId = null;
  let dragStartHandle = null;
  let scrollPosition = { x: 0, y: 0 };
  let tableContainer = null;
  
  // Get table container once
  tableContainer = document.querySelector('.table-container');
  const tableScroll = document.querySelector('.table-scroll');
  
  // Make rows draggable
  customerRows.forEach(row => {
    row.setAttribute('draggable', 'false'); // Start disabled, enable on handle mousedown
    
    row.addEventListener('dragstart', function(e) {
      // Only allow drag if started from drag handle
      if (!dragStartHandle) {
        e.preventDefault();
        return false;
      }
      
      // Save scroll position to prevent layout shift
      if (tableScroll) {
        scrollPosition.x = tableScroll.scrollLeft || 0;
        scrollPosition.y = tableScroll.scrollTop || 0;
      }
      
      // Lock table container to prevent scrolling
      if (tableContainer) {
        tableContainer.classList.add('dragging-active');
        tableContainer.style.overflowX = 'hidden';
      }
      
      draggedRow = this;
      draggedCustomerId = this.getAttribute('data-customer-id');
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedCustomerId);
      
      // Prevent default drag image
      const dragImage = document.createElement('div');
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-9999px';
      dragImage.style.width = '1px';
      dragImage.style.height = '1px';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    });
    
    row.addEventListener('dragend', function(e) {
      resetDragState();
    });
    
    row.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      
      // Force maintain scroll position
      if (tableScroll && scrollPosition) {
        if (tableScroll.scrollLeft !== scrollPosition.x) {
          tableScroll.scrollLeft = scrollPosition.x;
        }
        if (tableScroll.scrollTop !== scrollPosition.y) {
          tableScroll.scrollTop = scrollPosition.y;
        }
      }
      
      // Prevent any horizontal scrolling
      if (tableContainer) {
        tableContainer.style.overflowX = 'hidden';
      }
      
      if (draggedRow && draggedRow !== this) {
        // Remove drag-over from all rows
        document.querySelectorAll('.table-body-row').forEach(r => {
          r.classList.remove('drag-over');
        });
        
        // Add drag-over to this row (shows blue line above)
        this.classList.add('drag-over');
      }
    });
    
    row.addEventListener('dragleave', function(e) {
      // Only remove if we're actually leaving the row (not just moving to a child)
      const rect = this.getBoundingClientRect();
      const y = e.clientY;
      if (y < rect.top || y > rect.bottom) {
        this.classList.remove('drag-over');
      }
    });
    
    row.addEventListener('drop', async function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.classList.remove('drag-over');
      
      if (!draggedRow || !draggedCustomerId) {
        resetDragState();
        return;
      }
      
      const targetCustomerId = this.getAttribute('data-customer-id');
      if (!targetCustomerId || targetCustomerId === draggedCustomerId) {
        resetDragState();
        return;
      }
      
      // Get all visible rows (respecting filters)
      const allRows = Array.from(document.querySelectorAll('.table-body-row[data-customer-id]'))
        .filter(row => row.style.display !== 'none');
      const draggedIndex = allRows.indexOf(draggedRow);
      const targetIndex = allRows.indexOf(this);
      
      // If same position, do nothing
      if (draggedIndex === targetIndex) {
        resetDragState();
        return;
      }
      
      // Show loading state
      if (window.showNotification) {
        window.showNotification('Volgorde bijwerken...', 'info', 1000);
      }
      
      // Move the customer directly to target position (much faster!)
      try {
        const response = await fetch(`/admin/api/customers/${draggedCustomerId}/move`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'same-origin',
          body: JSON.stringify({ targetIndex })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
          // Reload page to show new order
          location.reload();
        } else {
          throw new Error(data.error || 'Kon volgorde niet wijzigen');
        }
      } catch (error) {
        console.error('Error moving customer:', error);
        if (window.showNotification) {
          window.showNotification('Fout: ' + error.message, 'error', 5000);
        }
        resetDragState();
      }
    });
  });
  
  // Make drag handle trigger drag
  const dragHandles = document.querySelectorAll('.customer-drag-handle');
  dragHandles.forEach(handle => {
    handle.addEventListener('mousedown', function(e) {
      e.stopPropagation();
      const row = this.closest('.table-body-row[data-customer-id]');
      if (!row) return;
      
      // Mark that drag started from handle
      dragStartHandle = this;
      
      // Enable dragging on the row
      row.setAttribute('draggable', 'true');
      
      // Prevent text selection
      document.body.style.userSelect = 'none';
    });
    
    handle.addEventListener('mouseup', function() {
      // Reset after a short delay to allow drag to start
      setTimeout(() => {
        if (!draggedRow) {
          dragStartHandle = null;
          const row = this.closest('.table-body-row[data-customer-id]');
          if (row) {
            row.setAttribute('draggable', 'false');
          }
          document.body.style.userSelect = '';
        }
      }, 100);
    });
  });
  
  // Reset drag state
  function resetDragState() {
    dragStartHandle = null;
    if (draggedRow) {
      draggedRow.classList.remove('dragging');
      draggedRow.style.opacity = '';
      draggedRow.setAttribute('draggable', 'false');
      draggedRow = null;
    }
    draggedCustomerId = null;
    document.body.style.userSelect = '';
    document.querySelectorAll('.table-body-row').forEach(row => {
      row.classList.remove('drag-over');
    });
    
    // Restore table container
    if (tableContainer) {
      tableContainer.classList.remove('dragging-active');
      tableContainer.style.overflowX = '';
    }
    
    // Restore scroll position
    if (tableScroll && scrollPosition) {
      tableScroll.scrollLeft = scrollPosition.x;
      tableScroll.scrollTop = scrollPosition.y;
    }
  }

  // Create customer button - handled by customersDrawer.js
  // The drawer will open automatically when the button is clicked

  // Initialize sorting functionality
  function initSorting() {
    const sortableHeaders = document.querySelectorAll('.table-header-cell.sortable');
    if (sortableHeaders.length === 0) {
      console.warn('[Customers] No sortable headers found, retrying in 100ms...');
      // Retry after a short delay in case DOM isn't ready yet
      setTimeout(() => {
        const retryHeaders = document.querySelectorAll('.table-header-cell.sortable');
        if (retryHeaders.length > 0) {
          console.log('[Customers] Retry successful: Found', retryHeaders.length, 'headers, initializing sorting');
          initSorting();
        } else {
          console.error('[Customers] Retry failed: Still no headers found');
        }
      }, 100);
      return;
    }
    
    console.log('[Customers] Initializing sorting with', sortableHeaders.length, 'headers. Current sort:', currentSortBy, currentSortOrder);

    // Read current sort state from URL (sync with URL on each init)
    const currentUrl = new URL(window.location.href);
    const urlSortBy = currentUrl.searchParams.get('sortBy');
    const urlSortOrder = currentUrl.searchParams.get('sortOrder');
    
    // Update from URL if present (for page refresh or direct navigation)
    if (urlSortBy) {
      currentSortBy = urlSortBy;
    } else if (!currentSortBy) {
      currentSortBy = 'name';
    }
    
    if (urlSortOrder) {
      currentSortOrder = urlSortOrder;
    } else if (!currentSortOrder) {
      currentSortOrder = 'asc';
    }

    // Remove old event listeners by cloning headers (prevents duplicate listeners)
    sortableHeaders.forEach(header => {
      const newHeader = header.cloneNode(true);
      header.parentNode.replaceChild(newHeader, header);
    });

    // Re-select headers after cloning
    const freshHeaders = document.querySelectorAll('.table-header-cell.sortable');

    // Update active header styling and add click handlers
    freshHeaders.forEach(header => {
      const sortValue = header.getAttribute('data-sort');
      if (sortValue === currentSortBy) {
        header.classList.add('active', currentSortOrder);
      }

      // Add click handler - use arrow function to ensure correct closure
      header.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Get sort value from clicked header (use currentTarget to ensure we get the header, not child element)
        const clickedHeader = e.currentTarget;
        const sortBy = clickedHeader.getAttribute('data-sort');
        
        // Determine new sort order
        let newSortOrder = 'asc';
        if (sortBy === currentSortBy) {
          // Same column: toggle order
          newSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          // Different column: start with asc
          newSortOrder = 'asc';
        }
        
        // Debug logging
        console.log('[Customers Sorting] Click:', {
          clicked: sortBy,
          currentSortBy: currentSortBy,
          currentSortOrder: currentSortOrder,
          newSortOrder: newSortOrder,
          willToggle: sortBy === currentSortBy
        });
        
        // Update current values immediately (before AJAX call)
        currentSortBy = sortBy;
        currentSortOrder = newSortOrder;
        
        // Update sorting via AJAX (no page reload)
        updateTableSorting(sortBy, newSortOrder);
      });
    });
  }

  // Update table sorting via AJAX
  async function updateTableSorting(sortBy, sortOrder) {
    const tableBody = document.getElementById('customersTableBody');
    const tableContainer = document.querySelector('.table-container');
    if (!tableBody || !tableContainer) return;

    // Get current filters and pagination
    const currentUrl = new URL(window.location.href);
    const status = currentUrl.searchParams.get('status') || 'all';
    const priority = currentUrl.searchParams.get('priority') || 'all';
    const search = currentUrl.searchParams.get('search') || '';
    const page = currentUrl.searchParams.get('page') || '1';
    const limit = currentUrl.searchParams.get('limit') || '15';

    // Show loading state (prevent layout shift)
    const originalMinHeight = tableContainer.style.minHeight;
    tableContainer.style.minHeight = tableContainer.offsetHeight + 'px';
    tableBody.style.opacity = '0.5';
    tableBody.style.pointerEvents = 'none';

    // Update active header styling
    document.querySelectorAll('.table-header-cell.sortable').forEach(header => {
      header.classList.remove('active', 'asc', 'desc');
      if (header.getAttribute('data-sort') === sortBy) {
        header.classList.add('active', sortOrder);
      }
    });

    try {
      // Build API URL
      const apiUrl = new URL('/admin/api/customers/table', window.location.origin);
      apiUrl.searchParams.set('status', status);
      apiUrl.searchParams.set('priority', priority);
      if (search) apiUrl.searchParams.set('search', search);
      apiUrl.searchParams.set('page', page);
      apiUrl.searchParams.set('limit', limit);
      apiUrl.searchParams.set('sortBy', sortBy);
      apiUrl.searchParams.set('sortOrder', sortOrder);

      // Fetch new data
      const response = await fetch(apiUrl.toString(), {
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch customers');
      }

      // Update table body with new data
      tableBody.innerHTML = renderCustomersRows(data.customers || []);

      // Update pagination info if needed
      if (data.pagination) {
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo && data.pagination.totalItems > 0) {
          const startItem = (data.pagination.page - 1) * data.pagination.limit + 1;
          const endItem = Math.min(data.pagination.page * data.pagination.limit, data.pagination.totalItems);
          paginationInfo.textContent = `Toont ${startItem} tot ${endItem} van ${data.pagination.totalItems} resultaten`;
        }
      }

      // Update URL without reload (using history API)
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('sortBy', sortBy);
      newUrl.searchParams.set('sortOrder', sortOrder);
      window.history.pushState({}, '', newUrl.toString());

      // Update sorting state variables to match URL
      currentSortBy = sortBy;
      currentSortOrder = sortOrder;

      // Re-initialize sorting to update header styling and ensure event listeners work
      // Don't clone headers, just update styling and ensure listeners are attached
      const sortableHeaders = document.querySelectorAll('.table-header-cell.sortable');
      sortableHeaders.forEach(header => {
        header.classList.remove('active', 'asc', 'desc');
        const headerSort = header.getAttribute('data-sort');
        if (headerSort === sortBy) {
          header.classList.add('active', sortOrder);
        }
      });

      // Re-initialize row click handlers and drag handlers
      initRowClickHandlers();
      initDragHandlers();

    } catch (error) {
      console.error('Error updating table sorting:', error);
      // Restore original state on error
      tableBody.style.opacity = '';
      tableBody.style.pointerEvents = '';
      tableContainer.style.minHeight = originalMinHeight;
      
      // Show error notification if available
      if (window.showNotification) {
        window.showNotification('Fout bij sorteren: ' + error.message, 'error', 3000);
      }
      return;
    }

    // Restore normal state
    tableBody.style.opacity = '';
    tableBody.style.pointerEvents = '';
    tableContainer.style.minHeight = originalMinHeight;
  }

  // Render customer rows (same format as server-side)
  function renderCustomersRows(customers) {
    if (!customers || customers.length === 0) {
      return `
        <tr class="table-body-row">
          <td colspan="8" class="table-cell" style="text-align: center; color: #9ca3af; padding: 48px;">
            Geen klanten gevonden. Klik op "Nieuwe Klant" om er een toe te voegen.
          </td>
        </tr>
      `;
    }

    const statusLabels = {
      'active': 'Actief',
      'inactive': 'Inactief',
      'lead': 'Lead',
      'prospect': 'Prospect'
    };
    
    const statusStyles = {
      'active': 'status-paid',
      'inactive': 'status-cancelled',
      'lead': 'status-pending',
      'prospect': 'status-pending'
    };
    
    const priorityLabels = {
      'low': 'Laag',
      'normal': 'Normaal',
      'high': 'Hoog',
      'vip': 'VIP'
    };
    
    const priorityColors = {
      'low': '#6b7280',
      'normal': '#3b82f6',
      'high': '#f59e0b',
      'vip': '#f59e0b'
    };

    return customers.map(c => {
      const lastActivity = c.last_ticket_activity || c.last_email_activity || c.updated_at;
      const lastActivityDate = lastActivity ? new Date(lastActivity).toLocaleDateString('nl-NL', { 
        day: '2-digit', 
        month: 'short',
        year: 'numeric'
      }) : 'Geen activiteit';
      
      // Calculate initials
      let initials = '';
      if (c.name && c.name.length > 0) {
        const nameParts = c.name.split(' ');
        if (nameParts.length > 0) {
          initials = nameParts[0].charAt(0).toUpperCase();
          if (nameParts.length > 1) {
            initials += nameParts[nameParts.length - 1].charAt(0).toUpperCase();
          }
        }
      } else if (c.company_name && c.company_name.length > 0) {
        initials = c.company_name.charAt(0).toUpperCase();
      } else if (c.email && c.email.length > 0) {
        initials = c.email.charAt(0).toUpperCase();
      } else {
        initials = 'K';
      }
      
      return `
        <tr class="table-body-row" data-customer-id="${c.id}" style="cursor: pointer;">
          <td class="table-cell">
            <div class="customer-name-cell">
              ${c.logo_url ? `
                <img 
                  src="${c.logo_url}" 
                  alt="${c.name || c.company_name || 'Klant'}" 
                  class="customer-logo-small" 
                  loading="lazy"
                  decoding="async"
                  width="32"
                  height="32"
                  style="object-fit: contain; background: white;"
                  onload="this.classList.add('loaded');"
                  onerror="this.style.display='none'; const placeholder = this.nextElementSibling; if(placeholder) placeholder.style.display='flex';"
                />
                <div class="customer-logo-placeholder" style="display: none;">${initials}</div>
              ` : `
                <div class="customer-logo-placeholder">${initials}</div>
              `}
              <div class="cell-column">
                <span class="customer-name">${c.name || 'Onbekend'}</span>
                ${c.company_name ? `<span class="lead-title">${c.company_name}</span>` : ''}
              </div>
            </div>
          </td>
          <td class="table-cell">
            <div class="cell-column">
              <span class="customer-name">${c.email || '-'}</span>
              ${c.phone ? `<span class="lead-title">${c.phone}</span>` : ''}
            </div>
          </td>
          <td class="table-cell">
            <span class="cell-text">${c.branch_name || '-'}</span>
          </td>
          <td class="table-cell">
            <span class="status-badge ${statusStyles[c.status] || 'status-pending'}">${statusLabels[c.status] || c.status}</span>
          </td>
          <td class="table-cell">
            <span class="status-badge" style="background-color: ${priorityColors[c.priority] || '#6b7280'}20; color: ${priorityColors[c.priority] || '#6b7280'};">
              ${priorityLabels[c.priority] || c.priority}
            </span>
          </td>
          <td class="table-cell">
            <span class="cell-text">${lastActivityDate}</span>
          </td>
          <td class="table-cell">
            <span class="cell-text">${c.created_at ? new Date(c.created_at).toLocaleDateString('nl-NL', { 
              day: '2-digit', 
              month: 'short',
              year: 'numeric'
            }) : '-'}</span>
          </td>
          <td class="table-cell" onclick="event.stopPropagation();" style="position: relative;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div 
                class="customer-drag-handle" 
                data-customer-id="${c.id}"
                style="cursor: grab; padding: 4px; opacity: 0; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center;"
                title="Sleep om volgorde te wijzigen">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #9ca3af;">
                  <circle cx="2" cy="2" r="1" fill="currentColor"/>
                  <circle cx="6" cy="2" r="1" fill="currentColor"/>
                  <circle cx="10" cy="2" r="1" fill="currentColor"/>
                  <circle cx="2" cy="6" r="1" fill="currentColor"/>
                  <circle cx="6" cy="6" r="1" fill="currentColor"/>
                  <circle cx="10" cy="6" r="1" fill="currentColor"/>
                  <circle cx="2" cy="10" r="1" fill="currentColor"/>
                  <circle cx="6" cy="10" r="1" fill="currentColor"/>
                  <circle cx="10" cy="10" r="1" fill="currentColor"/>
                </svg>
              </div>
              <button class="actions-button" onclick="showCustomerActions('${c.id}', event)" title="Meer acties">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Re-initialize row click handlers after AJAX update
  function initRowClickHandlers() {
    const customerRows = document.querySelectorAll('.table-body-row[data-customer-id]');
    
    // Re-initialize click handlers for rows
    customerRows.forEach(row => {
      row.addEventListener('click', function(e) {
        if (e.target.closest('.actions-button') || e.target.closest('.customer-drag-handle') || e.target.closest('td[onclick]')) {
          return;
        }
        
        const customerId = this.getAttribute('data-customer-id');
        if (customerId) {
          window.location.href = `/admin/customers/${customerId}`;
        }
      });
    });
  }

  // Re-initialize drag handlers after AJAX update
  function initDragHandlers() {
    const customerRows = document.querySelectorAll('.table-body-row[data-customer-id]');
    const tableScroll = document.querySelector('.table-scroll');
    
    // Re-initialize drag handlers for rows
    customerRows.forEach(row => {
      row.setAttribute('draggable', 'false');
      
      // Re-attach drag event listeners (they might have been lost during innerHTML update)
      row.addEventListener('dragstart', function(e) {
        if (!dragStartHandle) {
          e.preventDefault();
          return false;
        }
        
        if (tableScroll) {
          scrollPosition.x = tableScroll.scrollLeft || 0;
          scrollPosition.y = tableScroll.scrollTop || 0;
        }
        
        if (tableContainer) {
          tableContainer.classList.add('dragging-active');
          tableContainer.style.overflowX = 'hidden';
        }
        
        draggedRow = this;
        draggedCustomerId = this.getAttribute('data-customer-id');
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedCustomerId);
        
        const dragImage = document.createElement('div');
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-9999px';
        dragImage.style.width = '1px';
        dragImage.style.height = '1px';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 0, 0);
        setTimeout(() => document.body.removeChild(dragImage), 0);
      });
      
      row.addEventListener('dragend', function(e) {
        resetDragState();
      });
      
      row.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        
        if (tableScroll && scrollPosition) {
          if (tableScroll.scrollLeft !== scrollPosition.x) {
            tableScroll.scrollLeft = scrollPosition.x;
          }
          if (tableScroll.scrollTop !== scrollPosition.y) {
            tableScroll.scrollTop = scrollPosition.y;
          }
        }
        
        if (tableContainer) {
          tableContainer.style.overflowX = 'hidden';
        }
        
        if (draggedRow && draggedRow !== this) {
          document.querySelectorAll('.table-body-row').forEach(r => {
            r.classList.remove('drag-over');
          });
          this.classList.add('drag-over');
        }
      });
      
      row.addEventListener('dragleave', function(e) {
        const rect = this.getBoundingClientRect();
        const y = e.clientY;
        if (y < rect.top || y > rect.bottom) {
          this.classList.remove('drag-over');
        }
      });
      
      row.addEventListener('drop', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        this.classList.remove('drag-over');
        
        if (!draggedRow || !draggedCustomerId) {
          resetDragState();
          return;
        }
        
        const targetCustomerId = this.getAttribute('data-customer-id');
        if (!targetCustomerId || targetCustomerId === draggedCustomerId) {
          resetDragState();
          return;
        }
        
        const allRows = Array.from(document.querySelectorAll('.table-body-row[data-customer-id]'))
          .filter(row => row.style.display !== 'none');
        const draggedIndex = allRows.indexOf(draggedRow);
        const targetIndex = allRows.indexOf(this);
        
        if (draggedIndex === targetIndex) {
          resetDragState();
          return;
        }
        
        if (window.showNotification) {
          window.showNotification('Volgorde bijwerken...', 'info', 1000);
        }
        
        try {
          const response = await fetch(`/admin/api/customers/${draggedCustomerId}/move`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({ targetIndex })
          });
          
          const data = await response.json();
          
          if (response.ok && data.success) {
            location.reload();
          } else {
            throw new Error(data.error || 'Kon volgorde niet wijzigen');
          }
        } catch (error) {
          console.error('Error moving customer:', error);
          if (window.showNotification) {
            window.showNotification('Fout: ' + error.message, 'error', 5000);
          }
          resetDragState();
        }
      });
    });

    // Re-initialize drag handle handlers
    const dragHandles = document.querySelectorAll('.customer-drag-handle');
    dragHandles.forEach(handle => {
      handle.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        const row = this.closest('.table-body-row[data-customer-id]');
        if (!row) return;
        
        dragStartHandle = this;
        row.setAttribute('draggable', 'true');
        document.body.style.userSelect = 'none';
      });
      
      handle.addEventListener('mouseup', function() {
        setTimeout(() => {
          if (!draggedRow) {
            dragStartHandle = null;
            const row = this.closest('.table-body-row[data-customer-id]');
            if (row) {
              row.setAttribute('draggable', 'false');
            }
            document.body.style.userSelect = '';
          }
        }, 100);
      });
    });
  }
});

let currentCustomerId = null;

function showCustomerActions(customerId, event) {
  event.stopPropagation();
  currentCustomerId = customerId;
  
  const menu = document.getElementById('customerActionsMenu');
  if (!menu) return;

  // Position menu - open to the left to avoid cutoff
  const buttonRect = event.target.closest('button').getBoundingClientRect();
  const menuWidth = 200; // Approximate menu width
  const viewportWidth = window.innerWidth;
  
  menu.style.display = 'block';
  
  // Check if there's enough space on the right, otherwise open to the left
  if (buttonRect.right + menuWidth + 5 > viewportWidth) {
    // Open to the left
    menu.style.left = (buttonRect.left - menuWidth - 5) + 'px';
  } else {
    // Open to the right (default)
    menu.style.left = (buttonRect.right + 5) + 'px';
  }
  
  menu.style.top = buttonRect.top + 'px';

  // Close on outside click
  setTimeout(() => {
    const closeMenu = (e) => {
      if (!menu.contains(e.target) && !event.target.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', closeMenu);
      }
    };
    document.addEventListener('click', closeMenu);
  }, 10);
}

// Handle customer actions menu
document.addEventListener('DOMContentLoaded', () => {
  const menu = document.getElementById('customerActionsMenu');
  if (menu) {
    menu.addEventListener('click', async (e) => {
      const btn = e.target.closest('.mail-action-item');
      if (!btn || !currentCustomerId) return;
      
      const action = btn.getAttribute('data-action');
      menu.style.display = 'none';
      
      if (action === 'view') {
        window.location.href = `/admin/customers/${currentCustomerId}`;
      } else if (action === 'tickets') {
        window.location.href = `/admin/tickets?customer_id=${currentCustomerId}`;
      } else if (action === 'emails') {
        window.location.href = `/admin/mail?customer_id=${currentCustomerId}`;
      } else if (action === 'edit') {
        window.location.href = `/admin/customers/${currentCustomerId}?action=edit`;
      } else if (action === 'delete') {
        if (confirm('Weet je zeker dat je deze klant wilt verwijderen?')) {
          try {
            const res = await fetch(`/admin/api/customers/${currentCustomerId}`, {
              method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok && data.success) {
              if (window.showNotification) {
                window.showNotification('Klant verwijderd', 'success', 3000);
              }
              location.reload();
            } else {
              throw new Error(data.error || 'Kon klant niet verwijderen');
            }
          } catch (err) {
            if (window.showNotification) {
              window.showNotification('Fout: ' + err.message, 'error', 5000);
            }
          }
        }
      }
    });
  }

  // Initialize on DOMContentLoaded (first page load)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Small delay to ensure all elements are rendered
      setTimeout(initCustomersPage, 50);
    });
  } else {
    // DOM already loaded, initialize with small delay to ensure elements exist
    setTimeout(initCustomersPage, 50);
  }

  // Also initialize when page is loaded via client-router
  window.addEventListener('page:loaded', function(e) {
    if (window.location.pathname.includes('/admin/customers')) {
      // Longer delay for client-router to ensure DOM is fully ready
      setTimeout(initCustomersPage, 150);
    }
  });
})();

