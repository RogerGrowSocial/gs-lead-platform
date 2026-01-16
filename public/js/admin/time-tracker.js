/**
 * Time Tracker Component
 * Simple clock icon + popover for quick time tracking in admin header
 */

(function() {
  'use strict';

  // Activity types for the dropdown
  const ACTIVITY_TYPES = [
    { value: 'website', label: 'Website' },
    { value: 'seo', label: 'SEO' },
    { value: 'ads', label: 'Ads' },
    { value: 'sales', label: 'Sales' },
    { value: 'support', label: 'Support' },
    { value: 'admin', label: 'Admin' },
    { value: 'other', label: 'Overig' }
  ];

  class TimeTracker {
    constructor(userId) {
      this.userId = userId;
      this.currentEntry = null;
      this.timerInterval = null;
      this.isOpen = false;
      
      this.init();
    }

    init() {
      this.createUI();
      this.loadCurrentEntry();
      this.setupEventListeners();
    }

    createUI() {
      // Find the header right section
      const headerRight = document.querySelector('.main-header-right');
      if (!headerRight) {
        console.warn('[TimeTracker] Header right section not found');
        return;
      }

      // Check if button already exists (prevent duplicates)
      const existingBtn = document.getElementById('timeTrackerBtn');
      if (existingBtn) {
        console.warn('[TimeTracker] Clock button already exists, reusing');
        this.clockButton = existingBtn;
        const existingPopover = document.getElementById('timeTrackerPopover');
        if (existingPopover) {
          this.popover = existingPopover;
        } else {
          // Create popover if it doesn't exist
          this.createPopover(headerRight);
        }
        return;
      }

      // Create clock icon button (before user dropdown)
      const clockButton = document.createElement('button');
      clockButton.className = 'time-tracker-btn';
      clockButton.id = 'timeTrackerBtn';
      clockButton.setAttribute('aria-label', 'Tijdregistratie');
      clockButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      `;
      clockButton.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        color: #6b7280;
        transition: color 0.2s;
        margin-right: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
      `;
      clockButton.addEventListener('mouseenter', () => {
        if (!this.currentEntry) {
          clockButton.style.color = '#374151';
        }
      });
      clockButton.addEventListener('mouseleave', () => {
        if (!this.currentEntry) {
          clockButton.style.color = '#6b7280';
        }
      });

      // Insert before user dropdown
      headerRight.insertBefore(clockButton, headerRight.firstChild);

      this.clockButton = clockButton;
      this.createPopover(headerRight);
    }

    createPopover(headerRight) {
      // Check if popover already exists
      const existingPopover = document.getElementById('timeTrackerPopover');
      if (existingPopover) {
        this.popover = existingPopover;
        return;
      }

      // Create popover
      const popover = document.createElement('div');
      popover.className = 'time-tracker-popover';
      popover.id = 'timeTrackerPopover';
      popover.style.cssText = `
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 320px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        z-index: 1000;
        display: none;
        padding: 16px;
      `;
      popover.innerHTML = this.getPopoverHTML();
      headerRight.style.position = 'relative';
      headerRight.appendChild(popover);

      this.popover = popover;
    }

    getPopoverHTML() {
      return `
        <div class="time-tracker-content">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">Tijdregistratie</h3>
            <button id="timeTrackerClose" style="background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Sluiten">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div id="timeTrackerStatus" style="margin-bottom: 16px; padding: 12px; background: #f9fafb; border-radius: 6px;">
            <div style="font-size: 14px; color: #6b7280; margin-bottom: 4px;">Status</div>
            <div id="timeTrackerElapsed" style="font-size: 20px; font-weight: 600; color: #111827; font-variant-numeric: tabular-nums;">Niet ingeklokt</div>
          </div>

          <form id="timeTrackerForm" style="display: none;">
            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Waar werk je aan?
              </label>
              <select id="timeTrackerActivity" required style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                ${ACTIVITY_TYPES.map(type => `<option value="${type.value}">${type.label}</option>`).join('')}
              </select>
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Notitie (optioneel)
              </label>
              <input type="text" id="timeTrackerNote" placeholder="Bijv. Bugfix login pagina" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
            </div>

            <div style="display: flex; gap: 8px; margin-top: 16px;">
              <button type="button" id="timeTrackerStart" style="flex: 1; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s;">
                Start
              </button>
            </div>
          </form>

          <div id="timeTrackerRunning" style="display: none;">
            <div style="margin-bottom: 12px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px;">
              <div style="font-size: 12px; color: #166534; margin-bottom: 4px;">Huidige activiteit</div>
              <div id="timeTrackerCurrentActivity" style="font-size: 14px; font-weight: 500; color: #166534;"></div>
              <div id="timeTrackerCurrentNote" style="font-size: 12px; color: #15803d; margin-top: 4px;"></div>
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Nieuwe activiteit
              </label>
              <select id="timeTrackerSwitchActivity" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                ${ACTIVITY_TYPES.map(type => `<option value="${type.value}">${type.label}</option>`).join('')}
              </select>
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Notitie (optioneel)
              </label>
              <input type="text" id="timeTrackerSwitchNote" placeholder="Bijv. Bugfix login pagina" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
            </div>

            <div style="display: flex; gap: 8px;">
              <button type="button" id="timeTrackerSwitch" style="flex: 1; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s;">
                Switch taak
              </button>
              <button type="button" id="timeTrackerStop" style="flex: 1; padding: 10px; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s;">
                Stop
              </button>
            </div>
          </div>

          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <a href="/admin/time-entries" style="font-size: 14px; color: #3b82f6; text-decoration: none; display: flex; align-items: center; gap: 6px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              Bekijk registraties
            </a>
          </div>
        </div>
      `;
    }

    setupEventListeners() {
      // Toggle popover
      this.clockButton.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePopover();
      });

      // Close button
      const closeBtn = this.popover.querySelector('#timeTrackerClose');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closePopover());
      }

      // Start button
      const startBtn = this.popover.querySelector('#timeTrackerStart');
      if (startBtn) {
        startBtn.addEventListener('click', () => this.handleStart());
      }

      // Switch button
      const switchBtn = this.popover.querySelector('#timeTrackerSwitch');
      if (switchBtn) {
        switchBtn.addEventListener('click', () => this.handleSwitch());
      }

      // Stop button
      const stopBtn = this.popover.querySelector('#timeTrackerStop');
      if (stopBtn) {
        stopBtn.addEventListener('click', () => this.handleStop());
      }

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (this.isOpen && !this.popover.contains(e.target) && !this.clockButton.contains(e.target)) {
          this.closePopover();
        }
      });
    }

    async loadCurrentEntry() {
      try {
        const response = await fetch(`/api/employees/${this.userId}/time-entries/active-timer`, {
          credentials: 'include'
        });
        const result = await response.json();
        
        if (result.ok && result.data) {
          this.currentEntry = result.data;
          this.updateUI();
          this.startTimer();
        } else {
          this.currentEntry = null;
          this.updateUI();
        }
      } catch (error) {
        console.error('[TimeTracker] Error loading current entry:', error);
      }
    }

    updateUI() {
      if (!this.clockButton || !this.popover) return;

      const form = this.popover.querySelector('#timeTrackerForm');
      const running = this.popover.querySelector('#timeTrackerRunning');
      const statusEl = this.popover.querySelector('#timeTrackerStatus');
      const elapsedEl = this.popover.querySelector('#timeTrackerElapsed');

      if (this.currentEntry) {
        // Running state
        this.clockButton.style.color = '#10b981'; // Green
        form.style.display = 'none';
        running.style.display = 'block';
        
        // Update current activity
        const activityType = this.getActivityLabel(this.currentEntry.project_name || 'other');
        const activityEl = this.popover.querySelector('#timeTrackerCurrentActivity');
        const noteEl = this.popover.querySelector('#timeTrackerCurrentNote');
        if (activityEl) activityEl.textContent = activityType;
        if (noteEl) {
          noteEl.textContent = this.currentEntry.note || '';
          noteEl.style.display = this.currentEntry.note ? 'block' : 'none';
        }

        // Update elapsed time
        this.updateElapsedTime();
      } else {
        // Idle state
        this.clockButton.style.color = '#6b7280';
        form.style.display = 'block';
        running.style.display = 'none';
        if (elapsedEl) elapsedEl.textContent = 'Niet ingeklokt';
      }
    }

    getActivityLabel(activityType) {
      const activity = ACTIVITY_TYPES.find(a => a.value === activityType);
      return activity ? activity.label : activityType || 'Overig';
    }

    updateElapsedTime() {
      if (!this.currentEntry) return;

      const elapsedEl = this.popover.querySelector('#timeTrackerElapsed');
      if (!elapsedEl) return;

      const start = new Date(this.currentEntry.start_at);
      const now = new Date();
      const diff = Math.floor((now - start) / 1000); // seconds

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      elapsedEl.textContent = `Loopt: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    startTimer() {
      this.stopTimer();
      if (this.currentEntry) {
        this.timerInterval = setInterval(() => {
          this.updateElapsedTime();
        }, 1000);
      }
    }

    stopTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    }

    togglePopover() {
      if (this.isOpen) {
        this.closePopover();
      } else {
        this.openPopover();
      }
    }

    openPopover() {
      this.isOpen = true;
      this.popover.style.display = 'block';
    }

    closePopover() {
      this.isOpen = false;
      this.popover.style.display = 'none';
    }

    async handleStart() {
      const activity = this.popover.querySelector('#timeTrackerActivity').value;
      const note = this.popover.querySelector('#timeTrackerNote').value.trim();

      try {
        const response = await fetch(`/api/employees/${this.userId}/time-entries/clock-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            project_name: activity,
            note: note || null
          })
        });

        const result = await response.json();

        if (result.ok) {
          this.currentEntry = result.data;
          this.updateUI();
          this.startTimer();
          this.closePopover();
          if (typeof window.showNotification === 'function') {
            window.showNotification('Timer gestart', 'success');
          }
        } else {
          throw new Error(result.error || 'Fout bij starten timer');
        }
      } catch (error) {
        console.error('[TimeTracker] Error starting timer:', error);
        if (typeof window.showNotification === 'function') {
          window.showNotification(error.message || 'Fout bij starten timer', 'error');
        }
      }
    }

    async handleSwitch() {
      const activity = this.popover.querySelector('#timeTrackerSwitchActivity').value;
      const note = this.popover.querySelector('#timeTrackerSwitchNote').value.trim();

      try {
        const response = await fetch(`/api/employees/${this.userId}/time-entries/switch-task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            project_name: activity,
            note: note || null
          })
        });

        const result = await response.json();

        if (result.ok) {
          this.currentEntry = result.data;
          this.updateUI();
          this.startTimer();
          this.closePopover();
          if (typeof window.showNotification === 'function') {
            window.showNotification('Taak gewisseld', 'success');
          }
        } else {
          throw new Error(result.error || 'Fout bij wisselen taak');
        }
      } catch (error) {
        console.error('[TimeTracker] Error switching task:', error);
        if (typeof window.showNotification === 'function') {
          window.showNotification(error.message || 'Fout bij wisselen taak', 'error');
        }
      }
    }

    async handleStop() {
      try {
        const response = await fetch(`/api/employees/${this.userId}/time-entries/clock-out`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({})
        });

        const result = await response.json();

        if (result.ok) {
          this.currentEntry = null;
          this.stopTimer();
          this.updateUI();
          this.closePopover();
          if (typeof window.showNotification === 'function') {
            window.showNotification('Timer gestopt', 'success');
          }
        } else {
          throw new Error(result.error || 'Fout bij stoppen timer');
        }
      } catch (error) {
        console.error('[TimeTracker] Error stopping timer:', error);
        if (typeof window.showNotification === 'function') {
          window.showNotification(error.message || 'Fout bij stoppen timer', 'error');
        }
      }
    }
  }

  // Initialize when DOM is ready
  function initTimeTracker() {
    // Check if time tracker already exists
    if (window.timeTracker) {
      console.log('[TimeTracker] Time tracker already initialized, skipping');
      return;
    }

    // Get user ID from window or try to extract from page
    let userId = null;
    
    // Try to get from window (set by admin layout)
    if (typeof window !== 'undefined' && window.currentUserId) {
      userId = window.currentUserId;
    }
    
    // Try to get from user data in page
    if (!userId && typeof window !== 'undefined' && window.userData) {
      userId = window.userData.id;
    }

    // Try to extract from profile data
    if (!userId) {
      const userProfile = document.querySelector('[data-user-id]');
      if (userProfile) {
        userId = userProfile.getAttribute('data-user-id');
      }
    }

    if (!userId) {
      console.warn('[TimeTracker] User ID not found, time tracker disabled');
      return;
    }

    // Clean up any existing UI elements (in case of page reload/navigation)
    const existingBtn = document.getElementById('timeTrackerBtn');
    const existingPopover = document.getElementById('timeTrackerPopover');
    if (existingBtn) {
      existingBtn.remove();
    }
    if (existingPopover) {
      existingPopover.remove();
    }

    window.timeTracker = new TimeTracker(userId);
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTimeTracker);
  } else {
    initTimeTracker();
  }

  // Also initialize after client-side navigation
  if (typeof window !== 'undefined') {
    window.addEventListener('page:loaded', initTimeTracker);
  }
})();
