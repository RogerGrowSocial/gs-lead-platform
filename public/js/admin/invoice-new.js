// Invoice New Page JavaScript
(function() {
  'use strict';
  
  const customerId = window.customerId;
  if (!customerId) return;
  
  // Invoice Items State
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
      } else {
        alert('Er moet minimaal 1 factuurregel zijn');
      }
      return;
    }
    
    invoiceItems.splice(index, 1);
    renderInvoiceItems();
    updateInvoiceTotal();
  };
  
  // Initialize invoice items
  invoiceItems = [{
    description: '',
    quantity: 1,
    unit_price: 0,
    has_vat: true,
    subtotal: 0,
    vat_amount: 0,
    total: 0
  }];
  renderInvoiceItems();
  updateInvoiceTotal();
  
  // Form submission
  const form = document.getElementById('addInvoiceForm');
  const errorDiv = document.getElementById('addInvoiceFormError');
  
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
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
        return sum + ((item.quantity || 0) * (item.unit_price || 0) + (item.has_vat !== false ? (item.quantity || 0) * (item.unit_price || 0) * 0.21 : 0));
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
          has_vat: item.has_vat !== false,
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
        
        // Success: redirect to invoice detail page
        if (result.invoice && result.invoice.id) {
          window.location.href = `/admin/customers/${customerId}/invoices/${result.invoice.id}`;
        } else {
          // Fallback: redirect to customer page
          window.location.href = `/admin/customers/${customerId}`;
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
      }
    });
  }
})();

