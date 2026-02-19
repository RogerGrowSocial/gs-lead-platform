/**
 * Time Tracker Component
 * Simple clock icon + popover for quick time tracking in admin header
 */

(function() {
  'use strict';

  // Activity types for the dropdown
  const ACTIVITY_TYPES = [
    { value: 'klantenwerk', label: 'Klantenwerk' },
    { value: 'sales', label: 'Sales' },
    { value: 'support', label: 'Support' },
    { value: 'overleg', label: 'Overleg' },
    { value: 'operations', label: 'Operations' }
  ];

  class TimeTracker {
    constructor(userId) {
      this.userId = userId;
      this.currentEntry = null;
      this.timerInterval = null;
      this.isOpen = false;
      this.tasks = [];
      this.customers = [];
      this.contacts = [];
      
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
        color: #bdbec9;
        transition: color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
      `;
      clockButton.addEventListener('mouseenter', () => {
        if (!this.currentEntry) {
          clockButton.style.color = '#9ca3af';
        }
      });
      clockButton.addEventListener('mouseleave', () => {
        if (!this.currentEntry) {
          clockButton.style.color = '#bdbec9';
        }
      });

      // Insert before user dropdown, but align to center with user-name
      // Find user dropdown to insert before it
      const userDropdown = headerRight.querySelector('.user-dropdown');
      if (userDropdown) {
        headerRight.insertBefore(clockButton, userDropdown);
      } else {
        headerRight.insertBefore(clockButton, headerRight.firstChild);
      }
      
      // Ensure button is vertically centered with user-name
      // The header-right already uses flexbox with align-items: center

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
        width: 360px;
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
                ${ACTIVITY_TYPES.map(type => `<option value="${type.value}" ${type.value === 'klantenwerk' ? 'selected' : ''}>${type.label}</option>`).join('')}
              </select>
            </div>

            <!-- Task Selection (shown when "Taken" is selected) -->
            <div id="timeTrackerTaskContainer" style="margin-bottom: 12px; display: none;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Taak
              </label>
              <div style="position: relative;">
                <input 
                  type="text" 
                  id="timeTrackerTaskSearch" 
                  placeholder="Zoek taak..." 
                  autocomplete="off"
                  style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;"
                />
                <button 
                  type="button"
                  id="timeTrackerTaskClear" 
                  style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280; transition: color 0.2s;"
                  aria-label="Wis taak"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div id="timeTrackerTaskDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <input type="hidden" id="timeTrackerTaskId" />
            </div>

            <!-- Customer Selection (shown when task is selected or "Taken" is selected) -->
            <div id="timeTrackerCustomerContainer" style="margin-bottom: 12px; display: none;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Klant
              </label>
              <div style="position: relative;">
                <input 
                  type="text" 
                  id="timeTrackerCustomerSearch" 
                  placeholder="Zoek klant..." 
                  autocomplete="off"
                  style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;"
                />
                <button 
                  type="button"
                  id="timeTrackerCustomerClear" 
                  style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280; transition: color 0.2s;"
                  aria-label="Wis klant"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div id="timeTrackerCustomerDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <input type="hidden" id="timeTrackerCustomerId" />
            </div>

            <!-- Contact Selection (shown when task is selected) -->
            <div id="timeTrackerContactContainer" style="margin-bottom: 12px; display: none;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Contact
              </label>
              <input 
                type="text" 
                id="timeTrackerContactSearch" 
                placeholder="Zoek contact..." 
                autocomplete="off"
                style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;"
              />
              <div id="timeTrackerContactDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <input type="hidden" id="timeTrackerContactId" />
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Titel <span style="color: #ef4444;">*</span>
              </label>
              <input type="text" id="timeTrackerNote" required placeholder="Bijv. Bugfix login pagina" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
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

            <!-- Task (switch) - shown when Klantenwerk or Support -->
            <div id="timeTrackerSwitchTaskContainer" style="margin-bottom: 12px; display: none;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">Taak</label>
              <div style="position: relative;">
                <input type="text" id="timeTrackerSwitchTaskSearch" placeholder="Zoek taak..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" />
                <button type="button" id="timeTrackerSwitchTaskClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis taak">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div id="timeTrackerSwitchTaskDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <input type="hidden" id="timeTrackerSwitchTaskId" />
            </div>

            <!-- Klant (switch) - shown when Klantenwerk or Support -->
            <div id="timeTrackerSwitchCustomerContainer" style="margin-bottom: 12px; display: none;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">Klant <span style="color: #ef4444;">*</span></label>
              <div style="position: relative;">
                <input type="text" id="timeTrackerSwitchCustomerSearch" placeholder="Zoek klant..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" />
                <button type="button" id="timeTrackerSwitchCustomerClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis klant">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div id="timeTrackerSwitchCustomerDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <input type="hidden" id="timeTrackerSwitchCustomerId" />
            </div>

            <!-- Contact (switch) -->
            <div id="timeTrackerSwitchContactContainer" style="margin-bottom: 12px; display: none;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">Contact</label>
              <input type="text" id="timeTrackerSwitchContactSearch" placeholder="Zoek contact..." autocomplete="off" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" />
              <div id="timeTrackerSwitchContactDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <input type="hidden" id="timeTrackerSwitchContactId" />
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Titel <span style="color: #ef4444;">*</span>
              </label>
              <input type="text" id="timeTrackerSwitchNote" required placeholder="Bijv. Bugfix login pagina" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
            </div>

            <div style="display: flex; gap: 8px;">
              <button type="button" id="timeTrackerSwitch" style="flex: 1; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s;">
                Wissel taak
              </button>
              <button type="button" id="timeTrackerStop" style="flex: 1; padding: 10px; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s;">
                Uitklokken
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

      // Activity change handler
      const activitySelect = this.popover.querySelector('#timeTrackerActivity');
      if (activitySelect) {
        activitySelect.addEventListener('change', () => this.handleActivityChange());
        // Initialize with default (klantenwerk) - show task and customer fields
        if (activitySelect.value === 'klantenwerk') {
          this.handleActivityChange();
        }
      }

      // Task search handler
      const taskSearch = this.popover.querySelector('#timeTrackerTaskSearch');
      const taskClearBtn = this.popover.querySelector('#timeTrackerTaskClear');
      if (taskSearch) {
        taskSearch.addEventListener('input', (e) => {
          this.handleTaskSearch(e.target.value);
          this.updateTaskClearButton();
        });
        taskSearch.addEventListener('focus', () => {
          this.loadTasks().then(() => {
            // Show all tasks when focused (if no query)
            if (!taskSearch.value || taskSearch.value.length === 0) {
              this.handleTaskSearch('');
            }
          });
        });
        // Close task dropdown when field loses focus (e.g. user clicked elsewhere)
        taskSearch.addEventListener('blur', () => {
          const taskDropdown = this.popover.querySelector('#timeTrackerTaskDropdown');
          if (!taskDropdown) return;
          // Delay so clicking an option in the list still works (option click runs before this)
          setTimeout(() => { taskDropdown.style.display = 'none'; }, 200);
        });
        // Update clear button visibility on change
        taskSearch.addEventListener('change', () => this.updateTaskClearButton());
      }
      if (taskClearBtn) {
        taskClearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.clearTaskSelection();
        });
        taskClearBtn.addEventListener('mouseenter', () => {
          taskClearBtn.style.color = '#ef4444';
        });
        taskClearBtn.addEventListener('mouseleave', () => {
          taskClearBtn.style.color = '#6b7280';
        });
      }

      // Customer search handler
      const customerSearch = this.popover.querySelector('#timeTrackerCustomerSearch');
      const customerClearBtn = this.popover.querySelector('#timeTrackerCustomerClear');
      if (customerSearch) {
        customerSearch.addEventListener('input', (e) => {
          this.handleCustomerSearch(e.target.value);
          this.updateCustomerClearButton();
        });
        customerSearch.addEventListener('focus', () => this.loadCustomers());
        // Update clear button visibility on change
        customerSearch.addEventListener('change', () => this.updateCustomerClearButton());
      }
      if (customerClearBtn) {
        customerClearBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.clearCustomerSelection();
        });
        customerClearBtn.addEventListener('mouseenter', () => {
          customerClearBtn.style.color = '#ef4444';
        });
        customerClearBtn.addEventListener('mouseleave', () => {
          customerClearBtn.style.color = '#6b7280';
        });
      }

      // Contact search handler
      const contactSearch = this.popover.querySelector('#timeTrackerContactSearch');
      if (contactSearch) {
        contactSearch.addEventListener('input', (e) => this.handleContactSearch(e.target.value));
      }

      // Switch activity change (when timer is running)
      const switchActivity = this.popover.querySelector('#timeTrackerSwitchActivity');
      if (switchActivity) {
        switchActivity.addEventListener('change', () => this.handleSwitchActivityChange());
      }

      // Switch task search
      const switchTaskSearch = this.popover.querySelector('#timeTrackerSwitchTaskSearch');
      if (switchTaskSearch) {
        switchTaskSearch.addEventListener('input', (e) => this.handleSwitchTaskSearch(e.target.value));
        switchTaskSearch.addEventListener('focus', () => {
          this.loadTasks().then(() => {
            if (!switchTaskSearch.value || switchTaskSearch.value.length === 0) this.handleSwitchTaskSearch('');
          });
        });
      }
      const switchTaskClear = this.popover.querySelector('#timeTrackerSwitchTaskClear');
      if (switchTaskClear) {
        switchTaskClear.addEventListener('click', (e) => { e.stopPropagation(); this.clearSwitchTaskSelection(); });
      }

      // Switch customer search
      const switchCustomerSearch = this.popover.querySelector('#timeTrackerSwitchCustomerSearch');
      if (switchCustomerSearch) {
        switchCustomerSearch.addEventListener('input', (e) => this.handleSwitchCustomerSearch(e.target.value));
        switchCustomerSearch.addEventListener('focus', () => this.loadCustomers());
      }
      const switchCustomerClear = this.popover.querySelector('#timeTrackerSwitchCustomerClear');
      if (switchCustomerClear) {
        switchCustomerClear.addEventListener('click', (e) => { e.stopPropagation(); this.clearSwitchCustomerSelection(); });
      }

      // Switch contact search
      const switchContactSearch = this.popover.querySelector('#timeTrackerSwitchContactSearch');
      if (switchContactSearch) {
        switchContactSearch.addEventListener('input', (e) => this.handleSwitchContactSearch(e.target.value));
      }

      // Close switch dropdowns on mousedown outside
      document.addEventListener('mousedown', (e) => {
        const closeIfOutside = (dropdownId, containerId) => {
          const dropdown = this.popover.querySelector(dropdownId);
          const container = this.popover.querySelector(containerId);
          if (dropdown && container && dropdown.style.display === 'block' && !container.contains(e.target)) {
            dropdown.style.display = 'none';
          }
        };
        closeIfOutside('#timeTrackerSwitchTaskDropdown', '#timeTrackerSwitchTaskContainer');
        closeIfOutside('#timeTrackerSwitchCustomerDropdown', '#timeTrackerSwitchCustomerContainer');
        closeIfOutside('#timeTrackerSwitchContactDropdown', '#timeTrackerSwitchContactContainer');
      });

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

      // Close task dropdown when clicking outside the task field (mousedown = before focus move, so more reliable)
      document.addEventListener('mousedown', (e) => {
        const taskDropdown = this.popover.querySelector('#timeTrackerTaskDropdown');
        const taskContainer = this.popover.querySelector('#timeTrackerTaskContainer');
        if (taskDropdown && taskContainer && taskDropdown.style.display === 'block') {
          if (!taskContainer.contains(e.target)) {
            taskDropdown.style.display = 'none';
          }
        }
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (this.isOpen && !this.popover.contains(e.target) && !this.clockButton.contains(e.target)) {
          this.closePopover();
        }
      });
    }

    handleActivityChange() {
      const activity = this.popover.querySelector('#timeTrackerActivity').value;
      const taskContainer = this.popover.querySelector('#timeTrackerTaskContainer');
      const customerContainer = this.popover.querySelector('#timeTrackerCustomerContainer');
      const contactContainer = this.popover.querySelector('#timeTrackerContactContainer');

      if (activity === 'klantenwerk' || activity === 'support') {
        taskContainer.style.display = 'block';
        customerContainer.style.display = 'block';
        this.loadTasks();
        this.loadCustomers();
      } else {
        taskContainer.style.display = 'none';
        customerContainer.style.display = 'none';
        contactContainer.style.display = 'none';
        this.popover.querySelector('#timeTrackerTaskId').value = '';
        this.popover.querySelector('#timeTrackerTaskSearch').value = '';
        this.popover.querySelector('#timeTrackerCustomerId').value = '';
        this.popover.querySelector('#timeTrackerCustomerSearch').value = '';
        this.popover.querySelector('#timeTrackerContactId').value = '';
        this.popover.querySelector('#timeTrackerContactSearch').value = '';
      }
    }

    handleSwitchActivityChange() {
      const activity = this.popover.querySelector('#timeTrackerSwitchActivity').value;
      const taskContainer = this.popover.querySelector('#timeTrackerSwitchTaskContainer');
      const customerContainer = this.popover.querySelector('#timeTrackerSwitchCustomerContainer');
      const contactContainer = this.popover.querySelector('#timeTrackerSwitchContactContainer');

      if (activity === 'klantenwerk' || activity === 'support') {
        taskContainer.style.display = 'block';
        customerContainer.style.display = 'block';
        this.loadTasks();
        this.loadCustomers();
      } else {
        taskContainer.style.display = 'none';
        customerContainer.style.display = 'none';
        contactContainer.style.display = 'none';
        this.popover.querySelector('#timeTrackerSwitchTaskId').value = '';
        this.popover.querySelector('#timeTrackerSwitchTaskSearch').value = '';
        this.popover.querySelector('#timeTrackerSwitchCustomerId').value = '';
        this.popover.querySelector('#timeTrackerSwitchCustomerSearch').value = '';
        this.popover.querySelector('#timeTrackerSwitchContactId').value = '';
        this.popover.querySelector('#timeTrackerSwitchContactSearch').value = '';
      }
      this.updateSwitchTaskClearButton();
      this.updateSwitchCustomerClearButton();
    }

    async loadTasks() {
      try {
        const response = await fetch(`/api/employees/${this.userId}/tasks?status=open,in_progress`, {
          credentials: 'include'
        });
        const result = await response.json();
        
        if (result.ok && result.data) {
          this.tasks = result.data.tasks || result.data || [];
        }
      } catch (error) {
        console.error('[TimeTracker] Error loading tasks:', error);
      }
    }

    async loadCustomers() {
      try {
        // Load customers from API
        const response = await fetch(`/admin/api/customers/search?q=`, {
          credentials: 'include'
        });
        const result = await response.json();
        
        if (result.success && result.customers) {
          this.customers = result.customers || [];
        }
      } catch (error) {
        console.error('[TimeTracker] Error loading customers:', error);
      }
    }

    handleTaskSearch(query) {
      const dropdown = this.popover.querySelector('#timeTrackerTaskDropdown');
      
      // If no query, show all tasks (up to 50)
      const filtered = (!query || query.length < 1) 
        ? this.tasks.slice(0, 50)
        : this.tasks.filter(task => 
            task.title?.toLowerCase().includes(query.toLowerCase())
          );

      if (filtered.length === 0) {
        dropdown.innerHTML = `
          <div style="padding: 12px; color: #6b7280; text-align: center;">
            <div style="margin-bottom: 8px;">Geen taken gevonden</div>
            <button 
              id="addTaskFromSearchBtn" 
              style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.2s;"
              onmouseover="this.style.background='#2563eb'"
              onmouseout="this.style.background='#3b82f6'"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Taak toevoegen
            </button>
          </div>
        `;
        
        // Add click handler for add task button
        const addTaskBtn = dropdown.querySelector('#addTaskFromSearchBtn');
        if (addTaskBtn) {
          addTaskBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showAddTaskModal(query || '');
          });
        }
      } else {
        dropdown.innerHTML = filtered.map(task => `
          <div 
            class="task-option" 
            style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.2s;"
            onmouseover="this.style.background='#f9fafb'"
            onmouseout="this.style.background='white'"
            data-task-id="${task.id}"
            data-task-title="${task.title || ''}"
            data-customer-id="${task.customer_id || ''}"
            data-customer-name="${task.customer?.company_name || task.customer?.first_name + ' ' + task.customer?.last_name || ''}"
            data-contact-id="${task.contact_id || ''}"
          >
            <div style="font-weight: 500; color: #111827; font-size: 14px;">${task.title || 'Geen titel'}</div>
            ${task.customer ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${task.customer.company_name || task.customer.first_name + ' ' + task.customer.last_name}</div>` : ''}
          </div>
        `).join('');

        // Add click handlers
        dropdown.querySelectorAll('.task-option').forEach(option => {
          option.addEventListener('click', () => {
            const taskId = option.getAttribute('data-task-id');
            const taskTitle = option.getAttribute('data-task-title');
            const customerId = option.getAttribute('data-customer-id');
            const customerName = option.getAttribute('data-customer-name');
            const contactId = option.getAttribute('data-contact-id');

            this.popover.querySelector('#timeTrackerTaskId').value = taskId;
            this.popover.querySelector('#timeTrackerTaskSearch').value = taskTitle;
            this.popover.querySelector('#timeTrackerTaskDropdown').style.display = 'none';
            this.updateTaskClearButton();

            // Always show customer container when klantenwerk is selected
            const activity = this.popover.querySelector('#timeTrackerActivity').value;
            if (activity === 'klantenwerk') {
              this.popover.querySelector('#timeTrackerCustomerContainer').style.display = 'block';
            }

            if (customerId && customerName) {
              this.popover.querySelector('#timeTrackerCustomerId').value = customerId;
              this.popover.querySelector('#timeTrackerCustomerSearch').value = customerName;
              this.updateCustomerClearButton();
              
              // Auto-fill title: "Taak: [taak titel] voor: [klant naam]"
              const noteInput = this.popover.querySelector('#timeTrackerNote');
              if (noteInput && taskTitle && customerName) {
                noteInput.value = `Taak: ${taskTitle} voor: ${customerName}`;
              }
              
              // Load contacts for this customer
              if (contactId) {
                this.loadContactsForCustomer(customerId, contactId);
              }
            } else if (taskTitle) {
              // Auto-fill title even if no customer: "Taak: [taak titel]"
              const noteInput = this.popover.querySelector('#timeTrackerNote');
              if (noteInput) {
                noteInput.value = `Taak: ${taskTitle}`;
              }
            }
          });
        });
      }

      dropdown.style.display = 'block';
    }

    async loadContactsForCustomer(customerId, selectedContactId = null) {
      try {
        // Try to load contacts - endpoint may not exist yet
        const response = await fetch(`/admin/api/customers/${customerId}/contacts`, {
          credentials: 'include'
        });
        const result = await response.json();
        
        if (result.success && result.contacts) {
          this.contacts = result.contacts || [];
        } else if (result.ok && result.data) {
          this.contacts = result.data || [];
        } else {
          this.contacts = [];
        }
        
        const contactContainer = this.popover.querySelector('#timeTrackerContactContainer');
        if (this.contacts.length > 0) {
          contactContainer.style.display = 'block';
          
          if (selectedContactId) {
            const contact = this.contacts.find(c => c.id === selectedContactId);
            if (contact) {
              const contactName = (contact.first_name || '') + ' ' + (contact.last_name || '') || contact.email || '';
              this.popover.querySelector('#timeTrackerContactId').value = contact.id;
              this.popover.querySelector('#timeTrackerContactSearch').value = contactName;
            }
          }
        } else {
          contactContainer.style.display = 'none';
        }
      } catch (error) {
        console.error('[TimeTracker] Error loading contacts:', error);
        // Hide contact container if endpoint doesn't exist
        const contactContainer = this.popover.querySelector('#timeTrackerContactContainer');
        if (contactContainer) {
          contactContainer.style.display = 'none';
        }
      }
    }

    handleCustomerSearch(query) {
      const dropdown = this.popover.querySelector('#timeTrackerCustomerDropdown');
      if (!query || query.length < 1) {
        dropdown.style.display = 'none';
        return;
      }

      const filtered = this.customers.filter(customer => 
        (customer.company_name?.toLowerCase().includes(query.toLowerCase())) ||
        (customer.first_name?.toLowerCase().includes(query.toLowerCase())) ||
        (customer.last_name?.toLowerCase().includes(query.toLowerCase())) ||
        (customer.email?.toLowerCase().includes(query.toLowerCase()))
      );

      if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280; text-align: center;">Geen klanten gevonden</div>';
      } else {
        dropdown.innerHTML = filtered.map(customer => `
          <div 
            class="customer-option" 
            style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.2s;"
            onmouseover="this.style.background='#f9fafb'"
            onmouseout="this.style.background='white'"
            data-customer-id="${customer.id}"
            data-customer-name="${customer.company_name || customer.first_name + ' ' + customer.last_name || customer.email || ''}"
          >
            <div style="font-weight: 500; color: #111827; font-size: 14px;">${customer.company_name || customer.first_name + ' ' + customer.last_name || customer.email || 'Onbekend'}</div>
          </div>
        `).join('');

        dropdown.querySelectorAll('.customer-option').forEach(option => {
          option.addEventListener('click', () => {
            const customerId = option.getAttribute('data-customer-id');
            const customerName = option.getAttribute('data-customer-name');

            this.popover.querySelector('#timeTrackerCustomerId').value = customerId;
            this.popover.querySelector('#timeTrackerCustomerSearch').value = customerName;
            this.popover.querySelector('#timeTrackerCustomerDropdown').style.display = 'none';
            this.updateCustomerClearButton();

            // Update title if task is selected
            const taskId = this.popover.querySelector('#timeTrackerTaskId').value;
            const taskTitle = this.popover.querySelector('#timeTrackerTaskSearch').value;
            const noteInput = this.popover.querySelector('#timeTrackerNote');
            if (noteInput && taskId && taskTitle && customerName) {
              noteInput.value = `Taak: ${taskTitle} voor: ${customerName}`;
            }

            // Load contacts for this customer
            this.loadContactsForCustomer(customerId);
          });
        });
      }

      dropdown.style.display = 'block';
    }

    handleContactSearch(query) {
      const dropdown = this.popover.querySelector('#timeTrackerContactDropdown');
      if (!query || query.length < 1) {
        dropdown.style.display = 'none';
        return;
      }

      const filtered = this.contacts.filter(contact => 
        (contact.first_name?.toLowerCase().includes(query.toLowerCase())) ||
        (contact.last_name?.toLowerCase().includes(query.toLowerCase())) ||
        (contact.email?.toLowerCase().includes(query.toLowerCase()))
      );

      if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280; text-align: center;">Geen contacten gevonden</div>';
      } else {
        dropdown.innerHTML = filtered.map(contact => {
          const contactName = (contact.first_name || '') + ' ' + (contact.last_name || '') || contact.email || 'Onbekend';
          return `
          <div 
            class="contact-option" 
            style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.2s;"
            onmouseover="this.style.background='#f9fafb'"
            onmouseout="this.style.background='white'"
            data-contact-id="${contact.id}"
            data-contact-name="${contactName}"
          >
            <div style="font-weight: 500; color: #111827; font-size: 14px;">${contactName}</div>
            ${contact.email ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${contact.email}</div>` : ''}
          </div>
        `;
        }).join('');

        dropdown.querySelectorAll('.contact-option').forEach(option => {
          option.addEventListener('click', () => {
            const contactId = option.getAttribute('data-contact-id');
            const contactName = option.getAttribute('data-contact-name');

            this.popover.querySelector('#timeTrackerContactId').value = contactId;
            this.popover.querySelector('#timeTrackerContactSearch').value = contactName;
            this.popover.querySelector('#timeTrackerContactDropdown').style.display = 'none';
          });
        });
      }

      dropdown.style.display = 'block';
    }

    handleSwitchTaskSearch(query) {
      const dropdown = this.popover.querySelector('#timeTrackerSwitchTaskDropdown');
      const filtered = (!query || query.length < 1)
        ? this.tasks.slice(0, 50)
        : this.tasks.filter(task => task.title?.toLowerCase().includes(query.toLowerCase()));

      if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280; text-align: center;">Geen taken gevonden</div>';
      } else {
        dropdown.innerHTML = filtered.map(task => `
          <div class="task-option" style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'"
            data-task-id="${task.id}" data-task-title="${task.title || ''}"
            data-customer-id="${task.customer_id || ''}" data-customer-name="${task.customer?.company_name || task.customer?.first_name + ' ' + task.customer?.last_name || ''}"
            data-contact-id="${task.contact_id || ''}">
            <div style="font-weight: 500; color: #111827; font-size: 14px;">${task.title || 'Geen titel'}</div>
            ${task.customer ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${task.customer.company_name || task.customer.first_name + ' ' + task.customer.last_name}</div>` : ''}
          </div>
        `).join('');

        dropdown.querySelectorAll('.task-option').forEach(option => {
          option.addEventListener('click', () => {
            const taskId = option.getAttribute('data-task-id');
            const taskTitle = option.getAttribute('data-task-title');
            const customerId = option.getAttribute('data-customer-id');
            const customerName = option.getAttribute('data-customer-name');
            const contactId = option.getAttribute('data-contact-id');

            this.popover.querySelector('#timeTrackerSwitchTaskId').value = taskId;
            this.popover.querySelector('#timeTrackerSwitchTaskSearch').value = taskTitle;
            this.popover.querySelector('#timeTrackerSwitchTaskDropdown').style.display = 'none';
            this.updateSwitchTaskClearButton();

            if (customerId && customerName) {
              this.popover.querySelector('#timeTrackerSwitchCustomerId').value = customerId;
              this.popover.querySelector('#timeTrackerSwitchCustomerSearch').value = customerName;
              this.updateSwitchCustomerClearButton();
              const noteEl = this.popover.querySelector('#timeTrackerSwitchNote');
              if (noteEl && taskTitle && customerName) noteEl.value = `Taak: ${taskTitle} voor: ${customerName}`;
              if (contactId) this.loadContactsForCustomerSwitch(customerId, contactId);
            } else if (taskTitle) {
              const noteEl = this.popover.querySelector('#timeTrackerSwitchNote');
              if (noteEl) noteEl.value = `Taak: ${taskTitle}`;
            }
          });
        });
      }
      dropdown.style.display = 'block';
    }

    handleSwitchCustomerSearch(query) {
      const dropdown = this.popover.querySelector('#timeTrackerSwitchCustomerDropdown');
      if (!query || query.length < 1) { dropdown.style.display = 'none'; return; }
      const filtered = this.customers.filter(c => (c.company_name?.toLowerCase().includes(query.toLowerCase())) || (c.first_name?.toLowerCase().includes(query.toLowerCase())) || (c.last_name?.toLowerCase().includes(query.toLowerCase())) || (c.email?.toLowerCase().includes(query.toLowerCase())));
      if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280; text-align: center;">Geen klanten gevonden</div>';
      } else {
        dropdown.innerHTML = filtered.map(c => `
          <div class="customer-option" style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'"
            data-customer-id="${c.id}" data-customer-name="${c.company_name || c.first_name + ' ' + c.last_name || c.email || ''}">
            <div style="font-weight: 500; color: #111827; font-size: 14px;">${c.company_name || c.first_name + ' ' + c.last_name || c.email || 'Onbekend'}</div>
          </div>
        `).join('');
        dropdown.querySelectorAll('.customer-option').forEach(opt => {
          opt.addEventListener('click', () => {
            const customerId = opt.getAttribute('data-customer-id');
            const customerName = opt.getAttribute('data-customer-name');
            this.popover.querySelector('#timeTrackerSwitchCustomerId').value = customerId;
            this.popover.querySelector('#timeTrackerSwitchCustomerSearch').value = customerName;
            this.popover.querySelector('#timeTrackerSwitchCustomerDropdown').style.display = 'none';
            this.updateSwitchCustomerClearButton();
            const taskTitle = this.popover.querySelector('#timeTrackerSwitchTaskSearch').value;
            const noteEl = this.popover.querySelector('#timeTrackerSwitchNote');
            if (noteEl && taskTitle && customerName) noteEl.value = `Taak: ${taskTitle} voor: ${customerName}`;
            this.loadContactsForCustomerSwitch(customerId);
          });
        });
      }
      dropdown.style.display = 'block';
    }

    async loadContactsForCustomerSwitch(customerId, selectedContactId = null) {
      try {
        const response = await fetch(`/admin/api/customers/${customerId}/contacts`, { credentials: 'include' });
        const result = await response.json();
        this.contacts = result.success && result.contacts ? result.contacts : (result.ok && result.data ? result.data : []);
        const contactContainer = this.popover.querySelector('#timeTrackerSwitchContactContainer');
        if (this.contacts.length > 0) {
          contactContainer.style.display = 'block';
          if (selectedContactId) {
            const contact = this.contacts.find(c => c.id === selectedContactId);
            if (contact) {
              const name = (contact.first_name || '') + ' ' + (contact.last_name || '') || contact.email || '';
              this.popover.querySelector('#timeTrackerSwitchContactId').value = contact.id;
              this.popover.querySelector('#timeTrackerSwitchContactSearch').value = name;
            }
          }
        } else {
          contactContainer.style.display = 'none';
        }
      } catch (e) {
        this.popover.querySelector('#timeTrackerSwitchContactContainer').style.display = 'none';
      }
    }

    handleSwitchContactSearch(query) {
      const dropdown = this.popover.querySelector('#timeTrackerSwitchContactDropdown');
      if (!query || query.length < 1) { dropdown.style.display = 'none'; return; }
      const filtered = this.contacts.filter(c => (c.first_name?.toLowerCase().includes(query.toLowerCase())) || (c.last_name?.toLowerCase().includes(query.toLowerCase())) || (c.email?.toLowerCase().includes(query.toLowerCase())));
      if (filtered.length === 0) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280; text-align: center;">Geen contacten gevonden</div>';
      } else {
        dropdown.innerHTML = filtered.map(c => {
          const name = (c.first_name || '') + ' ' + (c.last_name || '') || c.email || 'Onbekend';
          return `<div class="contact-option" style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'" data-contact-id="${c.id}" data-contact-name="${name}"><div style="font-weight: 500; font-size: 14px;">${name}</div></div>`;
        }).join('');
        dropdown.querySelectorAll('.contact-option').forEach(opt => {
          opt.addEventListener('click', () => {
            this.popover.querySelector('#timeTrackerSwitchContactId').value = opt.getAttribute('data-contact-id');
            this.popover.querySelector('#timeTrackerSwitchContactSearch').value = opt.getAttribute('data-contact-name');
            this.popover.querySelector('#timeTrackerSwitchContactDropdown').style.display = 'none';
          });
        });
      }
      dropdown.style.display = 'block';
    }

    clearSwitchTaskSelection() {
      this.popover.querySelector('#timeTrackerSwitchTaskId').value = '';
      this.popover.querySelector('#timeTrackerSwitchTaskSearch').value = '';
      this.updateSwitchTaskClearButton();
      const customerContainer = this.popover.querySelector('#timeTrackerSwitchCustomerContainer');
      if (customerContainer && customerContainer.style.display !== 'none') {
        this.popover.querySelector('#timeTrackerSwitchCustomerId').value = '';
        this.popover.querySelector('#timeTrackerSwitchCustomerSearch').value = '';
        this.updateSwitchCustomerClearButton();
      }
    }

    clearSwitchCustomerSelection() {
      this.popover.querySelector('#timeTrackerSwitchCustomerId').value = '';
      this.popover.querySelector('#timeTrackerSwitchCustomerSearch').value = '';
      this.updateSwitchCustomerClearButton();
    }

    updateSwitchTaskClearButton() {
      const clearBtn = this.popover.querySelector('#timeTrackerSwitchTaskClear');
      const taskId = this.popover.querySelector('#timeTrackerSwitchTaskId');
      if (clearBtn && taskId) clearBtn.style.display = (taskId.value && taskId.value.length > 0) ? 'block' : 'none';
    }

    updateSwitchCustomerClearButton() {
      const clearBtn = this.popover.querySelector('#timeTrackerSwitchCustomerClear');
      const customerId = this.popover.querySelector('#timeTrackerSwitchCustomerId');
      if (clearBtn && customerId) clearBtn.style.display = (customerId.value && customerId.value.length > 0) ? 'block' : 'none';
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
        this.clockButton.style.color = '#10b981'; // Green when running
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

        // Sync switch activity dropdown and show task/customer when Klantenwerk or Support
        const switchActivitySelect = this.popover.querySelector('#timeTrackerSwitchActivity');
        if (switchActivitySelect) {
          const pn = (this.currentEntry.project_name || '').toLowerCase();
          const match = ACTIVITY_TYPES.find(a => a.value === pn);
          if (match) switchActivitySelect.value = match.value;
          this.handleSwitchActivityChange();
        }

        // Update elapsed time
        this.updateElapsedTime();
      } else {
        // Idle state
        this.clockButton.style.color = '#bdbec9';
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
      
      // Initialize activity fields if klantenwerk is selected (default)
      const activitySelect = this.popover.querySelector('#timeTrackerActivity');
      if (activitySelect && activitySelect.value === 'klantenwerk') {
        this.handleActivityChange();
      }
      
      // Update clear button visibility
      this.updateTaskClearButton();
      this.updateCustomerClearButton();
    }

    closePopover() {
      this.isOpen = false;
      this.popover.style.display = 'none';
      // Close all dropdowns
      this.popover.querySelectorAll('[id$="Dropdown"]').forEach(dropdown => {
        dropdown.style.display = 'none';
      });
    }

    async handleStart() {
      const activity = this.popover.querySelector('#timeTrackerActivity').value;
      const note = this.popover.querySelector('#timeTrackerNote').value.trim();
      const taskId = this.popover.querySelector('#timeTrackerTaskId').value;
      const customerId = this.popover.querySelector('#timeTrackerCustomerId').value;
      const contactId = this.popover.querySelector('#timeTrackerContactId').value;

      if (!note) {
        if (typeof window.showNotification === 'function') {
          window.showNotification('Titel is verplicht', 'error');
        }
        return;
      }
      if (activity === 'klantenwerk' || activity === 'support') {
        if (!customerId || customerId.length === 0) {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Kies een klant bij Klantenwerk of Support', 'error');
          }
          return;
        }
      }

      try {
        const body = {
          project_name: activity === 'klantenwerk' ? 'Klantenwerk' : activity,
          note: note
        };

        if (taskId) body.task_id = taskId;
        if (customerId) body.customer_id = customerId;
        if (contactId) body.contact_id = contactId;

        const response = await fetch(`/api/employees/${this.userId}/time-entries/clock-in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body)
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
      const taskId = this.popover.querySelector('#timeTrackerSwitchTaskId').value;
      const customerId = this.popover.querySelector('#timeTrackerSwitchCustomerId').value;
      const contactId = this.popover.querySelector('#timeTrackerSwitchContactId').value;

      if (!note) {
        if (typeof window.showNotification === 'function') {
          window.showNotification('Titel is verplicht', 'error');
        }
        return;
      }

      if (activity === 'klantenwerk' || activity === 'support') {
        if (!customerId || customerId.length === 0) {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Kies een klant bij Klantenwerk of Support', 'error');
          }
          return;
        }
      }

      try {
        const body = {
          project_name: activity === 'klantenwerk' ? 'Klantenwerk' : (activity === 'support' ? 'Support' : activity),
          note: note || null
        };
        if (taskId) body.task_id = taskId;
        if (customerId) body.customer_id = customerId;
        if (contactId) body.contact_id = contactId;

        const response = await fetch(`/api/employees/${this.userId}/time-entries/switch-task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body)
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

    updateTaskClearButton() {
      const taskSearch = this.popover.querySelector('#timeTrackerTaskSearch');
      const taskId = this.popover.querySelector('#timeTrackerTaskId');
      const clearBtn = this.popover.querySelector('#timeTrackerTaskClear');
      
      if (clearBtn && taskSearch && taskId) {
        const hasValue = taskId.value && taskId.value.length > 0;
        clearBtn.style.display = hasValue ? 'block' : 'none';
      }
    }

    updateCustomerClearButton() {
      const customerSearch = this.popover.querySelector('#timeTrackerCustomerSearch');
      const customerId = this.popover.querySelector('#timeTrackerCustomerId');
      const clearBtn = this.popover.querySelector('#timeTrackerCustomerClear');
      
      if (clearBtn && customerSearch && customerId) {
        const hasValue = customerId.value && customerId.value.length > 0;
        clearBtn.style.display = hasValue ? 'block' : 'none';
      }
    }

    clearTaskSelection() {
      this.popover.querySelector('#timeTrackerTaskId').value = '';
      this.popover.querySelector('#timeTrackerTaskSearch').value = '';
      this.updateTaskClearButton();
      
      // Also clear customer if it was auto-filled from task
      const customerId = this.popover.querySelector('#timeTrackerCustomerId').value;
      if (customerId) {
        // Only clear if customer container is visible (meaning it was shown for klantenwerk)
        const customerContainer = this.popover.querySelector('#timeTrackerCustomerContainer');
        if (customerContainer && customerContainer.style.display !== 'none') {
          // Keep container visible but clear the value
          this.popover.querySelector('#timeTrackerCustomerId').value = '';
          this.popover.querySelector('#timeTrackerCustomerSearch').value = '';
          this.updateCustomerClearButton();
        }
      }
      
      // Clear title if it starts with "Taak:"
      const noteInput = this.popover.querySelector('#timeTrackerNote');
      if (noteInput && noteInput.value.startsWith('Taak:')) {
        noteInput.value = '';
      }
    }

    clearCustomerSelection() {
      this.popover.querySelector('#timeTrackerCustomerId').value = '';
      this.popover.querySelector('#timeTrackerCustomerSearch').value = '';
      this.updateCustomerClearButton();
      
      // Update title if it contains customer name
      const noteInput = this.popover.querySelector('#timeTrackerNote');
      if (noteInput && noteInput.value.includes(' voor: ')) {
        const taskId = this.popover.querySelector('#timeTrackerTaskId').value;
        const taskTitle = this.popover.querySelector('#timeTrackerTaskSearch').value;
        if (taskId && taskTitle) {
          noteInput.value = `Taak: ${taskTitle}`;
        } else {
          noteInput.value = '';
        }
      }
    }

    showAddTaskModal(prefilledTitle = '') {
      // Remove existing modal if present
      const existingModal = document.getElementById('timeTrackerAddTaskModal');
      if (existingModal) {
        existingModal.remove();
      }

      // Create modal overlay
      const modal = document.createElement('div');
      modal.id = 'timeTrackerAddTaskModal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      `;

      modal.innerHTML = `
        <div style="background: white; border-radius: 8px; width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);">
          <div style="padding: 20px; border-bottom: 1px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">Nieuwe taak toevoegen</h3>
              <button id="timeTrackerAddTaskModalClose" style="background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Sluiten">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          
          <form id="timeTrackerAddTaskForm" style="padding: 20px;">
            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Titel <span style="color: #ef4444;">*</span>
              </label>
              <input 
                type="text" 
                id="timeTrackerAddTaskTitle" 
                required 
                value="${prefilledTitle}"
                placeholder="Bijv. Bugfix login pagina" 
                style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;"
              />
            </div>

            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Beschrijving
              </label>
              <textarea 
                id="timeTrackerAddTaskDescription" 
                rows="3"
                placeholder="Optionele beschrijving van de taak..." 
                style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; resize: vertical; font-family: inherit;"
              ></textarea>
            </div>

            <div style="margin-bottom: 16px; position: relative;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Klant <span style="color: #ef4444;">*</span>
              </label>
              <input 
                type="text" 
                id="timeTrackerAddTaskCustomerSearch" 
                placeholder="Zoek klant..." 
                autocomplete="off"
                style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;"
              />
              <div id="timeTrackerAddTaskCustomerDropdown" style="display: none; position: absolute; width: 100%; max-width: 460px; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 2001;"></div>
              <input type="hidden" id="timeTrackerAddTaskCustomerId" />
            </div>

            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Prioriteit
              </label>
              <select 
                id="timeTrackerAddTaskPriority" 
                style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; background: white;"
              >
                <option value="low">Laag</option>
                <option value="medium" selected>Normaal</option>
                <option value="high">Hoog</option>
              </select>
            </div>

            <div id="timeTrackerAddTaskError" style="display: none; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #991b1b; font-size: 14px; margin-bottom: 16px;"></div>

            <div style="display: flex; gap: 8px; justify-content: flex-end;">
              <button 
                type="button" 
                id="timeTrackerAddTaskCancel" 
                style="padding: 10px 20px; background: #f3f4f6; color: #374151; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s;"
                onmouseover="this.style.background='#e5e7eb'"
                onmouseout="this.style.background='#f3f4f6'"
              >
                Annuleren
              </button>
              <button 
                type="submit" 
                id="timeTrackerAddTaskSubmit" 
                style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s;"
                onmouseover="this.style.background='#2563eb'"
                onmouseout="this.style.background='#3b82f6'"
              >
                Taak aanmaken
              </button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(modal);

      // Setup event listeners
      const closeBtn = modal.querySelector('#timeTrackerAddTaskModalClose');
      const cancelBtn = modal.querySelector('#timeTrackerAddTaskCancel');
      const form = modal.querySelector('#timeTrackerAddTaskForm');
      const customerSearch = modal.querySelector('#timeTrackerAddTaskCustomerSearch');
      const customerDropdown = modal.querySelector('#timeTrackerAddTaskCustomerDropdown');

      const closeModal = () => {
        modal.remove();
      };

      closeBtn.addEventListener('click', closeModal);
      cancelBtn.addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });

      // Customer search
      customerSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length < 1) {
          customerDropdown.style.display = 'none';
          return;
        }

        const filtered = this.customers.filter(customer => 
          (customer.company_name?.toLowerCase().includes(query.toLowerCase())) ||
          (customer.first_name?.toLowerCase().includes(query.toLowerCase())) ||
          (customer.last_name?.toLowerCase().includes(query.toLowerCase())) ||
          (customer.email?.toLowerCase().includes(query.toLowerCase()))
        );

        if (filtered.length === 0) {
          customerDropdown.innerHTML = '<div style="padding: 12px; color: #6b7280; text-align: center;">Geen klanten gevonden</div>';
        } else {
          customerDropdown.innerHTML = filtered.map(customer => `
            <div 
              class="customer-option" 
              style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.2s;"
              onmouseover="this.style.background='#f9fafb'"
              onmouseout="this.style.background='white'"
              data-customer-id="${customer.id}"
              data-customer-name="${customer.company_name || customer.first_name + ' ' + customer.last_name || customer.email || ''}"
            >
              <div style="font-weight: 500; color: #111827; font-size: 14px;">${customer.company_name || customer.first_name + ' ' + customer.last_name || customer.email || 'Onbekend'}</div>
            </div>
          `).join('');

          customerDropdown.querySelectorAll('.customer-option').forEach(option => {
            option.addEventListener('click', () => {
              const customerId = option.getAttribute('data-customer-id');
              const customerName = option.getAttribute('data-customer-name');

              modal.querySelector('#timeTrackerAddTaskCustomerId').value = customerId;
              customerSearch.value = customerName;
              customerDropdown.style.display = 'none';
            });
          });
        }

        customerDropdown.style.display = 'block';
      });

      // Load customers if not already loaded
      if (this.customers.length === 0) {
        this.loadCustomers();
      }

      // Form submission
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = modal.querySelector('#timeTrackerAddTaskTitle').value.trim();
        const description = modal.querySelector('#timeTrackerAddTaskDescription').value.trim();
        const customerId = modal.querySelector('#timeTrackerAddTaskCustomerId').value;
        const priority = modal.querySelector('#timeTrackerAddTaskPriority').value;
        const errorEl = modal.querySelector('#timeTrackerAddTaskError');
        const submitBtn = modal.querySelector('#timeTrackerAddTaskSubmit');

        if (!title) {
          errorEl.textContent = 'Titel is verplicht';
          errorEl.style.display = 'block';
          return;
        }

        if (!customerId) {
          errorEl.textContent = 'Selecteer een klant';
          errorEl.style.display = 'block';
          return;
        }

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Aanmaken...';
        errorEl.style.display = 'none';

        try {
          const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              employee_id: this.userId,
              customer_id: customerId,
              title: title,
              description: description || null,
              priority: priority
            })
          });

          const result = await response.json();

          if (!response.ok || !result.ok) {
            throw new Error(result.error || 'Fout bij aanmaken taak');
          }

          // Success - reload tasks and select the new task
          await this.loadTasks();
          
          // Find the new task and select it
          const newTask = this.tasks.find(t => t.id === result.data.id);
          if (newTask) {
            const taskSearch = this.popover.querySelector('#timeTrackerTaskSearch');
            const taskIdInput = this.popover.querySelector('#timeTrackerTaskId');
            
            if (taskSearch) {
              taskSearch.value = newTask.title;
            }
            if (taskIdInput) {
              taskIdInput.value = newTask.id;
            }

            // Auto-populate customer if task has one
            if (newTask.customer_id) {
              const customer = this.customers.find(c => c.id === newTask.customer_id);
              if (customer) {
                this.popover.querySelector('#timeTrackerCustomerId').value = customer.id;
                this.popover.querySelector('#timeTrackerCustomerSearch').value = customer.company_name || customer.first_name + ' ' + customer.last_name || customer.email || '';
                this.popover.querySelector('#timeTrackerCustomerContainer').style.display = 'block';
              }
            }
          }

          // Close modal and dropdown
          closeModal();
          this.popover.querySelector('#timeTrackerTaskDropdown').style.display = 'none';

          if (typeof window.showNotification === 'function') {
            window.showNotification('Taak succesvol aangemaakt', 'success');
          }
        } catch (error) {
          console.error('[TimeTracker] Error creating task:', error);
          errorEl.textContent = error.message || 'Er is een fout opgetreden bij het aanmaken van de taak';
          errorEl.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Taak aanmaken';
        }
      });

      // Focus on title input
      setTimeout(() => {
        modal.querySelector('#timeTrackerAddTaskTitle').focus();
      }, 100);
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
