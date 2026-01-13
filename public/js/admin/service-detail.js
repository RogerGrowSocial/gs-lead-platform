// Service Detail Page JavaScript

(function() {
  'use strict';

  // Get service ID from page
  const pageElement = document.querySelector('.service-detail-page');
  const serviceId = pageElement?.dataset?.serviceId;
  if (!serviceId) {
    console.error('❌ Service ID not found');
    return;
  }

  // State
  let serviceData = null;
  let currentPeriod = '30d';
  let currentTab = 'overview';
  let analyticsData = null;
  
  // Expose to global scope for modals (will be set after loadServiceData is defined)

  // Initialize
  function initialize() {
    console.log('🔧 Service Detail Page: Initializing...', { serviceId });
    
    if (!serviceId) {
      console.error('❌ Service ID not found');
      return;
    }
    
    // Set initial period in dropdown
    const periodSelect = document.getElementById('periodSelect');
    if (periodSelect) {
      periodSelect.value = currentPeriod;
    }
    
    // Load all data
    loadServiceData();
    loadKPIData();
    
    console.log('✅ Service Detail Page: Initialized');
  }

  // Load service data
  async function loadServiceData() {
    try {
      const response = await fetch(`/api/admin/services/${serviceId}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij laden dienst');
      }
      
      serviceData = result.data;
      
      // Expose to global scope for modals
      window.serviceData = serviceData;
      
      // Update UI
      updateOverviewTab();
      updatePricingTab();
      
      // Expose to global scope for modals
      window.serviceData = serviceData;
      window.loadServiceData = loadServiceData;
      
      // Signal that service data is ready
      window.dispatchEvent(new Event('serviceDetailReady'));
      
      console.log('✅ Service data loaded:', serviceData);
    } catch (error) {
      console.error('❌ Error loading service data:', error);
      showNotification('Fout bij laden dienst: ' + error.message, 'error');
    }
  }

  // Load KPI data
  async function loadKPIData() {
    try {
      const response = await fetch(`/api/admin/services/kpis?period=${currentPeriod}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij laden KPI data');
      }
      
      const kpis = result.data;
      
      // Update KPI cards
      document.getElementById('kpiRevenue').textContent = formatCurrency(kpis.total_revenue_cents || 0);
      document.getElementById('kpiProfit').textContent = formatCurrency(kpis.total_profit_cents);
      document.getElementById('kpiMargin').textContent = kpis.weighted_margin_percent !== null 
        ? kpis.weighted_margin_percent.toFixed(1) + '%' 
        : '—';
      
      // Update subtitle
      const periodText = {
        '30d': 'Laatste 30 dagen',
        '90d': 'Laatste 90 dagen',
        '365d': 'Laatste 365 dagen'
      }[currentPeriod] || 'Laatste 30 dagen';
      document.getElementById('kpiRevenueSubtitle').textContent = periodText;
      
      console.log('✅ KPI data loaded:', kpis);
    } catch (error) {
      console.error('❌ Error loading KPI data:', error);
      showNotification('Fout bij laden KPI data: ' + error.message, 'error');
    }
  }

  // Load analytics data
  async function loadAnalyticsData() {
    try {
      const response = await fetch(`/api/admin/services/${serviceId}/analytics?period=${currentPeriod}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij laden analytics');
      }
      
      analyticsData = result.data;
      updateAnalyticsTab();
      
      console.log('✅ Analytics data loaded:', analyticsData);
    } catch (error) {
      console.error('❌ Error loading analytics data:', error);
      showNotification('Fout bij laden analytics: ' + error.message, 'error');
    }
  }

  // Update Overview Tab
  function updateOverviewTab() {
    if (!serviceData) return;
    
    const service = serviceData.service;
    
    // Update summary
    const summaryPricingMode = document.getElementById('summaryPricingMode');
    const summaryBillingModel = document.getElementById('summaryBillingModel');
    const summaryBasePrice = document.getElementById('summaryBasePrice');
    const summaryBaseCost = document.getElementById('summaryBaseCost');
    const summarySellable = document.getElementById('summarySellable');
    const summaryRequiresApproval = document.getElementById('summaryRequiresApproval');
    
    if (summaryPricingMode) summaryPricingMode.textContent = formatPricingMode(service.pricing_mode);
    if (summaryBillingModel) summaryBillingModel.textContent = formatBillingModel(service.billing_model);
    if (summaryBasePrice) summaryBasePrice.textContent = formatCurrency(service.base_price_cents || service.price_cents);
    if (summaryBaseCost) summaryBaseCost.textContent = formatCurrency(service.base_cost_cents || service.cost_cents);
    if (summarySellable) summarySellable.textContent = service.is_sellable ? 'Ja' : 'Nee';
    if (summaryRequiresApproval) summaryRequiresApproval.textContent = service.requires_approval ? 'Ja' : 'Nee';
    
    // Update snapshots
    const activeTiersCount = document.getElementById('activeTiersCount');
    const activeAddonsCount = document.getElementById('activeAddonsCount');
    const activeRulesCount = document.getElementById('activeRulesCount');
    
    if (activeTiersCount) activeTiersCount.textContent = serviceData.summary?.active_tiers_count || 0;
    if (activeAddonsCount) activeAddonsCount.textContent = serviceData.summary?.active_addons_count || 0;
    if (activeRulesCount) activeRulesCount.textContent = serviceData.summary?.active_rules_count || 0;
    
    // Update sidebar
    updateSidebar();
    
    // Update created date
    const serviceCreatedAt = document.getElementById('serviceCreatedAt');
    if (serviceCreatedAt && service.created_at) {
      serviceCreatedAt.textContent = 'Sinds ' + formatDate(service.created_at);
    }
    
    // Update recent activity
    updateRecentActivity();
  }
  
  // Update Sidebar
  function updateSidebar() {
    if (!serviceData) return;
    
    const service = serviceData.service;
    const summary = serviceData.summary || {};
    
    // Update pricing info
    const sidebarBasePrice = document.getElementById('sidebarBasePrice');
    const sidebarBaseCost = document.getElementById('sidebarBaseCost');
    const sidebarMargin = document.getElementById('sidebarMargin');
    
    if (sidebarBasePrice) sidebarBasePrice.textContent = formatCurrency(service.base_price_cents || service.price_cents);
    if (sidebarBaseCost) sidebarBaseCost.textContent = formatCurrency(service.base_cost_cents || service.cost_cents);
    
    // Calculate margin
    if (sidebarMargin) {
      const price = service.base_price_cents || service.price_cents || 0;
      const cost = service.base_cost_cents || service.cost_cents || 0;
      const margin = price - cost;
      sidebarMargin.textContent = formatCurrency(margin);
    }
    
    // Update stats
    const sidebarTotalSales = document.getElementById('sidebarTotalSales');
    const sidebarLastSold = document.getElementById('sidebarLastSold');
    
    if (sidebarTotalSales) sidebarTotalSales.textContent = summary.total_sales || 0;
    if (sidebarLastSold) {
      if (summary.last_sold_at) {
        sidebarLastSold.textContent = formatRelativeTime(summary.last_sold_at);
      } else {
        sidebarLastSold.textContent = 'Nog niet verkocht';
      }
    }
  }

  // Update Recent Activity
  function updateRecentActivity() {
    const container = document.getElementById('recentActivityList');
    if (!container || !serviceData.audit_log) return;
    
    const activities = serviceData.audit_log.slice(0, 10);
    
    if (activities.length === 0) {
      container.innerHTML = '<div class="empty-state"><p class="empty-state-text">Geen recente activiteit</p></div>';
      return;
    }
    
    container.innerHTML = activities.map(activity => {
      const actionText = formatAction(activity.action);
      const date = formatRelativeTime(activity.created_at);
      
      return `
        <div class="activity-item">
          <div class="activity-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="activity-content">
            <p class="activity-title">${actionText}</p>
            <p class="activity-date">${date}</p>
          </div>
        </div>
      `;
    }).join('');
  }

  // Update Pricing Tab
  function updatePricingTab() {
    if (!serviceData) return;
    
    // Update pricing mode display
    updatePricingModeDisplay();
    
    // Update tiers
    updateTiersList();
    
    // Update addons
    updateAddonsList();
    
    // Update discount rules
    updateDiscountRulesList();
  }
  
  // Update Pricing Mode Display
  function updatePricingModeDisplay() {
    const container = document.getElementById('pricingModeDisplay');
    if (!container || !serviceData) return;
    
    const service = serviceData.service;
    
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div style="padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
          <p style="font-size: 0.75rem; color: #6b7280; margin: 0 0 0.5rem 0; font-weight: 500;">Prijsmodel</p>
          <p style="font-size: 1rem; font-weight: 600; color: #111827; margin: 0;">${formatPricingMode(service.pricing_mode)}</p>
        </div>
        <div style="padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
          <p style="font-size: 0.75rem; color: #6b7280; margin: 0 0 0.5rem 0; font-weight: 500;">Facturering</p>
          <p style="font-size: 1rem; font-weight: 600; color: #111827; margin: 0;">${formatBillingModel(service.billing_model)}</p>
        </div>
        <div style="padding: 1rem; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #bae6fd; border-radius: 8px;">
          <p style="font-size: 0.75rem; color: #0369a1; margin: 0 0 0.5rem 0; font-weight: 500;">Basisprijs</p>
          <p style="font-size: 1.25rem; font-weight: 700; color: #0369a1; margin: 0;">${formatCurrency(service.base_price_cents || service.price_cents)}</p>
        </div>
        <div style="padding: 1rem; background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 1px solid #fecaca; border-radius: 8px;">
          <p style="font-size: 0.75rem; color: #991b1b; margin: 0 0 0.5rem 0; font-weight: 500;">Basis kost</p>
          <p style="font-size: 1.25rem; font-weight: 700; color: #991b1b; margin: 0;">${formatCurrency(service.base_cost_cents || service.cost_cents)}</p>
        </div>
      </div>
    `;
  }

  // Update Tiers List
  function updateTiersList() {
    const container = document.getElementById('tiersList');
    if (!container) return;
    
    const tiers = serviceData.tiers || [];
    const activeTiers = tiers.filter(t => t.is_active);
    
    if (activeTiers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-layer-group"></i>
          </div>
          <h3>Geen prijsschalen</h3>
          <p>Voeg prijsschalen toe om verschillende pakketten aan te bieden</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <table class="service-table">
        <thead>
          <tr>
            <th>Naam</th>
            <th>Facturering</th>
            <th>Prijs</th>
            <th>Kost</th>
            ${window.canEdit ? '<th>Acties</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${activeTiers.map(tier => `
            <tr>
              <td>
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <strong style="color: #111827;">${escapeHtml(tier.name)}</strong>
                  ${tier.description ? `<span style="font-size: 0.75rem; color: #6b7280;">${escapeHtml(tier.description.substring(0, 50))}${tier.description.length > 50 ? '...' : ''}</span>` : ''}
                </div>
              </td>
              <td>
                <span style="padding: 0.25rem 0.5rem; background: #eff6ff; color: #1e40af; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">${formatBillingModel(tier.billing_model)}</span>
              </td>
              <td><strong style="color: #0369a1;">${formatCurrency(tier.price_cents)}</strong></td>
              <td>${formatCurrency(tier.cost_cents)}</td>
              ${window.canEdit ? `
              <td>
                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn-secondary btn-action" onclick="editTier('${tier.id}')" style="padding: 0.375rem 0.75rem; font-size: 0.75rem; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-pencil-alt"></i>
                  </button>
                  <button class="btn-secondary btn-action" onclick="archiveTier('${tier.id}')" style="padding: 0.375rem 0.75rem; font-size: 0.75rem; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-archive"></i>
                  </button>
                </div>
              </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Update Addons List
  function updateAddonsList() {
    const container = document.getElementById('addonsList');
    if (!container) return;
    
    const addons = serviceData.addons || [];
    const activeAddons = addons.filter(a => a.is_active);
    
    if (activeAddons.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-plus-circle"></i>
          </div>
          <h3>Geen add-ons</h3>
          <p>Voeg add-ons toe om extra opties aan te bieden</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <table class="service-table">
        <thead>
          <tr>
            <th>Naam</th>
            <th>Facturering</th>
            <th>Prijs</th>
            <th>Kost</th>
            ${window.canEdit ? '<th>Acties</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${activeAddons.map(addon => `
            <tr>
              <td>
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <strong style="color: #111827;">${escapeHtml(addon.name)}</strong>
                  ${addon.description ? `<span style="font-size: 0.75rem; color: #6b7280;">${escapeHtml(addon.description.substring(0, 50))}${addon.description.length > 50 ? '...' : ''}</span>` : ''}
                </div>
              </td>
              <td>
                <span style="padding: 0.25rem 0.5rem; background: #eff6ff; color: #1e40af; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">${formatBillingModel(addon.billing_model)}</span>
              </td>
              <td><strong style="color: #0369a1;">${formatCurrency(addon.price_cents)}</strong></td>
              <td>${formatCurrency(addon.cost_cents)}</td>
              ${window.canEdit ? `
              <td>
                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn-secondary btn-action" onclick="editAddon('${addon.id}')" style="padding: 0.375rem 0.75rem; font-size: 0.75rem; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-pencil-alt"></i>
                  </button>
                  <button class="btn-secondary btn-action" onclick="archiveAddon('${addon.id}')" style="padding: 0.375rem 0.75rem; font-size: 0.75rem; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-archive"></i>
                  </button>
                </div>
              </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Update Discount Rules List
  function updateDiscountRulesList() {
    const container = document.getElementById('discountRulesList');
    if (!container) return;
    
    const rules = serviceData.discount_rules || [];
    const activeRules = rules.filter(r => r.is_active);
    
    if (activeRules.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-percent"></i>
          </div>
          <h3>Geen kortingsregels</h3>
          <p>Voeg kortingsregels toe om speciale prijzen aan te bieden</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <table class="service-table">
        <thead>
          <tr>
            <th>Naam</th>
            <th>Type</th>
            <th>Waarde</th>
            <th>Van toepassing op</th>
            ${window.canEdit ? '<th>Acties</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${activeRules.map(rule => `
            <tr>
              <td>
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <strong style="color: #111827;">${escapeHtml(rule.name)}</strong>
                  ${rule.starts_at || rule.ends_at ? `
                    <span style="font-size: 0.75rem; color: #6b7280;">
                      ${rule.starts_at ? 'Van ' + formatDate(rule.starts_at) : ''}
                      ${rule.starts_at && rule.ends_at ? ' tot ' : ''}
                      ${rule.ends_at ? formatDate(rule.ends_at) : ''}
                    </span>
                  ` : ''}
                </div>
              </td>
              <td>
                <span style="padding: 0.25rem 0.5rem; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">${formatRuleType(rule.rule_type)}</span>
              </td>
              <td><strong style="color: #059669;">${formatRuleValue(rule)}</strong></td>
              <td>${formatAppliesTo(rule.applies_to)}</td>
              ${window.canEdit ? `
              <td>
                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn-secondary btn-action" onclick="editDiscountRule('${rule.id}')" style="padding: 0.375rem 0.75rem; font-size: 0.75rem; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-pencil-alt"></i>
                  </button>
                  <button class="btn-secondary btn-action" onclick="archiveDiscountRule('${rule.id}')" style="padding: 0.375rem 0.75rem; font-size: 0.75rem; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-archive"></i>
                  </button>
                </div>
              </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Update Delivery Tab
  function updateDeliveryTab() {
    if (!serviceData) return;
    
    updateTemplatesList();
    updateDeliverySettings();
  }

  // Update Templates List
  function updateTemplatesList() {
    const container = document.getElementById('templatesList');
    if (!container) return;
    
    const templates = serviceData.delivery_templates || [];
    
    if (templates.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <i class="fas fa-file-alt"></i>
          </div>
          <h3>Geen leveringssjablonen</h3>
          <p>Voeg sjablonen toe om levering te automatiseren</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = `
      <table class="service-table">
        <thead>
          <tr>
            <th>Naam</th>
            <th>Type</th>
            <th>Auto-creatie</th>
            ${window.canEdit ? '<th>Acties</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${templates.map(template => `
            <tr>
              <td>
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                  <strong style="color: #111827;">${escapeHtml(template.name)}</strong>
                  ${template.description ? `<span style="font-size: 0.75rem; color: #6b7280;">${escapeHtml(template.description.substring(0, 50))}${template.description.length > 50 ? '...' : ''}</span>` : ''}
                </div>
              </td>
              <td>
                <span style="padding: 0.25rem 0.5rem; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">${formatTemplateType(template.template_type)}</span>
              </td>
              <td>
                ${template.auto_create_on_sale ? `
                  <span style="padding: 0.25rem 0.5rem; background: #d1fae5; color: #166534; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">
                    <i class="fas fa-check-circle" style="margin-right: 0.25rem;"></i>Ja
                  </span>
                ` : `
                  <span style="padding: 0.25rem 0.5rem; background: #f3f4f6; color: #6b7280; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">Nee</span>
                `}
              </td>
              ${window.canEdit ? `
              <td>
                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn-secondary btn-action" onclick="editTemplate('${template.id}')" style="padding: 0.375rem 0.75rem; font-size: 0.75rem; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-pencil-alt"></i>
                  </button>
                  <button class="btn-secondary btn-action" onclick="deleteTemplate('${template.id}')" style="padding: 0.375rem 0.75rem; font-size: 0.75rem; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; cursor: pointer;">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Update Delivery Settings
  function updateDeliverySettings() {
    const container = document.getElementById('deliverySettings');
    if (!container || !serviceData) return;
    
    const service = serviceData.service;
    
    container.innerHTML = `
      <div class="service-summary-grid">
        <div class="summary-item">
          <span class="summary-label">Leveringsmodus:</span>
          <span class="summary-value">${formatDeliveryMode(service.delivery_mode)}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">SLA (uren):</span>
          <span class="summary-value">${service.default_sla_hours || '—'}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Standaard prioriteit:</span>
          <span class="summary-value">${service.default_priority || '—'}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Goedkeuring vereist:</span>
          <span class="summary-value">${service.requires_approval ? 'Ja' : 'Nee'}</span>
        </div>
      </div>
    `;
  }

  // Update Analytics Tab
  function updateAnalyticsTab() {
    if (!analyticsData) return;
    
    const container = document.getElementById('analyticsContent');
    if (!container) return;
    
    const { kpis, breakdown, recent_items } = analyticsData;
    
    container.innerHTML = `
      <div class="service-card" style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem;">KPI's</h4>
        <div class="service-summary-grid">
          <div class="summary-item">
            <span class="summary-label">Totale omzet:</span>
            <span class="summary-value">${formatCurrency(kpis.total_revenue_cents)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Brutowinst:</span>
            <span class="summary-value">${formatCurrency(kpis.total_profit_cents)}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Marge %:</span>
            <span class="summary-value">${kpis.margin_percent !== null ? kpis.margin_percent.toFixed(1) + '%' : '—'}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Aantal verkopen:</span>
            <span class="summary-value">${kpis.sales_count}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Gem. orderwaarde:</span>
            <span class="summary-value">${formatCurrency(kpis.avg_order_value_cents)}</span>
          </div>
        </div>
      </div>
      
      <div class="service-card">
        <h4 style="margin-bottom: 1rem;">Recente verkopen</h4>
        ${recent_items && recent_items.length > 0 ? `
          <table class="service-table">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Aantal</th>
                <th>Omzet</th>
                <th>Bron</th>
              </tr>
            </thead>
            <tbody>
              ${recent_items.map(item => `
                <tr>
                  <td>${formatDate(item.occurred_at)}</td>
                  <td>${item.quantity}</td>
                  <td>${formatCurrency(item.revenue_cents)}</td>
                  <td>${item.source || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<div class="empty-state"><p class="empty-state-text">Geen verkopen</p></div>'}
      </div>
    `;
  }

  // Tab switching
  window.switchTab = function(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.service-tab-btn').forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle('active', isActive);
      
      // Update styles
      if (isActive) {
        btn.style.color = '#2563eb';
        btn.style.borderBottomColor = '#2563eb';
        btn.style.fontWeight = '600';
      } else {
        btn.style.color = '#6b7280';
        btn.style.borderBottomColor = 'transparent';
        btn.style.fontWeight = '500';
      }
    });
    
    // Update tab content
    document.querySelectorAll('.service-tab-content').forEach(content => {
      const isActive = content.id === `tab-${tabName}`;
      content.classList.toggle('active', isActive);
      content.style.display = isActive ? 'block' : 'none';
    });
    
    // Load data for specific tabs
    if (tabName === 'analytics') {
      loadAnalyticsData();
    } else if (tabName === 'settings') {
      updateSettingsTab();
    }
  };
  
  // Update Settings Tab
  function updateSettingsTab() {
    if (!serviceData) return;
    
    const container = document.getElementById('advancedSettings');
    if (!container) return;
    
    const service = serviceData.service;
    
    container.innerHTML = `
      <div style="display: grid; gap: 1.5rem;">
        <!-- Visibility Settings -->
        <div class="user-card" style="padding: 1.5rem; background: white; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h4 style="margin: 0 0 1rem 0; font-size: 1rem; font-weight: 600; color: #111827;">Zichtbaarheid</h4>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f9fafb; border-radius: 6px;">
              <div>
                <p style="margin: 0; font-weight: 500; color: #374151; font-size: 0.875rem;">Verkoopbaar</p>
                <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: #6b7280;">Deze dienst kan worden verkocht</p>
              </div>
              <label style="position: relative; display: inline-block; width: 48px; height: 24px;">
                <input type="checkbox" ${service.is_sellable ? 'checked' : ''} onchange="updateServiceSetting('is_sellable', this.checked)" style="opacity: 0; width: 0; height: 0;">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${service.is_sellable ? '#2563eb' : '#ccc'}; border-radius: 24px; transition: 0.3s;">
                  <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: 0.3s; transform: ${service.is_sellable ? 'translateX(24px)' : 'translateX(0)'};"></span>
                </span>
              </label>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f9fafb; border-radius: 6px;">
              <div>
                <p style="margin: 0; font-weight: 500; color: #374151; font-size: 0.875rem;">Zichtbaar voor klanten</p>
                <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: #6b7280;">Toon in klantenportaal</p>
              </div>
              <label style="position: relative; display: inline-block; width: 48px; height: 24px;">
                <input type="checkbox" ${service.is_visible_to_customers ? 'checked' : ''} onchange="updateServiceSetting('is_visible_to_customers', this.checked)" style="opacity: 0; width: 0; height: 0;">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${service.is_visible_to_customers ? '#2563eb' : '#ccc'}; border-radius: 24px; transition: 0.3s;">
                  <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: 0.3s; transform: ${service.is_visible_to_customers ? 'translateX(24px)' : 'translateX(0)'};"></span>
                </span>
              </label>
            </div>
          </div>
        </div>
        
        <!-- Fulfillment Settings -->
        <div class="user-card" style="padding: 1.5rem; background: white; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h4 style="margin: 0 0 1rem 0; font-size: 1rem; font-weight: 600; color: #111827;">Levering</h4>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f9fafb; border-radius: 6px;">
              <div>
                <p style="margin: 0; font-weight: 500; color: #374151; font-size: 0.875rem;">Medewerkers kunnen leveren</p>
                <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: #6b7280;">Medewerkers kunnen deze dienst uitvoeren</p>
              </div>
              <label style="position: relative; display: inline-block; width: 48px; height: 24px;">
                <input type="checkbox" ${service.allow_employee_fulfillment ? 'checked' : ''} onchange="updateServiceSetting('allow_employee_fulfillment', this.checked)" style="opacity: 0; width: 0; height: 0;">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${service.allow_employee_fulfillment ? '#2563eb' : '#ccc'}; border-radius: 24px; transition: 0.3s;">
                  <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: 0.3s; transform: ${service.allow_employee_fulfillment ? 'translateX(24px)' : 'translateX(0)'};"></span>
                </span>
              </label>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f9fafb; border-radius: 6px;">
              <div>
                <p style="margin: 0; font-weight: 500; color: #374151; font-size: 0.875rem;">Goedkeuring vereist</p>
                <p style="margin: 0.25rem 0 0 0; font-size: 0.75rem; color: #6b7280;">Vereis goedkeuring voor levering</p>
              </div>
              <label style="position: relative; display: inline-block; width: 48px; height: 24px;">
                <input type="checkbox" ${service.requires_approval ? 'checked' : ''} onchange="updateServiceSetting('requires_approval', this.checked)" style="opacity: 0; width: 0; height: 0;">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${service.requires_approval ? '#2563eb' : '#ccc'}; border-radius: 24px; transition: 0.3s;">
                  <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; border-radius: 50%; transition: 0.3s; transform: ${service.requires_approval ? 'translateX(24px)' : 'translateX(0)'};"></span>
                </span>
              </label>
            </div>
          </div>
        </div>
        
        <!-- Delivery Mode -->
        <div class="user-card" style="padding: 1.5rem; background: white; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h4 style="margin: 0 0 1rem 0; font-size: 1rem; font-weight: 600; color: #111827;">Leveringsmodus</h4>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151; font-size: 0.875rem;">Modus</label>
            <select id="deliveryModeSelect" onchange="updateServiceSetting('delivery_mode', this.value)" style="width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; background: white; font-size: 0.875rem;">
              <option value="manual" ${service.delivery_mode === 'manual' ? 'selected' : ''}>Handmatig</option>
              <option value="task_template" ${service.delivery_mode === 'task_template' ? 'selected' : ''}>Taaksjabloon</option>
              <option value="automated" ${service.delivery_mode === 'automated' ? 'selected' : ''}>Geautomatiseerd</option>
            </select>
          </div>
          ${service.default_sla_hours ? `
            <div style="margin-bottom: 1rem;">
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151; font-size: 0.875rem;">Standaard SLA (uren)</label>
              <input type="number" id="defaultSlaInput" value="${service.default_sla_hours}" onchange="updateServiceSetting('default_sla_hours', parseInt(this.value))" style="width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem;" />
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  // Update Service Setting
  window.updateServiceSetting = async function(setting, value) {
    if (!serviceId) return;
    
    try {
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ [setting]: value })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij bijwerken');
      }
      
      // Reload service data
      await loadServiceData();
      showNotification('Instelling succesvol bijgewerkt', 'success');
    } catch (error) {
      console.error('Error updating setting:', error);
      showNotification('Fout bij bijwerken: ' + error.message, 'error');
    }
  };

  // Period selector
  window.changePeriod = function(period) {
    if (!period || !['30d', '90d', '365d'].includes(period)) {
      return;
    }
    
    currentPeriod = period;
    
    // Update dropdown value
    const periodSelect = document.getElementById('periodSelect');
    if (periodSelect) {
      periodSelect.value = period;
    }
    
    // Reload KPI data
    loadKPIData();
    
    // Reload analytics if on analytics tab
    if (currentTab === 'analytics') {
      loadAnalyticsData();
    }
  };

  // Format helpers
  function formatCurrency(cents) {
    if (cents === null || cents === undefined) return '—';
    return new Intl.NumberFormat('nl-NL', {style:'currency',currency:'EUR',minimumFractionDigits:2}).format((cents || 0) / 100);
  }

  function formatDate(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatRelativeTime(iso) {
    if (!iso) return '-';
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Zojuist';
    if (diffMins < 60) return `${diffMins} minuten geleden`;
    if (diffHours < 24) return `${diffHours} uur geleden`;
    if (diffDays < 7) return `${diffDays} dagen geleden`;
    return formatDate(iso);
  }

  function formatPricingMode(mode) {
    const modes = {
      'fixed': 'Vast',
      'tiers': 'Variabel (met pakketten)',
      'recurring': 'Variabel (met pakketten)',
      'usage': 'Variabel (met pakketten)',
      'hybrid': 'Variabel (met pakketten)'
    };
    return modes[mode] || mode;
  }

  function formatBillingModel(model) {
    const models = {
      'one_time': 'Eenmalig',
      'monthly': 'Maandelijks',
      'yearly': 'Jaarlijks',
      'custom': 'Aangepast'
    };
    return models[model] || model;
  }

  function formatDeliveryMode(mode) {
    const modes = {
      'manual': 'Handmatig',
      'task_template': 'Taaksjabloon',
      'automated': 'Geautomatiseerd'
    };
    return modes[mode] || mode;
  }

  function formatTemplateType(type) {
    const types = {
      'task': 'Taak',
      'checklist': 'Checklist',
      'workflow': 'Workflow'
    };
    return types[type] || type;
  }

  function formatRuleType(type) {
    const types = {
      'percentage': 'Percentage',
      'fixed_amount': 'Vast bedrag',
      'volume': 'Volume',
      'coupon': 'Coupon',
      'bundle': 'Bundle'
    };
    return types[type] || type;
  }

  function formatRuleValue(rule) {
    if (rule.rule_type === 'percentage') {
      return `${rule.value_numeric}%`;
    } else if (rule.rule_type === 'fixed_amount') {
      return formatCurrency(rule.value_numeric * 100);
    }
    return rule.value_numeric;
  }

  function formatAppliesTo(appliesTo) {
    const applies = {
      'base': 'Basis',
      'tier': 'Schaal',
      'addon': 'Add-on',
      'total': 'Totaal'
    };
    return applies[appliesTo] || appliesTo;
  }

  function formatAction(action) {
    const actions = {
      'created': 'Dienst aangemaakt',
      'updated': 'Dienst bijgewerkt',
      'price_changed': 'Prijs gewijzigd',
      'tier_added': 'Prijsschaal toegevoegd',
      'tier_updated': 'Prijsschaal bijgewerkt',
      'tier_removed': 'Prijsschaal verwijderd',
      'addon_added': 'Add-on toegevoegd',
      'addon_updated': 'Add-on bijgewerkt',
      'addon_removed': 'Add-on verwijderd',
      'rule_added': 'Kortingsregel toegevoegd',
      'rule_updated': 'Kortingsregel bijgewerkt',
      'rule_removed': 'Kortingsregel verwijderd',
      'template_added': 'Sjabloon toegevoegd',
      'template_updated': 'Sjabloon bijgewerkt',
      'template_removed': 'Sjabloon verwijderd',
      'status_changed': 'Status gewijzigd',
      'archived': 'Gearchiveerd',
      'restored': 'Hersteld'
    };
    return actions[action] || action;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Notification helper
  function showNotification(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      alert(message);
    }
  }

  // Open Edit Service Modal
  window.openEditServiceModal = function() {
    if (!serviceData || !serviceData.service) {
      showNotification('Service data niet beschikbaar', 'error');
      return;
    }
    
    const service = serviceData.service;
    const modal = document.getElementById('serviceEditModal');
    const form = document.getElementById('editServiceForm');
    const errorDiv = document.getElementById('editServiceFormError');
    
    if (!modal || !form) {
      showNotification('Modal niet gevonden', 'error');
      return;
    }
    
    // Reset form
    form.reset();
    if (errorDiv) errorDiv.style.display = 'none';
    
    // Populate form
    document.getElementById('editServiceId').value = service.id;
    document.getElementById('editServiceName').value = service.name || '';
    document.getElementById('editServiceSlug').value = service.slug || '';
    document.getElementById('editServiceType').value = service.service_type || 'one_time';
    document.getElementById('editServiceStatus').value = service.status || 'active';
    document.getElementById('editServiceDescription').value = service.description || '';
    
    // Show modal
    modal.style.display = 'flex';
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  };
  
  // Close Edit Service Modal
  window.closeEditServiceModal = function() {
    const modal = document.getElementById('serviceEditModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  };
  
  // Save Service
  async function saveService() {
    const form = document.getElementById('editServiceForm');
    const errorDiv = document.getElementById('editServiceFormError');
    
    if (!form) return;
    
    const formData = new FormData(form);
    const serviceId = formData.get('id');
    
    if (!serviceId) {
      if (errorDiv) {
        errorDiv.textContent = 'Service ID ontbreekt';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    // Get form values
    const data = {
      name: formData.get('name'),
      slug: formData.get('slug'),
      service_type: formData.get('service_type'),
      status: formData.get('status'),
      description: formData.get('description') || null
    };
    
    // Validation
    if (!data.name || !data.slug || !data.service_type || !data.status) {
      if (errorDiv) {
        errorDiv.textContent = 'Vul alle verplichte velden in';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij opslaan');
      }
      
      // Close modal
      closeEditServiceModal();
      
      // Reload service data
      await loadServiceData();
      await loadKPIData();
      
      showNotification('Dienst succesvol bijgewerkt', 'success');
    } catch (error) {
      console.error('Error saving service:', error);
      if (errorDiv) {
        errorDiv.textContent = error.message || 'Fout bij opslaan dienst';
        errorDiv.style.display = 'block';
      }
      showNotification('Fout bij opslaan: ' + error.message, 'error');
    }
  }
  
  // Setup form submit handler
  document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('editServiceForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveService();
      });
    }
    
    // Close modal on outside click
    const modal = document.getElementById('serviceEditModal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeEditServiceModal();
        }
      });
    }
  });

  window.duplicateService = async function() {
    if (!confirm('Weet je zeker dat je deze dienst wilt dupliceren? Dit maakt een kopie met alle prijsschalen, add-ons en kortingsregels.')) {
      return;
    }
    
    try {
      // Get current service data
      if (!serviceData || !serviceData.service) {
        await loadServiceData();
      }
      
      const service = serviceData.service;
      
      // Create duplicate service
      const response = await fetch(`/api/admin/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${service.name} (Kopie)`,
          slug: `${service.slug}-kopie-${Date.now()}`,
          description: service.description,
          service_type: service.service_type,
          status: 'inactive', // Start as inactive
          price_cents: service.base_price_cents || service.price_cents,
          cost_cents: service.base_cost_cents || service.cost_cents,
          unit_label: service.base_unit_label || service.unit_label,
          pricing_mode: service.pricing_mode,
          billing_model: service.billing_model
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij dupliceren');
      }
      
      const newServiceId = result.data.id;
      
      // Duplicate tiers
      if (serviceData.tiers && serviceData.tiers.length > 0) {
        for (const tier of serviceData.tiers) {
          await fetch(`/api/admin/services/${newServiceId}/tiers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: tier.name,
              description: tier.description,
              billing_model: tier.billing_model,
              price_cents: tier.price_cents,
              cost_cents: tier.cost_cents,
              unit_label: tier.unit_label,
              included_units: tier.included_units,
              overage_price_cents: tier.overage_price_cents
            })
          });
        }
      }
      
      // Duplicate addons
      if (serviceData.addons && serviceData.addons.length > 0) {
        for (const addon of serviceData.addons) {
          await fetch(`/api/admin/services/${newServiceId}/addons`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: addon.name,
              description: addon.description,
              billing_model: addon.billing_model,
              price_cents: addon.price_cents,
              cost_cents: addon.cost_cents,
              unit_label: addon.unit_label
            })
          });
        }
      }
      
      showNotification('Dienst succesvol gedupliceerd', 'success');
      
      // Redirect to new service
      setTimeout(() => {
        window.location.href = `/admin/services/${newServiceId}`;
      }, 1000);
    } catch (error) {
      console.error('Error duplicating service:', error);
      showNotification('Fout bij dupliceren: ' + error.message, 'error');
    }
  };

  window.archiveService = async function() {
    if (!confirm('Weet je zeker dat je deze dienst wilt archiveren?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/services/${serviceId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij archiveren');
      }
      
      showNotification('Dienst succesvol gearchiveerd', 'success');
      
      // Reload page after short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error archiving service:', error);
      showNotification('Fout bij archiveren: ' + error.message, 'error');
    }
  };

  window.restoreService = async function() {
    if (!confirm('Weet je zeker dat je deze dienst wilt herstellen?')) {
      return;
    }
    
    try {
      // Restore by updating status to active
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'active' })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij herstellen');
      }
      
      showNotification('Dienst succesvol hersteld', 'success');
      
      // Reload page after short delay
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error restoring service:', error);
      showNotification('Fout bij herstellen: ' + error.message, 'error');
    }
  };

  // Set canEdit for global access
  window.canEdit = typeof canEdit !== 'undefined' ? canEdit : false;
  
  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();

