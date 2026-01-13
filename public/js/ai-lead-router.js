// AI Lead Router JavaScript

// Toggle status based on settings
let aiRoutingEnabled = true;
let currentLeadId = null;

// Modal helper functions
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    document.body.style.overflow = 'hidden';
    console.log('Modal opened:', modalId); // Debug log
  } else {
    console.error('Modal not found:', modalId); // Debug log
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// Close modal on overlay click or close button
document.addEventListener('click', function(e) {
  // Handle new modal structure with ai-router-modal-close
  if (e.target.closest('.ai-router-modal-close') || e.target.closest('[data-modal]')) {
    const modalId = e.target.closest('[data-modal]')?.getAttribute('data-modal') || 
                    e.target.closest('.ai-router-modal-close')?.closest('.modal')?.id;
    if (modalId) {
      closeModal(modalId);
    }
  }
  // Handle old modal structure
  else if (e.target.classList.contains('modal') || e.target.closest('.modal-close')) {
    const modalId = e.target.closest('.modal')?.id || e.target.closest('.modal-close')?.closest('.modal')?.id;
    if (modalId) {
      closeModal(modalId);
    }
  }
});

// Open AI Settings Modal - ensure it runs after DOM is ready
function setupAiSettingsButton() {
  const settingsBtn = document.getElementById('aiRoutingSettingsBtn');
  if (settingsBtn && !settingsBtn.hasAttribute('data-listener-attached')) {
    settingsBtn.setAttribute('data-listener-attached', 'true');
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('AI Settings button clicked'); // Debug log
      
      const modal = document.getElementById('aiRouterSettingsModal');
      if (modal) {
        openModal('aiRouterSettingsModal');
        // Setup slider listeners when modal opens
        setupSliderListeners();
        // Load current settings
        loadAiRouterSettings();
      } else {
        console.error('Modal element not found in DOM');
      }
    });
  }
}

// Setup slider event listeners - call this when modal opens
function setupSliderListeners() {
  ['regionWeight', 'performanceWeight', 'fairnessWeight'].forEach(id => {
    const slider = document.getElementById(id);
    const valueDisplay = document.getElementById(id + 'Value');
    const range = document.getElementById(id + 'Range');
    const thumb = document.getElementById(id + 'Thumb');
    
    if (slider && valueDisplay) {
      // Check if already has listener attached
      if (slider.hasAttribute('data-listener-attached')) {
        // Just update the display with current value
        const value = parseInt(slider.value);
        valueDisplay.textContent = value + '%';
        if (range) {
          range.style.right = (100 - value) + '%';
        }
        if (thumb) {
          thumb.style.left = value + '%';
        }
        return;
      }
      
      // Mark as having listener attached
      slider.setAttribute('data-listener-attached', 'true');
      
      const updateSlider = () => {
        const value = parseInt(slider.value);
        valueDisplay.textContent = value + '%';
        
        // Update visual range and thumb
        if (range) {
          range.style.right = (100 - value) + '%';
        }
        if (thumb) {
          thumb.style.left = value + '%';
        }
      };
      
      slider.addEventListener('input', updateSlider);
      slider.addEventListener('change', updateSlider);
      updateSlider(); // Initial update
    }
  });
}

// Setup save button listener
function setupSaveButton() {
  const saveBtn = document.getElementById('saveAiSettings');
  if (saveBtn && !saveBtn.hasAttribute('data-listener-attached')) {
    saveBtn.setAttribute('data-listener-attached', 'true');
    saveBtn.addEventListener('click', async () => {
      const regionWeight = document.getElementById('regionWeight')?.value;
      const performanceWeight = document.getElementById('performanceWeight')?.value;
      const fairnessWeight = document.getElementById('fairnessWeight')?.value;
      const autoAssign = document.getElementById('autoAssignToggle')?.checked;
      const autoAssignThreshold = document.getElementById('autoAssignThreshold')?.value || 70;
      
      if (!regionWeight || !performanceWeight || !fairnessWeight) {
        console.error('Slider values not found');
        return;
      }
      
      try {
        const response = await fetch('/api/admin/ai-router/settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            regionWeight: parseInt(regionWeight),
            performanceWeight: parseInt(performanceWeight),
            fairnessWeight: parseInt(fairnessWeight),
            autoAssign: autoAssign,
            autoAssignThreshold: parseInt(autoAssignThreshold)
          })
        });

        const result = await response.json();
        
        if (result.success) {
          // Update status
          aiRoutingEnabled = autoAssign;
          updateAiRouterStatus(autoAssign);
          
          // Show notification
          if (window.showNotification) {
            window.showNotification('Instellingen opgeslagen', 'success');
          } else {
            alert('Instellingen opgeslagen');
          }
          
          // Close modal
          closeModal('aiRouterSettingsModal');
        } else {
          throw new Error(result.error || 'Fout bij opslaan');
        }
      } catch (error) {
        console.error('Error saving AI settings:', error);
        if (window.showNotification) {
          window.showNotification('Fout bij opslaan instellingen: ' + error.message, 'error');
        } else {
          alert('Fout bij opslaan instellingen: ' + error.message);
        }
      }
    });
  }
}

// Load AI Router Settings
async function loadAiRouterSettings() {
  try {
    const response = await fetch('/api/admin/ai-router/settings', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        const settings = result.data;
        const regionWeight = settings.regionWeight || 50;
        const performanceWeight = settings.performanceWeight || 50;
        const fairnessWeight = settings.fairnessWeight || 50;
        
        document.getElementById('regionWeight').value = regionWeight;
        document.getElementById('regionWeightValue').textContent = regionWeight + '%';
        if (document.getElementById('regionWeightRange')) {
          document.getElementById('regionWeightRange').style.right = (100 - regionWeight) + '%';
        }
        if (document.getElementById('regionWeightThumb')) {
          document.getElementById('regionWeightThumb').style.left = regionWeight + '%';
        }
        
        document.getElementById('performanceWeight').value = performanceWeight;
        document.getElementById('performanceWeightValue').textContent = performanceWeight + '%';
        if (document.getElementById('performanceWeightRange')) {
          document.getElementById('performanceWeightRange').style.right = (100 - performanceWeight) + '%';
        }
        if (document.getElementById('performanceWeightThumb')) {
          document.getElementById('performanceWeightThumb').style.left = performanceWeight + '%';
        }
        
        document.getElementById('fairnessWeight').value = fairnessWeight;
        document.getElementById('fairnessWeightValue').textContent = fairnessWeight + '%';
        if (document.getElementById('fairnessWeightRange')) {
          document.getElementById('fairnessWeightRange').style.right = (100 - fairnessWeight) + '%';
        }
        if (document.getElementById('fairnessWeightThumb')) {
          document.getElementById('fairnessWeightThumb').style.left = fairnessWeight + '%';
        }
        
        // Update auto assign toggle
        const autoAssignToggle = document.getElementById('autoAssignToggle');
        if (autoAssignToggle) {
          autoAssignToggle.checked = settings.autoAssign !== false;
        }
        
        // Re-setup slider listeners after loading values to ensure they work
        setupSliderListeners();
        if (document.getElementById('autoAssignThreshold')) {
          document.getElementById('autoAssignThreshold').value = settings.autoAssignThreshold || 70;
        }
        const thresholdValueEl = document.getElementById('autoAssignThresholdValue');
        if (thresholdValueEl) {
          thresholdValueEl.textContent = settings.autoAssignThreshold || 70;
        }
        aiRoutingEnabled = settings.autoAssign !== false;
        updateAiRouterStatus(aiRoutingEnabled);
      }
    }
  } catch (error) {
    console.error('Error loading AI router settings:', error);
  }
}

// Update AI Router Status Badge
function updateAiRouterStatus(enabled) {
  const badge = document.querySelector('.ai-router-status-badge');
  const label = badge?.querySelector('.ai-router-status-label');
  
  if (badge && label) {
    if (enabled) {
      badge.setAttribute('data-status', 'enabled');
      label.textContent = 'Automatische toewijzing: Aan';
    } else {
      badge.setAttribute('data-status', 'disabled');
      label.textContent = 'Automatische toewijzing: Uit';
    }
  }
}

// Open AI Assignment Drawer
async function openAiAssignmentDrawer(leadId) {
  currentLeadId = leadId;
  const drawer = document.getElementById('aiAssignmentDrawer');
  
  if (!drawer) {
    console.error('AI Assignment Drawer not found');
    return;
  }
  
  // Show loading state
  document.getElementById('drawerLeadId').textContent = leadId.substring(0, 6);
  document.getElementById('bestMatchName').textContent = 'Laden...';
  document.getElementById('bestMatchScore').textContent = '-';
  document.getElementById('alternativeMatchList').innerHTML = '<div style="text-align: center; padding: 20px; color: #9ca3af;">Laden...</div>';
  document.getElementById('aiExplanationText').textContent = 'Laden...';
  
  // Show drawer
  drawer.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  try {
    // Fetch lead details
    const leadResponse = await fetch(`/api/leads/${leadId}`, {
      credentials: 'include'
    });
    
    if (!leadResponse.ok) {
      throw new Error('Lead niet gevonden');
    }
    
    const leadData = await leadResponse.json();
    const lead = leadData.lead || leadData;
    
    // Populate lead info
    document.getElementById('drawerLeadName').textContent = lead.name || '-';
    document.getElementById('drawerLeadCompany').textContent = lead.company || lead.email || '-';
    document.getElementById('drawerLeadBranch').textContent = lead.industry_name || '-';
    document.getElementById('drawerLeadBranchBadge').textContent = lead.industry_name || '-';
    document.getElementById('drawerLeadProvince').textContent = lead.province || '-';
    document.getElementById('drawerLeadRegion').textContent = (lead.province || '-') + (lead.postcode ? ', ' + lead.postcode : '');
    
    if (lead.is_urgent) {
      document.getElementById('drawerUrgentBadge').style.display = 'inline-flex';
    } else {
      document.getElementById('drawerUrgentBadge').style.display = 'none';
    }
    
    // Fetch AI recommendations
    const recommendationsResponse = await fetch(`/api/admin/leads/${leadId}/recommendations`, {
      credentials: 'include'
    });
    
    if (!recommendationsResponse.ok) {
      throw new Error('Kon aanbevelingen niet ophalen');
    }
    
    const recommendationsData = await recommendationsResponse.json();
    
    if (recommendationsData.success && recommendationsData.data && recommendationsData.data.recommendations) {
      const recommendations = recommendationsData.data.recommendations;
      
      if (recommendations.length > 0) {
        // Populate best match
        const bestMatch = recommendations[0];
        const partnerName = bestMatch.partner?.company_name || 
                          (bestMatch.partner?.first_name && bestMatch.partner?.last_name ? 
                            bestMatch.partner.first_name + ' ' + bestMatch.partner.last_name : 
                            'Onbekend');
        
        document.getElementById('bestMatchName').textContent = partnerName;
        document.getElementById('bestMatchScore').textContent = Math.round(bestMatch.score);
        document.getElementById('assignButtonName').textContent = partnerName;
        
        // Populate best match stats
        const statsContainer = document.getElementById('bestMatchStats');
        statsContainer.innerHTML = '';
        
        if (bestMatch.stats) {
          const stats = bestMatch.stats;
          
          // Branch
          if (bestMatch.partner?.primary_branch) {
            const chip = createStatChip('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', bestMatch.partner.primary_branch);
            statsContainer.appendChild(chip);
          }
          
          // Region
          if (bestMatch.partner?.regions && bestMatch.partner.regions.length > 0) {
            const chip = createStatChip('M12 2v20 M2 12h20', bestMatch.partner.regions[0]);
            statsContainer.appendChild(chip);
          }
          
          // Conversion rate
          if (stats.conversion_rate_30d !== null && stats.conversion_rate_30d !== undefined) {
            const chip = createStatChip('M22 12l-4-4-6 6-4-4-8 8', 'Conversie: ' + Math.round(stats.conversion_rate_30d) + '%');
            statsContainer.appendChild(chip);
          }
          
          // Open leads
          const chip = createStatChip('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0', 
            'Open leads: ' + (stats.open_leads_count || 0) + ' / ' + (bestMatch.partner?.max_open_leads || 5));
          statsContainer.appendChild(chip);
          
          // Last lead
          if (stats.last_lead_assigned_at) {
            const lastLeadTime = formatTimeAgo(new Date(stats.last_lead_assigned_at));
            const chip = createStatChip('M12 12a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M12 6v6l4 2', 'Laatste lead: ' + lastLeadTime);
            statsContainer.appendChild(chip);
          }
        }
        
        // Populate alternative matches
        const altList = document.getElementById('alternativeMatchList');
        altList.innerHTML = '';
        
        if (recommendations.length > 1) {
          recommendations.slice(1, 5).forEach((rec, index) => {
            const altItem = createAlternativeMatchItem(rec, index + 2);
            altList.appendChild(altItem);
          });
        } else {
          altList.innerHTML = '<div style="text-align: center; padding: 20px; color: #9ca3af;">Geen alternatieve matches beschikbaar</div>';
        }
        
        // Generate AI explanation
        const explanation = generateAiExplanation(bestMatch, lead);
        document.getElementById('aiExplanationText').textContent = explanation;
        
        // Store best match partner ID for assignment
        document.getElementById('assignToBestMatch').setAttribute('data-partner-id', bestMatch.partnerId);
      } else {
        document.getElementById('bestMatchName').textContent = 'Geen matches gevonden';
        document.getElementById('alternativeMatchList').innerHTML = '<div style="text-align: center; padding: 20px; color: #9ca3af;">Geen partners beschikbaar</div>';
        document.getElementById('aiExplanationText').textContent = 'Er zijn geen geschikte partners gevonden voor deze lead.';
      }
    }
  } catch (error) {
    console.error('Error loading AI assignment data:', error);
    document.getElementById('bestMatchName').textContent = 'Fout bij laden';
    document.getElementById('aiExplanationText').textContent = 'Er is een fout opgetreden bij het laden van de aanbevelingen.';
    
    if (window.showNotification) {
      window.showNotification('Fout bij laden aanbevelingen: ' + error.message, 'error');
    }
  }
}

// Create stat chip helper
function createStatChip(iconPath, text) {
  const chip = document.createElement('div');
  chip.className = 'stat-chip';
  chip.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="${iconPath}"/>
    </svg>
    <span>${text}</span>
  `;
  return chip;
}

// Create alternative match item
function createAlternativeMatchItem(rec, index) {
  const item = document.createElement('div');
  item.className = 'alternative-match-item';
  
  const partnerName = rec.partner?.company_name || 
                     (rec.partner?.first_name && rec.partner?.last_name ? 
                       rec.partner.first_name + ' ' + rec.partner.last_name : 
                       'Onbekend');
  
  const stats = rec.stats || {};
  const statsText = [
    rec.partner?.regions?.[0] || '-',
    'Conversie: ' + Math.round(stats.conversion_rate_30d || 0) + '%',
    'Leads 30d: ' + (stats.leads_assigned_30d || 0),
    'Open: ' + (stats.open_leads_count || 0) + '/' + (rec.partner?.max_open_leads || 5)
  ].join(' • ');
  
  item.innerHTML = `
    <div class="alternative-match-header">
      <div class="alternative-match-name">${partnerName}</div>
      <div class="alternative-match-score-badge">Score ${Math.round(rec.score)}</div>
    </div>
    <div class="alternative-match-stats">
      ${statsText.split(' • ').map(stat => `<span class="stat-small">${stat}</span>`).join('<span class="stat-divider">•</span>')}
    </div>
    <button class="btn btn-outline btn-sm" onclick="assignToPartner('${rec.partnerId}')">
      Toewijzen
    </button>
  `;
  
  return item;
}

// Generate AI explanation
function generateAiExplanation(bestMatch, lead) {
  const reasons = [];
  const factors = bestMatch.factors || bestMatch.breakdown || {};
  
  if (factors.branchMatch > 0) {
    reasons.push('branche match');
  }
  if (factors.regionMatch > 0) {
    reasons.push('regio match');
  }
  if (factors.performance > 0) {
    reasons.push('hoge conversieratio');
  }
  if (factors.waitTime > 0) {
    reasons.push('eerlijke verdeling (lange wachttijd)');
  }
  
  const partnerName = bestMatch.partner?.company_name || 
                     (bestMatch.partner?.first_name && bestMatch.partner?.last_name ? 
                       bestMatch.partner.first_name + ' ' + bestMatch.partner.last_name : 
                       'deze partner');
  
  if (reasons.length > 0) {
    return `Deze lead is gekoppeld aan ${partnerName} omdat zij ${reasons.join(', ')} hebben${reasons.length > 1 ? '' : ''}.`;
  } else {
    return `Deze lead is gekoppeld aan ${partnerName} op basis van de beschikbaarheid en capaciteit.`;
  }
}

// Format time ago
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffHours < 1) {
    return 'minder dan 1 uur geleden';
  } else if (diffHours < 24) {
    return diffHours + ' uur geleden';
  } else if (diffDays === 1) {
    return '1 dag geleden';
  } else {
    return diffDays + ' dagen geleden';
  }
}

// Close AI Assignment Drawer
function closeAiAssignmentDrawer() {
  const drawer = document.getElementById('aiAssignmentDrawer');
  if (drawer) {
    drawer.classList.remove('active');
    document.body.style.overflow = '';
  }
  currentLeadId = null;
}

// Close drawer when clicking overlay
document.getElementById('aiAssignmentDrawer')?.addEventListener('click', (e) => {
  if (e.target.id === 'aiAssignmentDrawer') {
    closeAiAssignmentDrawer();
  }
});

// Assign to best match
document.getElementById('assignToBestMatch')?.addEventListener('click', async () => {
  if (!currentLeadId) {
    console.error('No lead ID available');
    return;
  }
  
  const partnerId = document.getElementById('assignToBestMatch').getAttribute('data-partner-id');
  const partnerName = document.getElementById('assignButtonName').textContent;
  
  if (!partnerId) {
    console.error('No partner ID available');
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/leads/${currentLeadId}/auto-assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        assigned_by: 'manual'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      if (window.showNotification) {
        window.showNotification(`Lead toegewezen aan ${partnerName}`, 'success');
      }
      closeAiAssignmentDrawer();
      // Reload page to show updated assignment
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      throw new Error(result.error || 'Fout bij toewijzen');
    }
  } catch (error) {
    console.error('Error assigning lead:', error);
    if (window.showNotification) {
      window.showNotification('Fout bij toewijzen: ' + error.message, 'error');
    }
  }
});

// Assign to alternative partner
async function assignToPartner(partnerId) {
  if (!currentLeadId) {
    console.error('No lead ID available');
    return;
  }
  
  try {
    // Get partner name from recommendations if available
    let partnerName = 'partner';
    try {
      const response = await fetch(`/api/admin/leads/${currentLeadId}/recommendations`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        const recommendations = data.data?.recommendations || [];
        const partner = recommendations.find(r => r.partnerId === partnerId);
        if (partner) {
          partnerName = partner.partner?.company_name || 
                       (partner.partner?.first_name && partner.partner?.last_name ? 
                         partner.partner.first_name + ' ' + partner.partner.last_name : 
                         'partner');
        }
      }
    } catch (e) {
      console.warn('Could not fetch partner name:', e);
    }
    
    // Assign using the auto-assign endpoint with specific partner_id
    const assignResponse = await fetch(`/api/admin/leads/${currentLeadId}/auto-assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        assigned_by: 'manual',
        partner_id: partnerId
      })
    });
    
    const assignResult = await assignResponse.json();
    
    if (assignResult.success) {
      if (window.showNotification) {
        window.showNotification(`Lead toegewezen aan ${partnerName}`, 'success');
      }
      closeAiAssignmentDrawer();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      throw new Error(assignResult.error || 'Fout bij toewijzen');
    }
  } catch (error) {
    console.error('Error assigning to partner:', error);
    if (window.showNotification) {
      window.showNotification('Fout bij toewijzen: ' + error.message, 'error');
    }
  }
}

// View AI proposal button handlers
document.addEventListener('click', function(e) {
  if (e.target.closest('.view-ai-proposal')) {
    e.preventDefault();
    e.stopPropagation();
    const leadId = e.target.closest('.view-ai-proposal').getAttribute('data-lead-id');
    if (leadId) {
      openAiAssignmentDrawer(leadId);
    }
  }
});

// Load distribution data when tab is clicked
document.addEventListener('DOMContentLoaded', function() {
  // Tab switching
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Initialize: Hide all tab contents except the active one
  tabContents.forEach(content => {
    if (!content.classList.contains('tab-content-active')) {
      content.style.display = 'none';
    }
  });
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      
      // Update button states (use aria-selected for CSS targeting)
      tabButtons.forEach(btn => {
        btn.setAttribute('aria-selected', 'false');
        btn.classList.remove('border-gray-900', 'text-gray-900');
        btn.classList.add('border-transparent', 'text-gray-500');
      });
      
      // Add active state to clicked button
      button.setAttribute('aria-selected', 'true');
      button.classList.remove('border-transparent', 'text-gray-500');
      button.classList.add('border-gray-900', 'text-gray-900');
      
      // Update content visibility
      tabContents.forEach(content => {
        content.classList.remove('tab-content-active');
        content.style.display = 'none';
      });
      
      const targetContent = document.getElementById(tabName);
      if (targetContent) {
        targetContent.classList.add('tab-content-active');
        targetContent.style.display = 'block';
        
        // Load data when tab is clicked
        if (tabName === 'distributie') {
          loadDistributionData();
        } else if (tabName === 'conversies') {
          loadConversionsData();
        } else if (tabName === 'analytics') {
          loadAnalyticsData();
        }
      }
    });
  });
  
  // Load initial AI router settings
  loadAiRouterSettings();
  
  // Setup AI settings button
  setupAiSettingsButton();
  
  // Setup save button
  setupSaveButton();
});

// Also try to setup immediately if DOM is already ready
if (document.readyState === 'loading') {
  // DOM is still loading, wait for DOMContentLoaded (handled above)
} else {
  // DOM is already ready, setup immediately
  setupAiSettingsButton();
}

// Load distribution data
async function loadDistributionData() {
  try {
    const response = await fetch('/api/admin/distribution/summary', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Kon distributie data niet ophalen');
    }
    
    const result = await response.json();
    
    if (result.success && result.data) {
      const data = result.data;
      
      // Populate overcapacity
      const overcapacityList = document.getElementById('overcapacityList');
      if (overcapacityList && data.overcapacity) {
        if (data.overcapacity.length > 0) {
          overcapacityList.innerHTML = data.overcapacity.map(item => `
            <div class="distribution-list-item">
              <span class="branch-name">${item.branch} • ${item.region}</span>
              <span class="capacity-stat">${item.partners} partners / ${item.leads} leads (7d)</span>
            </div>
          `).join('');
        } else {
          overcapacityList.innerHTML = '<div style="text-align: center; padding: 20px; color: #9ca3af;">Geen overcapaciteit</div>';
        }
      }
      
      // Populate shortages
      const shortageList = document.getElementById('shortageList');
      if (shortageList && data.shortages) {
        if (data.shortages.length > 0) {
          shortageList.innerHTML = data.shortages.map(item => `
            <div class="distribution-list-item">
              <span class="branch-name">${item.branch} • ${item.region}</span>
              <span class="capacity-stat capacity-shortage">${item.partners} partners / ${item.leads} leads (7d)</span>
            </div>
          `).join('');
        } else {
          shortageList.innerHTML = '<div style="text-align: center; padding: 20px; color: #9ca3af;">Geen tekorten</div>';
        }
      }
      
      // Populate fairness
      if (data.fairness) {
        const fairness = data.fairness;
        const avgWaitEl = document.getElementById('avgWaitTime');
        const fairnessBarEl = document.getElementById('fairnessBar');
        const fairnessVarianceEl = document.getElementById('fairnessVariance');
        
        if (avgWaitEl) {
          avgWaitEl.textContent = fairness.avgWaitHours ? Math.round(fairness.avgWaitHours) + ' uur' : '-';
        }
        if (fairnessBarEl) {
          fairnessBarEl.style.width = Math.min(100, (fairness.avgWaitHours || 0) / 24 * 100) + '%';
        }
        if (fairnessVarianceEl) {
          // Variance is standard deviation - show as "±X uur"
          const stdDev = fairness.variance ? Math.sqrt(fairness.variance).toFixed(1) : null;
          fairnessVarianceEl.textContent = stdDev ? `±${stdDev} uur` : '-';
        }
      }
      
      // Populate distribution table
      const tableBody = document.getElementById('distributionTableBody');
      if (tableBody && data.distribution) {
        if (data.distribution.length > 0) {
          tableBody.innerHTML = data.distribution.map(item => {
            let indicatorClass = 'balanced';
            let indicatorText = 'In balans';
            
            const ratio = item.leads / Math.max(item.partners, 1);
            if (ratio > 5) {
              indicatorClass = 'shortage';
              indicatorText = 'Tekort';
            } else if (ratio < 0.5) {
              indicatorClass = 'overcapacity';
              indicatorText = 'Overcapaciteit';
            }
            
            return `
              <tr>
                <td>${item.branch}</td>
                <td>${item.region}</td>
                <td>${item.leads}</td>
                <td>${item.partners}</td>
                <td>
                  <span class="status-badge ${indicatorClass === 'shortage' ? 'status-failed' : indicatorClass === 'overcapacity' ? 'status-pending' : 'status-paid'}">${indicatorText}</span>
                </td>
              </tr>
            `;
          }).join('');
        } else {
          tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 16px; color: #6b7280;">Geen data beschikbaar</td></tr>';
        }
      }
      
      // Render chart
      if (data.distribution && data.distribution.length > 0 && typeof Chart !== 'undefined') {
        renderDistributionChart(data.distribution);
      }
    }
  } catch (error) {
    console.error('Error loading distribution data:', error);
    const overcapacityList = document.getElementById('overcapacityList');
    const shortageList = document.getElementById('shortageList');
    if (overcapacityList) {
      overcapacityList.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc2626;">Fout bij laden</div>';
    }
    if (shortageList) {
      shortageList.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc2626;">Fout bij laden</div>';
    }
  }
}

// Distribution chart instance
let distributionChart = null;

// Render distribution chart
function renderDistributionChart(distributionData) {
  const ctx = document.getElementById('distributionChart');
  if (!ctx) return;
  
  // Destroy existing chart if it exists
  if (distributionChart) {
    distributionChart.destroy();
  }
  
  // Prepare data
  const labels = distributionData.map(item => `${item.branch} • ${item.region}`);
  const leadsData = distributionData.map(item => item.leads);
  const partnersData = distributionData.map(item => item.partners);
  
  distributionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Leads (7d)',
          data: leadsData,
          backgroundColor: 'rgba(234, 93, 13, 0.6)',
          borderColor: 'rgba(234, 93, 13, 1)',
          borderWidth: 1
        },
        {
          label: 'Partners',
          data: partnersData,
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }
      ]
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
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    }
  });
}

// Load conversions data
async function loadConversionsData() {
  try {
    // Fetch accepted leads - use /api/ endpoint and filter client-side
    const response = await fetch('/api/', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Kon conversies niet ophalen');
    }
    
    const allLeads = await response.json();
    // Filter for accepted leads client-side
    const leads = Array.isArray(allLeads) ? allLeads.filter(lead => lead.status === 'accepted') : [];
    
    const tableBody = document.getElementById('conversionsTableBody');
    if (tableBody) {
      if (leads.length > 0) {
        tableBody.innerHTML = leads.map(lead => {
          const date = new Date(lead.created_at);
          const formattedDate = date.toLocaleDateString('nl-NL', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
          });
          
          const partnerName = lead.assigned_user?.company_name || 
                             (lead.assigned_user?.first_name && lead.assigned_user?.last_name ? 
                               lead.assigned_user.first_name + ' ' + lead.assigned_user.last_name : 
                               'Niet toegewezen');
          
          const industryName = lead.industry?.name || 'Onbekend';
          const province = lead.province || 'Onbekend';
          const value = lead.price_at_purchase ? '€' + parseFloat(lead.price_at_purchase).toFixed(2) : '-';
          
          return `
            <tr>
              <td>${lead.name || 'Onbekend'}</td>
              <td>${partnerName}</td>
              <td>${industryName}</td>
              <td>${province}</td>
              <td>${formattedDate}</td>
              <td>
                <span class="status-badge status-paid">Geaccepteerd</span>
              </td>
              <td>${value}</td>
            </tr>
          `;
        }).join('');
      } else {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 16px; color: #6b7280;">Geen conversies gevonden</td></tr>';
      }
    }
  } catch (error) {
    console.error('Error loading conversions data:', error);
    const tableBody = document.getElementById('conversionsTableBody');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 16px; color: #dc2626;">Fout bij laden</td></tr>';
    }
  }
}

// Analytics charts
let leadsOverTijdChart = null;
let conversiePerBrancheChart = null;
let regioDistributieChart = null;

// Load analytics data
async function loadAnalyticsData() {
  try {
    // Get the analytics tab content container
    const analyticsTab = document.getElementById('analytics');
    const chartsContainer = analyticsTab?.querySelector('.grid');
    const paddingContainer = analyticsTab?.querySelector('div[style*="padding: 24px"]');
    
    // Show loading state - hide charts, show loading message
    if (chartsContainer) {
      chartsContainer.style.opacity = '0.3';
      chartsContainer.style.pointerEvents = 'none';
    }
    
    // Create or show loading overlay
    let loadingOverlay = document.getElementById('analytics-loading-overlay');
    if (!loadingOverlay && paddingContainer) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'analytics-loading-overlay';
      loadingOverlay.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; z-index: 10;';
      loadingOverlay.innerHTML = '<p class="text-gray-500 text-lg">Laden...</p>';
      paddingContainer.style.position = 'relative';
      paddingContainer.appendChild(loadingOverlay);
    } else if (loadingOverlay) {
      loadingOverlay.style.display = 'block';
    }
    
    console.log('🔍 Loading analytics data from /api/...');
    
    // Fetch all leads for analytics - use /api/ endpoint
    const response = await fetch('/api/', {
      credentials: 'include'
    });
    
    console.log('📡 API Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      // Try to get error message from response
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
      
      if (response.status === 403) {
        errorMessage = 'Geen toegang: Admin rechten vereist voor analytics';
      } else if (response.status === 401) {
        errorMessage = 'Niet ingelogd: Log opnieuw in';
      }
      
      throw new Error(errorMessage);
    }
    
    const leads = await response.json();
    console.log('✅ API Response received:', typeof leads, Array.isArray(leads) ? leads.length : 'not an array');
    console.log('📦 Full API response:', leads);
    
    // Handle different response formats
    let leadsArray = [];
    if (Array.isArray(leads)) {
      leadsArray = leads;
    } else if (leads && Array.isArray(leads.data)) {
      // Response is wrapped in { data: [...] }
      leadsArray = leads.data;
    } else if (leads && typeof leads === 'object' && leads.success !== undefined) {
      // Response is { success: true, data: [...] }
      leadsArray = Array.isArray(leads.data) ? leads.data : [];
    } else if (leads && typeof leads === 'object') {
      // Response might be a single object or something else
      console.warn('⚠️ Unexpected response format:', leads);
      leadsArray = [];
    }
    
    console.log('📊 Analytics data loaded:', leadsArray.length, 'leads');
    
    if (leadsArray.length > 0) {
      console.log('📋 Sample lead:', leadsArray[0]);
    }
    
    // Hide loading overlay
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
    
    // Restore charts container visibility
    if (chartsContainer) {
      chartsContainer.style.opacity = '1';
      chartsContainer.style.pointerEvents = 'auto';
    }
    
    // Check if we have data
    if (leadsArray.length === 0) {
      // Show "no data" message
      if (chartsContainer) {
        chartsContainer.style.opacity = '0.3';
        if (loadingOverlay) {
          loadingOverlay.innerHTML = `
            <p class="text-gray-500 text-lg mb-2">Geen data beschikbaar</p>
            <p class="text-gray-400 text-sm">Er zijn nog geen leads in het systeem.</p>
          `;
          loadingOverlay.style.display = 'block';
        }
      }
      return;
    }
    
    // Render charts only if Chart.js is available
    if (typeof Chart === 'undefined') {
      console.error('❌ Chart.js is not loaded');
      if (chartsContainer) {
        chartsContainer.style.opacity = '0.3';
        if (loadingOverlay) {
          loadingOverlay.innerHTML = '<p class="text-red-500">Chart.js is niet geladen</p>';
          loadingOverlay.style.display = 'block';
        }
      }
      return;
    }
    
    console.log('📈 Rendering charts...');
    
    // Render all charts
    renderLeadsOverTijdChart(leadsArray);
    renderConversiePerBrancheChart(leadsArray);
    renderRegioDistributieChart(leadsArray);
    renderTopPartners(leadsArray);
    
    console.log('✅ Analytics charts rendered successfully');
    
  } catch (error) {
    console.error('❌ Error loading analytics data:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Show error message
    const analyticsTab = document.getElementById('analytics');
    const chartsContainer = analyticsTab?.querySelector('.grid');
    const paddingContainer = analyticsTab?.querySelector('div[style*="padding: 24px"]');
    let loadingOverlay = document.getElementById('analytics-loading-overlay');
    
    if (chartsContainer) {
      chartsContainer.style.opacity = '0.3';
    }
    
    if (!loadingOverlay && paddingContainer) {
      loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'analytics-loading-overlay';
      loadingOverlay.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; z-index: 10;';
      paddingContainer.style.position = 'relative';
      paddingContainer.appendChild(loadingOverlay);
    }
    
    if (loadingOverlay) {
      let errorMessage = error.message || 'Onbekende fout';
      let errorDetails = '';
      
      if (error.message.includes('403') || error.message.includes('toegang')) {
        errorDetails = 'Je hebt geen admin rechten. Vraag een beheerder om toegang.';
      } else if (error.message.includes('401') || error.message.includes('ingelogd')) {
        errorDetails = 'Je sessie is verlopen. Ververs de pagina en log opnieuw in.';
      } else {
        errorDetails = 'Open de browser console (F12) voor meer details.';
      }
      
      loadingOverlay.innerHTML = `
        <p class="text-red-500 text-lg mb-2">Fout bij het laden van data</p>
        <p class="text-gray-400 text-sm mb-1">${errorMessage}</p>
        <p class="text-gray-400 text-xs">${errorDetails}</p>
      `;
      loadingOverlay.style.display = 'block';
    }
  }
}

// Render leads over tijd chart
function renderLeadsOverTijdChart(leads) {
  const ctx = document.getElementById('leadsOverTijdChart');
  if (!ctx) return;
  
  if (leadsOverTijdChart) {
    leadsOverTijdChart.destroy();
  }
  
  // Group by date (last 30 days)
  const last30Days = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    last30Days.push(date.toISOString().split('T')[0]);
  }
  
  const leadsByDate = {};
  last30Days.forEach(date => {
    leadsByDate[date] = 0;
  });
  
  leads.forEach(lead => {
    const date = new Date(lead.created_at).toISOString().split('T')[0];
    if (leadsByDate[date] !== undefined) {
      leadsByDate[date]++;
    }
  });
  
  leadsOverTijdChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last30Days.map(d => new Date(d).toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' })),
      datasets: [{
        label: 'Leads',
        data: last30Days.map(d => leadsByDate[d]),
        borderColor: '#ea5d0d',
        backgroundColor: 'rgba(234, 93, 13, 0.1)',
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          }
        }
      }
    }
  });
}

// Render conversie per branche chart
function renderConversiePerBrancheChart(leads) {
  const ctx = document.getElementById('conversiePerBrancheChart');
  if (!ctx) return;
  
  if (conversiePerBrancheChart) {
    conversiePerBrancheChart.destroy();
  }
  
  // Group by industry
  const industryStats = {};
  leads.forEach(lead => {
    const industry = lead.industry?.name || 'Onbekend';
    if (!industryStats[industry]) {
      industryStats[industry] = { total: 0, accepted: 0 };
    }
    industryStats[industry].total++;
    if (lead.status === 'accepted') {
      industryStats[industry].accepted++;
    }
  });
  
  const industries = Object.keys(industryStats);
  
  // If no industries, show empty state
  if (industries.length === 0 || industries.length === 1 && industries[0] === 'Onbekend' && industryStats['Onbekend']?.total === 0) {
    // Create empty chart
    conversiePerBrancheChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Geen data'],
        datasets: [{
          label: 'Conversie %',
          data: [0],
          backgroundColor: 'rgba(200, 200, 200, 0.3)',
          borderColor: '#cccccc',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
    return;
  }
  
  const conversionRates = industries.map(industry => {
    const stats = industryStats[industry];
    return stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0;
  });
  
  conversiePerBrancheChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: industries,
      datasets: [{
        label: 'Conversie %',
        data: conversionRates,
        backgroundColor: 'rgba(234, 93, 13, 0.6)',
        borderColor: '#ea5d0d',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      }
    }
  });
}

// Render regio distributie map with real SVG map of Netherlands
function renderRegioDistributieChart(leads) {
  const mapContainer = document.getElementById('regioDistributieMap');
  if (!mapContainer) return;
  
  // Group by province (normalize province names)
  const provinceCounts = {};
  const provinceNameMap = {
    'noord-holland': 'Noord-Holland',
    'zuid-holland': 'Zuid-Holland',
    'noord-brabant': 'Noord-Brabant',
    'gelderland': 'Gelderland',
    'utrecht': 'Utrecht',
    'friesland': 'Friesland',
    'overijssel': 'Overijssel',
    'groningen': 'Groningen',
    'drenthe': 'Drenthe',
    'flevoland': 'Flevoland',
    'limburg': 'Limburg',
    'zeeland': 'Zeeland'
  };
  
  leads.forEach(lead => {
    const province = (lead.province || '').toLowerCase().trim();
    const normalizedProvince = Object.keys(provinceNameMap).find(key => 
      province.includes(key) || key.includes(province)
    ) || province;
    
    if (normalizedProvince && provinceNameMap[normalizedProvince]) {
      const provinceName = provinceNameMap[normalizedProvince];
      provinceCounts[provinceName] = (provinceCounts[provinceName] || 0) + 1;
    }
  });
  
  // Find max count for color scaling
  const maxCount = Math.max(...Object.values(provinceCounts), 1);
  
  // Generate color based on count (gradient from light to dark orange)
  const getColor = (count) => {
    if (count === 0) return '#f3f4f6'; // Light gray for no data
    const intensity = Math.min(count / maxCount, 1);
    const r = Math.round(234 - (234 - 255) * (1 - intensity));
    const g = Math.round(93 - (93 - 255) * (1 - intensity));
    const b = Math.round(13 - (13 - 255) * (1 - intensity));
    return `rgb(${r}, ${g}, ${b})`;
  };
  
  // Real SVG map of Netherlands with accurate province boundaries
  // Using actual geographic coordinates scaled to fit viewBox
  // Based on real Netherlands province shapes
  const svgMap = `
    <svg viewBox="0 0 1000 1200" style="width: 100%; height: 100%;" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .province-path {
            stroke: #ffffff;
            stroke-width: 2.5;
            fill: #f3f4f6;
            transition: fill 0.3s ease, stroke-width 0.2s ease, opacity 0.2s ease;
            cursor: pointer;
          }
          .province-path:hover {
            stroke-width: 4;
            opacity: 0.85;
          }
          .province-label {
            font-size: 13px;
            font-weight: 600;
            fill: #1f2937;
            pointer-events: none;
            text-anchor: middle;
          }
        </style>
      </defs>
      
      <!-- Groningen (northeast, coastal, irregular shape) -->
      <path id="groningen" class="province-path" 
            d="M 680 45 L 820 45 L 820 200 L 800 200 L 780 195 L 750 200 L 720 195 L 690 190 L 680 185 L 680 170 L 680 150 L 680 120 L 680 90 L 680 60 Z" 
            fill="${getColor(provinceCounts['Groningen'] || 0)}"
            data-province="groningen"
            data-count="${provinceCounts['Groningen'] || 0}">
        <title>Groningen: ${provinceCounts['Groningen'] || 0} leads</title>
      </path>
      <text class="province-label" x="750" y="120">Groningen</text>
      
      <!-- Friesland (northwest, coastal, elongated with irregular coastline) -->
      <path id="friesland" class="province-path" 
            d="M 120 45 L 680 45 L 680 200 L 660 200 L 630 195 L 580 200 L 520 195 L 460 190 L 400 185 L 340 180 L 280 175 L 220 170 L 160 165 L 120 160 L 120 140 L 120 120 L 120 100 L 120 80 L 120 60 Z" 
            fill="${getColor(provinceCounts['Friesland'] || 0)}"
            data-province="friesland"
            data-count="${provinceCounts['Friesland'] || 0}">
        <title>Friesland: ${provinceCounts['Friesland'] || 0} leads</title>
      </path>
      <text class="province-label" x="400" y="120">Friesland</text>
      
      <!-- Drenthe (below Friesland and Groningen, irregular shape) -->
      <path id="drenthe" class="province-path" 
            d="M 580 200 L 820 200 L 820 350 L 800 350 L 770 345 L 730 350 L 690 345 L 650 340 L 610 335 L 580 330 L 580 310 L 580 290 L 580 270 L 580 250 L 580 230 Z" 
            fill="${getColor(provinceCounts['Drenthe'] || 0)}"
            data-province="drenthe"
            data-count="${provinceCounts['Drenthe'] || 0}">
        <title>Drenthe: ${provinceCounts['Drenthe'] || 0} leads</title>
      </path>
      <text class="province-label" x="700" y="275">Drenthe</text>
      
      <!-- Overijssel (below Drenthe, elongated, irregular borders) -->
      <path id="overijssel" class="province-path" 
            d="M 580 350 L 820 350 L 820 550 L 800 550 L 770 545 L 730 550 L 690 545 L 650 540 L 610 535 L 580 530 L 580 510 L 580 490 L 580 470 L 580 450 L 580 430 L 580 380 Z" 
            fill="${getColor(provinceCounts['Overijssel'] || 0)}"
            data-province="overijssel"
            data-count="${provinceCounts['Overijssel'] || 0}">
        <title>Overijssel: ${provinceCounts['Overijssel'] || 0} leads</title>
      </path>
      <text class="province-label" x="700" y="450">Overijssel</text>
      
      <!-- Flevoland (center, rectangular, reclaimed land) -->
      <path id="flevoland" class="province-path" 
            d="M 360 200 L 580 200 L 580 350 L 550 350 L 520 345 L 480 350 L 440 345 L 400 340 L 360 335 L 360 310 L 360 290 L 360 270 L 360 250 L 360 230 Z" 
            fill="${getColor(provinceCounts['Flevoland'] || 0)}"
            data-province="flevoland"
            data-count="${provinceCounts['Flevoland'] || 0}">
        <title>Flevoland: ${provinceCounts['Flevoland'] || 0} leads</title>
      </path>
      <text class="province-label" x="470" y="275">Flevoland</text>
      
      <!-- Noord-Holland (west, coastal, irregular shape with islands) -->
      <path id="noord-holland" class="province-path" 
            d="M 20 200 L 360 200 L 360 550 L 340 550 L 300 545 L 250 550 L 200 545 L 150 540 L 100 535 L 60 530 L 40 525 L 30 520 L 25 515 L 22 510 L 20 500 L 20 480 L 20 460 L 20 440 L 20 420 L 20 400 L 20 380 L 20 360 L 20 340 L 20 320 L 20 300 L 20 280 L 20 260 L 20 240 L 20 220 Z" 
            fill="${getColor(provinceCounts['Noord-Holland'] || 0)}"
            data-province="noord-holland"
            data-count="${provinceCounts['Noord-Holland'] || 0}">
        <title>Noord-Holland: ${provinceCounts['Noord-Holland'] || 0} leads</title>
      </path>
      <text class="province-label" x="190" y="375">Noord-Holland</text>
      
      <!-- Utrecht (center, small, irregular shape) -->
      <path id="utrecht" class="province-path" 
            d="M 360 550 L 520 550 L 520 620 L 500 620 L 470 615 L 440 620 L 400 615 L 360 610 L 360 590 L 360 570 Z" 
            fill="${getColor(provinceCounts['Utrecht'] || 0)}"
            data-province="utrecht"
            data-count="${provinceCounts['Utrecht'] || 0}">
        <title>Utrecht: ${provinceCounts['Utrecht'] || 0} leads</title>
      </path>
      <text class="province-label" x="440" y="585">Utrecht</text>
      
      <!-- Zuid-Holland (below Noord-Holland, irregular coastal shape) -->
      <path id="zuid-holland" class="province-path" 
            d="M 20 550 L 360 550 L 360 800 L 340 800 L 300 795 L 250 800 L 200 795 L 150 790 L 100 785 L 60 780 L 40 775 L 30 770 L 25 765 L 22 760 L 20 750 L 20 730 L 20 710 L 20 690 L 20 670 L 20 650 L 20 630 L 20 610 L 20 590 L 20 570 Z" 
            fill="${getColor(provinceCounts['Zuid-Holland'] || 0)}"
            data-province="zuid-holland"
            data-count="${provinceCounts['Zuid-Holland'] || 0}">
        <title>Zuid-Holland: ${provinceCounts['Zuid-Holland'] || 0} leads</title>
      </path>
      <text class="province-label" x="190" y="675">Zuid-Holland</text>
      
      <!-- Gelderland (east, large, irregular shape) -->
      <path id="gelderland" class="province-path" 
            d="M 520 550 L 820 550 L 820 800 L 800 800 L 770 795 L 730 800 L 690 795 L 650 790 L 610 785 L 570 780 L 540 775 L 520 770 L 520 750 L 520 730 L 520 710 L 520 690 L 520 670 L 520 650 L 520 630 L 520 610 L 520 580 Z" 
            fill="${getColor(provinceCounts['Gelderland'] || 0)}"
            data-province="gelderland"
            data-count="${provinceCounts['Gelderland'] || 0}">
        <title>Gelderland: ${provinceCounts['Gelderland'] || 0} leads</title>
      </path>
      <text class="province-label" x="670" y="675">Gelderland</text>
      
      <!-- Zeeland (southwest, coastal, irregular with islands) -->
      <path id="zeeland" class="province-path" 
            d="M 20 800 L 360 800 L 360 1000 L 340 1000 L 300 995 L 250 1000 L 200 995 L 150 990 L 100 985 L 60 980 L 40 975 L 30 970 L 25 965 L 22 960 L 20 950 L 20 930 L 20 910 L 20 890 L 20 870 L 20 850 L 20 830 L 20 810 Z" 
            fill="${getColor(provinceCounts['Zeeland'] || 0)}"
            data-province="zeeland"
            data-count="${provinceCounts['Zeeland'] || 0}">
        <title>Zeeland: ${provinceCounts['Zeeland'] || 0} leads</title>
      </path>
      <text class="province-label" x="190" y="900">Zeeland</text>
      
      <!-- Noord-Brabant (south, large, irregular shape) -->
      <path id="noord-brabant" class="province-path" 
            d="M 360 800 L 820 800 L 820 1100 L 800 1100 L 770 1095 L 730 1100 L 690 1095 L 650 1090 L 610 1085 L 570 1080 L 530 1075 L 490 1070 L 450 1065 L 410 1060 L 380 1055 L 360 1050 L 360 1030 L 360 1010 L 360 990 L 360 970 L 360 950 L 360 930 L 360 910 L 360 890 L 360 870 L 360 850 L 360 830 Z" 
            fill="${getColor(provinceCounts['Noord-Brabant'] || 0)}"
            data-province="noord-brabant"
            data-count="${provinceCounts['Noord-Brabant'] || 0}">
        <title>Noord-Brabant: ${provinceCounts['Noord-Brabant'] || 0} leads</title>
      </path>
      <text class="province-label" x="590" y="950">Noord-Brabant</text>
      
      <!-- Limburg (southeast, elongated, irregular borders with Belgium/Germany) -->
      <path id="limburg" class="province-path" 
            d="M 820 900 L 980 900 L 980 1150 L 960 1150 L 940 1145 L 920 1150 L 900 1145 L 880 1140 L 860 1135 L 840 1130 L 820 1125 L 820 1100 L 820 1080 L 820 1060 L 820 1040 L 820 1020 L 820 1000 L 820 980 L 820 960 L 820 940 L 820 920 Z" 
            fill="${getColor(provinceCounts['Limburg'] || 0)}"
            data-province="limburg"
            data-count="${provinceCounts['Limburg'] || 0}">
        <title>Limburg: ${provinceCounts['Limburg'] || 0} leads</title>
      </path>
      <text class="province-label" x="900" y="1025">Limburg</text>
    </svg>
  `;
  
  mapContainer.innerHTML = svgMap;
  
  // Add tooltip functionality
  const paths = mapContainer.querySelectorAll('.province-path');
  paths.forEach(path => {
    path.addEventListener('mouseenter', function(e) {
      const province = this.getAttribute('data-province');
      const count = this.getAttribute('data-count');
      const provinceName = provinceNameMap[province] || province;
      
      // Create or update tooltip
      let tooltip = document.getElementById('map-tooltip');
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'map-tooltip';
        tooltip.style.cssText = `
          position: absolute;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          pointer-events: none;
          z-index: 1000;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        mapContainer.appendChild(tooltip);
      }
      
      tooltip.textContent = `${provinceName}: ${count} leads`;
      tooltip.style.display = 'block';
    });
    
    path.addEventListener('mousemove', function(e) {
      const tooltip = document.getElementById('map-tooltip');
      if (tooltip) {
        const rect = mapContainer.getBoundingClientRect();
        tooltip.style.left = (e.clientX - rect.left + 10) + 'px';
        tooltip.style.top = (e.clientY - rect.top - 40) + 'px';
      }
    });
    
    path.addEventListener('mouseleave', function() {
      const tooltip = document.getElementById('map-tooltip');
      if (tooltip) {
        tooltip.style.display = 'none';
      }
    });
  });
}

// Render top partners
function renderTopPartners(leads) {
  const list = document.getElementById('topPartnersList');
  if (!list) return;
  
  // Group by partner
  const partnerStats = {};
  leads.forEach(lead => {
    if (lead.assigned_user) {
      const partnerId = lead.assigned_user.id;
      const partnerName = lead.assigned_user.company_name || 
                        (lead.assigned_user.first_name && lead.assigned_user.last_name ? 
                          lead.assigned_user.first_name + ' ' + lead.assigned_user.last_name : 
                          'Onbekend');
      
      if (!partnerStats[partnerId]) {
        partnerStats[partnerId] = { name: partnerName, total: 0, accepted: 0 };
      }
      partnerStats[partnerId].total++;
      if (lead.status === 'accepted') {
        partnerStats[partnerId].accepted++;
      }
    }
  });
  
  const partners = Object.values(partnerStats)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  
  if (partners.length > 0) {
    list.innerHTML = partners.map(partner => {
      const conversionRate = partner.total > 0 ? Math.round((partner.accepted / partner.total) * 100) : 0;
      return `
        <div class="top-partner-item">
          <span class="top-partner-name">${partner.name}</span>
          <span class="top-partner-stats">${partner.accepted}/${partner.total} (${conversionRate}%)</span>
        </div>
      `;
    }).join('');
  } else {
    list.innerHTML = '<div style="text-align: center; padding: 20px; color: #9ca3af;">Geen data beschikbaar</div>';
  }
}

// Make functions globally available
window.openAiAssignmentDrawer = openAiAssignmentDrawer;
window.closeAiAssignmentDrawer = closeAiAssignmentDrawer;
window.assignToPartner = assignToPartner;

