// Service Detail Modals - All modal functionality

(function() {
  'use strict';

  const serviceId = document.querySelector('.service-detail-page')?.dataset?.serviceId;
  if (!serviceId) return;

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  
  // Helper to get serviceData
  function getServiceData() {
    // Try multiple sources
    if (window.serviceData && window.serviceData.service) {
      return window.serviceData;
    }
    
    return null;
  }
  
  // Helper to reload service data
  async function reloadServiceData() {
    if (window.loadServiceData) {
      await window.loadServiceData();
    } else {
      // Fallback: reload page
      window.location.reload();
    }
  }
  
  // Helper for notifications
  function showNotification(message, type = 'info') {
    if (window.showNotification) {
      window.showNotification(message, type);
    } else {
      alert(message);
    }
  }

  // ============================================
  // TIER MODAL
  // ============================================
  
  window.openAddTierModal = function() {
    openTierModal();
  };

  window.editTier = function(tierId) {
    const data = getServiceData();
    if (!data || !data.tiers) {
      showNotification('Tier data niet beschikbaar', 'error');
      return;
    }
    
    const tier = data.tiers.find(t => t.id === tierId);
    if (!tier) {
      showNotification('Tier niet gevonden', 'error');
      return;
    }
    
    openTierModal(tier);
  };

  function openTierModal(tier = null) {
    const modal = document.getElementById('tierModal');
    const form = document.getElementById('tierForm');
    const errorDiv = document.getElementById('tierFormError');
    const title = document.getElementById('tierModalTitle');
    
    if (!modal || !form) {
      showNotification('Modal niet gevonden', 'error');
      return;
    }
    
    form.reset();
    if (errorDiv) errorDiv.style.display = 'none';
    
    if (title) {
      title.textContent = tier ? 'Prijsschaal bewerken' : 'Nieuwe prijsschaal';
    }
    
    if (tier) {
      document.getElementById('tierId').value = tier.id;
      document.getElementById('tierName').value = tier.name || '';
      document.getElementById('tierDescription').value = tier.description || '';
      document.getElementById('tierBillingModel').value = tier.billing_model || 'monthly';
      document.getElementById('tierPrice').value = (tier.price_cents || 0) / 100;
      document.getElementById('tierCost').value = (tier.cost_cents || 0) / 100;
      document.getElementById('tierUnitLabel').value = tier.unit_label || '';
    } else {
      document.getElementById('tierId').value = '';
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  window.closeTierModal = function() {
    const modal = document.getElementById('tierModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  };

  async function saveTier() {
    const form = document.getElementById('tierForm');
    const errorDiv = document.getElementById('tierFormError');
    
    if (!form) return;
    
    const formData = new FormData(form);
    const tierId = formData.get('id');
    const isEdit = !!tierId;
    
    const data = {
      name: formData.get('name'),
      description: formData.get('description') || null,
      billing_model: formData.get('billing_model'),
      price_cents: parseFloat(formData.get('price_cents')),
      cost_cents: parseFloat(formData.get('cost_cents')),
      unit_label: formData.get('unit_label') || null
    };
    
    if (!data.name || !data.billing_model) {
      if (errorDiv) {
        errorDiv.textContent = 'Vul alle verplichte velden in';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    if (isNaN(data.price_cents) || data.price_cents < 0 || isNaN(data.cost_cents) || data.cost_cents < 0) {
      if (errorDiv) {
        errorDiv.textContent = 'Prijs en kost moeten positieve getallen zijn';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    try {
      const url = isEdit 
        ? `/api/admin/services/${serviceId}/tiers/${tierId}`
        : `/api/admin/services/${serviceId}/tiers`;
      const method = isEdit ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...data,
          price_cents: data.price_cents,
          cost_cents: data.cost_cents
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij opslaan');
      }
      
      closeTierModal();
      await reloadServiceData();
      showNotification(result.message || 'Prijsschaal succesvol opgeslagen', 'success');
    } catch (error) {
      console.error('Error saving tier:', error);
      if (errorDiv) {
        errorDiv.textContent = error.message || 'Fout bij opslaan prijsschaal';
        errorDiv.style.display = 'block';
      }
      showNotification('Fout bij opslaan: ' + error.message, 'error');
    }
  }

  // ============================================
  // ADDON MODAL
  // ============================================
  
  window.openAddAddonModal = function() {
    openAddonModal();
  };

  window.editAddon = function(addonId) {
    const data = getServiceData();
    if (!data || !data.addons) {
      showNotification('Addon data niet beschikbaar', 'error');
      return;
    }
    
    const addon = data.addons.find(a => a.id === addonId);
    if (!addon) {
      showNotification('Add-on niet gevonden', 'error');
      return;
    }
    
    openAddonModal(addon);
  };

  function openAddonModal(addon = null) {
    const modal = document.getElementById('addonModal');
    const form = document.getElementById('addonForm');
    const errorDiv = document.getElementById('addonFormError');
    const title = document.getElementById('addonModalTitle');
    
    if (!modal || !form) {
      showNotification('Modal niet gevonden', 'error');
      return;
    }
    
    form.reset();
    if (errorDiv) errorDiv.style.display = 'none';
    
    if (title) {
      title.textContent = addon ? 'Add-on bewerken' : 'Nieuwe add-on';
    }
    
    if (addon) {
      document.getElementById('addonId').value = addon.id;
      document.getElementById('addonName').value = addon.name || '';
      document.getElementById('addonDescription').value = addon.description || '';
      document.getElementById('addonBillingModel').value = addon.billing_model || 'one_time';
      document.getElementById('addonPrice').value = (addon.price_cents || 0) / 100;
      document.getElementById('addonCost').value = (addon.cost_cents || 0) / 100;
      document.getElementById('addonUnitLabel').value = addon.unit_label || '';
    } else {
      document.getElementById('addonId').value = '';
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  window.closeAddonModal = function() {
    const modal = document.getElementById('addonModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  };

  async function saveAddon() {
    const form = document.getElementById('addonForm');
    const errorDiv = document.getElementById('addonFormError');
    
    if (!form) return;
    
    const formData = new FormData(form);
    const addonId = formData.get('id');
    const isEdit = !!addonId;
    
    const data = {
      name: formData.get('name'),
      description: formData.get('description') || null,
      billing_model: formData.get('billing_model'),
      price_cents: parseFloat(formData.get('price_cents')),
      cost_cents: parseFloat(formData.get('cost_cents')),
      unit_label: formData.get('unit_label') || null
    };
    
    if (!data.name || !data.billing_model) {
      if (errorDiv) {
        errorDiv.textContent = 'Vul alle verplichte velden in';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    if (isNaN(data.price_cents) || data.price_cents < 0 || isNaN(data.cost_cents) || data.cost_cents < 0) {
      if (errorDiv) {
        errorDiv.textContent = 'Prijs en kost moeten positieve getallen zijn';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    try {
      const url = isEdit 
        ? `/api/admin/services/${serviceId}/addons/${addonId}`
        : `/api/admin/services/${serviceId}/addons`;
      const method = isEdit ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...data,
          price_cents: data.price_cents,
          cost_cents: data.cost_cents
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij opslaan');
      }
      
      closeAddonModal();
      await reloadServiceData();
      showNotification(result.message || 'Add-on succesvol opgeslagen', 'success');
    } catch (error) {
      console.error('Error saving addon:', error);
      if (errorDiv) {
        errorDiv.textContent = error.message || 'Fout bij opslaan add-on';
        errorDiv.style.display = 'block';
      }
      showNotification('Fout bij opslaan: ' + error.message, 'error');
    }
  }

  // ============================================
  // DISCOUNT RULE MODAL
  // ============================================
  
  window.openAddDiscountRuleModal = function() {
    openDiscountRuleModal();
  };

  window.editDiscountRule = function(ruleId) {
    const data = getServiceData();
    if (!data || !data.discount_rules) {
      showNotification('Kortingsregel data niet beschikbaar', 'error');
      return;
    }
    
    const rule = data.discount_rules.find(r => r.id === ruleId);
    if (!rule) {
      showNotification('Kortingsregel niet gevonden', 'error');
      return;
    }
    
    openDiscountRuleModal(rule);
  };

  function openDiscountRuleModal(rule = null) {
    const modal = document.getElementById('discountRuleModal');
    const form = document.getElementById('discountRuleForm');
    const errorDiv = document.getElementById('discountRuleFormError');
    const title = document.getElementById('discountRuleModalTitle');
    
    if (!modal || !form) {
      showNotification('Modal niet gevonden', 'error');
      return;
    }
    
    form.reset();
    if (errorDiv) errorDiv.style.display = 'none';
    
    if (title) {
      title.textContent = rule ? 'Kortingsregel bewerken' : 'Nieuwe kortingsregel';
    }
    
    if (rule) {
      document.getElementById('discountRuleId').value = rule.id;
      document.getElementById('discountRuleName').value = rule.name || '';
      document.getElementById('discountRuleType').value = rule.rule_type || 'percentage';
      document.getElementById('discountRuleAppliesTo').value = rule.applies_to || 'base';
      document.getElementById('discountRuleValue').value = rule.value_numeric || 0;
      document.getElementById('discountRuleMinQty').value = rule.min_qty || '';
      document.getElementById('discountRuleMaxQty').value = rule.max_qty || '';
    } else {
      document.getElementById('discountRuleId').value = '';
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  window.closeDiscountRuleModal = function() {
    const modal = document.getElementById('discountRuleModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  };

  async function saveDiscountRule() {
    const form = document.getElementById('discountRuleForm');
    const errorDiv = document.getElementById('discountRuleFormError');
    
    if (!form) return;
    
    const formData = new FormData(form);
    const ruleId = formData.get('id');
    const isEdit = !!ruleId;
    
    const data = {
      name: formData.get('name'),
      rule_type: formData.get('rule_type'),
      applies_to: formData.get('applies_to'),
      value_numeric: parseFloat(formData.get('value_numeric')),
      min_qty: formData.get('min_qty') ? parseFloat(formData.get('min_qty')) : null,
      max_qty: formData.get('max_qty') ? parseFloat(formData.get('max_qty')) : null
    };
    
    if (!data.name || !data.rule_type || !data.applies_to) {
      if (errorDiv) {
        errorDiv.textContent = 'Vul alle verplichte velden in';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    if (isNaN(data.value_numeric) || data.value_numeric < 0) {
      if (errorDiv) {
        errorDiv.textContent = 'Waarde moet een positief getal zijn';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    try {
      const url = isEdit 
        ? `/api/admin/services/${serviceId}/discount-rules/${ruleId}`
        : `/api/admin/services/${serviceId}/discount-rules`;
      const method = isEdit ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij opslaan');
      }
      
      closeDiscountRuleModal();
      await reloadServiceData();
      showNotification(result.message || 'Kortingsregel succesvol opgeslagen', 'success');
    } catch (error) {
      console.error('Error saving discount rule:', error);
      if (errorDiv) {
        errorDiv.textContent = error.message || 'Fout bij opslaan kortingsregel';
        errorDiv.style.display = 'block';
      }
      showNotification('Fout bij opslaan: ' + error.message, 'error');
    }
  }

  // ============================================
  // DELIVERY TEMPLATE MODAL
  // ============================================
  
  window.openAddTemplateModal = function() {
    openTemplateModal();
  };

  window.editTemplate = function(templateId) {
    const data = getServiceData();
    if (!data || !data.delivery_templates) {
      showNotification('Sjabloon data niet beschikbaar', 'error');
      return;
    }
    
    const template = data.delivery_templates.find(t => t.id === templateId);
    if (!template) {
      showNotification('Sjabloon niet gevonden', 'error');
      return;
    }
    
    openTemplateModal(template);
  };

  function openTemplateModal(template = null) {
    const modal = document.getElementById('templateModal');
    const form = document.getElementById('templateForm');
    const errorDiv = document.getElementById('templateFormError');
    const title = document.getElementById('templateModalTitle');
    
    if (!modal || !form) {
      showNotification('Modal niet gevonden', 'error');
      return;
    }
    
    form.reset();
    if (errorDiv) errorDiv.style.display = 'none';
    
    if (title) {
      title.textContent = template ? 'Leveringssjabloon bewerken' : 'Nieuw leveringssjabloon';
    }
    
    if (template) {
      document.getElementById('templateId').value = template.id;
      document.getElementById('templateName').value = template.name || '';
      document.getElementById('templateDescription').value = template.description || '';
      document.getElementById('templateType').value = template.template_type || 'task';
      document.getElementById('templateAutoCreate').checked = template.auto_create_on_sale || false;
      document.getElementById('templateApprovalRequired').checked = template.approval_required !== false;
    } else {
      document.getElementById('templateId').value = '';
      document.getElementById('templateApprovalRequired').checked = true;
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  window.closeTemplateModal = function() {
    const modal = document.getElementById('templateModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  };

  async function saveTemplate() {
    const form = document.getElementById('templateForm');
    const errorDiv = document.getElementById('templateFormError');
    
    if (!form) return;
    
    const formData = new FormData(form);
    const templateId = formData.get('id');
    const isEdit = !!templateId;
    
    const data = {
      name: formData.get('name'),
      description: formData.get('description') || null,
      template_type: formData.get('template_type'),
      auto_create_on_sale: formData.get('auto_create_on_sale') === 'on',
      approval_required: formData.get('approval_required') === 'on',
      config: {}
    };
    
    if (!data.name || !data.template_type) {
      if (errorDiv) {
        errorDiv.textContent = 'Vul alle verplichte velden in';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    try {
      const url = isEdit 
        ? `/api/admin/services/${serviceId}/delivery-templates/${templateId}`
        : `/api/admin/services/${serviceId}/delivery-templates`;
      const method = isEdit ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij opslaan');
      }
      
      closeTemplateModal();
      await reloadServiceData();
      showNotification(result.message || 'Leveringssjabloon succesvol opgeslagen', 'success');
    } catch (error) {
      console.error('Error saving template:', error);
      if (errorDiv) {
        errorDiv.textContent = error.message || 'Fout bij opslaan leveringssjabloon';
        errorDiv.style.display = 'block';
      }
      showNotification('Fout bij opslaan: ' + error.message, 'error');
    }
  }

  // ============================================
  // PRICING MODAL (Refactored: Packages as Single Source of Truth)
  // ============================================
  
  let packagesState = []; // Local state for packages in modal
  
  window.openEditPricingModal = function() {
    // Fetch fresh service data from API
    fetch(`/api/admin/services/${serviceId}`)
      .then(res => res.json())
      .then(result => {
        if (!result.success) {
          throw new Error(result.error || 'Fout bij laden dienst');
        }
        
        const service = result.data.service;
        const packages = (result.data.tiers || []).filter(t => !t.archived_at);
        
        openPricingModal(service, packages);
      })
      .catch(error => {
        console.error('Error loading service data:', error);
        showNotification('Fout bij laden dienst: ' + error.message, 'error');
      });
  };
  
  function openPricingModal(service, packages) {
    const modal = document.getElementById('pricingModal');
    const form = document.getElementById('pricingForm');
    const errorDiv = document.getElementById('pricingFormError');
    
    if (!modal || !form) {
      showNotification('Modal niet gevonden', 'error');
      return;
    }
    
    form.reset();
    if (errorDiv) errorDiv.style.display = 'none';
    
    // Set billing cycle
    document.getElementById('billingCycleSelect').value = service.billing_model || 'one_time';
    
    // Initialize packages state
    packagesState = packages.length > 0 
      ? packages.map(p => ({
          id: p.id,
          name: p.name || '',
          description: p.description || '',
          price_cents: p.price_cents || 0,
          cost_cents: p.cost_cents || 0,
          is_active: p.is_active !== false,
          sort_order: p.sort_order || 0
        }))
      : [{ // Default: create one empty package if none exist
          id: null,
          name: 'Standaard',
          description: '',
          price_cents: service.base_price_cents || service.price_cents || 0,
          cost_cents: service.base_cost_cents || service.cost_cents || 0,
          is_active: true,
          sort_order: 0
        }];
    
    renderPackagesList();
    updatePreview();
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  
  window.closePricingModal = function() {
    const modal = document.getElementById('pricingModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      packagesState = [];
    }
  };
  
  function renderPackagesList() {
    const container = document.getElementById('packagesList');
    if (!container) return;
    
    container.innerHTML = packagesState.map((pkg, index) => {
      const priceEuro = (pkg.price_cents / 100).toFixed(2);
      const costEuro = (pkg.cost_cents / 100).toFixed(2);
      
      return `
        <div class="package-row" data-index="${index}" style="padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
            <div style="flex: 1;">
              <input type="text" class="package-name" value="${escapeHtml(pkg.name)}" placeholder="Pakket naam *" required style="width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem;" />
              <input type="text" class="package-description" value="${escapeHtml(pkg.description)}" placeholder="Beschrijving (optioneel)" style="width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.75rem; color: #6b7280;" />
            </div>
            <div style="display: flex; gap: 0.5rem; margin-left: 1rem;">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" class="package-active" ${pkg.is_active ? 'checked' : ''} style="cursor: pointer;" />
                <span style="font-size: 0.75rem; color: #6b7280;">Actief</span>
              </label>
              ${packagesState.length > 1 ? `
                <button type="button" onclick="removePackage(${index})" style="padding: 0.5rem; background: #fee2e2; color: #991b1b; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;" title="Verwijderen">
                  <i class="fas fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151; font-size: 0.75rem;">Verkoopprijs (€) *</label>
              <input type="number" class="package-price" value="${priceEuro}" step="0.01" min="0" required style="width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem;" />
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: #374151; font-size: 0.75rem;">Inkoopkost (€)</label>
              <input type="number" class="package-cost" value="${costEuro}" step="0.01" min="0" style="width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem;" />
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    // Attach event listeners
    container.querySelectorAll('.package-name, .package-description, .package-price, .package-cost, .package-active').forEach(input => {
      input.addEventListener('input', () => {
        updatePackageFromRow(input.closest('.package-row'));
        updatePreview();
      });
      input.addEventListener('change', () => {
        updatePackageFromRow(input.closest('.package-row'));
        updatePreview();
      });
    });
  }
  
  function updatePackageFromRow(row) {
    const index = parseInt(row.dataset.index);
    if (isNaN(index) || !packagesState[index]) return;
    
    const pkg = packagesState[index];
    pkg.name = row.querySelector('.package-name')?.value?.trim() || '';
    pkg.description = row.querySelector('.package-description')?.value?.trim() || '';
    pkg.price_cents = Math.round(parseFloat(row.querySelector('.package-price')?.value || 0) * 100);
    pkg.cost_cents = Math.round(parseFloat(row.querySelector('.package-cost')?.value || 0) * 100);
    pkg.is_active = row.querySelector('.package-active')?.checked !== false;
  }
  
  window.addPackageRow = function() {
    packagesState.push({
      id: null,
      name: '',
      description: '',
      price_cents: 0,
      cost_cents: 0,
      is_active: true,
      sort_order: packagesState.length
    });
    renderPackagesList();
    updatePreview();
  };
  
  window.removePackage = function(index) {
    if (packagesState.length <= 1) {
      showNotification('Er moet minimaal 1 pakket zijn', 'error');
      return;
    }
    
    const activeCount = packagesState.filter(p => p.is_active).length;
    if (packagesState[index].is_active && activeCount <= 1) {
      showNotification('Er moet minimaal 1 actief pakket zijn', 'error');
      return;
    }
    
    packagesState.splice(index, 1);
    renderPackagesList();
    updatePreview();
  };
  
  function updatePreview() {
    const preview = document.getElementById('pricingPreview');
    if (!preview) return;
    
    const activePackages = packagesState.filter(p => p.is_active && p.name);
    
    if (activePackages.length === 0) {
      preview.innerHTML = '<p style="margin: 0; color: #dc2626;">Voeg minimaal 1 actief pakket toe met een naam</p>';
      return;
    }
    
    preview.innerHTML = activePackages.map(pkg => {
      const price = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(pkg.price_cents / 100);
      return `<div style="padding: 0.5rem; margin-bottom: 0.5rem; background: white; border-radius: 4px;">
        <strong>${escapeHtml(pkg.name)}</strong> - ${price}
        ${pkg.description ? `<br><span style="font-size: 0.75rem; color: #6b7280;">${escapeHtml(pkg.description)}</span>` : ''}
      </div>`;
    }).join('');
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  async function savePricing() {
    const form = document.getElementById('pricingForm');
    const errorDiv = document.getElementById('pricingFormError');
    
    if (!form) return;
    
    // Update all packages from DOM
    document.querySelectorAll('.package-row').forEach(row => {
      updatePackageFromRow(row);
    });
    
    const billingCycle = document.getElementById('billingCycleSelect')?.value;
    
    if (!billingCycle) {
      if (errorDiv) {
        errorDiv.textContent = 'Selecteer een factureringscyclus';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    // Validate packages
    if (packagesState.length === 0) {
      if (errorDiv) {
        errorDiv.textContent = 'Voeg minimaal 1 pakket toe';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    const activePackages = packagesState.filter(p => p.is_active);
    if (activePackages.length === 0) {
      if (errorDiv) {
        errorDiv.textContent = 'Er moet minimaal 1 actief pakket zijn';
        errorDiv.style.display = 'block';
      }
      return;
    }
    
    for (let i = 0; i < packagesState.length; i++) {
      const pkg = packagesState[i];
      if (!pkg.name || pkg.name.trim().length === 0) {
        if (errorDiv) {
          errorDiv.textContent = `Pakket ${i + 1}: naam is verplicht`;
          errorDiv.style.display = 'block';
        }
        return;
      }
      if (pkg.price_cents < 0 || isNaN(pkg.price_cents)) {
        if (errorDiv) {
          errorDiv.textContent = `Pakket "${pkg.name}": prijs moet een geldig positief getal zijn`;
          errorDiv.style.display = 'block';
        }
        return;
      }
    }
    
    // Prepare payload
    const payload = {
      billing_cycle: billingCycle,
      packages: packagesState.map((pkg, index) => ({
        id: pkg.id || undefined,
        name: pkg.name.trim(),
        description: pkg.description.trim() || null,
        price_cents: pkg.price_cents,
        cost_cents: pkg.cost_cents || 0,
        is_active: pkg.is_active,
        sort_order: index
      }))
    };
    
    try {
      // Optimistic UI: disable form
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Opslaan...';
      }
      
      const response = await fetch(`/api/admin/services/${serviceId}/pricing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij opslaan');
      }
      
      // Success: close modal, refresh data, show toast
      closePricingModal();
      
      // Refresh service data without full page reload
      if (window.loadServiceData) {
        await window.loadServiceData();
      }
      
      showNotification('Prijzen succesvol bijgewerkt', 'success');
    } catch (error) {
      console.error('Error saving pricing:', error);
      if (errorDiv) {
        errorDiv.textContent = error.message || 'Fout bij opslaan prijzen';
        errorDiv.style.display = 'block';
      }
      showNotification('Fout bij opslaan: ' + error.message, 'error');
      
      // Re-enable form
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Opslaan';
      }
    }
  }
  
  // Backward compatibility: map old function name to new one
  window.openEditPricingModeModal = window.openEditPricingModal;
  
  // Old function for backward compatibility (deprecated)
  window.openEditPricingModeModal = function() {
    // Redirect to new function
    window.openEditPricingModal();
  };
  
  window.closePricingModeModal = function() {
    // Redirect to new function
    window.closePricingModal();
  };

  // ============================================
  // ARCHIVE FUNCTIONS
  // ============================================
  
  window.archiveTier = async function(tierId) {
    if (!confirm('Weet je zeker dat je deze prijsschaal wilt archiveren?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/services/${serviceId}/tiers/${tierId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij archiveren');
      }
      
      showNotification('Prijsschaal succesvol gearchiveerd', 'success');
      await reloadServiceData();
    } catch (error) {
      console.error('Error archiving tier:', error);
      showNotification('Fout bij archiveren: ' + error.message, 'error');
    }
  };

  window.archiveAddon = async function(addonId) {
    if (!confirm('Weet je zeker dat je deze add-on wilt archiveren?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/services/${serviceId}/addons/${addonId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij archiveren');
      }
      
      showNotification('Add-on succesvol gearchiveerd', 'success');
      await reloadServiceData();
    } catch (error) {
      console.error('Error archiving addon:', error);
      showNotification('Fout bij archiveren: ' + error.message, 'error');
    }
  };

  window.archiveDiscountRule = async function(ruleId) {
    if (!confirm('Weet je zeker dat je deze kortingsregel wilt archiveren?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/services/${serviceId}/discount-rules/${ruleId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij archiveren');
      }
      
      showNotification('Kortingsregel succesvol gearchiveerd', 'success');
      await reloadServiceData();
    } catch (error) {
      console.error('Error archiving discount rule:', error);
      showNotification('Fout bij archiveren: ' + error.message, 'error');
    }
  };

  window.deleteTemplate = async function(templateId) {
    if (!confirm('Weet je zeker dat je dit leveringssjabloon wilt verwijderen?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/services/${serviceId}/delivery-templates/${templateId}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Fout bij verwijderen');
      }
      
      showNotification('Leveringssjabloon succesvol verwijderd', 'success');
      await reloadServiceData();
    } catch (error) {
      console.error('Error deleting template:', error);
      showNotification('Fout bij verwijderen: ' + error.message, 'error');
    }
  };

  // ============================================
  // FORM SUBMIT HANDLERS
  // ============================================
  
  document.addEventListener('DOMContentLoaded', function() {
    // Tier form
    const tierForm = document.getElementById('tierForm');
    if (tierForm) {
      tierForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTier();
      });
    }
    
    // Addon form
    const addonForm = document.getElementById('addonForm');
    if (addonForm) {
      addonForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveAddon();
      });
    }
    
    // Discount rule form
    const discountRuleForm = document.getElementById('discountRuleForm');
    if (discountRuleForm) {
      discountRuleForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveDiscountRule();
      });
    }
    
    // Template form
    const templateForm = document.getElementById('templateForm');
    if (templateForm) {
      templateForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTemplate();
      });
    }
    
    // Pricing form (new refactored modal)
    const pricingForm = document.getElementById('pricingForm');
    if (pricingForm) {
      pricingForm.addEventListener('submit', (e) => {
        e.preventDefault();
        savePricing();
      });
    }
    
    // Close modals on outside click
    ['tierModal', 'addonModal', 'discountRuleModal', 'templateModal', 'pricingModal'].forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            const closeFunc = {
              'tierModal': closeTierModal,
              'addonModal': closeAddonModal,
              'discountRuleModal': closeDiscountRuleModal,
              'templateModal': closeTemplateModal,
              'pricingModal': closePricingModal
            }[modalId];
            if (closeFunc) closeFunc();
          }
        });
      }
    });
  });

})();

