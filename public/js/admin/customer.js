// Customer detail page JavaScript
(function() {
  'use strict';

  // Prevent double-init
  if (window.__gsCustomerDetailInit) return;
  window.__gsCustomerDetailInit = true;

  const customerId = window.customerEmployeesData?.customerId;

  // ------------------------------------------------------------
  // Computed-field helpers (frontend)
  // - Keep logic centralized so UI stays consistent
  // - Mirrors Postgres functions in `customer_enriched`
  // ------------------------------------------------------------
  const computed = {
    companyDisplayName(raw) {
      if (!raw || typeof raw !== 'string') return null;
      const v = raw.trim().replace(/\s+/g, ' ');
      return v.length ? v : null;
    },
    normalizeDomain(input) {
      if (!input || typeof input !== 'string') return null;
      let v = input.trim().toLowerCase();
      if (!v) return null;
      // email -> domain
      if (v.includes('@') && !v.includes('/')) v = v.split('@')[1] || '';
      v = v.replace(/^https?:\/\//, '');
      v = v.replace(/^www\./, '');
      v = v.replace(/\/.*$/, '');
      v = v.trim();
      return v || null;
    },
    normalizeWebsiteUrl(input) {
      if (!input || typeof input !== 'string') return null;
      let v = input.trim().replace(/\s+/g, '');
      if (!v) return null;
      if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
      v = v.replace(/\/+$/, '');
      return v || null;
    },
    normalizePhoneNL(input) {
      if (!input || typeof input !== 'string') return null;
      let v = input.trim();
      if (!v) return null;
      v = v.replace(/[^0-9+]/g, '');
      if (v.startsWith('00')) v = `+${v.slice(2)}`;
      if (/^31\d+/.test(v)) v = `+${v}`;
      if (/^0\d{9}$/.test(v)) v = `+31${v.slice(1)}`;
      const digits = v.replace(/[^0-9]/g, '');
      if (digits.length < 8) return null;
      return v;
    },
    normalizePostcode(input) {
      if (!input || typeof input !== 'string') return null;
      const v = input.trim().replace(/\s+/g, '').toUpperCase();
      return v || null;
    },
    dedupeKeyPrimary({ domain, websiteUrl }) {
      return computed.normalizeDomain(domain || websiteUrl);
    },
    dedupeKeySecondary({ companyName, postalCode }) {
      const name = computed.companyDisplayName(companyName);
      const pc = computed.normalizePostcode(postalCode);
      if (!name && !pc) return null;
      return `${(name || '').toLowerCase()}|${pc || ''}`.replace(/^\|$/, '') || null;
    },
    daysSinceLastInteraction(lastInteractionIso) {
      if (!lastInteractionIso) return null;
      const d = new Date(lastInteractionIso);
      if (Number.isNaN(d.getTime())) return null;
      const diffMs = Date.now() - d.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    },
    hasOverdueNextActivity(nextActivityIso) {
      if (!nextActivityIso) return false;
      const d = new Date(nextActivityIso);
      if (Number.isNaN(d.getTime())) return false;
      return d.getTime() < Date.now();
    },
    activityBucket(days) {
      if (days === null || days === undefined) return null;
      if (days <= 7) return '0-7';
      if (days <= 30) return '8-30';
      if (days <= 90) return '31-90';
      return '90+';
    },
    contactPressure(timesContacted, lastInteractionIso) {
      const t = Number.isFinite(timesContacted) ? timesContacted : (parseInt(timesContacted, 10) || 0);
      const days = computed.daysSinceLastInteraction(lastInteractionIso);
      let recencyBoost = 0;
      if (days !== null) {
        if (days <= 7) recencyBoost = 40;
        else if (days <= 30) recencyBoost = 20;
        else if (days <= 90) recencyBoost = 10;
      }
      return Math.min(100, t * 10 + recencyBoost);
    },
    fullAddress({ address1, address2, postalCode, city, country }) {
      const parts = [];
      const a1 = (address1 || '').trim();
      const a2 = (address2 || '').trim();
      const pc = (postalCode || '').trim();
      const ct = (city || '').trim();
      const co = (country || '').trim();
      if (a1) parts.push(a1);
      if (a2) parts.push(a2);
      const cityLine = [pc, ct].filter(Boolean).join(' ').trim();
      if (cityLine) parts.push(cityLine);
      if (co) parts.push(co);
      const out = parts.join(', ').replace(/\s+/g, ' ').trim();
      return out || null;
    },
    isContactable({ phone, websiteUrl, domain, hasLinkedContact }) {
      return Boolean(
        computed.normalizePhoneNL(phone) ||
        computed.normalizeDomain(domain || websiteUrl) ||
        hasLinkedContact
      );
    },
    dataQualityScore({ domain, websiteUrl, phone, address1, postalCode, city, industry, employeeCount, owner }) {
      let score = 0;
      if (computed.normalizeDomain(domain || websiteUrl)) score += 30;
      if (computed.normalizePhoneNL(phone)) score += 20;
      if ((address1 || '').trim()) score += 10;
      if ((postalCode || '').trim()) score += 5;
      if ((city || '').trim()) score += 5;
      if ((industry || '').trim()) score += 10;
      if (employeeCount !== null && employeeCount !== undefined && employeeCount !== '') score += 10;
      if ((owner || '').trim()) score += 10;
      return Math.min(100, score);
    }
  };

  window.customerComputedFns = computed;

  function renderComputedPanel() {
    const c = window.customerData || {};

    const companyName = c.hubspot_company_name || c.company_name || c.name;
    const normalizedDomain = computed.normalizeDomain(c.hubspot_primary_domain || c.domain || c.hubspot_website_url || c.website);
    const normalizedWebsiteUrl = computed.normalizeWebsiteUrl(c.hubspot_website_url || c.website);
    const normalizedPhone = computed.normalizePhoneNL(c.hubspot_phone || c.phone);

    const dedupePrimary = computed.dedupeKeyPrimary({
      domain: c.hubspot_primary_domain || c.domain,
      websiteUrl: c.hubspot_website_url || c.website
    });
    const dedupeSecondary = computed.dedupeKeySecondary({
      companyName,
      postalCode: c.hubspot_postcode || c.postal_code
    });

    const days = computed.daysSinceLastInteraction(c.hubspot_last_interaction_at);
    const overdue = computed.hasOverdueNextActivity(c.hubspot_next_activity_at);
    const bucket = computed.activityBucket(days);
    const pressure = computed.contactPressure(c.hubspot_times_contacted, c.hubspot_last_interaction_at);

    const fullAddress = computed.fullAddress({
      address1: c.hubspot_address1 || c.address,
      address2: c.hubspot_address2,
      postalCode: c.hubspot_postcode || c.postal_code,
      city: c.hubspot_city || c.city,
      country: c.hubspot_country || c.country
    });

    const isContactable = computed.isContactable({
      phone: c.hubspot_phone || c.phone,
      websiteUrl: c.hubspot_website_url || c.website,
      domain: c.hubspot_primary_domain || c.domain,
      hasLinkedContact: false // can be improved later via API: contacts count
    });

    const quality = computed.dataQualityScore({
      domain: c.hubspot_primary_domain || c.domain,
      websiteUrl: c.hubspot_website_url || c.website,
      phone: c.hubspot_phone || c.phone,
      address1: c.hubspot_address1 || c.address,
      postalCode: c.hubspot_postcode || c.postal_code,
      city: c.hubspot_city || c.city,
      industry: c.hubspot_industry,
      employeeCount: c.hubspot_employee_count,
      owner: c.hubspot_owner
    });

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = (value === null || value === undefined || value === '') ? '-' : String(value);
    };

    set('computedCompanyDisplayName', computed.companyDisplayName(companyName));
    set('computedNormalizedDomain', normalizedDomain);
    set('computedNormalizedWebsiteUrl', normalizedWebsiteUrl);
    set('computedNormalizedPhone', normalizedPhone);
    set('computedDedupeKeyPrimary', dedupePrimary);
    set('computedDedupeKeySecondary', dedupeSecondary);
    set('computedDaysSinceLastInteraction', (days === 0 || days) ? days : '-');
    set('computedHasOverdueNextActivity', overdue ? 'Ja' : 'Nee');
    set('computedActivityBucket', bucket);
    set('computedContactPressure', (pressure === 0 || pressure) ? pressure : '-');
    set('computedIsContactable', isContactable ? 'Ja' : 'Nee');
    set('computedDataQualityScore', (quality === 0 || quality) ? quality : '-');
    set('computedFullAddress', fullAddress);
  }

  // ------------------------------------------------------------
  // AI Summary (Customer)
  // ------------------------------------------------------------
  async function refreshCustomerAiSummary() {
    // Try to get customerId from multiple sources
    const currentCustomerId = window.customerEmployeesData?.customerId || 
                              window.customerInvoicesData?.customerId ||
                              (window.customerData && window.customerData.id) ||
                              customerId; // fallback to const at top
    
    if (!currentCustomerId) {
      console.warn('[AI Summary] No customerId available');
      return;
    }
    
    return refreshCustomerAiSummaryWithId(currentCustomerId);
  }

  async function refreshCustomerAiSummaryWithId(customerIdToUse) {
    if (!customerIdToUse) {
      console.warn('[AI Summary] No customerId provided');
      return;
    }
    
    const btn = document.getElementById('refreshCustomerAiSummaryBtn');
    const summaryText = document.getElementById('customerAiSummaryText');
    const summaryLoading = document.getElementById('customerAiSummaryLoading');
    
    if (!summaryText) {
      console.warn('[AI Summary] Summary text element not found');
      return;
    }

    const originalBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.7 2.7L21 8"></path><path d="M21 3v5h-5"></path></svg>`;
    }

    // Show loading state
    summaryText.style.display = 'none';
    if (summaryLoading) {
      summaryLoading.style.display = 'block';
    }

    try {
      const res = await fetch(`/admin/api/customers/${customerIdToUse}/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({})
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}: Fout bij genereren AI samenvatting`);
      }

      const data = await res.json();
      console.log('[AI Summary] Response data:', data);

      // Handle different response formats
      let summary = '';
      if (data.summary) {
        summary = data.summary;
      } else if (data.aiSummary && data.aiSummary.summary) {
        summary = data.aiSummary.summary;
      } else if (data.data && data.data.summary) {
        summary = data.data.summary;
      } else if (typeof data === 'string') {
        summary = data;
      }

      if (summary && summary.trim().length > 0) {
        summaryText.textContent = summary.trim();
        summaryText.style.display = 'block';
        if (summaryLoading) {
          summaryLoading.style.display = 'none';
        }
        if (window.showNotification) {
          window.showNotification('AI samenvatting bijgewerkt', 'success');
        }
      } else {
        console.warn('[AI Summary] No summary found in response:', data);
        summaryText.textContent = 'Geen samenvatting ontvangen. Probeer het opnieuw.';
        summaryText.style.display = 'block';
        if (summaryLoading) {
          summaryLoading.style.display = 'none';
        }
        if (window.showNotification) {
          window.showNotification('Geen samenvatting ontvangen', 'error');
        }
      }
    } catch (err) {
      console.error('[AI Summary] Error:', err);
      summaryText.textContent = `Fout bij genereren AI samenvatting: ${err.message || 'Onbekende fout'}. Probeer het opnieuw.`;
      summaryText.style.display = 'block';
      if (summaryLoading) {
        summaryLoading.style.display = 'none';
      }
      if (window.showNotification) {
        window.showNotification(err.message || 'Kon AI samenvatting niet genereren', 'error');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml || `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.7 2.7L21 8"></path><path d="M21 3v5h-5"></path></svg>`;
      }
    }
  }

  // Old tabs removed - using new main tabs instead

  function initMainTabs() {
    const mainTabButtons = document.querySelectorAll('.customer-main-tab-btn');
    const mainTabContents = document.querySelectorAll('.customer-main-tab-content');

    mainTabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-main-tab');

        // Remove active class from all buttons and contents
        mainTabButtons.forEach(btn => btn.classList.remove('customer-main-tab-active'));
        mainTabContents.forEach(content => {
          content.classList.remove('customer-main-tab-content-active');
          content.style.display = 'none';
        });

        // Add active class to clicked button
        button.classList.add('customer-main-tab-active');

        // Show corresponding content with smooth transition
        const targetContent = document.getElementById(`main-tab-${targetTab}`);
        if (targetContent) {
          // Use requestAnimationFrame to prevent layout shift
          requestAnimationFrame(() => {
            targetContent.classList.add('customer-main-tab-content-active');
            targetContent.style.display = 'block';
            
            // Load invoices when Administratie tab is opened
            if (targetTab === 'administration') {
              // Small delay to ensure DOM is ready
              setTimeout(() => {
                const container = document.getElementById('invoicesTableContainer');
                if (container && container.innerHTML.trim() === '') {
                  // Container is empty, load invoices
                  if (typeof window.loadInvoices === 'function') {
                    window.loadInvoices();
                  } else {
                    // Fallback: load invoices directly
                    fetch(`/admin/api/customers/${customerId}/invoices`)
                      .then(res => res.json())
                      .then(data => {
                        if (data.success && container) {
                          // Use the renderInvoicesTable function if available
                          if (typeof window.renderInvoicesTable === 'function') {
                            window.renderInvoicesTable(data.invoices || []);
                          } else {
                            container.innerHTML = '<p style="padding: 20px; text-align: center; color: #6b7280;">Facturen worden geladen...</p>';
                          }
                        }
                      })
                      .catch(err => {
                        console.error('Error loading invoices:', err);
                        if (container) {
                          container.innerHTML = '<p style="padding: 20px; text-align: center; color: #ef4444;">Fout bij laden facturen</p>';
                        }
                      });
                  }
                }
              }, 100);
            }
          });
        }
      });
    });
  }

  // ------------------------------------------------------------
  // AI Chat (Customer)
  // ------------------------------------------------------------
  async function sendAiChatMessage(message) {
    if (!customerId || !message || !message.trim()) return;
    
    const input = document.getElementById('customerAiChatInput');
    const submitBtn = document.getElementById('customerAiChatSubmit');
    const responseDiv = document.getElementById('customerAiChatResponse');
    
    if (!input || !submitBtn || !responseDiv) return;
    
    // Disable input and show loading
    input.disabled = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    responseDiv.style.display = 'block';
    responseDiv.textContent = 'AI denkt na...';
    
    try {
      const res = await fetch(`/admin/api/customers/${customerId}/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ message: message.trim() })
      });
      
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Fout bij verzenden bericht');
      }
      
      responseDiv.textContent = data.response || 'Geen antwoord ontvangen';
    } catch (err) {
      console.error('AI chat error:', err);
      responseDiv.textContent = 'Fout: ' + (err.message || 'Kon bericht niet verzenden');
      responseDiv.style.color = '#ef4444';
    } finally {
      input.disabled = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m22 2-7 20-4-9-9-4Z"></path>
          <path d="M22 2 11 13"></path>
        </svg>
        Verzend
      `;
      input.value = '';
      input.focus();
    }
  }

  // Function to get customerId from multiple sources
  function getCustomerId() {
    // Try to extract from URL first (most reliable)
    const urlMatch = window.location.pathname.match(/\/admin\/customers\/([a-f0-9-]+)/i);
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1];
    }
    // Try multiple window sources
    if (window.customerEmployeesData?.customerId) {
      return window.customerEmployeesData.customerId;
    }
    if (window.customerInvoicesData?.customerId) {
      return window.customerInvoicesData.customerId;
    }
    if (window.customerData?.id) {
      return window.customerData.id;
    }
    // Fallback to const at top
    return customerId;
  }

  // Function to initialize AI summary
  function initAiSummary() {
    const currentCustomerId = getCustomerId();
    
    if (!currentCustomerId) {
      console.warn('[AI Summary] No customerId available, retrying...');
      // Retry after a short delay (max 3 retries)
      if (!initAiSummary.retryCount) {
        initAiSummary.retryCount = 0;
      }
      if (initAiSummary.retryCount < 5) {
        initAiSummary.retryCount++;
        setTimeout(initAiSummary, 300);
      } else {
        console.error('[AI Summary] Failed to get customerId after multiple retries');
      }
      return;
    }

    console.log('[AI Summary] Using customerId:', currentCustomerId);

      // Auto-generate AI summary if it doesn't exist
      const summaryText = document.getElementById('customerAiSummaryText');
      const summaryLoading = document.getElementById('customerAiSummaryLoading');
      
      if (summaryText) {
        const currentText = summaryText.textContent.trim();
        // Check if summary exists (not placeholder or empty)
        const hasSummary = currentText && currentText.length > 20; // Real summary should be longer
        
        if (hasSummary) {
          // Summary already exists, just make sure it's visible
          summaryText.style.display = 'block';
          if (summaryLoading) {
            summaryLoading.style.display = 'none';
          }
        } else {
          // No summary exists - generate one automatically in background
          // Show loading state while generating
          summaryText.style.display = 'none';
          if (summaryLoading) {
            summaryLoading.style.display = 'block';
          }
          
          // Generate summary in background (use currentCustomerId)
          refreshCustomerAiSummaryWithId(currentCustomerId).catch(err => {
            console.error('[AI Summary] Failed to generate on page load:', err);
            // Error handling is done in refreshCustomerAiSummaryWithId
          });
        }
      }

      // Setup refresh button
      const refreshBtn = document.getElementById('refreshCustomerAiSummaryBtn');
      if (refreshBtn) {
        // Remove any existing listeners to prevent duplicates
        const newRefreshBtn = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
        
        newRefreshBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[AI Summary] Refresh button clicked');
          const btnCustomerId = getCustomerId();
          if (btnCustomerId) {
            refreshCustomerAiSummaryWithId(btnCustomerId);
          } else {
            console.error('[AI Summary] No customerId available for refresh');
          }
        });
      } else {
        console.warn('[AI Summary] Refresh button not found');
      }
    }

    // Try to initialize immediately, then retry if needed
    setTimeout(initAiSummary, 100);
    // Also retry after a longer delay in case script tags load slowly
    setTimeout(initAiSummary, 500);

    // AI Chat form handler
    const chatForm = document.getElementById('customerAiChatForm');
    const chatInput = document.getElementById('customerAiChatInput');
    if (chatForm && chatInput) {
      chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = chatInput.value.trim();
        if (message) {
          await sendAiChatMessage(message);
        }
      });
      
      // Allow Enter to submit
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          chatForm.dispatchEvent(new Event('submit'));
        }
      });
    }
  });

  function initEmployeeManagement() {
    if (!customerId) return;

    const modal = document.getElementById('addEmployeeModal');
    const addBtn = document.getElementById('addEmployeeBtn');
    const addBtnEmpty = document.getElementById('addEmployeeBtnEmpty');
    const closeBtn = document.getElementById('closeAddEmployeeModal');
    const cancelBtn = document.getElementById('cancelAddEmployee');
    const form = document.getElementById('addEmployeeForm');
    const removeButtons = document.querySelectorAll('.remove-employee-btn');

    // Open modal
    function openModal() {
      if (modal) {
        modal.style.display = 'flex';
        // Update employee select to exclude already assigned employees
        updateEmployeeSelect();
      }
    }

    // Close modal
    function closeModal() {
      if (modal) {
        modal.style.display = 'none';
        if (form) form.reset();
      }
    }

    // Update employee select dropdown
    function updateEmployeeSelect() {
      const select = document.getElementById('employeeSelect');
      if (!select) return;

      const assignedIds = Array.from(document.querySelectorAll('[data-employee-id]'))
        .map(el => el.getAttribute('data-employee-id'))
        .filter(Boolean);

      // Remove all options except the first one
      while (select.options.length > 1) {
        select.remove(1);
      }

      // Add available employees
      const allEmployees = window.customerEmployeesData?.allEmployees || [];
      allEmployees.forEach(emp => {
        if (!assignedIds.includes(emp.id)) {
          const empName = (emp.first_name && emp.last_name) 
            ? `${emp.first_name} ${emp.last_name}` 
            : emp.email || 'Onbekend';
          const option = document.createElement('option');
          option.value = emp.id;
          option.textContent = `${empName}${emp.email ? ` (${emp.email})` : ''}`;
          select.appendChild(option);
        }
      });
    }

    // Add employee
    async function addEmployee(e) {
      e.preventDefault();
      if (!form) return;

      const formData = new FormData(form);
      const employeeId = formData.get('employee_id');
      const role = formData.get('role') || 'responsible';

      if (!employeeId) {
        alert('Selecteer een werknemer');
        return;
      }

      try {
        const response = await fetch(`/admin/api/customers/${customerId}/employees`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            employee_id: employeeId,
            role
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          window.showNotification?.('Werknemer toegevoegd', 'success');
          closeModal();
          location.reload();
        } else {
          throw new Error(data.error || 'Fout bij toevoegen werknemer');
        }
      } catch (error) {
        console.error('Error adding employee:', error);
        window.showNotification?.(error.message || 'Fout bij toevoegen werknemer', 'error');
      }
    }

    // Remove employee
    async function removeEmployee(employeeId) {
      if (!confirm('Weet je zeker dat je deze werknemer wilt verwijderen?')) {
        return;
      }

      try {
        const response = await fetch(`/admin/api/customers/${customerId}/employees/${employeeId}`, {
          method: 'DELETE',
          credentials: 'same-origin'
        });

        const data = await response.json();

        if (response.ok && data.success) {
          window.showNotification?.('Werknemer verwijderd', 'success');
          location.reload();
        } else {
          throw new Error(data.error || 'Fout bij verwijderen werknemer');
        }
      } catch (error) {
        console.error('Error removing employee:', error);
        window.showNotification?.(error.message || 'Fout bij verwijderen werknemer', 'error');
      }
    }

    // Event listeners
    if (addBtn) addBtn.addEventListener('click', openModal);
    if (addBtnEmpty) addBtnEmpty.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (form) form.addEventListener('submit', addEmployee);

    // Close modal on background click
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Remove employee buttons - use event delegation for dynamically added buttons
    const employeesList = document.getElementById('responsibleEmployeesList');
    if (employeesList) {
      employeesList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-employee-btn');
        if (removeBtn) {
          e.preventDefault();
          e.stopPropagation();
          const employeeId = removeBtn.getAttribute('data-employee-id');
          if (employeeId) {
            removeEmployee(employeeId);
          }
        }
      });
    }
    
    // Also handle existing buttons (for backwards compatibility)
    removeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const employeeId = btn.getAttribute('data-employee-id');
        if (employeeId) {
          removeEmployee(employeeId);
        }
      });
    });
  }

  function initEditMode() {
    if (!customerId) return;

    let isEditMode = false;
    let saveTimeout = null;
    const editBtn = document.getElementById('editCustomerBtn');
    const editCompanyBtn = document.getElementById('editCompanyBtn');
    const customerNameDisplay = document.getElementById('customerNameDisplay');
    const logoUpload = document.getElementById('customerLogoUpload');
    const customerAvatar = document.getElementById('customerAvatar');
    const customerAvatarTrigger = document.getElementById('customerAvatarTrigger');
    const logoModal = document.getElementById('customerLogoModal');
    const logoModalClose = document.getElementById('closeCustomerLogoModal');
    const logoModalX = logoModal ? logoModal.querySelector('.modal-close') : null;
    const logoPreview = document.getElementById('customerLogoPreview');
    const originalData = {};
    const canEditCustomer = window.canEditCustomer !== false; // Default to true if not set

    // Check if user can edit (manager+)
    function checkCanEdit() {
      return canEditCustomer;
    }

    // Show confirmation modal (in-platform style)
    function showConfirmModal(message, title = 'Bevestiging') {
      return new Promise((resolve) => {
        // Remove existing modal if present
        const existing = document.querySelector('.customer-confirm-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'modal customer-confirm-modal';
        modal.style.zIndex = '10001';
        modal.innerHTML = `
          <div class="modal-content modal-sm" style="z-index: 10002;">
            <div class="modal-header">
              <h3>${title}</h3>
              <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
              <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 20px;">
                <i class="fas fa-question-circle" style="font-size: 24px; color: #3b82f6; margin-top: 2px;"></i>
                <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">${message}</p>
              </div>
              <div class="form-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
                <button type="button" class="btn btn-outline" id="cancelConfirm">Annuleren</button>
                <button type="button" class="btn btn-primary" id="confirmAction">Bevestigen</button>
              </div>
            </div>
          </div>
        `;

        const closeModal = () => {
          modal.remove();
          document.body.classList.remove('modal-open');
        };

        modal.querySelector('.modal-close').addEventListener('click', () => {
          closeModal();
          resolve(false);
        });

        modal.querySelector('#cancelConfirm').addEventListener('click', () => {
          closeModal();
          resolve(false);
        });

        modal.querySelector('#confirmAction').addEventListener('click', () => {
          closeModal();
          resolve(true);
        });

        // Show modal
        document.body.appendChild(modal);
        document.body.classList.add('modal-open');
        modal.style.display = 'flex';
      });
    }

    // Toggle edit mode (synchronized between both buttons)
    function toggleEditMode() {
      if (!checkCanEdit()) {
        window.showNotification?.('Alleen managers en admins kunnen klantgegevens bewerken', 'error');
        return;
      }

      if (isEditMode) {
        // Exit edit mode - reload page to cancel changes and show original values
        location.reload();
        return;
      }

      isEditMode = true;
      
      // Update both buttons - show "Annuleren" text in edit mode
      const buttons = [editBtn, editCompanyBtn].filter(Boolean);
      buttons.forEach(btn => {
        btn.innerHTML = '<span style="font-size: 14px; font-weight: 500;">Annuleren</span>';
        btn.style.color = '#6b7280';
      });
      
      enterEditMode();
    }
    
    function enterEditMode() {
      // Make name editable - preserve position
      if (customerNameDisplay) {
        originalData.name = customerNameDisplay.textContent.trim();
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalData.name;
        input.className = 'user-info-name-new';
        // Preserve exact dimensions and position
        const rect = customerNameDisplay.getBoundingClientRect();
        input.style.border = '1px solid #d1d5db';
        input.style.borderRadius = '6px';
        input.style.padding = '4px 8px';
        input.style.width = '100%';
        input.style.margin = '0';
        input.style.fontSize = window.getComputedStyle(customerNameDisplay).fontSize;
        input.style.fontWeight = window.getComputedStyle(customerNameDisplay).fontWeight;
        input.style.lineHeight = window.getComputedStyle(customerNameDisplay).lineHeight;
        input.id = 'customerNameInput';
        input.dataset.field = 'name';
        input.addEventListener('blur', () => saveFieldOnBlur('name', input));
        customerNameDisplay.replaceWith(input);
      }
      
      // Make contact fields editable (convert links to inputs) - preserve position
      document.querySelectorAll('[data-field][data-edit-type="text"]').forEach(el => {
        const field = el.getAttribute('data-field');
        const text = el.textContent.trim();
        originalData[field] = text;
        
        // Preserve computed styles to prevent layout shift
        const computedStyle = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = text;
        input.className = el.className;
        input.style.border = '1px solid #d1d5db';
        input.style.borderRadius = '4px';
        input.style.padding = '2px 6px';
        input.style.flex = '1';
        input.style.width = '100%';
        input.style.margin = computedStyle.margin;
        input.style.fontSize = computedStyle.fontSize;
        input.style.fontWeight = computedStyle.fontWeight;
        input.style.lineHeight = computedStyle.lineHeight;
        input.dataset.field = field;
        input.addEventListener('blur', () => saveFieldOnBlur(field, input));
        el.replaceWith(input);
      });
      
      // Make company fields editable - preserve position
      document.querySelectorAll('.user-company-value[data-field]').forEach(el => {
        const field = el.getAttribute('data-field');
        const editType = el.getAttribute('data-edit-type');
        const text = el.textContent.trim();
        originalData[field] = text;
        
        // Preserve computed styles
        const computedStyle = window.getComputedStyle(el);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = text;
        input.className = el.className;
        input.style.border = '1px solid #d1d5db';
        input.style.borderRadius = '4px';
        input.style.padding = '4px 8px';
        input.style.width = '100%';
        input.style.margin = computedStyle.margin;
        input.style.fontSize = computedStyle.fontSize;
        input.style.fontWeight = computedStyle.fontWeight;
        input.style.lineHeight = computedStyle.lineHeight;
        input.dataset.field = field;
        input.dataset.editType = editType || 'text';
        input.addEventListener('blur', () => saveFieldOnBlur(field, input));
        el.replaceWith(input);
      });
      
      // Make website link editable - preserve position
      document.querySelectorAll('.user-company-link[data-field]').forEach(el => {
        const field = el.getAttribute('data-field');
        const text = el.textContent.trim().replace(/\s*<i.*<\/i>/, ''); // Remove icon
        originalData[field] = text;
        
        // Preserve computed styles
        const computedStyle = window.getComputedStyle(el);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.value = text;
        input.className = 'user-company-link';
        input.style.border = '1px solid #d1d5db';
        input.style.borderRadius = '4px';
        input.style.padding = '4px 8px';
        input.style.width = '100%';
        input.style.margin = computedStyle.margin;
        input.style.fontSize = computedStyle.fontSize;
        input.style.fontWeight = computedStyle.fontWeight;
        input.style.lineHeight = computedStyle.lineHeight;
        input.dataset.field = field;
        input.addEventListener('blur', () => saveFieldOnBlur(field, input));
        el.replaceWith(input);
      });
      
      // Make badges editable (status & priority) - preserve position
      const statusBadge = document.getElementById('statusBadge');
      const priorityBadge = document.getElementById('priorityBadge');
      
      if (statusBadge) {
        originalData.status = window.currentStatus;
        const computedStyle = window.getComputedStyle(statusBadge);
        const statusOptions = ['active', 'inactive', 'lead', 'prospect'];
        const select = document.createElement('select');
        select.id = 'statusSelect';
        select.style.border = '1px solid #d1d5db';
        select.style.borderRadius = '4px';
        select.style.padding = '4px 8px';
        select.style.fontSize = computedStyle.fontSize;
        select.style.background = statusBadge.style.backgroundColor;
        select.style.color = statusBadge.style.color;
        select.style.margin = computedStyle.margin;
        select.dataset.field = 'status';
        statusOptions.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = window.statusLabels?.[opt] || opt;
          if (opt === window.currentStatus) option.selected = true;
          select.appendChild(option);
        });
        select.addEventListener('change', () => saveFieldOnBlur('status', select));
        statusBadge.replaceWith(select);
      }
      
      if (priorityBadge) {
        originalData.priority = window.currentPriority;
        const computedStyle = window.getComputedStyle(priorityBadge);
        const priorityOptions = ['low', 'normal', 'high', 'vip'];
        const select = document.createElement('select');
        select.id = 'prioritySelect';
        select.style.border = '1px solid #d1d5db';
        select.style.borderRadius = '4px';
        select.style.padding = '4px 8px';
        select.style.fontSize = computedStyle.fontSize;
        select.style.background = priorityBadge.style.backgroundColor;
        select.style.color = priorityBadge.style.color;
        select.style.margin = computedStyle.margin;
        select.dataset.field = 'priority';
        priorityOptions.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = window.priorityLabels?.[opt] || opt;
          if (opt === window.currentPriority) option.selected = true;
          select.appendChild(option);
        });
        select.addEventListener('change', () => saveFieldOnBlur('priority', select));
        priorityBadge.replaceWith(select);
      }
      
      // Make "Klant sinds" editable (only for managers+)
      document.querySelectorAll('[data-field="created_at"]').forEach(el => {
        if (!checkCanEdit()) return;
        
        const isRestricted = el.getAttribute('data-restricted') === 'true';
        if (!isRestricted) return;
        
        const text = el.textContent.trim();
        originalData.created_at = text;
        
        // Preserve computed styles
        const computedStyle = window.getComputedStyle(el);
        
        // Parse date and create date input
        const input = document.createElement('input');
        input.type = 'datetime-local';
        input.className = el.className;
        input.style.border = '1px solid #d1d5db';
        input.style.borderRadius = '4px';
        input.style.padding = '4px 8px';
        input.style.width = '100%';
        input.style.margin = computedStyle.margin;
        input.style.fontSize = computedStyle.fontSize;
        input.style.fontWeight = computedStyle.fontWeight;
        input.style.lineHeight = computedStyle.lineHeight;
        input.dataset.field = 'created_at';
        input.dataset.restricted = 'true';
        
        // Try to parse the date
        try {
          const date = new Date(text);
          if (!isNaN(date.getTime())) {
            // Format as YYYY-MM-DDTHH:mm for datetime-local
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            input.value = `${year}-${month}-${day}T${hours}:${minutes}`;
          }
        } catch (e) {
          console.error('Error parsing date:', e);
        }
        
        input.addEventListener('blur', async () => {
          if (checkCanEdit() && input.value !== originalData.created_at) {
            const confirmed = await showConfirmModal('Weet je zeker dat je de datum "Klant sinds" wilt aanpassen?');
            if (confirmed) {
              await saveFieldOnBlur('created_at', input, true);
            } else {
              // Revert to original value
              try {
                const date = new Date(originalData.created_at);
                if (!isNaN(date.getTime())) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  const hours = String(date.getHours()).padStart(2, '0');
                  const minutes = String(date.getMinutes()).padStart(2, '0');
                  input.value = `${year}-${month}-${day}T${hours}:${minutes}`;
                }
              } catch (e) {
                console.error('Error reverting date:', e);
              }
            }
          }
        });
        
        el.replaceWith(input);
      });
      
      // Make inactive date fields editable (inactive_from, inactive_to)
      document.querySelectorAll('[data-field="inactive_from"], [data-field="inactive_to"]').forEach(el => {
        if (!checkCanEdit()) return;
        
        const isRestricted = el.getAttribute('data-restricted') === 'true';
        if (!isRestricted) return;
        
        const field = el.getAttribute('data-field');
        const text = el.textContent.trim();
        originalData[field] = text;
        
        // Preserve computed styles
        const computedStyle = window.getComputedStyle(el);
        
        // Create date input (date only, not datetime)
        const input = document.createElement('input');
        input.type = 'date';
        input.className = el.className;
        input.style.border = '1px solid #d1d5db';
        input.style.borderRadius = '4px';
        input.style.padding = '4px 8px';
        input.style.width = '100%';
        input.style.margin = computedStyle.margin;
        input.style.fontSize = computedStyle.fontSize;
        input.style.fontWeight = computedStyle.fontWeight;
        input.style.lineHeight = computedStyle.lineHeight;
        input.dataset.field = field;
        input.dataset.restricted = 'true';
        
        // Try to parse the date
        try {
          if (text !== 'Heden' && text !== '-') {
            const date = new Date(text);
            if (!isNaN(date.getTime())) {
              // Format as YYYY-MM-DD for date input
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              input.value = `${year}-${month}-${day}`;
            }
          }
        } catch (e) {
          console.error('Error parsing date:', e);
        }
        
        input.addEventListener('blur', async () => {
          if (checkCanEdit() && input.value !== originalData[field]) {
            const fieldLabel = field === 'inactive_from' ? 'Klant van' : 'Klant tot';
            const confirmed = await showConfirmModal(`Weet je zeker dat je de datum "${fieldLabel}" wilt aanpassen?`);
            if (confirmed) {
              await saveFieldOnBlur(field, input, true);
            } else {
              // Revert to original value
              if (text === 'Heden') {
                input.value = '';
              } else {
                try {
                  const date = new Date(text);
                  if (!isNaN(date.getTime())) {
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    input.value = `${year}-${month}-${day}`;
                  }
                } catch (e) {
                  console.error('Error reverting date:', e);
                }
              }
            }
          }
        });
        
        el.replaceWith(input);
      });
      
      // Make inactive_reason editable (select dropdown)
      document.querySelectorAll('[data-field="inactive_reason"]').forEach(el => {
        if (!checkCanEdit()) return;
        
        const isRestricted = el.getAttribute('data-restricted') === 'true';
        if (!isRestricted) return;
        
        const text = el.textContent.trim();
        originalData.inactive_reason = text;
        
        // Preserve computed styles
        const computedStyle = window.getComputedStyle(el);
        
        // Get options from data attribute
        const optionsJson = el.getAttribute('data-options');
        const options = optionsJson ? JSON.parse(optionsJson) : [];
        
        // Create select dropdown
        const select = document.createElement('select');
        select.className = el.className;
        select.style.border = '1px solid #d1d5db';
        select.style.borderRadius = '4px';
        select.style.padding = '4px 8px';
        select.style.width = '100%';
        select.style.margin = computedStyle.margin;
        select.style.fontSize = computedStyle.fontSize;
        select.style.fontWeight = computedStyle.fontWeight;
        select.style.lineHeight = computedStyle.lineHeight;
        select.dataset.field = 'inactive_reason';
        select.dataset.restricted = 'true';
        
        // Map of option values to labels
        const reasonLabels = {
          'temporary_pause': 'Tijdelijke pauze',
          'too_expensive': 'Te duur / budget',
          'insufficient_results': 'Onvoldoende resultaat',
          'not_matching_customer': 'Niet passende klant',
          'no_capacity': 'Geen capaciteit bij klant',
          'switch': 'Overstap',
          'conflict': 'Conflict',
          'non_payment': 'Wanbetaling',
          'other': 'Anders (toelichten)'
        };
        
        // Add empty option
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-';
        select.appendChild(emptyOption);
        
        // Add options
        options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = reasonLabels[opt] || opt;
          // Check if current value matches
          const currentValue = el.textContent.trim();
          if (currentValue === reasonLabels[opt] || currentValue === opt) {
            option.selected = true;
          }
          select.appendChild(option);
        });
        
        // Handle change event
        select.addEventListener('change', async () => {
          if (checkCanEdit() && select.value !== originalData.inactive_reason) {
            const confirmed = await showConfirmModal('Weet je zeker dat je de reden voor inactiviteit wilt aanpassen?');
            if (confirmed) {
              await saveFieldOnBlur('inactive_reason', select, true);
              // If "other" is selected, show the reason_other field
              if (select.value === 'other') {
                showInactiveReasonOtherField();
              } else {
                hideInactiveReasonOtherField();
              }
            } else {
              // Revert to original value
              const originalValue = originalData.inactive_reason;
              const matchingOption = Array.from(select.options).find(opt => {
                const optValue = opt.value;
                return reasonLabels[optValue] === originalValue || optValue === originalValue;
              });
              if (matchingOption) {
                select.value = matchingOption.value;
              }
            }
          }
        });
        
        el.replaceWith(select);
      });
      
      // Make inactive_reason_other editable (textarea)
      document.querySelectorAll('[data-field="inactive_reason_other"]').forEach(el => {
        if (!checkCanEdit()) return;
        
        const isRestricted = el.getAttribute('data-restricted') === 'true';
        if (!isRestricted) return;
        
        const text = el.textContent.trim();
        originalData.inactive_reason_other = text;
        
        // Preserve computed styles
        const computedStyle = window.getComputedStyle(el);
        
        // Create textarea
        const textarea = document.createElement('textarea');
        textarea.className = el.className;
        textarea.style.border = '1px solid #d1d5db';
        textarea.style.borderRadius = '4px';
        textarea.style.padding = '4px 8px';
        textarea.style.width = '100%';
        textarea.style.minHeight = '60px';
        textarea.style.margin = computedStyle.margin;
        textarea.style.fontSize = computedStyle.fontSize;
        textarea.style.fontWeight = computedStyle.fontWeight;
        textarea.style.lineHeight = computedStyle.lineHeight;
        textarea.style.fontFamily = computedStyle.fontFamily;
        textarea.dataset.field = 'inactive_reason_other';
        textarea.dataset.restricted = 'true';
        textarea.value = text;
        
        textarea.addEventListener('blur', async () => {
          if (checkCanEdit() && textarea.value !== originalData.inactive_reason_other) {
            const confirmed = await showConfirmModal('Weet je zeker dat je de toelichting wilt aanpassen?');
            if (confirmed) {
              await saveFieldOnBlur('inactive_reason_other', textarea, true);
            } else {
              textarea.value = originalData.inactive_reason_other;
            }
          }
        });
        
        el.replaceWith(textarea);
      });
      
      // Helper functions for inactive_reason_other field visibility
      function showInactiveReasonOtherField() {
        const otherItem = document.getElementById('inactive-reason-other-item');
        if (otherItem) {
          otherItem.style.display = 'block';
        } else {
          // If item doesn't exist, create it
          const reasonItem = document.querySelector('[data-field="inactive_reason"]')?.closest('.user-info-item');
          if (reasonItem) {
            const newItem = document.createElement('div');
            newItem.className = 'user-info-item';
            newItem.id = 'inactive-reason-other-item';
            newItem.innerHTML = `
              <p class="user-info-label">Toelichting</p>
              <p class="user-info-value" data-field="inactive_reason_other" data-edit-type="text" data-restricted="true"></p>
            `;
            reasonItem.insertAdjacentElement('afterend', newItem);
            // Make it editable if in edit mode
            if (isEditMode) {
              const textarea = document.createElement('textarea');
              textarea.className = 'user-info-value';
              textarea.style.border = '1px solid #d1d5db';
              textarea.style.borderRadius = '4px';
              textarea.style.padding = '4px 8px';
              textarea.style.width = '100%';
              textarea.style.minHeight = '60px';
              textarea.dataset.field = 'inactive_reason_other';
              textarea.dataset.restricted = 'true';
              textarea.value = originalData.inactive_reason_other || '';
              textarea.addEventListener('blur', async () => {
                if (checkCanEdit() && textarea.value !== (originalData.inactive_reason_other || '')) {
                  const confirmed = await showConfirmModal('Weet je zeker dat je de toelichting wilt aanpassen?');
                  if (confirmed) {
                    await saveFieldOnBlur('inactive_reason_other', textarea, true);
                  } else {
                    textarea.value = originalData.inactive_reason_other || '';
                  }
                }
              });
              newItem.querySelector('p').replaceWith(textarea);
            }
          }
        }
      }
      
      function hideInactiveReasonOtherField() {
        const otherItem = document.getElementById('inactive-reason-other-item');
        if (otherItem) {
          otherItem.style.display = 'none';
        }
      }
      
      // Check if inactive_reason is "other" and show/hide the other field accordingly
      const inactiveReasonSelect = document.querySelector('[data-field="inactive_reason"]');
      if (inactiveReasonSelect) {
        if (inactiveReasonSelect.tagName === 'SELECT') {
          // Already in edit mode, check value
          if (inactiveReasonSelect.value === 'other') {
            showInactiveReasonOtherField();
          } else {
            hideInactiveReasonOtherField();
          }
        } else {
          // Not in edit mode yet, check text content
          const currentText = inactiveReasonSelect.textContent.trim();
          if (currentText === 'Anders (toelichten)' || currentText === 'Anders') {
            showInactiveReasonOtherField();
          } else {
            hideInactiveReasonOtherField();
          }
        }
      }
    }
    
    // Save single field on blur (auto-save)
    async function saveFieldOnBlur(field, element, isRestricted = false) {
      let value = element.value;
      
      // For datetime-local inputs, convert to ISO string
      if (element.type === 'datetime-local' && value) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          value = date.toISOString();
        }
      }
      
      // For date inputs (inactive_from, inactive_to), convert to ISO date string (YYYY-MM-DD)
      if (element.type === 'date' && value) {
        // Date inputs already return YYYY-MM-DD format, which is what we want for DATE columns
        // But we need to handle empty values
        if (!value) {
          value = null;
        }
      }
      
      // For select elements, get the value
      if (element.tagName === 'SELECT') {
        value = element.value;
      }
      
      // For textarea elements, get the value
      if (element.tagName === 'TEXTAREA') {
        value = element.value;
      }
      
      // Check if value actually changed (compare with original, accounting for date format)
      let originalValue = originalData[field];
      if ((field === 'created_at' || field === 'inactive_from' || field === 'inactive_to') && originalValue) {
        // Compare dates properly
        const originalDate = new Date(originalValue);
        const newDate = new Date(value);
        if (originalDate.getTime() === newDate.getTime()) {
          return; // No change, don't save
        }
      } else if (value === originalValue) {
        return; // No change, don't save
      }
      
      // For restricted fields, confirmation is handled in the blur handler
      if (isRestricted) {
        // Already confirmed in blur handler
      }
      
      const updates = {};
      
      // Handle special fields
      if (field === 'name') {
        updates.name = value;
        updates.company_name = value;
      } else if (field === 'status') {
        updates.status = value;
        window.currentStatus = value;
      } else if (field === 'priority') {
        updates.priority = value;
        window.currentPriority = value;
      } else {
        updates[field] = value;
      }
      
      if (Object.keys(updates).length === 0) {
        return;
      }
      
      try {
        const response = await fetch(`/admin/api/customers/${customerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(updates)
        });
        
        const data = await response.json();
        if (response.ok && data.success) {
          // Update originalData to reflect saved value
          if (field === 'name') {
            originalData.name = value;
            originalData.company_name = value;
          } else {
            originalData[field] = value;
          }
          
          // Show success notification
          window.showNotification?.('Wijziging opgeslagen', 'success');
        } else {
          throw new Error(data.error || 'Fout bij bijwerken');
        }
      } catch (error) {
        console.error('Error saving field:', error);
        window.showNotification?.(error.message || 'Fout bij opslaan', 'error');
      }
    }
    
    
    // Logo modal + upload
    function openLogoModal() {
      if (!logoModal) return;
      const logoPreviewContainer = document.getElementById('customerLogoPreviewContainer');
      const logoPreview = document.getElementById('customerLogoPreview');
      const logoEditPencil = document.getElementById('customerLogoEditPencil');
      
      if (logoPreview && customerAvatar) {
        const img = customerAvatar.querySelector('img');
        if (img && img.src) {
          logoPreview.src = img.src;
          logoPreview.style.display = 'block';
          // Hide placeholder if exists
          const placeholder = logoPreviewContainer.querySelector('div');
          if (placeholder && placeholder.querySelector('svg')) {
            placeholder.style.display = 'none';
          }
          // Update container cursor and remove click handler
          if (logoPreviewContainer) {
            logoPreviewContainer.style.cursor = 'default';
            logoPreviewContainer.onclick = null;
          }
          // Show pencil icon for editing existing logo
          if (logoEditPencil) {
            logoEditPencil.style.display = 'flex';
          }
        } else {
          logoPreview.src = '';
          logoPreview.style.display = 'none';
          // Show placeholder
          const placeholder = logoPreviewContainer.querySelector('div');
          if (placeholder && placeholder.querySelector('svg')) {
            placeholder.style.display = 'flex';
          }
          // Make container clickable for upload
          if (logoPreviewContainer && logoUpload) {
            logoPreviewContainer.style.cursor = 'pointer';
            logoPreviewContainer.onclick = () => logoUpload.click();
          }
          // Hide pencil icon when no logo exists
          if (logoEditPencil) {
            logoEditPencil.style.display = 'none';
          }
        }
      }
      logoModal.style.display = 'flex';
      document.body.classList.add('modal-open');
    }

    function closeLogoModal() {
      if (!logoModal) return;
      logoModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }

    if (customerAvatarTrigger) {
      customerAvatarTrigger.addEventListener('click', openLogoModal);
    }
    if (logoModalClose) logoModalClose.addEventListener('click', closeLogoModal);
    if (logoModalX) logoModalX.addEventListener('click', closeLogoModal);
    if (logoModal) {
      logoModal.addEventListener('click', (e) => {
        if (e.target === logoModal) closeLogoModal();
      });
    }
    // Make preview container clickable for upload (when no logo exists)
    const logoPreviewContainer = document.getElementById('customerLogoPreviewContainer');
    if (logoPreviewContainer && logoUpload) {
      // Click handler
      logoPreviewContainer.addEventListener('click', () => {
        // Only trigger upload if no logo exists
        const previewImg = document.getElementById('customerLogoPreview');
        if (!previewImg || !previewImg.src || previewImg.style.display === 'none') {
          logoUpload.click();
        }
      });

      // Drag and drop handlers
      let dragCounter = 0;

      logoPreviewContainer.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        if (!customerAvatar || !customerAvatar.querySelector('img')) {
          logoPreviewContainer.style.borderColor = '#ea5d0d';
          logoPreviewContainer.style.background = '#fef3f2';
          logoPreviewContainer.style.borderWidth = '3px';
          const placeholder = document.getElementById('logoPlaceholderContent');
          if (placeholder) {
            placeholder.style.color = '#ea5d0d';
            placeholder.querySelector('svg').style.opacity = '1';
            placeholder.querySelector('svg').style.transform = 'scale(1.1)';
          }
        }
      });

      logoPreviewContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      logoPreviewContainer.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter === 0) {
          if (!customerAvatar || !customerAvatar.querySelector('img')) {
            logoPreviewContainer.style.borderColor = '#e5e7eb';
            logoPreviewContainer.style.background = '#f9fafb';
            logoPreviewContainer.style.borderWidth = '2px';
            const placeholder = document.getElementById('logoPlaceholderContent');
            if (placeholder) {
              placeholder.style.color = '#9ca3af';
              placeholder.querySelector('svg').style.opacity = '0.5';
              placeholder.querySelector('svg').style.transform = 'scale(1)';
            }
          }
        }
      });

      logoPreviewContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter = 0;
        
        // Reset styling
        if (!customerAvatar || !customerAvatar.querySelector('img')) {
          logoPreviewContainer.style.borderColor = '#e5e7eb';
          logoPreviewContainer.style.background = '#f9fafb';
          logoPreviewContainer.style.borderWidth = '2px';
          const placeholder = document.getElementById('logoPlaceholderContent');
          if (placeholder) {
            placeholder.style.color = '#9ca3af';
            placeholder.querySelector('svg').style.opacity = '0.5';
            placeholder.querySelector('svg').style.transform = 'scale(1)';
          }
        }

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          const file = files[0];
          if (file.type.startsWith('image/')) {
            // Validate file size
            if (file.size > 5 * 1024 * 1024) {
              window.showNotification?.('Bestand is te groot (max 5MB)', 'error');
              return;
            }
            // Create a FileList-like object and trigger upload
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            logoUpload.files = dataTransfer.files;
            // Trigger change event to upload
            logoUpload.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            window.showNotification?.('Alleen afbeeldingen zijn toegestaan', 'error');
          }
        }
      });
    }

    if (logoUpload) {
      logoUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
          window.showNotification?.('Alleen afbeeldingen zijn toegestaan', 'error');
          return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
          window.showNotification?.('Bestand is te groot (max 5MB)', 'error');
          return;
        }
        
        const formData = new FormData();
        formData.append('logo', file);
        
        try {
          const response = await fetch(`/admin/api/customers/${customerId}/logo`, {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
          });
          
          const data = await response.json();
          if (response.ok && data.success) {
            window.showNotification?.('Logo geüpload', 'success');
            if (customerAvatar && data.logo_url) {
              customerAvatar.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
              customerAvatar.innerHTML = `<img src="${data.logo_url}" alt="Logo" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%; background: white;" />`;
            }
            const logoPreviewContainer = document.getElementById('customerLogoPreviewContainer');
            const logoPreview = document.getElementById('customerLogoPreview');
            const logoEditPencil = document.getElementById('customerLogoEditPencil');
            if (logoPreview && data.logo_url) {
              logoPreview.src = data.logo_url;
              logoPreview.style.display = 'block';
              // Hide placeholder if exists
              const placeholder = logoPreviewContainer ? logoPreviewContainer.querySelector('div') : null;
              if (placeholder && placeholder.querySelector('svg')) {
                placeholder.style.display = 'none';
              }
              // Update container to not be clickable anymore
              if (logoPreviewContainer) {
                logoPreviewContainer.style.cursor = 'default';
                logoPreviewContainer.onclick = null;
              }
              // Show pencil icon for editing with orange color
              if (logoEditPencil) {
                logoEditPencil.style.display = 'flex';
                const pencilIcon = logoEditPencil.querySelector('i');
                if (pencilIcon) {
                  pencilIcon.style.color = '#ea5d0d';
                }
              }
            }
            closeLogoModal();
          } else {
            throw new Error(data.error || 'Fout bij uploaden logo');
          }
        } catch (error) {
          console.error('Error uploading logo:', error);
          window.showNotification?.(error.message || 'Fout bij uploaden logo', 'error');
        }
      });
    }
    
    // Edit buttons (both trigger the same function)
    if (editBtn) {
      editBtn.addEventListener('click', toggleEditMode);
    }
    if (editCompanyBtn) {
      editCompanyBtn.addEventListener('click', toggleEditMode);
    }
  }

  function init() {
    console.log('[customer.js] Initializing customer detail page');
    initMainTabs();
    initEmployeeManagement();
    initEditMode();
  }

  // ============================================
  // INVOICES MANAGEMENT
  // ============================================
  function initInvoicesManagement() {
    if (!customerId) return;

    const invoicesData = window.customerInvoicesData || { customerId, invoices: [] };
    const invoicesTableContainer = document.getElementById('invoicesTableContainer');
    const importFileInput = document.getElementById('invoiceImportFile');
    const addInvoiceBtn = document.getElementById('addInvoiceBtn');

    // Render invoices table
    function renderInvoicesTable(invoices = []) {
      if (!invoicesTableContainer) return;
      
      // Make function available globally
      window.renderInvoicesTable = renderInvoicesTable;

      if (invoices.length === 0) {
        invoicesTableContainer.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem;">
            <p class="user-empty-text" style="margin-bottom: 1.5rem;">Geen facturen gevonden.</p>
            <button type="button" class="btn-primary" onclick="document.getElementById('invoiceImportFile').click();" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 10px 20px; font-size: 14px; border: none; cursor: pointer; border-radius: 8px;">
              <i class="fas fa-upload"></i> Importeer facturen uit CSV
            </button>
          </div>
        `;
        return;
      }

      // Format currency
      const formatCurrency = (amount) => {
        return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount || 0);
      };

      // Format date
      const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      // Get status badge
      const getStatusBadge = (status) => {
        const statusMap = {
          'paid': { label: 'Betaald', class: 'status-paid' },
          'overdue': { label: 'Achterstallig', class: 'status-failed' },
          'pending': { label: 'In afwachting', class: 'status-pending' },
          'draft': { label: 'Concept', class: 'status-pending' },
          'invalid': { label: 'Ongeldig', class: 'status-failed' },
          'cancelled': { label: 'Geannuleerd', class: 'status-failed' }
        };
        const statusInfo = statusMap[status] || { label: status, class: 'status-pending' };
        return `<span class="status-badge ${statusInfo.class}">${statusInfo.label}</span>`;
      };

      invoicesTableContainer.innerHTML = `
        <div class="table-container">
          <div class="table-scroll">
            <table class="payments-table">
              <thead>
                <tr class="table-header-row">
                  <th class="table-header-cell">Datum</th>
                  <th class="table-header-cell">Factuurnr.</th>
                  <th class="table-header-cell">Ordernummer</th>
                  <th class="table-header-cell">Bedrag</th>
                  <th class="table-header-cell">Openstaand</th>
                  <th class="table-header-cell">Vervaldatum</th>
                  <th class="table-header-cell">Status</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(inv => `
                  <tr class="table-body-row" style="cursor: pointer;" onclick="window.location.href='/admin/customers/${customerId}/invoices/${inv.id}'" onmouseover="this.style.background='#f9fafb';" onmouseout="this.style.background='';">
                    <td class="table-cell">
                      <span class="cell-text">${formatDate(inv.invoice_date)}</span>
                    </td>
                    <td class="table-cell">
                      <span class="cell-text" style="font-weight: 500;">${inv.invoice_number || '-'}</span>
                    </td>
                    <td class="table-cell">
                      <span class="cell-text">${inv.order_number || '-'}</span>
                    </td>
                    <td class="table-cell">
                      <span class="amount-gross">${formatCurrency(inv.amount)}</span>
                    </td>
                    <td class="table-cell">
                      <span class="amount-fees">${formatCurrency(inv.status === 'paid' ? 0 : (inv.outstanding_amount || 0))}</span>
                    </td>
                    <td class="table-cell">
                      <span class="cell-text">${formatDate(inv.due_date)}</span>
                    </td>
                    <td class="table-cell">
                      ${getStatusBadge(inv.status)}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // Load invoices
    async function loadInvoices() {
      try {
        const response = await fetch(`/admin/api/customers/${customerId}/invoices`);
        const data = await response.json();
        if (data.success) {
          renderInvoicesTable(data.invoices || []);
        } else {
          console.error('Failed to load invoices:', data.error);
          if (invoicesTableContainer) {
            invoicesTableContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #ef4444;">Fout bij laden facturen: ' + (data.error || 'Onbekende fout') + '</p>';
          }
        }
      } catch (error) {
        console.error('Error loading invoices:', error);
        if (invoicesTableContainer) {
          invoicesTableContainer.innerHTML = '<p style="padding: 20px; text-align: center; color: #ef4444;">Fout bij laden facturen: ' + error.message + '</p>';
        }
      }
    }
    
    // Make loadInvoices available globally
    window.loadInvoices = loadInvoices;

    // Import CSV
    async function importCSV(file) {
      try {
        // Parse CSV
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          alert('CSV bestand is leeg of ongeldig');
          return;
        }

        let invoices = [];
        let isEboekhouden = false;
        
        // Detect e-boekhouden format (can be tab-separated OR comma-separated)
        // Check if header contains "Datum", "Nummer", "Relatie", "Bedrag (Incl)"
        const firstLine = lines[0] || '';
        const hasEboekhoudenHeaders = firstLine.includes('Datum') && 
                                      firstLine.includes('Nummer') && 
                                      firstLine.includes('Relatie') &&
                                      (firstLine.includes('Bedrag (Incl)') || firstLine.includes('Bedrag (Excl)'));
        
        // Check if tab-separated or comma-separated
        const isTabSeparated = firstLine.includes('\t');
        const isCommaSeparated = firstLine.includes(',') && !firstLine.includes('\t');
        
        if (hasEboekhoudenHeaders && (isTabSeparated || isCommaSeparated)) {
          isEboekhouden = true;
        }
        
        if (isEboekhouden) {
          // Parse e-boekhouden format (tab-separated OR comma-separated)
          // Find header row (contains "Datum", "Nummer", "Relatie")
          let headerIndex = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Datum') && lines[i].includes('Nummer') && lines[i].includes('Relatie')) {
              headerIndex = i;
              break;
            }
          }
          
          if (headerIndex === -1) {
            throw new Error('Kon header rij niet vinden in e-boekhouden bestand');
          }
          
          // Determine separator (tab or comma)
          const headerLine = lines[headerIndex];
          const separator = headerLine.includes('\t') ? '\t' : ',';
          
          // Parse headers (handle quoted fields for comma-separated)
          let headers;
          if (separator === ',') {
            headers = [];
            let current = '';
            let inQuotes = false;
            for (let j = 0; j < headerLine.length; j++) {
              const char = headerLine[j];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === ',' && !inQuotes) {
                headers.push(current.replace(/^"|"$/g, '').trim());
                current = '';
              } else {
                current += char;
              }
            }
            headers.push(current.replace(/^"|"$/g, '').trim()); // Add last field
          } else {
            headers = headerLine.split(separator).map(h => h.replace(/"/g, '').trim());
          }
          
          // Find column indices
          const dateIndex = headers.findIndex(h => h.toLowerCase().includes('datum') && !h.toLowerCase().includes('verval'));
          const numberIndex = headers.findIndex(h => h.toLowerCase().includes('nummer'));
          const relationIndex = headers.findIndex(h => h.toLowerCase().includes('relatie'));
          const amountExclIndex = headers.findIndex(h => h.toLowerCase().includes('bedrag') && h.toLowerCase().includes('excl'));
          const amountInclIndex = headers.findIndex(h => h.toLowerCase().includes('bedrag') && h.toLowerCase().includes('incl'));
          
          if (dateIndex === -1 || numberIndex === -1) {
            throw new Error('Kon verplichte kolommen niet vinden (Datum, Nummer)');
          }
          
          // Parse data rows (skip header and totals)
          for (let i = headerIndex + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines and total lines
            if (!line || line.toLowerCase().includes('totaal') || line.match(/^\d+[.,]\d+[\t,]/)) {
              continue;
            }
            
            // Use same separator as header
            // For comma-separated, need to handle quoted fields properly
            let values;
            if (separator === ',') {
              // Parse CSV line with quoted fields (handles commas inside quotes)
              values = [];
              let current = '';
              let inQuotes = false;
              for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '"') {
                  inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                  values.push(current.trim());
                  current = '';
                } else {
                  current += char;
                }
              }
              values.push(current.trim()); // Add last field
              values = values.map(v => v.replace(/^"|"$/g, '').trim()); // Remove surrounding quotes
            } else {
              // Tab-separated: simple split
              values = line.split(separator).map(v => v.replace(/"/g, '').trim());
            }
            
            // Skip if not enough columns
            if (values.length < Math.max(dateIndex, numberIndex, relationIndex || 0, amountInclIndex || 0) + 1) {
              continue;
            }
            
            const invoiceDate = (values[dateIndex] || '').replace(/"/g, '').trim();
            const invoiceNumber = (values[numberIndex] || '').replace(/"/g, '').trim();
            const relation = relationIndex >= 0 ? (values[relationIndex] || '').replace(/"/g, '').trim() : '';
            const amountIncl = amountInclIndex >= 0 ? (values[amountInclIndex] || '').replace(/"/g, '').trim() : '';
            const amountExcl = amountExclIndex >= 0 ? (values[amountExclIndex] || '').replace(/"/g, '').trim() : '';
            
            // Skip if missing required fields
            if (!invoiceDate || !invoiceNumber) {
              continue;
            }
            
            // Parse date (DD-MM-YYYY format)
            const parseDate = (dateStr) => {
              if (!dateStr) return null;
              const parts = dateStr.split('-');
              if (parts.length === 3) {
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                return `${year}-${month}-${day}`;
              }
              return null;
            };
            
            // Parse amount (format: "1.190,00" or "605,00" -> 1190.00 or 605.00)
            const parseAmount = (amountStr) => {
              if (!amountStr) return 0;
              // Remove spaces, replace comma with dot, handle negative
              const isNegative = amountStr.startsWith('-');
              const cleaned = amountStr.replace(/[€\s]/g, '').replace(/\./g, '').replace(',', '.');
              const amount = parseFloat(cleaned) || 0;
              return isNegative ? -amount : amount;
            };
            
            invoices.push({
              'Datum': invoiceDate,
              'Nummer': invoiceNumber,
              'Relatie': relation,
              'Bedrag (Excl)': amountExcl,
              'Bedrag (Incl)': amountIncl,
              // Pre-parse for easier server-side processing
              invoice_date: parseDate(invoiceDate),
              invoice_number: invoiceNumber,
              amount: parseAmount(amountIncl),
              amount_excl: parseAmount(amountExcl),
              customer_name: relation
            });
          }
        } else {
          // Original Zoho Books format (comma-separated)
          // Parse header
          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
          
          // Parse rows
          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
            const invoice = {};
            headers.forEach((header, index) => {
              invoice[header] = values[index] || '';
            });
            invoices.push(invoice);
          }
        }
        
        if (invoices.length === 0) {
          throw new Error('Geen facturen gevonden in bestand');
        }

        // Send to server
        const response = await fetch(`/admin/api/customers/${customerId}/invoices/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            invoices,
            format: isEboekhouden ? 'eboekhouden' : 'zoho'
          })
        });

        const data = await response.json();
        if (data.success) {
          if (window.showNotification) {
            window.showNotification(`Succesvol ${data.imported} facturen geïmporteerd`, 'success');
          } else if (window.showToast) {
            window.showToast(`Succesvol ${data.imported} facturen geïmporteerd`, 'success');
          } else {
            alert(`Succesvol ${data.imported} facturen geïmporteerd`);
          }
          loadInvoices();
        } else {
          throw new Error(data.error || 'Import mislukt');
        }
      } catch (error) {
        console.error('Error importing CSV:', error);
        if (window.showNotification) {
          window.showNotification('Fout bij importeren facturen: ' + error.message, 'error');
        } else if (window.showToast) {
          window.showToast('Fout bij importeren facturen: ' + error.message, 'error');
        } else {
          alert('Fout bij importeren facturen: ' + error.message);
        }
      }
    }

    // Event listeners
    if (importFileInput) {
      importFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          importCSV(file);
          e.target.value = ''; // Reset input
        }
      });
    }

    // Invoice button now navigates to new invoice page, no modal needed
    
    // Add invoice form submit handler
    const addInvoiceForm = document.getElementById('addInvoiceForm');
    if (addInvoiceForm) {
      addInvoiceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveInvoice();
      });
    }
    
    // Close modal on outside click
    const addInvoiceModal = document.getElementById('addInvoiceModal');
    if (addInvoiceModal) {
      addInvoiceModal.addEventListener('click', (e) => {
        if (e.target === addInvoiceModal) {
          closeAddInvoiceModal();
        }
      });
    }

    // Initial load - always fetch from API to ensure we get the correct customer's invoices
    loadInvoices();
  }
  
  // Invoice Items State (in initInvoicesManagement scope)
  let invoiceItems = [];
  
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function formatCurrency(amount) {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount || 0);
  }
  
  function updateInvoiceItemFromRow(row) {
    const index = parseInt(row.dataset.index);
    if (isNaN(index) || !invoiceItems[index]) return;
    
    const item = invoiceItems[index];
    item.description = row.querySelector('.item-description')?.value?.trim() || '';
    item.quantity = parseFloat(row.querySelector('.item-quantity')?.value || 1) || 1;
    item.unit_price = parseFloat(row.querySelector('.item-unit-price')?.value || 0) || 0;
    item.has_vat = row.querySelector('.item-has-vat')?.checked !== false; // Default to true
    
    // Calculate subtotal and total with VAT
    const subtotal = item.quantity * item.unit_price;
    const vatAmount = item.has_vat ? subtotal * 0.21 : 0;
    item.subtotal = subtotal;
    item.vat_amount = vatAmount;
    item.total = subtotal + vatAmount;
    
    // Update total display
    const totalInput = row.querySelector('.item-total');
    if (totalInput) {
      totalInput.value = formatCurrency(item.total);
    }
  }
  
  function updateInvoiceTotal() {
    // Update all items first
    document.querySelectorAll('.invoice-item-row').forEach(row => {
      updateInvoiceItemFromRow(row);
    });
    
    // Calculate totals
    const subtotal = invoiceItems.reduce((sum, item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unit_price || 0);
      return sum + itemSubtotal;
    }, 0);
    
    const vatTotal = invoiceItems.reduce((sum, item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unit_price || 0);
      const itemVat = (item.has_vat !== false) ? itemSubtotal * 0.21 : 0;
      return sum + itemVat;
    }, 0);
    
    const total = subtotal + vatTotal;
    
    // Update total display
    const totalDisplay = document.getElementById('invoiceTotalAmount');
    if (totalDisplay) {
      totalDisplay.textContent = formatCurrency(total);
    }
    
    // Update subtotal and VAT displays if they exist
    const subtotalDisplay = document.getElementById('invoiceSubtotalAmount');
    if (subtotalDisplay) {
      subtotalDisplay.textContent = formatCurrency(subtotal);
    }
    
    const vatDisplay = document.getElementById('invoiceVatAmount');
    if (vatDisplay) {
      vatDisplay.textContent = formatCurrency(vatTotal);
    }
    
    // Update amount input (total including VAT)
    const amountInput = document.getElementById('invoiceAmount');
    if (amountInput) {
      amountInput.value = total.toFixed(2);
    }
    
    // Auto-update outstanding amount if empty
    const outstandingInput = document.getElementById('outstandingAmount');
    if (outstandingInput && (!outstandingInput.value || outstandingInput.value === '0')) {
      outstandingInput.value = total.toFixed(2);
    }
  }
  
  function renderInvoiceItems() {
    const container = document.getElementById('invoiceItemsList');
    if (!container) return;
    
    container.innerHTML = invoiceItems.map((item, index) => {
      const subtotal = (item.quantity || 0) * (item.unit_price || 0);
      const hasVat = item.has_vat !== false; // Default to true
      const vatAmount = hasVat ? subtotal * 0.21 : 0;
      const total = subtotal + vatAmount;
      
      return `
        <div class="invoice-item-row" data-index="${index}" style="padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto auto; gap: 0.75rem; align-items: start;">
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151; font-size: 0.75rem;">Omschrijving *</label>
              <input type="text" class="item-description" value="${escapeHtml(item.description)}" placeholder="Bijv. Website ontwikkeling" required style="width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem;" />
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151; font-size: 0.75rem;">Aantal</label>
              <input type="number" class="item-quantity" value="${item.quantity || 1}" step="0.01" min="0" required style="width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem;" />
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151; font-size: 0.75rem;">Prijs (€)</label>
              <input type="number" class="item-unit-price" value="${(item.unit_price || 0).toFixed(2)}" step="0.01" min="0" required style="width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem;" />
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151; font-size: 0.75rem;">Totaal</label>
              <input type="text" class="item-total" value="${formatCurrency(total)}" readonly style="width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; background: #f3f4f6; color: #374151; font-weight: 600;" />
            </div>
            <div style="display: flex; align-items: flex-end; padding-bottom: 1.75rem;">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.75rem; color: #374151; font-weight: 500;">
                <input type="checkbox" class="item-has-vat" ${hasVat ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;" />
                <span>BTW 21%</span>
              </label>
            </div>
            <div style="display: flex; align-items: flex-end; padding-bottom: 1.75rem;">
              ${invoiceItems.length > 1 ? `
                <button type="button" onclick="removeInvoiceItem(${index})" style="padding: 0.625rem; background: #fee2e2; color: #991b1b; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem;" title="Verwijderen">
                  <i class="fas fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Attach event listeners
    container.querySelectorAll('.item-description, .item-quantity, .item-unit-price, .item-has-vat').forEach(input => {
      input.addEventListener('input', () => {
        updateInvoiceItemFromRow(input.closest('.invoice-item-row'));
        updateInvoiceTotal();
      });
      input.addEventListener('change', () => {
        updateInvoiceItemFromRow(input.closest('.invoice-item-row'));
        updateInvoiceTotal();
      });
    });
  }
  
  window.addInvoiceItemRow = function() {
    invoiceItems.push({
      description: '',
      quantity: 1,
      unit_price: 0,
      has_vat: true, // Default to true
      subtotal: 0,
      vat_amount: 0,
      total: 0
    });
    renderInvoiceItems();
  };
  
  window.removeInvoiceItem = function(index) {
    if (invoiceItems.length <= 1) {
      if (window.showNotification) {
        window.showNotification('Er moet minimaal 1 factuurregel zijn', 'error');
      } else if (window.showToast) {
        window.showToast('Er moet minimaal 1 factuurregel zijn', 'error');
      }
      return;
    }
    
    invoiceItems.splice(index, 1);
    renderInvoiceItems();
    updateInvoiceTotal();
  };
  
  // Invoice Drawer Functions (slide-in from right)
  function setInvoiceDrawerOpen(isOpen) {
    const drawer = document.getElementById('invoiceDrawer');
    const overlay = document.getElementById('invoiceDrawerOverlay');
    if (!drawer || !overlay) return;

    drawer.classList.toggle('is-open', isOpen);
    overlay.classList.toggle('is-open', isOpen);
    document.documentElement.classList.toggle('drawer-open', isOpen);
    document.body.classList.toggle('drawer-open', isOpen);

    // Inline-style fallback
    drawer.style.transform = isOpen ? 'translateX(0)' : 'translateX(110%)';
    overlay.style.opacity = isOpen ? '1' : '0';
    overlay.style.pointerEvents = isOpen ? 'auto' : 'none';

    drawer.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    overlay.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  }

  // Add Invoice Modal Functions
  window.openAddInvoiceModal = function() {
    const drawer = document.getElementById('invoiceDrawer');
    const form = document.getElementById('addInvoiceForm');
    const errorDiv = document.getElementById('addInvoiceFormError');
    
    if (!drawer || !form) return;
    
    // Reset form
    form.reset();
    if (errorDiv) {
      errorDiv.textContent = '';
      errorDiv.style.display = 'none';
    }
    
    // Reset invoice items
    invoiceItems = [{
      description: '',
      quantity: 1,
      unit_price: 0,
      has_vat: true, // Default to true
      subtotal: 0,
      vat_amount: 0,
      total: 0
    }];
    renderInvoiceItems();
    
    // Set default dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invoiceDate').value = today;
    
    // Calculate due date (30 days from today)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    document.getElementById('dueDate').value = dueDate.toISOString().split('T')[0];
    
    // Update total amount
    updateInvoiceTotal();
    
    // Open drawer
    setInvoiceDrawerOpen(true);
    
    // Focus first input
    setTimeout(() => {
      document.getElementById('invoiceNumber')?.focus();
    }, 100);
  };
  
  window.closeAddInvoiceModal = function() {
    setInvoiceDrawerOpen(false);
  };
  
  // Close drawer on overlay click
  const invoiceDrawerOverlay = document.getElementById('invoiceDrawerOverlay');
  if (invoiceDrawerOverlay) {
    invoiceDrawerOverlay.addEventListener('click', () => {
      closeAddInvoiceModal();
    });
  }
  
  // Close drawer on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const drawer = document.getElementById('invoiceDrawer');
      if (drawer && drawer.classList.contains('is-open')) {
        closeAddInvoiceModal();
      }
    }
  });
  
  async function saveInvoice() {
    const form = document.getElementById('addInvoiceForm');
    const errorDiv = document.getElementById('addInvoiceFormError');
    
    if (!form || !customerId) return;
    
    // Update all items from DOM
    document.querySelectorAll('.invoice-item-row').forEach(row => {
      updateInvoiceItemFromRow(row);
    });
    
    // Validate invoice items
    if (invoiceItems.length === 0) {
      if (errorDiv) {
        errorDiv.textContent = 'Voeg minimaal 1 factuurregel toe';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    // Validate each item
    for (let i = 0; i < invoiceItems.length; i++) {
      const item = invoiceItems[i];
      if (!item.description || item.description.trim().length === 0) {
        if (errorDiv) {
          errorDiv.textContent = `Regel ${i + 1}: omschrijving is verplicht`;
          errorDiv.style.display = 'block';
        }
        return;
      }
      if (item.quantity <= 0) {
        if (errorDiv) {
          errorDiv.textContent = `Regel ${i + 1}: aantal moet groter dan 0 zijn`;
          errorDiv.style.display = 'block';
        }
        return;
      }
      if (item.unit_price < 0) {
        if (errorDiv) {
          errorDiv.textContent = `Regel ${i + 1}: prijs moet een geldig positief getal zijn`;
          errorDiv.style.display = 'block';
        }
        return;
      }
    }
    
    // Calculate total from items
    const totalAmount = invoiceItems.reduce((sum, item) => {
      return sum + ((item.quantity || 0) * (item.unit_price || 0));
    }, 0);
    
    const formData = new FormData(form);
    
    // Get outstanding amount, default to amount if empty
    let outstandingAmount = parseFloat(formData.get('outstanding_amount')) || 0;
    if (outstandingAmount === 0 && totalAmount > 0) {
      outstandingAmount = totalAmount;
    }
    
    const invoiceData = {
      invoice_number: formData.get('invoice_number').trim(),
      invoice_date: formData.get('invoice_date'),
      due_date: formData.get('due_date') || null,
      order_number: formData.get('order_number')?.trim() || null,
      amount: totalAmount,
      outstanding_amount: outstandingAmount,
      status: formData.get('status'),
      notes: formData.get('notes')?.trim() || null,
      line_items: invoiceItems.map(item => ({
        description: item.description.trim(),
        quantity: item.quantity,
        unit_price: item.unit_price,
        has_vat: item.has_vat !== false, // Default to true
        subtotal: item.subtotal || (item.quantity * item.unit_price),
        vat_amount: item.vat_amount || ((item.has_vat !== false) ? (item.quantity * item.unit_price * 0.21) : 0),
        total: item.total || ((item.quantity * item.unit_price) + ((item.has_vat !== false) ? (item.quantity * item.unit_price * 0.21) : 0))
      }))
    };
    
    // Validation
    if (!invoiceData.invoice_number) {
      if (errorDiv) {
        errorDiv.textContent = 'Factuurnummer is verplicht';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    if (!invoiceData.invoice_date) {
      if (errorDiv) {
        errorDiv.textContent = 'Factuurdatum is verplicht';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    if (isNaN(invoiceData.amount) || invoiceData.amount < 0) {
      if (errorDiv) {
        errorDiv.textContent = 'Bedrag moet een geldig positief getal zijn';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    try {
      // Disable submit button
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opslaan...';
      }
      
      const response = await fetch(`/admin/api/customers/${customerId}/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(invoiceData)
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij opslaan factuur');
      }
      
      // Success: close modal, reload invoices, show notification
      closeAddInvoiceModal();
      
      // Reload invoices - call loadInvoices from initInvoicesManagement scope
      const invoicesTableContainer = document.getElementById('invoicesTableContainer');
      if (invoicesTableContainer) {
        // Reload by fetching again
        try {
          const reloadResponse = await fetch(`/admin/api/customers/${customerId}/invoices`);
          const reloadData = await reloadResponse.json();
          if (reloadData.success) {
            // Re-render table
            const formatCurrency = (amount) => {
              return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount || 0);
            };
            const formatDate = (dateStr) => {
              if (!dateStr) return '-';
              const date = new Date(dateStr);
              return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
            };
            const getStatusBadge = (status) => {
              const statusMap = {
                'paid': { label: 'Betaald', class: 'status-paid' },
                'overdue': { label: 'Achterstallig', class: 'status-failed' },
                'pending': { label: 'In afwachting', class: 'status-pending' },
                'draft': { label: 'Concept', class: 'status-pending' },
                'invalid': { label: 'Ongeldig', class: 'status-failed' },
                'cancelled': { label: 'Geannuleerd', class: 'status-failed' }
              };
              const statusInfo = statusMap[status] || { label: status, class: 'status-pending' };
              return `<span class="status-badge ${statusInfo.class}">${statusInfo.label}</span>`;
            };
            
            const invoices = reloadData.invoices || [];
            if (invoices.length === 0) {
              invoicesTableContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem 1rem;">
                  <p class="user-empty-text" style="margin-bottom: 1.5rem;">Geen facturen gevonden.</p>
                  <button type="button" class="btn-primary" onclick="document.getElementById('invoiceImportFile').click();" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 10px 20px; font-size: 14px; border: none; cursor: pointer; border-radius: 8px;">
                    <i class="fas fa-upload"></i> Importeer facturen uit CSV
                  </button>
                </div>
              `;
            } else {
              invoicesTableContainer.innerHTML = `
                <div class="table-container">
                  <div class="table-scroll">
                    <table class="payments-table">
                      <thead>
                        <tr class="table-header-row">
                          <th class="table-header-cell">Datum</th>
                          <th class="table-header-cell">Factuurnr.</th>
                          <th class="table-header-cell">Ordernummer</th>
                          <th class="table-header-cell">Bedrag</th>
                          <th class="table-header-cell">Openstaand</th>
                          <th class="table-header-cell">Vervaldatum</th>
                          <th class="table-header-cell">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${invoices.map(inv => `
                          <tr class="table-body-row">
                            <td class="table-cell">
                              <span class="cell-text">${formatDate(inv.invoice_date)}</span>
                            </td>
                            <td class="table-cell">
                              <span class="cell-text" style="font-weight: 500;">${inv.invoice_number || '-'}</span>
                            </td>
                            <td class="table-cell">
                              <span class="cell-text">${inv.order_number || '-'}</span>
                            </td>
                            <td class="table-cell">
                              <span class="amount-gross">${formatCurrency(inv.amount)}</span>
                            </td>
                            <td class="table-cell">
                              <span class="amount-fees">${formatCurrency(inv.outstanding_amount)}</span>
                            </td>
                            <td class="table-cell">
                              <span class="cell-text">${formatDate(inv.due_date)}</span>
                            </td>
                            <td class="table-cell">
                              ${getStatusBadge(inv.status)}
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              `;
            }
          }
        } catch (reloadError) {
          console.error('Error reloading invoices:', reloadError);
        }
      }
      
      // Show notification
      if (window.showNotification) {
        window.showNotification('Factuur succesvol toegevoegd', 'success');
      } else if (window.showToast) {
        window.showToast('Factuur succesvol toegevoegd', 'success');
      } else {
        alert('Factuur succesvol toegevoegd');
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      if (errorDiv) {
        errorDiv.textContent = error.message || 'Fout bij opslaan factuur';
        errorDiv.style.display = 'block';
      }
      
      // Re-enable submit button
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Opslaan';
      }
      
      if (window.showNotification) {
        window.showNotification('Fout bij opslaan: ' + error.message, 'error');
      } else if (window.showToast) {
        window.showToast('Fout bij opslaan: ' + error.message, 'error');
      }
    }
  }

  // #region agent log layout instrumentation (H1-H4)
  function logLayoutDebug() {
    try {
      const grid = document.querySelector('.user-detail-grid-new');
      const mainCol = document.querySelector('.user-detail-main-new');
      const sideCol = document.querySelector('.user-detail-sidebar-new');
      if (grid && mainCol && sideCol && typeof fetch === 'function') {
        const gridStyle = window.getComputedStyle(grid);
        const mainRect = mainCol.getBoundingClientRect();
        const sideRect = sideCol.getBoundingClientRect();
        const payloadBase = {
          sessionId: 'debug-session',
          runId: 'layout-pre',
          timestamp: Date.now()
        };
        fetch('http://127.0.0.1:7242/ingest/70d77f2c-8912-4bf5-a634-228d7daf290d',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            ...payloadBase,
            hypothesisId:'H1',
            location:'customer.js:grid',
            message:'Grid computed style',
            data:{
              gridTemplateColumns:gridStyle.gridTemplateColumns,
              alignItems:gridStyle.alignItems,
              display:gridStyle.display
            }
          })
        }).catch(()=>{});
        fetch('http://127.0.0.1:7242/ingest/70d77f2c-8912-4bf5-a634-228d7daf290d',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            ...payloadBase,
            hypothesisId:'H2',
            location:'customer.js:rects',
            message:'Columns bounding rect',
            data:{
              main:{w:mainRect.width,h:mainRect.height,top:mainRect.top,left:mainRect.left},
              side:{w:sideRect.width,h:sideRect.height,top:sideRect.top,left:sideRect.left},
              viewport:{w:window.innerWidth,h:window.innerHeight},
              scrollY:window.scrollY
            }
          })
        }).catch(()=>{});
        const sideStyle = window.getComputedStyle(sideCol);
        fetch('http://127.0.0.1:7242/ingest/70d77f2c-8912-4bf5-a634-228d7daf290d',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            ...payloadBase,
            hypothesisId:'H3',
            location:'customer.js:display',
            message:'Sidebar display/flex values',
            data:{
              sideDisplay:sideStyle.display,
              sideFlex:sideStyle.flex,
              sideMinWidth:sideStyle.minWidth
            }
          })
        }).catch(()=>{});
        fetch('http://127.0.0.1:7242/ingest/70d77f2c-8912-4bf5-a634-228d7daf290d',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            ...payloadBase,
            hypothesisId:'H4',
            location:'customer.js:children',
            message:'Grid children count/order',
            data:{
              childTags:Array.from(grid.children).map(el=>el.className || el.tagName),
              mainIndex:Array.from(grid.children).indexOf(mainCol),
              sideIndex:Array.from(grid.children).indexOf(sideCol)
            }
          })
        }).catch(()=>{});
      }
    } catch (e) {
      // swallow instrumentation errors
    }
  }
  // #endregion

  // Ensure sidebar is inside the grid (DOM safety)
  function ensureSidebarPlacement() {
    const grid = document.querySelector('.user-detail-grid-new');
    const mainCol = document.querySelector('.user-detail-main-new');
    const sideCol = document.querySelector('.user-detail-sidebar-new');
    if (!grid || !mainCol || !sideCol) return;
    if (sideCol.parentElement !== grid) {
      grid.appendChild(sideCol); // move sidebar into grid
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureSidebarPlacement();
      init();
      initInvoicesManagement();
      logLayoutDebug();
    });
  } else {
    ensureSidebarPlacement();
    init();
    initInvoicesManagement();
    logLayoutDebug();
  }
})();

// Contract Upload Handler for Customers
(function() {
  'use strict';
  
  const customerId = window.customerEmployeesData?.customerId;
  const canEditCustomer = window.canEditCustomer !== false;
  
  if (!customerId) return;
  
  // Helper function to escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // Initialize drag and drop for contract upload
  function initContractDragAndDrop() {
    const contractUploadArea = document.getElementById('contractUploadArea');
    const contractUpload = document.getElementById('contractUpload');
    
    if (!contractUploadArea || !contractUpload) return;
    
    let dragCounter = 0;
    
    // Prevent default drag behavior
    contractUploadArea.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter++;
      
      if (dragCounter === 1) {
        contractUploadArea.style.borderColor = '#3b82f6'; // Blue border
        contractUploadArea.style.background = '#eff6ff'; // Light blue background
        contractUploadArea.style.borderWidth = '2px'; // Thicker border
        const uploadIcon = contractUploadArea.querySelector('svg');
        if (uploadIcon) {
          uploadIcon.style.transform = 'scale(1.1)';
          uploadIcon.style.color = '#3b82f6';
        }
        const uploadText = contractUploadArea.querySelector('p');
        if (uploadText) {
          uploadText.style.color = '#3b82f6';
        }
      }
    });
    
    contractUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    
    contractUploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter--;
      
      if (dragCounter === 0) {
        contractUploadArea.style.borderColor = '#e5e7eb'; // Original border color
        contractUploadArea.style.background = '#f9fafb'; // Original background
        contractUploadArea.style.borderWidth = '1px'; // Original border thickness
        const uploadIcon = contractUploadArea.querySelector('svg');
        if (uploadIcon) {
          uploadIcon.style.transform = 'scale(1)';
          uploadIcon.style.color = '#9ca3af';
        }
        const uploadText = contractUploadArea.querySelector('p');
        if (uploadText) {
          uploadText.style.color = '#6b7280';
        }
      }
    });
    
    contractUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter = 0;
      
      // Reset visual feedback
      contractUploadArea.style.borderColor = '#e5e7eb';
      contractUploadArea.style.background = '#f9fafb';
      contractUploadArea.style.borderWidth = '1px';
      const uploadIcon = contractUploadArea.querySelector('svg');
      if (uploadIcon) {
        uploadIcon.style.transform = 'scale(1)';
        uploadIcon.style.color = '#9ca3af';
      }
      const uploadText = contractUploadArea.querySelector('p');
      if (uploadText) {
        uploadText.style.color = '#6b7280';
      }
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        // Check file type
        const file = files[0];
        const allowedTypes = ['.pdf', '.doc', '.docx'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExtension)) {
          window.showNotification?.('Alleen PDF, DOC of DOCX bestanden zijn toegestaan', 'error');
          return;
        }
        
        // Simulate file input change event
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        contractUpload.files = dataTransfer.files;
        const changeEvent = new Event('change', { bubbles: true });
        contractUpload.dispatchEvent(changeEvent);
      }
    });
  }
  
  // Initialize drag and drop when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContractDragAndDrop);
  } else {
    initContractDragAndDrop();
  }
  
  // Also initialize after contract display updates
  const originalHandleContractUpload = window.handleContractUpload;
  
  // Contract Upload Handler
  window.handleContractUpload = async function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('contract', file);
    
    const contractDisplay = document.getElementById('contractDisplay');
    const originalContent = contractDisplay.innerHTML;
    contractDisplay.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Uploaden...</div>';
    
    try {
      const res = await fetch(`/admin/api/customers/${customerId}/contract`, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
      });
      
      const data = await res.json();
      
      if (data.success) {
        const fileName = data.filename || file.name;
        const displayFileName = fileName.length > 30 ? fileName.substring(0, 27) + '...' : fileName;
        contractDisplay.innerHTML = `
          <div style="position: relative; padding: 1.5rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            ${canEditCustomer ? `
            <button onclick="showContractMenu(event)" class="contract-menu-btn" style="position: absolute; top: 0.75rem; right: 0.75rem; background: none; border: none; color: #6b7280; cursor: pointer; padding: 0.5rem; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10;" onmouseover="this.style.background='#f3f4f6'; this.style.color='#374151';" onmouseout="this.style.background='none'; this.style.color='#6b7280';">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </button>
            ` : ''}
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem; width: 100%;">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <p id="contractFileName" style="margin: 0; font-size: 0.875rem; color: #374151; font-weight: 500; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(fileName)}">${escapeHtml(displayFileName)}</p>
            </div>
          </div>
        `;
        window.showNotification?.('Contract succesvol geüpload!', 'success');
        // Update customer data
        if (window.customerData) {
          window.customerData.contract_document_url = data.url;
          window.customerData.contract_document_name = data.filename;
        }
      } else {
        contractDisplay.innerHTML = originalContent;
        window.showNotification?.(data.error || 'Fout bij uploaden contract', 'error');
        // Re-initialize drag and drop after error
        setTimeout(initContractDragAndDrop, 100);
      }
    } catch (error) {
      contractDisplay.innerHTML = originalContent;
      console.error('Error uploading contract:', error);
      window.showNotification?.(error.message || 'Fout bij uploaden contract', 'error');
      // Re-initialize drag and drop after error
      setTimeout(initContractDragAndDrop, 100);
    }
    
    event.target.value = '';
  };
  
  // Open Contract File
  window.openContractFile = function() {
    const contractUrl = window.customerData?.contract_document_url;
    if (contractUrl) {
      window.open(contractUrl, '_blank');
    }
  };
  
  // Show Contract Menu (3 dots dropdown)
  window.showContractMenu = function(event) {
    event.stopPropagation();
    
    const existingDropdown = document.querySelector('.contract-actions-dropdown');
    if (existingDropdown) {
      existingDropdown.remove();
      return;
    }
    
    const contractUrl = window.customerData?.contract_document_url;
    if (!contractUrl) return;
    
    const dropdown = document.createElement('div');
    dropdown.className = 'contract-actions-dropdown';
    dropdown.style.cssText = `
      position: fixed;
      background: white;
      border: 0.5px solid #e5e7eb;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      min-width: 180px;
      padding: 0.5rem 0;
    `;
    
    const button = event.target.closest('.contract-menu-btn');
    const rect = button.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.right = (window.innerWidth - rect.right) + 'px';
    
    const menuItems = [
      { icon: 'fa-eye', text: 'Bekijken', action: () => window.openContractFile() },
      { icon: 'fa-download', text: 'Downloaden', action: () => {
        const link = document.createElement('a');
        link.href = contractUrl;
        link.download = window.customerData?.contract_document_name || 'contract';
        link.click();
      }},
      { icon: 'fa-exchange-alt', text: 'Vervangen', action: () => {
        document.getElementById('contractUpload')?.click();
        dropdown.remove();
      }},
      { icon: 'fa-trash', text: 'Verwijderen', action: () => {
        if (confirm('Weet je zeker dat je dit contract wilt verwijderen?')) {
          window.deleteContract();
        }
        dropdown.remove();
      }}
    ];
    
    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'contract-menu-item';
      menuItem.style.cssText = `
        padding: 0.75rem 1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: #374151;
        font-size: 0.875rem;
        transition: background 0.15s;
      `;
      menuItem.innerHTML = `<i class="fas ${item.icon}" style="width: 16px;"></i><span>${item.text}</span>`;
      menuItem.onmouseover = () => menuItem.style.background = '#f9fafb';
      menuItem.onmouseout = () => menuItem.style.background = 'transparent';
      menuItem.onclick = item.action;
      dropdown.appendChild(menuItem);
    });
    
    document.body.appendChild(dropdown);
    
    setTimeout(() => {
      document.addEventListener('click', function closeDropdown() {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      });
    }, 0);
  };
  
  // Delete Contract
  window.deleteContract = async function() {
    const contractDisplay = document.getElementById('contractDisplay');
    const originalContent = contractDisplay.innerHTML;
    contractDisplay.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Verwijderen...</div>';
    
    try {
      const res = await fetch(`/admin/api/customers/${customerId}/contract`, {
        method: 'DELETE',
        credentials: 'same-origin'
      });
      
      const data = await res.json();
      
      if (data.success) {
        contractDisplay.innerHTML = `
          ${canEditCustomer ? `
          <label for="contractUpload" style="display: block; cursor: pointer;">
            <div id="contractUploadArea" class="contract-drop-zone" style="padding: 2rem 1.5rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; transition: all 0.2s;" onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#d1d5db';" onmouseout="this.style.background='#f9fafb'; this.style.borderColor='#e5e7eb';">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #9ca3af; transition: all 0.2s;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <p style="margin: 0; font-size: 0.875rem; color: #6b7280; font-weight: 500; transition: all 0.2s;">Upload bestand</p>
            </div>
          </label>
          <input type="file" id="contractUpload" accept=".pdf,.doc,.docx" style="display: none;" onchange="handleContractUpload(event)">
          ` : `
          <div style="padding: 2rem 1.5rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem;">
            <p style="margin: 0; font-size: 0.875rem; color: #6b7280;">Nog geen overeenkomst</p>
          </div>
          `}
        `;
        window.showNotification?.('Contract succesvol verwijderd', 'success');
        if (window.customerData) {
          window.customerData.contract_document_url = null;
          window.customerData.contract_document_name = null;
        }
        // Re-initialize drag and drop after deletion
        setTimeout(initContractDragAndDrop, 100);
      } else {
        contractDisplay.innerHTML = originalContent;
        window.showNotification?.(data.error || 'Fout bij verwijderen contract', 'error');
      }
    } catch (error) {
      contractDisplay.innerHTML = originalContent;
      console.error('Error deleting contract:', error);
      window.showNotification?.(error.message || 'Fout bij verwijderen contract', 'error');
    }
  };
})();

