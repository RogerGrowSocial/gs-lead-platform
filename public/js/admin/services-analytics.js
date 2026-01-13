// Services Analytics JavaScript

let currentPeriod = '30d';

document.addEventListener('DOMContentLoaded', function() {
  loadKPIData();
  loadBreakdownData();
  
  // Period selector
  const periodInput = document.querySelector('[name="period"]');
  if (periodInput) {
    periodInput.addEventListener('change', (e) => {
      currentPeriod = e.target.value;
      loadKPIData();
      loadBreakdownData();
    });
  }
});

// Load KPI data (same as main services page)
async function loadKPIData() {
  try {
    const response = await fetch(`/api/admin/services/kpis?period=${currentPeriod}`, {
      credentials: 'same-origin'
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error('Fout bij ophalen KPI data');
    }
    
    const data = result.data;
    
    // Update KPI cards
    const totalRevenueEl = document.getElementById('totalRevenue');
    const totalProfitEl = document.getElementById('totalProfit');
    const weightedMarginEl = document.getElementById('weightedMargin');
    const topServiceEl = document.getElementById('topService');
    const topServiceRevenueEl = document.getElementById('topServiceRevenue');
    
    if (totalRevenueEl) {
      totalRevenueEl.textContent = data.total_revenue_cents !== null 
        ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(data.total_revenue_cents / 100)
        : '—';
    }
    
    if (totalProfitEl) {
      totalProfitEl.textContent = data.total_profit_cents !== null
        ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(data.total_profit_cents / 100)
        : '—';
    }
    
    if (weightedMarginEl) {
      weightedMarginEl.textContent = data.weighted_margin_percent !== null
        ? `${data.weighted_margin_percent.toFixed(1)}%`
        : '—';
    }
    
    if (topServiceEl && data.top_service) {
      topServiceEl.textContent = data.top_service.name || '—';
      if (topServiceRevenueEl) {
        topServiceRevenueEl.textContent = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(data.top_service.revenue_cents / 100);
      }
    } else {
      if (topServiceEl) topServiceEl.textContent = '—';
      if (topServiceRevenueEl) topServiceRevenueEl.textContent = '—';
    }
    
    // Update subtitle
    const periodLabels = {
      '30d': 'Laatste 30 dagen',
      '90d': 'Laatste 90 dagen',
      '365d': 'Laatste jaar'
    };
    const subtitle = periodLabels[currentPeriod] || 'Laatste 30 dagen';
    const revenueSubtitle = document.getElementById('revenueSubtitle');
    if (revenueSubtitle) revenueSubtitle.textContent = subtitle;
    
  } catch (error) {
    console.error('Error loading KPI data:', error);
  }
}

// Load breakdown data
async function loadBreakdownData() {
  try {
    const response = await fetch(`/api/admin/services/analytics?period=${currentPeriod}`, {
      credentials: 'same-origin'
    });
    
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      throw new Error('Fout bij ophalen breakdown data');
    }
    
    const breakdown = result.data || [];
    const tbody = document.getElementById('breakdownTableBody');
    
    if (!tbody) return;
    
    if (breakdown.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 3rem; text-align: center; color: #6b7280;">
            <div style="font-size: 3rem; color: #d1d5db; margin-bottom: 1rem;">
              <i class="fas fa-chart-line"></i>
            </div>
            <p>Geen data beschikbaar voor deze periode</p>
          </td>
        </tr>
      `;
      return;
    }
    
    // Render breakdown table
    tbody.innerHTML = breakdown.map(service => {
      const formatCurrency = (cents) => {
        if (cents === null || cents === undefined) return '—';
        return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100);
      };
      
      const formatPercent = (value) => {
        if (value === null || value === undefined) return '—';
        return `${value.toFixed(1)}%`;
      };
      
      const formatDate = (dateString) => {
        if (!dateString) return '—';
        try {
          const date = new Date(dateString);
          return date.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (e) {
          return '—';
        }
      };
      
      return `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 0.75rem; font-weight: 500; color: #111827;">${escapeHtml(service.service_name)}</td>
          <td style="padding: 0.75rem; text-align: right; color: #111827; font-weight: 500;">${formatCurrency(service.revenue_cents)}</td>
          <td style="padding: 0.75rem; text-align: right; color: #111827;">${formatCurrency(service.profit_cents)}</td>
          <td style="padding: 0.75rem; text-align: right; color: #111827;">${formatPercent(service.margin_percent)}</td>
          <td style="padding: 0.75rem; text-align: right; color: #374151;">${service.sales_count || 0}</td>
          <td style="padding: 0.75rem; text-align: right; color: #374151;">${formatCurrency(service.avg_order_value_cents)}</td>
          <td style="padding: 0.75rem; color: #6b7280; font-size: 0.875rem;">${formatDate(service.last_sold_at)}</td>
        </tr>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading breakdown data:', error);
    const tbody = document.getElementById('breakdownTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding: 3rem; text-align: center; color: #dc2626;">
            <p>Fout bij laden data: ${error.message}</p>
            <button onclick="loadBreakdownData()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #ea5d0d; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Opnieuw proberen
            </button>
          </td>
        </tr>
      `;
    }
  }
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

