// Customers page JavaScript

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const statusSelect = document.getElementById('statusSelect');
  const prioritySelect = document.getElementById('prioritySelect');
  const createCustomerBtn = document.getElementById('createCustomerBtn');
  const customersTableBody = document.getElementById('customersTableBody');

  // Initialize sorting
  initSorting();

  // Filter customers
  function applyFilters() {
    const search = searchInput?.value.toLowerCase() || '';
    const status = statusSelect?.value || 'all';
    const priority = prioritySelect?.value || 'all';

    // Status mapping (Dutch labels to values)
    const statusMapping = {
      'actief': 'active',
      'inactief': 'inactive',
      'lead': 'lead',
      'prospect': 'prospect'
    };

    // Priority mapping (Dutch labels to values)
    const priorityMapping = {
      'laag': 'low',
      'normaal': 'normal',
      'hoog': 'high',
      'vip': 'vip'
    };

    const rows = customersTableBody?.querySelectorAll('.table-body-row') || [];
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      
      // Get status badge and map to value
      const statusBadge = row.querySelector('.status-badge');
      const rowStatusText = statusBadge?.textContent.toLowerCase() || '';
      const rowStatus = statusMapping[rowStatusText] || rowStatusText;
      
      // Get priority badge and map to value
      const priorityBadges = Array.from(row.querySelectorAll('.status-badge'));
      const priorityBadge = priorityBadges.find(b => {
        const text = b.textContent.toLowerCase();
        return text.includes('laag') || text.includes('normaal') || 
               text.includes('hoog') || text.includes('vip');
      });
      const rowPriorityText = priorityBadge?.textContent.toLowerCase() || '';
      const rowPriority = priorityMapping[rowPriorityText] || rowPriorityText;

      const matchesSearch = !search || text.includes(search);
      const matchesStatus = status === 'all' || rowStatus === status;
      const matchesPriority = priority === 'all' || rowPriority === priority;

      row.style.display = (matchesSearch && matchesStatus && matchesPriority) ? '' : 'none';
    });

    // Update results count
    const visibleCount = Array.from(rows).filter(r => r.style.display !== 'none').length;
    const info = document.getElementById('paginationInfo');
    if (info) {
      info.textContent = `Toont ${visibleCount} klanten`;
    }
  }

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (statusSelect) statusSelect.addEventListener('change', applyFilters);
  if (prioritySelect) prioritySelect.addEventListener('change', applyFilters);

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
    const currentUrl = new URL(window.location.href);
    const currentSortBy = currentUrl.searchParams.get('sortBy') || 'name';
    const currentSortOrder = currentUrl.searchParams.get('sortOrder') || 'asc';

    // Update active header styling
    sortableHeaders.forEach(header => {
      const sortValue = header.getAttribute('data-sort');
      if (sortValue === currentSortBy) {
        header.classList.add('active', currentSortOrder);
      }

      // Add click handler
      header.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const sortBy = this.getAttribute('data-sort');
        let newSortOrder = 'asc';
        
        // Toggle sort order if clicking the same column
        if (sortBy === currentSortBy) {
          newSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
        }
        
        // Update URL parameters
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('sortBy', sortBy);
        newUrl.searchParams.set('sortOrder', newSortOrder);
        
        // Navigate to new URL
        window.location.href = newUrl.toString();
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
});

