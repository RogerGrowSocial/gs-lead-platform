// ============= AUTOMATIC PAYMENT STATUS CHECKER =============

// Function to check payment status and update balance if needed
async function checkPaymentStatus(paymentId) {
  try {
    
    const response = await fetch(`/api/payments/confirm/${paymentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      showNotification(`Saldo succesvol bijgewerkt! Nieuw saldo: €${result.newBalance}`, 'success');
      
      // Update balance display without reload
      setTimeout(() => {
        // Trigger a custom event to update balance display
        window.dispatchEvent(new CustomEvent('balanceUpdated', { 
          detail: { newBalance: result.newBalance } 
        }));
      }, 1000);
      
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

// Function to periodically check payment status
function startPaymentStatusChecker(paymentId, maxAttempts = 10) {
  let attempts = 0;
  const interval = setInterval(async () => {
    attempts++;
    
    const confirmed = await checkPaymentStatus(paymentId);
    
    if (confirmed || attempts >= maxAttempts) {
      clearInterval(interval);
      if (!confirmed && attempts >= maxAttempts) {
        showNotification('Betaling is nog niet bevestigd. Controleer je betaalstatus in je dashboard.', 'warning');
      }
    }
  }, 5000); // Check every 5 seconds
}

// Check URL parameters for payment success
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const topupSuccess = urlParams.get('topup_success');
  const paymentId = urlParams.get('payment_id');
  
  if (topupSuccess === 'true' && paymentId) {
    showNotification('Betaling wordt verwerkt... We checken de status automatisch.', 'info');
    
    // Start checking payment status
    startPaymentStatusChecker(paymentId);
    
    // Clean up URL parameters
    const url = new URL(window.location);
    url.searchParams.delete('topup_success');
    url.searchParams.delete('payment_id');
    window.history.replaceState({}, '', url);
  }
});

// Make functions globally available
window.checkPaymentStatus = checkPaymentStatus;
window.startPaymentStatusChecker = startPaymentStatusChecker;
