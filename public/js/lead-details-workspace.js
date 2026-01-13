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
  let currentChannel = 'dashboard';
  let activitiesPollInterval = null;
  let messagesPollInterval = null;

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
    return date.toLocaleDateString('nl-NL', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  function renderChatMessage(activity) {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    const isPartner = activity.metadata?.channel === 'dashboard' || activity.type === 'message';
    const isSystem = activity.type === 'created' || activity.type === 'status_changed';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isPartner ? 'partner' : isSystem ? 'system' : 'customer'}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = activity.description || activity.type;
    
    const time = document.createElement('div');
    time.className = 'chat-message-time';
    time.textContent = formatTime(activity.created_at);
    
    messageDiv.appendChild(bubble);
    messageDiv.appendChild(time);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function loadChatMessages() {
    try {
      const response = await fetch(`/dashboard/api/leads/${leadId}/activities`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to load activities');
      
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      
      const messagesContainer = document.getElementById('chatMessages');
      if (!messagesContainer) return;
      
      // Clear existing messages (except initial customer message)
      const existingMessages = messagesContainer.querySelectorAll('.chat-message');
      existingMessages.forEach((msg, index) => {
        if (index > 0) msg.remove(); // Keep first message (customer initial message)
      });
      
      // Filter and render message activities
      const messageActivities = data.activities.filter(a => 
        a.type === 'message' || a.type === 'created' || a.type === 'status_changed'
      );
      
      messageActivities.forEach(activity => {
        renderChatMessage(activity);
      });
      
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
    
    setLoading(sendBtn, true);
    input.disabled = true;
    
    try {
      const response = await fetch(`/dashboard/api/leads/${leadId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          message,
          channel: currentChannel
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        input.value = '';
        showToast(data.message || 'Bericht verzonden', 'success');
        
        // Reload messages
        await loadChatMessages();
        await loadTimeline();
      } else {
        showToast(data.message || 'Fout bij verzenden', 'error');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Er is een fout opgetreden', 'error');
    } finally {
      setLoading(sendBtn, false);
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

  // Channel selector
  document.querySelectorAll('.chat-channel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chat-channel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentChannel = btn.dataset.channel;
    });
  });

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

  function renderTimelineItem(activity) {
    const timelineContainer = document.getElementById('timelineItems');
    if (!timelineContainer) return;

    const item = document.createElement('div');
    item.className = 'timeline-item';
    
    const icon = document.createElement('div');
    icon.className = `timeline-icon ${activity.type}`;
    icon.textContent = getActivityIcon(activity.type);
    
    const content = document.createElement('div');
    content.className = 'timeline-content';
    
    const description = document.createElement('div');
    description.className = 'timeline-description';
    description.textContent = activity.description || activity.type;
    
    const meta = document.createElement('div');
    meta.className = 'timeline-meta';
    
    const time = document.createElement('span');
    time.className = 'timeline-time';
    time.textContent = formatDate(activity.created_at);
    
    if (activity.created_by_info) {
      const user = document.createElement('span');
      user.textContent = ` • ${activity.created_by_info.name}`;
      meta.appendChild(user);
    }
    
    meta.appendChild(time);
    content.appendChild(description);
    content.appendChild(meta);
    
    item.appendChild(icon);
    item.appendChild(content);
    timelineContainer.appendChild(item);
  }

  async function loadTimeline() {
    try {
      const response = await fetch(`/dashboard/api/leads/${leadId}/activities`, {
        credentials: 'include'
      });
      
      if (!response.ok) throw new Error('Failed to load activities');
      
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      
      const timelineContainer = document.getElementById('timelineItems');
      if (!timelineContainer) return;
      
      // Clear existing items
      timelineContainer.innerHTML = '';
      
      // Render all activities
      data.activities.forEach(activity => {
        renderTimelineItem(activity);
      });
      
    } catch (error) {
      console.error('Error loading timeline:', error);
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
        await loadTimeline();
        await loadChatMessages();
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
    // Poll every 5 seconds
    activitiesPollInterval = setInterval(async () => {
      await loadTimeline();
      await loadChatMessages();
    }, 5000);
  }

  function stopPolling() {
    if (activitiesPollInterval) {
      clearInterval(activitiesPollInterval);
      activitiesPollInterval = null;
    }
  }

  // Start polling when page loads
  // Stop when page is hidden (tab switch)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
    }
  });

  // ============================================
  // Initialize
  // ============================================

  async function init() {
    await loadTimeline();
    await loadChatMessages();
    startPolling();
  }

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

