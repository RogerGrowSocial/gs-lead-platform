// Admin Customers - Right drawer modal for creating a new customer
// Loaded on /admin/customers via routes/admin.js -> scripts
(function () {
  'use strict';

  // Prevent double-init if script is included twice (layout + inline fallback, etc.)
  if (window.__gsCustomersDrawerInit) return;
  window.__gsCustomersDrawerInit = true;

  const DRAWER_ID = 'customerDrawer';
  const OVERLAY_ID = 'customerDrawerOverlay';

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function setOpen(isOpen) {
    const drawer = qs(`#${DRAWER_ID}`);
    const overlay = qs(`#${OVERLAY_ID}`);
    if (!drawer || !overlay) return;

    drawer.classList.toggle('is-open', isOpen);
    overlay.classList.toggle('is-open', isOpen);
    document.documentElement.classList.toggle('drawer-open', isOpen);
    document.body.classList.toggle('drawer-open', isOpen);

    // Inline-style fallback (so it still works even if CSS fails to load)
    drawer.style.transform = isOpen ? 'translateX(0)' : 'translateX(110%)';
    overlay.style.opacity = isOpen ? '1' : '0';
    overlay.style.pointerEvents = isOpen ? 'auto' : 'none';

    drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }

  function resetForm() {
    const form = qs('#customerCreateForm');
    if (!form) return;
    form.reset();
    const submit = qs('#customerCreateSubmit');
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Aanmaken';
    }
    const err = qs('#customerCreateError');
    if (err) {
      err.textContent = '';
      err.style.display = 'none';
    }
  }

  async function submitCustomer(payload) {
    const submit = qs('#customerCreateSubmit');
    const err = qs('#customerCreateError');
    if (err) {
      err.textContent = '';
      err.style.display = 'none';
    }

    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Bezig...';
    }

    try {
      const res = await fetch('/admin/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      console.log('📥 Response data:', data);
      
      if (!res.ok || !data?.success) {
        const message = data?.error || data?.message || 'Kon klant niet aanmaken.';
        if (err) {
          err.textContent = message;
          err.style.display = '';
        }
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Aanmaken';
        }
        // Show error notification
        if (typeof window.showNotification === 'function') {
          window.showNotification(message, 'error', 5000);
        }
        return;
      }

      // Show success notification using platform notification system
      let notificationMessage = data.message || 'Klant succesvol aangemaakt.';
      let notificationType = 'success';
      
      // Check if email was sent
      if (data.email_sent === false || data.email_error) {
        notificationType = 'warning';
        if (data.email_error) {
          notificationMessage += ` ⚠️ Email probleem: ${data.email_error}`;
        } else {
          notificationMessage += ' ⚠️ Welkomstemail kon niet worden verstuurd.';
        }
        console.warn('Email sending issue:', data.email_error || 'Unknown error');
      }
      
      if (typeof window.showNotification === 'function') {
        window.showNotification(notificationMessage, notificationType, 6000);
      }

      // Close drawer and reset form
      setOpen(false);
      resetForm();

      // Reload page to show new customer
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (e) {
      const errorMessage = e?.message || 'Netwerkfout.';
      if (err) {
        err.textContent = errorMessage;
        err.style.display = '';
      }
      if (submit) {
        submit.disabled = false;
        submit.textContent = 'Aanmaken';
      }
      // Show error notification
      if (typeof window.showNotification === 'function') {
        window.showNotification(errorMessage, 'error', 5000);
      }
    }
  }

  function openDrawer() {
    const drawer = qs(`#${DRAWER_ID}`);
    if (!drawer) return;
    resetForm();
    setOpen(true);
    // Initialize address autocomplete when drawer opens (with delay to ensure DOM is ready)
    // Reset flag first
    autocompleteInitialized = false;
    
    // Wait for drawer animation to complete and DOM to be ready
    setTimeout(() => {
      console.log('[customersDrawer] Opening drawer, initializing autocomplete...');
      initAddressAutocomplete();
    }, 300); // Increased delay to ensure drawer is fully visible and DOM is ready
    // focus first input
    const first = qs('#customer_company_name', drawer);
    if (first) setTimeout(() => first.focus(), 50);
  }

  function closeDrawer() {
    setOpen(false);
  }

  function onDocumentClick(e) {
    const openBtn = e.target.closest('#createCustomerBtn, [data-action="add-customer"]');
    if (openBtn) {
      e.preventDefault();
      e.stopPropagation();
      openDrawer();
      return;
    }

    const closeBtn = e.target.closest('[data-drawer-close]');
    if (closeBtn) {
      e.preventDefault();
      closeDrawer();
      return;
    }

    // click on overlay closes
    const overlay = e.target.closest(`#${OVERLAY_ID}`);
    if (overlay) {
      closeDrawer();
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      const drawer = qs(`#${DRAWER_ID}`);
      if (drawer && drawer.classList.contains('is-open')) {
        e.preventDefault();
        closeDrawer();
      }
    }
  }

  function onSubmitClick(e) {
    const btn = e.target.closest('#customerCreateSubmit');
    if (!btn) return;
    e.preventDefault();

    const form = qs('#customerCreateForm');
    if (!form) return;

    const fd = new FormData(form);
    const createAccount = fd.get('create_account') === 'on';
    const email = String(fd.get('email') || '').trim();

    // Validate: if create_account is checked, email is required
    if (createAccount && !email) {
      const err = qs('#customerCreateError');
      if (err) {
        err.textContent = 'E-mailadres is verplicht om een account aan te maken.';
        err.style.display = '';
      }
      const emailInput = qs('#customer_email');
      if (emailInput) {
        emailInput.focus();
        emailInput.setAttribute('required', 'required');
      }
      if (typeof form.reportValidity === 'function') {
        form.reportValidity();
      }
      return;
    }

    // Remove required attribute if not creating account
    const emailInput = qs('#customer_email');
    if (emailInput && !createAccount) {
      emailInput.removeAttribute('required');
    }

    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

    // Format domain before submitting
    let domain = String(fd.get('domain') || '').trim();
    if (domain) {
      domain = formatDomain(domain);
    }

    // Get selected branches from hidden input
    const branchInput = qs('#branchHiddenInput');
    const branchIds = branchInput ? String(branchInput.value || '').trim() : '';
    // For now, use first branch ID if multiple selected (can be changed to support multiple later)
    const branchId = branchIds.split(',')[0] || '';
    
    const companyName = String(fd.get('company_name') || '').trim();
    
    const payload = {
      company_name: companyName,
      name: companyName, // Also set name to company_name for backwards compatibility
      email: email || null,
      phone: String(fd.get('phone') || '').trim() || null,
      domain: domain || null,
      contact_person: String(fd.get('contact_person') || '').trim() || null,
      address: String(fd.get('address') || '').trim() || null,
      city: String(fd.get('city') || '').trim() || null,
      postal_code: String(fd.get('postal_code') || '').trim() || null,
      country: String(fd.get('country') || 'NL').trim(),
      branch: branchId || null,
      status: String(fd.get('status') || 'active').trim(),
      priority: String(fd.get('priority') || 'normal').trim(),
      create_account: createAccount,
      send_welcome_email: fd.get('send_welcome_email') === 'on' && createAccount, // Only send if creating account
    };

    submitCustomer(payload);
  }

  function formatDomain(input) {
    if (!input) return '';
    
    let domain = input.trim();
    
    // Remove protocol if present
    domain = domain.replace(/^https?:\/\//i, '');
    
    // Remove trailing slash
    domain = domain.replace(/\/$/, '');
    
    // If domain doesn't start with www. and is not empty, add it
    if (domain && !domain.toLowerCase().startsWith('www.')) {
      // Only add www. if it looks like a domain (has a dot or is being typed)
      // Don't add if user is deleting or if it's clearly not a domain
      if (domain.length > 0 && !domain.includes(' ')) {
        domain = 'www.' + domain;
      }
    }
    
    return domain;
  }

  function initBranchMultiselect() {
    const multiselect = qs('#branchMultiselect');
    if (!multiselect) return;

    const trigger = qs('#branchMultiselectTrigger');
    const dropdown = qs('#branchMultiselectDropdown');
    const valueDisplay = qs('#branchMultiselectValue');
    const hiddenInput = qs('#branchHiddenInput');
    const checkboxes = multiselect.querySelectorAll('.branch-checkbox');
    const searchInput = qs('#branchSearchInput');
    const addInput = qs('#branchAddInput');
    const addBtn = qs('#branchAddBtn');
    const list = qs('#branchMultiselectList');

    if (!trigger || !dropdown || !valueDisplay || !hiddenInput) return;

    let selectedBranches = [];
    let allBranches = [];
    let branchesLoaded = false;

    // Load branches from API if not already in HTML
    async function loadBranches() {
      if (branchesLoaded) return;
      
      try {
        const response = await fetch('/api/admin/customer-branches', {
          credentials: 'same-origin'
        });
        const data = await response.json();
        
        if (data.success && data.data && data.data.length > 0) {
          // Clear existing items
          list.innerHTML = '';
          
          // Add branches to list
          data.data.forEach(branch => {
            const item = document.createElement('label');
            item.className = 'branch-multiselect-item';
            item.innerHTML = `
              <input type="checkbox" value="${branch.id}" data-branch-name="${branch.name}" class="branch-checkbox" />
              <span>${branch.name}</span>
            `;
            list.appendChild(item);
            
            allBranches.push({
              id: branch.id,
              name: branch.name
            });
          });
          
          // Re-initialize event listeners for new checkboxes
          attachCheckboxListeners();
          
          branchesLoaded = true;
        }
      } catch (error) {
        console.error('Error loading branches:', error);
      }
    }

    // Initialize branches list from HTML (if available)
    checkboxes.forEach(cb => {
      allBranches.push({
        id: cb.value,
        name: cb.getAttribute('data-branch-name')
      });
    });
    
    // If no branches in HTML, load from API
    if (allBranches.length === 0) {
      loadBranches();
    } else {
      branchesLoaded = true;
    }

    function updateDisplay() {
      if (selectedBranches.length === 0) {
        valueDisplay.textContent = 'Selecteer branches...';
      } else if (selectedBranches.length === 1) {
        valueDisplay.textContent = selectedBranches[0].name;
      } else {
        valueDisplay.textContent = `${selectedBranches.length} branches geselecteerd`;
      }
      
      // Update hidden input with comma-separated IDs
      hiddenInput.value = selectedBranches.map(b => b.id).join(',');
    }

    function toggleDropdown() {
      const isOpen = dropdown.style.display === 'block';
      dropdown.style.display = isOpen ? 'none' : 'block';
      trigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      trigger.classList.toggle('active', !isOpen);
      
      // Load branches when opening dropdown if not loaded yet
      if (!isOpen && !branchesLoaded) {
        loadBranches();
      }
      
      if (!isOpen && searchInput) {
        setTimeout(() => searchInput.focus(), 50);
      }
    }

    function filterBranches(searchTerm) {
      const term = searchTerm.toLowerCase();
      const items = list.querySelectorAll('.branch-multiselect-item');
      
      items.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(term) ? '' : 'none';
      });
    }

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!multiselect.contains(e.target)) {
        dropdown.style.display = 'none';
        trigger.setAttribute('aria-expanded', 'false');
        trigger.classList.remove('active');
      }
    });

    // Function to attach event listeners to checkboxes
    function attachCheckboxListeners() {
      const allCheckboxes = list.querySelectorAll('.branch-checkbox');
      allCheckboxes.forEach(cb => {
        // Check if listener already attached (using data attribute)
        if (cb.dataset.listenerAttached === 'true') return;
        
        cb.addEventListener('change', () => {
          const branchId = cb.value;
          const branchName = cb.getAttribute('data-branch-name');
          
          if (cb.checked) {
            if (!selectedBranches.find(b => b.id === branchId)) {
              selectedBranches.push({ id: branchId, name: branchName });
            }
          } else {
            selectedBranches = selectedBranches.filter(b => b.id !== branchId);
          }
          
          updateDisplay();
        });
        
        // Mark as having listener attached
        cb.dataset.listenerAttached = 'true';
      });
    }

    // Handle checkbox changes for existing checkboxes
    attachCheckboxListeners();

    // Search functionality
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        filterBranches(e.target.value);
      });
    }

    // Add new branch (if admin)
    if (addBtn && addInput) {
      addBtn.addEventListener('click', async () => {
        const branchName = addInput.value.trim();
        if (!branchName) {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Voer een branche naam in', 'error', 3000);
          }
          return;
        }

        // Check if branch already exists (check all checkboxes, not just initial ones)
        const allCheckboxes = list.querySelectorAll('.branch-checkbox');
        const existing = Array.from(allCheckboxes).find(cb => 
          cb.getAttribute('data-branch-name').toLowerCase() === branchName.toLowerCase()
        );

        if (existing) {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Deze branche bestaat al', 'error', 3000);
          }
          return;
        }

        try {
          // Create new customer branch via API (internal CRM only, separate from industries)
          const response = await fetch('/api/admin/customer-branches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ 
              name: branchName, 
              is_active: true 
            })
          });

          const data = await response.json();
          
          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Kon branche niet toevoegen');
          }

          // Add to allBranches
          const newBranch = { id: data.data.id, name: branchName };
          allBranches.push(newBranch);

          // Create new checkbox
          const newItem = document.createElement('label');
          newItem.className = 'branch-multiselect-item';
          newItem.innerHTML = `
            <input type="checkbox" value="${newBranch.id}" data-branch-name="${newBranch.name}" class="branch-checkbox" />
            <span>${newBranch.name}</span>
          `;
          
          list.appendChild(newItem);

          // Attach event listener using the helper function
          attachCheckboxListeners();

          // Auto-select the new branch
          const newCb = newItem.querySelector('.branch-checkbox');
          newCb.checked = true;
          selectedBranches.push(newBranch);
          updateDisplay();

          // Clear input
          addInput.value = '';

          if (typeof window.showNotification === 'function') {
            window.showNotification('Branche toegevoegd', 'success', 3000);
          }
        } catch (error) {
          console.error('Error adding branch:', error);
          if (typeof window.showNotification === 'function') {
            window.showNotification('Fout: ' + error.message, 'error', 5000);
          }
        }
      });

      // Allow Enter key to add
      if (addInput) {
        addInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addBtn.click();
          }
        });
      }
    }

    // Initialize display
    updateDisplay();
    
    // Close dropdown initially
    dropdown.style.display = 'none';
  }

  function initKvkSearch() {
    const companyInput = qs('#customer_company_name');
    const resultsContainer = qs('#kvkSearchResults');
    const loadingIndicator = qs('#kvkSearchLoading');
    
    if (!companyInput || !resultsContainer) return;

    let searchTimeout = null;
    let selectedIndex = -1;
    let currentResults = [];

    function hideResults() {
      resultsContainer.style.display = 'none';
      loadingIndicator.style.display = 'none';
      selectedIndex = -1;
      currentResults = [];
    }

    function showResults(results) {
      if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<div class="kvk-search-item" style="padding: 12px; text-align: center; color: #6b7280; font-size: 13px;">Geen resultaten gevonden</div>';
      } else {
        resultsContainer.innerHTML = results.map((company, index) => {
          const address = company.address;
          const addressStr = address ? 
            `${address.street || ''} ${address.houseNumber || ''}, ${address.postalCode || ''} ${address.city || ''}`.trim() : 
            '';
          
          return `
            <div class="kvk-search-item" data-index="${index}" data-kvk="${company.kvkNumber || ''}">
              <div class="kvk-search-item-name">${company.companyName || 'Onbekend'}</div>
              <div class="kvk-search-item-details">
                ${company.kvkNumber ? `<span class="kvk-search-item-kvk">KVK: ${company.kvkNumber}</span>` : ''}
                ${addressStr ? `<span>${addressStr}</span>` : ''}
                ${company.type ? `<span style="text-transform: capitalize;">${company.type}</span>` : ''}
              </div>
            </div>
          `;
        }).join('');
      }
      
      resultsContainer.style.display = 'block';
      loadingIndicator.style.display = 'none';
      currentResults = results;
      selectedIndex = -1;
    }

    async function searchCompanies(query) {
      if (query.length < 2) {
        hideResults();
        return;
      }

      loadingIndicator.style.display = 'block';
      resultsContainer.style.display = 'none';

      try {
        // Use absolute URL to ensure correct routing
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/admin/customers/search-kvk?q=${encodeURIComponent(query)}&limit=10`;
        console.log('🔍 Fetching KVK search:', url);
        
        const response = await fetch(url, {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        console.log('📥 KVK search response status:', response.status, response.statusText, response.url);

        if (!response.ok) {
          let errorText = 'Unknown error';
          try {
            errorText = await response.text();
          } catch (e) {
            console.error('Could not read error response:', e);
          }
          console.error('❌ KVK search failed:', {
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            error: errorText
          });
          
          // Don't throw error, just hide results silently
          hideResults();
          return;
        }

        const data = await response.json();
        
        if (data.success && data.data) {
          showResults(data.data);
        } else {
          hideResults();
        }
      } catch (error) {
        console.error('KVK search error:', error);
        loadingIndicator.style.display = 'none';
        // Don't show error, just hide results
        hideResults();
      }
    }

    async function selectCompany(company) {
      if (!company) return;

      // Show loading indicator
      loadingIndicator.style.display = 'block';
      loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gegevens ophalen...';

      try {
        // First fill in basic data from search result
        companyInput.value = company.companyName || '';
        
        // Fill in address fields if available from search result
        if (company.address) {
          const addressInput = qs('#customer_address');
          const cityInput = qs('#customer_city');
          const postalCodeInput = qs('#customer_postal_code');
          
          if (addressInput && company.address.street) {
            addressInput.value = `${company.address.street} ${company.address.houseNumber || ''}`.trim();
          }
          if (cityInput && company.address.city) {
            cityInput.value = company.address.city;
          }
          if (postalCodeInput && company.address.postalCode) {
            postalCodeInput.value = company.address.postalCode;
          }
        }

        // Store KVK number
        companyInput.setAttribute('data-kvk-number', company.kvkNumber || '');

        // If we have a KVK number, fetch full profile for more details
        if (company.kvkNumber) {
          try {
            const baseUrl = window.location.origin;
            const profileResponse = await fetch(`${baseUrl}/admin/customers/kvk-profile/${company.kvkNumber}`, {
              credentials: 'same-origin',
              headers: { 'Accept': 'application/json' }
            });

            if (profileResponse.ok) {
              const profileData = await profileResponse.json();
              if (profileData.success && profileData.data) {
                const profile = profileData.data;
                
                // Fill in all available fields from full profile
                
                // Company name (use official name from profile if different)
                if (profile.companyName && profile.companyName !== company.companyName) {
                  companyInput.value = profile.companyName;
                }
                
                // Address (use profile address if more complete)
                if (profile.address) {
                  const addressInput = qs('#customer_address');
                  const cityInput = qs('#customer_city');
                  const postalCodeInput = qs('#customer_postal_code');
                  const countryInput = qs('#customer_country');
                  
                  if (addressInput && profile.address.street) {
                    const fullAddress = `${profile.address.street} ${profile.address.houseNumber || ''}`.trim();
                    if (fullAddress) addressInput.value = fullAddress;
                  }
                  if (cityInput && profile.address.city) {
                    cityInput.value = profile.address.city;
                  }
                  if (postalCodeInput && profile.address.postalCode) {
                    postalCodeInput.value = profile.address.postalCode;
                  }
                  if (countryInput && profile.address.country) {
                    countryInput.value = profile.address.country;
                  }
                }
                
                // VAT number (BTW nummer)
                if (profile.vatNumber) {
                  // Store in data attribute for later use
                  companyInput.setAttribute('data-vat-number', profile.vatNumber);
                }
                
                // Try to match branche based on main activity (SBI code)
                if (profile.mainActivity) {
                  // Try to find matching industry in the dropdown
                  const industryCheckboxes = document.querySelectorAll('.branch-checkbox');
                  const activityLower = profile.mainActivity.toLowerCase();
                  
                  // Simple matching: check if any industry name is similar to the activity
                  // Split activity into words for better matching
                  const activityWords = activityLower.split(/\s+/);
                  
                  industryCheckboxes.forEach(cb => {
                    const industryName = cb.getAttribute('data-branch-name')?.toLowerCase() || '';
                    if (industryName) {
                      // Check if industry name appears in activity or vice versa
                      const industryWords = industryName.split(/\s+/);
                      const hasMatch = activityWords.some(word => 
                        word.length > 3 && industryName.includes(word)
                      ) || industryWords.some(word => 
                        word.length > 3 && activityLower.includes(word)
                      ) || activityLower.includes(industryName) || industryName.includes(activityLower);
                      
                      if (hasMatch) {
                        cb.checked = true;
                        // Trigger change event to update selection
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                      }
                    }
                  });
                }
                
                // Status - set to active if company is active
                if (profile.status) {
                  const statusSelect = qs('#customer_status');
                  if (statusSelect && profile.status.toLowerCase().includes('actief')) {
                    statusSelect.value = 'active';
                  }
                }
              }
            }
          } catch (profileError) {
            console.warn('Could not fetch full KVK profile:', profileError);
            // Continue with basic data we already have
          }
        }

        hideResults();
        
        // Trigger input event to update any listeners
        companyInput.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (error) {
        console.error('Error selecting company:', error);
        hideResults();
      } finally {
        loadingIndicator.style.display = 'none';
      }
    }

    // Handle input with debounce
    companyInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      
      clearTimeout(searchTimeout);
      
      if (query.length >= 2) {
        searchTimeout = setTimeout(() => {
          searchCompanies(query);
        }, 300); // 300ms debounce
      } else {
        hideResults();
      }
    });

    // Handle click on result item
    resultsContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.kvk-search-item');
      if (item) {
        const index = parseInt(item.getAttribute('data-index'));
        if (currentResults[index]) {
          selectCompany(currentResults[index]);
        }
      }
    });

    // Handle keyboard navigation
    companyInput.addEventListener('keydown', (e) => {
      if (resultsContainer.style.display === 'none' || currentResults.length === 0) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, currentResults.length - 1);
        updateSelection();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelection();
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        selectCompany(currentResults[selectedIndex]);
      } else if (e.key === 'Escape') {
        hideResults();
      }
    });

    function updateSelection() {
      const items = resultsContainer.querySelectorAll('.kvk-search-item');
      items.forEach((item, index) => {
        if (index === selectedIndex) {
          item.style.backgroundColor = '#f3f4f6';
        } else {
          item.style.backgroundColor = '';
        }
      });
    }

    // Close results when clicking outside
    document.addEventListener('click', (e) => {
      if (!companyInput.contains(e.target) && !resultsContainer.contains(e.target)) {
        hideResults();
      }
    });

    // Hide results on blur (with delay to allow click events)
    companyInput.addEventListener('blur', () => {
      setTimeout(() => {
        hideResults();
      }, 200);
    });
  }

  function initDomainValidation() {
    const domainInput = qs('#customer_domain');
    if (!domainInput) return;

    let isUserTyping = false;
    let lastValue = '';

    domainInput.addEventListener('focus', () => {
      lastValue = domainInput.value;
    });

    domainInput.addEventListener('input', (e) => {
      const currentValue = e.target.value;
      
      // Only format if user is typing (not deleting)
      if (currentValue.length > lastValue.length || currentValue.length === 0) {
        isUserTyping = true;
        
        // Get cursor position before formatting
        const cursorPos = e.target.selectionStart;
        
        // Format the domain
        const formatted = formatDomain(currentValue);
        
        // Only update if formatting changed something
        if (formatted !== currentValue) {
          e.target.value = formatted;
          
          // Restore cursor position (adjust for added "www.")
          const addedChars = formatted.length - currentValue.length;
          const newCursorPos = Math.min(cursorPos + addedChars, formatted.length);
          e.target.setSelectionRange(newCursorPos, newCursorPos);
        }
      }
      
      lastValue = e.target.value;
    });

    domainInput.addEventListener('blur', (e) => {
      // Final formatting on blur
      const formatted = formatDomain(e.target.value);
      if (formatted !== e.target.value) {
        e.target.value = formatted;
      }
    });
  }

  // Track if autocomplete is already initialized to prevent double initialization
  let autocompleteInitialized = false;

  async function initAddressAutocomplete(retryCount = 0) {
    const maxRetries = 50; // Try for up to 5 seconds (50 * 100ms)
    
    // Check if API key is available
    if (!window.GOOGLE_MAPS_API_KEY || window.GOOGLE_MAPS_API_KEY === '') {
      console.log('[customersDrawer] Waiting for Google Maps API key...');
      if (retryCount < maxRetries) {
        setTimeout(() => initAddressAutocomplete(retryCount + 1), 100);
      } else {
        console.warn('[customersDrawer] Google Maps API key not found after max retries');
      }
      return;
    }

    // Wait for Google Maps API to load
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
      console.log('[customersDrawer] Waiting for Google Maps API to load...');
      if (retryCount < maxRetries) {
        setTimeout(() => initAddressAutocomplete(retryCount + 1), 100);
      } else {
        console.warn('[customersDrawer] Google Maps API not loaded after max retries');
      }
      return;
    }

    // Also check if the callback has fired (if available)
    if (window.GOOGLE_MAPS_LOADED === false && retryCount < maxRetries) {
      console.log('[customersDrawer] Waiting for Google Maps callback...');
      setTimeout(() => initAddressAutocomplete(retryCount + 1), 100);
      return;
    }

    const drawer = qs(`#${DRAWER_ID}`);
    if (!drawer) {
      if (retryCount < maxRetries) {
        setTimeout(() => initAddressAutocomplete(retryCount + 1), 100);
      }
      return;
    }

    const addressInput = qs('#customer_address', drawer);
    const cityInput = qs('#customer_city', drawer);
    const postalCodeInput = qs('#customer_postal_code', drawer);

    console.log('[customersDrawer] Looking for address fields:', {
      drawer: !!drawer,
      addressInput: !!addressInput,
      cityInput: !!cityInput,
      postalCodeInput: !!postalCodeInput
    });

    // If no address fields exist, skip initialization
    if (!addressInput && !cityInput && !postalCodeInput) {
      console.warn('[customersDrawer] No address fields found, retrying...');
      if (retryCount < maxRetries) {
        setTimeout(() => initAddressAutocomplete(retryCount + 1), 100);
      }
      return;
    }

    // Prevent double initialization
    if (autocompleteInitialized) {
      console.log('[customersDrawer] Autocomplete already initialized, skipping');
      return;
    }

    try {
      // Check if places is already loaded, otherwise import it
      if (typeof google.maps.places === 'undefined') {
        await google.maps.importLibrary('places');
      }

      // Initialize autocomplete for address field
      if (addressInput && typeof google.maps.places.Autocomplete !== 'undefined') {
        console.log('[customersDrawer] Initializing autocomplete for address field');
        const addressAutocomplete = new google.maps.places.Autocomplete(addressInput, {
          componentRestrictions: { country: ['nl', 'be', 'de', 'fr'] },
          fields: ['address_components', 'formatted_address'],
          types: ['address']
        });
        
        console.log('[customersDrawer] Address autocomplete created:', !!addressAutocomplete);
        
        // Test if input is visible and accessible
        console.log('[customersDrawer] Address input details:', {
          visible: addressInput.offsetParent !== null,
          display: window.getComputedStyle(addressInput).display,
          zIndex: window.getComputedStyle(addressInput).zIndex
        });
        
        // Add error listener
        google.maps.event.addListener(addressAutocomplete, 'error', function(error) {
          console.error('[customersDrawer] Autocomplete error:', error);
          if (error === google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
            console.warn('Google Maps API error: Please check API key configuration.');
          }
        });
        
        // Add listener to detect when user types
        addressInput.addEventListener('input', function() {
          console.log('[customersDrawer] User typing in address field:', this.value);
        });

        // Handle place selection
        addressAutocomplete.addListener('place_changed', function() {
          const place = addressAutocomplete.getPlace();
          
          console.log('[customersDrawer] Place selected:', place);
          
          if (!place || !place.address_components) {
            console.warn('[customersDrawer] Place has no address_components');
            return;
          }

          // Parse address components
          let streetNumber = '';
          let route = '';
          let postalCode = '';
          let city = '';

          place.address_components.forEach(component => {
            const types = component.types;

            if (types.includes('street_number')) {
              streetNumber = component.long_name;
            }
            if (types.includes('route')) {
              route = component.long_name;
            }
            if (types.includes('postal_code')) {
              postalCode = component.long_name;
            }
            if (types.includes('locality')) {
              // Prefer locality over administrative_area_level_2 for city
              if (!city) {
                city = component.long_name;
              }
            } else if (types.includes('administrative_area_level_2') && !city) {
              city = component.long_name;
            }
          });

          console.log('[customersDrawer] Parsed address:', { streetNumber, route, postalCode, city });

          // Update address field with full address
          if (streetNumber && route) {
            addressInput.value = `${route} ${streetNumber}`.trim();
          } else if (route) {
            addressInput.value = route.trim();
          } else if (place.formatted_address) {
            addressInput.value = place.formatted_address;
          }

          // Update postal code and city fields
          if (postalCodeInput && postalCode) {
            postalCodeInput.value = postalCode.trim();
            // Trigger input event to notify any listeners
            postalCodeInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          if (cityInput && city) {
            cityInput.value = city.trim();
            // Trigger input event to notify any listeners
            cityInput.dispatchEvent(new Event('input', { bubbles: true }));
          }

          // Also trigger input event on address field
          addressInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }

      // Initialize autocomplete for postal code field
      if (postalCodeInput && typeof google.maps.places.Autocomplete !== 'undefined') {
        console.log('[customersDrawer] Initializing autocomplete for postal code field');
        const postalCodeAutocomplete = new google.maps.places.Autocomplete(postalCodeInput, {
          componentRestrictions: { country: ['nl', 'be', 'de', 'fr'] },
          fields: ['address_components', 'formatted_address'],
          types: ['postal_code']
        });
        
        console.log('[customersDrawer] Postal code autocomplete created:', !!postalCodeAutocomplete);

        postalCodeAutocomplete.addListener('place_changed', function() {
          const place = postalCodeAutocomplete.getPlace();
          
          if (!place || !place.address_components) {
            return;
          }

          let city = '';
          let postalCode = '';

          place.address_components.forEach(component => {
            const types = component.types;

            if (types.includes('locality')) {
              if (!city) {
                city = component.long_name;
              }
            } else if (types.includes('administrative_area_level_2') && !city) {
              city = component.long_name;
            }
            if (types.includes('postal_code')) {
              postalCode = component.long_name;
            }
          });

          if (postalCodeInput && postalCode) {
            postalCodeInput.value = postalCode.trim();
            postalCodeInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          if (cityInput && city) {
            cityInput.value = city.trim();
            cityInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }

      // Initialize autocomplete for city field
      if (cityInput && typeof google.maps.places.Autocomplete !== 'undefined') {
        console.log('[customersDrawer] Initializing autocomplete for city field');
        const cityAutocomplete = new google.maps.places.Autocomplete(cityInput, {
          componentRestrictions: { country: ['nl', 'be', 'de', 'fr'] },
          fields: ['address_components', 'formatted_address'],
          types: ['(cities)']
        });
        
        console.log('[customersDrawer] City autocomplete created:', !!cityAutocomplete);

        cityAutocomplete.addListener('place_changed', function() {
          const place = cityAutocomplete.getPlace();
          
          if (!place || !place.address_components) {
            return;
          }

          let city = '';
          let postalCode = '';

          place.address_components.forEach(component => {
            const types = component.types;

            if (types.includes('locality')) {
              if (!city) {
                city = component.long_name;
              }
            } else if (types.includes('administrative_area_level_2') && !city) {
              city = component.long_name;
            }
            if (types.includes('postal_code')) {
              postalCode = component.long_name;
            }
          });

          if (cityInput && city) {
            cityInput.value = city.trim();
            cityInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          if (postalCodeInput && postalCode) {
            postalCodeInput.value = postalCode.trim();
            postalCodeInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      }

      // Mark as initialized
      autocompleteInitialized = true;
      console.log('[customersDrawer] Address autocomplete initialized successfully');
    } catch (error) {
      console.error('[customersDrawer] Error initializing address autocomplete:', error);
      // Retry on error if we haven't exceeded max retries
      if (retryCount < maxRetries) {
        setTimeout(() => initAddressAutocomplete(retryCount + 1), 200);
      } else {
        console.error('[customersDrawer] Failed to initialize address autocomplete after max retries');
      }
    }
  }

  // Also initialize when Google Maps API loads (if drawer is already open)
  if (typeof window !== 'undefined') {
    // Listen for Google Maps API load event
    const originalCallback = window.initGoogleMapsForCustomers;
    if (originalCallback) {
      window.initGoogleMapsForCustomers = function() {
        if (originalCallback) originalCallback();
        // If drawer is open, initialize autocomplete
        const drawer = qs(`#${DRAWER_ID}`);
        if (drawer && drawer.classList.contains('is-open')) {
          setTimeout(() => {
            autocompleteInitialized = false;
            initAddressAutocomplete();
          }, 300);
        }
      };
    }
  }

  function init() {
    // Ensure drawer exists (if template missing, fail silently)
    const drawer = qs(`#${DRAWER_ID}`);
    const overlay = qs(`#${OVERLAY_ID}`);
    if (!drawer || !overlay) return;

    // Helpful debug marker (can be removed later)
    // eslint-disable-next-line no-console
    console.log('[customersDrawer] init');

    // Handle create_account checkbox - enable/disable send_welcome_email
    const createAccountCheckbox = qs('#customer_create_account');
    const sendEmailCheckbox = qs('#customer_send_welcome_email');
    const emailInput = qs('#customer_email');
    
    if (createAccountCheckbox && sendEmailCheckbox) {
      const updateEmailCheckbox = () => {
        if (createAccountCheckbox.checked && emailInput && emailInput.value.trim()) {
          sendEmailCheckbox.disabled = false;
        } else {
          sendEmailCheckbox.disabled = true;
          sendEmailCheckbox.checked = false;
        }
      };
      
      createAccountCheckbox.addEventListener('change', updateEmailCheckbox);
      if (emailInput) {
        emailInput.addEventListener('input', updateEmailCheckbox);
      }
      updateEmailCheckbox(); // Initial state
    }

    // Initialize domain validation
    initDomainValidation();

    // Initialize branch multiselect
    initBranchMultiselect();

    // Initialize KVK search
    initKvkSearch();

    // Initialize address autocomplete will be called when drawer opens
    // (Don't initialize here as drawer might not be visible yet)

    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('click', onSubmitClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    // Close on route changes (rare) / safety
    window.addEventListener('beforeunload', () => setOpen(false));

    // Ensure initial closed state (in case CSS didn't load yet)
    setOpen(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

