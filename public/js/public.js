document.addEventListener('DOMContentLoaded', function() {
    // DataTables initialisatie uitgeschakeld - geen paginatie meer
    console.log('DataTables initialization disabled in public.js');
    
    // Modal functionaliteit
    const modal = document.getElementById('paymentDetailsModal');
    const closeModal = document.getElementById('closeModal');
    
    // Payment details bekijken
    document.querySelectorAll('.view-payment').forEach(button => {
      button.addEventListener('click', function() {
        const paymentId = this.getAttribute('data-id');
        
        fetch(`/api/payments/${paymentId}`)
          .then(response => {
            if (!response.ok) {
              throw new Error('Fout bij ophalen betaling details');
            }
            return response.json();
          })
          .then(payment => {
            // Payment details invullen
            document.getElementById('paymentDetails').innerHTML = `
              <div style="margin-bottom: 1rem;">
                <div style="margin-bottom: 0.5rem;">
                  <strong>Betaling ID:</strong> ${payment.id}
                </div>
                <div style="margin-bottom: 0.5rem;">
                  <strong>Datum:</strong> ${new Date(payment.created_at).toLocaleString('nl-NL')}
                </div>
                <div style="margin-bottom: 0.5rem;">
                  <strong>Beschrijving:</strong> ${payment.description}
                </div>
                <div style="margin-bottom: 0.5rem;">
                  <strong>Bedrag:</strong> € ${parseFloat(payment.amount).toFixed(2)}
                </div>
                <div style="margin-bottom: 0.5rem;">
                  <strong>Betaalmethode:</strong> ${payment.payment_method}
                </div>
                <div style="margin-bottom: 0.5rem;">
                  <strong>Status:</strong> 
                  ${payment.status === 'pending' ? '<span class="badge badge-warning">Openstaand</span>' : 
                    payment.status === 'completed' ? '<span class="badge badge-success">Voltooid</span>' : 
                    payment.status === 'failed' ? '<span class="badge badge-danger">Mislukt</span>' : 
                    `<span class="badge badge-secondary">${payment.status}</span>`}
                </div>
                ${payment.status === 'failed' ? `
                  <div style="margin-bottom: 0.5rem;">
                    <strong>Reden mislukt:</strong> ${payment.failure_reason || 'Onbekend'}
                  </div>
                ` : ''}
                ${payment.transaction_id ? `
                  <div style="margin-bottom: 0.5rem;">
                    <strong>Transactie ID:</strong> ${payment.transaction_id}
                  </div>
                ` : ''}
                ${payment.invoice_number ? `
                  <div style="margin-bottom: 0.5rem;">
                    <strong>Factuurnummer:</strong> ${payment.invoice_number}
                  </div>
                ` : ''}
              </div>
            `;
            
            // Footer buttons aanpassen op basis van status
            if (payment.status === 'pending') {
              document.getElementById('paymentModalFooter').innerHTML = `
                <button type="button" class="btn btn-outline" id="closeModalBtn">Sluiten</button>
                <button type="button" class="btn btn-primary pay-now-modal" data-id="${payment.id}">Nu betalen</button>
              `;
              
              document.querySelector('.pay-now-modal').addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                window.location.href = `/dashboard/payments/${id}/pay`;
              });
              
              document.getElementById('closeModalBtn').addEventListener('click', function() {
                modal.style.display = 'none';
              });
            } else if (payment.status === 'completed') {
              document.getElementById('paymentModalFooter').innerHTML = `
                <button type="button" class="btn btn-outline" id="closeModalBtn">Sluiten</button>
                <button type="button" class="btn btn-primary download-invoice-modal" data-id="${payment.id}">
                  <i class="fas fa-file-invoice mr-2"></i> Factuur downloaden
                </button>
              `;
              
              document.querySelector('.download-invoice-modal').addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                window.location.href = `/dashboard/payments/${id}/invoice`;
              });
              
              document.getElementById('closeModalBtn').addEventListener('click', function() {
                modal.style.display = 'none';
              });
            } else if (payment.status === 'failed') {
              document.getElementById('paymentModalFooter').innerHTML = `
                <button type="button" class="btn btn-outline" id="closeModalBtn">Sluiten</button>
                <button type="button" class="btn btn-primary retry-payment-modal" data-id="${payment.id}">
                  <i class="fas fa-redo mr-2"></i> Opnieuw proberen
                </button>
              `;
              
              document.querySelector('.retry-payment-modal').addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                window.location.href = `/dashboard/payments/${id}/retry`;
              });
              
              document.getElementById('closeModalBtn').addEventListener('click', function() {
                modal.style.display = 'none';
              });
            } else {
              document.getElementById('paymentModalFooter').innerHTML = `
                <button type="button" class="btn btn-outline" id="closeModalBtn">Sluiten</button>
              `;
              
              document.getElementById('closeModalBtn').addEventListener('click', function() {
                modal.style.display = 'none';
              });
            }
            
            // Modal openen
            modal.style.display = 'block';
          })
          .catch(error => {
            alert('Fout bij ophalen betaling details: ' + error.message);
          });
      });
    });
    
    // Modal sluiten
    if (closeModal) {
      closeModal.addEventListener('click', function() {
        modal.style.display = 'none';
      });
    }
    
    // Sluiten als er buiten de modal wordt geklikt
    window.addEventListener('click', function(event) {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    });
    
    // Nu betalen knoppen
    document.querySelectorAll('.pay-now').forEach(button => {
      button.addEventListener('click', function() {
        const paymentId = this.getAttribute('data-id');
        window.location.href = `/dashboard/payments/${paymentId}/pay`;
      });
    });
    
    // Factuur downloaden knoppen
    document.querySelectorAll('.download-invoice').forEach(button => {
      button.addEventListener('click', function() {
        const paymentId = this.getAttribute('data-id');
        window.location.href = `/dashboard/payments/${paymentId}/invoice`;
      });
    });
    
    // Opnieuw proberen knoppen
    document.querySelectorAll('.retry-payment').forEach(button => {
      button.addEventListener('click', function() {
        const paymentId = this.getAttribute('data-id');
        window.location.href = `/dashboard/payments/${paymentId}/retry`;
      });
    });
    
    // Saldo opwaarderen formulier
    const topupForm = document.getElementById('topupForm');
    if (topupForm) {
      topupForm.addEventListener('submit', function(event) {
        const amountInput = document.getElementById('amount');
        const amount = parseFloat(amountInput.value);
        
        if (amount < 10) {
          event.preventDefault();
          alert('Het minimale bedrag voor opwaarderen is €10.');
          amountInput.focus();
        }
      });
    }
  });