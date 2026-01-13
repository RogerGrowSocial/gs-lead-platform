// Lead Engine JavaScript - Tab switching en data rendering

let leadsChart = null;

// Notification system (consistent met rest van platform)
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'info' ? 'info-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    </div>
    <button class="notification-close">
      <i class="fas fa-times"></i>
    </button>
    <div class="notification-progress"></div>
  `;

  let container = document.querySelector('.notification-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'notification-container';
    document.body.appendChild(container);
  }

  container.appendChild(notification);

  // Add close button functionality
  const closeBtn = notification.querySelector('.notification-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      notification.classList.add('closing');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    });
  }

  // Add progress bar animation
  const progressBar = notification.querySelector('.notification-progress');
  if (progressBar) {
    progressBar.style.animation = 'progressShrink 3000ms linear forwards';
    
    // Auto close after 3 seconds
    setTimeout(() => {
      notification.classList.add('closing');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// Create confirmation modal (consistent met rest van platform)
function createConfirmModal(title, message, confirmText = 'Bevestigen', cancelText = 'Annuleren', onConfirm) {
  const modal = document.createElement('div');
  modal.className = 'modal delete-confirm-modal';
  // Ensure confirmation modal appears above progress modal (z-index 10000)
  modal.style.zIndex = '10001';
  modal.innerHTML = `
    <div class="modal-content modal-sm" style="z-index: 10002;">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="delete-warning">
          <i class="fas fa-exclamation-triangle"></i>
          <p>${message}</p>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" id="cancelConfirm">${cancelText}</button>
          <button type="button" class="btn btn-primary" id="confirmAction">${confirmText}</button>
        </div>
      </div>
    </div>
  `;

  // Add event listeners
  const closeModal = () => {
    modal.remove();
    document.body.classList.remove('modal-open');
  };

  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.querySelector('#cancelConfirm').addEventListener('click', closeModal);

  modal.querySelector('#confirmAction').addEventListener('click', () => {
    if (onConfirm) {
      onConfirm();
    }
    closeModal();
  });

  // Show modal
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  modal.style.display = 'flex';

  return modal;
}

// Tab switching logica
document.addEventListener('DOMContentLoaded', function() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  // Get active tab from URL or default to overview
  const urlPath = window.location.pathname;
  let activeTab = 'overview';
  if (urlPath.includes('/segments')) activeTab = 'segments';
  else if (urlPath.includes('/ai-actions')) activeTab = 'ai-actions';
  else if (urlPath.includes('/content')) activeTab = 'content';
  else if (urlPath.includes('/campagnes')) activeTab = 'campagnes';

  // Set initial active tab
  tabButtons.forEach(btn => {
    const btnTab = btn.getAttribute('data-tab');
    if (btnTab === activeTab) {
      btn.classList.add('tab-button-active');
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.classList.remove('tab-button-active');
      btn.setAttribute('aria-selected', 'false');
    }
  });

  tabContents.forEach(content => {
    if (content.id === `${activeTab}-tab-content`) {
      content.classList.add('tab-content-active');
    } else {
      content.classList.remove('tab-content-active');
    }
  });

  // Load initial tab content
  loadTabContent(activeTab);

  // Tab switching - EXACT zoals /admin/leads
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      
      // Update URL without reload
      const basePath = '/admin/leads/engine';
      const tabPaths = {
        'overview': basePath,
        'segments': `${basePath}/segments`,
        'ai-actions': `${basePath}/ai-actions`,
        'content': `${basePath}/content`,
        'campagnes': `${basePath}/campagnes`
      };
      
      if (tabPaths[targetTab] && window.location.pathname !== tabPaths[targetTab]) {
        window.history.pushState({ tab: targetTab }, '', tabPaths[targetTab]);
      }
      
      // Update button states
      tabButtons.forEach(btn => {
        btn.classList.remove('tab-button-active');
        btn.setAttribute('aria-selected', 'false');
      });
      
      // Add active state to clicked button
      this.classList.add('tab-button-active');
      this.setAttribute('aria-selected', 'true');
      
      // Update content visibility
      tabContents.forEach(content => {
        content.classList.remove('tab-content-active');
      });
      
      const targetContent = document.getElementById(`${targetTab}-tab-content`);
      if (targetContent) {
        targetContent.classList.add('tab-content-active');
      }
      
      // Load tab-specific content
      loadTabContent(targetTab);
    });
  });

  // Handle browser back/forward and initial navigation
  function updateActiveTab() {
    const urlPath = window.location.pathname;
    let tab = 'overview';
    if (urlPath.includes('/segments')) tab = 'segments';
    else if (urlPath.includes('/ai-actions')) tab = 'ai-actions';
    else if (urlPath.includes('/content')) tab = 'content';
    else if (urlPath.includes('/campagnes')) tab = 'campagnes';

    tabButtons.forEach(btn => {
      const btnTab = btn.getAttribute('data-tab');
      if (btnTab === tab) {
        btn.classList.add('tab-button-active');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('tab-button-active');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    tabContents.forEach(content => {
      if (content.id === `${tab}-tab-content`) {
        content.classList.add('tab-content-active');
      } else {
        content.classList.remove('tab-content-active');
      }
    });

    loadTabContent(tab);
  }

  window.addEventListener('popstate', updateActiveTab);
  
  // Also update tab when page loads (in case of direct navigation)
  updateActiveTab();

  // Close drawer on ESC key
  document.addEventListener('keydown', function(e) {
    const drawer = document.getElementById('ai-recommendation-drawer');
    if (e.key === 'Escape' && drawer && drawer.classList.contains('show')) {
      closeAiRecommendationDrawer();
    }
  });

  // Initialize AI Recommendations Widget
  initializeAiWidget();

  // Initialize first tab
  const firstTabContent = document.getElementById('overview-tab-content');
  if (firstTabContent) {
    firstTabContent.classList.add('tab-content-active');
  }
  loadTabContent('overview');
});

async function loadTabContent(tab) {
  switch(tab) {
    case 'overview':
      renderOverviewTab();
      break;
    case 'segments':
      await renderSegmentsTab();
      break;
    case 'ai-actions':
      await renderAiActionsTab();
      break;
    case 'content':
      await renderContentBacklogTab();
      break;
    case 'campagnes':
      await renderCampagnesTab();
      break;
  }
}

// Store chart data globally for period filtering
let globalChartData = [];

// Skeleton loader functions - same pattern as payments page
function showKPILoading(tab) {
  const kpiSelectors = {
    'overview': [
      'kpi-leads-today',
      'kpi-leads-week',
      'kpi-spend-today',
      'kpi-cpl-avg'
    ],
    'segments': [
      'kpi-total-partners',
      'kpi-active-partners',
      'kpi-capacity-day',
      'kpi-occupancy'
    ],
    'ai-actions': [
      'kpi-ai-campaigns',
      'kpi-pending-recommendations',
      'kpi-ai-impact'
    ],
    'campagnes': [
      'kpi-active-campaigns',
      'kpi-total-spend',
      'kpi-total-clicks',
      'kpi-avg-cpl'
    ]
  };
  
  // Elements to hide during loading (secondary text)
  const hideDuringLoading = {
    'overview': [
      'kpi-leads-target',
      'kpi-spend-budget'
    ]
  };
  
  const selectors = kpiSelectors[tab] || [];
  selectors.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.tagName !== 'SVG') {
      // Only add loading class to non-SVG elements
      el.classList.add('loading');
      // Clear text content to show skeleton
      if (!el.textContent || el.textContent === '-' || el.textContent === '€-') {
        el.textContent = '';
      }
    }
  });
  
  // Hide secondary text elements during loading
  const hideSelectors = hideDuringLoading[tab] || [];
  hideSelectors.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      // Hide the parent span that contains this element
      const parentSpan = el.closest('span');
      if (parentSpan) {
        parentSpan.style.display = 'none';
        parentSpan.dataset.loadingHidden = 'true';
      }
    }
  });
}

function removeKPILoading(tab) {
  const kpiSelectors = {
    'overview': [
      'kpi-leads-today',
      'kpi-leads-week',
      'kpi-spend-today',
      'kpi-cpl-avg'
    ],
    'segments': [
      'kpi-total-partners',
      'kpi-active-partners',
      'kpi-capacity-day',
      'kpi-occupancy'
    ],
    'ai-actions': [
      'kpi-ai-campaigns',
      'kpi-pending-recommendations',
      'kpi-ai-impact'
    ],
    'campagnes': [
      'kpi-active-campaigns',
      'kpi-total-spend',
      'kpi-total-clicks',
      'kpi-avg-cpl'
    ]
  };
  
  // Elements to show again after loading (secondary text)
  const showAfterLoading = {
    'overview': [
      'kpi-leads-target',
      'kpi-spend-budget'
    ]
  };
  
  const selectors = kpiSelectors[tab] || [];
  selectors.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('loading');
    }
  });
  
  // Show secondary text elements again after loading
  const showSelectors = showAfterLoading[tab] || [];
  showSelectors.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      // Show the parent span that contains this element
      const parentSpan = el.closest('span');
      if (parentSpan && parentSpan.dataset.loadingHidden === 'true') {
        parentSpan.style.display = '';
        delete parentSpan.dataset.loadingHidden;
      }
    }
  });
}

async function renderOverviewTab() {
  // Show skeleton loaders for overview tab KPIs
  showKPILoading('overview');
  // Show chart and table skeleton loaders
  showChartSkeleton();
  showTableSkeleton();
  
  try {
    // Fetch real data from API
    const response = await fetch('/api/admin/leadstroom/overview', {
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch overview data');
    }
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Failed to load data');
    }
    
    const { kpis, chartData, segments } = result.data;
    
    // Store chart data globally for period filtering
    globalChartData = chartData || [];
    
    // Update KPIs
    updateKPIs(kpis);
    
    // Get current period from select (default 30)
    const periodSelect = document.getElementById('chart-period');
    const period = periodSelect ? parseInt(periodSelect.value) || 30 : 30;
    
    // Render chart with current period
    renderChart(globalChartData, period);
    // Hide chart skeleton after rendering
    hideChartSkeleton();
    
    // Render segments table
    renderSegmentsTable(segments);
    // Hide table skeleton after rendering
    hideTableSkeleton();
    
    // Setup period selector change handler
    if (periodSelect) {
      // Remove existing listeners by cloning
      const newSelect = periodSelect.cloneNode(true);
      periodSelect.parentNode.replaceChild(newSelect, periodSelect);
      
      newSelect.addEventListener('change', function() {
        const selectedPeriod = parseInt(this.value) || 30;
        renderChart(globalChartData, selectedPeriod);
      });
    }
    
  } catch (error) {
    console.error('Error loading overview data:', error);
    // Remove loading state even on error
    removeKPILoading('overview');
    hideChartSkeleton();
    hideTableSkeleton();
    // Show error state instead of mock data
    updateKPIs({
      leadsToday: 0,
      leadsTarget: 0,
      leadsWeek: 0,
      spendToday: 0,
      spendBudget: 0,
      avgCpl: 0
    });
    renderChart([]);
    renderSegmentsTable([]);
    
    // Show error message
    const tbody = document.getElementById('segments-table-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-red-500">Fout bij het laden van data. Probeer de pagina te verversen.</td></tr>';
    }
  }
}

// Chart skeleton loader functions
function showChartSkeleton() {
  const skeleton = document.getElementById('chart-skeleton-loader');
  const canvas = document.getElementById('leads-chart');
  if (skeleton) {
    skeleton.style.display = 'flex';
  }
  if (canvas) {
    canvas.style.opacity = '0';
  }
}

function hideChartSkeleton() {
  const skeleton = document.getElementById('chart-skeleton-loader');
  const canvas = document.getElementById('leads-chart');
  if (skeleton) {
    skeleton.style.display = 'none';
  }
  if (canvas) {
    canvas.style.opacity = '1';
    canvas.style.transition = 'opacity 0.3s ease';
  }
}

// Store column widths per table
const tableColumnWidths = new Map();

// Helper function to fix column widths based on real data
function fixTableColumnWidths(tableId, skeletonId) {
  const table = document.querySelector(`#${tableId}`)?.closest('table') || 
                document.querySelector(`table:has(#${tableId})`);
  const tbody = document.getElementById(tableId);
  const skeleton = document.getElementById(skeletonId);
  
  if (!table || !tbody) return;
  
  // Show real data first to measure
  tbody.style.display = 'table-row-group';
  tbody.style.visibility = 'visible';
  
  // Get column widths from real data
  requestAnimationFrame(() => {
    const firstRow = tbody.querySelector('tr');
    if (firstRow) {
      const cells = firstRow.querySelectorAll('td');
      const headerCells = table.querySelectorAll('thead th');
      const widths = [];
      
      // Apply real data column widths to headers to lock them in place
      cells.forEach((cell, index) => {
        if (headerCells[index]) {
          const width = cell.offsetWidth;
          if (width > 0) {
            widths.push(width);
            headerCells[index].style.width = width + 'px';
            headerCells[index].style.minWidth = width + 'px';
            headerCells[index].style.maxWidth = width + 'px';
          }
        }
      });
      
      // Store widths for future skeleton loads
      if (widths.length > 0) {
        tableColumnWidths.set(tableId, widths);
      }
    }
    
    // Now hide skeleton
    if (skeleton) {
      skeleton.style.display = 'none';
    }
  });
}

// Apply stored column widths to skeleton
function applyStoredColumnWidths(tableId, skeletonId) {
  const widths = tableColumnWidths.get(tableId);
  if (!widths) return;
  
  const table = document.querySelector(`#${tableId}`)?.closest('table') || 
                document.querySelector(`table:has(#${tableId})`);
  const skeleton = document.getElementById(skeletonId);
  
  if (!table || !skeleton) return;
  
  const headerCells = table.querySelectorAll('thead th');
  const skeletonRows = skeleton.querySelectorAll('tr');
  
  widths.forEach((width, index) => {
    if (headerCells[index]) {
      headerCells[index].style.width = width + 'px';
      headerCells[index].style.minWidth = width + 'px';
      headerCells[index].style.maxWidth = width + 'px';
    }
    
    skeletonRows.forEach(row => {
      const skeletonCell = row.querySelectorAll('td')[index];
      if (skeletonCell) {
        skeletonCell.style.width = width + 'px';
        skeletonCell.style.minWidth = width + 'px';
        skeletonCell.style.maxWidth = width + 'px';
      }
    });
  });
}

// Table skeleton loader functions
function showTableSkeleton() {
  const skeleton = document.getElementById('segments-table-skeleton');
  const tbody = document.getElementById('segments-table-body');
  
  if (skeleton) {
    // Generate skeleton rows (double amount)
    const skeletonRows = Array.from({ length: 10 }, () => `
      <tr class="table-skeleton-row">
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
      </tr>
    `).join('');
    skeleton.innerHTML = skeletonRows;
    skeleton.style.display = 'table-row-group';
    
    // Apply stored column widths if available
    requestAnimationFrame(() => {
      applyStoredColumnWidths('segments-table-body', 'segments-table-skeleton');
    });
  }
  
  if (tbody) {
    // Keep table structure to prevent header jump
    tbody.style.visibility = 'hidden';
    tbody.style.display = 'table-row-group';
  }
}

function hideTableSkeleton() {
  fixTableColumnWidths('segments-table-body', 'segments-table-skeleton');
}

function updateKPIs(kpis) {
  // Remove loading state from overview tab KPIs
  removeKPILoading('overview');
  
  // Update KPI cards
  const leadsTodayEl = document.getElementById('kpi-leads-today');
  const leadsTargetEl = document.getElementById('kpi-leads-target');
  const leadsStatusEl = document.getElementById('kpi-leads-status');
  const leadsWeekEl = document.getElementById('kpi-leads-week');
  const spendTodayEl = document.getElementById('kpi-spend-today');
  const spendBudgetEl = document.getElementById('kpi-spend-budget');
  const spendProgressEl = document.getElementById('kpi-spend-progress');
  const cplAvgEl = document.getElementById('kpi-cpl-avg');
  
  if (leadsTodayEl) {
    leadsTodayEl.textContent = kpis.leadsToday ?? 0;
    leadsTodayEl.classList.remove('loading');
  }
  if (leadsTargetEl) {
    leadsTargetEl.textContent = kpis.leadsTarget ?? 0;
    leadsTargetEl.classList.remove('loading');
  }
  if (leadsWeekEl) {
    leadsWeekEl.textContent = kpis.leadsWeek ?? 0;
    leadsWeekEl.classList.remove('loading');
  }
  if (spendTodayEl) {
    spendTodayEl.textContent = `€${(kpis.spendToday ?? 0).toFixed(2)}`;
    spendTodayEl.classList.remove('loading');
  }
  if (spendBudgetEl) {
    spendBudgetEl.textContent = `€${(kpis.spendBudget ?? 2000).toFixed(2)}`;
    spendBudgetEl.classList.remove('loading');
  }
  if (cplAvgEl) {
    cplAvgEl.textContent = `€${(kpis.avgCpl ?? 0).toFixed(2)}`;
    cplAvgEl.classList.remove('loading');
  }
  
  // Update week average indicator
  const leadsWeekAvgEl = document.getElementById('kpi-leads-week-avg');
  if (leadsWeekAvgEl && kpis.leadsWeek !== undefined) {
    const avgPerDay = kpis.leadsWeek > 0 ? (kpis.leadsWeek / 7).toFixed(1) : 0;
    leadsWeekAvgEl.textContent = `≈ ${avgPerDay} per dag`;
  }
  
  // Update status badge
  if (leadsStatusEl) {
    const gap = (kpis.leadsTarget ?? 0) - (kpis.leadsToday ?? 0);
    if (gap > 5) {
      leadsStatusEl.textContent = 'Onder target';
      leadsStatusEl.className = 'inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700';
    } else if (gap < -5) {
      leadsStatusEl.textContent = 'Overtarget';
      leadsStatusEl.className = 'inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700';
    } else {
      leadsStatusEl.textContent = 'In balans';
      leadsStatusEl.className = 'inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800';
    }
  }
  
  // Update spend progress bar
  if (spendProgressEl) {
    if (kpis.spendBudget && kpis.spendBudget > 0) {
      const percentage = Math.min(100, ((kpis.spendToday ?? 0) / kpis.spendBudget) * 100);
      spendProgressEl.style.width = `${percentage}%`;
    } else {
      spendProgressEl.style.width = '0%';
    }
  }
}

function renderChart(chartData, period = 30) {
  const ctx = document.getElementById('leads-chart');
  if (!ctx) return;
  
  // Destroy existing chart if it exists
  if (leadsChart) {
    leadsChart.destroy();
  }
  
  // Filter data by period
  let filteredData = chartData || [];
  if (period && chartData && chartData.length > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - period);
    cutoffDate.setHours(0, 0, 0, 0);
    filteredData = chartData.filter(d => {
      // Handle both date string and Date object
      const dateStr = d.date instanceof Date ? d.date.toISOString().split('T')[0] : d.date;
      const date = new Date(dateStr + 'T00:00:00');
      return date >= cutoffDate;
    });
  }
  
  // Handle empty data
  if (!filteredData || filteredData.length === 0) {
    // Show empty chart with message
    leadsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            enabled: true
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
    return;
  }
  
  // Prepare data
  const labels = filteredData.map(d => {
    // Handle both date string and Date object
    const date = d.date instanceof Date ? d.date : new Date(d.date + 'T00:00:00');
    return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' });
  });
  const leadsData = filteredData.map(d => d.leads_generated || 0);
  const targetsData = filteredData.map(d => d.target_leads_per_day || 0);
  
  leadsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Leads',
          data: leadsData,
          borderColor: '#111827',
          backgroundColor: 'rgba(17, 24, 39, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: false
        },
        {
          label: 'Target',
          data: targetsData,
          borderColor: '#6b7280',
          backgroundColor: 'rgba(107, 114, 128, 0.1)',
          borderDash: [5, 5],
          borderWidth: 2,
          tension: 0.4,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            padding: 15
          }
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          display: true,
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        }
      }
    }
  });
}

function renderSegmentsTable(segments) {
  const tbody = document.getElementById('segments-table-body');
  if (!tbody) return;
  
  if (!segments || segments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-gray-500">Geen segmenten gevonden</td></tr>';
    return;
  }
  
  tbody.innerHTML = segments.map(segment => {
    const plan = segment.lead_segment_plans?.[0] || {};
    const target = plan.target_leads_per_day || 0;
    const actual = segment.leads_generated || 0;
    const gap = plan.lead_gap || (target - actual);
    const status = gap > 5 ? 'onder' : gap < -5 ? 'over' : 'balans';
    const partners = segment.partner_count || 0;
    
    const segmentLabel = `${segment.branch || 'Onbekend'} • ${segment.region || 'Onbekend'}`;
    
    return `
    <tr class="hover:bg-gray-50">
      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${segmentLabel}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${segment.branch || '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${segment.region || '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${target}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${actual}</td>
      <td class="px-6 py-4 whitespace-nowrap text-sm ${gap < 0 ? 'text-red-600' : gap > 0 ? 'text-green-600' : 'text-gray-900'}">${gap > 0 ? '+' : ''}${gap}</td>
      <td class="px-6 py-4 whitespace-nowrap">
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(status)}">
          ${getStatusLabel(status)}
        </span>
      </td>
      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${partners}</td>
      <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
        <button 
          onclick="event.stopPropagation(); event.preventDefault(); showSegmentActionsMenu('${segment.id}', event)" 
          class="actions-button"
          title="Acties"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="5" r="1"/>
            <circle cx="12" cy="12" r="1"/>
            <circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </td>
    </tr>
    `;
  }).join('');
}

async function renderSegmentsTab() {
  // Load segments tab HTML content
  const placeholder = document.getElementById('segments-content-placeholder');
  if (placeholder && !placeholder.dataset.loaded) {
    loadTabHTML('segments', placeholder);
    placeholder.dataset.loaded = 'true';
  }
  
  // Show skeleton loaders for segments tab KPIs
  showKPILoading('segments');
  // Show skeleton loaders for insight cards
  showInsightCardsSkeleton();
  // Show skeleton loader for capacity table
  showCapacityTableSkeleton();
  
  try {
    // Fetch real data from API
    const response = await fetch('/api/admin/leadstroom/segments', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch segments data');
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('Invalid response format');
    }
    
    const { segments, kpis, lowCapacitySegments, topPerformers } = result.data;
    
    // Remove loading state from segments tab KPIs
    removeKPILoading('segments');
    
    // Update KPIs
    const totalPartnersEl = document.getElementById('kpi-total-partners');
    if (totalPartnersEl) {
      totalPartnersEl.textContent = kpis.totalPartners || 0;
      totalPartnersEl.classList.remove('loading');
    }
    
    const activePartnersEl = document.getElementById('kpi-active-partners');
    if (activePartnersEl) {
      activePartnersEl.textContent = kpis.activePartners || 0;
      activePartnersEl.classList.remove('loading');
    }
    
    const capacityDayEl = document.getElementById('kpi-capacity-day');
    if (capacityDayEl) {
      capacityDayEl.textContent = kpis.capacityPerDay || 0;
      capacityDayEl.classList.remove('loading');
    }
    
    const occupancyEl = document.getElementById('kpi-occupancy');
    const occupancyBarEl = document.getElementById('kpi-occupancy-bar');
    if (occupancyEl) {
      occupancyEl.textContent = `${kpis.occupancy || 0}%`;
      occupancyEl.classList.remove('loading');
    }
    if (occupancyBarEl) occupancyBarEl.style.width = `${kpis.occupancy || 0}%`;
    
    // Hide capacity table skeleton
    hideCapacityTableSkeleton();
    
    // Render capacity table
    const tbody = document.getElementById('capacity-table-body');
    if (tbody) {
      if (segments && segments.length > 0) {
        tbody.innerHTML = segments.map(item => `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${item.segmentLabel}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${item.partners}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${item.capacityPerDay}</td>
            <td class="px-6 py-4">
              <div class="flex items-center">
                <div class="w-16 h-2 bg-gray-100 rounded-full mr-2">
                  <div class="h-2 bg-gray-900 rounded-full" style="width: ${item.occupancy}%"></div>
                </div>
                <span class="text-sm text-gray-700">${item.occupancy}%</span>
              </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">${item.avgResponseTime}</td>
            <td class="px-6 py-4 text-sm text-gray-700">${item.conversionRate}%</td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Geen segmenten gevonden</td></tr>';
      }
    }
    
    // Hide insight cards skeleton
    hideInsightCardsSkeleton();
    
    // Render low capacity insights
    const lowCapContainer = document.getElementById('low-capacity-segments');
    if (lowCapContainer) {
      if (lowCapacitySegments && lowCapacitySegments.length > 0) {
        lowCapContainer.innerHTML = lowCapacitySegments.map(item => `
          <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <div>
              <p class="text-sm font-medium text-gray-900">${item.segment}</p>
              <p class="text-xs text-gray-500">${item.partners} partners</p>
            </div>
            <span class="text-sm font-semibold text-gray-900">${item.occupancy}%</span>
          </div>
        `).join('');
      } else {
        lowCapContainer.innerHTML = '<p class="text-sm text-gray-500">Geen segmenten met lage capaciteit</p>';
      }
    }
    
    // Render top performers
    const topPerfContainer = document.getElementById('top-performers');
    if (topPerfContainer) {
      if (topPerformers && topPerformers.length > 0) {
        topPerfContainer.innerHTML = topPerformers.map(item => `
          <div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <div>
              <p class="text-sm font-medium text-gray-900">${item.segment}</p>
              <p class="text-xs text-gray-500">${item.leads} leads (7d)</p>
            </div>
            <span class="text-sm font-semibold text-gray-900">${item.conversionRate}%</span>
          </div>
        `).join('');
      } else {
        topPerfContainer.innerHTML = '<p class="text-sm text-gray-500">Geen top performers gevonden</p>';
      }
    }
  } catch (error) {
    console.error('Error rendering segments tab:', error);
    // Remove loading state even on error
    removeKPILoading('segments');
    hideInsightCardsSkeleton();
    hideCapacityTableSkeleton();
    // Fallback to empty state or error message
    const tbody = document.getElementById('capacity-table-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Fout bij laden van data</td></tr>';
    }
  }
}

// Capacity table skeleton loader functions
function showCapacityTableSkeleton() {
  const skeleton = document.getElementById('capacity-table-skeleton');
  const tbody = document.getElementById('capacity-table-body');
  
  if (skeleton) {
    // Generate skeleton rows (6 columns for capacity table, double amount)
    const skeletonRows = Array.from({ length: 10 }, () => `
      <tr class="table-skeleton-row">
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
      </tr>
    `).join('');
    skeleton.innerHTML = skeletonRows;
    skeleton.style.display = 'table-row-group';
    
    // Apply stored column widths if available
    requestAnimationFrame(() => {
      applyStoredColumnWidths('capacity-table-body', 'capacity-table-skeleton');
    });
  }
  
  if (tbody) {
    // Keep table structure to prevent header jump
    tbody.style.visibility = 'hidden';
    tbody.style.display = 'table-row-group';
  }
}

function hideCapacityTableSkeleton() {
  fixTableColumnWidths('capacity-table-body', 'capacity-table-skeleton');
}

// Insight cards skeleton loader functions
function showInsightCardsSkeleton() {
  const lowCapSkeleton = document.getElementById('low-capacity-segments-skeleton');
  const topPerfSkeleton = document.getElementById('top-performers-skeleton');
  const lowCapContainer = document.getElementById('low-capacity-segments');
  const topPerfContainer = document.getElementById('top-performers');
  
  // Generate skeleton items
  const skeletonItems = Array.from({ length: 4 }, () => `
    <div class="insight-skeleton-item">
      <div class="insight-skeleton-item-left">
        <div class="insight-skeleton-item-title"></div>
        <div class="insight-skeleton-item-subtitle"></div>
      </div>
      <div class="insight-skeleton-item-value"></div>
    </div>
  `).join('');
  
  if (lowCapSkeleton) {
    lowCapSkeleton.innerHTML = skeletonItems;
    lowCapSkeleton.style.display = 'block';
  }
  if (topPerfSkeleton) {
    topPerfSkeleton.innerHTML = skeletonItems;
    topPerfSkeleton.style.display = 'block';
  }
  
  if (lowCapContainer) {
    lowCapContainer.style.display = 'none';
  }
  if (topPerfContainer) {
    topPerfContainer.style.display = 'none';
  }
}

function hideInsightCardsSkeleton() {
  const lowCapSkeleton = document.getElementById('low-capacity-segments-skeleton');
  const topPerfSkeleton = document.getElementById('top-performers-skeleton');
  const lowCapContainer = document.getElementById('low-capacity-segments');
  const topPerfContainer = document.getElementById('top-performers');
  
  if (lowCapSkeleton) {
    lowCapSkeleton.style.display = 'none';
  }
  if (topPerfSkeleton) {
    topPerfSkeleton.style.display = 'none';
  }
  
  if (lowCapContainer) {
    lowCapContainer.style.display = 'block';
  }
  if (topPerfContainer) {
    topPerfContainer.style.display = 'block';
  }
}

async function renderAiActionsTab() {
  // Load AI actions tab HTML content
  const placeholder = document.getElementById('ai-actions-content-placeholder');
  if (placeholder && !placeholder.dataset.loaded) {
    loadTabHTML('ai-actions', placeholder);
    placeholder.dataset.loaded = 'true';
  }
  
  // Setup generate recommendations button
  setupGenerateRecommendationsButton();
  
  // Show skeleton loaders for AI actions tab KPIs
  showKPILoading('ai-actions');
  // Show skeleton loader for AI recommendations table
  showAiRecommendationsTableSkeleton();
  
  try {
    // Fetch real data from API
    const response = await fetch('/api/admin/leadstroom/ai-actions', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch AI actions data');
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('Invalid response format');
    }
    
    const { recommendations, kpis } = result.data;
    
    // Remove loading state from AI actions tab KPIs
    removeKPILoading('ai-actions');
    
    // Update KPIs
    const aiCampaignsEl = document.getElementById('kpi-ai-campaigns');
    if (aiCampaignsEl) {
      aiCampaignsEl.textContent = kpis.activeCampaigns || 0;
      aiCampaignsEl.classList.remove('loading');
    }
    
    const pendingRecsEl = document.getElementById('kpi-pending-recommendations');
    if (pendingRecsEl) {
      pendingRecsEl.textContent = kpis.pendingRecommendations || 0;
      pendingRecsEl.classList.remove('loading');
    }
    
    const aiImpactEl = document.getElementById('kpi-ai-impact');
    if (aiImpactEl) {
      aiImpactEl.textContent = kpis.impact || '+0%';
      aiImpactEl.classList.remove('loading');
    }
    
    // Hide AI recommendations table skeleton
    hideAiRecommendationsTableSkeleton();
    
    // Render recommendations table
    const tbody = document.getElementById('ai-recommendations-table-body');
    if (tbody) {
      if (recommendations && recommendations.length > 0) {
        // Store recommendations for sorting
        window.aiRecommendationsData = recommendations;
        
        tbody.innerHTML = recommendations.map(rec => {
          // Determine action type label
          const actionType = rec.actionType || rec.action_type || '';
          const actionTypeLabel = {
            'create_landing_page': 'Landingspagina',
            'publish_landing_page': 'Landingspagina',
            'create_campaign': 'Campagne',
            'increase_campaign_budget': 'Campagne'
          }[actionType] || 'Onbekend';
          
          // Determine badge color based on action type
          const actionTypeBadgeClass = actionTypeLabel === 'Campagne' 
            ? 'bg-blue-100 text-blue-800' 
            : actionTypeLabel === 'Landingspagina'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-gray-100 text-gray-800';
          
          // Format recommendation text with segment
          // Example: "Nieuwe landingspagina voor Schilders Gelderland"
          let recommendationText = rec.summary || '';
          
          // Remove parentheses content (e.g., "(glaszetter_friesland)") from recommendation text
          recommendationText = recommendationText.replace(/\s*\([^)]*\)\s*/g, '').trim();
          
          // If summary doesn't include segment, add it
          if (rec.segmentLabel && !recommendationText.toLowerCase().includes(rec.segmentLabel.toLowerCase().split(' • ')[0])) {
            // Extract branch and region from segmentLabel (format: "Branch • Region")
            const segmentParts = rec.segmentLabel.split(' • ');
            const branch = segmentParts[0] || '';
            const region = segmentParts[1] || '';
            
            // Format: "Nieuwe [type] voor [Branch] [Region]"
            if (actionType === 'create_landing_page') {
              recommendationText = `Nieuwe landingspagina voor ${branch} ${region}`;
            } else if (actionType === 'create_campaign') {
              recommendationText = `Nieuwe Google Ads campagne: ${branch} - ${region}`;
            } else if (actionType === 'publish_landing_page') {
              recommendationText = `Publiceer landingspagina voor ${branch} ${region}`;
            } else if (actionType === 'increase_campaign_budget') {
              recommendationText = `Verhoog campagne budget voor ${branch} ${region}`;
            } else {
              recommendationText = `${recommendationText} voor ${rec.segmentLabel}`;
            }
          }
          
          const statusText = rec.status || 'pending';
          
          // More minimalistic badge for landingspagina
          const typeBadgeClass = actionTypeLabel === 'Campagne' 
            ? 'bg-blue-100 text-blue-800' 
            : actionTypeLabel === 'Landingspagina'
            ? 'bg-gray-100 text-gray-700 border border-gray-300'
            : 'bg-gray-100 text-gray-800';
          
          return `
          <tr 
            class="hover:bg-gray-50 cursor-pointer" 
            onclick="openAiRecommendationModal('${rec.id}')"
            data-segment="${escapeHtml(rec.segmentLabel)}" 
            data-type="${actionTypeLabel}" 
            data-impact="${rec.impact}" 
            data-status="${statusText}" 
            data-updated="${rec.lastUpdated}"
          >
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${rec.segmentLabel}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeBadgeClass}">
                  ${actionTypeLabel}
                </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-700">
                <span>${escapeHtml(recommendationText)}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getImpactBadgeClass(rec.impact)}">
                ${rec.impact}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAiStatusBadgeClass(statusText)}">
                ${statusText}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${rec.lastUpdated}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
              <button 
                onclick="event.stopPropagation(); event.preventDefault(); showAiRecommendationActionsMenu('${rec.id}', '${rec.status || 'pending'}', event)" 
                class="actions-button"
                title="Acties"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="5" r="1"/>
                  <circle cx="12" cy="12" r="1"/>
                  <circle cx="12" cy="19" r="1"/>
                </svg>
              </button>
            </td>
          </tr>
        `;
        }).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">Geen aanbevelingen gevonden</td></tr>';
      }
    }
    
    // Setup sorting functionality after table is rendered
    setTimeout(() => {
      setupAiRecommendationsTableSorting();
    }, 100);
  } catch (error) {
    console.error('Error rendering AI actions tab:', error);
    // Remove loading state even on error
    removeKPILoading('ai-actions');
    hideAiRecommendationsTableSkeleton();
    const tbody = document.getElementById('ai-recommendations-table-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">Fout bij laden van data</td></tr>';
    }
  }
}

// AI recommendations table skeleton loader functions
function showAiRecommendationsTableSkeleton() {
  const skeleton = document.getElementById('ai-recommendations-table-skeleton');
  const tbody = document.getElementById('ai-recommendations-table-body');
  
  if (skeleton) {
    // Generate skeleton rows (7 columns for AI recommendations table, double amount)
    const skeletonRows = Array.from({ length: 10 }, () => `
      <tr class="table-skeleton-row">
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
      </tr>
    `).join('');
    skeleton.innerHTML = skeletonRows;
    skeleton.style.display = 'table-row-group';
    
    // Apply stored column widths if available
    requestAnimationFrame(() => {
      applyStoredColumnWidths('ai-recommendations-table-body', 'ai-recommendations-table-skeleton');
    });
  }
  
  if (tbody) {
    // Keep table structure to prevent header jump
    tbody.style.visibility = 'hidden';
    tbody.style.display = 'table-row-group';
  }
}

function hideAiRecommendationsTableSkeleton() {
  fixTableColumnWidths('ai-recommendations-table-body', 'ai-recommendations-table-skeleton');
}

// Table sorting state
let aiRecommendationsSortState = {
  column: null,
  direction: 'asc'
};

function setupAiRecommendationsTableSorting() {
  const sortableHeaders = document.querySelectorAll('.sortable-header');
  
  sortableHeaders.forEach(header => {
    header.style.cursor = 'pointer';
    header.style.userSelect = 'none';
    header.addEventListener('click', () => {
      const sortColumn = header.getAttribute('data-sort');
      sortAiRecommendationsTable(sortColumn);
    });
  });
}

function sortAiRecommendationsTable(column) {
  const tbody = document.getElementById('ai-recommendations-table-body');
  if (!tbody) return;
  
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length === 0) return;
  
  // Toggle sort direction if clicking same column
  if (aiRecommendationsSortState.column === column) {
    aiRecommendationsSortState.direction = aiRecommendationsSortState.direction === 'asc' ? 'desc' : 'asc';
  } else {
    aiRecommendationsSortState.column = column;
    aiRecommendationsSortState.direction = 'asc';
  }
  
  // Sort rows
  rows.sort((a, b) => {
    let aValue, bValue;
    
    switch(column) {
      case 'segment':
        aValue = a.getAttribute('data-segment') || '';
        bValue = b.getAttribute('data-segment') || '';
        break;
      case 'type':
        aValue = a.getAttribute('data-type') || '';
        bValue = b.getAttribute('data-type') || '';
        break;
      case 'recommendation':
        // Get text from the recommendation cell (3rd column, index 2)
        const aRecCell = a.querySelectorAll('td')[2];
        const bRecCell = b.querySelectorAll('td')[2];
        aValue = aRecCell ? aRecCell.textContent.trim() : '';
        bValue = bRecCell ? bRecCell.textContent.trim() : '';
        break;
      case 'impact':
        const impactOrder = { 'Hoog': 3, 'Medium': 2, 'Laag': 1 };
        aValue = impactOrder[a.getAttribute('data-impact')] || 0;
        bValue = impactOrder[b.getAttribute('data-impact')] || 0;
        break;
      case 'status':
        aValue = a.getAttribute('data-status') || '';
        bValue = b.getAttribute('data-status') || '';
        break;
      case 'updated':
        aValue = a.getAttribute('data-updated') || '';
        bValue = b.getAttribute('data-updated') || '';
        break;
      default:
        return 0;
    }
    
    // Compare values
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return aiRecommendationsSortState.direction === 'asc' ? comparison : -comparison;
    } else {
      const comparison = aValue - bValue;
      return aiRecommendationsSortState.direction === 'asc' ? comparison : -comparison;
    }
  });
  
  // Clear tbody and re-append sorted rows
  tbody.innerHTML = '';
  rows.forEach(row => tbody.appendChild(row));
  
  // Update sort icons
  updateSortIcons(column);
}

function updateSortIcons(activeColumn) {
  const sortableHeaders = document.querySelectorAll('.sortable-header');
  
  sortableHeaders.forEach(header => {
    const icon = header.querySelector('.sort-icon');
    const column = header.getAttribute('data-sort');
    
    if (icon) {
      if (column === activeColumn) {
        // Show active sort direction
        icon.style.opacity = '1';
        icon.style.transform = aiRecommendationsSortState.direction === 'asc' ? 'rotate(0deg)' : 'rotate(180deg)';
        icon.style.color = '#6366f1';
      } else {
        // Show inactive state
        icon.style.opacity = '0.3';
        icon.style.transform = 'rotate(0deg)';
        icon.style.color = '#6b7280';
      }
    }
  });
}

async function renderContentBacklogTab() {
  // Load content backlog tab HTML content
  const placeholder = document.getElementById('content-backlog-content-placeholder');
  if (placeholder && !placeholder.dataset.loaded) {
    loadTabHTML('content-backlog', placeholder);
    placeholder.dataset.loaded = 'true';
  }
  
  // Setup test landing page button
  setupTestLandingPageButton();
  
  // Setup regenerate recommendations button
  setupRegenerateRecommendationsButton();
  
  // Setup filters
  setupContentBacklogFilters();
  
  // Show skeleton loader for backlog table
  showBacklogTableSkeleton();
  
  try {
    // Get filter values
    const segmentFilter = document.getElementById('filter-segment')?.value || '';
    const typeFilter = document.getElementById('filter-type')?.value || '';
    const statusFilter = document.getElementById('filter-status')?.value || '';
    
    // Build query string
    const params = new URLSearchParams();
    if (segmentFilter) params.append('segment', segmentFilter);
    if (typeFilter) params.append('type', typeFilter);
    if (statusFilter) params.append('status', statusFilter);
    
    // Fetch real data from API
    const response = await fetch(`/api/admin/leadstroom/content-backlog?${params.toString()}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch content backlog data');
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('Invalid response format');
    }
    
    const contentItems = result.data;
    
    // Hide backlog table skeleton
    hideBacklogTableSkeleton();
    
    // Render table
    const tbody = document.getElementById('backlog-table-body');
    if (tbody) {
      if (contentItems && contentItems.length > 0) {
        tbody.innerHTML = contentItems.map(item => `
          <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                ${item.type}
              </span>
            </td>
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${item.title}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${item.segment}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${item.channel}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getContentStatusBadgeClass(item.status)}">
                ${item.status}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.lastUpdated}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
              <button 
                class="actions-button" 
                onclick="event.stopPropagation(); event.preventDefault(); showBacklogActionsMenu('${item.id || item.recommendationId || ''}', '${item.path || ''}', '${item.recommendationId || ''}', event)" 
                title="Meer acties"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </button>
            </td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">Geen content items gevonden</td></tr>';
      }
    }
  } catch (error) {
    console.error('Error rendering content backlog tab:', error);
    hideBacklogTableSkeleton();
    const tbody = document.getElementById('backlog-table-body');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">Fout bij laden van data</td></tr>';
    }
  }
}

// Backlog table skeleton loader functions
function showBacklogTableSkeleton() {
  const skeleton = document.getElementById('backlog-table-skeleton');
  const tbody = document.getElementById('backlog-table-body');
  
  if (skeleton) {
    // Generate skeleton rows (7 columns for backlog table, double amount)
    const skeletonRows = Array.from({ length: 10 }, () => `
      <tr class="table-skeleton-row">
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
        <td class="table-skeleton-cell"><div></div></td>
      </tr>
    `).join('');
    skeleton.innerHTML = skeletonRows;
    skeleton.style.display = 'table-row-group';
    
    // Apply stored column widths if available
    requestAnimationFrame(() => {
      applyStoredColumnWidths('backlog-table-body', 'backlog-table-skeleton');
    });
  }
  
  if (tbody) {
    // Keep table structure to prevent header jump
    tbody.style.visibility = 'hidden';
    tbody.style.display = 'table-row-group';
  }
}

function hideBacklogTableSkeleton() {
  fixTableColumnWidths('backlog-table-body', 'backlog-table-skeleton');
}

function setupContentBacklogFilters() {
  const segmentFilter = document.getElementById('filter-segment');
  const typeFilter = document.getElementById('filter-type');
  const statusFilter = document.getElementById('filter-status');
  
  const applyFilters = () => {
    renderContentBacklogTab();
  };
  
  if (segmentFilter) segmentFilter.addEventListener('change', applyFilters);
  if (typeFilter) typeFilter.addEventListener('change', applyFilters);
  if (statusFilter) statusFilter.addEventListener('change', applyFilters);
}

async function approveRecommendation(recId, actionType = null) {
  try {
    // Try to get actionType from backlog data if not provided
    if (!actionType) {
      // Check if we can find it in the current backlog items
      const backlogItems = document.querySelectorAll('[data-recommendation-id]');
      for (const item of backlogItems) {
        const itemRecId = item.getAttribute('data-recommendation-id');
        if (itemRecId === recId.toString()) {
          const itemActionType = item.getAttribute('data-action-type');
          if (itemActionType) {
            actionType = itemActionType;
            break;
          }
        }
      }
    }
    
    // Show progress modal for campaign creation BEFORE making the approve request
    if (actionType === 'create_campaign') {
      console.log('Showing progress modal for campaign creation:', recId);
      showProgressModal(recId, actionType);
    }
    
    const response = await fetch(`/api/marketing-recommendations/${recId}/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to approve recommendation');
    }
    
    const result = await response.json();
    
    if (result.success) {
      // For campaign creation, the progress modal will handle the success notification
      // For other actions, show notification immediately
      if (actionType !== 'create_campaign') {
        if (window.showNotification) {
          window.showNotification('Aanbeveling goedgekeurd en uitgevoerd!', 'success');
        }
      }
      // Reload content backlog
      renderContentBacklogTab();
      // IMPORTANT: Also refresh the AI widget in the top right corner
      if (typeof loadAiWidgetRecommendations === 'function') {
        await loadAiWidgetRecommendations();
      }
    } else {
      throw new Error(result.error || 'Failed to approve recommendation');
    }
  } catch (error) {
    console.error('Error approving recommendation:', error);
    
    // Update progress modal with error if it exists
    const modal = document.getElementById('campaign-progress-modal');
    if (modal) {
      updateProgressModal({
        step: 'error',
        message: `Fout: ${error.message}`,
        percentage: 0,
        status: 'error'
      });
    } else {
      // Only show notification if modal is not open
      if (window.showNotification) {
        window.showNotification('Fout bij goedkeuren: ' + error.message, 'error');
      }
    }
  }
}

async function showBacklogActionsMenu(itemId, itemPath, recommendationId, event) {
  // Remove any existing dropdown
  const existingDropdown = document.querySelector('.actions-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
    return; // Exit early if we just closed a dropdown
  }
  
  // Fetch recommendation data if we have a recommendationId
  let recommendationData = null;
  if (recommendationId) {
    try {
      const response = await fetch(`/api/admin/leadstroom/content-backlog?recommendationId=${recommendationId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          recommendationData = result.data.find(item => item.recommendationId === recommendationId);
        }
      }
    } catch (error) {
      console.error('Error fetching recommendation data:', error);
    }
  }

  // Create dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'actions-dropdown';
  dropdown.style.cssText = `
    position: fixed;
    background: white;
    border: 0.5px solid #e5e7eb;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    min-width: 200px;
    padding: 4px 0;
  `;
  
  // Add menu items
  const menuItems = [];
  
  // Bekijken - show preview
  if (itemPath) {
    // If there's a path, open it directly
    menuItems.push({
      label: 'Bekijken',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      action: () => {
        window.open(itemPath, '_blank');
        dropdown.remove();
      }
    });
  } else if (recommendationId) {
    // If there's a recommendationId, show concept preview
    menuItems.push({
      label: 'Bekijken',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      action: async () => {
        dropdown.remove();
        try {
          // Open preview in new tab
          const previewUrl = `/api/admin/landing-pages/preview/${recommendationId}`;
          window.open(previewUrl, '_blank');
        } catch (error) {
          console.error('Error opening preview:', error);
          if (window.showNotification) {
            window.showNotification('Fout bij openen preview: ' + error.message, 'error');
          }
        }
      }
    });
  } else if (itemId) {
    menuItems.push({
      label: 'Bekijken',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      action: () => {
        if (typeof openContentItemModal === 'function') {
          openContentItemModal(itemId);
        }
        dropdown.remove();
      }
    });
  }
  
  // Goedkeuren - only if there's a recommendationId
  if (recommendationId) {
    const actionType = recommendationData?.action_type || recommendationData?.actionType || null;
    menuItems.push({
      label: 'Goedkeuren',
      icon: 'M20 6L9 17l-5-5',
      action: () => {
        approveRecommendation(recommendationId, actionType);
        dropdown.remove();
      }
    });
  }
  
  // Hergenereren
  menuItems.push({
    label: 'Hergenereren',
    icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    action: async () => {
      dropdown.remove();
      try {
        const response = await fetch('/api/admin/leadstroom/generate-recommendations', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to regenerate recommendations');
        }
        
        const result = await response.json();
        
        if (result.success) {
          if (window.showNotification) {
            window.showNotification(`✅ ${result.message}`, 'success');
          }
          // Reload content backlog tab
          await renderContentBacklogTab();
        } else {
          throw new Error(result.error || 'Failed to regenerate recommendations');
        }
      } catch (error) {
        console.error('Error regenerating recommendations:', error);
        if (window.showNotification) {
          window.showNotification('Fout bij hergenereren: ' + error.message, 'error');
        }
      }
    }
  });

  // Create menu items
  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = 'actions-menu-item';
    menuItem.style.cssText = `
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 14px;
      color: #374151;
      transition: background-color 0.15s;
    `;
    
    menuItem.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
        <path d="${item.icon}"/>
      </svg>
      ${item.label}
    `;

    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.backgroundColor = '#f9fafb';
    });

    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.backgroundColor = 'transparent';
    });

    menuItem.addEventListener('click', () => {
      item.action();
    });

    dropdown.appendChild(menuItem);
  });

  // Position dropdown
  const button = event.target.closest('.actions-button');
  const rect = button.getBoundingClientRect();
  dropdown.style.left = `${rect.right - 200}px`;
  dropdown.style.top = `${rect.bottom + 4}px`;

  // Add to document
  document.body.appendChild(dropdown);

  // Close dropdown when clicking outside
  const closeDropdown = (e) => {
    if (!dropdown.contains(e.target) && !button.contains(e.target)) {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', closeDropdown);
  }, 0);
}

/**
 * Create a test landing page automatically
 * @param {HTMLElement} btn - Optional button element to update
 */
async function createTestLandingPage(btn = null) {
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Landing page aanmaken...
      `;
    }
    
    const response = await fetch('/api/admin/landing-pages/create-test', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to create test landing page');
    }
    
    const result = await response.json();
    
    if (result.success && result.data && result.data.path) {
      // Open landing page in nieuw tabblad
      const url = `${window.location.origin}${result.data.path}`;
      window.open(url, '_blank');
      
      if (window.showNotification) {
        window.showNotification('Test landing page aangemaakt en geopend!', 'success');
      }
      
      // Close modal if open
      closeLandingPageModal();
      
      return result.data;
    } else {
      throw new Error('Failed to create landing page');
    }
    
  } catch (error) {
    console.error('Error creating test landing page:', error);
    if (window.showNotification) {
      window.showNotification('Fout bij aanmaken test landing page: ' + error.message, 'error');
    }
    throw error; // Re-throw so caller can handle
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
        </svg>
        Test Landing Page
      `;
    }
  }
}

/**
 * Open landing page modal
 */
function openLandingPageModal() {
  const modal = document.getElementById('landing-page-modal');
  if (!modal) return;
  
  modal.style.display = 'flex';
  document.body.classList.add('modal-open');
  
  // Reset modal state
  document.getElementById('modal-loading').style.display = 'block';
  document.getElementById('modal-content').style.display = 'none';
  document.getElementById('modal-no-lp').style.display = 'none';
  document.getElementById('modal-has-lp').style.display = 'none';
  document.getElementById('modal-error').style.display = 'none';
  
  // Fetch landing page
  fetchLandingPageForModal();
}

/**
 * Close landing page modal
 */
function closeLandingPageModal() {
  const modal = document.getElementById('landing-page-modal');
  if (!modal) return;
  
  modal.style.display = 'none';
  document.body.classList.remove('modal-open');
}

/**
 * Fetch landing page and update modal
 */
async function fetchLandingPageForModal() {
  try {
    const response = await fetch('/api/admin/landing-pages/test', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    let result = null;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new Error('Failed to parse response');
    }
    
    document.getElementById('modal-loading').style.display = 'none';
    document.getElementById('modal-content').style.display = 'block';
    
    if (response.ok && result.success && result.data && result.data.path) {
      // Show landing page info
      document.getElementById('modal-lp-path').textContent = result.data.path;
      document.getElementById('modal-lp-title').textContent = result.data.title || 'Geen titel';
      window.currentLandingPageData = result.data; // Store for opening
      document.getElementById('modal-has-lp').style.display = 'block';
    } else {
      // No landing page found
      document.getElementById('modal-no-lp').style.display = 'block';
    }
    
  } catch (error) {
    console.error('Error fetching landing page:', error);
    document.getElementById('modal-loading').style.display = 'none';
    document.getElementById('modal-content').style.display = 'block';
    document.getElementById('modal-error-message').textContent = error.message || 'Fout bij ophalen landing page';
    document.getElementById('modal-error').style.display = 'block';
  }
}

/**
 * Open test landing page from modal
 */
function openTestLandingPage() {
  if (window.currentLandingPageData && window.currentLandingPageData.path) {
    const url = `${window.location.origin}${window.currentLandingPageData.path}`;
    window.open(url, '_blank');
    
    if (window.showNotification) {
      window.showNotification('Landing page geopend in nieuw tabblad', 'success');
    }
    
    closeLandingPageModal();
  }
}

/**
 * Create test landing page from modal
 */
async function createTestLandingPageFromModal() {
  const loadingDiv = document.getElementById('modal-loading');
  const contentDiv = document.getElementById('modal-content');
  
  loadingDiv.style.display = 'block';
  contentDiv.style.display = 'none';
  
  try {
    const data = await createTestLandingPage();
    
    // Show success and close modal
    if (window.showNotification) {
      window.showNotification('Test landing page aangemaakt en geopend!', 'success');
    }
    closeLandingPageModal();
    
  } catch (error) {
    loadingDiv.style.display = 'none';
    contentDiv.style.display = 'block';
    document.getElementById('modal-error-message').textContent = error.message || 'Fout bij aanmaken test landing page';
    document.getElementById('modal-error').style.display = 'block';
  }
}

/**
 * Setup test landing page button
 * Opent een modal om landing page te testen of aan te maken
 */
function setupTestLandingPageButton() {
  const btn = document.getElementById('test-landing-page-btn');
  if (!btn) return;
  
  btn.addEventListener('click', function() {
    openLandingPageModal();
  });
  
  // Close modal on background click
  const modal = document.getElementById('landing-page-modal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeLandingPageModal();
      }
    });
  }
}

function setupRegenerateRecommendationsButton() {
  const btn = document.getElementById('regenerate-recommendations-btn');
  if (!btn) return;
  
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = `
      <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Genereren...
    `;
    
    try {
      const response = await fetch('/api/admin/leadstroom/generate-recommendations', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate recommendations');
      }
      
      const result = await response.json();
      
      if (result.success) {
        if (window.showNotification) {
          window.showNotification(`✅ ${result.message}`, 'success');
        }
        // Reload content backlog tab
        await renderContentBacklogTab();
        // IMPORTANT: Also refresh the AI widget in the top right corner
        if (typeof loadAiWidgetRecommendations === 'function') {
          await loadAiWidgetRecommendations();
        }
      } else {
        throw new Error(result.error || 'Failed to generate recommendations');
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
      if (window.showNotification) {
        window.showNotification('Fout bij genereren: ' + error.message, 'error');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
}

// Store current recommendation ID for modal actions
let currentRecommendationId = null;
let currentRecommendationData = null;

// Drawer functions
async function openAiRecommendationModal(id) {
  const drawer = document.getElementById('ai-recommendation-drawer');
  const backdrop = document.getElementById('ai-recommendation-drawer-backdrop');
  if (!drawer || !backdrop) return;
  
  // Store current recommendation ID
  currentRecommendationId = id;
  currentRecommendationData = null;
  
  // Clear all modal content to prevent showing old data
  const modalSummary = document.getElementById('modal-summary');
  const segmentNameEl = document.getElementById('modal-segment-name');
  const lpSection = document.getElementById('modal-lp-section');
  const adsSection = document.getElementById('modal-ads-section');
  
  // Reset all content to loading state with loading indicators
  if (modalSummary) {
    modalSummary.innerHTML = '<div class="flex items-center gap-2 text-gray-500"><div class="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600"></div><span>Laden...</span></div>';
  }
  if (segmentNameEl) segmentNameEl.textContent = 'Laden...';
  
  // Add loading indicators to sections (show loading in existing elements, don't replace structure)
  if (lpSection) {
    // Show loading in the section but preserve structure
    const lpUrlEl = document.getElementById('modal-lp-url');
    const lpH1El = document.getElementById('modal-lp-h1');
    const lpSubheadlineEl = document.getElementById('modal-lp-subheadline');
    
    if (lpUrlEl) lpUrlEl.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div><span class="text-xs">Laden...</span></div>';
    if (lpH1El) lpH1El.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div><span class="text-xs">Laden...</span></div>';
    if (lpSubheadlineEl) lpSubheadlineEl.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div><span class="text-xs">Laden...</span></div>';
  }
  
  if (adsSection) {
    const adsCampaignCreation = document.getElementById('modal-ads-campaign-creation');
    const adsAdgroupSection = document.getElementById('modal-ads-adgroup-section');
    
    if (adsCampaignCreation) {
      const campaignNameEl = document.getElementById('modal-ads-campaign-name');
      const dailyBudgetEl = document.getElementById('modal-ads-daily-budget');
      const campaignTypeEl = document.getElementById('modal-ads-campaign-type');
      const targetLocationsEl = document.getElementById('modal-ads-target-locations');
      const landingPageUrlEl = document.getElementById('modal-ads-landing-page-url');
      
      if (campaignNameEl) campaignNameEl.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div><span class="text-xs">Laden...</span></div>';
      if (dailyBudgetEl) dailyBudgetEl.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div><span class="text-xs">Laden...</span></div>';
      if (campaignTypeEl) campaignTypeEl.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div><span class="text-xs">Laden...</span></div>';
      if (targetLocationsEl) targetLocationsEl.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div><span class="text-xs">Laden...</span></div>';
      if (landingPageUrlEl) landingPageUrlEl.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div><span class="text-xs">Laden...</span></div>';
    }
    
    if (adsAdgroupSection) {
      const adsCampaignEl = document.getElementById('modal-ads-campaign');
      const adsAdgroupEl = document.getElementById('modal-ads-adgroup');
      const keywordsContainer = document.getElementById('modal-ads-keywords');
      const negKeywordsContainer = document.getElementById('modal-ads-negative-keywords');
      const adsContainer = document.getElementById('modal-ads-previews');
      
      if (adsCampaignEl) adsCampaignEl.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div><span class="text-xs">Laden...</span></div>';
      if (adsAdgroupEl) adsAdgroupEl.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div><span class="text-xs">Laden...</span></div>';
      if (keywordsContainer) keywordsContainer.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div><span class="text-xs">Laden...</span></div>';
      if (negKeywordsContainer) negKeywordsContainer.innerHTML = '<div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-3 w-3 border-2 border-gray-300 border-t-gray-600"></div><span class="text-xs">Laden...</span></div>';
      const adsPreviewsContainer = document.getElementById('modal-ads-previews');
      if (adsPreviewsContainer) {
        adsPreviewsContainer.innerHTML = '<div class="flex items-center justify-center py-4"><div class="flex items-center gap-2 text-gray-400"><div class="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600"></div><span class="text-sm">Laden...</span></div></div>';
      }
    }
  }
  
  // Show drawer
  drawer.classList.add('show');
  backdrop.classList.add('show');
  document.body.classList.add('ai-drawer-open');
  
  // Get drawer content element
  const drawerContent = drawer.querySelector('.ai-drawer-content');
  
  // Install click handler to close drawer when clicking outside content
  const drawerClickHandler = (ev) => {
    // Check if click is outside the drawer content
    // If the clicked element is not the drawer content or a child of it, close the drawer
    if (drawerContent && !drawerContent.contains(ev.target) && ev.target !== drawerContent) {
      closeAiRecommendationDrawer();
    }
  };
  
  // Remove any existing handler first
  if (window.__aiDrawerClickHandler) {
    drawer.removeEventListener('click', window.__aiDrawerClickHandler);
    if (backdrop) {
      backdrop.removeEventListener('click', window.__aiDrawerClickHandler);
    }
  }
  
  // Add click handler to both drawer and backdrop
  // Use capture phase to catch clicks before they bubble
  drawer.addEventListener('click', drawerClickHandler, true);
  if (backdrop) {
    backdrop.addEventListener('click', drawerClickHandler, true);
  }
  window.__aiDrawerClickHandler = drawerClickHandler;
  
  // Hide/show sections based on action type (already declared above)
  
  try {
    // Fetch recommendation data from API
    const response = await fetch(`/api/admin/leadstroom/ai-actions/${id}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch recommendation');
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('Invalid response format');
    }
    
    const recommendation = result.data;
    currentRecommendationData = recommendation;
    const actionDetails = recommendation.actionDetails || {};
    
    // Populate modal content
    const segmentNameEl = document.getElementById('modal-segment-name');
    if (segmentNameEl) segmentNameEl.textContent = recommendation.segmentLabel;
    
    // Format summary better
    let summaryText = recommendation.fullSummary || recommendation.summary || '';
    if (summaryText) {
      // Format: "Gap=31.0, geen cost page voor segment schilder_noord_brabant"
      // To: "Er is een lead gap van 31 leads per dag. Er is nog geen cost-pagina voor dit segment."
      
      // Replace Gap=X.X with better text
      summaryText = summaryText.replace(/Gap=([\d.]+)/gi, (match, gap) => {
        const gapNum = parseFloat(gap);
        const gapInt = Math.round(gapNum);
        return `Er is een lead gap van ${gapInt} ${gapInt === 1 ? 'lead' : 'leads'} per dag`;
      });
      
      // Replace "geen X page voor segment Y_Z" with better text
      summaryText = summaryText.replace(/geen\s+(\w+)\s+page\s+voor\s+segment\s+(\w+)_(\w+)/gi, (match, pageType, branch, region) => {
        const pageTypeMap = {
          'cost': 'kosten',
          'quote': 'offerte',
          'spoed': 'spoed',
          'main': 'hoofdpagina'
        };
        const pageTypeDutch = pageTypeMap[pageType.toLowerCase()] || pageType;
        const branchCapitalized = branch.charAt(0).toUpperCase() + branch.slice(1);
        const regionCapitalized = region.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return `Er is nog geen ${pageTypeDutch}-pagina voor het segment ${branchCapitalized} in ${regionCapitalized}`;
      });
      
      // Replace underscores with spaces and capitalize
      summaryText = summaryText.replace(/_/g, ' ');
      
      // Split on comma and format each part
      const parts = summaryText.split(',').map(p => p.trim()).filter(p => p);
      if (parts.length > 1) {
        summaryText = parts.join('. ') + '.';
      }
      
      // Capitalize first letter
      summaryText = summaryText.charAt(0).toUpperCase() + summaryText.slice(1);
      
      // Ensure it ends with a period
      if (!summaryText.endsWith('.') && !summaryText.endsWith('!') && !summaryText.endsWith('?')) {
        summaryText += '.';
      }
    }
    if (modalSummary) modalSummary.textContent = summaryText || 'Geen samenvatting beschikbaar';
    
    const leadGapEl = document.getElementById('modal-lead-gap');
    if (leadGapEl) {
      const gapValue = actionDetails.lead_gap || recommendation.leadGap?.replace('/dag', '') || null;
      leadGapEl.textContent = gapValue ? `${gapValue}/dag` : '-';
    }
    
    // CPL info - try multiple sources
    const currentCplEl = document.getElementById('modal-current-cpl');
    if (currentCplEl) {
      const currentCpl = actionDetails.current_cpl || actionDetails.avg_cpl || null;
      currentCplEl.textContent = currentCpl ? `€${parseFloat(currentCpl).toFixed(2)}` : '-';
    }
    
    const targetCplEl = document.getElementById('modal-target-cpl');
    if (targetCplEl) {
      const targetCpl = actionDetails.target_cpl || actionDetails.cpl_target || null;
      targetCplEl.textContent = targetCpl ? `€${parseFloat(targetCpl).toFixed(2)}` : '-';
    }
    
    // Show/hide sections based on action type
    const isLandingPageAction = recommendation.actionType === 'create_landing_page' || recommendation.actionType === 'publish_landing_page';
    const isCreateCampaign = recommendation.actionType === 'create_campaign';
    const isIncreaseBudget = recommendation.actionType === 'increase_campaign_budget';
    const isAdsAction = isCreateCampaign || isIncreaseBudget;
    
    if (lpSection) {
      lpSection.style.display = isLandingPageAction ? 'block' : 'none';
    }
    if (adsSection) {
      adsSection.style.display = isAdsAction ? 'block' : 'none';
    }

    // Show/hide campaign creation vs adgroup sections
    const campaignCreationSection = document.getElementById('modal-ads-campaign-creation');
    const adgroupSection = document.getElementById('modal-ads-adgroup-section');
    
    if (campaignCreationSection) {
      campaignCreationSection.style.display = isCreateCampaign ? 'block' : 'none';
    }
    if (adgroupSection) {
      adgroupSection.style.display = isIncreaseBudget ? 'block' : 'none';
    }
    
    // Landing page info (if available in actionDetails)
    const lpUrlEl = document.getElementById('modal-lp-url');
    if (lpUrlEl) {
      const path = actionDetails.suggested_path || actionDetails.landing_page_path || '-';
      lpUrlEl.textContent = path;
    }
    
    const lpH1El = document.getElementById('modal-lp-h1');
    if (lpH1El) lpH1El.textContent = actionDetails.title || actionDetails.landing_page_title || '-';
    
    const lpSubheadlineEl = document.getElementById('modal-lp-subheadline');
    if (lpSubheadlineEl) lpSubheadlineEl.textContent = actionDetails.subtitle || '-';
    
    // Google Ads Campaign Creation info (create_campaign)
    if (isCreateCampaign) {
      const campaignNameEl = document.getElementById('modal-ads-campaign-name');
      if (campaignNameEl) campaignNameEl.textContent = actionDetails.campaign_name || 'Niet beschikbaar';
      
      const dailyBudgetEl = document.getElementById('modal-ads-daily-budget');
      if (dailyBudgetEl) {
        const budget = actionDetails.daily_budget || 0;
        dailyBudgetEl.textContent = `€${parseFloat(budget).toFixed(2)}/dag`;
      }
      
      const campaignTypeEl = document.getElementById('modal-ads-campaign-type');
      if (campaignTypeEl) {
        const type = actionDetails.advertising_channel_type || 'SEARCH';
        const typeLabels = {
          'SEARCH': 'Zoekcampagne',
          'DISPLAY': 'Display campagne',
          'SHOPPING': 'Shopping campagne',
          'VIDEO': 'Video campagne',
          'PERFORMANCE_MAX': 'Performance Max'
        };
        campaignTypeEl.textContent = typeLabels[type] || type;
      }
      
      const targetLocationsEl = document.getElementById('modal-ads-target-locations');
      if (targetLocationsEl) {
        const locations = actionDetails.target_locations || ['NL'];
        targetLocationsEl.innerHTML = locations.map(loc => 
          `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">${loc}</span>`
        ).join('');
      }
      
      const landingPageUrlEl = document.getElementById('modal-ads-landing-page-url');
      if (landingPageUrlEl) {
        const url = actionDetails.landing_page_url;
        if (url && url !== 'Nog niet beschikbaar') {
          landingPageUrlEl.innerHTML = `<a href="${url}" target="_blank" class="hover:underline">${url}</a>`;
        } else {
          landingPageUrlEl.innerHTML = '<span class="text-gray-500 italic">Wordt automatisch aangemaakt bij goedkeuring</span>';
        }
      }
    }
    
    // Google Ads AdGroup info (increase_campaign_budget)
    if (isIncreaseBudget) {
      const adsCampaignEl = document.getElementById('modal-ads-campaign');
      if (adsCampaignEl) adsCampaignEl.textContent = actionDetails.campaign_name || 'Niet beschikbaar';
      
      const adsAdgroupEl = document.getElementById('modal-ads-adgroup');
      if (adsAdgroupEl) adsAdgroupEl.textContent = actionDetails.adgroup_name || 'Niet beschikbaar';
    }
    
    // Keywords (if available)
    const keywordsContainer = document.getElementById('modal-ads-keywords');
    if (keywordsContainer) {
      const keywords = actionDetails.keywords || [];
      keywordsContainer.innerHTML = keywords.length > 0 
        ? keywords.map(kw => 
            `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">${kw}</span>`
          ).join('')
        : '<span class="text-sm text-gray-500">Geen keywords beschikbaar</span>';
    }
    
    // Negative keywords (if available)
    const negKeywordsContainer = document.getElementById('modal-ads-negative-keywords');
    if (negKeywordsContainer) {
      const negKeywords = actionDetails.negative_keywords || [];
      negKeywordsContainer.innerHTML = negKeywords.length > 0
        ? negKeywords.map(kw => 
            `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">${kw}</span>`
          ).join('')
        : '<span class="text-sm text-gray-500">Geen negative keywords</span>';
    }
    
    // Ads previews (if available)
    const adsContainer = document.getElementById('modal-ads-previews');
    if (adsContainer) {
      const ads = actionDetails.ads || [];
      adsContainer.innerHTML = ads.length > 0
        ? ads.map((ad, idx) => `
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p class="text-xs font-medium text-gray-500 mb-2">Ad ${idx + 1}</p>
              <div class="space-y-2">
                ${(ad.headlines || []).map(h => `<p class="text-sm font-medium text-blue-600">${h}</p>`).join('')}
                <p class="text-sm text-gray-700">${ad.description || ''}</p>
                <p class="text-xs text-green-700">www.growsocial.nl › ${ad.path || ''}</p>
              </div>
            </div>
          `).join('')
        : '<p class="text-sm text-gray-500">Geen ads beschikbaar</p>';
    }
    
    // Drawer is already shown above
  } catch (error) {
    console.error('Error loading recommendation:', error);
    if (modalSummary) modalSummary.textContent = 'Fout bij laden van data: ' + error.message;
  }
}

function closeAiRecommendationDrawer() {
  const drawer = document.getElementById('ai-recommendation-drawer');
  const backdrop = document.getElementById('ai-recommendation-drawer-backdrop');
  
  if (drawer) drawer.classList.remove('show');
  if (backdrop) backdrop.classList.remove('show');
  document.body.classList.remove('ai-drawer-open');
  
  // Remove click handlers
  if (window.__aiDrawerClickHandler) {
    drawer.removeEventListener('click', window.__aiDrawerClickHandler, true);
    if (backdrop) {
      backdrop.removeEventListener('click', window.__aiDrawerClickHandler, true);
    }
    window.__aiDrawerClickHandler = null;
  }
  
  // Clear current recommendation data
  currentRecommendationId = null;
  currentRecommendationData = null;
  
  // Clear feedback textarea
  const feedbackText = document.getElementById('modal-feedback-text');
  if (feedbackText) feedbackText.value = '';
}

// Alias for backward compatibility
function closeModal() {
  closeAiRecommendationDrawer();
}

// Modern progress modal for campaign creation
function showProgressModal(recId, actionType) {
  console.log('showProgressModal called with recId:', recId, 'actionType:', actionType);
  
  // Reset current step element when opening new modal
  currentStepElement = null;
  // Reset stored percentage so a new run starts at 0 and never regresses within the run
  lastProgressPercent = 0;
  
  // Remove existing modal if present
  const existingModal = document.getElementById('campaign-progress-modal');
  const existingOverlay = document.getElementById('campaign-progress-modal-overlay');
  if (existingModal) {
    existingModal.remove();
  }
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'campaign-progress-modal-overlay';
  overlay.id = 'campaign-progress-modal-overlay';
  
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'campaign-progress-modal';
  modal.id = 'campaign-progress-modal';
  
  modal.innerHTML = `
    <div class="campaign-progress-header">
      <div class="campaign-progress-title">
        <h3>Campagne wordt aangemaakt</h3>
      </div>
      <button class="campaign-progress-close" onclick="handleCancelCampaign('${recId}')" title="Annuleren">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div class="campaign-progress-body">
      <div class="campaign-progress-bar-container" id="progress-steps-container">
        <div class="campaign-progress-bar">
          <div class="campaign-progress-bar-fill" id="progress-bar-fill" style="width: 1%"></div>
        </div>
        <div class="campaign-progress-steps" id="progress-steps"></div>
      </div>
      <div class="campaign-progress-footer">
        <button class="campaign-cancel-btn" onclick="handleCancelCampaign('${recId}')">Annuleren</button>
      </div>
    </div>
  `;
  
  // Store recId for cancel functionality
  modal.setAttribute('data-rec-id', recId);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  console.log('Progress modal created and added to DOM. Modal element:', modal, 'Overlay element:', overlay);
  
  // Start polling for progress updates
  startProgressPolling(recId);
  
  // Initial progress update
  updateProgressModal({
    step: 'initializing',
    message: 'Campagne initialiseren...',
    percentage: 1,
    status: 'in_progress'
  });
  
  console.log('Initial progress update sent');
  }

// Single current step element (no stacking - updates in place)
let currentStepElement = null;
// Track last known percentage to avoid regressions to 0% when backend omits/lowers temporarily
let lastProgressPercent = 0;

function updateProgressModal(progress) {
  if (!progress) return;
  
  const modal = document.getElementById('campaign-progress-modal');
  if (!modal) return;
  
  const barFill = document.getElementById('progress-bar-fill');
  const stepsContainer = document.getElementById('progress-steps');
  
  // Update progress bar - ensure percentage is a valid number
  const rawPercent = typeof progress.percentage === 'number' ? progress.percentage : lastProgressPercent || 0;
  const clampedPercent = Math.max(0, Math.min(100, rawPercent));
  // Prevent flicker back to 0 when intermediate payloads miss percentage
  const effectivePercent = Math.max(lastProgressPercent, clampedPercent);
  
  if (barFill) {
    barFill.style.width = `${effectivePercent}%`;
    // Update color based on status
    if (progress.status === 'error' || progress.status === 'failed') {
      barFill.style.background = '#dc2626';
    } else if (progress.status === 'complete') {
      barFill.style.background = '#ea5d0d';
    } else {
      barFill.style.background = '#ea5d0d';
    }
  }
  
  // Step titles (no emojis, clean text) - includes all detailed steps
  // Note: Complete and error statuses don't get "..." appended
  const stepTitles = {
    'initializing': 'Campagne initialiseren',
    'budget': 'Campagne budget aanmaken',
    'campaign': 'Campagne aanmaken',
    'location': 'Locatietargeting instellen',
    'language': 'Taaltargeting instellen',
    'keywords': 'Zoekwoorden genereren',
    'adgroups': 'Ad groups aanmaken',
    'ads': 'Responsive Search Ads aanmaken',
    'extensions': 'Ad extensions voorbereiden',
    'extensions_sitelinks': 'Sitelink assets aanmaken',
    'sitelinks': 'Sitelink assets aanmaken',
    'extensions_callouts': 'Callout assets aanmaken',
    'callouts': 'Callout assets aanmaken',
    'extensions_snippets': 'Structured snippet aanmaken',
    'snippets': 'Structured snippet aanmaken',
    'extensions_linking': 'Assets koppelen aan campagne',
    'linking': 'Assets koppelen aan campagne',
    'negative': 'Negatieve zoekwoorden toevoegen',
    'bidding': 'Smart bidding instellen',
    'finalizing': 'Campagne finaliseren en opslaan',
    'complete': 'Campagne succesvol aangemaakt',
    'error': 'Fout opgetreden'
  };
  
  // CRITICAL: Ensure step is always a string (handle objects, null, undefined)
  let stepKey = progress.step;
  if (typeof stepKey !== 'string') {
    if (stepKey && typeof stepKey === 'object') {
      stepKey = stepKey.step || stepKey.name || stepKey.type || 'extensions';
    } else {
      stepKey = String(stepKey || 'initializing');
    }
  }
  stepKey = String(stepKey);
  if (stepKey === '[object Object]') {
    stepKey = 'extensions';
  }
  
  // Use the message if it's more descriptive, otherwise use step title
  // CRITICAL: Ensure message is always a string (handle objects, null, undefined)
  let rawMessage = progress.message;
  if (typeof rawMessage !== 'string') {
    if (rawMessage && typeof rawMessage === 'object') {
      rawMessage = rawMessage.message || rawMessage.text || rawMessage.title || '';
    } else {
      rawMessage = '';
    }
  }
  
  let stepTitle = rawMessage || stepTitles[stepKey] || 'Bezig...';
  if (stepTitle === '[object Object]') {
    stepTitle = stepTitles[stepKey] || 'Bezig...';
  }
  
  // Ensure stepTitle is a string before calling string methods
  stepTitle = String(stepTitle);
  
  // Clean up message - remove emojis and extra formatting
  stepTitle = stepTitle.replace(/✅|❌|⚠️|🔍|📍|💰|🚀|📊|📝|🔗|💬|📋|🚫|🎯|💾/g, '').trim();
  
  // If message contains step info, extract just the text part
  if (stepTitle.includes(':')) {
    // Keep everything after the colon if it's more descriptive
    const parts = stepTitle.split(':');
    if (parts.length > 1) {
      stepTitle = parts.slice(1).join(':').trim();
    }
  }
  
  // Fallback to step title if message is too generic
  if (!stepTitle || stepTitle === 'Bezig...' || stepTitle.length < 3) {
    stepTitle = stepTitles[stepKey] || stepKey || 'Bezig...';
  }
  
  // Final safety check - ensure it's a string
  stepTitle = String(stepTitle);
  
  // Ensure all messages end with "..." unless they're complete/error status
  // Complete and error messages should not have "..."
  const isComplete = progress.status === 'complete' || stepKey === 'complete';
  const isError = progress.status === 'error' || progress.status === 'failed' || stepKey === 'error';
  
  if (!isComplete && !isError) {
    // Remove any existing "..." and add it back to ensure consistency
    stepTitle = stepTitle.replace(/\.{3,}$/, '').trim();
    if (stepTitle && !stepTitle.endsWith('...')) {
      stepTitle = stepTitle + '...';
    }
  } else {
    // For complete/error, remove "..." if present
    stepTitle = stepTitle.replace(/\.{3,}$/, '').trim();
  }
  
  // Early return if no step
  if (!stepKey) return;
  
  // Create or get single step element (updates in place, no stacking)
  if (!currentStepElement && stepsContainer) {
    currentStepElement = document.createElement('div');
    currentStepElement.className = 'campaign-progress-step';
    currentStepElement.id = 'current-progress-step';
    stepsContainer.appendChild(currentStepElement);
  }
  
  if (currentStepElement) {
    // Always update the same element (text swaps out, no stacking)
    // Ensure percentage is valid - use 100 for complete, otherwise use clampedPercent
    let stepPercent = effectivePercent;
    if (progress.status === 'complete' || stepKey === 'complete') {
      stepPercent = 100;
    } else if (progress.status === 'error' || progress.status === 'failed') {
      // Keep current percentage on error, don't reset to 0
      stepPercent = Math.max(clampedPercent, 0);
    }
    
    // Ensure stepPercent is a valid number
    stepPercent = typeof stepPercent === 'number' && !isNaN(stepPercent) ? stepPercent : 0;
    stepPercent = Math.max(0, Math.min(100, stepPercent));
    
    // Use flexbox structure for proper alignment
    // Escape HTML in stepTitle to prevent XSS
    const escapedTitle = stepTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    currentStepElement.innerHTML = `
      <span class="step-name">${escapedTitle}</span>
      <span class="step-percent">${Math.round(stepPercent)}%</span>
  `;
    
    // Mark as active/completed/error
    currentStepElement.classList.remove('active', 'completed', 'error');
    if (progress.status === 'complete' || stepKey === 'complete') {
      currentStepElement.classList.add('completed');
    } else if (progress.status === 'error' || progress.status === 'failed') {
      currentStepElement.classList.add('error');
    } else {
      currentStepElement.classList.add('active');
    }
  }
  
  // Persist last known percent for smoother updates; always 100 on completion
  if (progress.status === 'complete' || stepKey === 'complete') {
    lastProgressPercent = 100;
  } else if (progress.status !== 'error' && progress.status !== 'failed') {
    lastProgressPercent = effectivePercent;
  }
}

let progressPollingInterval = null;
let notificationShown = false; // Flag to prevent multiple notifications

function startProgressPolling(recId) {
  // Reset notification flag for new polling session
  notificationShown = false;
  
  // Clear any existing polling
  if (progressPollingInterval) {
    clearInterval(progressPollingInterval);
    progressPollingInterval = null;
  }
  
  // Poll every 300ms for real-time updates (faster polling for better UX)
  let consecutiveNoProgress = 0;
  progressPollingInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/marketing-recommendations/${recId}/progress`, {
        credentials: 'include',
        cache: 'no-cache'
      });
      
      if (!response.ok) {
        console.warn('Progress endpoint returned non-OK status:', response.status);
        return;
      }
      
      const result = await response.json();
      if (result.success && result.progress) {
        consecutiveNoProgress = 0; // Reset counter
        updateProgressModal(result.progress);
        
        // Stop polling if complete or error
        if (result.progress.status === 'complete' || result.progress.status === 'error' || result.progress.status === 'failed') {
          // Clear interval FIRST to prevent race conditions
          if (progressPollingInterval) {
            clearInterval(progressPollingInterval);
            progressPollingInterval = null;
          }
          
          // Handle completion with proper timing: notification first, then close modal
          // Only show notification once, even if this code runs multiple times
          if (result.progress.status === 'complete' && !notificationShown) {
            notificationShown = true; // Set flag immediately to prevent duplicates
            console.log('✅ Campaign creation completed');
            
            // Show success notification immediately
            if (window.showNotification) {
              window.showNotification('✅ Campagne succesvol aangemaakt!', 'success');
            }
            
            // Close modal exactly when notification appears (small delay to ensure notification is rendered)
            setTimeout(() => {
              closeProgressModal();
            }, 100);
          } else if (result.progress.status === 'error' || result.progress.status === 'failed') {
            // Error state - keep modal open so user can see the error
            console.error('❌ Campaign creation failed:', result.progress.message);
          }
        }
      } else if (result.success && !result.progress) {
        // No progress data - might be completed or not started yet
        consecutiveNoProgress++;
        console.log(`No progress data available (attempt ${consecutiveNoProgress})...`);
        
        // If no progress for 10 consecutive polls (3 seconds), stop polling
        if (consecutiveNoProgress >= 10) {
          console.warn('No progress data for 10 consecutive polls, stopping...');
          clearInterval(progressPollingInterval);
          progressPollingInterval = null;
        }
      }
    } catch (error) {
      console.error('Error polling progress:', error);
      consecutiveNoProgress++;
      if (consecutiveNoProgress >= 10) {
        console.error('Too many polling errors, stopping...');
        clearInterval(progressPollingInterval);
        progressPollingInterval = null;
      }
    }
  }, 300); // Poll every 300ms for faster updates
}

function closeProgressModal() {
  console.log('Closing progress modal...');
  const overlay = document.getElementById('campaign-progress-modal-overlay');
  if (overlay) {
    // Add fade-out animation
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => {
      overlay.remove();
    }, 300);
  }
  // Clear polling
  if (progressPollingInterval) {
    clearInterval(progressPollingInterval);
    progressPollingInterval = null;
  }
}

function handleCancelCampaign(recId) {
  // Show in-platform confirmation modal
  createConfirmModal(
    'Campagne creatie annuleren',
    'Weet je zeker dat je het aanmaken van de campagne wilt annuleren? De campagne wordt niet aangemaakt.',
    'Annuleren',
    'Doorgaan',
    () => {
      // Stop polling
      if (progressPollingInterval) {
        clearInterval(progressPollingInterval);
        progressPollingInterval = null;
      }
      
      // Close modal
      closeProgressModal();
      
      // Optionally: send cancel request to backend
      // fetch(`/api/marketing-recommendations/${recId}/cancel`, { method: 'POST', credentials: 'include' })
      //   .catch(err => console.error('Error cancelling campaign:', err));
      
      showNotification('Campagne creatie geannuleerd', 'info');
    }
  );
}

// Make function globally available
window.handleCancelCampaign = handleCancelCampaign;

async function approveRecommendationFromModal() {
  if (!currentRecommendationId) {
    showNotification('Geen recommendation geselecteerd', 'error');
    return;
  }
  
  // Get recommendation type to show appropriate modal
  const rec = currentRecommendationData;
  const actionType = rec?.action_type || rec?.actionType || 'unknown';
  
  // Show progress modal for campaign creation
  if (actionType === 'create_campaign') {
    showProgressModal(currentRecommendationId, actionType);
  }
  
  // Find all approve buttons and disable them
  const approveButtons = [
    document.getElementById('modal-approve-lp-btn'),
    document.getElementById('modal-approve-ads-btn')
  ].filter(Boolean);
  
  const btn = event?.target || approveButtons[0];
  
  // Disable all approve buttons and show loading state
  approveButtons.forEach(button => {
    button.disabled = true;
    const originalText = button.textContent;
    button.dataset.originalText = originalText;
    button.innerHTML = '<span class="inline-flex items-center"><svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Goedkeuren...</span>';
  });
  
  try {
    const response = await fetch(`/api/marketing-recommendations/${currentRecommendationId}/approve`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = 'Failed to approve recommendation';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
        console.error('Server error response:', errorData);
      } catch (e) {
        errorMessage = `Server error: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    
    if (result.success) {
      // Wait a bit for final progress update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For campaign creation, the progress modal will handle the success notification
      // For other actions, show notification immediately
      if (actionType !== 'create_campaign') {
        if (window.showNotification) {
          window.showNotification('✅ Aanbeveling goedgekeurd en uitgevoerd!', 'success');
        }
      }
      // Close drawer
      closeAiRecommendationDrawer();
      // Reload AI actions tab
      await renderAiActionsTab();
      // Reload content backlog tab if open
      await renderContentBacklogTab();
      // IMPORTANT: Also refresh the AI widget in the top right corner
      if (typeof loadAiWidgetRecommendations === 'function') {
        await loadAiWidgetRecommendations();
      }
    } else {
      throw new Error(result.error || 'Failed to approve recommendation');
    }
  } catch (error) {
    console.error('Error approving recommendation:', error);
    console.error('Error details:', error.stack);
    
    // Update progress modal with error
    updateProgressModal({
      step: 'error',
      message: `Fout: ${error.message}`,
      percentage: 0,
      status: 'error'
    });
    
    if (window.showNotification) {
      const errorMsg = error.message || 'Onbekende fout bij goedkeuren';
      window.showNotification('Fout bij goedkeuren: ' + errorMsg, 'error');
    }
    // Re-enable all approve buttons
    const approveButtons = [
      document.getElementById('modal-approve-lp-btn'),
      document.getElementById('modal-approve-ads-btn')
    ].filter(Boolean);
    
    approveButtons.forEach(button => {
      button.disabled = false;
      const originalText = button.dataset.originalText || 'Goedkeuren';
      button.textContent = originalText;
      delete button.dataset.originalText;
    });
  }
}

// Reject recommendation from modal (for landing page section)
async function rejectRecommendationFromModal() {
  if (!currentRecommendationId) {
    showNotification('Geen recommendation geselecteerd', 'error');
    return;
  }
  
  const feedbackText = document.getElementById('modal-feedback-text')?.value?.trim() || '';
  
  // Require feedback when rejecting
  if (!feedbackText) {
    showNotification('Feedback is verplicht bij het afwijzen van een aanbeveling. Voer alstublieft feedback in.', 'error');
    const feedbackTextarea = document.getElementById('modal-feedback-text');
    if (feedbackTextarea) {
      feedbackTextarea.focus();
      feedbackTextarea.style.borderColor = '#ef4444';
      setTimeout(() => {
        feedbackTextarea.style.borderColor = '';
      }, 2000);
    }
    return;
  }
  
  // Show confirmation modal
  createConfirmModal(
    'Aanbeveling Afwijzen',
    'Weet je zeker dat je deze aanbeveling wilt afwijzen?',
    'Afwijzen',
    'Annuleren',
    async () => {
      await performRejectRecommendation(feedbackText);
    }
  );
  
  return;
}

async function performRejectRecommendation(feedbackText) {
  const btn = document.getElementById('modal-reject-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Afwijzen...';
  }
  
  try {
    const response = await fetch(`/api/marketing-recommendations/${currentRecommendationId}/reject`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        feedback: feedbackText
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to reject recommendation');
    }
    
    const result = await response.json();
    
    if (result.success) {
      if (window.showNotification) {
        window.showNotification('Aanbeveling afgewezen', 'success');
      }
      // Close drawer
      closeAiRecommendationDrawer();
      // Reload AI actions tab
      await renderAiActionsTab();
    } else {
      throw new Error(result.error || 'Failed to reject recommendation');
    }
  } catch (error) {
    console.error('Error rejecting recommendation:', error);
    if (window.showNotification) {
      window.showNotification('Fout bij afwijzen: ' + error.message, 'error');
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Afwijzen';
    }
  }
}

// View full landing page text
function viewFullLandingPageText() {
  if (!currentRecommendationData) {
    showNotification('Geen recommendation data beschikbaar', 'error');
    return;
  }
  
  const actionDetails = currentRecommendationData.actionDetails || {};
  const contentJson = actionDetails.content_json || {};
  
  // Build full text from content_json
  let fullText = '';
  
  if (contentJson.hero) {
    fullText += `# ${contentJson.hero.title || ''}\n\n${contentJson.hero.subtitle || ''}\n\n`;
  }
  
  if (contentJson.sections) {
    contentJson.sections.forEach((section, idx) => {
      fullText += `## ${section.title || `Sectie ${idx + 1}`}\n\n`;
      if (section.content) {
        fullText += `${section.content}\n\n`;
      }
      if (section.bullets) {
        section.bullets.forEach(bullet => {
          fullText += `- ${bullet}\n`;
        });
        fullText += '\n';
      }
    });
  }
  
  if (contentJson.cta) {
    fullText += `## ${contentJson.cta.title || 'Call to Action'}\n\n${contentJson.cta.text || ''}\n\n`;
  }
  
  // Show in new window or alert
  if (fullText) {
    const newWindow = window.open('', '_blank', 'width=800,height=600');
    newWindow.document.write(`
      <html>
        <head>
          <title>Volledige Landing Page Tekst</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
            pre { white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <h1>Volledige Landing Page Tekst</h1>
          <pre>${fullText}</pre>
        </body>
      </html>
    `);
  } else {
    showNotification('Geen volledige tekst beschikbaar voor deze aanbeveling', 'error');
  }
}

// Save feedback from modal
async function saveFeedbackFromModal() {
  if (!currentRecommendationId) {
    showNotification('Geen recommendation geselecteerd', 'error');
    return;
  }
  
  const feedbackText = document.getElementById('modal-feedback-text')?.value || '';
  
  if (!feedbackText.trim()) {
    showNotification('Voer feedback in voordat je het opslaat', 'error');
    return;
  }
  
  const btn = document.getElementById('modal-save-feedback-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Opslaan...';
  }
  
  try {
    // Store feedback in action_details (we kunnen later een aparte feedback kolom toevoegen)
    const response = await fetch(`/api/marketing-recommendations/${currentRecommendationId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        feedback: feedbackText
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save feedback');
    }
    
    if (window.showNotification) {
      window.showNotification('Feedback opgeslagen', 'success');
    }
    
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Feedback opslaan';
    }
  } catch (error) {
    console.error('Error saving feedback:', error);
    if (window.showNotification) {
      window.showNotification('Fout bij opslaan feedback: ' + error.message, 'error');
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Feedback opslaan';
    }
  }
}

function setupGenerateRecommendationsButton() {
  const btn = document.getElementById('generate-recommendations-btn');
  if (!btn) return;
  
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = `
      <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Genereren...
    `;
    
    try {
      const response = await fetch('/api/admin/leadstroom/generate-recommendations', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate recommendations');
      }
      
      const result = await response.json();
      
      if (result.success) {
        if (window.showNotification) {
          window.showNotification(`✅ ${result.message}`, 'success');
        }
        // Reload recommendations in the tab
        await renderAiActionsTab();
        // IMPORTANT: Also refresh the AI widget in the top right corner
        if (typeof loadAiWidgetRecommendations === 'function') {
          await loadAiWidgetRecommendations();
        }
      } else {
        throw new Error(result.error || 'Failed to generate recommendations');
      }
    } catch (error) {
      console.error('Error generating recommendations:', error);
      if (window.showNotification) {
        window.showNotification('Fout bij genereren: ' + error.message, 'error');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
}

/**
 * Show segment actions dropdown menu
 * @param {string} segmentId - Segment ID
 * @param {Event} event - Click event
 */
function showSegmentActionsMenu(segmentId, event) {
  // Remove any existing dropdown
  const existingDropdown = document.querySelector('.actions-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
    return; // Exit early if we just closed a dropdown
  }

  // Create dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'actions-dropdown';
  dropdown.style.cssText = `
    position: fixed;
    background: white;
    border: 0.5px solid #e5e7eb;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    min-width: 200px;
    padding: 4px 0;
  `;
  
  // Add menu items
  const menuItems = [
    {
      label: 'Bekijken',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      action: () => {
        openSegmentDetails(segmentId);
        dropdown.remove();
      }
    },
    {
      label: 'Afwijzen',
      icon: 'M6 18L18 6M6 6l12 12',
      danger: true,
      action: () => {
        rejectSegment(segmentId);
        dropdown.remove();
      }
    }
  ];

  // Create menu items
  menuItems.forEach((item, index) => {
    if (index > 0 && item.danger) {
      // Add separator before danger item
      const separator = document.createElement('div');
      separator.style.cssText = 'border-top: 1px solid #e5e7eb; margin: 4px 0;';
      dropdown.appendChild(separator);
    }

    const menuItem = document.createElement('div');
    menuItem.className = 'actions-menu-item';
    menuItem.style.cssText = `
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 14px;
      color: ${item.danger ? '#dc2626' : '#374151'};
      transition: background-color 0.15s;
    `;
    
    menuItem.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
        <path d="${item.icon}"/>
      </svg>
      ${item.label}
    `;

    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.backgroundColor = '#f9fafb';
    });

    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.backgroundColor = 'transparent';
    });

    menuItem.addEventListener('click', () => {
      item.action();
    });

    dropdown.appendChild(menuItem);
  });

  // Position dropdown
  const button = event.target.closest('.actions-button');
  const rect = button.getBoundingClientRect();
  dropdown.style.left = `${rect.right - 200}px`;
  dropdown.style.top = `${rect.bottom + 4}px`;

  // Add to document
  document.body.appendChild(dropdown);

  // Close dropdown when clicking outside
  const closeDropdown = (e) => {
    if (!dropdown.contains(e.target) && !button.contains(e.target)) {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', closeDropdown);
  }, 0);
}

/**
 * Open segment details in right-side modal
 * @param {string} segmentId - Segment ID
 */
async function openSegmentDetails(segmentId) {
  // Remove existing modal if any
  const existingModal = document.getElementById('segment-details-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal overlay
  const modal = document.createElement('div');
  modal.id = 'segment-details-modal';
  modal.className = 'segment-details-modal-overlay';
  modal.innerHTML = `
    <div class="segment-details-modal-content">
      <div class="segment-details-modal-header">
        <h2 class="segment-details-modal-title">Segment Details</h2>
        <button class="segment-details-modal-close" onclick="closeSegmentDetailsModal()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div class="segment-details-modal-body">
        <div class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p class="mt-4 text-gray-600">Segment details laden...</p>
        </div>
      </div>
    </div>
  `;
  
  // Close modal when clicking on overlay (but not on content)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeSegmentDetailsModal();
    }
  });
  
  document.body.appendChild(modal);
  
  // Trigger animation
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);

  // Fetch segment data
  try {
    const response = await fetch(`/api/lead-segments/${segmentId}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch segment details');
    }
    
    const result = await response.json();
    const segment = result.data || result;
    
    // Render segment details
    const modalBody = modal.querySelector('.segment-details-modal-body');
    modalBody.innerHTML = `
      <div class="segment-details-content">
        <div class="segment-detail-section">
          <label class="segment-detail-label">Segment Code</label>
          <div class="segment-detail-value">${escapeHtml(segment.code || 'N/A')}</div>
        </div>
        <div class="segment-detail-section">
          <label class="segment-detail-label">Branch</label>
          <div class="segment-detail-value">${escapeHtml(segment.branch || 'N/A')}</div>
        </div>
        <div class="segment-detail-section">
          <label class="segment-detail-label">Regio</label>
          <div class="segment-detail-value">${escapeHtml(segment.region || 'N/A')}</div>
        </div>
        <div class="segment-detail-section">
          <label class="segment-detail-label">Status</label>
          <div class="segment-detail-value">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${segment.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
              ${segment.is_active ? 'Actief' : 'Inactief'}
            </span>
          </div>
        </div>
        ${segment.google_ads_campaign_id ? `
        <div class="segment-detail-section">
          <label class="segment-detail-label">Google Ads Campaign ID</label>
          <div class="segment-detail-value">
            <code class="text-xs bg-gray-100 px-2 py-1 rounded">${escapeHtml(segment.google_ads_campaign_id)}</code>
          </div>
        </div>
        ` : ''}
        ${segment.target_leads_per_month ? `
        <div class="segment-detail-section">
          <label class="segment-detail-label">Target Leads/maand</label>
          <div class="segment-detail-value">${segment.target_leads_per_month}</div>
        </div>
        ` : ''}
        <div class="segment-detail-section">
          <label class="segment-detail-label">Aangemaakt op</label>
          <div class="segment-detail-value">${segment.created_at ? new Date(segment.created_at).toLocaleString('nl-NL') : 'N/A'}</div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Error fetching segment details:', error);
    const modalBody = modal.querySelector('.segment-details-modal-body');
    modalBody.innerHTML = `
      <div class="text-center py-8">
        <p class="text-red-600">Fout bij laden segment details: ${error.message}</p>
        <button onclick="closeSegmentDetailsModal()" class="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
          Sluiten
        </button>
      </div>
    `;
  }
}

/**
 * Close segment details modal
 */
function closeSegmentDetailsModal() {
  const modal = document.getElementById('segment-details-modal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

/**
 * Reject segment (placeholder)
 * @param {string} segmentId - Segment ID
 */
function rejectSegment(segmentId) {
  if (confirm('Weet je zeker dat je dit segment wilt afwijzen?')) {
    // TODO: Implement reject logic
    console.log('Rejecting segment:', segmentId);
    if (window.showNotification) {
      window.showNotification('Segment afgewezen', 'success');
    }
  }
}

/**
 * Show AI recommendation actions dropdown menu
 * @param {string} recommendationId - Recommendation ID
 * @param {string} status - Recommendation status
 * @param {Event} event - Click event
 */
function showAiRecommendationActionsMenu(recommendationId, status, event) {
  // Remove any existing dropdown
  const existingDropdown = document.querySelector('.actions-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
    return; // Exit early if we just closed a dropdown
  }

  // Create dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'actions-dropdown';
  dropdown.style.cssText = `
    position: fixed;
    background: white;
    border: 0.5px solid #e5e7eb;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    min-width: 200px;
    padding: 4px 0;
  `;
  
  // Add menu items
  const menuItems = [
    {
      label: 'Bekijken',
      icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
      action: () => {
        openAiRecommendationModal(recommendationId);
        dropdown.remove();
      }
    },
    { divider: true },
    {
      label: 'Goedkeuren',
      icon: 'M20 6L9 17l-5-5',
      action: async () => {
        dropdown.remove();
        // Always open modal first
        currentRecommendationId = recommendationId;
        await openAiRecommendationModal(recommendationId);
      }
    },
    {
      label: 'Afwijzen',
      icon: 'M6 18L18 6M6 6l12 12',
      danger: true,
      action: async () => {
        dropdown.remove();
        // Always open modal first
        currentRecommendationId = recommendationId;
        await openAiRecommendationModal(recommendationId);
      }
    }
  ];

  // Create menu items
  menuItems.forEach((item, index) => {
    // Handle divider - skip creating menu item for dividers
    if (item.divider) {
      const separator = document.createElement('div');
      separator.style.cssText = 'height: 1px; background: #e5e7eb; margin: 4px 0;';
      dropdown.appendChild(separator);
      return;
    }
    
    if (index > 0 && item.danger) {
      // Add separator before danger item
      const separator = document.createElement('div');
      separator.style.cssText = 'border-top: 1px solid #e5e7eb; margin: 4px 0;';
      dropdown.appendChild(separator);
    }

    const menuItem = document.createElement('div');
    menuItem.className = 'actions-menu-item';
    menuItem.style.cssText = `
      display: flex;
      align-items: center;
      padding: 8px 12px;
      cursor: pointer;
      font-size: 14px;
      color: ${item.danger ? '#dc2626' : '#374151'};
      transition: background-color 0.15s;
    `;
    
    menuItem.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
        <path d="${item.icon}"/>
      </svg>
      ${item.label}
    `;

    menuItem.addEventListener('mouseenter', () => {
      menuItem.style.backgroundColor = '#f9fafb';
    });

    menuItem.addEventListener('mouseleave', () => {
      menuItem.style.backgroundColor = 'transparent';
    });

    menuItem.addEventListener('click', () => {
      item.action();
    });

    dropdown.appendChild(menuItem);
  });

  // Position dropdown
  const button = event.target.closest('.actions-button');
  const rect = button.getBoundingClientRect();
  dropdown.style.left = `${rect.right - 200}px`;
  dropdown.style.top = `${rect.bottom + 4}px`;

  // Add to document
  document.body.appendChild(dropdown);

  // Close dropdown when clicking outside
  const closeDropdown = (e) => {
    if (!dropdown.contains(e.target) && !button.contains(e.target)) {
      dropdown.remove();
      document.removeEventListener('click', closeDropdown);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', closeDropdown);
  }, 0);
}

function openContentItemModal(id) {
  // TODO: Open content item modal
  console.log('Open content item:', id);
}

// Chart initialization (using Chart.js)
function initLeadsChart() {
  const ctx = document.getElementById('leads-chart');
  if (!ctx) return;
  
  // Destroy existing chart if it exists
  if (leadsChart) {
    leadsChart.destroy();
  }
  
  leadsChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: MOCK_CHART_DATA.map(d => d.date),
      datasets: [
        {
          label: 'Target',
          data: MOCK_CHART_DATA.map(d => d.target),
          borderColor: 'rgb(209, 213, 219)',
          backgroundColor: 'rgba(209, 213, 219, 0.1)',
          borderWidth: 2,
          tension: 0.4
        },
        {
          label: 'Actual',
          data: MOCK_CHART_DATA.map(d => d.actual),
          borderColor: 'rgb(17, 24, 39)',
          backgroundColor: 'rgba(17, 24, 39, 0.1)',
          borderWidth: 2,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// Load tab HTML content via fetch
async function loadTabHTML(tabName, container) {
  try {
    const response = await fetch(`/admin/leads/engine/partials/${tabName}`);
    if (response.ok) {
      const html = await response.text();
      container.innerHTML = html;
      // Re-initialize any components after loading
      if (tabName === 'overview') {
        initLeadsChart();
      }
    } else {
      // Fallback: load from inline templates
      loadTabHTMLInline(tabName, container);
    }
  } catch (error) {
    console.error('Error loading tab HTML:', error);
    // Fallback: load from inline templates
    loadTabHTMLInline(tabName, container);
  }
}

// Fallback: Load tab HTML from inline templates (defined in data file)
function loadTabHTMLInline(tabName, container) {
  // For now, we'll render the content directly via JS
  // This will be populated by the render functions
  console.log('Loading inline HTML for tab:', tabName);
}

// Helper functions voor badge styling
function getStatusBadgeClass(status) {
  switch(status) {
    case 'onder': return 'bg-red-50 text-red-700';
    case 'balans': return 'bg-gray-100 text-gray-800';
    case 'over': return 'bg-green-50 text-green-700';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getStatusLabel(status) {
  switch(status) {
    case 'onder': return 'Onder target';
    case 'balans': return 'In balans';
    case 'over': return 'Overtarget';
    default: return status;
  }
}

function getImpactBadgeClass(impact) {
  switch(impact) {
    case 'Hoog': return 'bg-gray-100 text-gray-900';
    case 'Medium': return 'bg-gray-50 text-gray-700';
    case 'Laag': return 'bg-gray-50 text-gray-600';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getAiStatusBadgeClass(status) {
  switch(status) {
    case 'Wacht op review': return 'bg-yellow-50 text-yellow-700';
    case 'In uitvoering': return 'bg-blue-50 text-blue-700';
    case 'Uitgevoerd': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getContentStatusBadgeClass(status) {
  switch(status) {
    case 'Idee': return 'bg-gray-50 text-gray-600';
    case 'Concept': return 'bg-blue-50 text-blue-700';
    case 'Wacht op review': return 'bg-yellow-50 text-yellow-700';
    case 'Goedgekeurd': return 'bg-gray-100 text-gray-800';
    case 'Live': return 'bg-gray-100 text-gray-900';
    default: return 'bg-gray-100 text-gray-800';
  }
}

// =====================================================
// CAMPAGNES TAB - Google Ads Management
// =====================================================

async function renderCampagnesTab() {
  console.log('Loading Campagnes tab...');
  
  // Show skeleton loaders for campagnes tab KPIs
  showKPILoading('campagnes');
  
  // Load Google Ads accounts
  await loadGoogleAdsAccounts();
  
  // Load campaigns
  await loadCampaigns();
  
  // Load performance stats (updates KPIs)
  await loadCampaignPerformanceStats();
  
  // Setup event listeners
  setupCampagnesTabListeners();
}

async function loadGoogleAdsAccounts() {
  try {
    const response = await fetch('/api/admin/google-ads/accounts', {
      credentials: 'same-origin' // Include cookies for authentication
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn('Niet geautoriseerd - mogelijk niet ingelogd');
        const tbody = document.getElementById('google-ads-accounts-table-body');
        if (tbody) {
          tbody.innerHTML = `
            <tr>
              <td colspan="6" class="text-center py-8 text-gray-500">
                <p>Je moet ingelogd zijn om accounts te bekijken.</p>
              </td>
            </tr>
          `;
        }
        return;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    const tbody = document.getElementById('google-ads-accounts-table-body');
    if (!tbody) return;
    
    if (!data.success || !data.data || data.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-gray-500">
            <p>Geen Google Ads accounts gevonden.</p>
            <p class="text-sm mt-2">Klik op "Account Toevoegen" om je eerste account te verbinden.</p>
          </td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = data.data.map(account => `
      <tr>
        <td>${escapeHtml(account.account_name || 'N/A')}</td>
        <td><code class="text-xs bg-gray-100 px-2 py-1 rounded">${account.customer_id}</code></td>
        <td>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            account.is_manager_account ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
          }">
            ${account.is_manager_account ? 'Manager Account' : 'Customer Account'}
          </span>
        </td>
        <td>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            account.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }">
            ${account.is_active ? 'Actief' : 'Inactief'}
          </span>
        </td>
        <td class="text-sm text-gray-500">
          ${account.last_synced_at ? new Date(account.last_synced_at).toLocaleDateString('nl-NL') : 'Nog niet gesynced'}
        </td>
        <td style="text-align: right;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
            <button 
              onclick="syncAccountCampaigns('${account.customer_id}')"
              class="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              title="Sync campagnes"
            >
              <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Sync
            </button>
            <button 
              onclick="deleteAccount('${account.id}')"
              class="inline-flex items-center px-3 py-1.5 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              title="Verwijder account"
            >
              <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Verwijder
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading Google Ads accounts:', error);
    const tbody = document.getElementById('google-ads-accounts-table-body');
    if (tbody) {
      // Check if it's a JSON parse error (likely HTML response)
      if (error.message && error.message.includes('JSON')) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-8 text-yellow-600">
              <p>⚠️ Server geeft geen JSON response terug.</p>
              <p class="text-sm mt-2">Mogelijk moet je opnieuw inloggen of de server herstarten.</p>
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-8 text-red-500">
              <p>Fout bij het laden van accounts: ${error.message}</p>
            </td>
          </tr>
        `;
      }
    }
  }
}

async function loadCampaigns() {
  try {
    const accountFilter = document.getElementById('filter-account')?.value || '';
    const segmentFilter = document.getElementById('filter-campaign-segment')?.value || '';
    const statusFilter = document.getElementById('filter-campaign-status')?.value || '';
    
    const params = new URLSearchParams();
    if (accountFilter) params.append('account', accountFilter);
    if (segmentFilter) params.append('segment', segmentFilter);
    if (statusFilter) params.append('status', statusFilter);
    
    const response = await fetch(`/api/admin/google-ads/campaigns?${params.toString()}`, {
      credentials: 'same-origin' // Include cookies for authentication
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn('Niet geautoriseerd');
        const tbody = document.getElementById('campaigns-table-body');
        if (tbody) {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" class="text-center py-8 text-gray-500">
                <p>Je moet ingelogd zijn om campagnes te bekijken.</p>
              </td>
            </tr>
          `;
        }
        return;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    const tbody = document.getElementById('campaigns-table-body');
    if (!tbody) return;
    
    if (!data.success || !data.data || data.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-8 text-gray-500">
            <p>Geen campagnes gevonden.</p>
            <p class="text-sm mt-2">Klik op "Sync Campagnes" om campagnes van Google Ads te halen.</p>
          </td>
        </tr>
      `;
      return;
    }
    
    tbody.innerHTML = data.data.map(campaign => `
      <tr>
        <td>${escapeHtml(campaign.name || 'N/A')}</td>
        <td>
          ${campaign.segment ? `
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              ${escapeHtml(campaign.segment.code || 'N/A')}
            </span>
          ` : '<span class="text-gray-400">Niet gekoppeld</span>'}
        </td>
        <td><code class="text-xs bg-gray-100 px-2 py-1 rounded">${campaign.account_id || 'N/A'}</code></td>
        <td class="font-medium">€${(campaign.daily_budget || 0).toFixed(2)}/dag</td>
        <td>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            campaign.status === 'ENABLED' ? 'bg-green-100 text-green-800' : 
            campaign.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' : 
            'bg-gray-100 text-gray-800'
          }">
            ${campaign.status === 'ENABLED' ? 'Actief' : 
              campaign.status === 'PAUSED' ? 'Gepauzeerd' : 
              campaign.status || 'Onbekend'}
          </span>
        </td>
        <td class="text-sm text-gray-500">
          ${campaign.last_synced_at ? new Date(campaign.last_synced_at).toLocaleDateString('nl-NL') : 'Nog niet gesynced'}
        </td>
        <td style="text-align: right;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
            ${campaign.status === 'PAUSED' ? `
              <button 
                onclick="updateCampaignStatus('${campaign.id}', 'ENABLED', '${campaign.account_id || ''}')"
                class="inline-flex items-center px-3 py-1.5 border border-green-300 rounded-md text-sm font-medium text-green-700 bg-white hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                title="Activeer campagne"
              >
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Activeren
              </button>
            ` : campaign.status === 'ENABLED' ? `
              <button 
                onclick="updateCampaignStatus('${campaign.id}', 'PAUSED', '${campaign.account_id || ''}')"
                class="inline-flex items-center px-3 py-1.5 border border-yellow-300 rounded-md text-sm font-medium text-yellow-700 bg-white hover:bg-yellow-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition-colors"
                title="Pauzeer campagne"
              >
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Pauzeren
              </button>
            ` : ''}
            ${campaign.segment_id ? `
              <button 
                onclick="editCampaignBudget('${campaign.segment_id}', '${campaign.id}', '${escapeHtml(campaign.name)}', ${campaign.daily_budget || 0})"
                class="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                title="Budget aanpassen"
              >
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Budget
              </button>
            ` : ''}
            <button 
              onclick="viewCampaignStats('${campaign.id}')"
              class="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              title="Bekijk statistieken"
            >
              <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              Stats
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading campaigns:', error);
    const tbody = document.getElementById('campaigns-table-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-8 text-red-500">
            <p>Fout bij het laden van campagnes: ${error.message}</p>
          </td>
        </tr>
      `;
    }
  }
}

async function loadCampaignPerformanceStats() {
  try {
    // Get campaigns count and performance stats in parallel
    const [campaignsResponse, statsResponse] = await Promise.all([
      fetch('/api/admin/google-ads/campaigns', {
        credentials: 'same-origin'
      }).catch(() => null),
      fetch('/api/admin/google-ads/performance-stats', {
        credentials: 'same-origin'
      }).catch(() => null)
    ]);
    
    let activeCampaignsCount = 0;
    if (campaignsResponse && campaignsResponse.ok) {
      try {
        const campaignsData = await campaignsResponse.json();
        if (campaignsData.success && campaignsData.data) {
          activeCampaignsCount = campaignsData.data.length;
        }
      } catch (e) {
        console.warn('Could not parse campaigns data:', e);
      }
    }
    
    let stats = {
      total_spend: 0,
      total_clicks: 0,
      avg_cpl: 0
    };
    
    if (statsResponse && statsResponse.ok) {
      try {
        const statsData = await statsResponse.json();
        if (statsData.success && statsData.data) {
          stats = statsData.data;
        }
      } catch (e) {
        console.warn('Could not parse stats data:', e);
      }
    }
    
    // Update KPIs
    updateCampagnesKPIs({
      active_campaigns: activeCampaignsCount,
      total_spend: stats.total_spend || 0,
      total_clicks: stats.total_clicks || 0,
      avg_cpl: stats.avg_cpl || 0
    });
  } catch (error) {
    console.error('Error loading performance stats:', error);
    // Set default values on error
    updateCampagnesKPIs({
      active_campaigns: 0,
      total_spend: 0,
      total_clicks: 0,
      avg_cpl: 0
    });
  }
}

function updateCampagnesKPIs(kpis) {
  // Remove loading state
  removeKPILoading('campagnes');
  
  // Update KPI cards
  const activeCampaignsEl = document.getElementById('kpi-active-campaigns');
  if (activeCampaignsEl) {
    activeCampaignsEl.textContent = kpis.active_campaigns ?? 0;
    activeCampaignsEl.classList.remove('loading');
  }
  
  const totalSpendEl = document.getElementById('kpi-total-spend');
  if (totalSpendEl) {
    totalSpendEl.textContent = `€${(kpis.total_spend ?? 0).toFixed(2)}`;
    totalSpendEl.classList.remove('loading');
  }
  
  const totalClicksEl = document.getElementById('kpi-total-clicks');
  if (totalClicksEl) {
    totalClicksEl.textContent = (kpis.total_clicks ?? 0).toLocaleString();
    totalClicksEl.classList.remove('loading');
  }
  
  const avgCplEl = document.getElementById('kpi-avg-cpl');
  if (avgCplEl) {
    avgCplEl.textContent = `€${(kpis.avg_cpl ?? 0).toFixed(2)}`;
    avgCplEl.classList.remove('loading');
  }
}

function setupCampagnesTabListeners() {
  // Add account button
  const addAccountBtn = document.getElementById('add-google-ads-account-btn');
  if (addAccountBtn) {
    addAccountBtn.addEventListener('click', () => {
      document.getElementById('add-account-modal').style.display = 'block';
    });
  }
  
  // Add account form
  const addAccountForm = document.getElementById('add-account-form');
  if (addAccountForm) {
    addAccountForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitAddAccount();
    });
  }
  
  // Sync campaigns button
  const syncBtn = document.getElementById('sync-campaigns-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      await syncAllCampaigns();
    });
  }
  
  // Filters
  const filters = ['filter-account', 'filter-campaign-segment', 'filter-campaign-status'];
  filters.forEach(filterId => {
    const filter = document.getElementById(filterId);
    if (filter) {
      filter.addEventListener('change', () => {
        loadCampaigns();
      });
    }
  });
  
  // Edit budget form
  const editBudgetForm = document.getElementById('edit-budget-form');
  if (editBudgetForm) {
    editBudgetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitBudgetUpdate();
    });
  }
}

async function submitAddAccount() {
  const name = document.getElementById('account-name').value;
  const customerId = document.getElementById('account-customer-id').value.replace(/-/g, '');
  const isManager = document.getElementById('account-type').value === 'manager';
  
  try {
    const response = await fetch('/api/admin/google-ads/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_name: name,
        customer_id: customerId,
        is_manager_account: isManager
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('Account succesvol toegevoegd!', 'success');
      closeAddAccountModal();
      await loadGoogleAdsAccounts();
    } else {
      showNotification(`Fout: ${data.error || 'Onbekende fout'}`, 'error');
    }
  } catch (error) {
    showNotification(`Fout: ${error.message}`, 'error');
  }
}

async function syncAllCampaigns() {
  const btn = document.getElementById('sync-campaigns-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Syncing...';
  
  try {
    const response = await fetch('/api/admin/google-ads/sync-campaigns', {
      method: 'POST',
      credentials: 'same-origin'
    });
    
    const data = await response.json();
    
    if (data.success) {
      const result = data.data;
      // Show detailed sync results in modal
      showSyncResultsModal(result);
      await loadCampaigns();
      await loadGoogleAdsAccounts();
    } else {
      showNotification(`Sync gefaald: ${data.error || 'Onbekende fout'}`, 'error');
    }
  } catch (error) {
    showNotification(`Fout: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

function showSyncResultsModal(result) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <div class="modal-header">
        <h2>Sync Resultaten</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 20px;">
          <div style="display: flex; gap: 16px; margin-bottom: 16px;">
            <div style="flex: 1; padding: 12px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <div style="font-size: 24px; font-weight: 600; color: #1e40af;">${result.synced || 0}</div>
              <div style="font-size: 14px; color: #64748b;">Campagnes Gekoppeld</div>
            </div>
            <div style="flex: 1; padding: 12px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
              <div style="font-size: 24px; font-weight: 600; color: #92400e;">${result.unlinkedCampaigns?.length || 0}</div>
              <div style="font-size: 14px; color: #64748b;">Niet Gekoppeld</div>
            </div>
            <div style="flex: 1; padding: 12px; background: #fee2e2; border-radius: 8px; border-left: 4px solid #ef4444;">
              <div style="font-size: 24px; font-weight: 600; color: #991b1b;">${result.errors?.length || 0}</div>
              <div style="font-size: 14px; color: #64748b;">Fouten</div>
            </div>
          </div>
        </div>
        
        ${result.syncedCampaigns && result.syncedCampaigns.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #1e40af;">
              ✅ Gekoppelde Campagnes (${result.syncedCampaigns.length})
            </h3>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px;">
              ${result.syncedCampaigns.map(c => `
                <div style="padding: 8px; border-bottom: 1px solid #f3f4f6;">
                  <div style="font-weight: 500; color: #111827;">${escapeHtml(c.campaignName)}</div>
                  <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                    → Gekoppeld aan segment: <strong>${escapeHtml(c.segmentCode)}</strong>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${result.unlinkedCampaigns && result.unlinkedCampaigns.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #f59e0b;">
              ⚠️ Niet Gekoppelde Campagnes (${result.unlinkedCampaigns.length})
            </h3>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px;">
              ${result.unlinkedCampaigns.map(c => `
                <div style="padding: 8px; border-bottom: 1px solid #f3f4f6;">
                  <div style="font-weight: 500; color: #111827;">${escapeHtml(c.campaignName)}</div>
                  <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                    ${escapeHtml(c.reason)}
                  </div>
                </div>
              `).join('')}
            </div>
            <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">
              💡 Tip: Zorg dat de campagne naam de segment code bevat (bijv. "Campagne ABC123" voor segment "ABC123")
            </p>
          </div>
        ` : ''}
        
        ${result.errors && result.errors.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #ef4444;">
              ❌ Fouten (${result.errors.length})
            </h3>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px;">
              ${result.errors.map(e => `
                <div style="padding: 8px; border-bottom: 1px solid #f3f4f6;">
                  <div style="font-weight: 500; color: #111827;">${escapeHtml(e.campaignName)}</div>
                  <div style="font-size: 12px; color: #dc2626; margin-top: 4px;">
                    ${escapeHtml(e.error)}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div style="margin-top: 20px; padding: 12px; background: #f9fafb; border-radius: 6px;">
          <p style="font-size: 14px; color: #374151; margin: 0;">
            <strong>Samenvatting:</strong> ${result.totalCampaigns || 0} campagnes gevonden in Google Ads, 
            ${result.synced || 0} succesvol gekoppeld aan segmenten, 
            ${result.totalSegments || 0} actieve segmenten beschikbaar.
          </p>
        </div>
        
        <div style="margin-top: 20px; display: flex; gap: 8px; justify-content: flex-end;">
          <button 
            id="verify-connection-btn"
            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            onclick="verifyGoogleAdsConnection()"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Verifieer Connectie
          </button>
          <button 
            onclick="this.closest('.modal').remove(); document.body.classList.remove('modal-open');"
            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  `;

  // Add event listeners
  const closeModal = () => {
    modal.remove();
    document.body.classList.remove('modal-open');
  };

  modal.querySelector('.modal-close').addEventListener('click', closeModal);

  // Show modal
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  modal.style.display = 'flex';
}

// Make verifyGoogleAdsConnection globally available
window.verifyGoogleAdsConnection = async function verifyGoogleAdsConnection() {
  const btn = document.getElementById('verify-connection-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div> Verifiëren...';
  }
  
  try {
    const response = await fetch('/api/admin/google-ads/verify', {
      credentials: 'same-origin'
    });
    
    const data = await response.json();
    
    if (data.success) {
      const result = data.data;
      showVerificationResultsModal(result);
    } else {
      showNotification(`Verificatie gefaald: ${data.error || 'Onbekende fout'}`, 'error');
    }
  } catch (error) {
    showNotification(`Fout: ${error.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        Verifieer Connectie
      `;
    }
  }
}

function showVerificationResultsModal(result) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 900px;">
      <div class="modal-header">
        <h2>Google Ads Verificatie</h2>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div style="margin-bottom: 20px; padding: 16px; background: ${result.apiConnected ? '#d1fae5' : '#fee2e2'}; border-radius: 8px; border-left: 4px solid ${result.apiConnected ? '#10b981' : '#ef4444'};">
          <div style="display: flex; align-items: center; gap: 12px;">
            ${result.apiConnected ? '<span style="font-size: 24px;">✅</span>' : '<span style="font-size: 24px;">❌</span>'}
            <div>
              <div style="font-weight: 600; font-size: 16px; color: #111827;">
                ${result.apiConnected ? 'API Connectie Actief' : 'API Connectie Gefaald'}
              </div>
              <div style="font-size: 14px; color: #6b7280; margin-top: 4px;">
                ${result.apiConnected ? 'Google Ads API is succesvol verbonden' : 'Kon geen verbinding maken met Google Ads API'}
              </div>
            </div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="padding: 12px; background: #f0f9ff; border-radius: 8px;">
            <div style="font-size: 20px; font-weight: 600; color: #1e40af;">${result.totalCampaignsInGoogleAds || 0}</div>
            <div style="font-size: 12px; color: #64748b;">Campagnes in Google Ads</div>
          </div>
          <div style="padding: 12px; background: #f0fdf4; border-radius: 8px;">
            <div style="font-size: 20px; font-weight: 600; color: #15803d;">${result.verifiedLinks || 0}</div>
            <div style="font-size: 12px; color: #64748b;">Geverifieerde Koppelingen</div>
          </div>
          <div style="padding: 12px; background: #fef3c7; border-radius: 8px;">
            <div style="font-size: 20px; font-weight: 600; color: #92400e;">${result.brokenLinks || 0}</div>
            <div style="font-size: 12px; color: #64748b;">Verbroken Koppelingen</div>
          </div>
          <div style="padding: 12px; background: #f3f4f6; border-radius: 8px;">
            <div style="font-size: 20px; font-weight: 600; color: #374151;">${result.totalSegments || 0}</div>
            <div style="font-size: 12px; color: #64748b;">Totaal Segmenten</div>
          </div>
        </div>
        
        ${result.verifiedLinks && result.verifiedLinks.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #15803d;">
              ✅ Geverifieerde Koppelingen (${result.verifiedLinks.length})
            </h3>
            <div style="max-height: 250px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px;">
              ${result.verifiedLinks.map(link => `
                <div style="padding: 10px; border-bottom: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-weight: 500; color: #111827;">${escapeHtml(link.campaignName)}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                      Segment: <strong>${escapeHtml(link.segmentCode)}</strong> | 
                      Campaign ID: <code>${link.campaignId}</code> | 
                      Laatste sync: ${link.lastSynced ? new Date(link.lastSynced).toLocaleString('nl-NL') : 'Onbekend'}
                    </div>
                  </div>
                  <span style="padding: 4px 8px; background: #d1fae5; color: #15803d; border-radius: 4px; font-size: 12px; font-weight: 500;">✓ Actief</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${result.brokenLinks && result.brokenLinks.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #dc2626;">
              ❌ Verbroken Koppelingen (${result.brokenLinks.length})
            </h3>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px;">
              ${result.brokenLinks.map(link => `
                <div style="padding: 10px; border-bottom: 1px solid #f3f4f6;">
                  <div style="font-weight: 500; color: #111827;">${escapeHtml(link.campaignName || 'Onbekend')}</div>
                  <div style="font-size: 12px; color: #dc2626; margin-top: 4px;">
                    Segment: <strong>${escapeHtml(link.segmentCode)}</strong> | 
                    ${escapeHtml(link.reason)}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        ${result.unlinkedCampaigns && result.unlinkedCampaigns.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #f59e0b;">
              ⚠️ Niet Gekoppelde Campagnes (${result.unlinkedCampaigns.length})
            </h3>
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px;">
              ${result.unlinkedCampaigns.map(c => `
                <div style="padding: 8px; border-bottom: 1px solid #f3f4f6;">
                  <div style="font-weight: 500; color: #111827;">${escapeHtml(c.campaignName)}</div>
                  <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                    ${escapeHtml(c.reason)}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
          <button 
            onclick="this.closest('.modal').remove(); document.body.classList.remove('modal-open');"
            class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm text-sm font-medium hover:bg-blue-700"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  `;

  // Add event listeners
  const closeModal = () => {
    modal.remove();
    document.body.classList.remove('modal-open');
  };

  modal.querySelector('.modal-close').addEventListener('click', closeModal);

  // Show modal
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  modal.style.display = 'flex';
}

function editCampaignBudget(segmentId, campaignId, campaignName, currentBudget) {
  document.getElementById('edit-budget-campaign-id').value = campaignId;
  document.getElementById('edit-budget-segment-id').value = segmentId;
  document.getElementById('edit-budget-campaign-name').textContent = campaignName;
  document.getElementById('edit-budget-current').textContent = `€${currentBudget.toFixed(2)}/dag`;
  document.getElementById('edit-budget-amount').value = currentBudget;
  document.getElementById('edit-budget-modal').style.display = 'block';
}

async function submitBudgetUpdate() {
  const segmentId = document.getElementById('edit-budget-segment-id').value;
  const dailyBudget = parseFloat(document.getElementById('edit-budget-amount').value);
  
  if (dailyBudget < 5 || dailyBudget > 1000) {
    showNotification('Budget moet tussen €5 en €1,000 zijn', 'error');
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/google-ads/segments/${segmentId}/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dailyBudget })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showNotification('Budget succesvol bijgewerkt!', 'success');
      closeEditBudgetModal();
      await loadCampaigns();
    } else {
      showNotification(`Fout: ${data.error || 'Onbekende fout'}`, 'error');
    }
  } catch (error) {
    showNotification(`Fout: ${error.message}`, 'error');
  }
}

function closeAddAccountModal() {
  document.getElementById('add-account-modal').style.display = 'none';
  document.getElementById('add-account-form').reset();
}

function closeEditBudgetModal() {
  document.getElementById('edit-budget-modal').style.display = 'none';
  document.getElementById('edit-budget-form').reset();
}

async function syncAccountCampaigns(customerId) {
  createConfirmModal(
    'Campagnes Synchroniseren',
    `Wil je campagnes syncen voor account <strong>${customerId}</strong>?`,
    'Sync',
    'Annuleren',
    async () => {
      try {
        const response = await fetch('/api/admin/google-ads/sync-campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer_id: customerId })
        });
        
        const data = await response.json();
        
        if (data.success) {
          showNotification(`Sync voltooid! ${data.data.synced || 0} campagnes gesynced.`, 'success');
          await loadCampaigns();
          await loadGoogleAdsAccounts();
        } else {
          showNotification(`Sync gefaald: ${data.error || 'Onbekende fout'}`, 'error');
        }
      } catch (error) {
        showNotification(`Fout: ${error.message}`, 'error');
      }
    }
  );
}

async function deleteAccount(accountId) {
  createConfirmModal(
    'Account Verwijderen',
    'Weet je zeker dat je dit account wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.',
    'Verwijderen',
    'Annuleren',
    async () => {
      try {
        const response = await fetch(`/api/admin/google-ads/accounts/${accountId}`, {
          method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
          showNotification('Account verwijderd!', 'success');
          await loadGoogleAdsAccounts();
        } else {
          showNotification(`Fout: ${data.error || 'Onbekende fout'}`, 'error');
        }
      } catch (error) {
        showNotification(`Fout: ${error.message}`, 'error');
      }
    }
  );
}

function viewCampaignStats(campaignId) {
  // TODO: Implement campaign stats view
  showNotification('Campaign stats functionaliteit komt binnenkort!', 'info');
}

// Make updateCampaignStatus globally available
window.updateCampaignStatus = async function updateCampaignStatus(campaignId, newStatus, customerId) {
  const statusLabels = {
    'ENABLED': 'activeren',
    'PAUSED': 'pauzeren',
    'REMOVED': 'verwijderen'
  };
  
  const actionLabel = statusLabels[newStatus] || 'wijzigen';
  
  createConfirmModal(
    `Campagne ${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)}`,
    `Weet je zeker dat je deze campagne wilt ${actionLabel}?`,
    newStatus === 'ENABLED' ? 'Activeren' : newStatus === 'PAUSED' ? 'Pauzeren' : 'Verwijderen',
    'Annuleren',
    async () => {
      try {
        const response = await fetch(`/api/admin/google-ads/campaigns/${campaignId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            status: newStatus,
            customer_id: customerId
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          showNotification(`Campagne succesvol ${actionLabel}!`, 'success');
          await loadCampaigns();
        } else {
          showNotification(`Fout: ${data.error || 'Onbekende fout'}`, 'error');
        }
      } catch (error) {
        showNotification(`Fout: ${error.message}`, 'error');
      }
    }
  );
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// AI RECOMMENDATIONS WIDGET
// ============================================
let aiWidgetOpen = false;
let aiWidgetRecommendations = [];

async function initializeAiWidget() {
  const widget = document.getElementById('ai-recommendations-widget');
  if (!widget) return;

  // Load recommendations
  await loadAiWidgetRecommendations();

  // Setup click handler
  const widgetContent = widget.querySelector('.ai-widget-content');
  if (widgetContent) {
    widgetContent.addEventListener('click', toggleAiWidget);
  }

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (aiWidgetOpen && !widget.contains(e.target)) {
      closeAiWidget();
    }
  });

  // Auto-refresh every 30 seconds
  setInterval(async () => {
    if (!aiWidgetOpen) {
      await loadAiWidgetRecommendations();
    }
  }, 30000);
}

async function loadAiWidgetRecommendations() {
  try {
    const response = await fetch('/api/admin/leadstroom/ai-actions?status=pending', {
      credentials: 'include'
    });

    if (!response.ok) return;

    const result = await response.json();
    if (!result.success || !result.data) return;

    const recommendations = result.data.recommendations || [];
    aiWidgetRecommendations = recommendations.slice(0, 5).map(rec => ({
      ...rec,
      priority: rec.impact === 'Hoog' ? 'high' : rec.impact === 'Medium' ? 'medium' : 'low',
      createdAt: rec.lastUpdated || rec.createdAt
    }));

    // Update count
    const countEl = document.getElementById('ai-widget-count');
    if (countEl) {
      countEl.textContent = recommendations.length || '0';
    }

    // Show badge if there are new recommendations
    const badge = document.getElementById('ai-widget-badge');
    if (badge && recommendations.length > 0) {
      badge.style.display = 'block';
      const badgeText = document.getElementById('ai-widget-badge-text');
      if (badgeText) {
        badgeText.textContent = recommendations.length > 9 ? '9+' : recommendations.length.toString();
      }
    } else if (badge) {
      badge.style.display = 'none';
    }

    // Update dropdown content if open
    if (aiWidgetOpen) {
      renderAiWidgetDropdown();
    }
  } catch (error) {
    console.error('Error loading AI widget recommendations:', error);
  }
}

function toggleAiWidget() {
  if (aiWidgetOpen) {
    closeAiWidget();
  } else {
    openAiWidget();
  }
}

function openAiWidget() {
  const dropdown = document.getElementById('ai-widget-dropdown');
  if (!dropdown) return;

  aiWidgetOpen = true;
  dropdown.style.display = 'block';
  renderAiWidgetDropdown();
}

function closeAiWidget() {
  const dropdown = document.getElementById('ai-widget-dropdown');
  if (!dropdown) return;

  aiWidgetOpen = false;
  dropdown.style.display = 'none';
}

function renderAiWidgetDropdown() {
  const content = document.getElementById('ai-widget-recommendations-list');
  if (!content) return;

  if (aiWidgetRecommendations.length === 0) {
    content.innerHTML = `
      <div class="ai-widget-empty">
        <div class="ai-widget-empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
          </svg>
        </div>
        <div class="ai-widget-empty-text">Geen nieuwe aanbevelingen</div>
        <div class="ai-widget-empty-subtext">AI analyseert je leadstroom en genereert binnenkort nieuwe acties</div>
      </div>
    `;
    return;
  }

  content.innerHTML = aiWidgetRecommendations.map(rec => {
    const priorityClass = rec.priority === 'high' ? 'high' : rec.priority === 'medium' ? 'medium' : 'low';
    const priorityLabel = rec.priority === 'high' ? 'Hoog' : rec.priority === 'medium' ? 'Medium' : 'Laag';
    const actionTypeLabel = {
      'create_landing_page': 'Landingspagina',
      'create_campaign': 'Google Ads Campagne',
      'publish_landing_page': 'Publiceren',
      'increase_campaign_budget': 'Budget Verhogen'
    }[rec.actionType] || (rec.summary || rec.actionType || 'Onbekend');

    return `
      <div class="ai-widget-recommendation-item priority-${rec.priority}" onclick="openAiRecommendationModal('${rec.id}'); closeAiWidget();">
        <div class="ai-widget-rec-header">
          <div class="ai-widget-rec-title">${escapeHtml(actionTypeLabel)}</div>
          <span class="ai-widget-rec-priority ${priorityClass}">${priorityLabel}</span>
        </div>
        <div class="ai-widget-rec-description">${escapeHtml(rec.summary || rec.reason || 'Geen beschrijving beschikbaar')}</div>
        <div class="ai-widget-rec-meta">
          <span class="ai-widget-rec-segment">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            ${escapeHtml(rec.segmentLabel || 'Onbekend segment')}
          </span>
          <span>•</span>
          <span>${formatTimeAgo(rec.createdAt || rec.lastUpdated)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Onbekend';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Zojuist';
  if (diffMins < 60) return `${diffMins}m geleden`;
  if (diffHours < 24) return `${diffHours}u geleden`;
  if (diffDays < 7) return `${diffDays}d geleden`;
  
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// Make closeAiWidget globally available
window.closeAiWidget = closeAiWidget;

