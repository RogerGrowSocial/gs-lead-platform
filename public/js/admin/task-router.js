// AI Task Router JavaScript

let taskRouterEnabled = true;
let taskRouterSettings = {
  autoAssign: true,
  skillsWeight: 50,
  workloadWeight: 30,
  completionWeight: 20,
  autoAssignThreshold: 60
};

// Load Task Router settings
async function loadTaskRouterSettings() {
  try {
    const response = await fetch('/api/admin/task-router/settings', {
      credentials: 'include'
    });
    
    const result = await response.json();
    
    if (result.success && result.data) {
      taskRouterSettings = result.data;
      taskRouterEnabled = result.data.autoAssign;
      updateTaskRouterStatus();
      
      // Update modal if open
      if (document.getElementById('taskRouterSettingsModal')) {
        updateTaskRouterModal();
      }
    }
  } catch (error) {
    console.error('Error loading Task Router settings:', error);
  }
}

// Update status badge
function updateTaskRouterStatus() {
  const badge = document.getElementById('taskRouterStatusBadge');
  const label = document.getElementById('taskRouterStatusLabel');
  
  if (badge && label) {
    if (taskRouterEnabled) {
      badge.setAttribute('data-status', 'enabled');
      label.textContent = 'Automatische toewijzing: Aan';
    } else {
      badge.setAttribute('data-status', 'disabled');
      label.textContent = 'Automatische toewijzing: Uit';
    }
  }
}

// Update modal with current settings
function updateTaskRouterModal() {
  const autoAssignToggle = document.getElementById('taskAutoAssignToggle');
  const skillsWeightSlider = document.getElementById('taskSkillsWeight');
  const workloadWeightSlider = document.getElementById('taskWorkloadWeight');
  const completionWeightSlider = document.getElementById('taskCompletionWeight');
  const thresholdSlider = document.getElementById('taskAutoAssignThreshold');
  
  if (autoAssignToggle) {
    autoAssignToggle.checked = taskRouterSettings.autoAssign;
  }
  
  if (skillsWeightSlider) {
    skillsWeightSlider.value = taskRouterSettings.skillsWeight;
    updateSliderDisplay('taskSkillsWeight');
  }
  
  if (workloadWeightSlider) {
    workloadWeightSlider.value = taskRouterSettings.workloadWeight;
    updateSliderDisplay('taskWorkloadWeight');
  }
  
  if (completionWeightSlider) {
    completionWeightSlider.value = taskRouterSettings.completionWeight;
    updateSliderDisplay('taskCompletionWeight');
  }
  
  if (thresholdSlider) {
    thresholdSlider.value = taskRouterSettings.autoAssignThreshold;
    updateSliderDisplay('taskAutoAssignThreshold');
  }
}

// Update slider display
function updateSliderDisplay(sliderId) {
  const slider = document.getElementById(sliderId);
  const valueDisplay = document.getElementById(sliderId + 'Value');
  const range = document.getElementById(sliderId + 'Range');
  const thumb = document.getElementById(sliderId + 'Thumb');
  
  if (slider && valueDisplay) {
    const value = parseInt(slider.value);
    valueDisplay.textContent = value + '%';
    
    if (range) {
      range.style.right = (100 - value) + '%';
    }
    if (thumb) {
      thumb.style.left = value + '%';
    }
  }
}

// Save Task Router settings
async function saveTaskRouterSettings() {
  const autoAssignToggle = document.getElementById('taskAutoAssignToggle');
  const skillsWeight = document.getElementById('taskSkillsWeight')?.value || 50;
  const workloadWeight = document.getElementById('taskWorkloadWeight')?.value || 30;
  const completionWeight = document.getElementById('taskCompletionWeight')?.value || 20;
  const threshold = document.getElementById('taskAutoAssignThreshold')?.value || 60;
  
  const settings = {
    autoAssign: autoAssignToggle?.checked !== false,
    skillsWeight: parseInt(skillsWeight, 10),
    workloadWeight: parseInt(workloadWeight, 10),
    completionWeight: parseInt(completionWeight, 10),
    autoAssignThreshold: parseInt(threshold, 10)
  };
  
  try {
    const response = await fetch('/api/admin/task-router/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(settings)
    });
    
    const result = await response.json();
    
    if (result.success) {
      taskRouterSettings = result.data;
      taskRouterEnabled = result.data.autoAssign;
      updateTaskRouterStatus();
      
      if (window.showNotification) {
        window.showNotification('Instellingen opgeslagen', 'success');
      }
      
      closeTaskRouterModal();
    } else {
      throw new Error(result.error || 'Fout bij opslaan instellingen');
    }
  } catch (error) {
    console.error('Error saving Task Router settings:', error);
    if (window.showNotification) {
      window.showNotification('Fout bij opslaan instellingen', 'error');
    }
  }
}

// Modal functions
function openTaskRouterModal() {
  const modal = document.getElementById('taskRouterSettingsModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    document.body.style.overflow = 'hidden';
    updateTaskRouterModal();
    setupTaskRouterSliderListeners();
  }
}

function closeTaskRouterModal() {
  const modal = document.getElementById('taskRouterSettingsModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// Setup slider listeners
function setupTaskRouterSliderListeners() {
  ['taskSkillsWeight', 'taskWorkloadWeight', 'taskCompletionWeight', 'taskAutoAssignThreshold'].forEach(id => {
    const slider = document.getElementById(id);
    if (slider && !slider.hasAttribute('data-listener-attached')) {
      slider.setAttribute('data-listener-attached', 'true');
      slider.addEventListener('input', () => {
        updateSliderDisplay(id);
      });
    }
  });
}

// Initialize
function initTaskRouter() {
  // Load settings on page load
  loadTaskRouterSettings();
  
  // Setup settings button
  const settingsBtn = document.getElementById('taskRouterSettingsBtn');
  if (settingsBtn && !settingsBtn.hasAttribute('data-listener-attached')) {
    settingsBtn.setAttribute('data-listener-attached', 'true');
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTaskRouterModal();
    });
  }
  
  // Setup save button
  const saveBtn = document.getElementById('taskRouterSaveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      saveTaskRouterSettings();
    });
  }
  
  // Setup close buttons
  const closeBtn = document.getElementById('taskRouterCloseBtn');
  const cancelBtn = document.getElementById('taskRouterCancelBtn');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeTaskRouterModal();
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeTaskRouterModal();
    });
  }
  
  // Close modal on overlay click
  const modal = document.getElementById('taskRouterSettingsModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeTaskRouterModal();
      }
    });
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTaskRouter);
} else {
  initTaskRouter();
}

