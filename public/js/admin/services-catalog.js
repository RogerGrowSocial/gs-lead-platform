// Services Catalog JavaScript

let editingServiceId = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  setupEventListeners();
});

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

