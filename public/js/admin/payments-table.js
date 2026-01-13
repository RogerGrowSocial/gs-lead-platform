/* ============================================
   PAYMENTS TABLE - INITIALIZATION
   ============================================ */

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  initializePaymentsTable();
});

// Global state
let allPayments = [];
let filteredPayments = [];
let currentPage = 1;
let itemsPerPage = 10;
let searchQuery = '';
let statusFilter = 'all';

/* ============================================
   INITIALIZE PAYMENTS TABLE
   ============================================ */
async function initializePaymentsTable() {
  try {
    // Fetch payments data
    await loadPaymentsData();
    
    // Set up event listeners
    setupEventListeners();
    
    // Render initial table
    renderTable();
    
  } catch (error) {
    console.error('Error initializing payments table:', error);
    showTableError();
  }
}

/* ============================================
   LOAD PAYMENTS DATA
   ============================================ */
async function loadPaymentsData() {
  try {
    console.log('[Payments Table] Loading payments data...');
    
    const response = await fetch('/admin/api/admin/payments');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[Payments Table] Received data:', data);
    
    allPayments = data.payments || [];
    filteredPayments = [...allPayments];
    
    console.log('[Payments Table] Loaded', allPayments.length, 'payments');
    
  } catch (error) {
    console.error('[Payments Table] Error loading payments data:', error);
    // Use mock data as fallback
    console.log('[Payments Table] Using mock data as fallback');
    allPayments = getMockPayments();
    filteredPayments = [...allPayments];
  }
}

/* ============================================
   SETUP EVENT LISTENERS
   ============================================ */
function setupEventListeners() {
  // Tab buttons
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const tabName = e.target.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // Search input
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      applyFilters();
    });
  }
  
  // Status select
  const statusSelect = document.getElementById('statusSelect');
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      statusFilter = e.target.value;
      applyFilters();
    });
  }
  
  // Pagination buttons
  const prevButton = document.getElementById('prevButton');
  if (prevButton) {
    prevButton.addEventListener('click', () => goToPage(currentPage - 1));
  }
  
  const nextButton = document.getElementById('nextButton');
  if (nextButton) {
    nextButton.addEventListener('click', () => goToPage(currentPage + 1));
  }
  
  // Items per page selector
  const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
  if (itemsPerPageSelect) {
    itemsPerPageSelect.addEventListener('change', (e) => {
      itemsPerPage = parseInt(e.target.value);
      currentPage = 1; // Reset to first page
      renderTable();
    });
  }
}

/* ============================================
   SWITCH TAB
   ============================================ */
function switchTab(tabName) {
  // Remove active class from all tabs and buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('tab-button-active');
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('tab-content-active');
  });
  
  // Add active class to selected tab and button
  const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
  const activeContent = document.getElementById(tabName);
  
  if (activeButton) {
    activeButton.classList.add('tab-button-active');
  }
  
  if (activeContent) {
    activeContent.classList.add('tab-content-active');
  }
}

/* ============================================
   APPLY FILTERS
   ============================================ */
function applyFilters() {
  filteredPayments = allPayments.filter(payment => {
    // Status filter
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
    
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      searchQuery === '' ||
      payment.customer_name.toLowerCase().includes(searchLower) ||
      payment.lead_title.toLowerCase().includes(searchLower) ||
      payment.lead_id.toLowerCase().includes(searchLower);
    
    return matchesStatus && matchesSearch;
  });
  
  // Reset to page 1 when filters change
  currentPage = 1;
  renderTable();
}

/* ============================================
   GO TO PAGE
   ============================================ */
function goToPage(page) {
  const { totalPages } = calculatePagination();
  currentPage = Math.max(1, Math.min(page, totalPages));
  renderTable();
}

/* ============================================
   CALCULATE PAGINATION
   ============================================ */
function calculatePagination() {
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPayments = filteredPayments.slice(startIndex, endIndex);
  
  return {
    totalPages,
    startIndex,
    endIndex,
    currentPayments,
    totalResults: filteredPayments.length
  };
}

/* ============================================
   RENDER TABLE
   ============================================ */
function renderTable() {
  const { currentPayments, totalPages, startIndex, endIndex, totalResults } = calculatePagination();
  
  // Render table body
  renderTableBody(currentPayments);
  
  // Render pagination
  renderPagination(totalPages, startIndex, endIndex, totalResults);
}

/* ============================================
   RENDER TABLE BODY
   ============================================ */
function renderTableBody(payments) {
  const tbody = document.getElementById('paymentsTableBody');
  if (!tbody) return;
  
  if (payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-cell text-center py-12">
          <p class="text-gray-500">Geen betalingen gevonden</p>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = payments.map(payment => `
    <tr class="table-body-row">
      <!-- Datum -->
      <td class="table-cell">
        <span class="cell-text">${formatDateTime(payment.created_at)}</span>
      </td>
      
      <!-- Aanvragen -->
      <td class="table-cell">
        <div class="cell-column">
          <span class="lead-id-badge">${payment.lead_id}</span>
          <span class="lead-title">${payment.lead_title}</span>
        </div>
      </td>
      
      <!-- Klant -->
      <td class="table-cell">
        <div class="cell-column">
          <span class="customer-name">${payment.customer_name}</span>
          <span class="customer-id">${payment.customer_id}</span>
        </div>
      </td>
      
      <!-- Bedrag -->
      <td class="table-cell">
        <span class="amount-gross">${formatCurrency(payment.amount_gross)}</span>
      </td>
      
      <!-- Status -->
      <td class="table-cell">
        <span class="status-badge ${getStatusColor(payment.status)}">${getStatusLabel(payment.status)}</span>
      </td>
      
      <!-- Acties -->
      <td class="table-cell">
        <button class="actions-button" onclick="showActionsMenu('${payment.payment_id}', event)" title="Meer acties">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"/>
            <circle cx="12" cy="5" r="1"/>
            <circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join('');
}

/* ============================================
   RENDER PAGINATION
   ============================================ */
function renderPagination(totalPages, startIndex, endIndex, totalResults) {
  // Update results info
  const resultsInfo = document.getElementById('paginationInfo');
  if (resultsInfo) {
    resultsInfo.textContent = `Toont ${startIndex + 1} tot ${Math.min(endIndex, totalResults)} van ${totalResults} resultaten`;
  }
  
  // Update pagination buttons
  const paginationButtons = document.getElementById('paginationButtons');
  if (!paginationButtons) return;
  
  // Update prev/next buttons
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
  
  if (prevButton) {
    prevButton.disabled = currentPage === 1;
  }
  
  if (nextButton) {
    nextButton.disabled = currentPage === totalPages;
  }
  
  // Generate page buttons (max 8 pages shown)
  const pageButtons = [];
  const maxPagesToShow = 8;
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
  
  // Adjust start page if we're near the end
  if (endPage - startPage < maxPagesToShow - 1) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    const isActive = i === currentPage;
    pageButtons.push(`
      <button class="pagination-page ${isActive ? 'pagination-page-active' : ''}" onclick="goToPage(${i})">
        ${i}
      </button>
    `);
  }
  
  // Update pagination buttons container
  paginationButtons.innerHTML = `
    <button class="pagination-nav" id="prevButton" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>
    ${pageButtons.join('')}
    <button class="pagination-nav" id="nextButton" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </button>
  `;
}

/* ============================================
   FORMAT DATE TIME
   ============================================ */
function formatDateTime(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

/* ============================================
   FORMAT CURRENCY
   ============================================ */
function formatCurrency(amountInCents) {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR'
  }).format(amountInCents / 100);
}

/* ============================================
   GET STATUS COLOR
   ============================================ */
function getStatusColor(status) {
  const colors = {
    'paid': 'status-paid',
    'pending': 'status-pending',
    'failed': 'status-failed',
    'refunded': 'status-refunded'
  };
  return colors[status] || 'status-pending';
}

/* ============================================
   GET STATUS LABEL
   ============================================ */
function getStatusLabel(status) {
  const labels = {
    'paid': 'Betaald',
    'pending': 'In behandeling',
    'failed': 'Mislukt',
    'refunded': 'Terugbetaald'
  };
  return labels[status] || status;
}

/* ============================================
   SHOW ACTIONS MENU
   ============================================ */
function showActionsMenu(paymentId, event) {
  // Find the payment data
  const payment = allPayments.find(p => p.payment_id === paymentId);
  if (!payment) {
    console.error('Payment not found:', paymentId);
    return;
  }

  console.log('showActionsMenu called for payment:', paymentId);

  // Remove any existing dropdown
  const existingDropdown = document.querySelector('.actions-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
    return; // Exit early if we just closed a dropdown
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
  
  console.log('Dropdown created:', dropdown);
  console.log('Payment data:', payment);

  // Add menu items
  const menuItems = [
    {
      label: 'Receipt opnieuw sturen',
      icon: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6',
      action: () => showResendModal(payment)
    }
  ];

  // Add refund option for paid payments
  if (payment.status === 'paid') {
    menuItems.push({
      label: 'Refund',
      icon: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16 M3 21v-5h5',
      action: () => showRefundModal(payment)
    });
  }

  // Add invoice option if invoice exists (for now, always show it for testing)
  menuItems.push({
    label: 'Bekijk factuur',
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
    action: () => viewInvoice(payment.payment_id)
  });

  // Create menu items
  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = 'actions-menu-item';
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
      dropdown.remove();
    });

    dropdown.appendChild(menuItem);
  });

  // Position dropdown
  const button = event.target.closest('.actions-button');
  const rect = button.getBoundingClientRect();
  dropdown.style.left = `${rect.left - 150}px`;
  dropdown.style.top = `${rect.bottom + 4}px`;

  console.log('Button rect:', rect);
  console.log('Dropdown position:', dropdown.style.left, dropdown.style.top);

  // Add to document
  document.body.appendChild(dropdown);
  console.log('Dropdown added to DOM');

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
}

/* ============================================
   NAVIGATE TO INVOICE
   ============================================ */
function viewInvoice(paymentId) {
  // Navigate to invoice page
  window.location.href = `/admin/payments/invoice/${paymentId}`;
}

/* ============================================
   SHOW RESEND MODAL
   ============================================ */
function showResendModal(payment) {
  // TODO: Implement resend modal
  console.log('Show resend modal for payment:', payment.payment_id);
  alert(`Resend receipt modal for payment: ${payment.payment_id}\n\nThis will be implemented with the React modal component.`);
}

/* ============================================
   SHOW REFUND MODAL
   ============================================ */
function showRefundModal(payment) {
  // TODO: Implement refund modal
  console.log('Show refund modal for payment:', payment.payment_id);
  alert(`Refund modal for payment: ${payment.payment_id}\n\nThis will be implemented with the React modal component.`);
}

/* ============================================
   SHOW TABLE ERROR
   ============================================ */
function showTableError() {
  const tbody = document.getElementById('paymentsTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-cell text-center py-12">
          <p class="text-red-500">Er is een fout opgetreden bij het laden van de gegevens</p>
        </td>
      </tr>
    `;
  }
}

/* ============================================
   MOCK DATA (Fallback)
   ============================================ */
function getMockPayments() {
  const now = new Date();
  const payments = [];
  
  // Generate 20 mock payments
  for (let i = 1; i <= 20; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const createdDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    
    const customers = [
      'Jan de Vries', 'Maria Jansen', 'Piet Bakker', 'Lisa van der Berg',
      'Tom Hendriks', 'Sandra Mulder', 'Mark de Jong', 'Anna Visser',
      'Rob van Dijk', 'Eva Smit', 'Paul de Wit', 'Linda Bakker'
    ];
    
    const leadTitles = [
      'Website ontwikkeling', 'SEO optimalisatie', 'Social media campagne',
      'Google Ads beheer', 'Content marketing', 'E-mail marketing',
      'Logo ontwerp', 'Branding strategie', 'Webshop ontwikkeling',
      'Mobile app ontwikkeling', 'Database optimalisatie', 'Security audit'
    ];
    
    const statuses = ['paid', 'pending', 'failed', 'refunded'];
    const weights = [0.7, 0.2, 0.08, 0.02]; // 70% paid, 20% pending, 8% failed, 2% refunded
    
    const randomStatus = () => {
      const random = Math.random();
      let cumulative = 0;
      for (let j = 0; j < statuses.length; j++) {
        cumulative += weights[j];
        if (random <= cumulative) {
          return statuses[j];
        }
      }
      return 'paid';
    };
    
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const leadTitle = leadTitles[Math.floor(Math.random() * leadTitles.length)];
    const status = randomStatus();
    
    // Generate realistic amounts
    const baseAmount = Math.floor(Math.random() * 2000) + 100; // €100 - €2100
    const amountGross = baseAmount * 100; // Convert to cents
    const feeTotal = Math.round(amountGross * 0.029 + 35); // 2.9% + €0.35
    const amountNet = amountGross - feeTotal;
    
    payments.push({
      payment_id: `pay_${String(i).padStart(3, '0')}`,
      created_at: createdDate.toISOString(),
      lead_id: `lead_${String(i).padStart(3, '0')}`,
      lead_title: leadTitle,
      customer_name: customer,
      customer_id: `cust_${Math.random().toString(36).substr(2, 6)}`,
      amount_gross: amountGross,
      status: status
    });
  }
  
  // Sort by created_at descending
  return payments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
