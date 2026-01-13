/* ============================================
   REVENUE CHART - INITIALIZATION
   ============================================ */

// Global variables
let revenueChartInstance = null;
let currentPeriod = 'dag';
let currentYear = '2025';

// Initialize chart on page load
document.addEventListener('DOMContentLoaded', function() {
  initializeRevenueChart();
  attachEventListeners();
});

/* ============================================
   INITIALIZE CHART
   ============================================ */
async function initializeRevenueChart() {
  const canvas = document.getElementById('revenueChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Destroy existing chart if it exists
  if (revenueChartInstance) {
    revenueChartInstance.destroy();
  }
  
  // Show loading state
  showChartLoading();
  
  // Get data for current period and year
  const chartData = await getChartData(currentPeriod, currentYear);
  
  // Hide loading state
  hideChartLoading();
  
  // Create new chart
  revenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.labels,
      datasets: [{
        label: 'Omzet',
        data: chartData.values,
        borderColor: '#9ca3af',              // Gray line color
        backgroundColor: 'transparent',       // No fill under line
        borderWidth: 2,                       // 2px line width
        tension: 0.4,                         // Smooth curve
        pointRadius: 4,                       // 4px dot radius
        pointBackgroundColor: '#ea5d0d',     // Orange dots
        pointBorderColor: '#ea5d0d',         // Orange dot border
        pointHoverRadius: 6,                  // 6px on hover
        pointHoverBackgroundColor: '#ea5d0d', // Orange on hover
        pointHoverBorderColor: '#ffffff',     // White border on hover
        pointHoverBorderWidth: 2              // 2px border on hover
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false                      // Hide legend
        },
        tooltip: {
          backgroundColor: '#ffffff',         // White background
          titleColor: '#111827',              // Dark title
          bodyColor: '#6b7280',               // Gray body text
          borderColor: '#e5e7eb',             // Light gray border
          borderWidth: 1,                     // 1px border
          padding: 12,                        // 12px padding
          displayColors: false,               // Hide color box
          callbacks: {
            label: function(context) {
              // Format value as currency
              const value = context.parsed.y;
              return '€' + value.toLocaleString('nl-NL', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              });
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: '#e5e7eb',                 // Light gray grid lines
            drawBorder: false                 // No border line
          },
          ticks: {
            color: '#9ca3af',                 // Medium gray text
            font: {
              size: 12                        // 12px font size
            }
          }
        },
        y: {
          grid: {
            color: '#e5e7eb',                 // Light gray grid lines
            drawBorder: false                 // No border line
          },
          ticks: {
            color: '#9ca3af',                 // Medium gray text
            font: {
              size: 12                        // 12px font size
            },
            callback: function(value) {
              // Format Y-axis as currency
              return '€' + value.toLocaleString('nl-NL');
            }
          }
        }
      }
    }
  });
}

/* ============================================
   ATTACH EVENT LISTENERS
   ============================================ */
function attachEventListeners() {
  // Period button clicks
  const periodButtons = document.querySelectorAll('.period-btn');
  periodButtons.forEach(button => {
    button.addEventListener('click', function() {
      // Remove active class from all buttons
      periodButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      this.classList.add('active');
      
      // Update current period
      currentPeriod = this.getAttribute('data-period');
      
      // Refresh chart
      initializeRevenueChart();
    });
  });
  
  // Year select change
  const yearSelect = document.getElementById('revenueYearSelect');
  if (yearSelect) {
    yearSelect.addEventListener('change', function() {
      currentYear = this.value;
      
      // Refresh chart
      initializeRevenueChart();
    });
  }
}

/* ============================================
   GET CHART DATA (REAL API CALL)
   ============================================ */
async function getChartData(period, year) {
  try {
    
    
    const response = await fetch(`/admin/api/admin/revenue?period=${period}&year=${year}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    
    // Check if we have valid data
    if (!data || !data.labels || data.labels.length === 0) {
      
      return {
        labels: ['Geen data beschikbaar'],
        values: [0]
      };
    }
    
    return data;
    
  } catch (error) {
    console.error('[Revenue Chart] Error fetching data:', error);
    
    // Return empty data on error
    return {
      labels: [],
      values: []
    };
  }
}

/* ============================================
   LOADING STATE FUNCTIONS
   ============================================ */
function showChartLoading() {
  const canvas = document.getElementById('revenueChart');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw loading text
    ctx.fillStyle = '#9ca3af';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Gegevens laden...', canvas.width / 2, canvas.height / 2);
  }
}

function hideChartLoading() {
  // Loading state is automatically cleared when chart is created
}
