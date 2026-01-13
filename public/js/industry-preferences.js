// Industry Preferences Management
document.addEventListener('DOMContentLoaded', function() {
  const industryPreferencesGrid = document.getElementById('industryPreferencesGrid');
  const saveBtn = document.getElementById('saveIndustryPreferencesBtn');
  
  if (!industryPreferencesGrid || !saveBtn) {
    console.log('Industry preferences elements not found');
    return;
  }
  
  let currentPreferences = [];
  let isLoading = false;
  
  // Initialize industry preferences
  initIndustryPreferences();
  
  // Save button event listener
  console.log('Adding save button event listener to:', saveBtn);
  saveBtn.addEventListener('click', function(e) {
    console.log('Save button clicked!');
    e.preventDefault();
    saveIndustryPreferences();
  });
  
  async function initIndustryPreferences() {
    try {
      showLoading();
      
      console.log('Initializing industry preferences...');
      
      // Load industries first (this is the main data source)
      await loadAvailableIndustries();
      
      // Then try to load user preferences (this might fail if user has no preferences yet)
      try {
        await loadIndustryPreferences();
      } catch (error) {
        console.log('No user preferences found yet, using defaults');
      }
      
      console.log('Final preferences before render:', currentPreferences);
      renderIndustryPreferences();
    } catch (error) {
      console.error('Error initializing industry preferences:', error);
      showError('Fout bij laden van branche voorkeuren: ' + error.message);
    }
  }
  
  function showLoading() {
    industryPreferencesGrid.innerHTML = `
      <div class="industry-preferences-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Branche voorkeuren laden...</p>
      </div>
    `;
  }
  
  function showError(message) {
    industryPreferencesGrid.innerHTML = `
      <div class="industry-preferences-empty">
        <i class="fas fa-exclamation-triangle"></i>
        <p>${message}</p>
      </div>
    `;
  }
  
  async function loadIndustryPreferences() {
    try {
      const response = await fetch('/api/users/current/industry-preferences', {
        credentials: 'include'
      });
      
      if (response.ok) {
        currentPreferences = await response.json();
      } else {
        console.error('Failed to load industry preferences:', response.status);
        currentPreferences = [];
      }
    } catch (error) {
      console.error('Error loading industry preferences:', error);
      currentPreferences = [];
    }
  }
  
  async function loadAvailableIndustries() {
    try {
      console.log('Loading industries from API...');
      const response = await fetch('/api/industries', {
        credentials: 'include'
      });
      
      console.log('API Response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('API Response:', result);
        
        // Handle both response formats
        let industries;
        if (result.success && result.data) {
          industries = result.data;
        } else if (Array.isArray(result)) {
          industries = result;
        } else {
          industries = result;
        }
        
        console.log('Loaded industries:', industries);
        
        if (!industries || industries.length === 0) {
          throw new Error('No industries returned from API');
        }
        
        // Merge with current preferences
        currentPreferences = industries.map(industry => {
          const existingPreference = currentPreferences.find(p => p.industry_id === industry.id);
          return {
            industry_id: industry.id,
            industry_name: industry.name,
            industry_description: industry.description || '',
            industry_price: industry.price_per_lead || 0,
            is_enabled: existingPreference ? existingPreference.is_enabled : false
          };
        });
        
        console.log('Processed preferences:', currentPreferences);
      } else {
        const errorText = await response.text();
        console.error('Failed to load industries:', response.status, response.statusText, errorText);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading industries:', error);
      throw error; // Re-throw to be caught by initIndustryPreferences
    }
  }
  
  function renderIndustryPreferences() {
    console.log('Rendering preferences:', currentPreferences);
    
    if (!currentPreferences || currentPreferences.length === 0) {
      console.log('No preferences to render');
      showError('Geen branches beschikbaar');
      return;
    }
    
    // Map industry names to appropriate icons
    const industryIcons = {
      'Dakdekkers': 'fas fa-home',
      'Schilders': 'fas fa-paint-brush',
      'Hoveniers': 'fas fa-seedling',
      'Installatiebedrijven': 'fas fa-tools',
      'Glaszetters': 'fas fa-window-maximize',
      'default': 'fas fa-industry'
    };
    
    const html = currentPreferences.map(preference => {
      const icon = industryIcons[preference.industry_name] || industryIcons.default;
      
      return `
        <div class="industry-preference-item ${preference.is_enabled ? 'enabled' : ''}" 
             data-industry-id="${preference.industry_id}">
          <input type="checkbox" 
                 class="industry-preference-checkbox" 
                 id="industry-${preference.industry_id}"
                 ${preference.is_enabled ? 'checked' : ''}>
          <div class="industry-preference-content">
            <div class="industry-preference-header">
              <div class="industry-preference-icon">
                <i class="${icon}"></i>
              </div>
              <div class="industry-preference-info">
                <div class="industry-preference-name">${preference.industry_name}</div>
                ${preference.industry_description ? `<div class="industry-preference-description">${preference.industry_description}</div>` : ''}
              </div>
            </div>
            ${preference.industry_price > 0 ? `<div class="industry-preference-price">€${preference.industry_price.toFixed(2)} per lead</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    console.log('Generated HTML:', html);
    industryPreferencesGrid.innerHTML = html;
    
  // Add click event listeners
  console.log('Adding click event listeners to', industryPreferencesGrid.querySelectorAll('.industry-preference-item').length, 'items');
  industryPreferencesGrid.querySelectorAll('.industry-preference-item').forEach(item => {
    console.log('Adding listener to item:', item);
    item.addEventListener('click', function(e) {
      console.log('Item clicked:', this);
      e.preventDefault();
      toggleIndustryPreference(this);
    });
  });
  }
  
  function toggleIndustryPreference(item) {
    const industryId = item.getAttribute('data-industry-id');
    const checkbox = item.querySelector('.industry-preference-checkbox');
    const preference = currentPreferences.find(p => p.industry_id == industryId);
    
    console.log('Toggling preference for industry:', industryId, 'Current state:', preference?.is_enabled);
    
    if (preference) {
      preference.is_enabled = !preference.is_enabled;
      checkbox.checked = preference.is_enabled;
      
      if (preference.is_enabled) {
        item.classList.add('enabled');
      } else {
        item.classList.remove('enabled');
      }
      
      console.log('New state:', preference.is_enabled);
    }
  }
  
  async function saveIndustryPreferences() {
    if (isLoading) return;
    
    const saveBtn = document.getElementById('saveIndustryPreferencesBtn');
    if (!saveBtn) return;
    
    try {
      isLoading = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opslaan...';
      saveBtn.disabled = true;
      
      const response = await fetch('/api/users/current/industry-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          preferences: currentPreferences.map(p => ({
            industry_id: p.industry_id,
            is_enabled: p.is_enabled
          }))
        })
      });
      
      if (response.ok) {
        showNotification('Branche voorkeuren opgeslagen!', 'success');
      } else {
        throw new Error('Failed to save preferences');
      }
      
    } catch (error) {
      console.error('Error saving industry preferences:', error);
      showNotification('Fout bij opslaan van voorkeuren', 'error');
    } finally {
      isLoading = false;
      saveBtn.innerHTML = '<i class="fas fa-save"></i> Voorkeuren Opslaan';
      saveBtn.disabled = false;
    }
  }
  
  // Notification function
  function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }
});
