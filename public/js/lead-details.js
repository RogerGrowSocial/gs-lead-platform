// Lead Workspace JavaScript
// Handles chat, timeline, and action buttons

(function() {
  'use strict';

  // Get lead ID from URL
  const leadId = window.location.pathname.split('/').pop();
  if (!leadId) {
    console.error('No lead ID found in URL');
    return;
  }

  // Get lead contact data from page
  const phoneElement = document.querySelector('[data-phone]');
  const emailElement = document.querySelector('[data-email]');
  const leadData = {
    phone: phoneElement ? (phoneElement.dataset.phone || phoneElement.textContent.trim()) : null,
    email: emailElement ? (emailElement.dataset.email || emailElement.textContent.trim()) : null
  };
  
  // Clean phone number
  if (leadData.phone && leadData.phone !== '-') {
    leadData.phone = leadData.phone.replace(/[^0-9+]/g, '');
  } else {
    leadData.phone = null;
  }
  
  if (leadData.email && leadData.email === '-') {
    leadData.email = null;
  }

  // State
  let activitiesPollInterval = null;
  let messagesPollInterval = null;
  let isLoadingChat = false;
  let isLoadingTimeline = false;
  
  // Track rendered activities to prevent duplicates
  const renderedActivityIds = new Set();
  const renderedMessageIds = new Set();

  // ============================================
  // Helper Functions
  // ============================================

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('nl-NL', { 
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 
                    'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} om ${hours}:${minutes}`;
  }

  function setLoading(element, isLoading) {
    if (isLoading) {
      element.classList.add('loading');
      element.disabled = true;
    } else {
      element.classList.remove('loading');
      element.disabled = false;
    }
  }

  // ============================================
  // Chat System
  // ============================================

  function renderChatMessage(activity, shouldScrollToBottom = false) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    // Check if already rendered by ID
    if (renderedMessageIds.has(activity.id)) {
      return;
    }
    
    // Also check if DOM element already exists (double safety)
    const existingMessage = messagesContainer.querySelector(`[data-activity-id="${activity.id}"]`);
    if (existingMessage) {
      renderedMessageIds.add(activity.id); // Mark as rendered
      return;
    }

    // Determine if message is from partner or customer
    // Partner messages: dashboard channel, or message type from partner, or whatsapp sent by partner
    // Customer messages: whatsapp from customer, or incoming messages
    const isPartner = activity.metadata?.channel === 'dashboard' || 
                     (activity.type === 'message' && activity.metadata?.channel !== 'whatsapp') ||
                     (activity.type === 'whatsapp' && activity.metadata?.direction === 'outbound');
    
    const isSystem = activity.type === 'created' || activity.type === 'status_changed';
    
    // Skip system messages in chat (they're shown in timeline)
    if (isSystem && activity.type !== 'status_changed') return;
    
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message-wrapper ${isPartner ? 'message-right' : 'message-left'}`;
    messageWrapper.dataset.activityId = activity.id; // Store ID for tracking
    
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isPartner ? 'message-business' : 'message-customer'}`;
    
    const text = document.createElement('p');
    text.textContent = activity.description || activity.type;
    bubble.appendChild(text);
    
    const time = document.createElement('span');
    time.className = `message-time ${isPartner ? 'text-right' : 'text-left'}`;
    time.textContent = formatTime(activity.created_at);
    
    messageWrapper.appendChild(bubble);
    messageWrapper.appendChild(time);
    messagesContainer.appendChild(messageWrapper);
    
    // Mark as rendered
    renderedMessageIds.add(activity.id);
    
    // Only scroll to bottom if requested (e.g., new message sent) or user is already at bottom
    if (shouldScrollToBottom) {
      const messagesArea = messagesContainer.closest('.messages-area');
      if (messagesArea) {
        messagesArea.scrollTop = messagesArea.scrollHeight;
      }
    }
  }

  // Shared function to load activities data
  async function loadActivitiesData() {
    try {
      const response = await fetch(`/dashboard/api/leads/${leadId}/activities`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to load activities');
      
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      
      return data.activities;
    } catch (error) {
      console.error('Error loading activities:', error);
      throw error;
    }
  }

  async function loadChatMessages(activities = null, isInitialLoad = false) {
    const messagesContainer = document.getElementById('chatMessages');
    const skeleton = document.getElementById('chatSkeleton');
    
    if (!messagesContainer) return;
    
    // Preserve scroll position
    const messagesArea = messagesContainer.closest('.messages-area');
    const wasAtBottom = messagesArea ? 
      (messagesArea.scrollHeight - messagesArea.scrollTop - messagesArea.clientHeight < 50) : false;
    const previousScrollHeight = messagesArea ? messagesArea.scrollHeight : 0;
    
    // Prevent showing skeleton if already loading or if we have activities
    if (isLoadingChat && !activities) return;
    
    // Show skeleton loader only on initial load
    if (isInitialLoad && skeleton && skeleton.style.display !== 'flex') {
      isLoadingChat = true;
      skeleton.style.display = 'flex';
    }
    
    try {
      // Use provided activities or fetch new
      const activitiesData = activities || await loadActivitiesData();
      
      // Hide skeleton loader
      if (skeleton) {
        skeleton.style.display = 'none';
        isLoadingChat = false;
      }
      
      // Only clear on initial load
      if (isInitialLoad) {
        // Clear existing messages (except initial customer message)
        const existingMessages = messagesContainer.querySelectorAll('.message-wrapper');
        existingMessages.forEach((msg, index) => {
          if (index > 0) msg.remove(); // Keep first message (customer initial message)
        });
        renderedMessageIds.clear();
      }
      
      // Always sync renderedMessageIds with existing DOM elements before processing
      // This ensures we don't add duplicates even if the Set gets out of sync
      const existingMessages = messagesContainer.querySelectorAll('.message-wrapper[data-activity-id]');
      existingMessages.forEach(msg => {
        const activityId = msg.dataset.activityId;
        if (activityId) {
          renderedMessageIds.add(activityId);
        }
      });
      
      // Filter activities for chat
      const messageActivities = activitiesData.filter(a => {
        // Always show messages
        if (a.type === 'message') return true;
        
        // Always show WhatsApp/Twilio messages
        if (a.type === 'whatsapp') return true;
        
        // Always show created (aanvraag ingediend) - but only once
        if (a.type === 'created') return true;
        
        // Filter out status_changed - we only want assignments
        if (a.type === 'status_changed') {
          // Only show if it's an assignment (check metadata or if description indicates assignment)
          const isAssignment = a.metadata?.is_assignment === true || 
                              a.metadata?.assignment === true ||
                              (a.description && (
                                a.description.toLowerCase().includes('gekoppeld') ||
                                a.description.toLowerCase().includes('toegewezen') ||
                                a.description.toLowerCase().includes('partner gevonden') ||
                                a.description.toLowerCase().includes('assigned')
                              ));
          return isAssignment;
        }
        
        return false;
      });
      
      // Remove duplicates: first check by ID, then by content
      const seen = new Map();
      const uniqueActivities = messageActivities.filter(activity => {
        // Skip if already rendered (by ID)
        if (renderedMessageIds.has(activity.id)) {
          return false;
        }
        
        // For created type, only keep the first one globally
        if (activity.type === 'created') {
          if (seen.has('created')) return false;
          seen.set('created', activity.id);
          return true;
        }
        
        // For other types, check for duplicates by content + time
        const description = (activity.description || '').trim();
        const baseKey = `${activity.type}_${description}`;
        const timestamp = new Date(activity.created_at).getTime();
        
        // Check if we've seen this exact content before
        const existing = seen.get(baseKey);
        if (existing) {
          // If same content exists, check if it's within 5 seconds (likely duplicate)
          const existingTimestamp = existing.timestamp;
          const timeDiff = Math.abs(timestamp - existingTimestamp);
          if (timeDiff < 5000) { // 5 seconds
            return false; // Duplicate
          }
        }
        
        // Store this activity
        seen.set(baseKey, { id: activity.id, timestamp });
        return true;
      });
      
      // Sort by created_at (oldest first)
      uniqueActivities.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      // Render only new activities
      uniqueActivities.forEach(activity => {
        // Transform assignment status_changed to friendly message
        if (activity.type === 'status_changed') {
          activity.description = 'Gekoppeld aan geschikt bedrijf';
        }
        
        renderChatMessage(activity, false); // Don't auto-scroll on polling
      });
      
      // Restore scroll position or scroll to bottom if user was at bottom
      if (messagesArea) {
        if (wasAtBottom) {
          // User was at bottom, scroll to new bottom
          messagesArea.scrollTop = messagesArea.scrollHeight;
        } else {
          // User was scrolled up, maintain position
          const newScrollHeight = messagesArea.scrollHeight;
          const scrollDiff = newScrollHeight - previousScrollHeight;
          if (scrollDiff > 0) {
            messagesArea.scrollTop += scrollDiff;
          }
        }
      }
      
    } catch (error) {
      console.error('Error loading chat messages:', error);
    }
  }

  async function sendChatMessage() {
    const input = document.getElementById('chatMessageInput');
    const sendBtn = document.getElementById('chatSendBtn');
    
    if (!input || !sendBtn) return;
    
    const message = input.value.trim();
    if (!message) return;
    
    // Show loading state
    setLoading(sendBtn, true);
    input.disabled = true;
    sendBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>';
    
    try {
      const response = await fetch(`/dashboard/api/leads/${leadId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          message
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Clear input
        input.value = '';
        
        // Reload messages immediately and scroll to bottom
        await loadChatAndTimeline(false);
        
        // Scroll to bottom after sending message
        const messagesArea = document.getElementById('chatMessages')?.closest('.messages-area');
        if (messagesArea) {
          messagesArea.scrollTop = messagesArea.scrollHeight;
        }
      } else {
        // Only show error toast
        showToast(data.message || 'Fout bij verzenden', 'error');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Er is een fout opgetreden', 'error');
    } finally {
      // Reset loading state
      setLoading(sendBtn, false);
      sendBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path></svg>';
      input.disabled = false;
      input.focus();
    }
  }

  // Chat event listeners
  document.getElementById('chatSendBtn')?.addEventListener('click', sendChatMessage);
  document.getElementById('chatMessageInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // Channel selector removed - always sends email + WhatsApp automatically

  // ============================================
  // Activity Timeline
  // ============================================

  function getActivityIcon(type) {
    const icons = {
      'phone_call': '📞',
      'email_sent': '📧',
      'whatsapp': '💬',
      'meeting': '📅',
      'status_change_contacted': '✅',
      'note': '📝',
      'message': '💬',
      'created': '➕',
      'status_changed': '🔄',
      'appointment_attended': '✅',
      'no_show_customer': '⚠️',
      'status_change_won': '🏆',
      'status_change_lost': '❌'
    };
    return icons[type] || '📌';
  }

  function renderTimelineItem(activity, index = 0) {
    const timelineContainer = document.getElementById('timelineItems');
    if (!timelineContainer) return;

    // Check if already rendered by ID
    if (renderedActivityIds.has(activity.id)) {
      return;
    }
    
    // Also check if DOM element already exists (double safety)
    const existingItem = timelineContainer.querySelector(`[data-activity-id="${activity.id}"]`);
    if (existingItem) {
      renderedActivityIds.add(activity.id); // Mark as rendered
      return;
    }

    const item = document.createElement('div');
    item.className = 'activity-item';
    item.dataset.activityId = activity.id; // Store ID for tracking
    
    // Indicator wrapper with line
    const indicatorWrapper = document.createElement('div');
    indicatorWrapper.className = 'activity-indicator-wrapper';
    
    const indicator = document.createElement('div');
    indicator.className = `activity-indicator ${index === 0 ? 'activity-current' : 'activity-past'}`;
    
    const dot = document.createElement('div');
    dot.className = 'indicator-dot';
    indicator.appendChild(dot);
    
    const line = document.createElement('div');
    line.className = 'activity-line';
    
    indicatorWrapper.appendChild(indicator);
    indicatorWrapper.appendChild(line);
    
    // Content
    const content = document.createElement('div');
    content.className = 'activity-content';
    
    const title = document.createElement('p');
    title.className = 'activity-title';
    
    // Format activity description nicely
    let description = activity.description || activity.type;
    
    // Handle created type - show as "Aanvraag ingediend"
    if (activity.type === 'created') {
      description = 'Aanvraag ingediend';
    }
    
    // Handle message and whatsapp types - show as "lead id heeft een bericht gestuurd" or "customer heeft een bericht gestuurd"
    // Note: These should be filtered out in loadTimeline, but handle them here just in case they slip through
    if (activity.type === 'message' || activity.type === 'whatsapp') {
      // Determine if it's from partner (lead) or customer
      const isPartner = activity.metadata?.channel === 'dashboard' || 
                       (activity.type === 'message' && activity.metadata?.channel !== 'whatsapp') ||
                       (activity.type === 'whatsapp' && activity.metadata?.direction === 'outbound');
      
      if (isPartner) {
        // Partner/lead sent message - use leadId from scope
        description = `${leadId} heeft een bericht gestuurd`;
      } else {
        // Customer sent message
        description = 'Customer heeft een bericht gestuurd';
      }
    }
    
    // Improve status_changed messages - change "Status" to "Label"
    if (activity.type === 'status_changed' && description) {
      // Convert status values to Dutch
      const statusMap = {
        'new': 'Nieuw',
        'accepted': 'Geaccepteerd',
        'in_progress': 'In behandeling',
        'won': 'Opdracht gewonnen',
        'lost': 'Opdracht verloren',
        'rejected': 'Afgewezen',
        'completed': 'Voltooid'
      };
      
      // Try to extract status from description
      const statusMatch = description.match(/naar\s+([^,\.\n]+)/i) || description.match(/to\s+([^,\.\n]+)/i);
      if (statusMatch) {
        const statusKey = statusMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
        // Check if it's a predefined status
        if (statusMap[statusKey]) {
          description = `Label gewijzigd naar ${statusMap[statusKey]}`;
        } else {
          // Custom status - format nicely
          const customStatus = statusMatch[1].trim().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          description = `Label gewijzigd naar ${customStatus}`;
        }
      } else {
        description = description.replace(/status.*changed.*to/gi, 'Label gewijzigd naar');
        description = description.replace(/status.*gewijzigd.*naar/gi, 'Label gewijzigd naar');
        description = description.replace(/label.*gewijzigd.*naar/gi, 'Label gewijzigd naar');
      }
    }
    
    // Capitalize first letter
    description = description.charAt(0).toUpperCase() + description.slice(1);
    
    title.textContent = description;
    
    const time = document.createElement('p');
    time.className = 'activity-time';
    const timeText = formatDate(activity.created_at);
    time.textContent = timeText;
    
    content.appendChild(title);
    content.appendChild(time);
    
    item.appendChild(indicatorWrapper);
    item.appendChild(content);
    
    // Store activity timestamp for sorting
    item.dataset.timestamp = new Date(activity.created_at).getTime();
    
    // Append to container (we'll sort after all items are added)
    timelineContainer.appendChild(item);
    
    // Mark as rendered
    renderedActivityIds.add(activity.id);
  }

  async function loadTimeline(activities = null, isInitialLoad = false) {
    const timelineContainer = document.getElementById('timelineItems');
    const skeleton = document.getElementById('timelineSkeleton');
    
    if (!timelineContainer) return;
    
    // timelineContainer IS the scrollable .activities-list element
    // Preserve scroll position
    const previousScrollTop = timelineContainer.scrollTop;
    const previousScrollHeight = timelineContainer.scrollHeight;
    
    // Prevent showing skeleton if already loading or if we have activities
    if (isLoadingTimeline && !activities) return;
    
    // Show skeleton loader only on initial load
    if (isInitialLoad && skeleton && skeleton.style.display !== 'flex') {
      isLoadingTimeline = true;
      skeleton.style.display = 'flex';
    }
    
    try {
      // Use provided activities or fetch new
      const activitiesData = activities || await loadActivitiesData();
      
      // Hide skeleton loader
      if (skeleton) {
        skeleton.style.display = 'none';
        isLoadingTimeline = false;
      }
      
      // Filter activities for timeline: exclude message and whatsapp types
      // On initial load, also exclude status_changed (only show created)
      // On polling, include status_changed (user-initiated changes)
      let timelineActivities = activitiesData.filter(a => {
        // Exclude chat messages (message and whatsapp types)
        if (a.type === 'message' || a.type === 'whatsapp') {
          return false;
        }
        
        // On initial load, exclude status_changed (only show created)
        if (isInitialLoad && a.type === 'status_changed') {
          return false;
        }
        
        // Include everything else
        return true;
      });
      
      // Sort by created_at FIRST (newest first for timeline)
      timelineActivities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      // Remove duplicates: for 'created' type, only keep the newest one (first after sort)
      // Also remove any other duplicates based on ID
      const seen = new Map();
      const seenIds = new Set();
      timelineActivities = timelineActivities.filter(activity => {
        // For 'created' type, only keep the first one (newest after sort)
        if (activity.type === 'created') {
          if (seen.has('created')) {
            return false; // Skip duplicate created
          }
          seen.set('created', true);
          seenIds.add(activity.id);
          return true;
        }
        
        // For other types, check for duplicates by ID (most reliable)
        if (seenIds.has(activity.id)) {
          return false; // Skip duplicate by ID
        }
        seenIds.add(activity.id);
        
        return true;
      });
      
      // Only clear on initial load
      if (isInitialLoad) {
        // Clear existing items and reset tracking
        const existingItems = timelineContainer.querySelectorAll('.activity-item');
        existingItems.forEach(item => item.remove());
        renderedActivityIds.clear();
        
        // Render all activities (they will be appended)
        timelineActivities.forEach((activity) => {
          renderTimelineItem(activity, 0); // Index will be updated after sorting
        });
        
        // After rendering all items, sort them by timestamp and update indices
        const allItems = Array.from(timelineContainer.querySelectorAll('.activity-item'));
        
        // Sort by timestamp (newest first)
        allItems.sort((a, b) => {
          const timeA = parseInt(a.dataset.timestamp) || 0;
          const timeB = parseInt(b.dataset.timestamp) || 0;
          return timeB - timeA; // Newest first
        });
        
        // Clear container and re-append in sorted order
        timelineContainer.innerHTML = '';
        
        // Re-append in sorted order and update classes (index 0 = newest = orange)
        allItems.forEach((item, index) => {
          timelineContainer.appendChild(item);
          const indicator = item.querySelector('.activity-indicator');
          if (indicator) {
            indicator.className = `activity-indicator ${index === 0 ? 'activity-current' : 'activity-past'}`;
          }
        });
      } else {
        // On polling: sync renderedActivityIds with existing DOM elements first
        // This ensures we don't add duplicates even if the Set gets out of sync
        const existingItems = timelineContainer.querySelectorAll('.activity-item[data-activity-id]');
        existingItems.forEach(item => {
          const activityId = item.dataset.activityId;
          if (activityId) {
            renderedActivityIds.add(activityId);
          }
        });
        // On polling, only render new activities
        const newActivities = timelineActivities.filter(a => !renderedActivityIds.has(a.id));
        
        if (newActivities.length > 0) {
          // Render new activities at the beginning
          newActivities.forEach((activity) => {
            // New items go at the beginning, so they get index 0
            renderTimelineItem(activity, 0);
          });
          
          // After adding new items, re-sort all items and update indices
          const allItems = Array.from(timelineContainer.querySelectorAll('.activity-item'));
          
          // Sort by timestamp (newest first)
          allItems.sort((a, b) => {
            const timeA = parseInt(a.dataset.timestamp) || 0;
            const timeB = parseInt(b.dataset.timestamp) || 0;
            return timeB - timeA; // Newest first
          });
          
          // Clear container and re-append in sorted order
          timelineContainer.innerHTML = '';
          
          // Re-append in sorted order and update classes
          allItems.forEach((item, index) => {
            timelineContainer.appendChild(item);
            const indicator = item.querySelector('.activity-indicator');
            if (indicator) {
              indicator.className = `activity-indicator ${index === 0 ? 'activity-current' : 'activity-past'}`;
            }
          });
        }
      }
      
      // Restore scroll position
      if (!isInitialLoad && previousScrollTop > 0) {
        const newScrollHeight = timelineContainer.scrollHeight;
        const scrollDiff = newScrollHeight - previousScrollHeight;
        if (scrollDiff > 0) {
          timelineContainer.scrollTop = previousScrollTop + scrollDiff;
        } else {
          timelineContainer.scrollTop = previousScrollTop;
        }
      }
      
    } catch (error) {
      console.error('Error loading timeline:', error);
      // Hide skeleton on error
      if (skeleton) skeleton.style.display = 'none';
    }
  }

  // Load both chat and timeline together
  async function loadChatAndTimeline(isInitialLoad = false) {
    const chatSkeleton = document.getElementById('chatSkeleton');
    const timelineSkeleton = document.getElementById('timelineSkeleton');
    
    // Show both skeleton loaders only on initial load
    if (isInitialLoad) {
      if (chatSkeleton) chatSkeleton.style.display = 'flex';
      if (timelineSkeleton) timelineSkeleton.style.display = 'flex';
    }
    
    try {
      // Fetch activities once
      const activities = await loadActivitiesData();
      
      // Load both components with the same data
      await Promise.all([
        loadChatMessages(activities, isInitialLoad),
        loadTimeline(activities, isInitialLoad)
      ]);
    } catch (error) {
      console.error('Error loading chat and timeline:', error);
      // Hide skeletons on error
      if (chatSkeleton) chatSkeleton.style.display = 'none';
      if (timelineSkeleton) timelineSkeleton.style.display = 'none';
    }
  }

  // ============================================
  // Action Buttons
  // ============================================

  async function handleActivity(type) {
    const button = document.querySelector(`[data-type="${type}"]`);
    if (!button) return;

    setLoading(button, true);

    // Open external link if available
    if (type === 'phone_call' && leadData.phone) {
      window.open(`tel:${leadData.phone}`, '_blank');
    } else if (type === 'email_sent' && leadData.email) {
      window.open(`mailto:${leadData.email}`, '_blank');
    } else if (type === 'whatsapp' && leadData.phone) {
      const phone = leadData.phone.replace(/[^0-9]/g, '');
      window.open(`https://wa.me/${phone}`, '_blank');
    }

    try {
      const response = await fetch(`/dashboard/api/leads/${leadId}/activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ type })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('Activiteit geregistreerd', 'success');
        await loadChatAndTimeline(false);
      } else {
        showToast(data.message || 'Fout bij registreren', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Er is een fout opgetreden', 'error');
    } finally {
      setLoading(button, false);
    }
  }

  async function updateStatus(status, dealValue = null) {
    const button = document.querySelector(`[data-status="${status}"]`);
    if (!button) return;

    setLoading(button, true);

    try {
      const response = await fetch(`/dashboard/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ 
          status,
          deal_value: dealValue 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('Status bijgewerkt', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showToast(data.message || 'Fout bij bijwerken', 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('Er is een fout opgetreden', 'error');
    } finally {
      setLoading(button, false);
    }
  }

  // Action button event listeners
  document.getElementById('btnPhoneCall')?.addEventListener('click', () => handleActivity('phone_call'));
  document.getElementById('btnWhatsapp')?.addEventListener('click', () => handleActivity('whatsapp'));
  document.getElementById('btnEmailSent')?.addEventListener('click', () => handleActivity('email_sent'));
  document.getElementById('btnMeeting')?.addEventListener('click', () => handleActivity('meeting'));

  document.getElementById('btnWon')?.addEventListener('click', () => {
    const modal = document.getElementById('dealValueModal');
    if (modal) {
      modal.classList.add('show');
      document.getElementById('dealValueInput').value = '';
    }
  });

  document.getElementById('btnLost')?.addEventListener('click', () => {
    if (confirm('Weet je zeker dat je deze aanvraag wilt markeren als "Geen opdracht"?')) {
      updateStatus('lost');
    }
  });

  // Deal value modal
  const dealValueModal = document.getElementById('dealValueModal');
  const dealValueInput = document.getElementById('dealValueInput');
  const saveDealValueBtn = document.getElementById('saveDealValue');
  const cancelDealValueBtn = document.getElementById('cancelDealValue');
  const closeDealValueModal = document.getElementById('closeDealValueModal');

  function closeDealValueModalFunc() {
    if (dealValueModal) {
      dealValueModal.classList.remove('show');
    }
  }

  saveDealValueBtn?.addEventListener('click', () => {
    const value = dealValueInput.value ? parseFloat(dealValueInput.value) : null;
    closeDealValueModalFunc();
    updateStatus('won', value);
  });

  cancelDealValueBtn?.addEventListener('click', closeDealValueModalFunc);
  closeDealValueModal?.addEventListener('click', closeDealValueModalFunc);

  dealValueModal?.addEventListener('click', (e) => {
    if (e.target === dealValueModal) {
      closeDealValueModalFunc();
    }
  });

  // ============================================
  // Auto-refresh (polling)
  // ============================================

  function startPolling() {
    // Only poll when page is visible and user is active
    // Poll every 30 seconds instead of 5 to reduce load
    // Only fetch if page is visible
    if (document.hidden) return;
    
    activitiesPollInterval = setInterval(async () => {
      // Only poll if page is visible
      if (document.hidden) {
        stopPolling();
        return;
      }
      
      // Only update if there are actually new items (check before fetching)
      await loadChatAndTimeline(false); // false = not initial load
    }, 30000); // 30 seconds instead of 5
  }

  function stopPolling() {
    if (activitiesPollInterval) {
      clearInterval(activitiesPollInterval);
      activitiesPollInterval = null;
    }
  }

  // Only poll when page is visible
  // Stop when page is hidden (tab switch)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      // Only start polling if not already running
      if (!activitiesPollInterval) {
        startPolling();
      }
    }
  });
  
  // Also stop polling when window loses focus (optional, reduces load)
  window.addEventListener('blur', () => {
    stopPolling();
  });
  
  window.addEventListener('focus', () => {
    // Only start polling if not already running and page is visible
    if (!activitiesPollInterval && !document.hidden) {
      startPolling();
    }
  });

  // ============================================
  // Initialize
  // ============================================

  // ============================================
  // Status Dropdown Handler
  // ============================================
  
  async function updateLeadStatus(leadId, newStatus) {
    if (!leadId) {
      console.error('No leadId provided to updateLeadStatus');
      showToast('Lead ID ontbreekt', 'error');
      return;
    }
    
    if (!newStatus) {
      console.error('No status provided to updateLeadStatus');
      showToast('Status ontbreekt', 'error');
      return;
    }
    
    const url = `/dashboard/api/leads/${leadId}/status`;
    console.log('Updating lead status:', { leadId, newStatus, url });
    
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          status: newStatus
        })
      });
      
      console.log('Status update response:', response.status, response.statusText);
      
      if (!response.ok) {
        // Try to parse error message
        let errorMessage = 'Fout bij bijwerken status';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || `HTTP ${response.status}`;
        }
        
        console.error('Status update failed:', response.status, errorMessage);
        showToast(errorMessage, 'error');
        return;
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Reload chat and timeline to show status change activity
        await loadChatAndTimeline(false);
        
        // Update status select background color
        updateStatusSelectColor(newStatus);
      } else {
        showToast(data.message || 'Fout bij bijwerken status', 'error');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Er is een fout opgetreden bij het verbinden met de server', 'error');
    }
  }
  
  function updateStatusSelectColor(status) {
    const button = document.getElementById('statusSelectButton');
    if (!button) return;
    
    // Remove all status classes
    button.className = 'status-select-button';
    
    // Add status-specific class
    button.classList.add(`status-${status}`);
  }
  
  function updateStatusButtonText(text) {
    const button = document.getElementById('statusSelectButton');
    if (button) {
      button.textContent = text;
    }
  }
  
  function showCustomStatusModal(leadId, statusButton, statusMenu) {
    const modal = document.getElementById('customStatusModal');
    const input = document.getElementById('customStatusInput');
    const closeBtn = document.getElementById('customStatusModalClose');
    const cancelBtn = document.getElementById('customStatusModalCancel');
    const saveBtn = document.getElementById('customStatusModalSave');
    
    if (!modal || !input || !closeBtn || !cancelBtn || !saveBtn) return;
    
    // Show modal
    modal.style.display = 'flex';
    input.value = '';
    input.focus();
    
    // Close handlers
    const closeModal = () => {
      modal.style.display = 'none';
      input.value = '';
      // Clean up event listeners
      closeBtn.removeEventListener('click', closeModal);
      cancelBtn.removeEventListener('click', closeModal);
      saveBtn.removeEventListener('click', handleSave);
      input.removeEventListener('keydown', handleEnter);
      document.removeEventListener('keydown', handleEscape);
      if (overlay) {
        overlay.removeEventListener('click', closeModal);
      }
    };
    
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    
    // Close on overlay click
    const overlay = modal.querySelector('.custom-status-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', closeModal);
    }
    
    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Save handler
    const handleSave = async () => {
      const customStatus = input.value.trim();
      
      if (!customStatus) {
        input.focus();
        return;
      }
      
      // Disable save button while updating
      saveBtn.disabled = true;
      saveBtn.textContent = 'Opslaan...';
      
      try {
        // Normalize custom status (lowercase, spaces to underscores)
        const normalizedStatus = customStatus.toLowerCase().replace(/\s+/g, '_');
        
        // Disable status button while updating
        statusButton.disabled = true;
        
        await updateLeadStatus(leadId, normalizedStatus);
        
        // Update button text and color
        const customStatusDisplay = customStatus;
        updateStatusButtonText(customStatusDisplay);
        updateStatusSelectColor(normalizedStatus);
        statusButton.dataset.currentStatus = normalizedStatus;
        
        // Add custom option to menu if it doesn't exist
        const existingItem = statusMenu.querySelector(`[data-value="${normalizedStatus}"]`);
        if (!existingItem) {
          const separator = statusMenu.querySelector('.separator');
          const customItem = document.createElement('div');
          customItem.className = 'status-dropdown-item selected';
          customItem.dataset.status = normalizedStatus;
          customItem.dataset.value = normalizedStatus;
          customItem.textContent = customStatusDisplay;
          if (separator) {
            statusMenu.insertBefore(customItem, separator);
          } else {
            statusMenu.appendChild(customItem);
          }
        } else {
          // Update existing item
          existingItem.classList.add('selected');
          statusMenu.querySelectorAll('.status-dropdown-item').forEach(i => {
            if (i !== existingItem && !i.classList.contains('separator')) {
              i.classList.remove('selected');
            }
          });
        }
        
        statusButton.disabled = false;
        
        // Close modal
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      } catch (error) {
        console.error('Error saving custom status:', error);
        showToast('Er is een fout opgetreden bij het opslaan van de status', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Opslaan';
      }
    };
    
    saveBtn.addEventListener('click', handleSave);
    
    // Save on Enter key
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    });
    
    // Clean up event listeners when modal closes
    const originalClose = closeModal;
    closeModal = () => {
      originalClose();
      closeBtn.removeEventListener('click', originalClose);
      cancelBtn.removeEventListener('click', originalClose);
      saveBtn.removeEventListener('click', handleSave);
      if (overlay) {
        overlay.removeEventListener('click', originalClose);
      }
    };
  }
  
  function initStatusDropdown() {
    const dropdown = document.getElementById('statusDropdown');
    const button = document.getElementById('statusSelectButton');
    const menu = document.getElementById('statusDropdownMenu');
    
    if (!dropdown || !button || !menu) return;
    
    // Get leadId from dropdown dataset or fallback to URL
    let leadId = dropdown.dataset.leadId;
    if (!leadId) {
      // Fallback to global leadId from URL
      leadId = window.location.pathname.split('/').pop();
      if (leadId) {
        dropdown.dataset.leadId = leadId; // Store it for future use
      }
    }
    
    if (!leadId) {
      console.error('No leadId found for status dropdown');
      return;
    }
    
    const currentStatus = button.dataset.currentStatus;
    
    // Set initial color
    updateStatusSelectColor(currentStatus);
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
    
    // Toggle dropdown on button click
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    
    // Handle menu item clicks
    menu.addEventListener('click', async (e) => {
      const item = e.target.closest('.status-dropdown-item');
      if (!item || item.classList.contains('separator') || item.classList.contains('disabled')) {
        return;
      }
      
      const newStatus = item.dataset.value;
      if (!newStatus) return;
      
      // Close dropdown
      dropdown.classList.remove('open');
      
      if (newStatus === 'custom_input') {
        // Show modal for custom status
        showCustomStatusModal(leadId, button, menu);
        return;
      }
      
      // Disable button while updating
      button.disabled = true;
      
      await updateLeadStatus(leadId, newStatus);
      
      // Update button text and color
      const statusLabels = {
        'new': 'Nieuw',
        'accepted': 'Geaccepteerd',
        'in_progress': 'In behandeling',
        'won': 'Opdracht gewonnen',
        'lost': 'Opdracht verloren',
        'rejected': 'Afgewezen',
        'completed': 'Voltooid'
      };
      updateStatusButtonText(statusLabels[newStatus] || newStatus);
      updateStatusSelectColor(newStatus);
      button.dataset.currentStatus = newStatus;
      
      // Update selected state in menu
      menu.querySelectorAll('.status-dropdown-item').forEach(i => {
        if (i.dataset.value === newStatus) {
          i.classList.add('selected');
        } else if (!i.classList.contains('separator')) {
          i.classList.remove('selected');
        }
      });
      
      button.disabled = false;
    });
  }

  function initPhoneReveal() {
    const card = document.getElementById('phoneRevealCard');
    const revealBtn = document.getElementById('phoneRevealButton');
    const initialState = document.getElementById('phoneRevealInitial');
    const contentState = document.getElementById('phoneRevealContent');
    const callBtn = document.getElementById('phoneCallBtn');
    const copyBtn = document.getElementById('phoneCopyBtn');
    const markBtn = document.getElementById('phoneMarkCalledBtn');
    const calledBadge = document.getElementById('phoneCalledBadge');
    const phoneNumberEl = document.getElementById('phoneNumberDisplay');
    const toast = document.getElementById('phoneToast');
    
    if (!card || !revealBtn) return;
    
    const phoneNumber = card.dataset.phone || '';
    const leadId = card.dataset.leadId || '';
    
    // Format phone number for display
    function formatPhoneNumber(phone) {
      if (!phone || !phone.trim()) return 'Geen telefoonnummer';
      const cleaned = phone.replace(/\D/g, '');
      if (!cleaned) return phone;
      
      // Format as +31 6 1234 5678 (Dutch format)
      if (cleaned.startsWith('31') && cleaned.length >= 10) {
        const country = cleaned.slice(0, 2);
        const area = cleaned.slice(2, 3);
        const part1 = cleaned.slice(3, 7);
        const part2 = cleaned.slice(7);
        return `+${country} ${area} ${part1} ${part2}`;
      } else if (cleaned.startsWith('0') && cleaned.length >= 10) {
        const area = cleaned.slice(1, 2);
        const part1 = cleaned.slice(2, 6);
        const part2 = cleaned.slice(6);
        return `+31 ${area} ${part1} ${part2}`;
      } else if (cleaned.length >= 9 && cleaned.startsWith('6')) {
        const part1 = cleaned.slice(1, 5);
        const part2 = cleaned.slice(5);
        return `+31 6 ${part1} ${part2}`;
      }
      return phone;
    }
    
    // Show toast notification
    function showToast(message) {
      if (!toast) return;
      toast.textContent = message;
      toast.style.display = 'block';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 3000);
    }
    
    // Check if already called (from localStorage)
    const calledKey = `lead_${leadId}_called`;
    const isCalled = localStorage.getItem(calledKey) === 'true';
    
    if (isCalled && phoneNumber) {
      initialState.style.display = 'none';
      contentState.style.display = 'block';
      if (phoneNumberEl) {
        phoneNumberEl.textContent = formatPhoneNumber(phoneNumber);
      }
      if (calledBadge) {
        calledBadge.style.display = 'inline-block';
      }
    }
    
    // Reveal phone number
    revealBtn.addEventListener('click', function() {
      if (!phoneNumber || !phoneNumber.trim()) {
        showToast('Geen telefoonnummer beschikbaar');
        return;
      }
      initialState.style.display = 'none';
      contentState.style.display = 'block';
      if (phoneNumberEl) {
        phoneNumberEl.textContent = formatPhoneNumber(phoneNumber);
      }
    });
    
    // Call action
    if (callBtn) {
      callBtn.addEventListener('click', function() {
        if (!phoneNumber || !phoneNumber.trim()) {
          showToast('Geen telefoonnummer beschikbaar');
          return;
        }
        const cleaned = phoneNumber.replace(/\D/g, '');
        if (!cleaned) {
          showToast('Ongeldig telefoonnummer');
          return;
        }
        let telNumber = cleaned;
        if (cleaned.startsWith('0')) {
          telNumber = '31' + cleaned.slice(1);
        } else if (cleaned.startsWith('6') && !cleaned.startsWith('31')) {
          telNumber = '316' + cleaned.slice(1);
        }
        window.location.href = 'tel:+' + telNumber;
      });
    }
    
    // Copy to clipboard
    if (copyBtn) {
      copyBtn.addEventListener('click', function() {
        const formatted = phoneNumberEl ? phoneNumberEl.textContent : phoneNumber;
        navigator.clipboard.writeText(formatted).then(function() {
          showToast('Telefoonnummer gekopieerd!');
        }).catch(function() {
          // Fallback
          const textArea = document.createElement('textarea');
          textArea.value = formatted;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          try {
            document.execCommand('copy');
            showToast('Telefoonnummer gekopieerd!');
          } catch (err) {
            showToast('Kon telefoonnummer niet kopiëren');
          }
          document.body.removeChild(textArea);
        });
      });
    }
    
    // Mark as called
    if (markBtn) {
      markBtn.addEventListener('click', async function() {
        localStorage.setItem(calledKey, 'true');
        if (calledBadge) {
          calledBadge.style.display = 'inline-block';
        }
        showToast('Gemarkeerd als gebeld');
        
        // Log activity to backend
        try {
          const response = await fetch(`/dashboard/api/leads/${leadId}/activity`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              type: 'phone_call'
            })
          });
          
          if (response.ok) {
            await loadChatAndTimeline(false);
          }
        } catch (error) {
          console.error('Error logging phone call activity:', error);
        }
      });
    }
  }
  
  async function init() {
    // Initialize status dropdown
    initStatusDropdown();
    
    // Initialize phone reveal
    initPhoneReveal();
    
    // Initial load - clear everything and start fresh
    await loadChatAndTimeline(true);
    
    // Only start polling if page is visible
    // Don't start immediately - wait a bit to avoid duplicate fetches
    if (!document.hidden) {
      // Wait 2 seconds before starting polling to avoid immediate duplicate fetch
      setTimeout(() => {
        if (!document.hidden && !activitiesPollInterval) {
          startPolling();
        }
      }, 2000);
    }
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

