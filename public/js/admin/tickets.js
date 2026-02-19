// Tickets page JavaScript

document.addEventListener('DOMContentLoaded', () => {
  initializeTicketsPage();
});

let allTickets = [];
let filteredTickets = [];
let currentPage = 1;
let itemsPerPage = 20;
let sortBy = '-last_activity_at'; // API: prefix '-' for desc
let totalPages = 1;

async function initializeTicketsPage() {
  const searchInput = document.getElementById('searchInput');
  const statusSelect = document.getElementById('statusSelect');
  const prioritySelect = document.getElementById('prioritySelect');
  const assignedSelect = document.getElementById('assignedSelect');
  const createTicketBtn = document.getElementById('createTicketBtn');
  const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');

  // Load tickets from API
  await loadTickets();

  // Setup event listeners
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      currentPage = 1;
      applyFilters();
    }, 300));
  }
  
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      currentPage = 1;
      applyFilters();
    });
  }
  
  if (prioritySelect) {
    prioritySelect.addEventListener('change', () => {
      currentPage = 1;
      applyFilters();
    });
  }
  
  if (assignedSelect) {
    assignedSelect.addEventListener('change', () => {
      currentPage = 1;
      applyFilters();
    });
  }

  if (itemsPerPageSelect) {
    itemsPerPageSelect.addEventListener('change', (e) => {
      itemsPerPage = parseInt(e.target.value, 10);
      currentPage = 1;
      loadTickets();
    });
  }

  // Sortable headers
  document.querySelectorAll('.table-header-cell.sortable[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-sort');
      const ascending = sortBy === field;
      sortBy = ascending ? `-${field}` : field;
      currentPage = 1;
      loadTickets();
      updateSortUI();
    });
  });

  // Create ticket button
  if (createTicketBtn) {
    createTicketBtn.addEventListener('click', () => {
      if (window.showNotification) {
        window.showNotification('Ticket aanmaken komt binnenkort beschikbaar', 'info', 3000);
      }
    });
  }

  // Delegated row click: navigate to ticket detail (works for server-rendered and API-rendered rows)
  const ticketsTableBody = document.getElementById('ticketsTableBody');
  if (ticketsTableBody) {
    ticketsTableBody.addEventListener('click', (e) => {
      const row = e.target.closest('.table-body-row[data-ticket-id]');
      if (!row) return;
      if (e.target.closest('.actions-button, button[onclick*="showTicketActions"]')) return;
      const id = row.getAttribute('data-ticket-id');
      if (id) window.location.href = `/admin/tickets/${id}`;
    });
  }
}

function updateSortUI() {
  const dir = sortBy.startsWith('-') ? 'desc' : 'asc';
  const field = sortBy.replace(/^-/, '');
  document.querySelectorAll('.table-header-cell.sortable').forEach(el => {
    el.classList.remove('active', 'asc', 'desc');
    if (el.getAttribute('data-sort') === field) {
      el.classList.add('active', dir);
    }
  });
}

async function loadTickets() {
  try {
    const searchInput = document.getElementById('searchInput');
    const statusSelect = document.getElementById('statusSelect');
    const prioritySelect = document.getElementById('prioritySelect');
    const assignedSelect = document.getElementById('assignedSelect');
    
    const params = new URLSearchParams({
      page: currentPage,
      pageSize: itemsPerPage,
      sort: sortBy || '-last_activity_at'
    });
    
    if (searchInput?.value) params.append('search', searchInput.value);
    if (statusSelect?.value && statusSelect.value !== 'all') params.append('status', statusSelect.value);
    if (prioritySelect?.value && prioritySelect.value !== 'all') params.append('priority', prioritySelect.value);
    if (assignedSelect?.value && assignedSelect.value !== 'all') {
      if (assignedSelect.value === 'unassigned') {
        params.append('assignee', 'unassigned');
      } else {
        params.append('assignee', assignedSelect.value);
      }
    }
    
    const response = await fetch(`/admin/api/admin/tickets?${params}`);
    if (!response.ok) throw new Error('Failed to load tickets');
    
    const data = await response.json();
    allTickets = data.tickets || [];
    
    renderTickets(allTickets);
    const pag = data.pagination || {};
    totalPages = pag.totalPages || 1;
    updatePaginationInfo(pag);
    updatePaginationButtons(pag);
    updateSortUI();
    
  } catch (error) {
    console.error('Error loading tickets:', error);
    const ticketsTableBody = document.getElementById('ticketsTableBody');
    if (ticketsTableBody) {
      ticketsTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: #ef4444; padding: 48px;">
            Fout bij laden tickets. Probeer de pagina te verversen.
          </td>
        </tr>
      `;
    }
  }
}

function applyFilters() {
  loadTickets();
}

function renderTickets(tickets) {
  const ticketsTableBody = document.getElementById('ticketsTableBody');
  if (!ticketsTableBody) return;
  
  if (tickets.length === 0) {
    ticketsTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: #9ca3af; padding: 48px;">
          Geen tickets gevonden. Klik op "Nieuw Ticket" om er een aan te maken.
        </td>
      </tr>
    `;
    return;
  }
  
  const statusLabels = {
    'new': 'Nieuw',
    'open': 'Open',
    'waiting_on_customer': 'Wachten op klant',
    'waiting_on_internal': 'Wachten intern',
    'resolved': 'Opgelost',
    'closed': 'Gesloten'
  };
  
  const statusStyles = {
    'new': 'status-paid',
    'open': 'status-paid',
    'waiting_on_customer': 'status-pending',
    'waiting_on_internal': 'status-pending',
    'resolved': 'status-paid',
    'closed': 'status-cancelled'
  };
  
  const priorityLabels = {
    'low': 'Laag',
    'normal': 'Normaal',
    'high': 'Hoog',
    'urgent': 'Urgent'
  };
  
  const priorityColors = {
    'low': '#6b7280',
    'normal': '#3b82f6',
    'high': '#f59e0b',
    'urgent': '#ef4444'
  };
  
  ticketsTableBody.innerHTML = tickets.map(ticket => {
    const customerName = ticket.customers?.name || ticket.requester_name || 'Onbekend';
    const customerEmail = ticket.customers?.email || ticket.requester_email || '';
    const assignedName = ticket.assignee ? 
      `${ticket.assignee.first_name || ''} ${ticket.assignee.last_name || ''}`.trim() || ticket.assignee.email : 
      'Niet toegewezen';
    
    const createdDate = ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('nl-NL', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }) : '-';
    
    const lastActivity = ticket.last_activity_at ? formatRelativeTime(ticket.last_activity_at) : '-';
    
    return `
      <tr class="table-body-row" data-ticket-id="${ticket.id}" style="cursor: pointer;">
        <td class="table-cell">
          <span class="customer-name" style="font-weight: 600; color: #111827; font-family: 'Courier New', monospace;">${ticket.ticket_number || ticket.id.substring(0, 8)}</span>
        </td>
        <td class="table-cell">
          <div class="cell-column">
            <span class="customer-name">${escapeHtml(ticket.subject || '-')}</span>
            ${ticket.description ? `<span class="lead-title">${escapeHtml((ticket.description || '').substring(0, 60))}${ticket.description.length > 60 ? '...' : ''}</span>` : ''}
          </div>
        </td>
        <td class="table-cell">
          <div class="cell-column">
            <span class="customer-name">${escapeHtml(customerName)}</span>
            ${customerEmail ? `<span class="lead-title">${escapeHtml(customerEmail)}</span>` : ''}
          </div>
        </td>
        <td class="table-cell">
          <span class="status-badge ${statusStyles[ticket.status] || 'status-pending'}">${statusLabels[ticket.status] || ticket.status}</span>
        </td>
        <td class="table-cell">
          <span class="status-badge" style="background-color: ${priorityColors[ticket.priority] || '#6b7280'}20; color: ${priorityColors[ticket.priority] || '#6b7280'};">
            ${priorityLabels[ticket.priority] || ticket.priority}
          </span>
        </td>
        <td class="table-cell">
          <span class="cell-text">${escapeHtml(assignedName)}</span>
        </td>
        <td class="table-cell">
          <span class="cell-text">${lastActivity}</span>
        </td>
        <td class="table-cell" onclick="event.stopPropagation();" style="position: relative;">
          <button class="actions-button" onclick="event.stopPropagation(); showTicketActions('${ticket.id}', event)" title="Meer acties">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="5" r="1"></circle>
              <circle cx="12" cy="19" r="1"></circle>
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function updatePaginationInfo(pagination) {
  const info = document.getElementById('paginationInfo');
  if (info && pagination) {
    const total = pagination.total || 0;
    const start = total > 0 ? ((pagination.page - 1) * pagination.pageSize) + 1 : 0;
    const end = Math.min(pagination.page * pagination.pageSize, total);
    info.textContent = total > 0 ? `Toont ${start} tot ${end} van ${total} resultaten` : 'Geen tickets';
  }
}

function updatePaginationButtons(pagination) {
  const prevBtn = document.getElementById('prevButton');
  const nextBtn = document.getElementById('nextButton');
  const container = document.getElementById('paginationButtons');
  const itemsSelect = document.getElementById('itemsPerPageSelect');
  if (!container || !pagination) return;

  const page = pagination.page || 1;
  const total = pagination.total || 0;
  const pageSize = pagination.pageSize || itemsPerPage;
  const totalPgs = pagination.totalPages || 1;
  const hasPrev = page > 1;
  const hasNext = page < totalPgs;

  if (prevBtn) {
    prevBtn.disabled = !hasPrev;
    prevBtn.onclick = () => {
      if (hasPrev) {
        currentPage = page - 1;
        loadTickets();
      }
    };
  }
  if (nextBtn) {
    nextBtn.disabled = !hasNext;
    nextBtn.onclick = () => {
      if (hasNext) {
        currentPage = page + 1;
        loadTickets();
      }
    };
  }

  // Sync items per page select
  if (itemsSelect && parseInt(itemsSelect.value, 10) !== pageSize) {
    itemsSelect.value = String(pageSize);
  }
  itemsPerPage = pageSize;

  // Page number buttons (max 5 like customers)
  const maxPages = 5;
  let startPage = Math.max(1, page - Math.floor(maxPages / 2));
  let endPage = Math.min(totalPgs, startPage + maxPages - 1);
  if (endPage - startPage < maxPages - 1) {
    startPage = Math.max(1, endPage - maxPages + 1);
  }
  const pageNumbers = [];
  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

  container.innerHTML = '';
  const prevNew = document.createElement('button');
  prevNew.className = 'pagination-nav';
  prevNew.id = 'prevButton';
  prevNew.disabled = !hasPrev;
  prevNew.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>';
  prevNew.onclick = () => { if (hasPrev) { currentPage = page - 1; loadTickets(); } };
  container.appendChild(prevNew);
  pageNumbers.forEach(num => {
    const btn = document.createElement('button');
    btn.className = 'pagination-page' + (num === page ? ' pagination-page-active' : '');
    btn.setAttribute('data-page', String(num));
    btn.textContent = num;
    btn.type = 'button';
    btn.onclick = () => { currentPage = num; loadTickets(); };
    container.appendChild(btn);
  });
  const nextNew = document.createElement('button');
  nextNew.className = 'pagination-nav';
  nextNew.id = 'nextButton';
  nextNew.disabled = !hasNext;
  nextNew.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>';
  nextNew.onclick = () => { if (hasNext) { currentPage = page + 1; loadTickets(); } };
  container.appendChild(nextNew);
}

function formatRelativeTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Zojuist';
  if (diffMins < 60) return diffMins + ' min geleden';
  if (diffHours < 24) return diffHours + ' u geleden';
  if (diffDays < 7) return diffDays + ' d geleden';
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

let currentTicketId = null;

function showTicketActions(ticketId, event) {
  event.stopPropagation();
  currentTicketId = ticketId;
  
  const menu = document.getElementById('ticketActionsMenu');
  if (!menu) return;

  // Position menu
  const buttonRect = event.target.closest('button').getBoundingClientRect();
  menu.style.display = 'block';
  menu.style.left = buttonRect.right + 5 + 'px';
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

// Handle ticket actions menu
document.addEventListener('DOMContentLoaded', () => {
  const menu = document.getElementById('ticketActionsMenu');
  if (menu) {
    menu.addEventListener('click', async (e) => {
      const btn = e.target.closest('.mail-action-item');
      if (!btn || !currentTicketId) return;
      
      const action = btn.getAttribute('data-action');
      menu.style.display = 'none';
      
      if (action === 'view') {
        window.location.href = `/admin/tickets/${currentTicketId}`;
      } else if (action === 'edit') {
        window.location.href = `/admin/tickets/${currentTicketId}?action=edit`;
      } else if (action === 'delete') {
        if (confirm('Weet je zeker dat je dit ticket wilt verwijderen?')) {
          try {
            const res = await fetch(`/admin/api/tickets/${currentTicketId}`, {
              method: 'DELETE'
            });
            const data = await res.json();
            if (res.ok && data.success) {
              if (window.showNotification) {
                window.showNotification('Ticket verwijderd', 'success', 3000);
              }
              location.reload();
            } else {
              throw new Error(data.error || 'Kon ticket niet verwijderen');
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

