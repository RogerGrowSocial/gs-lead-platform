// Voeg de CSS toe aan de pagina
;(function addPaymentsCSS() {
  const style = document.createElement("style")
  style.textContent = `
    .topup-card {
      border: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      border-radius: 10px;
      overflow: hidden;
    }
    .topup-card .card-header {
      background-color: #fff;
      border-bottom: 1px solid rgba(0,0,0,0.05);
      padding: 1.25rem 1.5rem;
    }
    .topup-card .card-title {
      color: #2c3e50;
      margin: 0;
    }
    .topup-card .card-title h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0;
    }
    .topup-card .card-body {
      padding: 1.5rem;
    }
    .topup-container,
    .topup-container-modern {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }
    .topup-form-container {
      flex: 1;
      min-width: 300px;
    }
    .topup-info-container {
      flex: 0 0 300px;
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    .amount-options {
      margin-bottom: 2rem;
    }
    .amount-options label {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 0.5rem;
      display: block;
    }
    .amount-buttons,
    .amount-buttons-modern {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .amount-btn,
    .amount-btn-modern {
      padding: 12px;
      background-color: #f8f9fa;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      font-weight: 600;
      color: #495057;
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: center;
    }
    .amount-btn:hover,
    .amount-btn-modern:hover {
      background-color: #e9ecef;
      border-color: #dee2e6;
    }
    .amount-btn.active,
    .amount-btn-modern.active {
      background-color: rgba(234, 88, 13, 0.1) !important;
      border-color: #ea580d !important;
      color: #ea580d !important;
    }
    .payment-methods,
    .payment-methods-modern {
      margin-bottom: 1.5rem;
    }
    .payment-methods label {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 0.5rem;
      display: block;
    }
    .payment-method-options,
    .payment-methods-grid-modern {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .payment-method-option {
      position: relative;
    }
    .payment-method-option input[type="radio"] {
      position: absolute;
      opacity: 0;
    }
    .payment-method-label,
    .payment-method-content-modern {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 15px 10px;
      background-color: #f8f9fa;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      height: 100%;
    }
    .payment-method-option input[type="radio"]:checked + .payment-method-label,
    .payment-method-card-modern.active .payment-method-content-modern {
      background-color: rgba(234, 88, 13, 0.1);
      border-color: #ea580d;
    }
    .payment-logo,
    .payment-method-icon-modern {
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }
    .payment-method-name,
    .payment-method-name-modern {
      font-size: 14px;
      font-weight: 500;
      color: #495057;
      text-align: center;
    }
    .info-card {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
      transition: all 0.2s ease;
    }
    .info-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.05);
    }
    .info-icon {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgba(234, 88, 13, 0.1);
      border-radius: 50%;
      flex-shrink: 0;
    }
    .info-icon i {
      font-size: 20px;
      color: #ea580d;
    }
    .info-content h5 {
      margin: 0 0 5px 0;
      font-size: 16px;
      font-weight: 600;
      color: #2c3e50;
    }
    .info-content p {
      margin: 0;
      font-size: 14px;
      color: #6c757d;
    }
    .topup-button,
    .topup-button-modern {
      background-color: #ea580d;
      border-color: #ea580d;
      padding: 12px 24px;
      font-weight: 600;
      transition: all 0.3s ease;
      width: 100%;
      margin-top: 0.75rem;
    }
    .topup-button:hover,
    .topup-button-modern:hover {
      background-color: #c2410c;
      border-color: #c2410c;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(234, 88, 13, 0.3);
    }
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      min-width: 250px;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    
    /* Verbeterde payment details styling */
    .payment-details-container {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      max-width: 100%;
    }

    .payment-details-column {
      flex: 1 1 450px; /* Increased from 400px to 450px */
      min-width: 400px; /* Increased from 350px to 400px */
      max-width: 100%;
    }
    
    .payment-details-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: separate;
      border-spacing: 0;
    }
    
    .payment-details-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #e9ecef;
      vertical-align: top;
      word-wrap: normal;
      overflow-wrap: normal;
    }
    
    .payment-details-table tr:last-child td {
      border-bottom: none;
    }
    
    .payment-details-label {
      width: 40%; /* Decreased from 45% to 40% */
      font-weight: 600;
      color: #495057;
      padding-right: 25px; /* Increased from 15px to 25px */
      white-space: nowrap;
      overflow: visible;
      text-overflow: clip;
    }
    
    .payment-details-value {
      width: 60%; /* Increased from 55% to 60% */
      color: #2c3e50;
    }
    
    .payment-status-badge {
      display: inline-block;
      padding: 0.35em 0.65em;
      font-size: 0.75em;
      font-weight: 700;
      line-height: 1;
      text-align: center;
      white-space: nowrap;
      vertical-align: baseline;
      border-radius: 0.25rem;
    }
    
    .badge-success {
      color: #fff;
      background-color: #28a745;
    }
    
    .badge-warning {
      color: #212529;
      background-color: #ffc107;
    }
    
    .badge-danger {
      color: #fff;
      background-color: #dc3545;
    }
    
    /* Verbeterde modal styling */
    .modal-xl {
      max-width: 1140px;
    }

    /* Maak de modal breder dan de standaard Bootstrap XL */
    .modal-dialog.modal-xl {
      max-width: 1800px; /* Increased from 1600px to 1800px */
      width: 95%; /* Zorgt ervoor dat de modal niet te breed wordt op kleinere schermen */
      margin: 1.75rem auto;
    }

    .modal-body {
      padding: 1.5rem;
      max-height: 80vh;
      overflow-y: auto;
    }
    
    .payment-details-container {
      display: flex;
      flex-wrap: wrap;
      gap: 30px; /* Increased from 20px to 30px */
    }
    
    .payment-details-column {
      flex: 1;
      min-width: 300px; /* Increased from 250px to 300px */
    }
    
    .payment-details-section {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 20px; /* Increased from 15px to 20px */
      margin-bottom: 20px;
    }
    
    .payment-details-section h6 {
      font-weight: 600;
      margin-bottom: 15px;
      color: #2c3e50;
      border-bottom: 1px solid #e9ecef;
      padding-bottom: 10px;
      font-size: 1rem;
    }
    
    /* Styling voor DataTables paginering */
    .dataTables_wrapper .dataTables_paginate {
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px solid #e9ecef;
      text-align: center;
      display: flex;
      justify-content: center;
    }

    .dataTables_wrapper .dataTables_paginate .paginate_button {
      padding: 8px 14px;
      margin: 0 8px;  /* Increased from 3px to 8px for more horizontal spacing */
      border-radius: 4px;
      border: 1px solid #dee2e6;
      background-color: #fff;
      color: #495057 !important;
      cursor: pointer;
      display: inline-block;
    }

    .dataTables_wrapper .dataTables_paginate .paginate_button.current {
      background-color: rgba(234, 88, 13, 0.1);
      border-color: #ea580d;
      color: #ea580d !important;
      font-weight: 600;
    }

    .dataTables_wrapper .dataTables_paginate .paginate_button:hover:not(.current):not(.disabled) {
      background-color: #e9ecef;
      border-color: #dee2e6;
      color: #212529 !important;
    }

    .dataTables_wrapper .dataTables_paginate .paginate_button.disabled {
      color: #adb5bd !important;
      cursor: not-allowed;
      opacity: 0.6;
    }

    .dataTables_wrapper .dataTables_info {
      margin-top: 15px;
      color: #6c757d;
      font-size: 0.875rem;
      text-align: center;
      padding-bottom: 10px;
    }

    .dataTables_wrapper .dataTables_length {
      margin-bottom: 15px;
    }

    .dataTables_wrapper .dataTables_length select {
      padding: 5px 10px;
      border-radius: 4px;
      border: 1px solid #dee2e6;
    }

    /* Make sure the pagination is always visible */
    .dataTables_wrapper .dataTables_paginate {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    
    @media (max-width: 992px) {
      .topup-container {
        flex-direction: column;
      }
      .topup-info-container {
        flex: 1;
        flex-direction: row;
        flex-wrap: wrap;
      }
      .info-card {
        flex: 1;
        min-width: 250px;
      }
      .payment-details-container {
        flex-direction: column;
      }
    }
    
    @media (max-width: 768px) {
      .payment-method-options {
        grid-template-columns: 1fr;
      }
      .topup-info-container {
        flex-direction: column;
      }
    }
    
    /* Modern styles for the new partial */
    .topup-header-modern {
      margin-bottom: 2rem;
    }
    .topup-title-modern h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #2c3e50;
      margin: 0 0 0.5rem 0;
    }
    .topup-title-modern p {
      color: #6c757d;
      margin: 0;
    }
    .topup-content-modern {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
    }
    .topup-form-modern {
      flex: 1;
      min-width: 300px;
    }
    .form-section-modern {
      margin-bottom: 2rem;
    }
    .form-section-header-modern {
      margin-bottom: 1rem;
    }
    .form-section-title-modern {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 0.5rem;
      display: block;
    }
    .custom-amount-container-modern {
      margin-top: 1rem;
    }
    .custom-amount-label-modern {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 0.5rem;
      display: block;
    }
    .custom-amount-input-container-modern {
      margin-bottom: 1rem;
    }
    .custom-amount-input-modern {
      width: 100%;
      padding: 12px;
      border: 2px solid #e9ecef;
      border-radius: 8px;
      font-size: 1rem;
    }
    .payment-summary-modern {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .summary-row-modern {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .summary-label-modern {
      font-weight: 500;
      color: #495057;
    }
    .summary-value-modern {
      font-weight: 600;
      color: #2c3e50;
    }
    .summary-divider-modern {
      height: 1px;
      background-color: #dee2e6;
      margin: 1rem 0;
    }
    .summary-total-modern {
      font-weight: 600;
      color: #2c3e50;
      font-size: 1.1rem;
    }
    .summary-total-value-modern {
      font-weight: 700;
      color: #ea580d;
      font-size: 1.1rem;
    }
    .info-cards-modern {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    .info-card-modern {
      display: flex;
      align-items: center;
      gap: 15px;
      padding: 15px;
      background-color: #f8f9fa;
      border-radius: 8px;
      border: 1px solid #e9ecef;
      transition: all 0.2s ease;
    }
    .info-card-modern:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.05);
    }
    .info-card-modern.secure {
      background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    }
    .info-card-modern.instant {
      background: linear-gradient(135deg, #fd7e14 0%, #ffc107 100%);
    }
    .info-card-modern.support {
      background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);
    }
    .benefits-card-modern {
      background-color: #f8f9fa;
      border-radius: 8px;
      padding: 1.5rem;
      border: 1px solid #e9ecef;
    }
    .benefits-title-modern {
      font-weight: 600;
      color: #2c3e50;
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }
    .benefits-list-modern {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .benefit-item-modern {
      display: flex;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .benefit-icon-modern {
      color: #28a745;
      margin-right: 0.75rem;
      font-size: 1rem;
    }
    .benefit-text-modern {
      color: #495057;
    }
    
    @media (max-width: 576px) {
      .amount-buttons,
      .amount-buttons-modern {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `
  document.head.appendChild(style)
})()

// Voorbeeld betalingen data
const examplePayments = [
  {
    id: "PAY-2023-001",
    created_at: new Date(2023, 11, 15).toISOString(),
    description: "18 aanvragen (december 2023)",
    amount: 49.95,
    payment_method: "iDEAL",
    status: "completed",
    customer_name: "Jan Jansen",
    customer_email: "jan.jansen@example.com",
    transaction_id: "TRX-123456789",
    payment_date: new Date(2023, 11, 15, 14, 30).toISOString(),
    invoice_number: "INV-2023-001",
    payment_details: {
      bank: "ING Bank",
      account_last4: "1234",
      reference: "REF-123456",
    },
  },
  {
    id: "PAY-2023-002",
    created_at: new Date(2023, 11, 28).toISOString(),
    description: "25 aanvragen (december 2023)",
    amount: 125.0,
    payment_method: "Creditcard",
    status: "completed",
    customer_name: "Petra Peters",
    customer_email: "petra.peters@example.com",
    transaction_id: "TRX-987654321",
    payment_date: new Date(2023, 11, 28, 10, 15).toISOString(),
    invoice_number: "INV-2023-002",
    payment_details: {
      card_type: "Visa",
      card_last4: "4321",
      expiry_date: "12/25",
    },
  },
  {
    id: "PAY-2024-001",
    created_at: new Date(2024, 0, 5).toISOString(),
    description: "14 aanvragen (januari 2024)",
    amount: 49.95,
    payment_method: "iDEAL",
    status: "completed",
    customer_name: "Thomas Thomassen",
    customer_email: "thomas.thomassen@example.com",
    transaction_id: "TRX-456789123",
    payment_date: new Date(2024, 0, 5, 16, 45).toISOString(),
    invoice_number: "INV-2024-001",
    payment_details: {
      bank: "ABN AMRO",
      account_last4: "5678",
      reference: "REF-456789",
    },
  },
  {
    id: "PAY-2024-002",
    created_at: new Date(2024, 0, 12).toISOString(),
    description: "32 aanvragen (januari 2024)",
    amount: 199.0,
    payment_method: "Bancontact",
    status: "pending",
    customer_name: "Sophie Smit",
    customer_email: "sophie.smit@example.com",
    transaction_id: "TRX-789123456",
    payment_date: null,
    invoice_number: "INV-2024-002",
    payment_details: {
      reference: "REF-789123",
    },
  },
  {
    id: "PAY-2024-003",
    created_at: new Date(2024, 0, 18).toISOString(),
    description: "21 aanvragen (januari 2024)",
    amount: 75.0,
    payment_method: "iDEAL",
    status: "failed",
    failure_reason: "Onvoldoende saldo",
    customer_name: "Bart Bakker",
    customer_email: "bart.bakker@example.com",
    transaction_id: "TRX-321654987",
    payment_date: null,
    invoice_number: "INV-2024-003",
    payment_details: {
      bank: "Rabobank",
      account_last4: "9012",
      reference: "REF-321654",
      error_code: "INSUFFICIENT_FUNDS",
    },
  },
  {
    id: "PAY-2024-004",
    created_at: new Date(2024, 1, 1).toISOString(),
    description: "42 aanvragen (februari 2024)",
    amount: 49.95,
    payment_method: "iDEAL",
    status: "completed",
    customer_name: "Lisa de Lange",
    customer_email: "lisa.delange@example.com",
    transaction_id: "TRX-654987321",
    payment_date: new Date(2024, 1, 1, 9, 20).toISOString(),
    invoice_number: "INV-2024-004",
    payment_details: {
      bank: "SNS Bank",
      account_last4: "3456",
      reference: "REF-654987",
    },
  },
  {
    id: "PAY-2024-005",
    created_at: new Date(2024, 1, 10).toISOString(),
    description: "56 aanvragen (februari 2024)",
    amount: 225.0,
    payment_method: "Creditcard",
    status: "completed",
    customer_name: "Mark Molenaar",
    customer_email: "mark.molenaar@example.com",
    transaction_id: "TRX-987321654",
    payment_date: new Date(2024, 1, 10, 13, 10).toISOString(),
    invoice_number: "INV-2024-005",
    payment_details: {
      card_type: "Mastercard",
      card_last4: "7890",
      expiry_date: "09/26",
    },
  },
  {
    id: "PAY-2024-006",
    created_at: new Date(2024, 1, 22).toISOString(),
    description: "38 aanvragen (februari 2024)",
    amount: 149.0,
    payment_method: "iDEAL",
    status: "pending",
    customer_name: "Emma Evers",
    customer_email: "emma.evers@example.com",
    transaction_id: "TRX-123789456",
    payment_date: null,
    invoice_number: "INV-2024-006",
    payment_details: {
      bank: "Triodos Bank",
      account_last4: "6789",
      reference: "REF-123789",
    },
  },
  {
    id: "PAY-2024-007",
    created_at: new Date(2024, 2, 5).toISOString(),
    description: "27 aanvragen (maart 2024)",
    amount: 99.95,
    payment_method: "iDEAL",
    status: "completed",
    customer_name: "Dirk de Vries",
    customer_email: "dirk.devries@example.com",
    transaction_id: "TRX-456123789",
    payment_date: new Date(2024, 2, 5, 11, 25).toISOString(),
    invoice_number: "INV-2024-007",
    payment_details: {
      bank: "ING Bank",
      account_last4: "4567",
      reference: "REF-456123",
    },
  },
  {
    id: "PAY-2024-008",
    created_at: new Date(2024, 2, 12).toISOString(),
    description: "35 aanvragen (maart 2024)",
    amount: 149.95,
    payment_method: "Creditcard",
    status: "completed",
    customer_name: "Anna Aalbers",
    customer_email: "anna.aalbers@example.com",
    transaction_id: "TRX-789456123",
    payment_date: new Date(2024, 2, 12, 15, 40).toISOString(),
    invoice_number: "INV-2024-008",
    payment_details: {
      card_type: "Visa",
      card_last4: "8901",
      expiry_date: "11/27",
    },
  },
  {
    id: "PAY-2024-009",
    created_at: new Date(2024, 2, 20).toISOString(),
    description: "42 aanvragen (maart 2024)",
    amount: 175.0,
    payment_method: "iDEAL",
    status: "pending",
    customer_name: "Peter Post",
    customer_email: "peter.post@example.com",
    transaction_id: "TRX-123456780",
    payment_date: null,
    invoice_number: "INV-2024-009",
    payment_details: {
      bank: "Rabobank",
      account_last4: "2345",
      reference: "REF-123456780",
    },
  },
  {
    id: "PAY-2024-010",
    created_at: new Date(2024, 2, 28).toISOString(),
    description: "19 aanvragen (maart 2024)",
    amount: 79.95,
    payment_method: "Bancontact",
    status: "failed",
    failure_reason: "Kaart geweigerd",
    customer_name: "Laura Leenders",
    customer_email: "laura.leenders@example.com",
    transaction_id: "TRX-987654320",
    payment_date: null,
    invoice_number: "INV-2024-010",
    payment_details: {
      reference: "REF-987654320",
      error_code: "CARD_DECLINED",
    },
  },
]

// Helper functie voor het formatteren van datum en tijd
function formatDateTime(dateString) {
  if (!dateString) return "N/A"

  const date = new Date(dateString)
  const options = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }

  return date.toLocaleDateString("nl-NL", options).replace(",", " om")
}

// Helper functie voor notificaties
function showNotification(message, type) {
  // Gebruik de globale notificatie functie als deze beschikbaar is
  if (typeof window.showGlobalNotification === "function") {
    window.showGlobalNotification(message, type)
    return
  }

  // Fallback naar de originele notificatie implementatie
  const notification = document.createElement("div")
  notification.className = `notification ${type}`
  
  // Bepaal het juiste icoon op basis van het type
  let icon = "info-circle"
  if (type === "success") icon = "check-circle"
  if (type === "error") icon = "exclamation-circle"
  if (type === "warning") icon = "exclamation-triangle"
  
  // Vul de notificatie
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fas fa-${icon}"></i>
      <span>${message}</span>
    </div>
    <button class="notification-close">
      <i class="fas fa-times"></i>
    </button>
    <div class="notification-progress"></div>
  `
  
  // Zoek de container
  let container = document.querySelector(".notification-container")
  if (!container) {
    container = document.createElement("div")
    container.className = "notification-container"
    document.body.appendChild(container)
  }
  
  // Voeg de notificatie toe aan de container
  container.appendChild(notification)
  
  // Voeg event listener toe voor het sluiten
  const closeBtn = notification.querySelector(".notification-close")
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      notification.classList.add("closing")
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 300)
    })
  }
  
  // Voeg progress bar animatie toe
  const progressBar = notification.querySelector(".notification-progress")
  if (progressBar) {
    progressBar.style.animation = `progressShrink 3000ms linear forwards`
    
    // Sluit de notificatie automatisch na 3 seconden
    setTimeout(() => {
      notification.classList.add("closing")
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 300)
    }, 3000)
  }
  
  return notification
}

// Handler functie voor bedrag knoppen - definieer deze functie voordat deze wordt gebruikt
function handleAmountButtonClick(e) {
  // Voorkom dat de knop het formulier verstuurt
  e.preventDefault()
  e.stopPropagation()

  // Verwijder actieve klasse van alle knoppen
  const amountBtns = document.querySelectorAll(".amount-btn, .amount-btn-modern")
  amountBtns.forEach((b) => b.classList.remove("active"))

  // Voeg actieve klasse toe aan de geselecteerde knop
  this.classList.add("active")

  const customAmountContainer = document.querySelector(".custom-amount-container, .custom-amount-container-modern")
  const amountInput = document.getElementById("amount")
  let selectedAmount = 50

  if (this.classList.contains("custom-amount")) {
    // Toon het aangepaste bedrag veld
    if (customAmountContainer) {
      customAmountContainer.style.display = "block"
      if (amountInput) {
        amountInput.focus()
        selectedAmount = Number.parseInt(amountInput.value) || 50
      }
    }
  } else {
    // Verberg het aangepaste bedrag veld
    if (customAmountContainer) {
      customAmountContainer.style.display = "none"
    }

    // Update het geselecteerde bedrag
    selectedAmount = Number.parseInt(this.getAttribute("data-amount")) || 50

    // Update de input waarde
    if (amountInput) {
      amountInput.value = selectedAmount
    }
  }

  return false
}

// Handler functie voor bekijk details knoppen - definieer deze functie voordat deze wordt gebruikt
function handleViewButtonClick(e) {
  e.preventDefault()
  e.stopPropagation()

  const paymentId = this.getAttribute("data-id")

  // Toon de betalingsdetails
  showPaymentDetails(paymentId)

  return false
}

// Functie om betalingsdetails te tonen in een modal
function showPaymentDetails(paymentId) {
  try {

    // Controleer of de modal bestaat
    const modal = document.getElementById("paymentDetailsModal")
    if (!modal) {
      alert("Er is een fout opgetreden: Modal element niet gevonden.")
      return
    }

    // Controleer of jQuery beschikbaar is
    if (typeof $ === "undefined") {

      // Fallback naar native JavaScript als jQuery niet beschikbaar is
      modal.style.display = "block"
      modal.classList.add("show")
      document.body.classList.add("modal-open")

      // Voeg een backdrop toe
      const backdrop = document.createElement("div")
      backdrop.className = "modal-backdrop fade show"
      document.body.appendChild(backdrop)
    } else {
      // Gebruik jQuery om de modal te tonen
      $(modal).modal("show")
    }

    // Reset de modal content
    const modalContent = modal.querySelector(".payment-details-content")
    if (modalContent) {
      modalContent.innerHTML = `
        <div class="text-center py-5">
          <div class="spinner-border text-primary" role="status">
            <span class="sr-only">Laden...</span>
          </div>
          <p class="mt-2">Betalingsgegevens laden...</p>
        </div>
      `
    } else {
    }

    // Verberg alle actieknoppen
    const downloadBtn = modal.querySelector(".download-invoice-modal")
    const payNowBtn = modal.querySelector(".pay-now-modal")
    const retryBtn = modal.querySelector(".retry-payment-modal")

    if (downloadBtn) downloadBtn.style.display = "none"
    if (payNowBtn) payNowBtn.style.display = "none"
    if (retryBtn) retryBtn.style.display = "none"

    // Simuleer een API-aanroep om betalingsgegevens op te halen
    setTimeout(() => {
      try {
        // Zoek de betaling in de voorbeelddata
        const payment = examplePayments.find((p) => p.id === paymentId)

        if (!payment) {
          if (modalContent) {
            modalContent.innerHTML = `
              <div class="alert alert-danger">
                Betaling met ID ${paymentId} kon niet worden gevonden.
              </div>
            `
          }
          return
        }

        // Update de modal titel
        const modalTitle = document.getElementById("paymentDetailsModalLabel")
        if (modalTitle) {
          modalTitle.textContent = `Betaling details - ${payment.id}`
        }

        // Toon de juiste actieknoppen op basis van de betalingsstatus
        if (payment.status === "completed") {
          if (downloadBtn) {
            downloadBtn.style.display = "block"
            downloadBtn.setAttribute("data-id", payment.id)
          }
        } else if (payment.status === "pending") {
          if (payNowBtn) {
            payNowBtn.style.display = "block"
            payNowBtn.setAttribute("data-id", payment.id)
          }
        } else if (payment.status === "failed") {
          if (retryBtn) {
            retryBtn.style.display = "block"
            retryBtn.setAttribute("data-id", payment.id)
          }
        }

        // Genereer de HTML voor de betalingsdetails
        let statusBadge = ""
        if (payment.status === "completed") {
          statusBadge = '<span class="payment-status-badge badge-success">Voltooid</span>'
        } else if (payment.status === "pending") {
          statusBadge = '<span class="payment-status-badge badge-warning">Openstaand</span>'
        } else if (payment.status === "failed") {
          statusBadge = '<span class="payment-status-badge badge-danger">Mislukt</span>'
        }

        // Nieuwe verbeterde layout met tabellen
        let paymentDetailsHTML = `
          <div class="payment-details-container">
            <!-- Kolom 1: Algemene informatie -->
            <div class="payment-details-column">
              <div class="payment-details-section">
                <h6>Algemene informatie</h6>
                <table class="payment-details-table">
                  <tr>
                    <td class="payment-details-label">Betalings-ID</td>
                    <td class="payment-details-value">${payment.id}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">Factuurnummer</td>
                    <td class="payment-details-value">${payment.invoice_number}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">Beschrijving</td>
                    <td class="payment-details-value">${payment.description}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">Bedrag</td>
                    <td class="payment-details-value">€ ${Number.parseFloat(payment.amount).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">Status</td>
                    <td class="payment-details-value">${statusBadge}</td>
                  </tr>
                </table>
              </div>
            </div>
            
            <!-- Kolom 2: Klantinformatie -->
            <div class="payment-details-column">
              <div class="payment-details-section">
                <h6>Klantinformatie</h6>
                <table class="payment-details-table">
                  <tr>
                    <td class="payment-details-label">Naam</td>
                    <td class="payment-details-value">${payment.customer_name}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">E-mail</td>
                    <td class="payment-details-value">${payment.customer_email}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">Aangemaakt op</td>
                    <td class="payment-details-value">${formatDateTime(payment.created_at)}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">Betaald op</td>
                    <td class="payment-details-value">${payment.payment_date ? formatDateTime(payment.payment_date) : "Nog niet betaald"}</td>
                  </tr>
                </table>
              </div>
            </div>
            
            <!-- Kolom 3: Betaalmethode -->
            <div class="payment-details-column">
              <div class="payment-details-section">
                <h6>Betaalmethode</h6>
                <table class="payment-details-table">
                  <tr>
                    <td class="payment-details-label">Methode</td>
                    <td class="payment-details-value">${payment.payment_method}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">Transactie-ID</td>
                    <td class="payment-details-value">${payment.transaction_id || "N/A"}</td>
                  </tr>
        `

        // Voeg betaalmethode-specifieke details toe
        if (payment.payment_method === "iDEAL" && payment.payment_details) {
          paymentDetailsHTML += `
                  <tr>
                    <td class="payment-details-label">Bank</td>
                    <td class="payment-details-value">${payment.payment_details.bank || "N/A"}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">Rekeningnummer</td>
                    <td class="payment-details-value">**** ${payment.payment_details.account_last4 || "N/A"}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">Referentie</td>
                    <td class="payment-details-value">${payment.payment_details.reference || "N/A"}</td>
                  </tr>
          `
        } else if (payment.payment_method === "Creditcard" && payment.payment_details) {
          paymentDetailsHTML += `
                  <tr>
                    <td class="payment-details-label">Kaarttype</td>
                    <td class="payment-details-value">${payment.payment_details.card_type || "N/A"}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">Kaartnummer</td>
                    <td class="payment-details-value">**** **** **** ${payment.payment_details.card_last4 || "N/A"}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">Vervaldatum</td>
                    <td class="payment-details-value">${payment.payment_details.expiry_date || "N/A"}</td>
                  </tr>
          `
        } else if (payment.payment_method === "Bancontact" && payment.payment_details) {
          paymentDetailsHTML += `
                  <tr>
                    <td class="payment-details-label">Referentie</td>
                    <td class="payment-details-value">${payment.payment_details.reference || "N/A"}</td>
                  </tr>
          `
        }

        paymentDetailsHTML += `
                </table>
              </div>
            </div>
        `

        // Voeg extra informatie toe als de betaling is mislukt
        if (payment.status === "failed") {
          paymentDetailsHTML += `
            <div class="payment-details-column" style="flex-basis: 100%;">
              <div class="payment-details-section">
                <h6>Foutinformatie</h6>
                <table class="payment-details-table">
                  <tr>
                    <td class="payment-details-label">Reden</td>
                    <td class="payment-details-value">${payment.failure_reason || "Onbekende fout"}</td>
                  </tr>
                  <tr>
                    <td class="payment-details-label">Foutcode</td>
                    <td class="payment-details-value">${payment.payment_details && payment.payment_details.error_code ? payment.payment_details.error_code : "N/A"}</td>
                  </tr>
                </table>
              </div>
            </div>
          `
        }

        // Sluit de container
        paymentDetailsHTML += `</div>`

        // Update de modal content
        if (modalContent) {
          modalContent.innerHTML = paymentDetailsHTML
        }
      } catch (innerError) {
        if (modalContent) {
          modalContent.innerHTML = `
            <div class="alert alert-danger">
              Er is een fout opgetreden bij het laden van de betalingsdetails: ${innerError.message}
            </div>
          `
        }
      }
    }, 500) // Simuleer een vertraging van 500ms voor het ophalen van gegevens
  } catch (error) {
    alert("Er is een fout opgetreden bij het laden van de betalingsdetails. Probeer de pagina te vernieuwen.")
  }
}

// Functie om de bedrag knoppen in te stellen
function setupAmountButtons() {
  const amountBtns = document.querySelectorAll(".amount-btn, .amount-btn-modern")
  const customAmountBtn = document.querySelector(".amount-btn.custom-amount, .amount-btn-modern.custom-amount")
  const customAmountContainer = document.querySelector(".custom-amount-container, .custom-amount-container-modern")
  const amountInput = document.getElementById("amount")
  const topupForm = document.getElementById("topupForm")

  // Standaard geselecteerd bedrag
  let selectedAmount = 50

  // Zorg ervoor dat de standaard knop actief is
  const defaultBtn = document.querySelector('.amount-btn[data-amount="50"], .amount-btn-modern[data-amount="50"]')
  if (defaultBtn) {
    defaultBtn.classList.add("active")
  }

  // Voeg click handlers toe aan alle bedrag knoppen
  if (amountBtns && amountBtns.length > 0) {
    amountBtns.forEach((btn) => {
      // Verwijder bestaande event listeners om dubbele triggers te voorkomen
      btn.removeEventListener("click", handleAmountButtonClick)

      // Voeg nieuwe event listener toe
      btn.addEventListener("click", handleAmountButtonClick)
    })
  }

  // Event listener voor het aangepaste bedrag input veld
  if (amountInput) {
    amountInput.addEventListener("input", function () {
      selectedAmount = Number.parseInt(this.value) || 50
    })
  }

  // Event listener voor het formulier
  if (topupForm) {
    topupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      
      // Valideer het bedrag
      if (selectedAmount < 10) {
        showNotification("Het minimale bedrag is €10", "error");
        return;
      }

      const paymentMethodElement = document.querySelector('input[name="payment_method"]:checked');
      const paymentMethod = paymentMethodElement ? paymentMethodElement.value : "ideal";


      try {
        // Show loading state
        const submitBtn = topupForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Bezig met opwaarderen...';
        submitBtn.disabled = true;

        // Send topup request to backend
        const response = await fetch('/api/payments/topup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            amount: selectedAmount,
            method: paymentMethod
          })
        });

        const result = await response.json();

        if (response.ok && result.success) {
          showNotification(result.message || 'Saldo opwaardering gestart!', 'success');
          
          // If there's a checkout URL, redirect to it
          if (result.checkoutUrl) {
            showNotification('Je wordt doorgestuurd naar de betaalpagina...', 'info');
            setTimeout(() => {
              window.location.href = result.checkoutUrl;
            }, 1000);
          } else {
            // For SEPA, start payment status checker
            if (result.paymentId) {
              showNotification('Betaling wordt verwerkt... We checken de status automatisch.', 'info');
              startPaymentStatusChecker(result.paymentId);
            }
          }
        } else {
          showNotification(result.error || 'Er is een fout opgetreden bij het opwaarderen', 'error');
        }
      } catch (error) {
        showNotification('Er is een fout opgetreden bij het opwaarderen', 'error');
      } finally {
        // Restore button state
        const submitBtn = topupForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      }
    });
  }
}

// Functie om DataTables te initialiseren - DISABLED
function initDataTables() {
  
  // DataTables is uitgeschakeld - alle payments worden getoond zonder paginatie
  // Dit voorkomt de paginatie HTML die de gebruiker wil verwijderen
}

// Functie om de modal actieknoppen te initialiseren
function initModalButtons() {
  const downloadInvoiceBtn = document.querySelector(".download-invoice-modal")
  const payNowBtn = document.querySelector(".pay-now-modal")
  const retryPaymentBtn = document.querySelector(".retry-payment-modal")

  if (downloadInvoiceBtn) {
    downloadInvoiceBtn.addEventListener("click", function () {
      const paymentId = this.getAttribute("data-id")
      alert(`Factuur voor betaling ID: ${paymentId} wordt gedownload...`)
      $("#paymentDetailsModal").modal("hide")
    })
  }

  if (payNowBtn) {
    payNowBtn.addEventListener("click", function () {
      const paymentId = this.getAttribute("data-id")
      alert(`Je wordt doorgestuurd naar de betaalpagina voor betaling ID: ${paymentId}`)
      $("#paymentDetailsModal").modal("hide")
    })
  }

  if (retryPaymentBtn) {
    retryPaymentBtn.addEventListener("click", function () {
      const paymentId = this.getAttribute("data-id")
      alert(`Je wordt doorgestuurd naar de betaalpagina om betaling ID: ${paymentId} opnieuw te proberen`)
      $("#paymentDetailsModal").modal("hide")
    })
  }

  // Sluit knop voor de modal
  const closeButtons = document.querySelectorAll('[data-dismiss="modal"]')
  closeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const modal = document.getElementById("paymentDetailsModal")
      if (typeof $ !== "undefined") {
        $(modal).modal("hide")
      } else {
        modal.style.display = "none"
        modal.classList.remove("show")
        document.body.classList.remove("modal-open")
        const backdrop = document.querySelector(".modal-backdrop")
        if (backdrop) {
          backdrop.parentNode.removeChild(backdrop)
        }
      }
    })
  })
}

// Functie om de bekijk details knoppen te initialiseren
function initViewDetailsButtons() {
  const viewButtons = document.querySelectorAll(".view-payment")

  viewButtons.forEach((button) => {
    // Verwijder bestaande event listeners om dubbele triggers te voorkomen
    button.removeEventListener("click", handleViewButtonClick)

    // Voeg nieuwe event listener toe
    button.addEventListener("click", handleViewButtonClick)
  })
}

// Functie om de overige actieknoppen te initialiseren
function initActionButtons() {
  // Nu betalen functionaliteit
  document.querySelectorAll(".pay-now").forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault()
      const paymentId = this.getAttribute("data-id")
      alert(`Je wordt doorgestuurd naar de betaalpagina voor betaling ID: ${paymentId}`)
    })
  })

  // Factuur downloaden functionaliteit
  document.querySelectorAll(".download-invoice").forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault()
      const paymentId = this.getAttribute("data-id")
      alert(`Factuur voor betaling ID: ${paymentId} wordt gedownload...`)
    })
  })

  // Betaling opnieuw proberen functionaliteit
  document.querySelectorAll(".retry-payment").forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault()
      const paymentId = this.getAttribute("data-id")
      alert(`Je wordt doorgestuurd naar de betaalpagina om betaling ID: ${paymentId} opnieuw te proberen`)
    })
  })
}

// Controleer of de modal al bestaat, zo niet, maak deze aan
function ensureModalExists() {
  if (!document.getElementById("paymentDetailsModal")) {
    const modalHTML = `
      <div class="modal fade" id="paymentDetailsModal" tabindex="-1" role="dialog" aria-labelledby="paymentDetailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="paymentDetailsModalLabel">Betaling details</h5>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="modal-body">
              <div class="payment-details-content">
                <!-- Content will be dynamically populated -->
                <div class="text-center py-5">
                  <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Laden...</span>
                  </div>
                  <p class="mt-2">Betalingsgegevens laden...</p>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-dismiss="modal">Sluiten</button>
              <button type="button" class="btn btn-primary download-invoice-modal" style="display: none;">Factuur downloaden</button>
              <button type="button" class="btn btn-success pay-now-modal" style="display: none;">Nu betalen</button>
              <button type="button" class="btn btn-warning retry-payment-modal" style="display: none;">Opnieuw proberen</button>
            </div>
          </div>
        </div>
      </div>
    `

    const modalContainer = document.createElement("div")
    modalContainer.innerHTML = modalHTML
    document.body.appendChild(modalContainer.firstChild)

  } else {
    // Update de bestaande modal naar een bredere versie
    const modalDialog = document.querySelector("#paymentDetailsModal .modal-dialog")
    if (modalDialog) {
      modalDialog.classList.remove("modal-lg")
      modalDialog.classList.add("modal-xl")
    }
  }
}

// Voeg een functie toe om het iDEAL logo te vervangen
function replaceIdealLogo() {
  try {

    // Zoek alle iDEAL logo's in de betaalmethode opties
    const idealLogos = document.querySelectorAll('.payment-method-option .payment-logo img[alt="iDEAL"]')

    // Vervang elk iDEAL logo met een beter logo
    if (idealLogos && idealLogos.length > 0) {
      idealLogos.forEach((logo) => {
        try {
          // Vervang de src met een beter iDEAL logo
          logo.src = "https://www.ideal.nl/img/ideal-logo.png"

          // Zorg ervoor dat het logo goed wordt weergegeven
          logo.style.maxHeight = "30px"
          logo.style.maxWidth = "100%"
          logo.style.objectFit = "contain"
        } catch (logoError) {
        }
      })
    } else {
    }

    // Zoek ook naar iDEAL logo's die mogelijk als achtergrondafbeelding zijn ingesteld
    const idealLabels = document.querySelectorAll(".payment-method-label")
    if (idealLabels && idealLabels.length > 0) {
      idealLabels.forEach((label) => {
        try {
          const methodName = label.querySelector(".payment-method-name")
          if (methodName && methodName.textContent && methodName.textContent.trim().toLowerCase() === "ideal") {
            const logoContainer = label.querySelector(".payment-logo")
            if (logoContainer) {
              // Maak de container leeg en voeg een nieuw img element toe
              logoContainer.innerHTML = ""
              const newLogo = document.createElement("img")
              newLogo.src = "https://www.ideal.nl/img/ideal-logo.png"
              newLogo.alt = "iDEAL"
              newLogo.style.maxHeight = "30px"
              newLogo.style.maxWidth = "100%"
              newLogo.style.objectFit = "contain"
              logoContainer.appendChild(newLogo)
            }
          }
        } catch (labelError) {
        }
      })
    } else {
    }

  } catch (error) {
  }
}

// Mollie variables - will be initialized after DOM loads
let mollieInstance = null;
let cardHolder = null;
let cardNumber = null;
let expiryDate = null;
let verificationCode = null;

// Make Mollie instance globally available
window.mollieInstance = mollieInstance;

// Define the styles object once
const mollieStyles = {
  base: {
    color: '#222',
    fontSize: '1.1rem',
    fontFamily: 'Poppins, sans-serif',
    backgroundColor: '#fff',
    borderRadius: '6px',
    border: '1.5px solid #ced4da',
    '::placeholder': { color: '#b0b0b0' }
  },
  focus: {
    borderColor: '#ea5d0d',
    boxShadow: '0 0 0 2px rgba(234, 93, 13, 0.08)'
  },
  invalid: {
    color: '#ef4444',
    borderColor: '#ef4444'
  }
};

// Initialize Mollie components
function initializeMollie() {
  try {
    
    if (typeof Mollie === 'undefined') {
      return false;
    }
    
    mollieInstance = Mollie(window.MOLLIE_PROFILE_ID || 'pfl_PN78N3V8Ka', { 
      locale: 'nl_NL',
      testmode: false // Set to false for live mode
    });
    
    // Update global reference
    window.mollieInstance = mollieInstance;
    
    // Create Mollie components
    cardHolder = mollieInstance.createComponent('cardHolder', {
      styles: mollieStyles,
      placeholder: 'Naam zoals op de kaart'
    });
    cardNumber = mollieInstance.createComponent('cardNumber', {
      styles: mollieStyles,
      placeholder: '1234 5678 9012 3456'
    });
    expiryDate = mollieInstance.createComponent('expiryDate', {
      styles: mollieStyles,
      placeholder: 'MM / JJ'
    });
    verificationCode = mollieInstance.createComponent('verificationCode', {
      styles: mollieStyles,
      placeholder: 'CVC/CVV'
    });
    
    return true;
  } catch (error) {
    return false;
  }
}

// Handle errors for all Mollie components
function handleMollieError(event) {
  const errorDiv = document.getElementById('card-errors');
  if (!errorDiv) return;
  
  if (event.error && event.touched) {
    errorDiv.textContent = typeof event.error === 'string' ? event.error : event.error.message || 'Er is een fout opgetreden';
  } else {
    errorDiv.textContent = '';
  }
}

// Add error listeners to all components (only if they exist)
if (cardHolder) cardHolder.addEventListener('change', handleMollieError);
if (cardNumber) cardNumber.addEventListener('change', handleMollieError);
if (expiryDate) expiryDate.addEventListener('change', handleMollieError);
if (verificationCode) verificationCode.addEventListener('change', handleMollieError);

// Handle amount selection and updates
function handleAmountSelection() {
  const amountInput = document.getElementById('custom-amount-input');
  const amountButtons = document.querySelectorAll('.amount-btn-modern');
  let selectedAmount = 50; // Default amount

  // Handle custom amount input
  if (amountInput) {
    amountInput.addEventListener('input', function() {
      const value = parseInt(this.value) || 0;
      if (value >= 50) {
        selectedAmount = value;
        updatePaymentSummary(selectedAmount);
        // Remove active state from preset buttons
        amountButtons.forEach(btn => btn.classList.remove('active'));
      }
    });
  }

  // Handle preset amount buttons
  amountButtons.forEach(button => {
    button.addEventListener('click', function() {
      const amount = parseInt(this.dataset.amount) || 0;
      if (amount >= 50) {
        selectedAmount = amount;
        // Update input if it exists
        if (amountInput) {
          amountInput.value = amount;
        }
        // Update active state
        amountButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        // Update summary
        updatePaymentSummary(selectedAmount);
      }
    });
  });

  // Initial summary update
  updatePaymentSummary(selectedAmount);
}

// Update payment summary
function updatePaymentSummary(amount) {
  const currentBalance = parseFloat(document.querySelector('.current-balance-modern .amount')?.textContent.replace('€', '').trim() || '0');
  const summaryValue = document.querySelector('.summary-value-modern');
  const totalValue = document.querySelector('.summary-total-value-modern');

  if (summaryValue) {
    summaryValue.textContent = `+ € ${amount.toFixed(2)}`;
  }
  if (totalValue) {
    totalValue.textContent = `€ ${(currentBalance + amount).toFixed(2)}`;
  }
}

// ============= PAYMENT METHODS UI MANAGEMENT =============

// Function to load existing payment methods on page load
async function loadExistingPaymentMethods() {
  try {
    // Call the function that exists in the EJS template
    if (window.loadPaymentMethodsForToggle) {
      await window.loadPaymentMethodsForToggle();
    } else {
      showEmptySEPAForm();
    }
  } catch (error) {
    // Show empty forms on error
    showEmptySEPAForm();
  }
}

// Function to show empty SEPA form (replaces the old CTA functionality)
function showEmptySEPAForm() {
  // The form is already visible, just ensure it's in empty state
  const bankSelect = document.getElementById('bankSelect');
  const iban = document.getElementById('iban');
  const accountHolder = document.getElementById('accountHolder');
  
  if (bankSelect) bankSelect.value = '';
  if (iban) iban.value = '';
  if (accountHolder) accountHolder.value = '';
}

// Function to show saved payment methods
function showSavedPaymentMethods(paymentMethods) {
  // Load payment methods into the forms
  if (paymentMethods && paymentMethods.length > 0) {
    const creditCardMethod = paymentMethods.find(method => method.type === 'credit_card');
    const sepaMethod = paymentMethods.find(method => method.type === 'sepa');
    
    if (creditCardMethod && window.fillCreditCardForm) {
      window.fillCreditCardForm(creditCardMethod);
    }
    
    if (sepaMethod && window.fillSEPAForm) {
      window.fillSEPAForm(sepaMethod);
    } else {
      showEmptySEPAForm();
    }
  } else {
    showEmptySEPAForm();
  }
}

// Function to create HTML for saved payment methods
function createSavedMethodsHTML(paymentMethods) {
  // This function is no longer needed since we're using the toggle form
  return '';
}



// Function to initialize payment toggle slider
function initPaymentToggleSlider() {
  // Both sections should be visible by default (side by side)
  
  const sepaSection = document.querySelector('.sepa-section');
  const cardSection = document.querySelector('.card-section');
  
  if (!sepaSection || !cardSection) return;
  
  // Ensure both sections are visible
  sepaSection.style.display = 'block';
  cardSection.style.display = 'block';
  
  // Initialize bank selector functionality
  initBankSelector();
  
  // Mount Mollie components when needed
  setTimeout(() => {
    mountMollieComponents();
  }, 500);
}



// Function to initialize bank selector
function initBankSelector() {
  const bankSelectButton = document.querySelector('.bank-selector-button');
  const bankDropdown = document.querySelector('.bank-dropdown');
  const bankOptions = document.querySelectorAll('.bank-option');
  const selectedBankSpan = document.querySelector('.selected-bank span');
  const bankLogo = document.querySelector('.bank-logo');
  
  if (!bankSelectButton || !bankDropdown) return;
  
  // Toggle dropdown
  bankSelectButton.addEventListener('click', (e) => {
    e.preventDefault();
    bankDropdown.style.display = bankDropdown.style.display === 'none' ? 'block' : 'none';
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!bankSelectButton.contains(e.target) && !bankDropdown.contains(e.target)) {
      bankDropdown.style.display = 'none';
    }
  });
  
  // Handle bank selection
  bankOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      e.preventDefault();
      
      const bankName = option.dataset.bank;
      const bankText = option.querySelector('span').textContent;
      const bankImg = option.querySelector('img');
      
      // Update selected bank
      selectedBankSpan.textContent = bankText;
      bankLogo.src = bankImg.src;
      bankLogo.alt = bankText;
      
      // Close dropdown
      bankDropdown.style.display = 'none';
      
      // Add visual feedback
      option.style.backgroundColor = '#f8f9fa';
      setTimeout(() => {
        option.style.backgroundColor = '';
      }, 200);
    });
    
    // Add hover effects
    option.addEventListener('mouseenter', () => {
      option.style.backgroundColor = '#f8f9fa';
    });
    
    option.addEventListener('mouseleave', () => {
      option.style.backgroundColor = '';
    });
  });
}

// Function to handle payment method form submissions
function initPaymentMethodForms() {
  
  try {
    // Initialize toggle slider functionality
    initPaymentToggleSlider();
    
    // Initialize bank selector
    initBankSelector();
    
    // The payment method forms are already visible in the toggle component
    // No need to show/hide containers that don't exist
    
  } catch (error) {
  }
}
  
  
  // The partial handles its own form submissions via onclick handlers
  // We don't need to add additional form submission handlers here

// Function to unmount Mollie components
function unmountMollieComponents() {
  try {
    // Check if components exist and are mounted before unmounting
    if (cardHolder && typeof cardHolder.unmount === 'function') {
      try {
        cardHolder.unmount();
      } catch (unmountError) {
        // Component might not be mounted, ignore the error
      }
    }
    if (cardNumber && typeof cardNumber.unmount === 'function') {
      try {
        cardNumber.unmount();
      } catch (unmountError) {
      }
    }
    if (expiryDate && typeof expiryDate.unmount === 'function') {
      try {
        expiryDate.unmount();
      } catch (unmountError) {
      }
    }
    if (verificationCode && typeof verificationCode.unmount === 'function') {
      try {
        verificationCode.unmount();
      } catch (unmountError) {
      }
    }
  } catch (error) {
  }
}

// Function to mount Mollie components
function mountMollieComponents() {
  try {
    if (!mollieInstance || !cardHolder || !cardNumber || !expiryDate || !verificationCode) {
      return;
    }
    
    // Unmount existing components first to prevent duplicate mounting
    unmountMollieComponents();
    
    // Check if the elements exist before mounting
    const cardHolderElement = document.querySelector('#card-holder');
    const cardNumberElement = document.querySelector('#card-number');
    const expiryDateElement = document.querySelector('#expiry-date');
    const verificationCodeElement = document.querySelector('#verification-code');
    
    if (cardHolderElement) {
      cardHolder.mount('#card-holder');
    } else {
    }
    
    if (cardNumberElement) {
      cardNumber.mount('#card-number');
    } else {
    }
    
    if (expiryDateElement) {
      expiryDate.mount('#expiry-date');
    } else {
    }
    
    if (verificationCodeElement) {
      verificationCode.mount('#verification-code');
    } else {
    }
    
  } catch (error) {
  }
}

// Make functions globally available
window.mountMollieComponents = mountMollieComponents;
window.unmountMollieComponents = unmountMollieComponents;

// Function to handle credit card submission
async function handleCreditCardSubmission() {
  try {
    // Create Mollie token
    const { token, error } = await mollieInstance.createToken();
    
    if (error) {
      showNotification('Fout bij het valideren van de kaartgegevens: ' + error.message, 'error');
      return;
    }
    
    // Send token to backend
    const response = await fetch('/api/payments/methods/creditcard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: token })
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      // Check if 3D Secure verification is required
      const checkoutUrl = result.checkoutUrl || result.verification?.checkoutUrl;
      if (checkoutUrl) {
        showNotification('Creditcard wordt geverifieerd...', 'info');
        // Redirect to 3D Secure verification
        window.location.href = checkoutUrl;
      } else {
        showNotification('Creditcard succesvol toegevoegd!', 'success');
        
        // Reload payment methods
        setTimeout(() => {
          loadExistingPaymentMethods();
        }, 1000);
      }
    } else {
      showNotification('Fout bij het toevoegen van de creditcard: ' + (result.error || result.message || 'Onbekende fout'), 'error');
    }
  } catch (error) {
    showNotification('Er is een fout opgetreden bij het toevoegen van de creditcard', 'error');
  }
}

// Function to handle bank account submission
async function handleBankAccountSubmission() {
  try {
    const form = document.getElementById('paymentForm');
    if (!form) {
      return;
    }
    
    const formData = new FormData(form);
    const data = {
      accountName: formData.get('accountHolder'),
      iban: formData.get('iban'),
      bank: document.querySelector('.selected-bank')?.textContent || 'Bank'
    };
    
    const response = await fetch('/api/payments/methods/bankaccount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      showNotification('Bankrekening succesvol toegevoegd!', 'success');
      
      // Update payment methods without reload
      setTimeout(() => {
        loadExistingPaymentMethods();
      }, 1000);
    } else {
      showNotification('Fout bij het toevoegen van de bankrekening: ' + (result.message || 'Onbekende fout'), 'error');
    }
  } catch (error) {
    showNotification('Er is een fout opgetreden bij het toevoegen van de bankrekening', 'error');
  }
}

// Function to handle payment method actions (set default, remove)
function initPaymentMethodActions() {
  document.addEventListener('click', async (e) => {
    // Handle set default button
    if (e.target.classList.contains('set-default-btn')) {
      const methodId = e.target.dataset.methodId;
      await setDefaultPaymentMethod(methodId);
    }
    
    // Handle remove button
    if (e.target.classList.contains('remove-method-btn') || e.target.parentElement.classList.contains('remove-method-btn')) {
      const methodId = e.target.dataset.methodId || e.target.parentElement.dataset.methodId;
      if (confirm('Weet je zeker dat je deze betaalmethode wilt verwijderen?')) {
        await removePaymentMethod(methodId);
      }
    }
  });
}

// Function to set default payment method
async function setDefaultPaymentMethod(methodId) {
  try {
    const response = await fetch(`/api/payments/methods/${methodId}/default`, {
      method: 'PUT'
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      showNotification('Standaard betaalmethode bijgewerkt', 'success');
      loadExistingPaymentMethods();
    } else {
      showNotification('Fout bij het bijwerken van de standaard betaalmethode', 'error');
    }
  } catch (error) {
    showNotification('Er is een fout opgetreden', 'error');
  }
}

// Function to remove payment method
async function removePaymentMethod(methodId) {
  try {
    const response = await fetch(`/api/payments/methods/${methodId}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      showNotification('Betaalmethode verwijderd', 'success');
      loadExistingPaymentMethods();
    } else {
      showNotification('Fout bij het verwijderen van de betaalmethode', 'error');
    }
  } catch (error) {
    showNotification('Er is een fout opgetreden', 'error');
  }
}

// ============= END PAYMENT METHODS UI MANAGEMENT =============

// Initialiseer de pagina
document.addEventListener("DOMContentLoaded", () => {

  try {
    // Initialize Mollie first
    initializeMollie();

    // Initialiseer DataTables
    initDataTables()

    // Initialiseer de modal
    ensureModalExists()

    // Initialiseer de modal actieknoppen
    initModalButtons()

    // Initialiseer de bekijk details knoppen
    initViewDetailsButtons()

    // Initialiseer de overige actieknoppen
    initActionButtons()

    // Initialiseer de bedrag knoppen
    setupAmountButtons()

    // Vervang het iDEAL logo
    replaceIdealLogo()
    
    // ===== NEW PAYMENT METHODS FUNCTIONALITY =====
    // Initialize payment method forms and actions
    initPaymentMethodForms()
    
    // Load existing payment methods on page load
    loadExistingPaymentMethods()
    
    
  } catch (error) {
  }
})

