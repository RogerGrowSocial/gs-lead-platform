/* ============================================
   MONTHLY GROWTH - INITIALIZATION
   ============================================ */

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  loadMonthlyGrowthData();
});

/* ============================================
   GET MONTH NAMES
   ============================================ */
function getMonthNames() {
  const now = new Date();
  const currentMonth = now.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
  
  // Get previous month
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonth = prevDate.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
  
  return {
    current: currentMonth,      // "september 2025"
    previous: previousMonth     // "augustus 2025"
  };
}

// Capitalize first letter
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ============================================
   LOAD MONTHLY GROWTH DATA
   ============================================ */
async function loadMonthlyGrowthData() {
  try {
    // Fetch data from API
    const response = await fetch('/admin/api/admin/monthly-growth');
    const data = await response.json();
    
    // Update the card with fetched data
    updateMonthlyGrowthCard(data);
    
  } catch (error) {
    console.error('Error loading monthly growth data:', error);
    
    // Use mock data as fallback
    const mockData = {
      revenue: {
        current: 43600,        // In cents: €436.00
        previous: 26300,       // In cents: €263.00
        change: 65.8           // Percentage
      },
      payments: {
        current: 56,
        previous: 11,
        change: 409.1          // Percentage
      }
    };
    
    updateMonthlyGrowthCard(mockData);
  }
}

/* ============================================
   UPDATE MONTHLY GROWTH CARD
   ============================================ */
function updateMonthlyGrowthCard(data) {
  // Get month names
  const months = getMonthNames();
  const currentMonthLabel = capitalize(months.current);   // "September 2025"
  const previousMonthLabel = capitalize(months.previous); // "Augustus 2025"
  
  // Update current month label
  const currentMonthElement = document.getElementById('currentMonthLabel');
  if (currentMonthElement) {
    currentMonthElement.textContent = currentMonthLabel;
  }
  
  // Update comparison label
  const comparisonElement = document.getElementById('comparisonLabel');
  if (comparisonElement) {
    comparisonElement.textContent = `vs ${previousMonthLabel}`;
  }
  
  // Update current revenue
  const currentRevenueElement = document.getElementById('currentRevenue');
  if (currentRevenueElement) {
    currentRevenueElement.textContent = formatCurrency(data.revenue.current);
  }
  
  // Update current payments
  const currentPaymentsElement = document.getElementById('currentPayments');
  if (currentPaymentsElement) {
    currentPaymentsElement.textContent = `${data.payments.current} betalingen`;
  }
  
  // Update revenue growth
  const revenueGrowthElement = document.getElementById('revenueGrowth');
  if (revenueGrowthElement) {
    revenueGrowthElement.innerHTML = renderGrowthChange(data.revenue.change);
  }
  
  // Update payments growth
  const paymentsGrowthElement = document.getElementById('paymentsGrowth');
  if (paymentsGrowthElement) {
    paymentsGrowthElement.innerHTML = renderGrowthChange(data.payments.change);
  }
  
  // Update previous revenue
  const previousRevenueElement = document.getElementById('previousRevenue');
  if (previousRevenueElement) {
    previousRevenueElement.textContent = formatCurrency(data.revenue.previous);
  }
  
  // Update previous payments
  const previousPaymentsElement = document.getElementById('previousPayments');
  if (previousPaymentsElement) {
    previousPaymentsElement.textContent = `${data.payments.previous} betalingen`;
  }
}

/* ============================================
   FORMAT CURRENCY
   ============================================ */
function formatCurrency(cents) {
  // Convert cents to euros
  const euros = cents / 100;
  
  // Format with Dutch locale
  return '€' + euros.toLocaleString('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/* ============================================
   FORMAT PERCENTAGE CHANGE
   ============================================ */
function formatPercentageChange(change) {
  // Add + sign for positive changes
  const sign = change > 0 ? '+' : '';
  
  // Format with 1 decimal place
  return sign + change.toFixed(1) + '%';
}

/* ============================================
   RENDER GROWTH CHANGE WITH TREND ICON
   ============================================ */
function renderGrowthChange(change) {
  const isPositive = change >= 0;
  
  // Choose trend and classes
  const trendClass = isPositive ? 'growth-trend-up' : 'growth-trend-down';
  const percentageClass = isPositive ? 'growth-percentage-positive' : 'growth-percentage-negative';
  
  // SVG polyline for up or down
  const trendPolyline = isPositive 
    ? '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline>'  // Trending up
    : '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline>';  // Trending down
  
  // Format percentage
  const sign = isPositive ? '+' : '';
  const percentage = `${sign}${change.toFixed(1)}%`;
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="growth-trend ${trendClass}">
      ${trendPolyline}
    </svg>
    <span class="growth-percentage ${percentageClass}">${percentage}</span>
  `;
}
