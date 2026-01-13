// Admin Calendar - Modern Google Calendar-like functionality
(function() {
  'use strict';

  // Calendar state
  let currentDate = new Date();
  let currentView = 'month'; // 'month', 'week', 'day'
  let events = []; // Will be loaded from API
  let filteredCategories = ['meeting', 'call', 'appointment', 'task'];

  // DOM elements
  const elements = {
    // Navigation
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    todayBtn: document.getElementById('todayBtn'),
    currentMonth: document.getElementById('currentMonth'),
    
    // Views
    viewSelectorBtns: document.querySelectorAll('.view-selector-btn'),
    
    // Calendar grid
    calendarGrid: document.getElementById('calendarGrid'),
    
    // Events
    newEventBtn: document.getElementById('newEventBtn'),
    agendaList: document.getElementById('agendaList'),
    
    // Modal
    eventModal: document.getElementById('eventModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    eventForm: document.getElementById('eventForm'),
    saveEventBtn: document.getElementById('saveEventBtn'),
    deleteEventBtn: document.getElementById('deleteEventBtn'),
    modalTitle: document.getElementById('modalTitle'),
    
    // Form fields
    eventId: document.getElementById('eventId'),
    eventTitle: document.getElementById('eventTitle'),
    eventDescription: document.getElementById('eventDescription'),
    eventStartDate: document.getElementById('eventStartDate'),
    eventStartTime: document.getElementById('eventStartTime'),
    eventEndDate: document.getElementById('eventEndDate'),
    eventEndTime: document.getElementById('eventEndTime'),
    eventDuration: document.getElementById('eventDuration'),
    eventCategory: document.getElementById('eventCategory'),
    eventClient: document.getElementById('eventClient'),
    eventCustomerId: document.getElementById('eventCustomerId'),
    customerSearchResults: document.getElementById('customerSearchResults'),
    eventLocation: document.getElementById('eventLocation'),
    eventPhone: document.getElementById('eventPhone'),
    eventPriority: document.getElementById('eventPriority'),
    eventAtOffice: document.getElementById('eventAtOffice'),
    eventMeetLink: document.getElementById('eventMeetLink'),
    createMeetLinkBtn: document.getElementById('createMeetLinkBtn'),
    
    // Recurrence
    eventIsRecurring: document.getElementById('eventIsRecurring'),
    recurrenceOptions: document.getElementById('recurrenceOptions'),
    eventRecurrenceFrequency: document.getElementById('eventRecurrenceFrequency'),
    eventRecurrenceInterval: document.getElementById('eventRecurrenceInterval'),
    weeklyDaysGroup: document.getElementById('weeklyDaysGroup'),
    eventRecurrenceEndType: document.getElementById('eventRecurrenceEndType'),
    recurrenceEndDateGroup: document.getElementById('recurrenceEndDateGroup'),
    recurrenceEndCountGroup: document.getElementById('recurrenceEndCountGroup'),
    eventRecurrenceEndDate: document.getElementById('eventRecurrenceEndDate'),
    eventRecurrenceCount: document.getElementById('eventRecurrenceCount'),
    
    // Reminders
    reminderEmployees: document.getElementById('reminderEmployees'),
    reminderToSelf: document.getElementById('reminderToSelf'),
    reminderEmployeesContainer: document.getElementById('reminderEmployeesContainer'),
    reminderEmployeesMultiSelect: document.getElementById('reminderEmployeesMultiSelect'),
    reminderEmployeesTrigger: document.getElementById('reminderEmployeesTrigger'),
    reminderEmployeesDropdown: document.getElementById('reminderEmployeesDropdown'),
    reminderEmployeesSearch: document.getElementById('reminderEmployeesSearch'),
    reminderEmployeesItems: document.getElementById('reminderEmployeesItems'),
    selectedReminderEmployeesList: document.getElementById('selectedReminderEmployeesList'),
    
    // Customers and Contacts (Association Selects)
    eventContactSelectTrigger: document.getElementById('eventContactSelectTrigger'),
    eventContactSelectDropdown: document.getElementById('eventContactSelectDropdown'),
    eventContactSelectSearch: document.getElementById('eventContactSelectSearch'),
    eventContactSelectItems: document.getElementById('eventContactSelectItems'),
    eventContactSelectValue: document.getElementById('eventContactSelectValue'),
    eventContactId: document.getElementById('eventContactId'),
    eventCustomerSelectTrigger: document.getElementById('eventCustomerSelectTrigger'),
    eventCustomerSelectDropdown: document.getElementById('eventCustomerSelectDropdown'),
    eventCustomerSelectSearch: document.getElementById('eventCustomerSelectSearch'),
    eventCustomerSelectItems: document.getElementById('eventCustomerSelectItems'),
    eventCustomerSelectValue: document.getElementById('eventCustomerSelectValue'),
    eventCustomerId: document.getElementById('eventCustomerId'),
    
    // Task specific
    taskRelationCustomer: document.getElementById('taskRelationCustomer'),
    taskRelationContact: document.getElementById('taskRelationContact'),
    taskCustomerContainer: document.getElementById('taskCustomerContainer'),
    taskContactContainer: document.getElementById('taskContactContainer'),
    taskCustomerSearch: document.getElementById('taskCustomerSearch'),
    taskContactSearch: document.getElementById('taskContactSearch'),
    taskCustomerId: document.getElementById('taskCustomerId'),
    taskContactId: document.getElementById('taskContactId'),
    taskCustomerSearchResults: document.getElementById('taskCustomerSearchResults'),
    taskContactSearchResults: document.getElementById('taskContactSearchResults'),
    
    // Filters
    filterCheckboxes: document.querySelectorAll('.filter-item input[type="checkbox"]'),
    
    // Search
    searchInput: document.getElementById('searchInput'),
    
    // Agenda selector
    agendaSelector: document.getElementById('agendaSelector'),
    agendaSelectorContainer: document.getElementById('agendaSelectorContainer')
  };
  
  // Store employees data from server
  var employeesData = [];
  var allEmployeesData = [];
  var userCustomerData = null;
  var currentUserId = null;
  var canViewAll = false;
  
  // Current selected agenda (null = all, 'main' = main agenda, userId = specific employee)
  var selectedAgendaId = null;
  
  // Default colors for employees (can be customized later)
  var employeeColors = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#f97316', // Orange
    '#6366f1'  // Indigo
  ];
  
  // Map of employee ID to color
  var employeeColorMap = {};

  // Initialize
  function init() {
    if (!elements.calendarGrid) return;
    
    // Load server data
    if (typeof window.calendarEmployeesData !== 'undefined') {
      employeesData = window.calendarEmployeesData;
    }
    if (typeof window.calendarAllEmployees !== 'undefined') {
      allEmployeesData = window.calendarAllEmployees;
      // Initialize color map for employees
      allEmployeesData.forEach(function(emp, index) {
        employeeColorMap[emp.id] = employeeColors[index % employeeColors.length];
      });
    }
    if (typeof window.calendarUserCustomer !== 'undefined') {
      userCustomerData = window.calendarUserCustomer;
    }
    if (typeof window.calendarCanViewAll !== 'undefined') {
      canViewAll = window.calendarCanViewAll;
    }
    if (typeof window.calendarCurrentUserId !== 'undefined') {
      currentUserId = window.calendarCurrentUserId;
    }
    
    setupEventListeners();
    initAgendaSelector();
    loadEvents();
    renderCalendar();
    updateAgendaView();
    initReminderEmployees();
  }

  // Setup event listeners
  function setupEventListeners() {
    // Navigation
    if (elements.prevBtn) {
      elements.prevBtn.addEventListener('click', () => navigate(-1));
    }
    if (elements.nextBtn) {
      elements.nextBtn.addEventListener('click', () => navigate(1));
    }
    if (elements.todayBtn) {
      elements.todayBtn.addEventListener('click', goToToday);
    }
    
    // View selector
    elements.viewSelectorBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const view = btn.dataset.view;
        switchView(view);
      });
    });
    
    
    // New event dropdown
    if (elements.newEventBtn) {
      elements.newEventBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const menu = document.getElementById('newEventMenu');
        if (menu) {
          menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
      });
    }
    
    // New event menu items
    const newEventMenuItems = document.querySelectorAll('.new-event-menu-item');
    newEventMenuItems.forEach(function(item) {
      item.addEventListener('click', function() {
        const category = this.getAttribute('data-category');
        openNewEventModal(null, category);
        // Close menu
        const menu = document.getElementById('newEventMenu');
        if (menu) {
          menu.style.display = 'none';
        }
      });
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      const dropdown = document.querySelector('.new-event-dropdown');
      const menu = document.getElementById('newEventMenu');
      if (dropdown && menu && !dropdown.contains(e.target)) {
        menu.style.display = 'none';
      }
    });
    
    // Agenda selector change
    if (elements.agendaSelector) {
      elements.agendaSelector.addEventListener('change', function() {
        selectedAgendaId = this.value === 'all' ? null : (this.value === 'main' ? 'main' : this.value);
        loadEvents();
        renderCalendar();
        updateAgendaView();
      });
    }
    
    // Modal
    if (elements.closeModalBtn) {
      elements.closeModalBtn.addEventListener('click', closeModal);
    }
    if (elements.cancelBtn) {
      elements.cancelBtn.addEventListener('click', closeModal);
    }
    if (elements.eventModal) {
      elements.eventModal.addEventListener('click', function(e) {
        if (e.target === elements.eventModal) {
          closeModal();
        }
      });
    }
    
    // Form submit
    if (elements.eventForm) {
      elements.eventForm.addEventListener('submit', handleSaveEvent);
    }
    
    // Category change handler
    if (elements.eventCategory) {
      elements.eventCategory.addEventListener('change', handleCategoryChange);
      // Initialize on load
      handleCategoryChange();
    }
    
    // Meeting type switcher
    const meetingTypeBtns = document.querySelectorAll('.meeting-type-btn');
    meetingTypeBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        const type = btn.getAttribute('data-type');
        handleMeetingTypeChange(type);
      });
    });
    
    // Office checkbox handler
    if (elements.eventAtOffice) {
      elements.eventAtOffice.addEventListener('change', function() {
        if (this.checked) {
          if (elements.eventLocation) {
            elements.eventLocation.style.display = 'none';
            elements.eventLocation.value = 'Op kantoor';
          }
        } else {
          if (elements.eventLocation) {
            elements.eventLocation.style.display = 'block';
            elements.eventLocation.value = '';
            // Re-initialize autocomplete when field becomes visible
            if (elements.eventLocation.dataset.autocompleteInitialized === 'true') {
              elements.eventLocation.dataset.autocompleteInitialized = 'false';
              setTimeout(function() {
                initCalendarAddressAutocomplete();
              }, 100);
            }
          }
        }
      });
    }
    
    // Create Google Meet link button
    if (elements.createMeetLinkBtn) {
      elements.createMeetLinkBtn.addEventListener('click', function() {
        // Generate a Google Meet link
        // Format: https://meet.google.com/xxx-xxxx-xxx (11 characters, alphanumeric)
        function generateMeetCode() {
          const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
          let code = '';
          for (let i = 0; i < 3; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          code += '-';
          for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          code += '-';
          for (let i = 0; i < 3; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return code;
        }
        
        if (elements.eventMeetLink) {
          elements.eventMeetLink.value = 'https://meet.google.com/' + generateMeetCode();
        }
      });
    }
    
    // Customer search functionality
    var customerSearchTimeout = null;
    if (elements.eventClient) {
      elements.eventClient.addEventListener('input', function() {
        const query = this.value.trim();
        
        // Clear previous timeout
        if (customerSearchTimeout) {
          clearTimeout(customerSearchTimeout);
        }
        
        // Clear results if query is too short
        if (query.length < 2) {
          if (elements.customerSearchResults) {
            elements.customerSearchResults.style.display = 'none';
          }
          if (elements.eventCustomerId) {
            elements.eventCustomerId.value = '';
          }
          return;
        }
        
        // Set new timeout for search
        customerSearchTimeout = setTimeout(function() {
          fetch('/admin/api/customers/search?q=' + encodeURIComponent(query))
            .then(function(response) {
              return response.json();
            })
            .then(function(data) {
              if (data.success && data.customers && data.customers.length > 0) {
                if (elements.customerSearchResults) {
                  elements.customerSearchResults.innerHTML = data.customers.map(function(customer) {
                    return '<div class="customer-result-item" data-id="' + customer.id + '" data-name="' + 
                      (customer.company_name || customer.name || '') + '">' +
                      '<div class="customer-name">' + (customer.company_name || customer.name || 'Onbekend') + '</div>' +
                      (customer.email ? '<div class="customer-email">' + customer.email + '</div>' : '') +
                      '</div>';
                  }).join('');
                  elements.customerSearchResults.style.display = 'block';
                }
              } else {
                if (elements.customerSearchResults) {
                  elements.customerSearchResults.innerHTML = '<div class="customer-result-item">Geen resultaten gevonden</div>';
                  elements.customerSearchResults.style.display = 'block';
                }
              }
            })
            .catch(function(error) {
              console.error('Error searching customers:', error);
              if (elements.customerSearchResults) {
                elements.customerSearchResults.style.display = 'none';
              }
            });
        }, 300); // 300ms debounce
      });
      
      // Handle customer selection
      if (elements.customerSearchResults) {
        elements.customerSearchResults.addEventListener('click', function(e) {
          const resultItem = e.target.closest('.customer-result-item');
          if (resultItem) {
            const customerId = resultItem.getAttribute('data-id');
            const customerName = resultItem.getAttribute('data-name');
            
            if (elements.eventCustomerId) {
              elements.eventCustomerId.value = customerId;
            }
            if (elements.eventClient) {
              elements.eventClient.value = customerName;
            }
            if (elements.customerSearchResults) {
              elements.customerSearchResults.style.display = 'none';
            }
          }
        });
      }
      
      // Close results when clicking outside
      document.addEventListener('click', function(e) {
        if (elements.eventClient && elements.customerSearchResults) {
          if (!elements.eventClient.contains(e.target) && !elements.customerSearchResults.contains(e.target)) {
            elements.customerSearchResults.style.display = 'none';
          }
        }
      });
    }
    
    // Duration change handler - calculate end time
    if (elements.eventDuration && elements.eventStartDate && elements.eventStartTime) {
      elements.eventDuration.addEventListener('change', calculateEndTime);
      elements.eventStartDate.addEventListener('change', calculateEndTime);
      elements.eventStartTime.addEventListener('change', calculateEndTime);
    }
    
    // Delete event
    if (elements.deleteEventBtn) {
      elements.deleteEventBtn.addEventListener('click', handleDeleteEvent);
    }
    
    // Filters
    elements.filterCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', handleFilterChange);
    });
    
    // Search
    if (elements.searchInput) {
      elements.searchInput.addEventListener('input', handleSearch);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && elements.eventModal && elements.eventModal.classList.contains('show')) {
        closeModal();
      }
    });
  }

  // Navigation
  function navigate(direction) {
    if (currentView === 'month') {
      currentDate.setMonth(currentDate.getMonth() + direction);
    } else if (currentView === 'week') {
      currentDate.setDate(currentDate.getDate() + (direction * 7));
    } else if (currentView === 'day') {
      currentDate.setDate(currentDate.getDate() + direction);
    }
    renderCalendar();
  }

  function goToToday() {
    currentDate = new Date();
    renderCalendar();
  }


  // Switch view
  function switchView(view) {
    currentView = view;
    elements.viewSelectorBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    renderCalendar();
  }


  // Render main calendar
  function renderCalendar() {
    if (!elements.calendarGrid) return;
    
    // Update month/year display
    if (elements.currentMonth) {
      const monthNames = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
        'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
      elements.currentMonth.textContent = 
        monthNames[currentDate.getMonth()] + ' ' + currentDate.getFullYear();
    }
    
    if (currentView === 'month') {
      renderMonthView();
    } else if (currentView === 'week') {
      renderWeekView();
    } else if (currentView === 'day') {
      renderDayView();
    }
  }

  // Render month view
  function renderMonthView() {
    elements.calendarGrid.className = 'calendar-grid';
    elements.calendarGrid.innerHTML = '';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay() + 1); // Monday
    
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (7 - endDate.getDay())); // Sunday
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let currentDay = new Date(startDate);
    
    while (currentDay <= endDate) {
      const dayElement = document.createElement('div');
      const dayDate = new Date(currentDay);
      const isOtherMonth = dayDate.getMonth() !== month;
      const isToday = dayDate.getTime() === today.getTime();
      
      dayElement.className = 'calendar-day';
      if (isOtherMonth) {
        dayElement.classList.add('other-month');
      }
      if (isToday) {
        dayElement.classList.add('today');
      }
      
      // Day number container
      const dayNumberContainer = document.createElement('div');
      dayNumberContainer.className = 'day-number-container';
      
      const dayNumber = document.createElement('span');
      dayNumber.className = 'day-number';
      dayNumber.textContent = dayDate.getDate();
      dayNumberContainer.appendChild(dayNumber);
      
      dayElement.appendChild(dayNumberContainer);
      
      // Events for this day
      const dayEvents = getEventsForDay(dayDate);
      if (dayEvents.length > 0) {
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'day-events';
        
        dayEvents.slice(0, 3).forEach(function(event) {
          const eventElement = document.createElement('div');
          eventElement.className = 'day-event category-' + event.category;
          
          // Use creator color if available (for totaal view), otherwise use category color
          if (event.creator_color && selectedAgendaId === null) {
            eventElement.style.backgroundColor = event.creator_color;
            eventElement.style.color = '#ffffff';
            eventElement.style.borderLeft = '3px solid ' + event.creator_color;
          }
          
          const eventTime = event.start_time || event.start;
          var eventText = formatTime(eventTime) + ' ' + event.title;
          
          // In totaal view, show creator name
          if (selectedAgendaId === null && event.creator_name) {
            eventText = event.creator_name + ': ' + eventText;
          }
          
          eventElement.textContent = eventText;
          eventElement.addEventListener('click', function() {
            openEditEventModal(event);
          });
          eventsContainer.appendChild(eventElement);
        });
        
        if (dayEvents.length > 3) {
          const moreElement = document.createElement('div');
          moreElement.className = 'day-event';
          moreElement.style.background = '#6b7280';
          moreElement.textContent = '+' + (dayEvents.length - 3) + ' meer';
          eventsContainer.appendChild(moreElement);
        }
        
        dayElement.appendChild(eventsContainer);
      }
      
      // Click to add event
      dayElement.addEventListener('click', function(e) {
        if (!e.target.classList.contains('day-event')) {
          openNewEventModal(dayDate, 'appointment');
        }
      });
      
      elements.calendarGrid.appendChild(dayElement);
      
      currentDay.setDate(currentDay.getDate() + 1);
    }
  }

  // Render week view
  function renderWeekView() {
    elements.calendarGrid.className = 'calendar-grid week-view';
    elements.calendarGrid.innerHTML = '';
    
    // Time column
    const timeColumn = document.createElement('div');
    timeColumn.className = 'week-time-column';
    
    for (let hour = 0; hour < 24; hour++) {
      const timeSlot = document.createElement('div');
      timeSlot.className = 'week-time-slot';
      timeSlot.textContent = String(hour).padStart(2, '0') + ':00';
      timeColumn.appendChild(timeSlot);
    }
    
    elements.calendarGrid.appendChild(timeColumn);
    
    // Day columns
    const weekStart = getWeekStart(currentDate);
    
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + i);
      
      const dayColumn = document.createElement('div');
      dayColumn.className = 'week-day-column';
      
      // Header
      const header = document.createElement('div');
      header.className = 'week-day-header';
      const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
      header.innerHTML = `
        <div class="week-day-name">${dayNames[i]}</div>
        <div class="week-day-number">${dayDate.getDate()}</div>
      `;
      dayColumn.appendChild(header);
      
      // Time slots
      const slotsContainer = document.createElement('div');
      slotsContainer.className = 'week-time-slot-content';
      
      for (let hour = 0; hour < 24; hour++) {
        const slot = document.createElement('div');
        slot.className = 'week-time-slot';
        slot.style.height = '60px';
        slot.style.position = 'relative';
        
        // Events in this hour
        const hourEvents = getEventsForHour(dayDate, hour);
        hourEvents.forEach(function(event) {
          const eventElement = document.createElement('div');
          eventElement.className = 'week-event category-' + event.category;
          
          // Use creator color if available (for totaal view), otherwise use category color
          if (event.creator_color && selectedAgendaId === null) {
            eventElement.style.backgroundColor = event.creator_color;
            eventElement.style.color = '#ffffff';
            eventElement.style.borderLeft = '3px solid ' + event.creator_color;
          }
          
          const start = new Date(event.start_time || event.start);
          const end = new Date(event.end_time || event.end);
          const startMinutes = start.getHours() * 60 + start.getMinutes();
          const endMinutes = end.getHours() * 60 + end.getMinutes();
          const duration = endMinutes - startMinutes;
          const top = (startMinutes % 60) / 60 * 60;
          
          eventElement.style.top = top + 'px';
          eventElement.style.height = duration + 'px';
          
          var eventText = event.title;
          // In totaal view, show creator name
          if (selectedAgendaId === null && event.creator_name) {
            eventText = event.creator_name + ': ' + eventText;
          }
          
          eventElement.textContent = eventText;
          eventElement.addEventListener('click', function() {
            openEditEventModal(event);
          });
          slot.appendChild(eventElement);
        });
        
        slot.addEventListener('click', () => {
          const clickDate = new Date(dayDate);
          clickDate.setHours(hour, 0, 0, 0);
          openNewEventModal(clickDate, 'appointment');
        });
        
        slotsContainer.appendChild(slot);
      }
      
      dayColumn.appendChild(slotsContainer);
      elements.calendarGrid.appendChild(dayColumn);
    }
  }

  // Render day view
  function renderDayView() {
    elements.calendarGrid.className = 'calendar-grid day-view';
    elements.calendarGrid.innerHTML = '';
    
    // Similar to week view but only one day column
    // Implementation similar to week view
    renderWeekView(); // For now, use week view logic
  }


  // Get events for a specific day
  function getEventsForDay(date) {
    const searchTerm = elements.searchInput ? elements.searchInput.value.toLowerCase() : '';
    
    return events.filter(function(event) {
      const eventDate = new Date(event.start_time || event.start);
      const isSameDay = eventDate.toDateString() === date.toDateString();
      
      // Category filter
      const matchesCategoryFilter = filteredCategories.includes(event.category);
      
      const matchesSearch = !searchTerm || 
        event.title.toLowerCase().includes(searchTerm) ||
        (event.description && event.description.toLowerCase().includes(searchTerm));
      
      return isSameDay && matchesCategoryFilter && matchesSearch;
    });
  }

  // Get events for a specific hour
  function getEventsForHour(date, hour) {
    return events.filter(function(event) {
      const eventStart = new Date(event.start_time || event.start);
      const eventEnd = new Date(event.end_time || event.end);
      const dayStart = new Date(date);
      dayStart.setHours(hour, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(hour + 1, 0, 0, 0);
      
      // Category filter
      const matchesCategoryFilter = filteredCategories.includes(event.category);
      
      return eventStart < dayEnd && eventEnd > dayStart && matchesCategoryFilter;
    });
  }


  // Update agenda view
  function updateAgendaView() {
    if (!elements.agendaList) return;
    
    const filtered = events.filter(function(e) {
      return filteredCategories.includes(e.category);
    });
    const grouped = groupEventsByDate(filtered);
    
    elements.agendaList.innerHTML = '';
    
    if (Object.keys(grouped).length === 0) {
      elements.agendaList.innerHTML = '<p style="color: #6b7280; font-size: 13px; text-align: center; padding: 20px;">Geen afspraken</p>';
      return;
    }
    
    Object.keys(grouped).sort().forEach(function(date) {
      const group = document.createElement('div');
      group.className = 'agenda-date-group';
      
      const header = document.createElement('div');
      header.className = 'agenda-date-header';
      header.textContent = formatDateHeader(date);
      group.appendChild(header);
      
      grouped[date].forEach(function(event) {
        const item = document.createElement('div');
        item.className = 'agenda-event-item category-' + event.category;
        const eventTime = event.start_time || event.start;
        item.innerHTML = '<div class="agenda-event-time">' + formatTime(eventTime) + '</div>' +
          '<div class="agenda-event-title">' + event.title + '</div>';
        item.addEventListener('click', function() {
          openEditEventModal(event);
        });
        group.appendChild(item);
      });
      
      elements.agendaList.appendChild(group);
    });
  }

  // Group events by date
  function groupEventsByDate(eventsList) {
    const grouped = {};
    eventsList.forEach(function(event) {
      const eventTime = event.start_time || event.start;
      const date = new Date(eventTime).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(event);
    });
    return grouped;
  }

  // Handle category change
  function handleCategoryChange() {
    const category = elements.eventCategory ? elements.eventCategory.value : 'meeting';
    const categoryFields = document.querySelectorAll('.category-field');
    
    categoryFields.forEach(function(field) {
      const fieldCategories = field.getAttribute('data-category');
      if (fieldCategories) {
        const categories = fieldCategories.split(',').map(function(c) {
          return c.trim();
        });
        if (categories.indexOf(category) !== -1) {
          field.style.display = 'block';
        } else {
          field.style.display = 'none';
        }
      }
    });
    
    // Reset meeting type if category doesn't support it
    if (category !== 'meeting' && category !== 'appointment') {
      const locationTypeFields = document.querySelectorAll('.location-type-field');
      locationTypeFields.forEach(function(field) {
        field.style.display = 'none';
      });
      const meetingTypeGroup = document.getElementById('meetingTypeGroup');
      if (meetingTypeGroup) {
        meetingTypeGroup.style.display = 'none';
      }
    } else {
      // Show meeting type switcher and initialize to physical
      const meetingTypeGroup = document.getElementById('meetingTypeGroup');
      if (meetingTypeGroup) {
        meetingTypeGroup.style.display = 'block';
      }
      // Set default to physical if not already set
      const activeBtn = document.querySelector('.meeting-type-btn.active');
      if (!activeBtn) {
        handleMeetingTypeChange('physical');
      }
    }
  }
  
  // Handle meeting type change (Physical/Online)
  function handleMeetingTypeChange(type) {
    // Update button states
    const meetingTypeBtns = document.querySelectorAll('.meeting-type-btn');
    meetingTypeBtns.forEach(function(btn) {
      if (btn.getAttribute('data-type') === type) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // Show/hide location fields
    const locationTypeFields = document.querySelectorAll('.location-type-field');
    locationTypeFields.forEach(function(field) {
      const fieldType = field.getAttribute('data-location-type');
      if (fieldType === type) {
        field.style.display = 'block';
      } else {
        field.style.display = 'none';
      }
    });
    
    // Reset values when switching
    if (type === 'physical') {
      if (elements.eventMeetLink) {
        elements.eventMeetLink.value = '';
      }
      // Show location field if not "Op kantoor"
      if (elements.eventLocation && elements.eventAtOffice && !elements.eventAtOffice.checked) {
        elements.eventLocation.style.display = 'block';
      }
    } else {
      if (elements.eventLocation) {
        elements.eventLocation.value = '';
        elements.eventLocation.style.display = 'none';
      }
      if (elements.eventAtOffice) {
        elements.eventAtOffice.checked = false;
      }
    }
  }

  // Calculate end time based on start time and duration
  function calculateEndTime() {
    if (!elements.eventStartDate || !elements.eventStartTime || !elements.eventDuration) {
      return;
    }
    
    if (!elements.eventStartDate.value || !elements.eventStartTime.value || !elements.eventDuration.value) {
      return;
    }
    
    const startDate = new Date(elements.eventStartDate.value + 'T' + elements.eventStartTime.value);
    const durationMinutes = parseInt(elements.eventDuration.value) || 30;
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    
    if (elements.eventEndDate) {
      elements.eventEndDate.value = endDate.toISOString().split('T')[0];
    }
    if (elements.eventEndTime) {
      elements.eventEndTime.value = String(endDate.getHours()).padStart(2, '0') + ':' + 
        String(endDate.getMinutes()).padStart(2, '0');
    }
  }

  // Modal functions
  function openNewEventModal(date = null, category = null) {
    if (!elements.eventModal) return;
    
    // Determine category and title
    var eventCategory = category || 'appointment';
    var eventTitle = 'Nieuwe afspraak';
    
    if (eventCategory === 'meeting') {
      eventTitle = 'Nieuwe vergadering';
    } else if (eventCategory === 'call') {
      eventTitle = 'Nieuw telefoongesprek';
    } else if (eventCategory === 'task') {
      eventTitle = 'Nieuwe taak';
    }
    
    elements.modalTitle.textContent = eventTitle;
    elements.eventId.value = '';
    elements.eventForm.reset();
    elements.deleteEventBtn.style.display = 'none';
    
    // Set category
    if (elements.eventCategory) {
      elements.eventCategory.value = eventCategory;
    }
    
    // Auto-fill customer for tasks if user belongs to a company
    if (eventCategory === 'task' && userCustomerData) {
      if (elements.taskRelationCustomer) {
        elements.taskRelationCustomer.checked = true;
        if (elements.taskCustomerContainer) {
          elements.taskCustomerContainer.style.display = 'block';
        }
        if (elements.taskContactContainer) {
          elements.taskContactContainer.style.display = 'none';
        }
        if (elements.taskCustomerId) {
          elements.taskCustomerId.value = userCustomerData.id;
        }
        if (elements.taskCustomerSearch) {
          elements.taskCustomerSearch.value = userCustomerData.company_name || userCustomerData.name || '';
        }
      }
    }
    
    if (date) {
      // Format date in local timezone to avoid UTC conversion issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = year + '-' + month + '-' + day;
      const timeStr = String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
      elements.eventStartDate.value = dateStr;
      elements.eventStartTime.value = timeStr;
      
      // Set default duration to 30 minutes
      if (elements.eventDuration) {
        elements.eventDuration.value = '30';
      }
      calculateEndTime();
    } else {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Format date in local timezone to avoid UTC conversion issues
      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      elements.eventStartDate.value = year + '-' + month + '-' + day;
      elements.eventStartTime.value = '09:00';
      // Set default duration to 30 minutes
      if (elements.eventDuration) {
        elements.eventDuration.value = '30';
      }
      calculateEndTime();
    }
    
    // Clear association selects
    if (typeof window.setSelectedContact === 'function') {
      window.setSelectedContact(null);
    }
    if (typeof window.setSelectedCustomer === 'function') {
      window.setSelectedCustomer(null);
    }
    
    elements.eventModal.classList.add('show');
    document.body.classList.add('calendar-drawer-open');
    handleCategoryChange(); // Update fields based on default category
    
    // Initialize address autocomplete if available
    setTimeout(function() {
      initCalendarAddressAutocomplete();
    }, 100);
  }

  function openEditEventModal(event) {
    if (!elements.eventModal) return;
    
    elements.modalTitle.textContent = 'Afspraak bewerken';
    elements.eventId.value = event.id;
    elements.eventTitle.value = event.title;
    elements.eventDescription.value = event.description || '';
    
    const start = new Date(event.start_time || event.start);
    const end = new Date(event.end_time || event.end);
    
    // Format date in local timezone to avoid UTC conversion issues
    const year = start.getFullYear();
    const month = String(start.getMonth() + 1).padStart(2, '0');
    const day = String(start.getDate()).padStart(2, '0');
    elements.eventStartDate.value = year + '-' + month + '-' + day;
    elements.eventStartTime.value = String(start.getHours()).padStart(2, '0') + ':' + String(start.getMinutes()).padStart(2, '0');
    
    // Calculate duration from start and end times
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.round(durationMs / 60000);
    
    // Set duration (find closest match or default to 30)
    if (elements.eventDuration) {
      const durationOptions = [15, 30, 45, 60, 90, 120, 180, 240];
      let closestDuration = 30;
      let minDiff = Math.abs(durationMinutes - 30);
      
      durationOptions.forEach(function(opt) {
        const diff = Math.abs(durationMinutes - opt);
        if (diff < minDiff) {
          minDiff = diff;
          closestDuration = opt;
        }
      });
      
      elements.eventDuration.value = closestDuration.toString();
    }
    
    // Calculate and set end date/time (hidden fields)
    calculateEndTime();
    
    elements.eventCategory.value = event.category;
    elements.eventClient.value = event.client_name || event.client || '';
    
    // Set customer and contact in association selects
    if (event.customer_id) {
      // Load customer name and set in select
      fetch('/admin/api/customers/search?q=')
        .then(function(response) {
          return response.json();
        })
        .then(function(data) {
          if (data.success && data.customers) {
            const customer = data.customers.find(function(c) {
              return String(c.id) === String(event.customer_id);
            });
            if (customer && typeof window.setSelectedCustomer === 'function') {
              window.setSelectedCustomer(
                customer.id,
                customer.company_name || customer.name || 'Onbekend'
              );
            }
          }
        })
        .catch(function(error) {
          console.error('Error loading customer:', error);
        });
    }
    
    if (event.contact_id) {
      // Load contact name and set in select
      fetch('/admin/api/contacts/search?q=')
        .then(function(response) {
          return response.json();
        })
        .then(function(data) {
          if (data.success && data.contacts) {
            const contact = data.contacts.find(function(c) {
              return String(c.id) === String(event.contact_id);
            });
            if (contact && typeof window.setSelectedContact === 'function') {
              const contactName = contact.name || (contact.first_name + ' ' + contact.last_name) || 'Onbekend';
              window.setSelectedContact(contact.id, contactName);
            }
          }
        })
        .catch(function(error) {
          console.error('Error loading contact:', error);
        });
    }
    
    // Load recurrence data
    if (elements.eventIsRecurring && event.is_recurring) {
      elements.eventIsRecurring.checked = true;
      if (elements.recurrenceOptions) {
        elements.recurrenceOptions.style.display = 'block';
      }
      if (elements.eventRecurrenceFrequency && event.recurrence_frequency) {
        elements.eventRecurrenceFrequency.value = event.recurrence_frequency;
        elements.eventRecurrenceFrequency.dispatchEvent(new Event('change'));
      }
      if (elements.eventRecurrenceInterval && event.recurrence_interval) {
        elements.eventRecurrenceInterval.value = event.recurrence_interval;
      }
      // Set recurrence end type (radio buttons)
      const recurrenceEndRadios = document.querySelectorAll('input[name="recurrenceEnd"]');
      if (recurrenceEndRadios.length > 0) {
        if (event.recurrence_end_date) {
          const dateRadio = document.querySelector('input[name="recurrenceEnd"][value="date"]');
          if (dateRadio) {
            dateRadio.checked = true;
            if (elements.eventRecurrenceEndDate) {
              elements.eventRecurrenceEndDate.value = event.recurrence_end_date.split('T')[0];
              elements.eventRecurrenceEndDate.disabled = false;
            }
          }
        } else if (event.recurrence_count) {
          const countRadio = document.querySelector('input[name="recurrenceEnd"][value="count"]');
          if (countRadio) {
            countRadio.checked = true;
            if (elements.eventRecurrenceCount) {
              elements.eventRecurrenceCount.value = event.recurrence_count;
              elements.eventRecurrenceCount.disabled = false;
            }
          }
        } else {
          const neverRadio = document.querySelector('input[name="recurrenceEnd"][value="never"]');
          if (neverRadio) {
            neverRadio.checked = true;
          }
        }
        // Trigger change event
        const checkedRadio = document.querySelector('input[name="recurrenceEnd"]:checked');
        if (checkedRadio) {
          checkedRadio.dispatchEvent(new Event('change'));
        }
      }
      if (event.recurrence_days_of_week && elements.weeklyDaysGroup) {
        const dayCheckboxes = document.querySelectorAll('.recurrence-day-checkbox');
        dayCheckboxes.forEach(function(cb) {
          cb.checked = event.recurrence_days_of_week.indexOf(parseInt(cb.value)) !== -1;
        });
      }
    }
    
    // Load reminders
    if (event.reminder_minutes && event.reminder_minutes.length > 0) {
      event.reminder_minutes.forEach(function(minutes) {
        const checkbox = document.getElementById('reminder' + minutes + 'min');
        if (checkbox) {
          checkbox.checked = true;
        }
      });
    }
    if (event.reminder_recipients && event.reminder_recipients.length > 0) {
      // Check if current user is in recipients
      const currentUserId = typeof window.currentUserId !== 'undefined' ? window.currentUserId : null;
      if (currentUserId && event.reminder_recipients.indexOf(currentUserId) !== -1) {
        if (elements.reminderToSelf) {
          elements.reminderToSelf.checked = true;
        }
      }
      // Set selected employees in multi-select
      if (typeof window.setSelectedReminderEmployees === 'function') {
        const employeeIds = event.reminder_recipients.filter(function(id) {
          return id !== currentUserId;
        });
        window.setSelectedReminderEmployees(employeeIds);
      }
    }
    
    // Load task customer/contact
    if (event.category === 'task') {
      if (event.customer_id) {
        if (elements.taskRelationCustomer) {
          elements.taskRelationCustomer.checked = true;
          elements.taskRelationCustomer.dispatchEvent(new Event('change'));
        }
        if (elements.taskCustomerId) {
          elements.taskCustomerId.value = event.customer_id;
        }
        // Load customer name (would need to fetch or pass from server)
      } else if (event.contact_id) {
        if (elements.taskRelationContact) {
          elements.taskRelationContact.checked = true;
          elements.taskRelationContact.dispatchEvent(new Event('change'));
        }
        if (elements.taskContactId) {
          elements.taskContactId.value = event.contact_id;
        }
      }
    }
    
    // Handle meeting type and location
    const meetingType = event.meeting_type || 'physical';
    handleMeetingTypeChange(meetingType);
    
    if (meetingType === 'physical') {
      if (event.location === 'Op kantoor') {
        if (elements.eventAtOffice) {
          elements.eventAtOffice.checked = true;
        }
        if (elements.eventLocation) {
          elements.eventLocation.value = 'Op kantoor';
          elements.eventLocation.style.display = 'none';
        }
      } else {
        if (elements.eventAtOffice) {
          elements.eventAtOffice.checked = false;
        }
        if (elements.eventLocation) {
          elements.eventLocation.value = event.location || '';
          elements.eventLocation.style.display = 'block';
        }
      }
    } else if (meetingType === 'online') {
      if (elements.eventMeetLink) {
        elements.eventMeetLink.value = event.location || '';
      }
    }
    
    elements.deleteEventBtn.style.display = 'inline-flex';
    elements.eventModal.classList.add('show');
    document.body.classList.add('calendar-drawer-open');
    handleCategoryChange(); // Update fields based on event category
    
    // Initialize address autocomplete if available
    setTimeout(function() {
      initCalendarAddressAutocomplete();
    }, 100);
  }
  
  // Initialize agenda selector
  function initAgendaSelector() {
    if (!canViewAll || !elements.agendaSelector || !elements.agendaSelectorContainer) {
      return;
    }
    
    // Show selector for managers+
    elements.agendaSelectorContainer.style.display = 'block';
    
    // Populate employee options
    allEmployeesData.forEach(function(emp) {
      const option = document.createElement('option');
      option.value = emp.id;
      const empName = (emp.first_name && emp.last_name) 
        ? emp.first_name + ' ' + emp.last_name 
        : emp.email || 'Onbekend';
      option.textContent = empName;
      elements.agendaSelector.appendChild(option);
    });
    
    // Set default to "all" (totaal view)
    if (elements.agendaSelector) {
      elements.agendaSelector.value = 'all';
      selectedAgendaId = null;
    }
  }
  
  // Initialize reminder employees dropdown
  function initReminderEmployees() {
    if (!elements.reminderEmployees || !employeesData || employeesData.length === 0) {
      return;
    }
    
    // Check if user can view all (managers+)
    if (typeof window.calendarCanViewAll !== 'undefined' && window.calendarCanViewAll) {
      if (elements.reminderEmployeesContainer) {
        elements.reminderEmployeesContainer.style.display = 'block';
      }
      
      // Populate dropdown
      elements.reminderEmployees.innerHTML = '<option value="">Selecteer werknemers...</option>';
      employeesData.forEach(function(emp) {
        const option = document.createElement('option');
        option.value = emp.id;
        const empName = (emp.first_name && emp.last_name) 
          ? emp.first_name + ' ' + emp.last_name 
          : emp.email || 'Onbekend';
        option.textContent = empName + (emp.email ? ' (' + emp.email + ')' : '');
        elements.reminderEmployees.appendChild(option);
      });
    }
  }
  
  // Initialize Google Places autocomplete for address field
  function initCalendarAddressAutocomplete() {
    if (!window.GOOGLE_MAPS_LOADED || typeof google === 'undefined' || typeof google.maps === 'undefined') {
      return;
    }
    
    if (!elements.eventLocation) {
      return;
    }
    
    // Check if already initialized
    if (elements.eventLocation.dataset.autocompleteInitialized === 'true') {
      return;
    }
    
    try {
      // Import places library if needed
      if (typeof google.maps.places === 'undefined') {
        google.maps.importLibrary('places').then(function() {
          setupAutocomplete();
        });
      } else {
        setupAutocomplete();
      }
      
      function setupAutocomplete() {
        const autocomplete = new google.maps.places.Autocomplete(elements.eventLocation, {
          componentRestrictions: { country: ['nl', 'be', 'de', 'fr'] },
          fields: ['address_components', 'formatted_address', 'geometry'],
          types: ['establishment'] // Only establishment, not mixed with address
        });
        
        // Handle place selection
        autocomplete.addListener('place_changed', function() {
          const place = autocomplete.getPlace();
          if (place.formatted_address) {
            elements.eventLocation.value = place.formatted_address;
          }
        });
        
        // Mark as initialized
        elements.eventLocation.dataset.autocompleteInitialized = 'true';
      }
    } catch (error) {
      console.error('Error initializing address autocomplete:', error);
    }
  }

  function closeModal() {
    if (elements.eventModal) {
      elements.eventModal.classList.remove('show');
      document.body.classList.remove('calendar-drawer-open');
    }
  }

  // Handle save event
  function handleSaveEvent(e) {
    e.preventDefault();
    
    // Validate task: must have customer OR contact
    if (elements.eventCategory && elements.eventCategory.value === 'task') {
      const hasCustomer = elements.taskCustomerId && elements.taskCustomerId.value;
      const hasContact = elements.taskContactId && elements.taskContactId.value;
      
      if (!hasCustomer && !hasContact) {
        if (typeof window.showNotification === 'function') {
          window.showNotification('Bij een taak moet je een bedrijf of contactpersoon selecteren', 'error', 5000);
        } else {
          alert('Bij een taak moet je een bedrijf of contactpersoon selecteren');
        }
        return;
      }
    }
    
    // Determine location based on meeting type
    var location = '';
    var meetingType = 'physical'; // default
    
    // Check if meeting type switcher exists and get active type
    const activeTypeBtn = document.querySelector('.meeting-type-btn.active');
    if (activeTypeBtn) {
      meetingType = activeTypeBtn.getAttribute('data-type');
    }
    
    if (meetingType === 'physical') {
      if (elements.eventAtOffice && elements.eventAtOffice.checked) {
        location = 'Op kantoor';
      } else if (elements.eventLocation) {
        location = elements.eventLocation.value;
      }
    } else if (meetingType === 'online') {
      if (elements.eventMeetLink) {
        location = elements.eventMeetLink.value;
      }
    }
    
    // Get reminders
    var reminderMinutes = [];
    var reminderCheckboxes = document.querySelectorAll('#remindersGroup input[type="checkbox"]:not(#reminderToSelf)');
    reminderCheckboxes.forEach(function(cb) {
      if (cb.checked && cb.value) {
        reminderMinutes.push(parseInt(cb.value));
      }
    });
    
    // Get reminder recipients
    var reminderRecipients = [];
    if (elements.reminderToSelf && elements.reminderToSelf.checked) {
      // Add current user ID (will be set on server side)
      reminderRecipients.push('self');
    }
    if (typeof window.getSelectedReminderEmployees === 'function') {
      const selectedEmployeeIds = window.getSelectedReminderEmployees();
      selectedEmployeeIds.forEach(function(id) {
        reminderRecipients.push(id);
      });
    }
    
    // Get recurrence data
    var isRecurring = false;
    var recurrenceData = null;
    if (elements.eventIsRecurring && elements.eventIsRecurring.checked) {
      isRecurring = true;
      const frequency = elements.eventRecurrenceFrequency ? elements.eventRecurrenceFrequency.value : 'weekly';
      const interval = elements.eventRecurrenceInterval ? parseInt(elements.eventRecurrenceInterval.value) || 1 : 1;
      const endType = getRecurrenceEndType();
      
      recurrenceData = {
        frequency: frequency,
        interval: interval,
        endType: endType
      };
      
      if (endType === 'date' && elements.eventRecurrenceEndDate && elements.eventRecurrenceEndDate.value) {
        recurrenceData.endDate = elements.eventRecurrenceEndDate.value;
      } else if (endType === 'count' && elements.eventRecurrenceCount && elements.eventRecurrenceCount.value) {
        recurrenceData.count = parseInt(elements.eventRecurrenceCount.value);
      }
      
      if (frequency === 'weekly') {
        const dayCheckboxes = document.querySelectorAll('.recurrence-day-checkbox:checked');
        const days = Array.from(dayCheckboxes).map(function(cb) {
          return parseInt(cb.value);
        });
        if (days.length > 0) {
          recurrenceData.daysOfWeek = days;
        }
      }
    }
    
    // Get customer/contact IDs (for meetings, calls, appointments)
    var customerId = null;
    var contactId = null;
    if (elements.eventCategory && ['meeting', 'call', 'appointment'].indexOf(elements.eventCategory.value) !== -1) {
      if (elements.eventCustomerId && elements.eventCustomerId.value) {
        customerId = elements.eventCustomerId.value;
      }
      if (elements.eventContactId && elements.eventContactId.value) {
        contactId = elements.eventContactId.value;
      }
    }
    
    // Get task customer/contact
    var taskCustomerId = null;
    var taskContactId = null;
    if (elements.eventCategory && elements.eventCategory.value === 'task') {
      if (elements.taskRelationCustomer && elements.taskRelationCustomer.checked) {
        taskCustomerId = elements.taskCustomerId ? elements.taskCustomerId.value : null;
      } else if (elements.taskRelationContact && elements.taskRelationContact.checked) {
        taskContactId = elements.taskContactId ? elements.taskContactId.value : null;
      }
    }
    
    const eventData = {
      id: elements.eventId.value || null,
      title: elements.eventTitle.value,
      description: elements.eventDescription.value,
      start: new Date(elements.eventStartDate.value + 'T' + elements.eventStartTime.value).toISOString(),
      end: new Date(elements.eventEndDate.value + 'T' + elements.eventEndTime.value).toISOString(),
      category: elements.eventCategory.value,
      client: elements.eventClient ? elements.eventClient.value : '',
      customer_id: taskCustomerId || customerId || (elements.eventCustomerId ? elements.eventCustomerId.value : null),
      contact_id: taskContactId || contactId || (elements.eventContactId ? elements.eventContactId.value : null),
      location: location,
      meeting_type: meetingType,
      phone: elements.eventPhone ? elements.eventPhone.value : '',
      priority: elements.eventPriority ? elements.eventPriority.value : 'normal',
      reminder_minutes: reminderMinutes.length > 0 ? reminderMinutes : null,
      reminder_recipients: reminderRecipients.length > 0 ? reminderRecipients : null,
      is_recurring: isRecurring,
      recurrence_frequency: recurrenceData ? recurrenceData.frequency : null,
      recurrence_interval: recurrenceData ? recurrenceData.interval : null,
      recurrence_end_date: recurrenceData && recurrenceData.endDate ? recurrenceData.endDate : null,
      recurrence_count: recurrenceData && recurrenceData.count ? recurrenceData.count : null,
      recurrence_days_of_week: recurrenceData && recurrenceData.daysOfWeek ? recurrenceData.daysOfWeek : null
    };
    
    saveEvent(eventData);
  }
  
  // Get recurrence end type from radio buttons
  function getRecurrenceEndType() {
    const radios = document.querySelectorAll('input[name="recurrenceEnd"]:checked');
    if (radios.length > 0) {
      return radios[0].value;
    }
    return 'never';
  }

  // Handle delete event
  function handleDeleteEvent() {
    if (!confirm('Weet je zeker dat je deze afspraak wilt verwijderen?')) {
      return;
    }
    
    const eventId = elements.eventId.value;
    if (eventId) {
      // TODO: Delete from API
      deleteEvent(eventId);
    }
  }

  // Handle filter change
  function handleFilterChange() {
    filteredCategories = Array.from(elements.filterCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.dataset.category);
    
    renderCalendar();
    updateAgendaView();
  }

  // Handle search
  function handleSearch() {
    renderCalendar();
    updateAgendaView();
  }

  // API functions
  function loadEvents() {
    // Calculate date range for current view
    let startDate, endDate;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    if (currentView === 'month') {
      // Get first and last day of month view (including padding days)
      const firstDay = new Date(year, month, 1);
      const start = new Date(firstDay);
      start.setDate(start.getDate() - start.getDay() + 1); // Monday
      
      const lastDay = new Date(year, month + 1, 0);
      const end = new Date(lastDay);
      end.setDate(end.getDate() + (7 - end.getDay())); // Sunday
      
      startDate = start.toISOString();
      endDate = end.toISOString();
    } else if (currentView === 'week') {
      const weekStart = getWeekStart(currentDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      startDate = weekStart.toISOString();
      endDate = weekEnd.toISOString();
    } else {
      // Day view
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      startDate = dayStart.toISOString();
      endDate = dayEnd.toISOString();
    }
    
    // Build query with agenda filter
    var queryParams = 'start=' + encodeURIComponent(startDate) + '&end=' + encodeURIComponent(endDate);
    if (selectedAgendaId === 'main') {
      // Main agenda: events without created_by (or system events)
      queryParams += '&agenda=main';
    } else if (selectedAgendaId) {
      // Specific employee agenda
      queryParams += '&created_by=' + encodeURIComponent(selectedAgendaId);
    } else {
      // All agendas (totaal view)
      queryParams += '&agenda=all';
    }
    
    fetch('/admin/api/calendar/events?' + queryParams)
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (data.success) {
          events = data.events.map(function(event) {
            return {
              id: event.id,
              title: event.title,
              description: event.description,
              start_time: event.start_time,
              end_time: event.end_time,
              start: event.start_time, // Keep for backward compatibility
              end: event.end_time, // Keep for backward compatibility
              category: event.category,
              client_name: event.client_name,
              client: event.client_name, // Keep for backward compatibility
              location: event.location,
              customer_id: event.customer_id,
              contact_id: event.contact_id,
              status: event.status,
              meeting_type: event.meeting_type,
              is_recurring: event.is_recurring,
              recurrence_frequency: event.recurrence_frequency,
              recurrence_interval: event.recurrence_interval,
              recurrence_end_date: event.recurrence_end_date,
              recurrence_count: event.recurrence_count,
              recurrence_days_of_week: event.recurrence_days_of_week,
              reminder_minutes: event.reminder_minutes,
              reminder_recipients: event.reminder_recipients,
              creator_color: event.creator_color,
              creator_name: event.creator_name,
              created_by: event.created_by
            };
          });
          
          renderCalendar();
          updateAgendaView();
        } else {
          console.error('Error loading events:', data.error);
          if (typeof window.showNotification === 'function') {
            window.showNotification('Fout bij laden afspraken: ' + (data.error || 'Onbekende fout'), 'error', 5000);
          }
        }
      })
      .catch(function(err) {
        console.error('Error loading events:', err);
        if (typeof window.showNotification === 'function') {
          window.showNotification('Fout bij laden afspraken: ' + err.message, 'error', 5000);
        }
      });
  }

  function saveEvent(eventData) {
    const url = eventData.id 
      ? '/admin/api/calendar/events/' + eventData.id
      : '/admin/api/calendar/events';
    
    const method = eventData.id ? 'PUT' : 'POST';
    
    // Prepare data for API
    const apiData = {
      title: eventData.title,
      description: eventData.description || null,
      start_time: eventData.start || eventData.start_time,
      end_time: eventData.end || eventData.end_time,
      category: eventData.category,
      location: eventData.location || null,
      client_name: eventData.client || eventData.client_name || null,
      customer_id: eventData.customer_id || null,
      contact_id: eventData.contact_id || null,
      status: eventData.status || 'scheduled',
      meeting_type: eventData.meeting_type || null
    };
    
    fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'same-origin',
      body: JSON.stringify(apiData)
    })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (data.success) {
          closeModal();
          loadEvents(); // Reload events from server
          
          if (typeof window.showNotification === 'function') {
            window.showNotification('Afspraak opgeslagen', 'success', 3000);
          }
        } else {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Fout: ' + (data.error || 'Kon afspraak niet opslaan'), 'error', 5000);
          }
        }
      })
      .catch(function(err) {
        console.error('Error saving event:', err);
        if (typeof window.showNotification === 'function') {
          window.showNotification('Fout bij opslaan: ' + err.message, 'error', 5000);
        }
      });
  }

  function deleteEvent(eventId) {
    fetch('/admin/api/calendar/events/' + eventId, {
      method: 'DELETE',
      credentials: 'same-origin'
    })
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        if (data.success) {
          closeModal();
          loadEvents(); // Reload events from server
          
          if (typeof window.showNotification === 'function') {
            window.showNotification('Afspraak verwijderd', 'success', 3000);
          }
        } else {
          if (typeof window.showNotification === 'function') {
            window.showNotification('Fout: ' + (data.error || 'Kon afspraak niet verwijderen'), 'error', 5000);
          }
        }
      })
      .catch(function(err) {
        console.error('Error deleting event:', err);
        if (typeof window.showNotification === 'function') {
          window.showNotification('Fout bij verwijderen: ' + err.message, 'error', 5000);
        }
      });
  }

  // Initialize multi-selects for employees, customers, contacts
  function initMultiSelects() {
    // Reminder employees multi-select
    if (elements.reminderEmployeesTrigger && elements.reminderEmployeesDropdown) {
      initMultiSelect(
        elements.reminderEmployeesTrigger,
        elements.reminderEmployeesDropdown,
        elements.reminderEmployeesSearch,
        elements.reminderEmployeesItems,
        elements.selectedReminderEmployeesList,
        'reminderEmployees',
        function() {
          // Load employees
          if (employeesData && employeesData.length > 0) {
            return employeesData.map(function(emp) {
              const name = (emp.first_name && emp.last_name) 
                ? emp.first_name + ' ' + emp.last_name 
                : emp.email || 'Onbekend';
              return {
                id: emp.id,
                label: name,
                email: emp.email,
                searchText: (name + ' ' + (emp.email || '')).toLowerCase()
              };
            });
          }
          return [];
        }
      );
    }
    
    // Customers multi-select
    if (elements.customersTrigger && elements.customersDropdown) {
      initMultiSelect(
        elements.customersTrigger,
        elements.customersDropdown,
        elements.customersSearch,
        elements.customersItems,
        elements.selectedCustomersList,
        'customers',
        function() {
          // Will be loaded via API when needed
          return [];
        }
      );
    }
    
    // Contacts multi-select
    if (elements.contactsTrigger && elements.contactsDropdown) {
      initMultiSelect(
        elements.contactsTrigger,
        elements.contactsDropdown,
        elements.contactsSearch,
        elements.contactsItems,
        elements.selectedContactsList,
        'contacts',
        function() {
          // Will be loaded via API when needed
          return [];
        }
      );
    }
  }
  
  // Generic multi-select initialization
  function initMultiSelect(trigger, dropdown, searchInput, itemsContainer, selectedList, type, loadDataFn) {
    var selectedItems = [];
    var allItems = [];
    var isLoading = false;
    
    // Load data function
    function loadData() {
      if (isLoading || allItems.length > 0) return;
      
      if (type === 'customers') {
        // Load all customers initially
        isLoading = true;
        fetch('/admin/api/customers/search?q=')
          .then(function(response) {
            return response.json();
          })
          .then(function(data) {
            if (data.success && data.customers) {
              allItems = data.customers.map(function(customer) {
                return {
                  id: customer.id,
                  label: customer.company_name || customer.name || 'Onbekend',
                  email: customer.email,
                  searchText: ((customer.company_name || customer.name || '') + ' ' + (customer.email || '')).toLowerCase()
                };
              });
              renderItems();
            }
            isLoading = false;
          })
          .catch(function(error) {
            console.error('Error loading customers:', error);
            isLoading = false;
          });
      } else if (type === 'contacts') {
        // Load all contacts initially
        isLoading = true;
        fetch('/admin/api/contacts/search?q=')
          .then(function(response) {
            return response.json();
          })
          .then(function(data) {
            if (data.success && data.contacts) {
              allItems = data.contacts.map(function(contact) {
                return {
                  id: contact.id,
                  label: contact.name || (contact.first_name + ' ' + contact.last_name) || 'Onbekend',
                  email: contact.email,
                  customer_id: contact.customer_id,
                  searchText: ((contact.name || contact.first_name + ' ' + contact.last_name || '') + ' ' + (contact.email || '')).toLowerCase()
                };
              });
              renderItems();
            }
            isLoading = false;
          })
          .catch(function(error) {
            console.error('Error loading contacts:', error);
            isLoading = false;
          });
      } else if (loadDataFn) {
        allItems = loadDataFn();
        renderItems();
      }
    }
    
    // Toggle dropdown
    if (trigger) {
      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        const isOpen = dropdown.style.display === 'block';
        dropdown.style.display = isOpen ? 'none' : 'block';
        trigger.classList.toggle('active', !isOpen);
        
        if (!isOpen) {
          // Load data if needed
          if (allItems.length === 0) {
            loadData();
          } else {
            renderItems();
          }
        }
      });
    }
    
    // Search
    if (searchInput) {
      var searchTimeout = null;
      searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        
        // For customers and contacts, search via API
        if ((type === 'customers' || type === 'contacts') && query.length >= 2) {
          searchTimeout = setTimeout(function() {
            const endpoint = type === 'customers' ? '/admin/api/customers/search' : '/admin/api/contacts/search';
            fetch(endpoint + '?q=' + encodeURIComponent(query))
              .then(function(response) {
                return response.json();
              })
              .then(function(data) {
                if (data.success) {
                  if (type === 'customers' && data.customers) {
                    allItems = data.customers.map(function(customer) {
                      return {
                        id: customer.id,
                        label: customer.company_name || customer.name || 'Onbekend',
                        email: customer.email,
                        searchText: ((customer.company_name || customer.name || '') + ' ' + (customer.email || '')).toLowerCase()
                      };
                    });
                  } else if (type === 'contacts' && data.contacts) {
                    allItems = data.contacts.map(function(contact) {
                      return {
                        id: contact.id,
                        label: contact.name || (contact.first_name + ' ' + contact.last_name) || 'Onbekend',
                        email: contact.email,
                        customer_id: contact.customer_id,
                        company_name: contact.company_name,
                        searchText: ((contact.name || contact.first_name + ' ' + contact.last_name || '') + ' ' + (contact.email || '')).toLowerCase()
                      };
                    });
                  }
                  renderItems();
                }
              })
              .catch(function(error) {
                console.error('Error searching:', error);
              });
          }, 300);
        } else {
          // Local search for already loaded items
          renderItems(query.toLowerCase());
        }
      });
    }
    
    // Render items
    function renderItems(query) {
      if (!itemsContainer) return;
      
      var filtered = allItems;
      if (query) {
        filtered = allItems.filter(function(item) {
          return item.searchText && item.searchText.includes(query);
        });
      }
      
      itemsContainer.innerHTML = '';
      
      if (filtered.length === 0) {
        itemsContainer.innerHTML = '<div style="padding: 12px; text-align: center; color: #6b7280; font-size: 13px;">Geen resultaten</div>';
        return;
      }
      
      filtered.forEach(function(item) {
        const isSelected = selectedItems.some(function(s) { return s.id === item.id; });
        const itemDiv = document.createElement('div');
        itemDiv.className = 'multi-select-item';
        
        // For contacts, show company if linked
        var companyInfo = '';
        if (type === 'contacts' && item.customer_id && item.company_name) {
          companyInfo = '<div class="multi-select-item-company" style="font-size: 11px; color: #6b7280; margin-top: 2px;">Bedrijf: ' + item.company_name + '</div>';
        }
        
        itemDiv.innerHTML = 
          '<input type="checkbox" ' + (isSelected ? 'checked' : '') + ' data-id="' + item.id + '">' +
          '<div class="multi-select-item-label">' +
            '<div>' + item.label + '</div>' +
            (item.email ? '<div class="multi-select-item-email">' + item.email + '</div>' : '') +
            companyInfo +
          '</div>';
        
        itemDiv.addEventListener('click', function(e) {
          if (e.target.type === 'checkbox' || e.target.closest('.multi-select-item')) {
            toggleItem(item);
            // Also toggle checkbox
            const checkbox = itemDiv.querySelector('input[type="checkbox"]');
            if (checkbox) {
              checkbox.checked = !checkbox.checked;
            }
          }
        });
        
        itemsContainer.appendChild(itemDiv);
      });
    }
    
    // Toggle item selection
    function toggleItem(item) {
      const index = selectedItems.findIndex(function(s) { return s.id === item.id; });
      if (index !== -1) {
        selectedItems.splice(index, 1);
      } else {
        selectedItems.push(item);
        
        // For contacts: if contact has customer_id, also add customer to customers list if it exists
        if (type === 'contacts' && item.customer_id) {
          // Check if customers multi-select exists and add the company
          if (elements.customersMultiSelect && elements.includeCustomers) {
            // Auto-check customers checkbox
            elements.includeCustomers.checked = true;
            elements.includeCustomers.dispatchEvent(new Event('change'));
            
            // Add customer to customers list (will be handled when customers dropdown is opened)
            // Store for later
            if (!window.autoSelectedCustomers) {
              window.autoSelectedCustomers = [];
            }
            if (window.autoSelectedCustomers.indexOf(item.customer_id) === -1) {
              window.autoSelectedCustomers.push(item.customer_id);
            }
          }
        }
      }
      renderSelected();
      renderItems(searchInput ? searchInput.value : '');
    }
    
    // Render selected items
    function renderSelected() {
      if (!selectedList) return;
      
      selectedList.innerHTML = '';
      
      selectedItems.forEach(function(item) {
        const badge = document.createElement('div');
        badge.className = 'selected-item-badge';
        badge.innerHTML = 
          '<span>' + item.label + '</span>' +
          '<button type="button" class="remove-btn" data-id="' + item.id + '">&times;</button>';
        
        badge.querySelector('.remove-btn').addEventListener('click', function() {
          toggleItem(item);
        });
        
        selectedList.appendChild(badge);
      });
      
      // Update hidden input
      if (type === 'reminderEmployees') {
        // Store in global variable for later use
        window.selectedReminderEmployees = selectedItems.map(function(i) { return i.id; });
      } else if (type === 'customers') {
        if (elements.eventCustomerIds) {
          elements.eventCustomerIds.value = selectedItems.map(function(i) { return i.id; }).join(',');
        }
      } else if (type === 'contacts') {
        if (elements.eventContactIds) {
          elements.eventContactIds.value = selectedItems.map(function(i) { return i.id; }).join(',');
        }
      }
      
      // Update trigger text
      if (trigger) {
        const placeholder = trigger.querySelector('.multi-select-placeholder');
        if (placeholder) {
          if (selectedItems.length === 0) {
            placeholder.textContent = 'Selecteer ' + (type === 'reminderEmployees' ? 'werknemers' : type === 'customers' ? 'bedrijven' : 'contactpersonen') + '...';
          } else {
            placeholder.textContent = selectedItems.length + ' geselecteerd';
          }
        }
      }
    }
    
    // Close dropdown on outside click
    document.addEventListener('click', function(e) {
      if (dropdown && trigger && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
        dropdown.style.display = 'none';
        trigger.classList.remove('active');
      }
    });
    
    // Expose functions for external use
    window['getSelected' + type.charAt(0).toUpperCase() + type.slice(1)] = function() {
      return selectedItems.map(function(i) { return i.id; });
    };
    
    window['setSelected' + type.charAt(0).toUpperCase() + type.slice(1)] = function(ids) {
      selectedItems = allItems.filter(function(item) {
        return ids.indexOf(item.id) !== -1;
      });
      renderSelected();
      renderItems(searchInput ? searchInput.value : '');
    };
  }
  
  // Initialize customers/contacts selection
  function initCustomersContactsSelection() {
    // Customers checkbox
    if (elements.includeCustomers) {
      elements.includeCustomers.addEventListener('change', function() {
        if (elements.customersContainer) {
          elements.customersContainer.style.display = this.checked ? 'block' : 'none';
        }
        if (this.checked && elements.customersSearch) {
          // Load customers when opened
          loadCustomersForSelect();
        }
      });
    }
    
    // Contacts checkbox
    if (elements.includeContacts) {
      elements.includeContacts.addEventListener('change', function() {
        if (elements.contactsContainer) {
          elements.contactsContainer.style.display = this.checked ? 'block' : 'none';
        }
        if (this.checked && elements.contactsSearch) {
          // Load contacts when opened
          loadContactsForSelect();
        }
      });
    }
  }
  
  // Load customers for multi-select
  function loadCustomersForSelect() {
    // This will be called when customers dropdown is opened
    // For now, we'll load on search
    if (elements.customersSearch) {
      var searchTimeout = null;
      elements.customersSearch.addEventListener('input', function() {
        const query = this.value.trim();
        
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        
        if (query.length < 2) {
          return;
        }
        
        searchTimeout = setTimeout(function() {
          fetch('/admin/api/customers/search?q=' + encodeURIComponent(query))
            .then(function(response) {
              return response.json();
            })
            .then(function(data) {
              if (data.success && data.customers) {
                // Update multi-select items
                if (window.setSelectedCustomers) {
                  // This would need to be integrated with the multi-select system
                  // For now, we'll handle it in the multi-select initialization
                }
              }
            })
            .catch(function(error) {
              console.error('Error loading customers:', error);
            });
        }, 300);
      });
    }
  }
  
  // Load contacts for multi-select
  function loadContactsForSelect() {
    // Similar to loadCustomersForSelect
    if (elements.contactsSearch) {
      var searchTimeout = null;
      elements.contactsSearch.addEventListener('input', function() {
        const query = this.value.trim();
        
        if (searchTimeout) {
          clearTimeout(searchTimeout);
        }
        
        if (query.length < 2) {
          return;
        }
        
        searchTimeout = setTimeout(function() {
          fetch('/admin/api/contacts/search?q=' + encodeURIComponent(query))
            .then(function(response) {
              return response.json();
            })
            .then(function(data) {
              if (data.success && data.contacts) {
                // Update multi-select items
              }
            })
            .catch(function(error) {
              console.error('Error loading contacts:', error);
            });
        }, 300);
      });
    }
  }

  // Helper functions
  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    return new Date(d.setDate(diff));
  }

  function formatTime(dateString) {
    const date = new Date(dateString);
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  function formatDateTime(dateString) {
    const date = new Date(dateString);
    const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
      'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    
    return dayNames[date.getDay()] + ' ' + date.getDate() + ' ' + monthNames[date.getMonth()] + 
      ' om ' + formatTime(dateString);
  }

  function formatDateHeader(dateString) {
    const date = new Date(dateString);
    const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
    const monthNames = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
      'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    
    return dayNames[date.getDay()] + ' ' + date.getDate() + ' ' + monthNames[date.getMonth()] + ' ' + date.getFullYear();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
