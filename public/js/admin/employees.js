// Employees page filters and interactions
document.addEventListener('DOMContentLoaded', function() {
  const statusFilter = document.getElementById('statusFilter');
  const roleFilter = document.getElementById('roleFilter');
  const searchInput = document.getElementById('searchEmployees');
  
  // Function to apply filters and reload page with query params
  function applyFilters() {
    const params = new URLSearchParams();
    
    // Get current URL params
    const currentParams = new URLSearchParams(window.location.search);
    
    // Add search
    if (searchInput && searchInput.value.trim()) {
      params.set('search', searchInput.value.trim());
    } else {
      params.delete('search');
    }
    
    // Add status filter
    if (statusFilter && statusFilter.value !== 'all') {
      params.set('status', statusFilter.value);
    } else {
      params.delete('status');
    }
    
    // Add role filter
    if (roleFilter && roleFilter.value !== 'all') {
      params.set('role', roleFilter.value);
    } else {
      params.delete('role');
    }
    
    // Navigate to new URL with filters
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.location.href = newUrl;
  }
  
  // Add event listeners
  if (statusFilter) {
    statusFilter.addEventListener('change', applyFilters);
  }
  
  if (roleFilter) {
    roleFilter.addEventListener('change', applyFilters);
  }
  
  // Search with debounce
  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(applyFilters, 500);
    });
    
    // Also trigger on Enter
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        clearTimeout(searchTimeout);
        applyFilters();
      }
    });
  }
});

