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

  // Sales activity type (for "Waar werk je aan?" = Sales)
  const SALES_ACTIVITY_TYPES = [
    { value: '', label: '—' },
    { value: 'call', label: 'Telefoongesprek' },
    { value: 'meeting', label: 'Meeting / Demo' },
    { value: 'outreach', label: 'Outreach (DM/mail/LinkedIn)' },
    { value: 'offerte', label: 'Offerte / Proposal' },
    { value: 'research', label: 'Research / Voorbereiding' },
    { value: 'admin', label: 'Admin / Intern' }
  ];

  // Overleg: soort overleg
  const OVERLEG_MEETING_TYPES = [
    { value: 'intern', label: 'Intern (team)' },
    { value: 'klant', label: 'Klant' },
    { value: 'partner', label: 'Partner' },
    { value: '1op1', label: '1:1' },
    { value: 'overig', label: 'Overig' }
  ];

  // Operations: categorie + impact
  const OPERATIONS_CATEGORIES = [
    { value: 'algemeen', label: 'Algemeen' },
    { value: 'processen', label: 'Processen & SOP' },
    { value: 'automations', label: 'Automations / Integraties' },
    { value: 'data', label: 'Data / Reporting' },
    { value: 'platform', label: 'Platform / Bugs / QA' },
    { value: 'planning', label: 'Planning / Team / HR' },
    { value: 'finance', label: 'Finance / Admin' },
    { value: 'onboarding', label: 'Onboarding / Training' }
  ];
  const OPERATIONS_IMPACT = [
    { value: '', label: '—' },
    { value: 'bespaart_tijd', label: 'Bespaart tijd' },
    { value: 'verhoogt_omzet', label: 'Verhoogt omzet' },
    { value: 'vermindert_fouten', label: 'Vermindert fouten' },
    { value: 'compliance', label: 'Compliance' }
  ];

  function avatarHtml(url, name, size) {
    size = size || 24;
    const initials = !name ? '?' : name.trim().split(/\s+/).length >= 2
      ? (name.trim().split(/\s+/)[0][0] + name.trim().split(/\s+/).pop()[0]).toUpperCase().slice(0, 2)
      : name.trim().slice(0, 2).toUpperCase();
    if (url) {
      return '<img src="' + url.replace(/"/g, '&quot;') + '" alt="" width="' + size + '" height="' + size + '" style="border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
        '<span style="display:none;width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:#e5e7eb;color:#6b7280;font-size:11px;font-weight:600;align-items:center;justify-content:center;">' + initials + '</span>';
    }
    return '<span style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:#e5e7eb;color:#6b7280;font-size:11px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;">' + initials + '</span>';
  }

  class TimeTracker {
    constructor(userId) {
      this.userId = userId;
      this.currentEntry = null;
      this.timerInterval = null;
      this.isOpen = false;
      this.tasks = [];
      this.customers = [];
      this.contacts = [];
      this.taskSearchDebounceTimer = null;
      this.ticketSearchDebounceTimer = null;
      this.ticketTasks = [];
      this.switchTicketTasks = [];
      this.switchTicketSearchDebounce = null;
      this.klantContactSearchDebounce = null;
      this.klantContactCustomerTitle = '';
      this.klantContactContactTitle = '';
      this.switchKlantContactSearchDebounce = null;
      this.switchKlantContactCustomerTitle = '';
      this.switchKlantContactContactTitle = '';
      this.overlegParticipants = [];
      this.overlegParticipantsSearchDebounce = null;
      this.switchOverlegParticipants = [];
      this.switchOverlegParticipantsSearchDebounce = null;
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
                  placeholder="Maak of zoek een taak..." 
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

            <!-- Klantenwerk: Koppel aan (klant + contact, zelfde UX als Sales) -->
            <div id="timeTrackerKlantContactContainer" style="display: none; margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Koppel aan <span style="color: #6b7280; font-weight: 400;">(klant en/of contactpersoon)</span>
              </label>
              <div style="position: relative;">
                <input type="text" id="timeTrackerKlantContactSearch" placeholder="Zoek klant of contact..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                <button type="button" id="timeTrackerKlantContactClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis selectie">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div id="timeTrackerKlantContactDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 220px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <div id="timeTrackerKlantContactChips" style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;"></div>
              <input type="hidden" id="timeTrackerCustomerId" />
              <input type="hidden" id="timeTrackerContactId" />
              <input type="hidden" id="timeTrackerContactCustomerId" value="" />
            </div>

            <!-- Support: ticket + tasks (only when "Support" selected) -->
            <div id="timeTrackerSupportContainer" style="display: none; margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Ticket <span style="color: #ef4444;">*</span>
              </label>
              <div style="position: relative;">
                <input type="text" id="timeTrackerTicketSearch" placeholder="Zoek ticket..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                <button type="button" id="timeTrackerTicketClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis ticket">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div id="timeTrackerTicketDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <input type="hidden" id="timeTrackerTicketId" />
              <div id="timeTrackerTicketTasksWrap" style="display: none; margin-top: 10px;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 6px;">Taak binnen ticket (optioneel)</label>
                <div id="timeTrackerTicketTasksList" style="max-height: 180px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; background: #fafafa;"></div>
                <div style="margin-top: 8px;">
                  <button type="button" id="timeTrackerTicketTaskNewBtn" style="padding: 6px 10px; font-size: 13px; color: #3b82f6; background: none; border: 1px dashed #93c5fd; border-radius: 6px; cursor: pointer;">+ Nieuwe taak toevoegen</button>
                  <div id="timeTrackerTicketTaskNewForm" style="display: none; margin-top: 10px; padding: 10px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <input type="text" id="timeTrackerTicketTaskNewTitle" placeholder="Titel *" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; margin-bottom: 8px;">
                    <input type="text" id="timeTrackerTicketTaskNewDesc" placeholder="Beschrijving (optioneel)" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; margin-bottom: 8px;">
                    <div style="display: flex; gap: 8px;">
                      <button type="button" id="timeTrackerTicketTaskNewSave" style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">Opslaan</button>
                      <button type="button" id="timeTrackerTicketTaskNewCancel" style="padding: 6px 12px; background: #e5e7eb; color: #374151; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">Annuleren</button>
                    </div>
                  </div>
                </div>
              </div>
              <input type="hidden" id="timeTrackerTicketTaskId" />
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Titel <span style="color: #ef4444;">*</span>
              </label>
              <input type="text" id="timeTrackerNote" required placeholder="Bijv. Bugfix login pagina" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
            </div>

            <!-- Overleg: soort overleg, deelnemers, Koppel aan (alleen bij Overleg) -->
            <div id="timeTrackerOverlegContainer" style="display: none; margin-bottom: 12px;">
              <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Soort overleg</label>
                <select id="timeTrackerMeetingType" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                  ${OVERLEG_MEETING_TYPES.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                </select>
              </div>
              <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Deelnemers (optioneel)</label>
                <div style="position: relative;">
                  <input type="text" id="timeTrackerParticipantsSearch" placeholder="Zoek collega..." autocomplete="off" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                  <div id="timeTrackerParticipantsDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 1001;"></div>
                </div>
                <div id="timeTrackerParticipantsChips" style="margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px;"></div>
              </div>
              <div style="margin-bottom: 0;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Koppel aan (optioneel)</label>
                <div style="position: relative;">
                  <input type="text" id="timeTrackerOverlegContextSearch" placeholder="Zoek deal, kans, klant..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                  <button type="button" id="timeTrackerOverlegContextClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis koppeling">×</button>
                </div>
                <div id="timeTrackerOverlegContextDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 220px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 1001;"></div>
                <input type="hidden" id="timeTrackerOverlegContextType" />
                <input type="hidden" id="timeTrackerOverlegContextId" />
              </div>
            </div>

            <!-- Operations: categorie, area, Koppel aan, impact (alleen bij Operations) -->
            <div id="timeTrackerOperationsContainer" style="display: none; margin-bottom: 12px;">
              <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Operations categorie</label>
                <select id="timeTrackerOpsCategory" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                  ${OPERATIONS_CATEGORIES.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                </select>
              </div>
              <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Area / Project (optioneel)</label>
                <input type="text" id="timeTrackerOpsArea" placeholder="Bijv. Platform, GrowSocial, CRM" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
              </div>
              <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Koppel aan (optioneel)</label>
                <div style="position: relative;">
                  <input type="text" id="timeTrackerOperationsContextSearch" placeholder="Zoek deal, kans, klant, taak..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                  <button type="button" id="timeTrackerOperationsContextClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis koppeling">×</button>
                </div>
                <div id="timeTrackerOperationsContextDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 220px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 1001;"></div>
                <input type="hidden" id="timeTrackerOperationsContextType" />
                <input type="hidden" id="timeTrackerOperationsContextId" />
              </div>
              <div style="margin-bottom: 0;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Impact (optioneel)</label>
                <select id="timeTrackerOpsImpact" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                  ${OPERATIONS_IMPACT.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- Sales: activiteit type (verplicht) + Koppel aan (altijd zichtbaar bij Sales) -->
            <div id="timeTrackerSalesOptions" style="display: none; margin-bottom: 12px;">
              <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Activiteit type <span style="color: #ef4444;">*</span></label>
                <select id="timeTrackerActivityType" required style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                  ${SALES_ACTIVITY_TYPES.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
                </select>
              </div>
              <div style="margin-bottom: 0;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Koppel aan (optioneel)</label>
                <div style="position: relative;">
                  <input type="text" id="timeTrackerContextSearch" placeholder="Zoek deal, kans, klant..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                  <button type="button" id="timeTrackerContextClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis koppeling">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
                <div id="timeTrackerContextDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 220px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
                <input type="hidden" id="timeTrackerContextType" />
                <input type="hidden" id="timeTrackerContextId" />
              </div>
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

            <!-- Task (switch) - shown when Klantenwerk -->
            <div id="timeTrackerSwitchTaskContainer" style="margin-bottom: 12px; display: none;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">Taak</label>
              <div style="position: relative;">
                <input type="text" id="timeTrackerSwitchTaskSearch" placeholder="Maak of zoek een taak..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;" />
                <button type="button" id="timeTrackerSwitchTaskClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis taak">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div id="timeTrackerSwitchTaskDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <input type="hidden" id="timeTrackerSwitchTaskId" />
            </div>

            <!-- Support (switch) - ticket + task when Support -->
            <div id="timeTrackerSwitchSupportContainer" style="display: none; margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">Ticket <span style="color: #ef4444;">*</span></label>
              <div style="position: relative;">
                <input type="text" id="timeTrackerSwitchTicketSearch" placeholder="Zoek ticket..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                <button type="button" id="timeTrackerSwitchTicketClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis ticket">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div id="timeTrackerSwitchTicketDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 200px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <input type="hidden" id="timeTrackerSwitchTicketId" />
              <div id="timeTrackerSwitchTicketTasksWrap" style="display: none; margin-top: 8px;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Taak (optioneel)</label>
                <div id="timeTrackerSwitchTicketTasksList" style="max-height: 120px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; background: #fafafa;"></div>
              </div>
              <input type="hidden" id="timeTrackerSwitchTicketTaskId" />
            </div>

            <!-- Klantenwerk (switch): Koppel aan klant + contact -->
            <div id="timeTrackerSwitchKlantContactContainer" style="display: none; margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">Koppel aan <span style="color: #6b7280; font-weight: 400;">(klant en/of contactpersoon)</span></label>
              <div style="position: relative;">
                <input type="text" id="timeTrackerSwitchKlantContactSearch" placeholder="Zoek klant of contact..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                <button type="button" id="timeTrackerSwitchKlantContactClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis selectie">×</button>
              </div>
              <div id="timeTrackerSwitchKlantContactDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 220px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <div id="timeTrackerSwitchKlantContactChips" style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;"></div>
              <input type="hidden" id="timeTrackerSwitchCustomerId" />
              <input type="hidden" id="timeTrackerSwitchContactId" />
              <input type="hidden" id="timeTrackerSwitchContactCustomerId" value="" />
            </div>

            <!-- Overleg (switch) -->
            <div id="timeTrackerSwitchOverlegContainer" style="display: none; margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Soort overleg</label>
              <select id="timeTrackerSwitchMeetingType" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white; margin-bottom: 8px;">
                ${OVERLEG_MEETING_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
              </select>
              <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Deelnemers (optioneel)</label>
              <div style="position: relative; margin-bottom: 6px;">
                <input type="text" id="timeTrackerSwitchParticipantsSearch" placeholder="Zoek collega..." autocomplete="off" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                <div id="timeTrackerSwitchParticipantsDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 180px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              </div>
              <div id="timeTrackerSwitchParticipantsChips" style="margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 6px;"></div>
              <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Koppel aan (optioneel)</label>
              <div style="position: relative;">
                <input type="text" id="timeTrackerSwitchOverlegContextSearch" placeholder="Zoek deal, kans, klant..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                <button type="button" id="timeTrackerSwitchOverlegContextClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis koppeling">×</button>
              </div>
              <div id="timeTrackerSwitchOverlegContextDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 220px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <input type="hidden" id="timeTrackerSwitchOverlegContextType" />
              <input type="hidden" id="timeTrackerSwitchOverlegContextId" />
            </div>

            <!-- Operations (switch) -->
            <div id="timeTrackerSwitchOperationsContainer" style="display: none; margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 4px;">Operations categorie</label>
              <select id="timeTrackerSwitchOpsCategory" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white; margin-bottom: 8px;">
                ${OPERATIONS_CATEGORIES.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
              </select>
              <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Area / Project (optioneel)</label>
              <input type="text" id="timeTrackerSwitchOpsArea" placeholder="Bijv. Platform, GrowSocial" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; margin-bottom: 8px;">
              <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Koppel aan (optioneel)</label>
              <div style="position: relative;">
                <input type="text" id="timeTrackerSwitchOperationsContextSearch" placeholder="Zoek deal, kans, klant..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                <button type="button" id="timeTrackerSwitchOperationsContextClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis koppeling">×</button>
              </div>
              <div id="timeTrackerSwitchOperationsContextDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 220px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <input type="hidden" id="timeTrackerSwitchOperationsContextType" />
              <input type="hidden" id="timeTrackerSwitchOperationsContextId" />
              <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-top: 8px; margin-bottom: 4px;">Impact (optioneel)</label>
              <select id="timeTrackerSwitchOpsImpact" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                ${OPERATIONS_IMPACT.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
              </select>
            </div>

            <div style="margin-bottom: 12px;">
              <label style="display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                Titel <span style="color: #ef4444;">*</span>
              </label>
              <input type="text" id="timeTrackerSwitchNote" required placeholder="Bijv. Bugfix login pagina" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
            </div>

            <div id="timeTrackerSalesNudge" style="display: none; margin-bottom: 12px; padding: 10px 12px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 6px; font-size: 13px;">
              <div style="margin-bottom: 8px;">Wil je dit nog koppelen aan een deal of kans?</div>
              <div style="display: flex; gap: 8px;">
                <button type="button" id="timeTrackerSalesNudgeLink" style="padding: 6px 12px; background: #f59e0b; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">Nu koppelen</button>
                <button type="button" id="timeTrackerSalesNudgeSkip" style="padding: 6px 12px; background: #e5e7eb; color: #374151; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">Overslaan</button>
              </div>
            </div>
            <div id="timeTrackerRunningContextWrap" style="display: none; margin-bottom: 12px;">
              <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 4px;">Koppel aan</label>
              <div style="position: relative;">
                <input type="text" id="timeTrackerRunningContextSearch" placeholder="Zoek deal, kans, klant..." autocomplete="off" style="width: 100%; padding: 8px 32px 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;">
                <button type="button" id="timeTrackerRunningContextClear" style="display: none; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280;" aria-label="Wis koppeling">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div id="timeTrackerRunningContextDropdown" style="display: none; position: absolute; width: 100%; max-width: 328px; max-height: 220px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 4px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); z-index: 1001;"></div>
              <input type="hidden" id="timeTrackerRunningContextType" />
              <input type="hidden" id="timeTrackerRunningContextId" />
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" id="timeTrackerUpdateDetails" style="padding: 10px 14px; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s;">
                Wijzig details
              </button>
              <button type="button" id="timeTrackerSwitch" style="flex: 1; min-width: 100px; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s;">
                Wissel taak
              </button>
              <button type="button" id="timeTrackerStop" style="flex: 1; min-width: 100px; padding: 10px; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: background 0.2s;">
                Uitklokken
              </button>
            </div>
            <div id="timeTrackerClockOutError" style="display: none; margin-top: 8px; padding: 8px 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #991b1b; font-size: 13px;"></div>
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

      // Klantenwerk: Koppel aan (klant + contact) search
      const klantContactSearch = this.popover.querySelector('#timeTrackerKlantContactSearch');
      const klantContactClear = this.popover.querySelector('#timeTrackerKlantContactClear');
      const klantContactDropdown = this.popover.querySelector('#timeTrackerKlantContactDropdown');
      if (klantContactSearch) {
        klantContactSearch.addEventListener('input', (e) => this.handleKlantContactSearch(e.target.value));
        klantContactSearch.addEventListener('focus', () => { if (klantContactSearch.value.trim().length >= 2) this.handleKlantContactSearch(klantContactSearch.value.trim()); });
        klantContactSearch.addEventListener('blur', () => setTimeout(() => { if (klantContactDropdown) klantContactDropdown.style.display = 'none'; }, 200));
      }
      if (klantContactClear) {
        klantContactClear.addEventListener('click', () => this.clearKlantContactSelection());
      }

      // Sales: Context search (form)
      const contextSearch = this.popover.querySelector('#timeTrackerContextSearch');
      const contextClear = this.popover.querySelector('#timeTrackerContextClear');
      const contextDropdown = this.popover.querySelector('#timeTrackerContextDropdown');
      if (contextSearch) {
        contextSearch.addEventListener('input', (e) => this.handleContextSearch(e.target.value, 'form'));
        contextSearch.addEventListener('focus', () => { if (contextSearch.value.trim().length >= 2) this.handleContextSearch(contextSearch.value.trim(), 'form'); });
        contextSearch.addEventListener('blur', () => setTimeout(() => { if (contextDropdown) contextDropdown.style.display = 'none'; }, 200));
      }
      if (contextClear) {
        contextClear.addEventListener('click', () => this.clearContextSelection('form'));
      }

      // Sales: Running context search + nudge
      const runningContextSearch = this.popover.querySelector('#timeTrackerRunningContextSearch');
      const runningContextClear = this.popover.querySelector('#timeTrackerRunningContextClear');
      const runningContextDropdown = this.popover.querySelector('#timeTrackerRunningContextDropdown');
      if (runningContextSearch) {
        runningContextSearch.addEventListener('input', (e) => this.handleContextSearch(e.target.value, 'running'));
        runningContextSearch.addEventListener('focus', () => { if (runningContextSearch.value.trim().length >= 2) this.handleContextSearch(runningContextSearch.value.trim(), 'running'); });
        runningContextSearch.addEventListener('blur', () => setTimeout(() => { if (runningContextDropdown) runningContextDropdown.style.display = 'none'; }, 200));
      }
      if (runningContextClear) {
        runningContextClear.addEventListener('click', () => this.clearContextSelection('running'));
      }
      const nudgeLink = this.popover.querySelector('#timeTrackerSalesNudgeLink');
      const nudgeSkip = this.popover.querySelector('#timeTrackerSalesNudgeSkip');
      if (nudgeLink) nudgeLink.addEventListener('click', () => this.showSalesContextField());
      if (nudgeSkip) nudgeSkip.addEventListener('click', () => this.doClockOut());

      // Support: ticket search
      const ticketSearch = this.popover.querySelector('#timeTrackerTicketSearch');
      const ticketClear = this.popover.querySelector('#timeTrackerTicketClear');
      const ticketDropdown = this.popover.querySelector('#timeTrackerTicketDropdown');
      if (ticketSearch) {
        ticketSearch.addEventListener('input', (e) => this.handleTicketSearch(e.target.value));
        ticketSearch.addEventListener('focus', () => { if (ticketSearch.value.trim().length >= 2) this.handleTicketSearch(ticketSearch.value.trim()); });
        ticketSearch.addEventListener('blur', () => setTimeout(() => { if (ticketDropdown) ticketDropdown.style.display = 'none'; }, 200));
      }
      if (ticketClear) {
        ticketClear.addEventListener('click', () => this.clearTicketSelection());
      }

      // Overleg: deelnemers search
      const participantsSearch = this.popover.querySelector('#timeTrackerParticipantsSearch');
      const participantsDropdown = this.popover.querySelector('#timeTrackerParticipantsDropdown');
      if (participantsSearch) {
        participantsSearch.addEventListener('input', (e) => this.handleParticipantsSearch(e.target.value));
        participantsSearch.addEventListener('focus', () => { if (participantsSearch.value.trim().length >= 2) this.handleParticipantsSearch(participantsSearch.value.trim()); });
        participantsSearch.addEventListener('blur', () => setTimeout(() => { if (participantsDropdown) participantsDropdown.style.display = 'none'; }, 200));
      }
      // Overleg: Koppel aan context search
      const overlegContextSearch = this.popover.querySelector('#timeTrackerOverlegContextSearch');
      const overlegContextClear = this.popover.querySelector('#timeTrackerOverlegContextClear');
      const overlegContextDropdown = this.popover.querySelector('#timeTrackerOverlegContextDropdown');
      if (overlegContextSearch) {
        overlegContextSearch.addEventListener('input', (e) => this.handleContextSearch(e.target.value, 'overleg'));
        overlegContextSearch.addEventListener('focus', () => { if (overlegContextSearch.value.trim().length >= 2) this.handleContextSearch(overlegContextSearch.value.trim(), 'overleg'); });
        overlegContextSearch.addEventListener('blur', () => setTimeout(() => { if (overlegContextDropdown) overlegContextDropdown.style.display = 'none'; }, 200));
      }
      if (overlegContextClear) {
        overlegContextClear.addEventListener('click', () => this.clearContextSelection('overleg'));
      }

      // Operations: Koppel aan context search
      const operationsContextSearch = this.popover.querySelector('#timeTrackerOperationsContextSearch');
      const operationsContextClear = this.popover.querySelector('#timeTrackerOperationsContextClear');
      const operationsContextDropdown = this.popover.querySelector('#timeTrackerOperationsContextDropdown');
      if (operationsContextSearch) {
        operationsContextSearch.addEventListener('input', (e) => this.handleContextSearch(e.target.value, 'operations'));
        operationsContextSearch.addEventListener('focus', () => { if (operationsContextSearch.value.trim().length >= 2) this.handleContextSearch(operationsContextSearch.value.trim(), 'operations'); });
        operationsContextSearch.addEventListener('blur', () => setTimeout(() => { if (operationsContextDropdown) operationsContextDropdown.style.display = 'none'; }, 200));
      }
      if (operationsContextClear) {
        operationsContextClear.addEventListener('click', () => this.clearContextSelection('operations'));
      }

      // Support: new task form
      const ticketTaskNewBtn = this.popover.querySelector('#timeTrackerTicketTaskNewBtn');
      const ticketTaskNewForm = this.popover.querySelector('#timeTrackerTicketTaskNewForm');
      const ticketTaskNewSave = this.popover.querySelector('#timeTrackerTicketTaskNewSave');
      const ticketTaskNewCancel = this.popover.querySelector('#timeTrackerTicketTaskNewCancel');
      if (ticketTaskNewBtn) ticketTaskNewBtn.addEventListener('click', () => { ticketTaskNewForm.style.display = 'block'; this.popover.querySelector('#timeTrackerTicketTaskNewTitle').value = ''; this.popover.querySelector('#timeTrackerTicketTaskNewDesc').value = ''; });
      if (ticketTaskNewCancel) ticketTaskNewCancel.addEventListener('click', () => { ticketTaskNewForm.style.display = 'none'; });
      if (ticketTaskNewSave) ticketTaskNewSave.addEventListener('click', () => this.createTicketTaskAndSelect());

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

      // Switch Klant/Contact (Koppel aan, same as form)
      const switchKlantContactSearch = this.popover.querySelector('#timeTrackerSwitchKlantContactSearch');
      const switchKlantContactClear = this.popover.querySelector('#timeTrackerSwitchKlantContactClear');
      const switchKlantContactDropdown = this.popover.querySelector('#timeTrackerSwitchKlantContactDropdown');
      if (switchKlantContactSearch) {
        switchKlantContactSearch.addEventListener('input', (e) => this.handleSwitchKlantContactSearch(e.target.value));
        switchKlantContactSearch.addEventListener('focus', () => { if (switchKlantContactSearch.value.trim().length >= 2) this.handleSwitchKlantContactSearch(switchKlantContactSearch.value.trim()); });
        switchKlantContactSearch.addEventListener('blur', () => setTimeout(() => { if (switchKlantContactDropdown) switchKlantContactDropdown.style.display = 'none'; }, 200));
      }
      if (switchKlantContactClear) {
        switchKlantContactClear.addEventListener('click', () => this.clearSwitchKlantContactSelection());
      }
      // Switch ticket search (Support)
      const switchTicketSearch = this.popover.querySelector('#timeTrackerSwitchTicketSearch');
      const switchTicketClear = this.popover.querySelector('#timeTrackerSwitchTicketClear');
      const switchTicketDropdown = this.popover.querySelector('#timeTrackerSwitchTicketDropdown');
      if (switchTicketSearch) {
        switchTicketSearch.addEventListener('input', (e) => this.handleSwitchTicketSearch(e.target.value));
        switchTicketSearch.addEventListener('focus', () => { if (switchTicketSearch.value.trim().length >= 2) this.handleSwitchTicketSearch(switchTicketSearch.value.trim()); });
        switchTicketSearch.addEventListener('blur', () => setTimeout(() => { if (switchTicketDropdown) switchTicketDropdown.style.display = 'none'; }, 200));
      }
      if (switchTicketClear) {
        switchTicketClear.addEventListener('click', () => this.clearSwitchTicketSelection());
      }
      // Switch Overleg: deelnemers + context
      const switchParticipantsSearch = this.popover.querySelector('#timeTrackerSwitchParticipantsSearch');
      const switchParticipantsDropdown = this.popover.querySelector('#timeTrackerSwitchParticipantsDropdown');
      if (switchParticipantsSearch) {
        switchParticipantsSearch.addEventListener('input', (e) => this.handleSwitchParticipantsSearch(e.target.value));
        switchParticipantsSearch.addEventListener('focus', () => { if (switchParticipantsSearch.value.trim().length >= 2) this.handleSwitchParticipantsSearch(switchParticipantsSearch.value.trim()); });
        switchParticipantsSearch.addEventListener('blur', () => setTimeout(() => { if (switchParticipantsDropdown) switchParticipantsDropdown.style.display = 'none'; }, 200));
      }
      const switchOverlegContextSearch = this.popover.querySelector('#timeTrackerSwitchOverlegContextSearch');
      const switchOverlegContextClear = this.popover.querySelector('#timeTrackerSwitchOverlegContextClear');
      const switchOverlegContextDropdown = this.popover.querySelector('#timeTrackerSwitchOverlegContextDropdown');
      if (switchOverlegContextSearch) {
        switchOverlegContextSearch.addEventListener('input', (e) => this.handleContextSearch(e.target.value, 'switch_overleg'));
        switchOverlegContextSearch.addEventListener('focus', () => { if (switchOverlegContextSearch.value.trim().length >= 2) this.handleContextSearch(switchOverlegContextSearch.value.trim(), 'switch_overleg'); });
        switchOverlegContextSearch.addEventListener('blur', () => setTimeout(() => { if (switchOverlegContextDropdown) switchOverlegContextDropdown.style.display = 'none'; }, 200));
      }
      if (switchOverlegContextClear) {
        switchOverlegContextClear.addEventListener('click', () => this.clearContextSelection('switch_overleg'));
      }
      const switchOperationsContextSearch = this.popover.querySelector('#timeTrackerSwitchOperationsContextSearch');
      const switchOperationsContextClear = this.popover.querySelector('#timeTrackerSwitchOperationsContextClear');
      const switchOperationsContextDropdown = this.popover.querySelector('#timeTrackerSwitchOperationsContextDropdown');
      if (switchOperationsContextSearch) {
        switchOperationsContextSearch.addEventListener('input', (e) => this.handleContextSearch(e.target.value, 'switch_operations'));
        switchOperationsContextSearch.addEventListener('focus', () => { if (switchOperationsContextSearch.value.trim().length >= 2) this.handleContextSearch(switchOperationsContextSearch.value.trim(), 'switch_operations'); });
        switchOperationsContextSearch.addEventListener('blur', () => setTimeout(() => { if (switchOperationsContextDropdown) switchOperationsContextDropdown.style.display = 'none'; }, 200));
      }
      if (switchOperationsContextClear) {
        switchOperationsContextClear.addEventListener('click', () => this.clearContextSelection('switch_operations'));
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
        closeIfOutside('#timeTrackerSwitchTicketDropdown', '#timeTrackerSwitchSupportContainer');
        closeIfOutside('#timeTrackerKlantContactDropdown', '#timeTrackerKlantContactContainer');
        closeIfOutside('#timeTrackerSwitchKlantContactDropdown', '#timeTrackerSwitchKlantContactContainer');
        closeIfOutside('#timeTrackerSwitchParticipantsDropdown', '#timeTrackerSwitchOverlegContainer');
        closeIfOutside('#timeTrackerSwitchOverlegContextDropdown', '#timeTrackerSwitchOverlegContainer');
        closeIfOutside('#timeTrackerSwitchOperationsContextDropdown', '#timeTrackerSwitchOperationsContainer');
        closeIfOutside('#timeTrackerParticipantsDropdown', '#timeTrackerOverlegContainer');
        closeIfOutside('#timeTrackerOverlegContextDropdown', '#timeTrackerOverlegContainer');
        closeIfOutside('#timeTrackerOperationsContextDropdown', '#timeTrackerOperationsContainer');
      });

      // Start button
      const startBtn = this.popover.querySelector('#timeTrackerStart');
      if (startBtn) {
        startBtn.addEventListener('click', () => this.handleStart());
      }

      // Wijzig details button
      const updateDetailsBtn = this.popover.querySelector('#timeTrackerUpdateDetails');
      if (updateDetailsBtn) {
        updateDetailsBtn.addEventListener('click', () => this.handleUpdateDetails());
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
      const supportContainer = this.popover.querySelector('#timeTrackerSupportContainer');
      const salesOptions = this.popover.querySelector('#timeTrackerSalesOptions');
      const kc = this.popover.querySelector('#timeTrackerKlantContactContainer');

      if (activity === 'sales') {
        if (salesOptions) salesOptions.style.display = 'block';
        const noteElSales = this.popover.querySelector('#timeTrackerNote');
        if (noteElSales) noteElSales.placeholder = 'Bijv. Bugfix login pagina';
      } else {
        if (salesOptions) salesOptions.style.display = 'none';
      }

      const overleg = this.popover.querySelector('#timeTrackerOverlegContainer');
      const operationsContainer = this.popover.querySelector('#timeTrackerOperationsContainer');

      if (activity === 'support') {
        if (supportContainer) supportContainer.style.display = 'block';
        if (taskContainer) taskContainer.style.display = 'none';
        if (kc) kc.style.display = 'none';
        if (overleg) overleg.style.display = 'none';
        if (operationsContainer) operationsContainer.style.display = 'none';
        const noteElSup = this.popover.querySelector('#timeTrackerNote');
        if (noteElSup) noteElSup.placeholder = 'Bijv. Bugfix login pagina';
        this.clearTicketSelection();
      } else if (activity === 'overleg') {
        if (supportContainer) supportContainer.style.display = 'none';
        if (taskContainer) taskContainer.style.display = 'none';
        if (kc) kc.style.display = 'none';
        if (overleg) overleg.style.display = 'block';
        if (operationsContainer) operationsContainer.style.display = 'none';
        const noteEl = this.popover.querySelector('#timeTrackerNote');
        if (noteEl) noteEl.placeholder = 'Bijv. Weekstart / Klant call / 1:1 Servé';
      } else if (activity === 'operations') {
        if (supportContainer) supportContainer.style.display = 'none';
        if (taskContainer) taskContainer.style.display = 'none';
        if (kc) kc.style.display = 'none';
        if (overleg) overleg.style.display = 'none';
        if (operationsContainer) operationsContainer.style.display = 'block';
        const noteEl = this.popover.querySelector('#timeTrackerNote');
        if (noteEl) noteEl.placeholder = 'Bijv. Zapier fix / Dashboard verbeteringen / Facturatie run';
      } else if (activity === 'klantenwerk') {
        if (supportContainer) supportContainer.style.display = 'none';
        if (taskContainer) taskContainer.style.display = 'block';
        const klantContactContainer = this.popover.querySelector('#timeTrackerKlantContactContainer');
        if (klantContactContainer) klantContactContainer.style.display = 'block';
        if (overleg) overleg.style.display = 'none';
        if (operationsContainer) operationsContainer.style.display = 'none';
        this.loadTasks();
        this.clearKlantContactSelection();
        const noteEl = this.popover.querySelector('#timeTrackerNote');
        if (noteEl) noteEl.placeholder = 'Bijv. Bugfix login pagina';
      } else {
        if (supportContainer) supportContainer.style.display = 'none';
        taskContainer.style.display = 'none';
        const klantContactContainer = this.popover.querySelector('#timeTrackerKlantContactContainer');
        if (klantContactContainer) klantContactContainer.style.display = 'none';
        if (overleg) overleg.style.display = 'none';
        if (operationsContainer) operationsContainer.style.display = 'none';
        this.popover.querySelector('#timeTrackerTaskId').value = '';
        this.popover.querySelector('#timeTrackerTaskSearch').value = '';
        this.popover.querySelector('#timeTrackerCustomerId').value = '';
        this.popover.querySelector('#timeTrackerContactId').value = '';
        this.popover.querySelector('#timeTrackerContactCustomerId').value = '';
        this.overlegParticipants = [];
        this.clearContextSelection('overleg');
        this.clearContextSelection('operations');
        this.renderOverlegParticipantsChips();
        const noteEl = this.popover.querySelector('#timeTrackerNote');
        if (noteEl) noteEl.placeholder = 'Bijv. Bugfix login pagina';
      }
    }

    handleSwitchActivityChange() {
      const activity = this.popover.querySelector('#timeTrackerSwitchActivity').value;
      const taskContainer = this.popover.querySelector('#timeTrackerSwitchTaskContainer');
      const supportContainer = this.popover.querySelector('#timeTrackerSwitchSupportContainer');
      const switchKlantContact = this.popover.querySelector('#timeTrackerSwitchKlantContactContainer');
      const switchOverleg = this.popover.querySelector('#timeTrackerSwitchOverlegContainer');
      const switchOperations = this.popover.querySelector('#timeTrackerSwitchOperationsContainer');

      if (activity === 'support') {
        if (supportContainer) supportContainer.style.display = 'block';
        taskContainer.style.display = 'none';
        if (switchKlantContact) switchKlantContact.style.display = 'none';
        if (switchOverleg) switchOverleg.style.display = 'none';
        if (switchOperations) switchOperations.style.display = 'none';
        this.clearSwitchTicketSelection();
      } else if (activity === 'overleg') {
        if (supportContainer) supportContainer.style.display = 'none';
        taskContainer.style.display = 'none';
        if (switchKlantContact) switchKlantContact.style.display = 'none';
        if (switchOverleg) switchOverleg.style.display = 'block';
        if (switchOperations) switchOperations.style.display = 'none';
      } else if (activity === 'operations') {
        if (supportContainer) supportContainer.style.display = 'none';
        taskContainer.style.display = 'none';
        if (switchKlantContact) switchKlantContact.style.display = 'none';
        if (switchOverleg) switchOverleg.style.display = 'none';
        if (switchOperations) switchOperations.style.display = 'block';
      } else if (activity === 'klantenwerk') {
        if (supportContainer) supportContainer.style.display = 'none';
        taskContainer.style.display = 'block';
        if (switchKlantContact) switchKlantContact.style.display = 'block';
        if (switchOverleg) switchOverleg.style.display = 'none';
        if (switchOperations) switchOperations.style.display = 'none';
        this.loadTasks();
        this.clearSwitchKlantContactSelection();
        this.clearSwitchOverlegSelection();
        this.clearSwitchOperationsSelection();
      } else {
        if (supportContainer) supportContainer.style.display = 'none';
        taskContainer.style.display = 'none';
        if (switchKlantContact) switchKlantContact.style.display = 'none';
        if (switchOverleg) switchOverleg.style.display = 'none';
        if (switchOperations) switchOperations.style.display = 'none';
        this.popover.querySelector('#timeTrackerSwitchTaskId').value = '';
        this.popover.querySelector('#timeTrackerSwitchTaskSearch').value = '';
        this.popover.querySelector('#timeTrackerSwitchCustomerId').value = '';
        this.popover.querySelector('#timeTrackerSwitchContactId').value = '';
        this.popover.querySelector('#timeTrackerSwitchContactCustomerId').value = '';
        this.clearSwitchOverlegSelection();
        this.clearSwitchOperationsSelection();
      }
      this.updateSwitchTaskClearButton();
    }

    clearSwitchOperationsSelection() {
      const soc = this.popover.querySelector('#timeTrackerSwitchOpsCategory');
      const soa = this.popover.querySelector('#timeTrackerSwitchOpsArea');
      const soimp = this.popover.querySelector('#timeTrackerSwitchOpsImpact');
      const soct = this.popover.querySelector('#timeTrackerSwitchOperationsContextType');
      const socid = this.popover.querySelector('#timeTrackerSwitchOperationsContextId');
      const sos = this.popover.querySelector('#timeTrackerSwitchOperationsContextSearch');
      const soclear = this.popover.querySelector('#timeTrackerSwitchOperationsContextClear');
      if (soc) soc.value = 'algemeen';
      if (soa) soa.value = '';
      if (soimp) soimp.value = '';
      if (soct) soct.value = '';
      if (socid) socid.value = '';
      if (sos) sos.value = '';
      if (soclear) soclear.style.display = 'none';
    }

    clearSwitchOverlegSelection() {
      this.switchOverlegParticipants = [];
      const oct = this.popover.querySelector('#timeTrackerSwitchOverlegContextType');
      const ocid = this.popover.querySelector('#timeTrackerSwitchOverlegContextId');
      const os = this.popover.querySelector('#timeTrackerSwitchOverlegContextSearch');
      const oc = this.popover.querySelector('#timeTrackerSwitchOverlegContextClear');
      if (oct) oct.value = '';
      if (ocid) ocid.value = '';
      if (os) os.value = '';
      if (oc) oc.style.display = 'none';
      this.renderSwitchOverlegParticipantsChips();
    }

    clearSwitchTicketSelection() {
      const wrap = this.popover.querySelector('#timeTrackerSwitchTicketTasksWrap');
      const list = this.popover.querySelector('#timeTrackerSwitchTicketTasksList');
      this.popover.querySelector('#timeTrackerSwitchTicketId').value = '';
      this.popover.querySelector('#timeTrackerSwitchTicketSearch').value = '';
      this.popover.querySelector('#timeTrackerSwitchTicketTaskId').value = '';
      const clearBtn = this.popover.querySelector('#timeTrackerSwitchTicketClear');
      if (clearBtn) clearBtn.style.display = 'none';
      if (wrap) wrap.style.display = 'none';
      if (list) list.innerHTML = '';
      this.switchTicketTasks = [];
    }

    clearSwitchKlantContactSelection() {
      this.popover.querySelector('#timeTrackerSwitchCustomerId').value = '';
      this.popover.querySelector('#timeTrackerSwitchContactId').value = '';
      this.popover.querySelector('#timeTrackerSwitchContactCustomerId').value = '';
      this.popover.querySelector('#timeTrackerSwitchKlantContactSearch').value = '';
      const clearBtn = this.popover.querySelector('#timeTrackerSwitchKlantContactClear');
      if (clearBtn) clearBtn.style.display = 'none';
      this.switchKlantContactCustomerTitle = '';
      this.switchKlantContactContactTitle = '';
      this.renderSwitchKlantContactChips();
    }

    handleSwitchKlantContactSearch(query) {
      const dropdown = this.popover.querySelector('#timeTrackerSwitchKlantContactDropdown');
      if (this.switchKlantContactSearchDebounce) clearTimeout(this.switchKlantContactSearchDebounce);
      const q = (query || '').trim();
      if (q.length < 2) {
        if (dropdown) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; }
        return;
      }
      const self = this;
      this.switchKlantContactSearchDebounce = setTimeout(async () => {
        try {
          const response = await fetch(`/api/time-entries/context-search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
          const result = await response.json();
          if (!result.ok || !result.data) {
            dropdown.innerHTML = '<div style="padding:12px;color:#6b7280;">Geen resultaten</div>';
            dropdown.style.display = 'block';
            return;
          }
          const only = (result.data || []).filter((r) => r.type === 'customer' || r.type === 'contact');
          self.renderKlantContactDropdownSwitch(dropdown, only);
          dropdown.style.display = 'block';
        } catch (e) {
          dropdown.innerHTML = '<div style="padding:12px;color:#991b1b;">Fout</div>';
          dropdown.style.display = 'block';
        }
      }, 350);
    }

    renderKlantContactDropdownSwitch(dropdown, results) {
      const typeLabels = { customer: 'Klanten', contact: 'Contactpersonen' };
      const byType = {};
      results.forEach((r) => { if (!byType[r.type]) byType[r.type] = []; byType[r.type].push(r); });
      let html = '';
      ['customer', 'contact'].forEach((type) => {
        const list = byType[type] || [];
        if (list.length === 0) return;
        html += '<div style="padding:6px 10px 4px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;">' + (typeLabels[type] || type) + '</div>';
        list.forEach((item) => {
          const title = (item.title || '').replace(/</g, '&lt;');
          const subtitle = (item.subtitle || '').replace(/</g, '&lt;');
          const dataCustomerId = (item.type === 'contact' && item.customerId) ? (' data-customer-id="' + item.customerId + '"') : '';
          html += '<div class="switch-klant-contact-option" style="padding:8px 10px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f3f4f6;" data-type="' + (item.type || '') + '" data-id="' + (item.id || '') + '" data-title="' + title + '"' + dataCustomerId + '>' +
            '<div><div style="font-weight:500;">' + title + '</div>' + (subtitle ? '<div style="font-size:12px;color:#6b7280;">' + subtitle + '</div>' : '') + '</div></div>';
        });
      });
      dropdown.innerHTML = html || '<div style="padding:12px;color:#6b7280;">Geen resultaten</div>';
      dropdown.querySelectorAll('.switch-klant-contact-option').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          const type = el.getAttribute('data-type');
          const id = el.getAttribute('data-id');
          const title = el.getAttribute('data-title');
          const customerIdAttr = el.getAttribute('data-customer-id');
          if (type === 'customer') {
            this.popover.querySelector('#timeTrackerSwitchCustomerId').value = id || '';
            this.switchKlantContactCustomerTitle = title || '';
            this.popover.querySelector('#timeTrackerSwitchContactId').value = '';
            this.popover.querySelector('#timeTrackerSwitchContactCustomerId').value = '';
            this.switchKlantContactContactTitle = '';
          } else {
            this.popover.querySelector('#timeTrackerSwitchContactId').value = id || '';
            this.switchKlantContactContactTitle = title || '';
            this.popover.querySelector('#timeTrackerSwitchContactCustomerId').value = customerIdAttr || '';
          }
          const hasAny = (this.popover.querySelector('#timeTrackerSwitchCustomerId').value || '') || (this.popover.querySelector('#timeTrackerSwitchContactId').value || '');
          this.popover.querySelector('#timeTrackerSwitchKlantContactClear').style.display = hasAny ? 'block' : 'none';
          this.popover.querySelector('#timeTrackerSwitchKlantContactSearch').value = '';
          this.renderSwitchKlantContactChips();
          dropdown.style.display = 'none';
        });
      });
    }

    renderSwitchKlantContactChips() {
      const container = this.popover.querySelector('#timeTrackerSwitchKlantContactChips');
      if (!container) return;
      const customerId = (this.popover.querySelector('#timeTrackerSwitchCustomerId').value || '').trim();
      const contactId = (this.popover.querySelector('#timeTrackerSwitchContactId').value || '').trim();
      const contactCustomerId = (this.popover.querySelector('#timeTrackerSwitchContactCustomerId').value || '').trim();
      const customerTitle = this.switchKlantContactCustomerTitle || '';
      const contactTitle = this.switchKlantContactContactTitle || '';
      const isLinked = customerId && contactId && contactCustomerId === customerId;
      container.innerHTML = '';
      if (customerId) {
        const chip = document.createElement('span');
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:#e0f2fe;color:#0369a1;border-radius:6px;font-size:13px;';
        chip.innerHTML = 'Klant: ' + (customerTitle || '—').replace(/</g, '&lt;') + ' <button type="button" data-clear="customer" style="background:none;border:none;cursor:pointer;">×</button>';
        chip.querySelector('[data-clear="customer"]').addEventListener('click', (e) => {
          e.stopPropagation();
          this.popover.querySelector('#timeTrackerSwitchCustomerId').value = '';
          this.switchKlantContactCustomerTitle = '';
          this.popover.querySelector('#timeTrackerSwitchContactId').value = '';
          this.popover.querySelector('#timeTrackerSwitchContactCustomerId').value = '';
          this.switchKlantContactContactTitle = '';
          this.popover.querySelector('#timeTrackerSwitchKlantContactClear').style.display = 'none';
          this.renderSwitchKlantContactChips();
        });
        container.appendChild(chip);
      }
      if (isLinked) {
        const linkChip = document.createElement('span');
        linkChip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:#dcfce7;color:#166534;border-radius:6px;font-size:12px;';
        linkChip.innerHTML = '↔ Gekoppeld <button type="button" data-dismiss-link style="background:none;border:none;cursor:pointer;">×</button>';
        linkChip.querySelector('[data-dismiss-link]').addEventListener('click', (e) => {
          e.stopPropagation();
          this.popover.querySelector('#timeTrackerSwitchContactId').value = '';
          this.popover.querySelector('#timeTrackerSwitchContactCustomerId').value = '';
          this.switchKlantContactContactTitle = '';
          this.popover.querySelector('#timeTrackerSwitchKlantContactClear').style.display = (this.popover.querySelector('#timeTrackerSwitchCustomerId').value || '') ? 'block' : 'none';
          this.renderSwitchKlantContactChips();
        });
        container.appendChild(linkChip);
      }
      if (contactId) {
        const chip = document.createElement('span');
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:#f3e8ff;color:#6b21a8;border-radius:6px;font-size:13px;';
        chip.innerHTML = 'Contact: ' + (contactTitle || '—').replace(/</g, '&lt;') + ' <button type="button" data-clear="contact" style="background:none;border:none;cursor:pointer;">×</button>';
        chip.querySelector('[data-clear="contact"]').addEventListener('click', (e) => {
          e.stopPropagation();
          this.popover.querySelector('#timeTrackerSwitchContactId').value = '';
          this.popover.querySelector('#timeTrackerSwitchContactCustomerId').value = '';
          this.switchKlantContactContactTitle = '';
          this.popover.querySelector('#timeTrackerSwitchKlantContactClear').style.display = (this.popover.querySelector('#timeTrackerSwitchCustomerId').value || '') ? 'block' : 'none';
          this.renderSwitchKlantContactChips();
        });
        container.appendChild(chip);
      }
    }

    handleSwitchTicketSearch(q) {
      const dropdown = this.popover.querySelector('#timeTrackerSwitchTicketDropdown');
      if (this.switchTicketSearchDebounce) clearTimeout(this.switchTicketSearchDebounce);
      this.switchTicketSearchDebounce = setTimeout(() => this._doSwitchTicketSearch((q || '').trim(), dropdown), 300);
    }

    async _doSwitchTicketSearch(q, dropdown) {
      dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280;">Zoeken…</div>';
      dropdown.style.display = 'block';
      try {
        const params = new URLSearchParams({ limit: '15' });
        if (q.length >= 2) params.set('q', q);
        const response = await fetch(`/api/tickets/search?${params}`, { credentials: 'include' });
        const result = await response.json();
        const list = result.ok && result.data ? result.data : [];
        dropdown.innerHTML = '';
        if (list.length === 0) {
          dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280;">Geen tickets gevonden</div>';
        } else {
          list.forEach((t) => {
            const el = document.createElement('div');
            el.style.cssText = 'padding:8px 10px;cursor:pointer;border-bottom:1px solid #f3f4f6;';
            el.setAttribute('data-id', t.id);
            el.setAttribute('data-title', t.title || '');
            el.textContent = t.title || '';
            el.addEventListener('mousedown', (e) => {
              e.preventDefault();
              this.popover.querySelector('#timeTrackerSwitchTicketId').value = t.id;
              this.popover.querySelector('#timeTrackerSwitchTicketSearch').value = t.title || '';
              this.popover.querySelector('#timeTrackerSwitchTicketClear').style.display = 'block';
              dropdown.style.display = 'none';
              this.loadSwitchTicketTasks(t.id);
            });
            dropdown.appendChild(el);
          });
        }
      } catch (e) {
        dropdown.innerHTML = '<div style="padding: 12px; color: #ef4444;">Fout</div>';
      }
    }

    async loadSwitchTicketTasks(ticketId) {
      const wrap = this.popover.querySelector('#timeTrackerSwitchTicketTasksWrap');
      const listEl = this.popover.querySelector('#timeTrackerSwitchTicketTasksList');
      if (!wrap || !listEl) return;
      wrap.style.display = 'block';
      listEl.innerHTML = '<div style="padding: 8px;">Laden…</div>';
      try {
        const response = await fetch(`/api/tickets/${ticketId}/tasks`, { credentials: 'include' });
        const result = await response.json();
        this.switchTicketTasks = result.ok && result.data ? result.data : [];
        this.renderSwitchTicketTasksList();
      } catch (e) {
        this.switchTicketTasks = [];
        listEl.innerHTML = '<div style="padding: 8px; color: #ef4444;">Fout</div>';
      }
    }

    renderSwitchTicketTasksList() {
      const listEl = this.popover.querySelector('#timeTrackerSwitchTicketTasksList');
      const selectedId = (this.popover.querySelector('#timeTrackerSwitchTicketTaskId').value || '').trim();
      if (!listEl) return;
      listEl.innerHTML = '';
      (this.switchTicketTasks || []).forEach((t) => {
        const isSelected = t.id === selectedId;
        const row = document.createElement('div');
        row.style.cssText = 'padding: 8px 10px; cursor: pointer; border-bottom: 1px solid #f3f4f6;' + (isSelected ? ' background: #dbeafe;' : '');
        row.setAttribute('data-task-id', t.id);
        row.textContent = t.title || '';
        row.addEventListener('click', () => {
          this.popover.querySelector('#timeTrackerSwitchTicketTaskId').value = t.id;
          this.renderSwitchTicketTasksList();
        });
        listEl.appendChild(row);
      });
    }

    async loadTasks(q = '') {
      try {
        const params = new URLSearchParams({ status: 'open,in_progress', limit: '25' });
        if (q && q.trim()) params.set('q', q.trim());
        const response = await fetch(`/api/employees/${this.userId}/tasks?${params}`, { credentials: 'include' });
        const result = await response.json();
        let list = [];
        if (result.ok && result.data) {
          list = result.data.tasks || result.data || [];
        }
        this.tasks = list.filter(t => t.status !== 'done' && t.status !== 'rejected');
        return this.tasks;
      } catch (error) {
        console.error('[TimeTracker] Error loading tasks:', error);
        return [];
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

    clearTicketSelection() {
      const wrap = this.popover.querySelector('#timeTrackerTicketTasksWrap');
      const list = this.popover.querySelector('#timeTrackerTicketTasksList');
      const newForm = this.popover.querySelector('#timeTrackerTicketTaskNewForm');
      this.popover.querySelector('#timeTrackerTicketId').value = '';
      this.popover.querySelector('#timeTrackerTicketSearch').value = '';
      this.popover.querySelector('#timeTrackerTicketTaskId').value = '';
      if (this.popover.querySelector('#timeTrackerTicketClear')) this.popover.querySelector('#timeTrackerTicketClear').style.display = 'none';
      if (wrap) wrap.style.display = 'none';
      if (list) list.innerHTML = '';
      if (newForm) newForm.style.display = 'none';
      this.ticketTasks = [];
    }

    clearKlantContactSelection() {
      this.popover.querySelector('#timeTrackerCustomerId').value = '';
      this.popover.querySelector('#timeTrackerContactId').value = '';
      this.popover.querySelector('#timeTrackerContactCustomerId').value = '';
      this.popover.querySelector('#timeTrackerKlantContactSearch').value = '';
      const clearBtn = this.popover.querySelector('#timeTrackerKlantContactClear');
      if (clearBtn) clearBtn.style.display = 'none';
      this.klantContactCustomerTitle = '';
      this.klantContactContactTitle = '';
      this.renderKlantContactChips();
    }

    handleParticipantsSearch(query) {
      const dropdown = this.popover.querySelector('#timeTrackerParticipantsDropdown');
      if (this.overlegParticipantsSearchDebounce) clearTimeout(this.overlegParticipantsSearchDebounce);
      const q = (query || '').trim();
      if (q.length < 2) {
        if (dropdown) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; }
        return;
      }
      const self = this;
      this.overlegParticipantsSearchDebounce = setTimeout(async () => {
        try {
          const response = await fetch(`/api/profiles/search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
          const list = await response.json();
          const users = Array.isArray(list) ? list : (list.data || list.ok ? (list.data || []) : []);
          if (!dropdown) return;
          dropdown.innerHTML = '';
          if (users.length === 0) {
            dropdown.innerHTML = '<div style="padding:12px;color:#6b7280;font-size:13px;">Geen resultaten</div>';
          } else {
            users.forEach((u) => {
              const already = self.overlegParticipants.some((p) => p.id === u.id);
              const name = (u.display_name || u.full_name || (u.first_name && u.last_name ? u.first_name + ' ' + u.last_name : '') || u.email || '').trim() || '—';
              const el = document.createElement('div');
              el.className = 'time-tracker-participant-option';
              el.style.cssText = 'padding:8px 10px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f3f4f6;' + (already ? 'opacity:0.6;' : '');
              el.setAttribute('data-id', u.id);
              el.setAttribute('data-name', name);
              el.innerHTML = '<span style="width:24px;height:24px;border-radius:50%;background:#e5e7eb;color:#6b7280;font-size:11px;display:inline-flex;align-items:center;justify-content:center;">' + (name.slice(0, 2).toUpperCase()) + '</span><div style="font-size:14px;font-weight:500;">' + (name.replace(/</g, '&lt;')) + '</div>';
              el.addEventListener('click', (e) => {
                e.preventDefault();
                if (already) return;
                self.overlegParticipants.push({ id: u.id, display_name: name });
                self.popover.querySelector('#timeTrackerParticipantsSearch').value = '';
                dropdown.style.display = 'none';
                dropdown.innerHTML = '';
                self.renderOverlegParticipantsChips();
              });
              dropdown.appendChild(el);
            });
          }
          dropdown.style.display = 'block';
        } catch (e) {
          console.error('[TimeTracker] Participants search:', e);
          if (dropdown) {
            dropdown.innerHTML = '<div style="padding:12px;color:#991b1b;font-size:13px;">Fout bij zoeken</div>';
            dropdown.style.display = 'block';
          }
        }
      }, 300);
    }

    renderOverlegParticipantsChips() {
      const container = this.popover.querySelector('#timeTrackerParticipantsChips');
      if (!container) return;
      container.innerHTML = '';
      this.overlegParticipants.forEach((p) => {
        const chip = document.createElement('span');
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:#e0f2fe;color:#0369a1;border-radius:6px;font-size:13px;';
        const pid = (p.id || '').replace(/"/g, '&quot;');
        chip.innerHTML = (p.display_name || p.id).replace(/</g, '&lt;') + ' <button type="button" data-remove-id="' + pid + '" style="background:none;border:none;cursor:pointer;padding:0 2px;color:#0369a1;" aria-label="Verwijder">×</button>';
        chip.querySelector('[data-remove-id]').addEventListener('click', (e) => {
          e.stopPropagation();
          const id = e.target.getAttribute('data-remove-id');
          const i = this.overlegParticipants.findIndex((x) => String(x.id) === String(id));
          if (i !== -1) this.overlegParticipants.splice(i, 1);
          this.renderOverlegParticipantsChips();
        });
        container.appendChild(chip);
      });
    }

    handleSwitchParticipantsSearch(query) {
      const dropdown = this.popover.querySelector('#timeTrackerSwitchParticipantsDropdown');
      if (this.switchOverlegParticipantsSearchDebounce) clearTimeout(this.switchOverlegParticipantsSearchDebounce);
      const q = (query || '').trim();
      if (q.length < 2) {
        if (dropdown) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; }
        return;
      }
      const self = this;
      this.switchOverlegParticipantsSearchDebounce = setTimeout(async () => {
        try {
          const response = await fetch(`/api/profiles/search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
          const list = await response.json();
          const users = Array.isArray(list) ? list : (list.data || list.ok ? (list.data || []) : []);
          if (!dropdown) return;
          dropdown.innerHTML = '';
          if (users.length === 0) {
            dropdown.innerHTML = '<div style="padding:12px;color:#6b7280;font-size:13px;">Geen resultaten</div>';
          } else {
            users.forEach((u) => {
              const already = self.switchOverlegParticipants.some((p) => p.id === u.id);
              const name = (u.display_name || u.full_name || (u.first_name && u.last_name ? u.first_name + ' ' + u.last_name : '') || u.email || '').trim() || '—';
              const el = document.createElement('div');
              el.className = 'time-tracker-participant-option';
              el.style.cssText = 'padding:8px 10px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f3f4f6;' + (already ? 'opacity:0.6;' : '');
              el.setAttribute('data-id', u.id);
              el.setAttribute('data-name', name);
              el.innerHTML = '<span style="width:24px;height:24px;border-radius:50%;background:#e5e7eb;color:#6b7280;font-size:11px;display:inline-flex;align-items:center;justify-content:center;">' + (name.slice(0, 2).toUpperCase()) + '</span><div style="font-size:14px;font-weight:500;">' + (name.replace(/</g, '&lt;')) + '</div>';
              el.addEventListener('click', (e) => {
                e.preventDefault();
                if (already) return;
                self.switchOverlegParticipants.push({ id: u.id, display_name: name });
                self.popover.querySelector('#timeTrackerSwitchParticipantsSearch').value = '';
                dropdown.style.display = 'none';
                dropdown.innerHTML = '';
                self.renderSwitchOverlegParticipantsChips();
              });
              dropdown.appendChild(el);
            });
          }
          dropdown.style.display = 'block';
        } catch (e) {
          console.error('[TimeTracker] Switch participants search:', e);
          if (dropdown) {
            dropdown.innerHTML = '<div style="padding:12px;color:#991b1b;font-size:13px;">Fout bij zoeken</div>';
            dropdown.style.display = 'block';
          }
        }
      }, 300);
    }

    renderSwitchOverlegParticipantsChips() {
      const container = this.popover.querySelector('#timeTrackerSwitchParticipantsChips');
      if (!container) return;
      container.innerHTML = '';
      this.switchOverlegParticipants.forEach((p) => {
        const chip = document.createElement('span');
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:#e0f2fe;color:#0369a1;border-radius:6px;font-size:13px;';
        const pid = (p.id || '').replace(/"/g, '&quot;');
        chip.innerHTML = (p.display_name || p.id).replace(/</g, '&lt;') + ' <button type="button" data-remove-id="' + pid + '" style="background:none;border:none;cursor:pointer;padding:0 2px;color:#0369a1;" aria-label="Verwijder">×</button>';
        chip.querySelector('[data-remove-id]').addEventListener('click', (e) => {
          e.stopPropagation();
          const id = e.target.getAttribute('data-remove-id');
          const i = this.switchOverlegParticipants.findIndex((x) => String(x.id) === String(id));
          if (i !== -1) this.switchOverlegParticipants.splice(i, 1);
          this.renderSwitchOverlegParticipantsChips();
        });
        container.appendChild(chip);
      });
    }

    handleKlantContactSearch(query) {
      const dropdown = this.popover.querySelector('#timeTrackerKlantContactDropdown');
      if (this.klantContactSearchDebounce) clearTimeout(this.klantContactSearchDebounce);
      const q = (query || '').trim();
      if (q.length < 2) {
        if (dropdown) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; }
        return;
      }
      const self = this;
      this.klantContactSearchDebounce = setTimeout(async () => {
        try {
          const response = await fetch(`/api/time-entries/context-search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
          const result = await response.json();
          if (!result.ok || !result.data) {
            dropdown.innerHTML = '<div style="padding:12px;color:#6b7280;">Geen resultaten</div>';
            dropdown.style.display = 'block';
            return;
          }
          const only = (result.data || []).filter((r) => r.type === 'customer' || r.type === 'contact');
          self.renderKlantContactDropdown(dropdown, only);
          dropdown.style.display = 'block';
        } catch (e) {
          console.error('[TimeTracker] Klant/contact search:', e);
          dropdown.innerHTML = '<div style="padding:12px;color:#991b1b;">Fout bij zoeken</div>';
          dropdown.style.display = 'block';
        }
      }, 350);
    }

    renderKlantContactDropdown(dropdown, results) {
      const typeLabels = { customer: 'Klanten', contact: 'Contactpersonen' };
      const byType = {};
      results.forEach((r) => {
        if (!byType[r.type]) byType[r.type] = [];
        byType[r.type].push(r);
      });
      let html = '';
      ['customer', 'contact'].forEach((type) => {
        const list = byType[type] || [];
        if (list.length === 0) return;
        html += '<div style="padding:6px 10px 4px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;">' + (typeLabels[type] || type) + '</div>';
        list.forEach((item) => {
          const title = (item.title || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
          const subtitle = (item.subtitle || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
          const avatar = item.avatarUrl
            ? '<img src="' + item.avatarUrl.replace(/"/g, '&quot;') + '" alt="" width="24" height="24" style="border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display=\'none\'">'
            : '<span style="width:24px;height:24px;border-radius:50%;background:#e5e7eb;color:#6b7280;font-size:11px;display:inline-flex;align-items:center;justify-content:center;">' + (type === 'customer' ? 'B' : 'C') + '</span>';
          const dataCustomerId = (item.type === 'contact' && item.customerId) ? (' data-customer-id="' + item.customerId + '"') : '';
          html += '<div class="time-tracker-klant-contact-option" style="padding:8px 10px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f3f4f6;" data-type="' + (item.type || '') + '" data-id="' + (item.id || '') + '" data-title="' + title + '"' + dataCustomerId + ' onmouseover="this.style.background=\'#f9fafb\'" onmouseout="this.style.background=\'white\'">' +
            avatar + '<div style="min-width:0;"><div style="font-size:14px;font-weight:500;">' + title + '</div>' + (subtitle ? '<div style="font-size:12px;color:#6b7280;">' + subtitle + '</div>' : '') + '</div></div>';
        });
      });
      dropdown.innerHTML = html || '<div style="padding:12px;color:#6b7280;">Geen resultaten</div>';
      dropdown.querySelectorAll('.time-tracker-klant-contact-option').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          const type = el.getAttribute('data-type');
          const id = el.getAttribute('data-id');
          const title = el.getAttribute('data-title');
          const customerIdAttr = el.getAttribute('data-customer-id');
          if (type === 'customer') {
            this.popover.querySelector('#timeTrackerCustomerId').value = id || '';
            this.klantContactCustomerTitle = title || '';
            if (!id || customerIdAttr !== id) {
              this.popover.querySelector('#timeTrackerContactId').value = '';
              this.popover.querySelector('#timeTrackerContactCustomerId').value = '';
              this.klantContactContactTitle = '';
            }
          } else {
            this.popover.querySelector('#timeTrackerContactId').value = id || '';
            this.klantContactContactTitle = title || '';
            this.popover.querySelector('#timeTrackerContactCustomerId').value = customerIdAttr || '';
          }
          const hasAny = (this.popover.querySelector('#timeTrackerCustomerId').value || '') || (this.popover.querySelector('#timeTrackerContactId').value || '');
          this.popover.querySelector('#timeTrackerKlantContactClear').style.display = hasAny ? 'block' : 'none';
          this.popover.querySelector('#timeTrackerKlantContactSearch').value = '';
          this.renderKlantContactChips();
          dropdown.style.display = 'none';
        });
      });
    }

    renderKlantContactChips() {
      const container = this.popover.querySelector('#timeTrackerKlantContactChips');
      if (!container) return;
      const customerId = (this.popover.querySelector('#timeTrackerCustomerId').value || '').trim();
      const contactId = (this.popover.querySelector('#timeTrackerContactId').value || '').trim();
      const contactCustomerId = (this.popover.querySelector('#timeTrackerContactCustomerId').value || '').trim();
      const customerTitle = this.klantContactCustomerTitle || '';
      const contactTitle = this.klantContactContactTitle || '';
      const isLinked = customerId && contactId && contactCustomerId === customerId;
      container.innerHTML = '';
      if (customerId) {
        const chip = document.createElement('span');
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:#e0f2fe;color:#0369a1;border-radius:6px;font-size:13px;';
        chip.innerHTML = 'Klant: ' + (customerTitle || '—').replace(/</g, '&lt;') + ' <button type="button" data-clear="customer" style="background:none;border:none;cursor:pointer;padding:0 2px;color:#0369a1;" aria-label="Wis klant">×</button>';
        chip.querySelector('[data-clear="customer"]').addEventListener('click', (e) => {
          e.stopPropagation();
          this.popover.querySelector('#timeTrackerCustomerId').value = '';
          this.klantContactCustomerTitle = '';
          this.popover.querySelector('#timeTrackerContactId').value = '';
          this.popover.querySelector('#timeTrackerContactCustomerId').value = '';
          this.klantContactContactTitle = '';
          this.popover.querySelector('#timeTrackerKlantContactClear').style.display = (this.popover.querySelector('#timeTrackerContactId').value || '') ? 'block' : 'none';
          this.renderKlantContactChips();
        });
        container.appendChild(chip);
      }
      if (isLinked) {
        const linkChip = document.createElement('span');
        linkChip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:#dcfce7;color:#166534;border-radius:6px;font-size:12px;';
        linkChip.innerHTML = '↔ Gekoppeld <button type="button" data-dismiss-link style="background:none;border:none;cursor:pointer;padding:0 2px;color:#166534;" aria-label="Ontkoppel">×</button>';
        linkChip.querySelector('[data-dismiss-link]').addEventListener('click', (e) => {
          e.stopPropagation();
          this.popover.querySelector('#timeTrackerContactId').value = '';
          this.popover.querySelector('#timeTrackerContactCustomerId').value = '';
          this.klantContactContactTitle = '';
          this.popover.querySelector('#timeTrackerKlantContactClear').style.display = (this.popover.querySelector('#timeTrackerCustomerId').value || '') ? 'block' : 'none';
          this.renderKlantContactChips();
        });
        container.appendChild(linkChip);
      }
      if (contactId) {
        const chip = document.createElement('span');
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:#f3e8ff;color:#6b21a8;border-radius:6px;font-size:13px;';
        chip.innerHTML = 'Contact: ' + (contactTitle || '—').replace(/</g, '&lt;') + ' <button type="button" data-clear="contact" style="background:none;border:none;cursor:pointer;padding:0 2px;color:#6b21a8;" aria-label="Wis contact">×</button>';
        chip.querySelector('[data-clear="contact"]').addEventListener('click', (e) => {
          e.stopPropagation();
          this.popover.querySelector('#timeTrackerContactId').value = '';
          this.popover.querySelector('#timeTrackerContactCustomerId').value = '';
          this.klantContactContactTitle = '';
          this.popover.querySelector('#timeTrackerKlantContactClear').style.display = (this.popover.querySelector('#timeTrackerCustomerId').value || '') ? 'block' : 'none';
          this.renderKlantContactChips();
        });
        container.appendChild(chip);
      }
    }

    handleTicketSearch(q) {
      const dropdown = this.popover.querySelector('#timeTrackerTicketDropdown');
      if (this.ticketSearchDebounceTimer) clearTimeout(this.ticketSearchDebounceTimer);
      this.ticketSearchDebounceTimer = setTimeout(() => {
        this._doTicketSearch((q || '').trim(), dropdown);
      }, 300);
    }

    async _doTicketSearch(q, dropdown) {
      dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280; text-align: center;">Zoeken…</div>';
      dropdown.style.display = 'block';
      try {
        const params = new URLSearchParams({ limit: '15' });
        if (q.length >= 2) params.set('q', q);
        const response = await fetch(`/api/tickets/search?${params}`, { credentials: 'include' });
        const result = await response.json();
        const list = result.ok && result.data ? result.data : [];
        dropdown.innerHTML = '';
        if (list.length === 0) {
          dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280; text-align: center;">Geen tickets gevonden</div>';
        } else {
          list.forEach((t) => {
            const title = (t.title || '').replace(/</g, '&lt;');
            const sub = (t.subtitle || '').replace(/</g, '&lt;');
            const el = document.createElement('div');
            el.className = 'time-tracker-context-option';
            el.style.cssText = 'padding:8px 10px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f3f4f6;';
            el.setAttribute('data-id', t.id);
            el.setAttribute('data-title', t.title || '');
            el.innerHTML = '<div><div style="font-weight:500;">' + title + '</div>' + (sub ? '<div style="font-size:12px;color:#6b7280;">' + sub + '</div>' : '') + '</div>';
            el.addEventListener('mouseover', () => { el.style.background = '#f9fafb'; });
            el.addEventListener('mouseout', () => { el.style.background = 'white'; });
            el.addEventListener('mousedown', (e) => {
              e.preventDefault();
              this.popover.querySelector('#timeTrackerTicketId').value = t.id;
              this.popover.querySelector('#timeTrackerTicketSearch').value = t.title || '';
              this.popover.querySelector('#timeTrackerTicketClear').style.display = 'block';
              dropdown.style.display = 'none';
              this.loadTicketTasks(t.id);
            });
            dropdown.appendChild(el);
          });
        }
      } catch (e) {
        console.error('[TimeTracker] Ticket search:', e);
        dropdown.innerHTML = '<div style="padding: 12px; color: #ef4444;">Fout bij zoeken</div>';
      }
    }

    async loadTicketTasks(ticketId) {
      const wrap = this.popover.querySelector('#timeTrackerTicketTasksWrap');
      const listEl = this.popover.querySelector('#timeTrackerTicketTasksList');
      if (!wrap || !listEl) return;
      wrap.style.display = 'block';
      listEl.innerHTML = '<div style="padding: 12px; color: #6b7280;">Laden…</div>';
      try {
        const response = await fetch(`/api/tickets/${ticketId}/tasks`, { credentials: 'include' });
        const result = await response.json();
        this.ticketTasks = result.ok && result.data ? result.data : [];
        this.renderTicketTasksList();
      } catch (e) {
        console.error('[TimeTracker] Load ticket tasks:', e);
        this.ticketTasks = [];
        listEl.innerHTML = '<div style="padding: 12px; color: #ef4444;">Fout bij laden</div>';
      }
    }

    renderTicketTasksList() {
      const listEl = this.popover.querySelector('#timeTrackerTicketTasksList');
      const selectedId = (this.popover.querySelector('#timeTrackerTicketTaskId').value || '').trim();
      if (!listEl) return;
      listEl.innerHTML = '';
      this.ticketTasks.forEach((t) => {
        const desc = (t.description || '').trim();
        const oneLine = desc ? (desc.length > 60 ? desc.slice(0, 60) + '…' : desc) : '';
        const isSelected = t.id === selectedId;
        const row = document.createElement('div');
        row.style.cssText = 'padding: 8px 10px; cursor: pointer; border-bottom: 1px solid #f3f4f6; display: flex; align-items: flex-start; gap: 8px;' + (isSelected ? ' background: #dbeafe; border-left: 3px solid #3b82f6;' : '');
        row.setAttribute('data-task-id', t.id);
        row.innerHTML = '<div style="flex:1;"><div style="font-weight:500;font-size:13px;">' + (t.title || '').replace(/</g, '&lt;') + '</div>' + (oneLine ? '<div style="font-size:12px;color:#6b7280;margin-top:2px;">' + oneLine.replace(/</g, '&lt;') + '</div>' : '') + '</div>';
        row.addEventListener('click', () => {
          this.popover.querySelector('#timeTrackerTicketTaskId').value = t.id;
          const noteEl = this.popover.querySelector('#timeTrackerNote');
          if (noteEl && (!noteEl.value || !noteEl.value.trim())) noteEl.value = (t.title || '').trim();
          this.renderTicketTasksList();
        });
        listEl.appendChild(row);
      });
    }

    async createTicketTaskAndSelect() {
      const ticketId = (this.popover.querySelector('#timeTrackerTicketId').value || '').trim();
      const titleEl = this.popover.querySelector('#timeTrackerTicketTaskNewTitle');
      const descEl = this.popover.querySelector('#timeTrackerTicketTaskNewDesc');
      const title = (titleEl && titleEl.value) ? titleEl.value.trim() : '';
      if (!ticketId || !title) {
        if (typeof window.showNotification === 'function') window.showNotification('Titel is verplicht', 'error');
        return;
      }
      try {
        const response = await fetch(`/api/tickets/${ticketId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title: title, description: (descEl && descEl.value) ? descEl.value.trim() : null })
        });
        const result = await response.json();
        if (result.ok && result.data) {
          this.ticketTasks = [...this.ticketTasks, result.data];
          this.popover.querySelector('#timeTrackerTicketTaskId').value = result.data.id;
          const noteEl = this.popover.querySelector('#timeTrackerNote');
          if (noteEl && (!noteEl.value || !noteEl.value.trim())) noteEl.value = (result.data.title || '').trim();
          this.popover.querySelector('#timeTrackerTicketTaskNewForm').style.display = 'none';
          titleEl.value = '';
          if (descEl) descEl.value = '';
          this.renderTicketTasksList();
          if (typeof window.showNotification === 'function') window.showNotification('Taak toegevoegd', 'success');
        } else {
          throw new Error(result.error || 'Fout bij opslaan');
        }
      } catch (e) {
        console.error('[TimeTracker] Create ticket task:', e);
        if (typeof window.showNotification === 'function') window.showNotification(e.message || 'Fout bij opslaan', 'error');
      }
    }

    handleTaskSearch(query) {
      const dropdown = this.popover.querySelector('#timeTrackerTaskDropdown');
      if (this.taskSearchDebounceTimer) clearTimeout(this.taskSearchDebounceTimer);
      this.taskSearchDebounceTimer = setTimeout(() => {
        this._doTaskSearch(query, dropdown);
      }, 250);
    }

    async _doTaskSearch(query, dropdown) {
      dropdown.innerHTML = '<div style="padding: 12px; color: #6b7280; text-align: center;">Zoeken…</div>';
      dropdown.style.display = 'block';
      const tasks = await this.loadTasks(query || '');
      const filtered = tasks || [];

      if (filtered.length === 0) {
        dropdown.innerHTML = `
          <div style="padding: 12px; color: #6b7280; text-align: center;">
            <div style="margin-bottom: 8px;">Geen taken gevonden</div>
            <button id="addTaskFromSearchBtn" style="display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Taak toevoegen
            </button>
          </div>
        `;
        const addTaskBtn = dropdown.querySelector('#addTaskFromSearchBtn');
        if (addTaskBtn) {
          addTaskBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const title = (query || '').trim();
            this.closePopover();
            if (typeof window.openTaskDrawer === 'function') {
              window.openTaskDrawer({ prefilledTitle: title });
            } else {
              const params = new URLSearchParams({ openTaskDrawer: '1', view: 'list' });
              if (title) params.set('title', title);
              window.location.href = '/admin/tasks?' + params.toString();
            }
          });
        }
      } else {
        const statusLabels = { open: 'Open', in_progress: 'In uitvoering', in_review: 'In beoordeling', done: 'Voltooid', rejected: 'Afgewezen' };
        const priorityLabels = { urgent: 'Urgent', high: 'Hoog', medium: 'Normaal', low: 'Laag' };
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        const now = new Date();
        const sorted = [...filtered].sort((a, b) => {
          const aOverdue = a.due_at && new Date(a.due_at) < now;
          const bOverdue = b.due_at && new Date(b.due_at) < now;
          if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
          const aP = priorityOrder[a.priority] ?? 2;
          const bP = priorityOrder[b.priority] ?? 2;
          if (aP !== bP) return aP - bP;
          if (a.due_at && b.due_at) return new Date(a.due_at) - new Date(b.due_at);
          if (a.due_at) return -1;
          if (b.due_at) return 1;
          const statusOrder = { in_progress: 0, open: 1, in_review: 2 };
          return (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1);
        });
        dropdown.innerHTML = sorted.map(task => {
          const custName = task.customer_name || (task.customer ? (task.customer.company_name || [task.customer.first_name, task.customer.last_name].filter(Boolean).join(' ')) : '');
          const statusLabel = statusLabels[task.status] || task.status || 'Open';
          const priorityLabel = priorityLabels[task.priority] || task.priority || 'Normaal';
          let deadlineText = '';
          if (task.due_at) {
            const d = new Date(task.due_at);
            const isOverdue = d < now;
            deadlineText = isOverdue
              ? '<span style="color: #dc2626;">Deadline verstreken ' + d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) + '</span>'
              : 'Deadline ' + d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
          }
          const metaLine = [priorityLabel, statusLabel, deadlineText].filter(Boolean).join(' · ');
          return `<div class="task-option" style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'" data-task-id="${task.id}" data-task-title="${(task.title || '').replace(/"/g, '&quot;')}" data-customer-id="${task.customer_id || ''}" data-customer-name="${(custName || '').replace(/"/g, '&quot;')}" data-contact-id="${task.contact_id || ''}">
            <div style="font-weight: 500; color: #111827; font-size: 14px;">${(task.title || 'Geen titel').replace(/</g, '&lt;')}</div>
            ${custName ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${String(custName).replace(/</g, '&lt;')}</div>` : ''}
            <div style="font-size: 10px; color: #9ca3af; margin-top: 4px;">${metaLine}</div>
          </div>`;
        }).join('');

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

            if (customerId && customerName) {
              this.popover.querySelector('#timeTrackerCustomerId').value = customerId;
              this.klantContactCustomerTitle = customerName;
              this.popover.querySelector('#timeTrackerContactId').value = '';
              this.popover.querySelector('#timeTrackerContactCustomerId').value = '';
              this.klantContactContactTitle = '';
              this.popover.querySelector('#timeTrackerKlantContactClear').style.display = 'block';
              this.renderKlantContactChips();
              const noteInput = this.popover.querySelector('#timeTrackerNote');
              if (noteInput && taskTitle && customerName) noteInput.value = `Taak: ${taskTitle} voor: ${customerName}`;
              if (contactId) this.loadContactsForCustomer(customerId, contactId);
            } else if (taskTitle) {
              const noteInput = this.popover.querySelector('#timeTrackerNote');
              if (noteInput) noteInput.value = `Taak: ${taskTitle}`;
            }
          });
        });
      }
      dropdown.style.display = 'block';
    }

    async loadContactsForCustomer(customerId, selectedContactId = null) {
      try {
        const response = await fetch(`/admin/api/customers/${customerId}/contacts`, { credentials: 'include' });
        const result = await response.json();
        this.contacts = result.success && result.contacts ? result.contacts : (result.ok && result.data ? result.data : []);
        if (selectedContactId && this.contacts.length > 0) {
          const contact = this.contacts.find(c => c.id === selectedContactId);
          if (contact) {
            const contactName = (contact.first_name || '') + ' ' + (contact.last_name || '') || contact.email || '';
            this.popover.querySelector('#timeTrackerContactId').value = contact.id;
            this.klantContactContactTitle = contactName;
            this.popover.querySelector('#timeTrackerContactCustomerId').value = customerId;
            this.popover.querySelector('#timeTrackerKlantContactClear').style.display = 'block';
            this.renderKlantContactChips();
          }
        }
      } catch (error) {
        console.error('[TimeTracker] Error loading contacts:', error);
      }
    }

    handleCustomerSearch(query) {
      const dropdown = this.popover.querySelector('#timeTrackerCustomerDropdown');
      if (!dropdown) return;
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
        const custName = (c) => c.company_name || (c.first_name && c.last_name ? c.first_name + ' ' + c.last_name : c.name) || c.email || 'Onbekend';
        dropdown.innerHTML = filtered.map(customer => {
          const name = custName(customer);
          return '<div class="customer-option" style="display:flex;align-items:center;gap:10px;padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.2s;" onmouseover="this.style.background=\'#f9fafb\'" onmouseout="this.style.background=\'white\'" data-customer-id="' + customer.id + '" data-customer-name="' + (name || '').replace(/"/g, '&quot;') + '">' +
            '<span style="flex-shrink:0;">' + avatarHtml(customer.avatar_url || null, name, 24) + '</span>' +
            '<div style="font-weight: 500; color: #111827; font-size: 14px;">' + (name || '').replace(/</g, '&lt;') + '</div>' +
            '</div>';
        }).join('');

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
      if (!dropdown) return;
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
          const contactName = ((contact.first_name || '') + ' ' + (contact.last_name || '')).trim() || contact.email || 'Onbekend';
          return '<div class="contact-option" style="display:flex;align-items:center;gap:10px;padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.2s;" onmouseover="this.style.background=\'#f9fafb\'" onmouseout="this.style.background=\'white\'" data-contact-id="' + contact.id + '" data-contact-name="' + (contactName || '').replace(/"/g, '&quot;') + '">' +
            '<span style="flex-shrink:0;">' + avatarHtml(contact.avatar_url || contact.photo_url || null, contactName, 24) + '</span>' +
            '<div><div style="font-weight: 500; color: #111827; font-size: 14px;">' + (contactName || '').replace(/</g, '&lt;') + '</div>' +
            (contact.email ? '<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">' + String(contact.email).replace(/</g, '&lt;') + '</div>' : '') + '</div>' +
            '</div>';
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
              this.switchKlantContactCustomerTitle = customerName;
              this.popover.querySelector('#timeTrackerSwitchContactId').value = '';
              this.popover.querySelector('#timeTrackerSwitchContactCustomerId').value = '';
              this.switchKlantContactContactTitle = '';
              this.popover.querySelector('#timeTrackerSwitchKlantContactClear').style.display = 'block';
              this.renderSwitchKlantContactChips();
              const noteEl = this.popover.querySelector('#timeTrackerSwitchNote');
              if (noteEl && taskTitle && customerName) noteEl.value = `Taak: ${taskTitle} voor: ${customerName}`;
            } else if (taskTitle) {
              const noteEl = this.popover.querySelector('#timeTrackerSwitchNote');
              if (noteEl) noteEl.value = `Taak: ${taskTitle}`;
            }
          });
        });
      }
      dropdown.style.display = 'block';
    }

    clearSwitchTaskSelection() {
      this.popover.querySelector('#timeTrackerSwitchTaskId').value = '';
      this.popover.querySelector('#timeTrackerSwitchTaskSearch').value = '';
      this.updateSwitchTaskClearButton();
      const kc = this.popover.querySelector('#timeTrackerSwitchKlantContactContainer');
      if (kc && kc.style.display !== 'none') {
        this.clearSwitchKlantContactSelection();
      }
    }

    updateSwitchTaskClearButton() {
      const clearBtn = this.popover.querySelector('#timeTrackerSwitchTaskClear');
      const taskId = this.popover.querySelector('#timeTrackerSwitchTaskId');
      if (clearBtn && taskId) clearBtn.style.display = (taskId.value && taskId.value.length > 0) ? 'block' : 'none';
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

        // Sync switch activity dropdown and show task/customer or ticket/tasks when Support
        const pn = (this.currentEntry.project_name || '').toLowerCase();
        const switchActivitySelect = this.popover.querySelector('#timeTrackerSwitchActivity');
        if (switchActivitySelect) {
          const match = ACTIVITY_TYPES.find(a => a.value === pn);
          if (match) switchActivitySelect.value = match.value;
          this.handleSwitchActivityChange();
        }
        if (pn === 'support' && this.currentEntry.ticket_id) {
          const tid = this.currentEntry.ticket_id;
          const t = this.currentEntry.ticket;
          const ticketTitle = t ? ((t.ticket_number || '') + (t.subject ? ' – ' + t.subject : '')) : tid;
          this.popover.querySelector('#timeTrackerSwitchTicketId').value = tid;
          this.popover.querySelector('#timeTrackerSwitchTicketSearch').value = ticketTitle;
          const switchTicketClear = this.popover.querySelector('#timeTrackerSwitchTicketClear');
          if (switchTicketClear) switchTicketClear.style.display = 'block';
          if (this.currentEntry.ticket_task_id) {
            this.popover.querySelector('#timeTrackerSwitchTicketTaskId').value = this.currentEntry.ticket_task_id;
          }
          this.loadSwitchTicketTasks(tid);
        }
        if (pn === 'klantenwerk' && (this.currentEntry.customer_id || this.currentEntry.contact_id)) {
          const cust = this.currentEntry.customer;
          const cont = this.currentEntry.contact;
          if (this.currentEntry.customer_id) {
            this.popover.querySelector('#timeTrackerSwitchCustomerId').value = this.currentEntry.customer_id;
            this.switchKlantContactCustomerTitle = cust ? (cust.company_name || cust.name || cust.email || '') : '';
          }
          if (this.currentEntry.contact_id) {
            this.popover.querySelector('#timeTrackerSwitchContactId').value = this.currentEntry.contact_id;
            this.switchKlantContactContactTitle = cont ? ([cont.first_name, cont.last_name].filter(Boolean).join(' ') || cont.name || cont.email || '') : '';
            this.popover.querySelector('#timeTrackerSwitchContactCustomerId').value = (cont && cont.customer_id) ? cont.customer_id : '';
          }
          this.popover.querySelector('#timeTrackerSwitchKlantContactClear').style.display = 'block';
          this.renderSwitchKlantContactChips();
        }

        // Sales: show/hide context wrap and nudge; fill context from currentEntry
        const isSales = pn === 'sales';
        const nudgeEl = this.popover.querySelector('#timeTrackerSalesNudge');
        const contextWrap = this.popover.querySelector('#timeTrackerRunningContextWrap');
        if (nudgeEl) nudgeEl.style.display = 'none';
        if (contextWrap) {
          if (isSales) {
            contextWrap.style.display = 'block';
            const rType = this.popover.querySelector('#timeTrackerRunningContextType');
            const rId = this.popover.querySelector('#timeTrackerRunningContextId');
            const rSearch = this.popover.querySelector('#timeTrackerRunningContextSearch');
            const rClear = this.popover.querySelector('#timeTrackerRunningContextClear');
            if (this.currentEntry.context_type && this.currentEntry.context_id) {
              if (rType) rType.value = this.currentEntry.context_type;
              if (rId) rId.value = this.currentEntry.context_id;
              if (rSearch) rSearch.value = 'Gekoppeld aan ' + (this.currentEntry.context_type === 'deal' ? 'deal' : this.currentEntry.context_type === 'opportunity' ? 'kans' : this.currentEntry.context_type);
              if (rClear) rClear.style.display = 'block';
            } else {
              if (rType) rType.value = '';
              if (rId) rId.value = '';
              if (rSearch) rSearch.value = '';
              if (rClear) rClear.style.display = 'none';
            }
          } else {
            contextWrap.style.display = 'none';
          }
        }

        // Overleg: prefill switch overleg fields from currentEntry
        if (pn === 'overleg') {
          const switchMeetingType = this.popover.querySelector('#timeTrackerSwitchMeetingType');
          if (switchMeetingType && this.currentEntry.meeting_type) switchMeetingType.value = this.currentEntry.meeting_type;
          const soct = this.popover.querySelector('#timeTrackerSwitchOverlegContextType');
          const socid = this.popover.querySelector('#timeTrackerSwitchOverlegContextId');
          const sos = this.popover.querySelector('#timeTrackerSwitchOverlegContextSearch');
          const soc = this.popover.querySelector('#timeTrackerSwitchOverlegContextClear');
          if (this.currentEntry.context_type && this.currentEntry.context_id) {
            if (soct) soct.value = this.currentEntry.context_type;
            if (socid) socid.value = this.currentEntry.context_id;
            if (sos) sos.value = 'Gekoppeld';
            if (soc) soc.style.display = 'block';
          } else {
            if (soct) soct.value = '';
            if (socid) socid.value = '';
            if (sos) sos.value = '';
            if (soc) soc.style.display = 'none';
          }
          this.switchOverlegParticipants = [];
          this.renderSwitchOverlegParticipantsChips();
        }

        // Operations: prefill switch ops fields from currentEntry
        if (pn === 'operations') {
          const swOpsCat = this.popover.querySelector('#timeTrackerSwitchOpsCategory');
          const swOpsArea = this.popover.querySelector('#timeTrackerSwitchOpsArea');
          const swOpsImpact = this.popover.querySelector('#timeTrackerSwitchOpsImpact');
          if (swOpsCat && this.currentEntry.ops_category) swOpsCat.value = this.currentEntry.ops_category;
          if (swOpsArea) swOpsArea.value = this.currentEntry.ops_area || '';
          if (swOpsImpact && this.currentEntry.ops_impact) swOpsImpact.value = this.currentEntry.ops_impact;
          const sopct = this.popover.querySelector('#timeTrackerSwitchOperationsContextType');
          const sopcid = this.popover.querySelector('#timeTrackerSwitchOperationsContextId');
          const sops = this.popover.querySelector('#timeTrackerSwitchOperationsContextSearch');
          const sopc = this.popover.querySelector('#timeTrackerSwitchOperationsContextClear');
          if (this.currentEntry.context_type && this.currentEntry.context_id) {
            if (sopct) sopct.value = this.currentEntry.context_type;
            if (sopcid) sopcid.value = this.currentEntry.context_id;
            if (sops) sops.value = 'Gekoppeld';
            if (sopc) sopc.style.display = 'block';
          } else {
            if (sopct) sopct.value = '';
            if (sopcid) sopcid.value = '';
            if (sops) sops.value = '';
            if (sopc) sopc.style.display = 'none';
          }
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
      const key = (activityType || '').toLowerCase();
      const activity = ACTIVITY_TYPES.find(a => a.value === key);
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
      let note = this.popover.querySelector('#timeTrackerNote').value.trim();
      const taskId = this.popover.querySelector('#timeTrackerTaskId').value;
      const customerId = this.popover.querySelector('#timeTrackerCustomerId').value;
      const contactId = this.popover.querySelector('#timeTrackerContactId').value;
      const ticketId = (this.popover.querySelector('#timeTrackerTicketId').value || '').trim();
      const ticketTaskId = (this.popover.querySelector('#timeTrackerTicketTaskId').value || '').trim();

      if (activity === 'overleg' && !note) {
        const meetingTypeEl = this.popover.querySelector('#timeTrackerMeetingType');
        const meetingType = meetingTypeEl ? meetingTypeEl.value : 'intern';
        const labelObj = OVERLEG_MEETING_TYPES.find((t) => t.value === meetingType);
        const firstParticipant = this.overlegParticipants[0];
        if (firstParticipant && firstParticipant.display_name) {
          note = 'Overleg met ' + firstParticipant.display_name;
        } else {
          note = 'Overleg - ' + (labelObj ? labelObj.label : 'Intern (team)');
        }
      }
      if (activity === 'operations' && !note) {
        const opsAreaEl = this.popover.querySelector('#timeTrackerOpsArea');
        const opsCatEl = this.popover.querySelector('#timeTrackerOpsCategory');
        const area = (opsAreaEl && opsAreaEl.value) ? opsAreaEl.value.trim() : '';
        if (area) {
          note = 'Operations - ' + area;
        } else {
          const catVal = (opsCatEl && opsCatEl.value) ? opsCatEl.value : 'algemeen';
          const catLabel = OPERATIONS_CATEGORIES.find((c) => c.value === catVal);
          note = 'Operations - ' + (catLabel ? catLabel.label : 'Algemeen');
        }
      }

      if (activity === 'support') {
        if (!ticketId) {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Selecteer eerst een ticket', 'error');
          }
          return;
        }
        if (!note && ticketTaskId) {
          const task = this.ticketTasks.find((t) => t.id === ticketTaskId);
          if (task && task.title) note = task.title;
        }
      }
      if (!note) {
        if (typeof window.showNotification === 'function') {
          window.showNotification('Titel is verplicht', 'error');
        }
        return;
      }
      if (activity === 'klantenwerk') {
        if (!customerId || customerId.length === 0) {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Kies een klant bij Klantenwerk', 'error');
          }
          return;
        }
      }

      try {
        const body = {
          project_name: activity === 'klantenwerk' ? 'Klantenwerk' : (activity === 'support' ? 'Support' : (activity === 'sales' ? 'Sales' : (activity === 'overleg' ? 'Overleg' : (activity === 'operations' ? 'Operations' : activity)))),
          note: note
        };

        if (taskId) body.task_id = taskId;
        if (customerId) body.customer_id = customerId;
        if (contactId) body.contact_id = contactId;
        if (activity === 'support' && ticketId) {
          body.ticket_id = ticketId;
          if (ticketTaskId) body.ticket_task_id = ticketTaskId;
        }

        if (activity === 'operations') {
          const opsCatEl = this.popover.querySelector('#timeTrackerOpsCategory');
          const opsAreaEl = this.popover.querySelector('#timeTrackerOpsArea');
          const opsImpactEl = this.popover.querySelector('#timeTrackerOpsImpact');
          body.ops_category = (opsCatEl && opsCatEl.value) ? opsCatEl.value : 'algemeen';
          body.ops_area = (opsAreaEl && opsAreaEl.value) ? opsAreaEl.value.trim() : null;
          body.ops_impact = (opsImpactEl && opsImpactEl.value) ? opsImpactEl.value : null;
          const oct = this.popover.querySelector('#timeTrackerOperationsContextType');
          const ocid = this.popover.querySelector('#timeTrackerOperationsContextId');
          if (oct && oct.value) body.context_type = oct.value;
          if (ocid && ocid.value) body.context_id = ocid.value;
        }

        if (activity === 'overleg') {
          const meetingTypeEl = this.popover.querySelector('#timeTrackerMeetingType');
          body.meeting_type = (meetingTypeEl && meetingTypeEl.value) ? meetingTypeEl.value : 'intern';
          body.participant_user_ids = this.overlegParticipants.length ? this.overlegParticipants.map((p) => p.id) : [];
          const oct = this.popover.querySelector('#timeTrackerOverlegContextType');
          const ocid = this.popover.querySelector('#timeTrackerOverlegContextId');
          if (oct && oct.value) body.context_type = oct.value;
          if (ocid && ocid.value) body.context_id = ocid.value;
        }

        if (activity === 'sales') {
          const at = this.popover.querySelector('#timeTrackerActivityType');
          const ct = this.popover.querySelector('#timeTrackerContextType');
          const cid = this.popover.querySelector('#timeTrackerContextId');
          const activityType = at ? (at.value || '').trim() : '';
          if (!activityType) {
            if (typeof window.showNotification === 'function') {
              window.showNotification('Kies een activiteit type bij Sales', 'error');
            }
            return;
          }
          body.activity_type = activityType;
          if (ct && ct.value) body.context_type = ct.value;
          if (cid && cid.value) body.context_id = cid.value;
        }

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
          if (typeof window._broadcastTimerUpdated === 'function') window._broadcastTimerUpdated();
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
      const ticketId = (this.popover.querySelector('#timeTrackerSwitchTicketId').value || '').trim();
      const ticketTaskId = (this.popover.querySelector('#timeTrackerSwitchTicketTaskId').value || '').trim();

      if (!note) {
        if (typeof window.showNotification === 'function') {
          window.showNotification('Titel is verplicht', 'error');
        }
        return;
      }

      if (activity === 'support') {
        if (!ticketId) {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Selecteer eerst een ticket', 'error');
          }
          return;
        }
      }
      if (activity === 'klantenwerk') {
        if (!customerId || customerId.length === 0) {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Kies een klant bij Klantenwerk', 'error');
          }
          return;
        }
      }

      try {
        const body = {
          project_name: activity === 'klantenwerk' ? 'Klantenwerk' : (activity === 'support' ? 'Support' : (activity === 'overleg' ? 'Overleg' : (activity === 'operations' ? 'Operations' : activity))),
          note: note || null
        };
        if (taskId) body.task_id = taskId;
        if (customerId) body.customer_id = customerId;
        if (contactId) body.contact_id = contactId;
        if (activity === 'support' && ticketId) {
          body.ticket_id = ticketId;
          if (ticketTaskId) body.ticket_task_id = ticketTaskId;
        }
        if (activity === 'overleg') {
          const switchMeetingType = this.popover.querySelector('#timeTrackerSwitchMeetingType');
          body.meeting_type = (switchMeetingType && switchMeetingType.value) ? switchMeetingType.value : 'intern';
          body.participant_user_ids = this.switchOverlegParticipants.length ? this.switchOverlegParticipants.map((p) => p.id) : [];
          const soct = this.popover.querySelector('#timeTrackerSwitchOverlegContextType');
          const socid = this.popover.querySelector('#timeTrackerSwitchOverlegContextId');
          if (soct && soct.value) body.context_type = soct.value;
          if (socid && socid.value) body.context_id = socid.value;
        }
        if (activity === 'operations') {
          const swOpsCat = this.popover.querySelector('#timeTrackerSwitchOpsCategory');
          const swOpsArea = this.popover.querySelector('#timeTrackerSwitchOpsArea');
          const swOpsImpact = this.popover.querySelector('#timeTrackerSwitchOpsImpact');
          body.ops_category = (swOpsCat && swOpsCat.value) ? swOpsCat.value : 'algemeen';
          body.ops_area = (swOpsArea && swOpsArea.value) ? swOpsArea.value.trim() : null;
          body.ops_impact = (swOpsImpact && swOpsImpact.value) ? swOpsImpact.value : null;
          const sopct = this.popover.querySelector('#timeTrackerSwitchOperationsContextType');
          const sopcid = this.popover.querySelector('#timeTrackerSwitchOperationsContextId');
          if (sopct && sopct.value) body.context_type = sopct.value;
          if (sopcid && sopcid.value) body.context_id = sopcid.value;
        }

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
          if (typeof window._broadcastTimerUpdated === 'function') window._broadcastTimerUpdated();
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

    async handleUpdateDetails() {
      const activity = this.popover.querySelector('#timeTrackerSwitchActivity').value;
      const note = (this.popover.querySelector('#timeTrackerSwitchNote') && this.popover.querySelector('#timeTrackerSwitchNote').value) ? this.popover.querySelector('#timeTrackerSwitchNote').value.trim() : '';
      const taskId = this.popover.querySelector('#timeTrackerSwitchTaskId') && this.popover.querySelector('#timeTrackerSwitchTaskId').value;
      const customerId = this.popover.querySelector('#timeTrackerSwitchCustomerId') && this.popover.querySelector('#timeTrackerSwitchCustomerId').value;
      const contactId = this.popover.querySelector('#timeTrackerSwitchContactId') && this.popover.querySelector('#timeTrackerSwitchContactId').value;
      const btn = this.popover.querySelector('#timeTrackerUpdateDetails');
      if (btn) btn.disabled = true;
      try {
        const body = {
          project_name: activity === 'klantenwerk' ? 'Klantenwerk' : (activity === 'support' ? 'Support' : (activity === 'sales' ? 'Sales' : (activity === 'overleg' ? 'Overleg' : (activity === 'operations' ? 'Operations' : activity)))),
          note: note || null,
          task_id: taskId || null,
          customer_id: customerId || null,
          contact_id: contactId || null
        };
        if (activity === 'sales') {
          const rType = this.popover.querySelector('#timeTrackerRunningContextType');
          const rId = this.popover.querySelector('#timeTrackerRunningContextId');
          body.activity_type = this.currentEntry && this.currentEntry.activity_type ? this.currentEntry.activity_type : null;
          body.context_type = (rType && rType.value) ? rType.value : (this.currentEntry && this.currentEntry.context_type) || null;
          body.context_id = (rId && rId.value) ? rId.value : (this.currentEntry && this.currentEntry.context_id) || null;
        }
        if (activity === 'overleg') {
          const switchMeetingType = this.popover.querySelector('#timeTrackerSwitchMeetingType');
          body.meeting_type = (switchMeetingType && switchMeetingType.value) ? switchMeetingType.value : (this.currentEntry && this.currentEntry.meeting_type) || 'intern';
          body.participant_user_ids = this.switchOverlegParticipants.length ? this.switchOverlegParticipants.map((p) => p.id) : (this.currentEntry && this.currentEntry.participant_user_ids) || [];
          const soct = this.popover.querySelector('#timeTrackerSwitchOverlegContextType');
          const socid = this.popover.querySelector('#timeTrackerSwitchOverlegContextId');
          body.context_type = (soct && soct.value) ? soct.value : (this.currentEntry && this.currentEntry.context_type) || null;
          body.context_id = (socid && socid.value) ? socid.value : (this.currentEntry && this.currentEntry.context_id) || null;
        }
        if (activity === 'operations') {
          const swOpsCat = this.popover.querySelector('#timeTrackerSwitchOpsCategory');
          const swOpsArea = this.popover.querySelector('#timeTrackerSwitchOpsArea');
          const swOpsImpact = this.popover.querySelector('#timeTrackerSwitchOpsImpact');
          body.ops_category = (swOpsCat && swOpsCat.value) ? swOpsCat.value : (this.currentEntry && this.currentEntry.ops_category) || 'algemeen';
          body.ops_area = (swOpsArea && swOpsArea.value) ? swOpsArea.value.trim() : (this.currentEntry && this.currentEntry.ops_area) || null;
          body.ops_impact = (swOpsImpact && swOpsImpact.value) ? swOpsImpact.value : (this.currentEntry && this.currentEntry.ops_impact) || null;
          const sopct = this.popover.querySelector('#timeTrackerSwitchOperationsContextType');
          const sopcid = this.popover.querySelector('#timeTrackerSwitchOperationsContextId');
          body.context_type = (sopct && sopct.value) ? sopct.value : (this.currentEntry && this.currentEntry.context_type) || null;
          body.context_id = (sopcid && sopcid.value) ? sopcid.value : (this.currentEntry && this.currentEntry.context_id) || null;
        }
        const response = await fetch(`/api/employees/${this.userId}/time-entries/active-timer`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body)
        });
        const result = await response.json();
        if (result.ok) {
          this.currentEntry = result.data;
          this.updateUI();
          if (typeof window.showNotification === 'function') {
            window.showNotification('Opgeslagen', 'success');
          }
          if (typeof window._broadcastTimerUpdated === 'function') window._broadcastTimerUpdated();
        } else {
          throw new Error(result.error || 'Fout bij opslaan');
        }
      } catch (error) {
        if (typeof window.showNotification === 'function') {
          window.showNotification(error.message || 'Fout bij opslaan', 'error');
        }
      } finally {
        if (btn) btn.disabled = false;
      }
    }

    async handleStop() {
      const project = (this.currentEntry && this.currentEntry.project_name) ? this.currentEntry.project_name : '';
      const isSales = (project || '').toLowerCase() === 'sales';
      const hasContext = !!(this.currentEntry && (this.currentEntry.context_type || this.popover.querySelector('#timeTrackerRunningContextType').value));

      if (isSales && !hasContext) {
        const nudge = this.popover.querySelector('#timeTrackerSalesNudge');
        if (nudge) nudge.style.display = 'block';
        return;
      }
      this.doClockOut();
    }

    async doClockOut() {
      const activity = this.popover.querySelector('#timeTrackerSwitchActivity').value;
      const note = (this.popover.querySelector('#timeTrackerSwitchNote') && this.popover.querySelector('#timeTrackerSwitchNote').value) ? this.popover.querySelector('#timeTrackerSwitchNote').value.trim() : '';
      const taskId = this.popover.querySelector('#timeTrackerSwitchTaskId') && this.popover.querySelector('#timeTrackerSwitchTaskId').value;
      const customerId = this.popover.querySelector('#timeTrackerSwitchCustomerId') && this.popover.querySelector('#timeTrackerSwitchCustomerId').value;
      const contactId = this.popover.querySelector('#timeTrackerSwitchContactId') && this.popover.querySelector('#timeTrackerSwitchContactId').value;
      const body = {
        project_name: activity === 'klantenwerk' ? 'Klantenwerk' : (activity === 'support' ? 'Support' : (activity === 'sales' ? 'Sales' : (activity === 'overleg' ? 'Overleg' : (activity === 'operations' ? 'Operations' : activity)))),
        note: note || null,
        task_id: taskId || null,
        customer_id: customerId || null,
        contact_id: contactId || null
      };
      if ((activity === 'sales' || (this.currentEntry && (this.currentEntry.project_name || '').toLowerCase() === 'sales'))) {
        const rt = this.popover.querySelector('#timeTrackerRunningContextType');
        const rid = this.popover.querySelector('#timeTrackerRunningContextId');
        body.activity_type = this.currentEntry && this.currentEntry.activity_type ? this.currentEntry.activity_type : null;
        body.context_type = (rt && rt.value) ? rt.value : (this.currentEntry && this.currentEntry.context_type) || null;
        body.context_id = (rid && rid.value) ? rid.value : (this.currentEntry && this.currentEntry.context_id) || null;
      }
      if (activity === 'overleg' || (this.currentEntry && (this.currentEntry.project_name || '').toLowerCase() === 'overleg')) {
        const switchMeetingType = this.popover.querySelector('#timeTrackerSwitchMeetingType');
        body.meeting_type = (switchMeetingType && switchMeetingType.value) ? switchMeetingType.value : (this.currentEntry && this.currentEntry.meeting_type) || 'intern';
        body.participant_user_ids = this.switchOverlegParticipants.length ? this.switchOverlegParticipants.map((p) => p.id) : (this.currentEntry && this.currentEntry.participant_user_ids) || [];
        const soct = this.popover.querySelector('#timeTrackerSwitchOverlegContextType');
        const socid = this.popover.querySelector('#timeTrackerSwitchOverlegContextId');
        body.context_type = (soct && soct.value) ? soct.value : (this.currentEntry && this.currentEntry.context_type) || null;
        body.context_id = (socid && socid.value) ? socid.value : (this.currentEntry && this.currentEntry.context_id) || null;
      }
      if (activity === 'operations' || (this.currentEntry && (this.currentEntry.project_name || '').toLowerCase() === 'operations')) {
        const swOpsCat = this.popover.querySelector('#timeTrackerSwitchOpsCategory');
        const swOpsArea = this.popover.querySelector('#timeTrackerSwitchOpsArea');
        const swOpsImpact = this.popover.querySelector('#timeTrackerSwitchOpsImpact');
        body.ops_category = (swOpsCat && swOpsCat.value) ? swOpsCat.value : (this.currentEntry && this.currentEntry.ops_category) || 'algemeen';
        body.ops_area = (swOpsArea && swOpsArea.value) ? swOpsArea.value.trim() : (this.currentEntry && this.currentEntry.ops_area) || null;
        body.ops_impact = (swOpsImpact && swOpsImpact.value) ? swOpsImpact.value : (this.currentEntry && this.currentEntry.ops_impact) || null;
        const sopct = this.popover.querySelector('#timeTrackerSwitchOperationsContextType');
        const sopcid = this.popover.querySelector('#timeTrackerSwitchOperationsContextId');
        body.context_type = (sopct && sopct.value) ? sopct.value : (this.currentEntry && this.currentEntry.context_type) || null;
        body.context_id = (sopcid && sopcid.value) ? sopcid.value : (this.currentEntry && this.currentEntry.context_id) || null;
      }
      const errorEl = this.popover.querySelector('#timeTrackerClockOutError');
      if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
      }
      const nudge = this.popover.querySelector('#timeTrackerSalesNudge');
      if (nudge) nudge.style.display = 'none';
      const stopBtn = this.popover.querySelector('#timeTrackerStop');
      if (stopBtn) stopBtn.disabled = true;
      try {
        const response = await fetch(`/api/employees/${this.userId}/time-entries/clock-out`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body)
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
          if (typeof window._broadcastTimerUpdated === 'function') window._broadcastTimerUpdated();
        } else if (response.status === 400 && result.requires_completion) {
          if (errorEl) {
            errorEl.textContent = result.error || 'Vul eerst titel en klant/taak in om uit te klokken.';
            errorEl.style.display = 'block';
          }
          if (typeof window.showNotification === 'function') {
            window.showNotification(result.error || 'Vul verplichte velden in om uit te klokken.', 'error');
          }
        } else {
          throw new Error(result.error || 'Fout bij stoppen timer');
        }
      } catch (error) {
        console.error('[TimeTracker] Error stopping timer:', error);
        if (typeof window.showNotification === 'function') {
          window.showNotification(error.message || 'Fout bij stoppen timer', 'error');
        }
      } finally {
        if (stopBtn) stopBtn.disabled = false;
      }
    }

    showSalesContextField() {
      const nudge = this.popover.querySelector('#timeTrackerSalesNudge');
      const wrap = this.popover.querySelector('#timeTrackerRunningContextWrap');
      if (nudge) nudge.style.display = 'none';
      if (wrap) {
        wrap.style.display = 'block';
        const input = this.popover.querySelector('#timeTrackerRunningContextSearch');
        if (input) setTimeout(() => input.focus(), 50);
      }
    }

    handleContextSearch(query, mode) {
      if (this.contextSearchDebounceTimer) clearTimeout(this.contextSearchDebounceTimer);
      let dropdown, input;
      if (mode === 'running') {
        dropdown = this.popover.querySelector('#timeTrackerRunningContextDropdown');
        input = this.popover.querySelector('#timeTrackerRunningContextSearch');
      } else if (mode === 'overleg') {
        dropdown = this.popover.querySelector('#timeTrackerOverlegContextDropdown');
        input = this.popover.querySelector('#timeTrackerOverlegContextSearch');
      } else if (mode === 'operations') {
        dropdown = this.popover.querySelector('#timeTrackerOperationsContextDropdown');
        input = this.popover.querySelector('#timeTrackerOperationsContextSearch');
      } else if (mode === 'switch_overleg') {
        dropdown = this.popover.querySelector('#timeTrackerSwitchOverlegContextDropdown');
        input = this.popover.querySelector('#timeTrackerSwitchOverlegContextSearch');
      } else if (mode === 'switch_operations') {
        dropdown = this.popover.querySelector('#timeTrackerSwitchOperationsContextDropdown');
        input = this.popover.querySelector('#timeTrackerSwitchOperationsContextSearch');
      } else {
        dropdown = this.popover.querySelector('#timeTrackerContextDropdown');
        input = this.popover.querySelector('#timeTrackerContextSearch');
      }
      if (!dropdown || !input) return;
      const q = (query || '').trim();
      if (q.length < 2) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
        return;
      }
      const self = this;
      self.contextSearchDebounceTimer = setTimeout(async () => {
        try {
          const response = await fetch(`/api/time-entries/context-search?q=${encodeURIComponent(q)}`, { credentials: 'include' });
          const result = await response.json();
          if (result.ok && result.data) {
            self.renderContextDropdown(mode, result.data, dropdown, input);
            dropdown.style.display = 'block';
          } else {
            dropdown.innerHTML = '<div style="padding:12px;color:#6b7280;font-size:13px;">Geen resultaten</div>';
            dropdown.style.display = 'block';
          }
        } catch (e) {
          console.error('[TimeTracker] Context search:', e);
          dropdown.innerHTML = '<div style="padding:12px;color:#991b1b;font-size:13px;">Fout bij zoeken</div>';
          dropdown.style.display = 'block';
        }
      }, 350);
    }

    renderContextDropdown(mode, results, dropdown, inputEl) {
      const typeLabels = { deal: 'Deals', opportunity: 'Kansen', customer: 'Klanten', contact: 'Contactpersonen' };
      const byType = {};
      results.forEach((r) => {
        if (!byType[r.type]) byType[r.type] = [];
        byType[r.type].push(r);
      });
      const order = ['deal', 'opportunity', 'customer', 'contact'];
      let html = '';
      order.forEach((type) => {
        const list = byType[type] || [];
        if (list.length === 0) return;
        html += '<div style="padding:6px 10px 4px;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;">' + (typeLabels[type] || type) + '</div>';
        list.forEach((item) => {
          const title = (item.title || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
          const subtitle = (item.subtitle || '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
          const avatar = item.avatarUrl
            ? '<img src="' + item.avatarUrl.replace(/"/g, '&quot;') + '" alt="" width="24" height="24" style="border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display=\'none\'">'
            : '<span style="width:24px;height:24px;border-radius:50%;background:#e5e7eb;color:#6b7280;font-size:11px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">' + (type === 'deal' ? 'D' : type === 'opportunity' ? 'K' : type === 'customer' ? 'B' : 'C') + '</span>';
          html += '<div class="time-tracker-context-option" style="padding:8px 10px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f3f4f6;" data-type="' + (item.type || '') + '" data-id="' + (item.id || '') + '" data-title="' + title + '" onmouseover="this.style.background=\'#f9fafb\'" onmouseout="this.style.background=\'white\'">' +
            avatar +
            '<div style="min-width:0;"><div style="font-size:14px;font-weight:500;color:#111827;">' + title + '</div>' +
            (subtitle ? '<div style="font-size:12px;color:#6b7280;margin-top:2px;">' + subtitle + '</div>' : '') + '</div></div>';
        });
      });
      dropdown.innerHTML = html || '<div style="padding:12px;color:#6b7280;font-size:13px;">Geen resultaten</div>';
      dropdown.querySelectorAll('.time-tracker-context-option').forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          const type = el.getAttribute('data-type');
          const id = el.getAttribute('data-id');
          const title = el.getAttribute('data-title');
          if (mode === 'form') {
            this.popover.querySelector('#timeTrackerContextType').value = type || '';
            this.popover.querySelector('#timeTrackerContextId').value = id || '';
            this.popover.querySelector('#timeTrackerContextSearch').value = title || '';
            this.popover.querySelector('#timeTrackerContextClear').style.display = (id ? 'block' : 'none');
          } else if (mode === 'overleg') {
            this.popover.querySelector('#timeTrackerOverlegContextType').value = type || '';
            this.popover.querySelector('#timeTrackerOverlegContextId').value = id || '';
            this.popover.querySelector('#timeTrackerOverlegContextSearch').value = title || '';
            this.popover.querySelector('#timeTrackerOverlegContextClear').style.display = (id ? 'block' : 'none');
          } else if (mode === 'operations') {
            this.popover.querySelector('#timeTrackerOperationsContextType').value = type || '';
            this.popover.querySelector('#timeTrackerOperationsContextId').value = id || '';
            this.popover.querySelector('#timeTrackerOperationsContextSearch').value = title || '';
            this.popover.querySelector('#timeTrackerOperationsContextClear').style.display = (id ? 'block' : 'none');
          } else if (mode === 'switch_overleg') {
            this.popover.querySelector('#timeTrackerSwitchOverlegContextType').value = type || '';
            this.popover.querySelector('#timeTrackerSwitchOverlegContextId').value = id || '';
            this.popover.querySelector('#timeTrackerSwitchOverlegContextSearch').value = title || '';
            this.popover.querySelector('#timeTrackerSwitchOverlegContextClear').style.display = (id ? 'block' : 'none');
          } else if (mode === 'switch_operations') {
            this.popover.querySelector('#timeTrackerSwitchOperationsContextType').value = type || '';
            this.popover.querySelector('#timeTrackerSwitchOperationsContextId').value = id || '';
            this.popover.querySelector('#timeTrackerSwitchOperationsContextSearch').value = title || '';
            this.popover.querySelector('#timeTrackerSwitchOperationsContextClear').style.display = (id ? 'block' : 'none');
          } else {
            this.popover.querySelector('#timeTrackerRunningContextType').value = type || '';
            this.popover.querySelector('#timeTrackerRunningContextId').value = id || '';
            this.popover.querySelector('#timeTrackerRunningContextSearch').value = title || '';
            this.popover.querySelector('#timeTrackerRunningContextClear').style.display = (id ? 'block' : 'none');
            dropdown.style.display = 'none';
            this.updateActiveTimerContext(type, id);
          }
          dropdown.style.display = 'none';
        });
      });
    }

    async updateActiveTimerContext(contextType, contextId) {
      if (!this.currentEntry || !contextType || !contextId) return;
      try {
        const body = {
          context_type: contextType,
          context_id: contextId,
          note: this.currentEntry.note || this.popover.querySelector('#timeTrackerSwitchNote').value,
          project_name: this.currentEntry.project_name,
          task_id: this.currentEntry.task_id || null,
          customer_id: this.currentEntry.customer_id || null,
          contact_id: this.currentEntry.contact_id || null
        };
        const response = await fetch(`/api/employees/${this.userId}/time-entries/active-timer`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body)
        });
        const result = await response.json();
        if (result.ok) {
          this.currentEntry = result.data;
          if (typeof window._broadcastTimerUpdated === 'function') window._broadcastTimerUpdated();
        }
      } catch (e) {
        console.error('[TimeTracker] Update context:', e);
      }
    }

    clearContextSelection(mode) {
      if (mode === 'form') {
        this.popover.querySelector('#timeTrackerContextType').value = '';
        this.popover.querySelector('#timeTrackerContextId').value = '';
        this.popover.querySelector('#timeTrackerContextSearch').value = '';
        this.popover.querySelector('#timeTrackerContextClear').style.display = 'none';
      } else if (mode === 'overleg') {
        const ot = this.popover.querySelector('#timeTrackerOverlegContextType');
        const oid = this.popover.querySelector('#timeTrackerOverlegContextId');
        const os = this.popover.querySelector('#timeTrackerOverlegContextSearch');
        const oc = this.popover.querySelector('#timeTrackerOverlegContextClear');
        if (ot) ot.value = '';
        if (oid) oid.value = '';
        if (os) os.value = '';
        if (oc) oc.style.display = 'none';
      } else if (mode === 'operations') {
        const octx = this.popover.querySelector('#timeTrackerOperationsContextType');
        const ocid = this.popover.querySelector('#timeTrackerOperationsContextId');
        const ocs = this.popover.querySelector('#timeTrackerOperationsContextSearch');
        const occ = this.popover.querySelector('#timeTrackerOperationsContextClear');
        if (octx) octx.value = '';
        if (ocid) ocid.value = '';
        if (ocs) ocs.value = '';
        if (occ) occ.style.display = 'none';
      } else if (mode === 'switch_overleg') {
        const sot = this.popover.querySelector('#timeTrackerSwitchOverlegContextType');
        const soid = this.popover.querySelector('#timeTrackerSwitchOverlegContextId');
        const sos = this.popover.querySelector('#timeTrackerSwitchOverlegContextSearch');
        const soc = this.popover.querySelector('#timeTrackerSwitchOverlegContextClear');
        if (sot) sot.value = '';
        if (soid) soid.value = '';
        if (sos) sos.value = '';
        if (soc) soc.style.display = 'none';
      } else if (mode === 'switch_operations') {
        const sopct = this.popover.querySelector('#timeTrackerSwitchOperationsContextType');
        const sopcid = this.popover.querySelector('#timeTrackerSwitchOperationsContextId');
        const sops = this.popover.querySelector('#timeTrackerSwitchOperationsContextSearch');
        const sopc = this.popover.querySelector('#timeTrackerSwitchOperationsContextClear');
        if (sopct) sopct.value = '';
        if (sopcid) sopcid.value = '';
        if (sops) sops.value = '';
        if (sopc) sopc.style.display = 'none';
      } else {
        this.popover.querySelector('#timeTrackerRunningContextType').value = '';
        this.popover.querySelector('#timeTrackerRunningContextId').value = '';
        this.popover.querySelector('#timeTrackerRunningContextSearch').value = '';
        this.popover.querySelector('#timeTrackerRunningContextClear').style.display = 'none';
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

  const TIMER_CHANNEL_NAME = 'gs-time-tracker';
  function broadcastTimerUpdated() {
    try {
      const ch = new BroadcastChannel(TIMER_CHANNEL_NAME);
      ch.postMessage({ type: 'timer_updated' });
      ch.close();
    } catch (e) {}
  }
  window._broadcastTimerUpdated = broadcastTimerUpdated;

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

    const tracker = new TimeTracker(userId);
    window.timeTracker = tracker;
    try {
      const ch = new BroadcastChannel(TIMER_CHANNEL_NAME);
      ch.onmessage = function (msg) {
        if (msg.data && msg.data.type === 'timer_updated' && window.timeTracker && window.timeTracker.loadCurrentEntry) {
          window.timeTracker.loadCurrentEntry();
        }
      };
    } catch (e) {}
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && window.timeTracker && window.timeTracker.loadCurrentEntry) {
        window.timeTracker.loadCurrentEntry();
      }
    });
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
