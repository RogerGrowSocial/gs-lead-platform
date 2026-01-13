(function () {
  function applyDateRangeFilter(value) {
    // Update URL parameter and reload to apply filter
    const url = new URL(window.location.href);
    url.searchParams.set('dateRange', value);
    window.location.assign(url);
  }

  function bindDateRange() {
    // Bind once using the component API
    if (window.CustomSelect) {
      CustomSelect.onChange('dateRangeSelect', (value) => applyDateRangeFilter(value));
    }
  }

  function bindInvoiceModal(modal) {
    // Ensure the modal's select is initialized (in case modal was hidden)
    if (window.CustomSelect) CustomSelect.initAll(modal);
  }

  document.addEventListener('DOMContentLoaded', function() {
    const page = document.getElementById('adminPaymentsPage') || document.body;
    
    // If the component already ran, bind immediately; otherwise, wait for it
    if (window.CustomSelect) {
      bindDateRange();
    } else {
      page.addEventListener('custom-select:ready', (e) => {
        if (e.detail.id === 'dateRangeSelect') bindDateRange();
      });
    }

    // Modal hooks
    const invoiceModal = document.getElementById('invoiceCreationModal');
    if (invoiceModal) {
      invoiceModal.addEventListener('shown.bs.modal', () => bindInvoiceModal(invoiceModal));
    }

    // Invoice creation modal elements
    const createInvoiceBtn = document.getElementById('createInvoiceBtn');
    const invoiceCreationModal = document.getElementById('invoiceCreationModal');
    const closeInvoiceModal = document.getElementById('closeInvoiceModal');
    const invoiceForm = document.getElementById('invoiceForm');
    const customerSearch = document.getElementById('customerSearch');
    const customerResults = document.getElementById('customerResults');
    const customerIdInput = document.getElementById('customer_id');
    const invoiceValidationMessage = document.getElementById('invoiceValidationMessage');

    // Show modal when create invoice button is clicked
    if (createInvoiceBtn) {
        createInvoiceBtn.addEventListener('click', () => {
            invoiceCreationModal.classList.add('show');
            document.body.style.overflow = 'hidden';
        });
    }

    // Close modal when close button is clicked
    if (closeInvoiceModal) {
        closeInvoiceModal.addEventListener('click', () => {
            invoiceCreationModal.classList.remove('show');
            document.body.style.overflow = '';
            resetForm();
        });
    }

    // Close modal when clicking outside
    if (invoiceCreationModal) {
        invoiceCreationModal.addEventListener('click', (e) => {
            if (e.target === invoiceCreationModal) {
                invoiceCreationModal.classList.remove('show');
                document.body.style.overflow = '';
                resetForm();
            }
        });
    }

    // Customer search functionality
    let searchTimeout;
    if (customerSearch) {
        customerSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                customerResults.style.display = 'none';
                return;
            }

            searchTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
                    if (!response.ok) throw new Error('Search failed');
                    
                    const users = await response.json();
                    displayCustomerResults(users);
                } catch (error) {
                    console.error('Error searching users:', error);
                    showValidationMessage('Er is een fout opgetreden bij het zoeken van klanten', 'error');
                }
            }, 300);
        });
    }

    // Display customer search results
    function displayCustomerResults(users) {
        if (!users.length) {
            customerResults.style.display = 'none';
            return;
        }

        customerResults.innerHTML = users.map(user => `
            <div class="customer-result-item" data-id="${user.id}" data-name="${user.company_name}">
                ${user.company_name} (${user.email})
            </div>
        `).join('');

        customerResults.style.display = 'block';

        // Add click handlers to results
        customerResults.querySelectorAll('.customer-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.dataset.id;
                const companyName = item.dataset.name;
                
                customerIdInput.value = userId;
                customerSearch.value = companyName;
                customerResults.style.display = 'none';
            });
        });
    }

    // Handle form submission
    if (invoiceForm) {
        invoiceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Validate form
            if (!invoiceForm.checkValidity()) {
                e.stopPropagation();
                invoiceForm.classList.add('was-validated');
                return;
            }

            // Get form data
            const formData = new FormData(invoiceForm);
            const data = {
                user_id: customerIdInput.value,
                amount: parseFloat(formData.get('amount')),
                due_date: formData.get('due_date'),
                description: formData.get('description'),
                payment_method: formData.get('payment_method')
            };

            try {
                const response = await fetch('/api/payments/manual', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Er is een fout opgetreden bij het aanmaken van de factuur');
                }

                // Show success message
                showValidationMessage('Factuur succesvol aangemaakt', 'success');
                
                // Close modal and reset form after a short delay
                setTimeout(() => {
                    invoiceCreationModal.classList.remove('show');
                    document.body.style.overflow = '';
                    resetForm();
                    // Reload the page to show the new invoice
                    window.location.reload();
                }, 1500);

            } catch (error) {
                console.error('Error creating invoice:', error);
                showValidationMessage(error.message, 'error');
            }
        });
    }

    // Helper function to show validation messages
    function showValidationMessage(message, type = 'error') {
        invoiceValidationMessage.textContent = message;
        invoiceValidationMessage.className = `alert alert-${type === 'error' ? 'danger' : 'success'}`;
        invoiceValidationMessage.style.display = 'block';
    }

    // Helper function to reset the form
    function resetForm() {
        if (invoiceForm) {
            invoiceForm.reset();
            invoiceForm.classList.remove('was-validated');
            customerIdInput.value = '';
            invoiceValidationMessage.style.display = 'none';
        }
    }

    // Set default due date to 14 days from now
    const dueDateInput = document.getElementById('due_date');
    if (dueDateInput) {
        const defaultDueDate = new Date();
        defaultDueDate.setDate(defaultDueDate.getDate() + 14);
        dueDateInput.value = defaultDueDate.toISOString().split('T')[0];
    }
  });
})();
