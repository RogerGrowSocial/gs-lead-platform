// Services Management JavaScript

let currentPeriod = '30d';
let allServices = [];
let editingServiceId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  initializeServices();
  setupEventListeners();
  loadKPIData();
  loadServiceMetrics();
});

// Initialize services page
function initializeServices() {
  // Load services from server (already rendered in EJS)
  const tableBody = document.getElementById('servicesTableBody');
  if (tableBody) {
    const rows = tableBody.querySelectorAll('tr[data-service-id]');
    rows.forEach(row => {
      const serviceId = row.getAttribute('data-service-id');
      
      // Make row clickable (except action buttons)
      row.style.cursor = 'pointer';
      row.addEventListener('click', (e) => {
        // Don't navigate if clicking on buttons or links
        if (e.target.closest('button') || e.target.closest('a')) {
          return;
        }
        window.location.href = `/admin/services/${serviceId}`;
      });
      
      // Add hover effect
      row.addEventListener('mouseenter', () => {
        row.style.backgroundColor = '#f9fafb';
      });
      row.addEventListener('mouseleave', () => {
        row.style.backgroundColor = '';
      });
    });
  }
}

// Setup event listeners
function setupEventListeners() {
  // Add service button
  const addBtn = document.getElementById('addServiceBtn');
  const addBtnEmpty = document.getElementById('addServiceBtnEmpty');
  if (addBtn) addBtn.addEventListener('click', () => openServiceModal());
  if (addBtnEmpty) addBtnEmpty.addEventListener('click', () => openServiceModal());
  
  // Edit buttons
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const serviceId = e.currentTarget.getAttribute('data-service-id');
      editService(serviceId);
    });
  });
  
  // Archive buttons
  document.querySelectorAll('.btn-archive').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const serviceId = e.currentTarget.getAttribute('data-service-id');
      archiveService(serviceId);
    });
  });
  
  // Unarchive buttons
  document.querySelectorAll('.btn-unarchive').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const serviceId = e.currentTarget.getAttribute('data-service-id');
      unarchiveService(serviceId);
    });
  });
  
  // Modal close
  const modal = document.getElementById('serviceModal');
  const modalClose = document.getElementById('modalClose');
  const modalCancel = document.getElementById('modalCancel');
  if (modalClose) modalClose.addEventListener('click', () => closeServiceModal());
  if (modalCancel) modalCancel.addEventListener('click', () => closeServiceModal());
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeServiceModal();
    });
  }
  
  // Form submit
  const form = document.getElementById('serviceForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saveService();
    });
  }
  
  // Auto-generate slug from name
  const nameInput = document.getElementById('serviceName');
  const slugInput = document.getElementById('serviceSlug');
  if (nameInput && slugInput) {
    nameInput.addEventListener('input', () => {
      if (!editingServiceId) {
        const slug = generateSlug(nameInput.value);
        slugInput.value = slug;
      }
    });
  }
  
  // Search and filters
  const searchInput = document.getElementById('searchServices');
  const statusFilter = document.getElementById('statusFilter');
  const typeFilter = document.getElementById('typeFilter');
  
  if (searchInput) {
    searchInput.addEventListener('input', debounce(applyFilters, 300));
  }
  if (statusFilter) {
    statusFilter.addEventListener('change', applyFilters);
  }
  if (typeFilter) {
    typeFilter.addEventListener('change', applyFilters);
  }
  
  // Period selector
  const periodInput = document.querySelector('[name="period"]');
  if (periodInput) {
    periodInput.addEventListener('change', (e) => {
      currentPeriod = e.target.value;
      loadKPIData();
      loadServiceMetrics();
    });
  }
  
  // Pagination
  const prevBtn = document.querySelector('.btn-prev');
  const nextBtn = document.querySelector('.btn-next');
  if (prevBtn) prevBtn.addEventListener('click', () => goToPage('prev'));
  if (nextBtn) nextBtn.addEventListener('click', () => goToPage('next'));
}

// Generate slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Open service modal
function openServiceModal(service = null) {
  editingServiceId = service ? service.id : null;
  const modal = document.getElementById('serviceModal');
  const form = document.getElementById('serviceForm');
  const title = document.getElementById('modalTitle');
  const errorDiv = document.getElementById('serviceFormError');
  
  if (!modal || !form) return;
  
  // Reset form
  form.reset();
  if (errorDiv) errorDiv.style.display = 'none';
  
  // Set title
  if (title) {
    title.textContent = service ? 'Dienst bewerken' : 'Nieuwe dienst';
  }
  
  // Populate form if editing
  if (service) {
    document.getElementById('serviceId').value = service.id;
    document.getElementById('serviceName').value = service.name || '';
    document.getElementById('serviceSlug').value = service.slug || '';
    document.getElementById('serviceType').value = service.service_type || 'one_time';
    document.getElementById('serviceStatus').value = service.status || 'active';
    document.getElementById('servicePrice').value = service.price_cents ? (service.price_cents / 100).toFixed(2) : '';
    document.getElementById('serviceCost').value = service.cost_cents !== null ? (service.cost_cents / 100).toFixed(2) : '';
    document.getElementById('serviceUnitLabel').value = service.unit_label || '';
    document.getElementById('serviceDescription').value = service.description || '';
  }
  
  // Show modal
  modal.style.display = 'flex';
}

// Close service modal
function closeServiceModal() {
  const modal = document.getElementById('serviceModal');
  if (modal) {
    modal.style.display = 'none';
    editingServiceId = null;
  }
}

// Save service
async function saveService() {
  const form = document.getElementById('serviceForm');
  const errorDiv = document.getElementById('serviceFormError');
  
  if (!form) return;
  
  const formData = new FormData(form);
  const data = {
    name: formData.get('name'),
    slug: formData.get('slug'),
    description: formData.get('description'),
    service_type: formData.get('service_type'),
    status: formData.get('status'),
    price_cents: parseFloat(formData.get('price_cents')),
    cost_cents: parseFloat(formData.get('cost_cents')),
    unit_label: formData.get('unit_label')
  };
  
  // Validation
  if (!data.name || !data.slug) {
    showError('Naam en slug zijn verplicht');
    return;
  }
  
  if (isNaN(data.price_cents) || data.price_cents < 0) {
    showError('Verkoopprijs moet een geldig positief getal zijn');
    return;
  }
  
  if (isNaN(data.cost_cents) || data.cost_cents < 0) {
    showError('Inkoopkost moet een geldig positief getal zijn');
    return;
  }
  
  try {
    const url = editingServiceId 
      ? `/api/admin/services/${editingServiceId}`
      : '/api/admin/services';
    const method = editingServiceId ? 'PATCH' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Fout bij opslaan dienst');
    }
    
    // Show success notification
    if (typeof window.showNotification === 'function') {
      window.showNotification(
        editingServiceId ? 'Dienst succesvol bijgewerkt' : 'Dienst succesvol aangemaakt',
        'success',
        3000
      );
    }
    
    // Reload page
    window.location.reload();
  } catch (error) {
    console.error('Error saving service:', error);
    showError(error.message || 'Er is een fout opgetreden bij het opslaan');
  }
}

// Edit service
async function editService(serviceId) {
  try {
    const response = await fetch(`/api/admin/services?search=&status=all&type=all&page=1&pageSize=1000`, {
      credentials: 'same-origin'
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error('Fout bij ophalen diensten');
    }
    
    const service = result.data.find(s => s.id === serviceId);
    if (service) {
      openServiceModal(service);
    }
  } catch (error) {
    console.error('Error loading service:', error);
    if (typeof window.showNotification === 'function') {
      window.showNotification('Fout bij laden dienst', 'error', 3000);
    }
  }
}

// Archive service
async function archiveService(serviceId) {
  if (!confirm('Weet je zeker dat je deze dienst wilt archiveren?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/services/${serviceId}/archive`, {
      method: 'POST',
      credentials: 'same-origin'
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Fout bij archiveren dienst');
    }
    
    if (typeof window.showNotification === 'function') {
      window.showNotification('Dienst succesvol gearchiveerd', 'success', 3000);
    }
    
    window.location.reload();
  } catch (error) {
    console.error('Error archiving service:', error);
    if (typeof window.showNotification === 'function') {
      window.showNotification(error.message || 'Fout bij archiveren dienst', 'error', 3000);
    }
  }
}

// Unarchive service
async function unarchiveService(serviceId) {
  try {
    const response = await fetch(`/api/admin/services/${serviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status: 'active' })
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Fout bij herstellen dienst');
    }
    
    if (typeof window.showNotification === 'function') {
      window.showNotification('Dienst succesvol hersteld', 'success', 3000);
    }
    
    window.location.reload();
  } catch (error) {
    console.error('Error unarchiving service:', error);
    if (typeof window.showNotification === 'function') {
      window.showNotification(error.message || 'Fout bij herstellen dienst', 'error', 3000);
    }
  }
}

// Load KPI data
async function loadKPIData() {
  try {
    const response = await fetch(`/api/admin/services/kpis?period=${currentPeriod}`, {
      credentials: 'same-origin'
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error('Fout bij ophalen KPI data');
    }
    
    const data = result.data;
    
    // Update KPI cards
    const totalRevenueEl = document.getElementById('totalRevenue');
    const totalProfitEl = document.getElementById('totalProfit');
    const weightedMarginEl = document.getElementById('weightedMargin');
    const topServiceEl = document.getElementById('topService');
    const topServiceRevenueEl = document.getElementById('topServiceRevenue');
    
    if (totalRevenueEl) {
      totalRevenueEl.textContent = data.total_revenue_cents !== null 
        ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(data.total_revenue_cents / 100)
        : '—';
    }
    
    if (totalProfitEl) {
      totalProfitEl.textContent = data.total_profit_cents !== null
        ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(data.total_profit_cents / 100)
        : '—';
    }
    
    if (weightedMarginEl) {
      weightedMarginEl.textContent = data.weighted_margin_percent !== null
        ? `${data.weighted_margin_percent.toFixed(1)}%`
        : '—';
    }
    
    if (topServiceEl && data.top_service) {
      topServiceEl.textContent = data.top_service.name || '—';
      if (topServiceRevenueEl) {
        topServiceRevenueEl.textContent = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(data.top_service.revenue_cents / 100);
      }
    } else {
      if (topServiceEl) topServiceEl.textContent = '—';
      if (topServiceRevenueEl) topServiceRevenueEl.textContent = '—';
    }
    
    // Update subtitle
    const periodLabels = {
      '30d': 'Laatste 30 dagen',
      '90d': 'Laatste 90 dagen',
      '365d': 'Laatste jaar'
    };
    const subtitle = periodLabels[currentPeriod] || 'Laatste 30 dagen';
    const revenueSubtitle = document.getElementById('revenueSubtitle');
    if (revenueSubtitle) revenueSubtitle.textContent = subtitle;
    
  } catch (error) {
    console.error('Error loading KPI data:', error);
  }
}

// Apply filters
function applyFilters() {
  const search = document.getElementById('searchServices')?.value || '';
  const status = document.getElementById('statusFilter')?.value || 'all';
  const type = document.getElementById('typeFilter')?.value || 'all';
  
  const url = new URL(window.location.href);
  if (search) url.searchParams.set('search', search);
  else url.searchParams.delete('search');
  
  if (status !== 'all') url.searchParams.set('status', status);
  else url.searchParams.delete('status');
  
  if (type !== 'all') url.searchParams.set('type', type);
  else url.searchParams.delete('type');
  
  url.searchParams.set('page', '1');
  
  window.location.href = url.toString();
}

// Go to page
function goToPage(direction) {
  const url = new URL(window.location.href);
  const currentPage = parseInt(url.searchParams.get('page') || '1');
  const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
  url.searchParams.set('page', newPage);
  window.location.href = url.toString();
}

// Show error
function showError(message) {
  const errorDiv = document.getElementById('serviceFormError');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

// Load service metrics (last sold, revenue) for table
async function loadServiceMetrics() {
  try {
    const response = await fetch(`/api/admin/services/analytics?period=${currentPeriod}`, {
      credentials: 'same-origin'
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      return; // Silently fail, table will show "—"
    }
    
    const breakdown = result.data || [];
    const metricsMap = {};
    
    breakdown.forEach(service => {
      metricsMap[service.service_id] = {
        last_sold_at: service.last_sold_at,
        revenue_cents: service.revenue_cents
      };
    });
    
    // Update table rows
    const tableBody = document.getElementById('servicesTableBody');
    if (tableBody) {
      const rows = tableBody.querySelectorAll('tr[data-service-id]');
      rows.forEach(row => {
        const serviceId = row.getAttribute('data-service-id');
        if (!serviceId) return;
        
        const metrics = metricsMap[serviceId];
        if (metrics) {
          // Find cells - need to account for admin vs employee column count
          const cells = row.querySelectorAll('td');
          const isAdmin = cells.length > 6; // Admin has more columns
          
          // Last sold is second-to-last (before revenue, before actions if admin)
          const lastSoldIndex = isAdmin ? cells.length - 3 : cells.length - 2;
          const revenueIndex = isAdmin ? cells.length - 2 : cells.length - 1;
          
          // Update last sold date
          if (cells[lastSoldIndex]) {
            if (metrics.last_sold_at) {
              const date = new Date(metrics.last_sold_at);
              cells[lastSoldIndex].textContent = date.toLocaleDateString('nl-NL', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
              });
            } else {
              cells[lastSoldIndex].textContent = '—';
            }
          }
          
          // Update revenue
          if (cells[revenueIndex] && !cells[revenueIndex].querySelector('button')) {
            if (metrics.revenue_cents !== null && metrics.revenue_cents !== undefined) {
              cells[revenueIndex].textContent = new Intl.NumberFormat('nl-NL', { 
                style: 'currency', 
                currency: 'EUR' 
              }).format(metrics.revenue_cents / 100);
              cells[revenueIndex].style.fontWeight = '500';
            } else {
              cells[revenueIndex].textContent = '—';
            }
          }
        }
      });
    }
  } catch (error) {
    console.error('Error loading service metrics:', error);
    // Silently fail, table will show "—"
  }
}

// Debounce helper
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

