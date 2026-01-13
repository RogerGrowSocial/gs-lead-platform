// Invoice Detail Page JavaScript
(function() {
  'use strict';
  
  const invoiceId = window.invoiceData?.id;
  const customerId = window.customerData?.id;
  const canEdit = window.canEditInvoice !== false;
  
  if (!invoiceId || !customerId) return;
  
  // Format currency helper
  function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '€0,00';
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
  }
  
  // Format date helper
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  }
  
  // Open edit invoice modal
  window.openEditInvoiceModal = function() {
    if (!canEdit) {
      if (window.showNotification) {
        window.showNotification('Je hebt geen rechten om facturen te bewerken', 'error');
      }
      return;
    }
    
    const modal = document.getElementById('editInvoiceModal');
    if (!modal) {
      console.error('Edit invoice modal not found');
      return;
    }
    
    const invoice = window.invoiceData;
    if (!invoice) {
      console.error('Invoice data not available');
      return;
    }
    
    // Populate form fields
    document.getElementById('editInvoiceDate').value = formatDate(invoice.invoice_date);
    document.getElementById('editDueDate').value = formatDate(invoice.due_date);
    document.getElementById('editOrderNumber').value = invoice.order_number || '';
    document.getElementById('editInvoiceStatus').value = invoice.status || 'pending';
    document.getElementById('editOutstandingAmount').value = invoice.outstanding_amount || 0;
    document.getElementById('editInvoiceNotes').value = invoice.notes || '';
    
    // Show modal
    modal.style.display = 'flex';
    
    // Auto-update outstanding amount when status changes to "paid"
    const statusSelect = document.getElementById('editInvoiceStatus');
    const outstandingInput = document.getElementById('editOutstandingAmount');
    
    statusSelect.addEventListener('change', function() {
      if (this.value === 'paid') {
        outstandingInput.value = '0';
        outstandingInput.readOnly = true;
        outstandingInput.style.background = '#f9fafb';
      } else {
        outstandingInput.readOnly = false;
        outstandingInput.style.background = 'white';
      }
    });
    
    // Trigger change event to set initial state
    if (statusSelect.value === 'paid') {
      outstandingInput.value = '0';
      outstandingInput.readOnly = true;
      outstandingInput.style.background = '#f9fafb';
    }
  };
  
  // Close edit invoice modal
  window.closeEditInvoiceModal = function() {
    const modal = document.getElementById('editInvoiceModal');
    if (modal) {
      modal.style.display = 'none';
      // Reset form
      document.getElementById('editInvoiceForm').reset();
      const outstandingInput = document.getElementById('editOutstandingAmount');
      if (outstandingInput) {
        outstandingInput.readOnly = false;
        outstandingInput.style.background = 'white';
      }
    }
  };
  
  // Initialize page
  document.addEventListener('DOMContentLoaded', function() {
    console.log('Invoice detail page loaded:', { invoiceId, customerId, canEdit });
    
    // Setup form submission
    const editForm = document.getElementById('editInvoiceForm');
    if (editForm) {
      editForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const errorDiv = document.getElementById('editInvoiceFormError');
        errorDiv.style.display = 'none';
        
        // Get form values
        const invoiceDate = document.getElementById('editInvoiceDate').value;
        const dueDate = document.getElementById('editDueDate').value || null;
        const orderNumber = document.getElementById('editOrderNumber').value.trim() || null;
        const status = document.getElementById('editInvoiceStatus').value;
        let outstandingAmount = parseFloat(document.getElementById('editOutstandingAmount').value) || 0;
        const notes = document.getElementById('editInvoiceNotes').value.trim() || null;
        
        // If status is "paid", set outstanding amount to 0
        if (status === 'paid') {
          outstandingAmount = 0;
        }
        
        // Validation
        if (!invoiceDate) {
          errorDiv.textContent = 'Factuurdatum is verplicht';
          errorDiv.style.display = 'block';
          return;
        }
        
        if (outstandingAmount < 0) {
          errorDiv.textContent = 'Openstaand bedrag kan niet negatief zijn';
          errorDiv.style.display = 'block';
          return;
        }
        
        try {
          const response = await fetch(`/api/customers/${customerId}/invoices/${invoiceId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              invoice_date: invoiceDate,
              due_date: dueDate,
              order_number: orderNumber,
              status: status,
              outstanding_amount: outstandingAmount,
              notes: notes
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            if (window.showNotification) {
              window.showNotification('Factuur succesvol bijgewerkt', 'success');
            }
            
            // Update window data
            if (window.invoiceData) {
              window.invoiceData.invoice_date = invoiceDate;
              window.invoiceData.due_date = dueDate;
              window.invoiceData.order_number = orderNumber;
              window.invoiceData.status = status;
              window.invoiceData.outstanding_amount = outstandingAmount;
              window.invoiceData.notes = notes;
            }
            
            // Close modal and reload page to show updated data
            closeEditInvoiceModal();
            setTimeout(() => {
              window.location.reload();
            }, 500);
          } else {
            errorDiv.textContent = result.error || 'Fout bij bijwerken factuur';
            errorDiv.style.display = 'block';
            if (window.showNotification) {
              window.showNotification(result.error || 'Fout bij bijwerken factuur', 'error');
            }
          }
        } catch (error) {
          console.error('Error updating invoice:', error);
          errorDiv.textContent = 'Fout bij bijwerken factuur: ' + error.message;
          errorDiv.style.display = 'block';
          if (window.showNotification) {
            window.showNotification('Fout bij bijwerken factuur', 'error');
          }
        }
      });
    }
    
    // Close modal on background click
    const modal = document.getElementById('editInvoiceModal');
    if (modal) {
      modal.addEventListener('click', function(e) {
        if (e.target === modal) {
          closeEditInvoiceModal();
        }
      });
    }
  });
})();

