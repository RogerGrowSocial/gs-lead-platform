// Scraper Page JavaScript

(function() {
  'use strict';

  // State
  let currentJobId = null;
  let progressInterval = null;
  let resultsInterval = null;
  let availableBranches = [];
  let selectedBranches = [];

  // Define functions first
  function selectBranch(branch) {
    if (branch && !selectedBranches.includes(branch)) {
      addBranch(branch);
      const input = document.getElementById('branchInput');
      const dropdown = document.getElementById('branchDropdown');
      if (input) input.value = '';
      if (dropdown) dropdown.style.display = 'none';
    }
  }

  function addCustomBranch(branch) {
    if (branch && !selectedBranches.includes(branch)) {
      addBranch(branch);
      const input = document.getElementById('branchInput');
      const dropdown = document.getElementById('branchDropdown');
      if (input) input.value = '';
      if (dropdown) dropdown.style.display = 'none';
    }
  }

  function addBranch(branch) {
    if (branch && !selectedBranches.includes(branch)) {
      selectedBranches.push(branch);
      renderSelectedBranches();
    }
  }

  function removeBranch(branch) {
    selectedBranches = selectedBranches.filter(b => b !== branch);
    renderSelectedBranches();
  }

  function renderSelectedBranches() {
    const container = document.getElementById('selectedBranches');
    if (!container) return;

    container.innerHTML = selectedBranches.map(branch => {
      const escapedBranch = branch.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
      return `
        <span class="tag">
          ${escapeHtml(branch)}
          <button type="button" class="tag-remove" onclick="window.scraperApp.removeBranch('${escapedBranch}')">×</button>
        </span>
      `;
    }).join('');
  }

  // Define showDetail function early (will be implemented later)
  let showDetailFunction = null;
  
  // Expose functions early so onclick handlers can use them
  window.scraperApp = {
    removeBranch: removeBranch,
    showDetail: function(resultId) {
      if (showDetailFunction) {
        return showDetailFunction(resultId);
      }
      // If not yet available, try to call it directly
      if (typeof showDetail === 'function') {
        return showDetail(resultId);
      }
      console.warn('showDetail not yet available');
    },
    addCustomBranch: addCustomBranch,
    selectBranch: selectBranch
  };

  // Initialize
  document.addEventListener('DOMContentLoaded', function() {
    // Load branches from window (passed from server)
    if (typeof window.scraperBranches !== 'undefined' && Array.isArray(window.scraperBranches)) {
      availableBranches = window.scraperBranches.map(b => b.name || b);
    }
    
    initBranches();
    initEventListeners();
    
    // Check for active job on page load (persist across reloads)
    checkActiveJob();
    
    loadHistory();
  });
  
  // Stop all polling when page is unloaded or hidden
  window.addEventListener('beforeunload', function() {
    stopProgressPolling();
  });
  
  // Also stop when page becomes hidden (tab switch, etc.)
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // Page is hidden, but don't stop polling completely (user might come back)
      // Just reduce frequency or pause
    } else {
      // Page is visible again, check if we need to resume
      if (currentJobId && !progressInterval && !resultsInterval) {
        // Job exists but polling stopped, check if it's still active
        checkActiveJob();
      }
    }
  });
  
  // Check if there's an active job and restore it
  async function checkActiveJob() {
    try {
      // Stop any existing polling first
      stopProgressPolling();
      
      // First check localStorage for quick restore
      const savedJobId = localStorage.getItem('scraper_active_job_id');
      if (savedJobId) {
        const response = await fetch(`/api/admin/scraper/jobs/${savedJobId}`);
        const data = await response.json();
        
        if (data.job && (data.job.status === 'queued' || data.job.status === 'running')) {
          // Job is still active, restore it
          currentJobId = data.job.id;
          showJobProgress(data.job);
          startProgressPolling();
          return;
        } else {
          // Job is done, clear localStorage and reset
          localStorage.removeItem('scraper_active_job_id');
          currentJobId = null;
        }
      }
      
      // If no saved job or saved job is done, check for any active job
      const activeResponse = await fetch('/api/admin/scraper/jobs?active=true&limit=1');
      const activeData = await activeResponse.json();
      
      if (activeData.jobs && activeData.jobs.length > 0) {
        const activeJob = activeData.jobs[0];
        // Double check that job is really active
        if (activeJob.status === 'queued' || activeJob.status === 'running') {
          currentJobId = activeJob.id;
          localStorage.setItem('scraper_active_job_id', activeJob.id);
          showJobProgress(activeJob);
          startProgressPolling();
        } else {
          // Job is not actually active, clear it
          currentJobId = null;
          localStorage.removeItem('scraper_active_job_id');
        }
      } else {
        // No active jobs, make sure everything is cleared
        currentJobId = null;
        localStorage.removeItem('scraper_active_job_id');
      }
    } catch (err) {
      console.error('Error checking active job:', err);
      // On error, stop polling to be safe
      stopProgressPolling();
      currentJobId = null;
    }
  }

  // Load available branches from server
  async function initBranches() {
    try {
      // Branches are passed from server in the template
      // For now, we'll use a simple approach
      const branchInput = document.getElementById('branchInput');
      const branchDropdown = document.getElementById('branchDropdown');
      
      if (!branchInput || !branchDropdown) return;

      // Available branches from server (passed in template)
      // For custom branches, user can type and press Enter
      
      branchInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();
        if (query.length === 0) {
          branchDropdown.style.display = 'none';
          return;
        }

        // Filter available branches
        const matchingBranches = availableBranches.filter(b => 
          b.toLowerCase().includes(query) && !selectedBranches.includes(b)
        );

        let html = '';
        
        // Show matching branches
        matchingBranches.forEach(branch => {
          const escapedBranch = branch.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
          html += `
            <div class="multi-select-dropdown-item" onclick="window.scraperApp.selectBranch('${escapedBranch}')">
              ${escapeHtml(branch)}
            </div>
          `;
        });

        // Show custom option if query doesn't match exactly
        if (!matchingBranches.includes(query) && !selectedBranches.includes(query)) {
          const escapedQuery = query.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
          html += `
            <div class="multi-select-dropdown-item" onclick="window.scraperApp.addCustomBranch('${escapedQuery}')">
              Voeg "${escapeHtml(query)}" toe
            </div>
          `;
        }

        branchDropdown.innerHTML = html;
        branchDropdown.style.display = html ? 'block' : 'none';
      });

      branchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          const value = e.target.value.trim();
          if (value && !selectedBranches.includes(value)) {
            addBranch(value);
            e.target.value = '';
            branchDropdown.style.display = 'none';
          }
        }
      });

      // Close dropdown on outside click
      document.addEventListener('click', function(e) {
        if (!branchInput.contains(e.target) && !branchDropdown.contains(e.target)) {
          branchDropdown.style.display = 'none';
        }
      });
    } catch (err) {
      console.error('Error initializing branches:', err);
    }
  }


  // Initialize event listeners
  function initEventListeners() {
    // Form submission
    const form = document.getElementById('scraperConfigForm');
    if (form) {
      form.addEventListener('submit', handleScrape);
    }

    // Preview query
    const previewBtn = document.getElementById('previewQueryBtn');
    if (previewBtn) {
      previewBtn.addEventListener('click', handlePreviewQuery);
    }

    // History
    const historyBtn = document.getElementById('historyBtn');
    if (historyBtn) {
      historyBtn.addEventListener('click', handleShowHistory);
    }

    // Cancel job
    const cancelBtn = document.getElementById('cancelJobBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', handleCancelJob);
    }

    // Detail page
    const backToListBtn = document.getElementById('backToListBtn');
    if (backToListBtn) {
      backToListBtn.addEventListener('click', goBackToList);
    }
    
    const blockBtn = document.getElementById('detailPageBlockBtn');
    if (blockBtn) {
      blockBtn.addEventListener('click', handleBlockCompany);
    }

    // Script modal
    // Script button for detail page (old modal button removed - we use single page now)
    const closeScriptModalEl = document.getElementById('closeScriptModal');
    if (closeScriptModalEl) {
      closeScriptModalEl.addEventListener('click', closeScriptModal);
    }

    const closeScriptModalBtn = document.getElementById('closeScriptModalBtn');
    if (closeScriptModalBtn) {
      closeScriptModalBtn.addEventListener('click', closeScriptModal);
    }

    // Close modal on outside click
    const scriptModal = document.getElementById('scriptModal');
    if (scriptModal) {
      scriptModal.addEventListener('click', function(e) {
        if (e.target === scriptModal) {
          closeScriptModal();
        }
      });
    }

    const saveScriptBtn = document.getElementById('saveScriptBtn');
    if (saveScriptBtn) {
      saveScriptBtn.addEventListener('click', handleSaveScript);
    }

    const scriptServiceSelect = document.getElementById('scriptServiceSelect');
    if (scriptServiceSelect) {
      scriptServiceSelect.addEventListener('change', handleScriptServiceChange);
    }

    // Create kans
    const createKansBtn = document.getElementById('detailPageCreateKansBtn');
    if (createKansBtn) {
      createKansBtn.addEventListener('click', handleCreateKans);
    }
    
    const detailPageScriptBtn = document.getElementById('detailPageScriptBtn');
    if (detailPageScriptBtn) {
      detailPageScriptBtn.addEventListener('click', handleShowScript);
    }

    // Filters
    const filterHasPhone = document.getElementById('filterHasPhone');
    if (filterHasPhone) {
      filterHasPhone.addEventListener('change', applyFilters);
    }

    const filterHasEmail = document.getElementById('filterHasEmail');
    if (filterHasEmail) {
      filterHasEmail.addEventListener('change', applyFilters);
    }

    const filterMinScore = document.getElementById('filterMinScore');
    if (filterMinScore) {
      filterMinScore.addEventListener('change', applyFilters);
    }

    // Preview modal
    const closePreviewModalEl = document.getElementById('closePreviewModal');
    if (closePreviewModalEl) {
      closePreviewModalEl.addEventListener('click', closePreviewModal);
    }

    const closePreviewModalBtn = document.getElementById('closePreviewModalBtn');
    if (closePreviewModalBtn) {
      closePreviewModalBtn.addEventListener('click', closePreviewModal);
    }

    // History modal
    const closeHistoryModalEl = document.getElementById('closeHistoryModal');
    if (closeHistoryModalEl) {
      closeHistoryModalEl.addEventListener('click', closeHistoryModal);
    }

    const closeHistoryModalBtn = document.getElementById('closeHistoryModalBtn');
    if (closeHistoryModalBtn) {
      closeHistoryModalBtn.addEventListener('click', closeHistoryModal);
    }
  }

  // Handle scrape form submission
  async function handleScrape(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const desiredFields = Array.from(document.querySelectorAll('input[name="desired_fields"]:checked')).map(cb => cb.value);

    const config = {
      location_text: formData.get('location_text'),
      radius_km: parseInt(formData.get('radius_km')) || 20,
      branches: selectedBranches,
      service_id: formData.get('service_id') || null,
      desired_fields: desiredFields,
      max_results: parseInt(formData.get('max_results')) || 50,
      only_nl: formData.get('only_nl') === 'on',
      max_pages_per_domain: parseInt(formData.get('max_pages_per_domain')) || 2
    };

    try {
      const response = await fetch('/api/admin/scraper/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create job');
      }

      currentJobId = data.job.id;
      // Save to localStorage for persistence across reloads
      localStorage.setItem('scraper_active_job_id', data.job.id);
      // Reset result tracking for new job
      lastResultCount = 0;
      hasShownResults = false;
      showJobProgress(data.job);
      startProgressPolling();
      showToast('Scrape gestart!', 'success');
    } catch (err) {
      console.error('Error starting scrape:', err);
      showToast('Fout bij starten scrape: ' + err.message, 'error');
    }
  }

  // Show job progress
  function showJobProgress(job) {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('jobProgress').style.display = 'block';
    document.getElementById('resultsArea').style.display = 'block';
    document.getElementById('currentJobId').textContent = job.id.substring(0, 8);
    updateProgress(job);
  }

  // Update progress display
  function updateProgress(job) {
    const total = job.progress_total || 1;
    const done = job.progress_done || 0;
    const percent = Math.round((done / total) * 100);

    document.getElementById('progressBarFill').style.width = percent + '%';
    document.getElementById('progressFound').textContent = job.progress_found || 0;
    document.getElementById('progressEnriched').textContent = job.progress_enriched || 0;
    document.getElementById('progressErrors').textContent = job.progress_errors || 0;

    if (job.status === 'completed') {
      document.getElementById('jobProgressTitle').textContent = 'Scrape voltooid!';
      stopProgressPolling();
      // Clear localStorage when job is done
      localStorage.removeItem('scraper_active_job_id');
      currentJobId = null; // Reset job ID to stop any remaining polling
      loadResults();
    } else if (job.status === 'failed') {
      document.getElementById('jobProgressTitle').textContent = 'Scrape mislukt';
      stopProgressPolling();
      // Clear localStorage when job fails
      localStorage.removeItem('scraper_active_job_id');
      currentJobId = null; // Reset job ID to stop any remaining polling
      showToast('Scrape mislukt: ' + (job.error || 'Onbekende fout'), 'error');
    } else if (job.status === 'cancelled') {
      document.getElementById('jobProgressTitle').textContent = 'Scrape geannuleerd';
      stopProgressPolling();
      // Clear localStorage when job is cancelled
      localStorage.removeItem('scraper_active_job_id');
      currentJobId = null; // Reset job ID to stop any remaining polling
    }
  }

  // Start polling for progress
  function startProgressPolling() {
    // Always stop existing intervals first to prevent duplicates
    stopProgressPolling();
    
    // Don't start if no job ID
    if (!currentJobId) {
      return;
    }

    progressInterval = setInterval(async () => {
      if (!currentJobId) {
        stopProgressPolling();
        return;
      }

      try {
        const response = await fetch(`/api/admin/scraper/jobs/${currentJobId}`);
        if (!response.ok) {
          // Job not found or error, stop polling
          stopProgressPolling();
          currentJobId = null;
          localStorage.removeItem('scraper_active_job_id');
          return;
        }
        
        const data = await response.json();

        if (data.job) {
          updateProgress(data.job);
          if (data.job.status === 'completed' || data.job.status === 'failed' || data.job.status === 'cancelled') {
            stopProgressPolling();
            currentJobId = null;
            localStorage.removeItem('scraper_active_job_id');
          }
        } else {
          // Job not found, stop polling
          stopProgressPolling();
          currentJobId = null;
          localStorage.removeItem('scraper_active_job_id');
        }
      } catch (err) {
        console.error('Error polling progress:', err);
        // On error, stop polling to prevent spam
        stopProgressPolling();
        currentJobId = null;
      }
    }, 2000); // Poll every 2 seconds

    // Also poll results more frequently (only if job is running)
    resultsInterval = setInterval(async () => {
      if (!currentJobId) {
        stopProgressPolling();
        return;
      }
      
      // Check job status before loading results
      try {
        const jobResponse = await fetch(`/api/admin/scraper/jobs/${currentJobId}`);
        if (!jobResponse.ok) {
          // Job not found or error, stop polling
          stopProgressPolling();
          currentJobId = null;
          localStorage.removeItem('scraper_active_job_id');
          return;
        }
        
        const jobData = await jobResponse.json();
        const job = jobData.job;
        
        // Stop polling if job is done
        if (!job || job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          stopProgressPolling();
          currentJobId = null;
          localStorage.removeItem('scraper_active_job_id');
          // Load results one final time if job exists
          if (job) {
            loadResults();
          }
          return;
        }
        
        // Job is still running, load results
        loadResults();
      } catch (err) {
        console.error('Error checking job status in results interval:', err);
        // On error, stop polling to prevent spam
        stopProgressPolling();
        currentJobId = null;
      }
    }, 3000); // Poll results every 3 seconds (increased to reduce spam)
  }

  // Stop progress polling
  function stopProgressPolling() {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    if (resultsInterval) {
      clearInterval(resultsInterval);
      resultsInterval = null;
    }
  }

  // Load results
  let isLoadingResults = false;
  let lastResultCount = 0;
  let hasShownResults = false;
  
  async function loadResults() {
    if (!currentJobId) {
      // No job ID, stop polling
      if (resultsInterval) {
        clearInterval(resultsInterval);
        resultsInterval = null;
      }
      return;
    }
    if (isLoadingResults) return; // Prevent concurrent loads

    isLoadingResults = true;
    const container = document.getElementById('resultsTable');
    if (!container) {
      isLoadingResults = false;
      return;
    }

    try {
      // Check job status first to know if we should show loading
      const jobResponse = await fetch(`/api/admin/scraper/jobs/${currentJobId}`);
      const jobData = await jobResponse.json();
      const job = jobData.job;
      
      // Stop polling if job is done
      if (job && (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled')) {
        if (resultsInterval) {
          clearInterval(resultsInterval);
          resultsInterval = null;
        }
        // Also update progress one last time
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
          updateProgress(job);
        }
      }
      
      const isJobRunning = job && (job.status === 'queued' || job.status === 'running');
      
      const hasPhone = document.getElementById('filterHasPhone')?.checked || false;
      const hasEmail = document.getElementById('filterHasEmail')?.checked || false;
      const minScore = document.getElementById('filterMinScore')?.value || null;

      let url = `/api/admin/scraper/jobs/${currentJobId}/results?`;
      if (hasPhone) url += 'has_phone=true&';
      if (hasEmail) url += 'has_email=true&';
      if (minScore) url += `min_score=${minScore}&`;

      const response = await fetch(url);
      const data = await response.json();

      const results = data.results || [];
      const resultCount = results.length;
      
      // Logic to prevent flickering:
      // 1. If we have results, always show them (update if count changed)
      // 2. If job is running and no results yet, show skeleton (only once, don't flicker)
      // 3. If job is done and no results, show "geen resultaten"
      
      if (resultCount > 0) {
        // We have results - show them with progressive loading (skeletons for remaining)
        renderResultsWithSkeletons(results, isJobRunning, job?.max_results || 50);
        hasShownResults = true;
        lastResultCount = resultCount;
      } else if (isJobRunning) {
        // Job still running but no results yet
        // Only show skeleton if we haven't shown results before
        // Once we've shown results, don't go back to skeleton (prevents flickering)
        if (!hasShownResults) {
          // Check if container already has skeleton to avoid re-rendering
          const currentHtml = container.innerHTML;
          if (!currentHtml.includes('skeleton-row')) {
            container.innerHTML = renderLoadingSkeleton();
          }
        }
        // If we already showed results but now they're 0 (maybe filtered), keep last state
      } else {
        // Job is done and no results
        // Only show empty state if we haven't shown results before
        if (!hasShownResults) {
          container.innerHTML = '<div class="empty-state"><p>Geen resultaten gevonden</p></div>';
        }
      }
    } catch (err) {
      console.error('Error loading results:', err);
      if (container) {
        container.innerHTML = '<div class="empty-state"><p>Fout bij laden resultaten</p></div>';
      }
    } finally {
      isLoadingResults = false;
    }
  }
  
  // Render loading skeleton
  function renderLoadingSkeleton() {
    const skeletonRows = Array(10).fill(0).map(() => `
      <tr class="skeleton-row">
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
      </tr>
    `).join('');
    
    return `
      <table>
        <thead>
          <tr>
            <th>Bedrijf</th>
            <th>Branch</th>
            <th>Stad</th>
            <th>Website</th>
            <th>Telefoon</th>
            <th>E-mail</th>
            <th>Fit Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${skeletonRows}
        </tbody>
      </table>
    `;
  }

  // Render results table with progressive loading (first results + skeletons)
  function renderResultsWithSkeletons(results, isJobRunning, maxResults) {
    const container = document.getElementById('resultsTable');
    if (!container) return;

    if (results.length === 0) {
      return;
    }
    
    // Show actual results + skeleton rows for remaining expected results
    const skeletonCount = isJobRunning && results.length < maxResults 
      ? Math.min(10, maxResults - results.length) // Show up to 10 skeleton rows
      : 0;
    
    const skeletonRows = Array(skeletonCount).fill(0).map(() => `
      <tr class="skeleton-row">
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
        <td><div class="skeleton-text"></div></td>
      </tr>
    `).join('');

    const html = `
      <table>
        <thead>
          <tr>
            <th>Bedrijf</th>
            <th>Branch</th>
            <th>Stad</th>
            <th>Website</th>
            <th>Telefoon</th>
            <th>E-mail</th>
            <th>Fit Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(result => `
            <tr onclick="window.scraperApp.showDetail('${result.id}')">
              <td><strong>${escapeHtml(result.company_name || '-')}</strong></td>
              <td>${escapeHtml(result.branch || '-')}</td>
              <td>${escapeHtml(result.city || '-')}</td>
              <td>${result.website ? `<a href="${result.website}" target="_blank" onclick="event.stopPropagation()">${escapeHtml(result.website)}</a>` : '-'}</td>
              <td>${escapeHtml(result.phone || '-')}</td>
              <td>${escapeHtml(result.email || '-')}</td>
              <td>${renderFitScore(result.fit_score || 0)}</td>
              <td>${renderStatus(result.status)}</td>
            </tr>
          `).join('')}
          ${skeletonRows}
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  }

  // Render results table (legacy function for when job is done)
  function renderResults(results) {
    const container = document.getElementById('resultsTable');
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Geen resultaten gevonden</p></div>';
      return;
    }

    const html = `
      <table>
        <thead>
          <tr>
            <th>Bedrijf</th>
            <th>Branch</th>
            <th>Stad</th>
            <th>Website</th>
            <th>Telefoon</th>
            <th>E-mail</th>
            <th>Fit Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(result => `
            <tr onclick="window.scraperApp.showDetail('${result.id}')">
              <td><strong>${escapeHtml(result.company_name || '-')}</strong></td>
              <td>${escapeHtml(result.branch || '-')}</td>
              <td>${escapeHtml(result.city || '-')}</td>
              <td>${result.website ? `<a href="${result.website}" target="_blank" onclick="event.stopPropagation()">${escapeHtml(result.website)}</a>` : '-'}</td>
              <td>${escapeHtml(result.phone || '-')}</td>
              <td>${escapeHtml(result.email || '-')}</td>
              <td>${renderFitScore(result.fit_score || 0)}</td>
              <td>${renderStatus(result.status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  }

  function renderFitScore(score) {
    let className = 'fit-score-low';
    if (score >= 70) className = 'fit-score-high';
    else if (score >= 40) className = 'fit-score-medium';

    return `<span class="fit-score ${className}">${score}/100</span>`;
  }

  function renderStatus(status) {
    const labels = {
      'new': 'Nieuw',
      'reviewed': 'Bekeken',
      'created_as_kans': 'Kans aangemaakt',
      'discarded': 'Verwijderd'
    };
    return labels[status] || status;
  }

  // Show detail page (single page view)
  async function showDetail(resultId) {
    // Store reference for window.scraperApp immediately
    showDetailFunction = showDetail;
    window.scraperApp.showDetail = showDetail;
    try {
      // Hide main content, show detail page
      document.querySelector('.scraper-container > .scraper-config-card').style.display = 'none';
      document.getElementById('jobProgress').style.display = 'none';
      document.getElementById('resultsArea').style.display = 'none';
      document.getElementById('emptyState').style.display = 'none';
      
      const detailPage = document.getElementById('detailPage');
      detailPage.style.display = 'block';
      detailPage.classList.add('active');

      // Fetch result details
      const response = await fetch(`/api/admin/scraper/jobs/${currentJobId}/results`);
      const data = await response.json();

      const result = data.results?.find(r => r.id === resultId);
      if (!result) {
        showToast('Resultaat niet gevonden', 'error');
        goBackToList();
        return;
      }

      // Check for existing customer/opportunity
      const checkResponse = await fetch(`/api/admin/scraper/results/${resultId}/check-existing`);
      const checkData = await checkResponse.json();

      const companyName = document.getElementById('detailPageCompanyName');
      const detailContent = document.getElementById('detailPageContent');
      const callBtn = document.getElementById('detailPageCallBtn');
      const createKansBtn = document.getElementById('detailPageCreateKansBtn');
      const blockBtn = document.getElementById('detailPageBlockBtn');

      companyName.textContent = result.company_name || '-';
      
      let warningHtml = '';
      if (checkData.is_customer) {
        warningHtml = '<div class="warning-banner"><strong>⚠️ Waarschuwing</strong>Het lijkt erop dat dit bedrijf al een klant is in het systeem.</div>';
      } else if (checkData.is_opportunity) {
        warningHtml = '<div class="warning-banner"><strong>⚠️ Waarschuwing</strong>Dit bedrijf heeft al een kans in het systeem.</div>';
      }

      detailContent.innerHTML = warningHtml + `
        <div class="detail-card">
          <h2 style="margin: 0 0 1.5rem 0; font-size: 1.25rem; font-weight: 600;">Bedrijfsgegevens</h2>
          <div class="detail-field">
            <label>Bedrijfsnaam</label>
            <div class="detail-field-value">${escapeHtml(result.company_name || '-')}</div>
          </div>
          <div class="detail-field">
            <label>Website</label>
            <div class="detail-field-value">${result.website ? `<a href="${result.website}" target="_blank">${escapeHtml(result.website)}</a>` : '-'}</div>
          </div>
          <div class="detail-field">
            <label>Telefoon</label>
            <div class="detail-field-value">${result.phone ? `<a href="tel:${result.phone}">${escapeHtml(result.phone)}</a> <button onclick="navigator.clipboard.writeText('${result.phone}'); showToast('Telefoon gekopieerd!', 'success');" class="btn-copy" style="margin-left: 0.5rem; padding: 0.25rem 0.5rem; font-size: 0.75rem;">📋</button>` : '-'}</div>
          </div>
          <div class="detail-field">
            <label>E-mail</label>
            <div class="detail-field-value">${result.email ? `<a href="mailto:${result.email}">${escapeHtml(result.email)}</a>` : '-'}</div>
          </div>
          <div class="detail-field">
            <label>Adres</label>
            <div class="detail-field-value">${escapeHtml(result.address || '-')}</div>
          </div>
          <div class="detail-field">
            <label>Stad</label>
            <div class="detail-field-value">${escapeHtml(result.city || '-')}</div>
          </div>
          <div class="detail-field">
            <label>Postcode</label>
            <div class="detail-field-value">${escapeHtml(result.postcode || '-')}</div>
          </div>
          <div class="detail-field">
            <label>Contactpersoon</label>
            <div class="detail-field-value">${escapeHtml(result.contact_person || '-')}</div>
          </div>
          <div class="detail-field">
            <label>Branch</label>
            <div class="detail-field-value">${escapeHtml(result.branch || '-')}</div>
          </div>
        </div>
        <div class="detail-card">
          <h2 style="margin: 0 0 1.5rem 0; font-size: 1.25rem; font-weight: 600;">AI Analyse</h2>
          <div class="detail-field">
            <label>Fit Score</label>
            <div class="detail-field-value">${renderFitScore(result.fit_score || 0)}</div>
          </div>
          <div class="detail-field">
            <label>Fit Reden</label>
            <div class="detail-field-value">${escapeHtml(result.fit_reason || '-')}</div>
          </div>
          <div class="detail-field">
            <label>Confidence Scores</label>
            <div class="detail-field-value">
              ${result.confidence ? Object.entries(result.confidence).map(([key, val]) => 
                `<span style="display: inline-block; margin-right: 1rem;"><strong>${key}:</strong> ${(val * 100).toFixed(0)}%</span>`
              ).join('') : '-'}
            </div>
          </div>
        </div>
        <div class="detail-card">
          <h2 style="margin: 0 0 1.5rem 0; font-size: 1.25rem; font-weight: 600;">Bron</h2>
          <div class="detail-field">
            <label>Bron URL</label>
            <div class="detail-field-value">${result.source_url ? `<a href="${result.source_url}" target="_blank">${escapeHtml(result.source_url)}</a>` : '-'}</div>
          </div>
          <div class="detail-field">
            <label>Domein</label>
            <div class="detail-field-value">${escapeHtml(result.source_domain || '-')}</div>
          </div>
        </div>
      `;

      if (result.phone) {
        callBtn.href = `tel:${result.phone}`;
        callBtn.style.display = 'inline-block';
      } else {
        callBtn.style.display = 'none';
      }

      // Show "Maak kans aan" button or link to existing opportunity
      if (result.opportunity_id) {
        createKansBtn.textContent = 'Bekijk kans';
        createKansBtn.className = 'btn-secondary';
        createKansBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.location.href = `/admin/opportunities/${result.opportunity_id}`;
        };
        createKansBtn.disabled = false;
        createKansBtn.style.display = 'inline-block';
        
        // Show delete opportunity button
        const footer = document.querySelector('.detail-page-footer');
        if (footer) {
          // Remove existing delete button if any
          const existingDeleteBtn = footer.querySelector('[data-opportunity-id]');
          if (existingDeleteBtn) {
            existingDeleteBtn.remove();
          }
          
          const deleteOppBtn = document.createElement('button');
          deleteOppBtn.className = 'btn-danger';
          deleteOppBtn.textContent = 'Verwijder kans';
          deleteOppBtn.dataset.opportunityId = result.opportunity_id;
          deleteOppBtn.addEventListener('click', handleDeleteOpportunity);
          footer.insertBefore(deleteOppBtn, createKansBtn);
        }
      } else {
        createKansBtn.textContent = 'Maak kans aan';
        createKansBtn.className = 'btn-primary';
        createKansBtn.onclick = handleCreateKans;
        createKansBtn.dataset.resultId = resultId;
        createKansBtn.disabled = result.status === 'created_as_kans';
        createKansBtn.style.display = 'inline-block';
      }
      
      blockBtn.dataset.resultId = resultId;
      blockBtn.dataset.companyName = result.company_name || '';
      blockBtn.dataset.domain = result.source_domain || '';
      blockBtn.dataset.opportunityId = result.opportunity_id || '';
    } catch (err) {
      console.error('Error showing detail:', err);
      showToast('Fout bij laden details', 'error');
      goBackToList();
    }
  }

  function goBackToList() {
    document.getElementById('detailPage').style.display = 'none';
    document.getElementById('detailPage').classList.remove('active');
    document.querySelector('.scraper-container > .scraper-config-card').style.display = 'block';
    if (currentJobId) {
      document.getElementById('jobProgress').style.display = 'block';
      document.getElementById('resultsArea').style.display = 'block';
    } else {
      document.getElementById('emptyState').style.display = 'block';
    }
  }

  // Handle create kans
  async function handleCreateKans(e) {
    const resultId = e.target.dataset.resultId;
    if (!resultId) return;

    if (!confirm('Weet je zeker dat je een kans wilt aanmaken voor dit bedrijf?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/scraper/results/${resultId}/create-kans`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create kans');
      }

      showToast('Kans aangemaakt!', 'success');
      goBackToList();
      loadResults(); // Refresh to show updated status
    } catch (err) {
      console.error('Error creating kans:', err);
      showToast('Fout bij aanmaken kans: ' + err.message, 'error');
    }
  }

  // Handle delete opportunity
  async function handleDeleteOpportunity(e) {
    const opportunityId = e.target.dataset.opportunityId;
    if (!opportunityId) return;

    if (!confirm('Weet je zeker dat je deze kans wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/scraper/opportunities/${opportunityId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete opportunity');
      }

      showToast('Kans verwijderd!', 'success');
      goBackToList();
      loadResults(); // Refresh to show updated status
    } catch (err) {
      console.error('Error deleting opportunity:', err);
      showToast('Fout bij verwijderen kans: ' + err.message, 'error');
    }
  }

  // Handle block company
  async function handleBlockCompany(e) {
    const resultId = e.target.dataset.resultId;
    const companyName = e.target.dataset.companyName;
    
    if (!resultId) return;

    const reason = prompt(`Waarom wil je "${companyName}" blokkeren? (Dit bedrijf komt NOOIT meer terug in scrapes)`);
    if (!reason || reason.trim() === '') {
      return;
    }

    if (!confirm(`Weet je zeker dat je "${companyName}" wilt blokkeren? Dit kan niet ongedaan worden gemaakt.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/scraper/results/${resultId}/block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason.trim() })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to block company');
      }

      showToast('Bedrijf geblokkeerd!', 'success');
      goBackToList();
      loadResults(); // Refresh to show updated status
    } catch (err) {
      console.error('Error blocking company:', err);
      showToast('Fout bij blokkeren: ' + err.message, 'error');
    }
  }

  // Handle show script
  async function handleShowScript() {
    const serviceId = document.getElementById('serviceId').value;
    if (!serviceId) {
      showToast('Selecteer eerst een dienst', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/admin/scraper/scripts?service_id=${serviceId}`);
      const data = await response.json();

      const script = data.scripts?.[0];
      const userName = window.scraperUserName || 'jouw naam';
      const isAdmin = window.scraperIsUserAdmin === true;
      
      if (script) {
        document.getElementById('scriptServiceSelect').value = serviceId;
        // Replace [jouw naam] with actual user name
        let scriptText = script.script_text.replace(/\[jouw naam\]/g, userName);
        document.getElementById('scriptText').value = scriptText;
        document.getElementById('scriptText').readOnly = !isAdmin; // Only admins/managers can edit
      } else {
        document.getElementById('scriptServiceSelect').value = serviceId;
        document.getElementById('scriptText').value = '';
        document.getElementById('scriptText').readOnly = !isAdmin;
      }
      
      // Show/hide edit button based on permissions
      const saveBtn = document.getElementById('saveScriptBtn');
      if (saveBtn) {
        saveBtn.style.display = isAdmin ? 'block' : 'none';
      }

      document.getElementById('scriptModal').classList.add('active');
    } catch (err) {
      console.error('Error loading script:', err);
      showToast('Fout bij laden script', 'error');
    }
  }

  function closeScriptModal() {
    const modal = document.getElementById('scriptModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  async function handleScriptServiceChange(e) {
    const serviceId = e.target.value;
    if (!serviceId) return;

    try {
      const response = await fetch(`/api/admin/scraper/scripts?service_id=${serviceId}`);
      const data = await response.json();

      const script = data.scripts?.[0];
      if (script) {
        document.getElementById('scriptText').value = script.script_text;
      } else {
        document.getElementById('scriptText').value = '';
      }
    } catch (err) {
      console.error('Error loading script:', err);
    }
  }

  async function handleSaveScript() {
    const serviceId = document.getElementById('scriptServiceSelect').value;
    const scriptText = document.getElementById('scriptText').value;
    const serviceSelect = document.getElementById('scriptServiceSelect');
    const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text.split(' (')[0];
    const title = serviceName + ' - Belscript';

    if (!serviceId || !scriptText.trim()) {
      showToast('Vul alle velden in', 'error');
      return;
    }

    try {
      // First, try to find existing script
      const response = await fetch(`/api/admin/scraper/scripts?service_id=${serviceId}`);
      const data = await response.json();

      const existingScript = data.scripts?.[0];
      const scriptId = existingScript?.id;

      if (scriptId) {
        // Update existing
        const updateResponse = await fetch(`/api/admin/scraper/scripts/${scriptId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ script_text: scriptText, title: title })
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.error || 'Failed to update script');
        }
      } else {
        // Create new script
        const createResponse = await fetch(`/api/admin/scraper/scripts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            service_id: serviceId,
            script_text: scriptText,
            title: title
          })
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          throw new Error(errorData.error || 'Failed to create script');
        }
      }

      showToast('Script opgeslagen!', 'success');
    } catch (err) {
      console.error('Error saving script:', err);
      showToast('Fout bij opslaan script: ' + err.message, 'error');
    }
  }

  // Handle preview query
  async function handlePreviewQuery() {
    const formData = new FormData(document.getElementById('scraperConfigForm'));
    const branches = selectedBranches;
    const location = formData.get('location_text');
    const serviceId = formData.get('service_id');

    // Build queries (matching service logic)
    const queries = [];

    if (branches.length === 0) {
      queries.push(`${location} bedrijven`);
    } else {
      branches.forEach(branch => {
        queries.push(`${branch} ${location}`);
        queries.push(`${branch} ${location} bedrijf`);
      });
    }

    // Add service-specific query if service selected
    if (serviceId) {
      const serviceSelect = document.getElementById('serviceId');
      const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text.split(' (')[0];
      if (serviceName) {
        queries.push(`${serviceName} ${location}`);
      }
    }

    const list = document.getElementById('previewQueriesList');
    if (queries.length === 0) {
      list.innerHTML = '<li><em>Geen queries (vul locatie in)</em></li>';
    } else {
      list.innerHTML = queries.map(q => `<li>${escapeHtml(q)}</li>`).join('');
    }

    document.getElementById('previewQueryModal').classList.add('active');
  }

  function closePreviewModal() {
    document.getElementById('previewQueryModal').classList.remove('active');
  }

  // Handle show history
  async function handleShowHistory() {
    await loadHistory();
    document.getElementById('historyModal').classList.add('active');
  }

  async function loadHistory() {
    try {
      const response = await fetch('/api/admin/scraper/jobs?limit=20');
      const data = await response.json();

      const container = document.getElementById('historyList');
      if (!container) return;

      if (!data.jobs || data.jobs.length === 0) {
        container.innerHTML = '<p>Geen geschiedenis</p>';
        return;
      }

      container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb;">Datum</th>
              <th style="padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb;">Locatie</th>
              <th style="padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb;">Status</th>
              <th style="padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb;">Resultaten</th>
            </tr>
          </thead>
          <tbody>
            ${data.jobs.map(job => `
              <tr>
                <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">${formatDate(job.created_at)}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">${escapeHtml(job.location_text)}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">${renderJobStatus(job.status)}</td>
                <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">${job.progress_found || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      console.error('Error loading history:', err);
    }
  }

  function closeHistoryModal() {
    document.getElementById('historyModal').classList.remove('active');
  }

  function renderJobStatus(status) {
    const labels = {
      'queued': 'In wachtrij',
      'running': 'Bezig',
      'completed': 'Voltooid',
      'failed': 'Mislukt',
      'cancelled': 'Geannuleerd'
    };
    return labels[status] || status;
  }

  // Handle cancel job
  async function handleCancelJob() {
    if (!currentJobId) return;

    if (!confirm('Weet je zeker dat je deze scrape wilt annuleren?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/scraper/jobs/${currentJobId}/cancel`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel job');
      }

      showToast('Scrape geannuleerd', 'success');
      stopProgressPolling();
      // Clear localStorage when job is cancelled
      localStorage.removeItem('scraper_active_job_id');
      updateProgress(data.job);
    } catch (err) {
      console.error('Error cancelling job:', err);
      showToast('Fout bij annuleren: ' + err.message, 'error');
    }
  }

  // Apply filters
  function applyFilters() {
    loadResults();
  }

  // Utility functions
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function showToast(message, type) {
    // Simple toast implementation (you might have a toast system already)
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 1rem 1.5rem;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      border-radius: 6px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  // showDetail is defined later, but we'll reference it here
  // The actual function will be assigned below
})();

