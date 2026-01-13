// Ticket Detail Page JavaScript
(function() {
  'use strict';

  const pageElement = document.querySelector('.user-detail-page');
  const ticketId = pageElement?.dataset?.ticketId || window.ticketData?.id;
  if (!ticketId) {
    console.error('❌ Ticket ID not found');
    return;
  }

  const ticketData = window.ticketData || {};
  const isAdmin = window.isUserAdmin || false;
  const employees = window.employees || [];
  let currentTab = 'overview';
  let showInternalComments = false;

  // Initialize
  function initialize() {
    console.log('🔧 Ticket Detail Page: Initializing...', { ticketId, isAdmin });
    
    if (!ticketId) {
      console.error('❌ Ticket ID not found');
      return;
    }
    
    // Load all data
    loadTicketData();
    loadComments();
    loadAttachments();
    if (isAdmin) {
      loadActivityLog();
      loadWatchers();
    }
    loadTimeline();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('✅ Ticket Detail Page: Initialized');
  }

  // Tab switching
  window.switchTab = function(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.service-tab-btn').forEach(btn => {
      btn.classList.remove('active');
      btn.style.borderBottomColor = 'transparent';
      btn.style.color = '#6b7280';
    });
    
    const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.style.borderBottomColor = '#2563eb';
      activeBtn.style.color = '#2563eb';
    }
    
    // Update tab contents
    document.querySelectorAll('.service-tab-content').forEach(content => {
      content.style.display = 'none';
    });
    
    const activeContent = document.getElementById(`tab-${tabName}`);
    if (activeContent) {
      activeContent.style.display = 'block';
    }
    
    // Load data for tab if needed
    if (tabName === 'comments') {
      loadComments();
    } else if (tabName === 'attachments') {
      loadAttachments();
    } else if (tabName === 'activity' && isAdmin) {
      loadActivityLog();
    }
  };

  // Load full ticket data
  async function loadTicketData() {
    try {
      const response = await fetch(`/admin/api/admin/tickets/${ticketId}`);
      if (!response.ok) throw new Error('Failed to load ticket');
      
      const data = await response.json();
      
      // Update KPI cards
      updateKPICards(data.ticket);
      
      // Update quick actions based on status
      updateQuickActions(data.ticket.status);
      
    } catch (error) {
      console.error('Error loading ticket data:', error);
      if (window.showNotification) {
        window.showNotification('Fout bij laden ticket', 'error', 3000);
      }
    }
  }

  // Update KPI cards
  function updateKPICards(ticket) {
    const commentCountEl = document.getElementById('commentCount');
    if (commentCountEl) {
      commentCountEl.textContent = ticket.comment_count || 0;
    }
    
    const lastActivityEl = document.getElementById('lastActivity');
    if (lastActivityEl && ticket.last_activity_at) {
      lastActivityEl.textContent = formatRelativeTime(ticket.last_activity_at);
    }
  }

  // Update quick actions
  function updateQuickActions(status) {
    const resolveBtn = document.getElementById('quickResolveBtn');
    const closeBtn = document.getElementById('quickCloseBtn');
    const reopenBtn = document.getElementById('quickReopenBtn');
    
    if (status === 'resolved' || status === 'closed') {
      if (resolveBtn) resolveBtn.style.display = 'none';
      if (closeBtn) closeBtn.style.display = 'none';
      if (reopenBtn) reopenBtn.style.display = 'block';
    } else {
      if (resolveBtn) resolveBtn.style.display = 'block';
      if (closeBtn) closeBtn.style.display = 'block';
      if (reopenBtn) reopenBtn.style.display = 'none';
    }
  }

  // Load comments
  async function loadComments() {
    try {
      const response = await fetch(`/admin/api/admin/tickets/${ticketId}`);
      if (!response.ok) throw new Error('Failed to load comments');
      
      const data = await response.json();
      const comments = data.comments || [];
      
      renderComments(comments);
      
    } catch (error) {
      console.error('Error loading comments:', error);
      const commentsList = document.getElementById('commentsList');
      if (commentsList) {
        commentsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ef4444;">Fout bij laden reacties</div>';
      }
    }
  }

  // Render comments
  function renderComments(comments) {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;
    
    // Filter internal comments if needed
    const filteredComments = showInternalComments || isAdmin ? 
      comments : 
      comments.filter(c => !c.is_internal);
    
    if (filteredComments.length === 0) {
      commentsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Geen reacties</div>';
      return;
    }
    
    commentsList.innerHTML = filteredComments.map(comment => {
      const authorName = comment.author ? 
        `${comment.author.first_name || ''} ${comment.author.last_name || ''}`.trim() || comment.author.email : 
        'Onbekend';
      const isInternal = comment.is_internal;
      
      return `
        <div style="padding: 1rem; background: ${isInternal ? '#fef3c7' : 'white'}; border: 1px solid ${isInternal ? '#fde68a' : '#e5e7eb'}; border-radius: 8px; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-weight: 500; color: #111827;">${authorName}</span>
              ${isInternal ? '<span style="padding: 0.125rem 0.5rem; background: #fbbf24; color: #92400e; border-radius: 4px; font-size: 0.75rem; font-weight: 500;">Intern</span>' : ''}
            </div>
            <span style="font-size: 0.75rem; color: #6b7280;">${formatDateTime(comment.created_at)}</span>
          </div>
          <div style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(comment.body)}</div>
        </div>
      `;
    }).join('');
  }

  // Load attachments
  async function loadAttachments() {
    try {
      const response = await fetch(`/admin/api/admin/tickets/${ticketId}`);
      if (!response.ok) throw new Error('Failed to load attachments');
      
      const data = await response.json();
      const attachments = data.attachments || [];
      
      renderAttachments(attachments);
      
    } catch (error) {
      console.error('Error loading attachments:', error);
      const attachmentsList = document.getElementById('attachmentsList');
      if (attachmentsList) {
        attachmentsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ef4444;">Fout bij laden bijlagen</div>';
      }
    }
  }

  // Render attachments
  function renderAttachments(attachments) {
    const attachmentsList = document.getElementById('attachmentsList');
    if (!attachmentsList) return;
    
    if (attachments.length === 0) {
      attachmentsList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Geen bijlagen</div>';
      return;
    }
    
    attachmentsList.innerHTML = attachments.map(attachment => {
      const fileSize = attachment.size_bytes ? formatFileSize(attachment.size_bytes) : '';
      const uploaderName = attachment.uploader ? 
        `${attachment.uploader.first_name || ''} ${attachment.uploader.last_name || ''}`.trim() || attachment.uploader.email : 
        'Onbekend';
      
      return `
        <div style="padding: 1rem; background: white; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <i class="fas fa-file" style="font-size: 1.5rem; color: #6b7280;"></i>
              <div>
                <p style="font-weight: 500; color: #111827; margin: 0 0 0.25rem 0;">${escapeHtml(attachment.file_name)}</p>
                <p style="font-size: 0.75rem; color: #6b7280; margin: 0;">
                  ${fileSize} • Geüpload door ${uploaderName} • ${formatDateTime(attachment.created_at)}
                </p>
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            ${attachment.url ? `
            <a href="${attachment.url}" target="_blank" class="btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.875rem; border-radius: 6px; text-decoration: none;">
              <i class="fas fa-download"></i> Downloaden
            </a>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Load activity log
  async function loadActivityLog() {
    try {
      const response = await fetch(`/admin/api/admin/tickets/${ticketId}`);
      if (!response.ok) throw new Error('Failed to load activity log');
      
      const data = await response.json();
      const auditLog = data.audit_log || [];
      
      renderActivityLog(auditLog);
      
    } catch (error) {
      console.error('Error loading activity log:', error);
      const activityLog = document.getElementById('activityLog');
      if (activityLog) {
        activityLog.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ef4444;">Fout bij laden activity log</div>';
      }
    }
  }

  // Render activity log
  function renderActivityLog(auditLog) {
    const activityLog = document.getElementById('activityLog');
    if (!activityLog) return;
    
    if (auditLog.length === 0) {
      activityLog.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Geen activiteit</div>';
      return;
    }
    
    activityLog.innerHTML = auditLog.map(entry => {
      const actorName = entry.actor ? 
        `${entry.actor.first_name || ''} ${entry.actor.last_name || ''}`.trim() || entry.actor.email : 
        'Systeem';
      
      const actionLabels = {
        'ticket_created': 'Ticket aangemaakt',
        'status_changed': 'Status gewijzigd',
        'priority_changed': 'Prioriteit gewijzigd',
        'assigned': 'Toegewezen',
        'unassigned': 'Toewijzing verwijderd',
        'comment_added': 'Reactie toegevoegd',
        'bulk_assigned': 'Bulk toegewezen',
        'bulk_status_changed': 'Bulk status gewijzigd',
        'bulk_priority_changed': 'Bulk prioriteit gewijzigd'
      };
      
      return `
        <div style="padding: 1rem; background: white; border-left: 3px solid #3b82f6; border-radius: 4px; margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
            <div>
              <p style="font-weight: 500; color: #111827; margin: 0 0 0.25rem 0;">${actionLabels[entry.action] || entry.action}</p>
              ${entry.field_name && entry.old_value !== undefined && entry.new_value !== undefined ? `
              <p style="font-size: 0.875rem; color: #6b7280; margin: 0;">
                ${entry.field_name}: <span style="text-decoration: line-through; color: #9ca3af;">${entry.old_value || '-'}</span> → <span style="color: #059669; font-weight: 500;">${entry.new_value || '-'}</span>
              </p>
              ` : ''}
            </div>
            <span style="font-size: 0.75rem; color: #6b7280;">${formatDateTime(entry.created_at)}</span>
          </div>
          <p style="font-size: 0.75rem; color: #6b7280; margin: 0;">Door ${actorName}</p>
        </div>
      `;
    }).join('');
  }

  // Load timeline
  async function loadTimeline() {
    try {
      const response = await fetch(`/admin/api/admin/tickets/${ticketId}`);
      if (!response.ok) throw new Error('Failed to load timeline');
      
      const data = await response.json();
      const auditLog = data.audit_log || [];
      
      renderTimeline(auditLog, data.ticket);
      
    } catch (error) {
      console.error('Error loading timeline:', error);
      const timelineContent = document.getElementById('timelineContent');
      if (timelineContent) {
        timelineContent.innerHTML = '<div style="text-align: center; padding: 2rem; color: #ef4444;">Fout bij laden tijdlijn</div>';
      }
    }
  }

  // Render timeline
  function renderTimeline(auditLog, ticket) {
    const timelineContent = document.getElementById('timelineContent');
    if (!timelineContent) return;
    
    const events = [];
    
    // Add creation event
    events.push({
      type: 'created',
      timestamp: ticket.created_at,
      actor: ticket.creator,
      description: 'Ticket aangemaakt'
    });
    
    // Add status/priority/assignment changes from audit log
    auditLog.forEach(entry => {
      if (entry.action === 'status_changed' || entry.action === 'priority_changed' || entry.action === 'assigned' || entry.action === 'unassigned') {
        events.push({
          type: entry.action,
          timestamp: entry.created_at,
          actor: entry.actor,
          description: entry.action === 'status_changed' ? `Status: ${entry.old_value} → ${entry.new_value}` :
                       entry.action === 'priority_changed' ? `Prioriteit: ${entry.old_value} → ${entry.new_value}` :
                       entry.action === 'assigned' ? `Toegewezen aan gebruiker` :
                       'Toewijzing verwijderd'
        });
      }
    });
    
    // Sort by timestamp
    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    if (events.length === 0) {
      timelineContent.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6b7280;">Geen tijdlijn events</div>';
      return;
    }
    
    timelineContent.innerHTML = events.map(event => {
      const actorName = event.actor ? 
        `${event.actor.first_name || ''} ${event.actor.last_name || ''}`.trim() || event.actor.email : 
        'Systeem';
      
      return `
        <div style="padding: 0.75rem; border-left: 2px solid #3b82f6; padding-left: 1rem; margin-bottom: 0.75rem;">
          <p style="font-size: 0.875rem; color: #111827; margin: 0 0 0.25rem 0; font-weight: 500;">${event.description}</p>
          <p style="font-size: 0.75rem; color: #6b7280; margin: 0;">
            ${formatDateTime(event.timestamp)} • ${actorName}
          </p>
        </div>
      `;
    }).join('');
  }

  // Load watchers
  async function loadWatchers() {
    // Placeholder - implement if needed
  }

  // Setup event listeners
  function setupEventListeners() {
    // Comment submission
    const submitCommentBtn = document.getElementById('submitCommentBtn');
    const commentInput = document.getElementById('commentInput');
    
    if (submitCommentBtn && commentInput) {
      submitCommentBtn.addEventListener('click', async () => {
        const body = commentInput.value.trim();
        if (!body) {
          if (window.showNotification) {
            window.showNotification('Reactie is verplicht', 'error', 3000);
          }
          return;
        }
        
        const isInternal = document.getElementById('isInternalNote')?.checked || false;
        
        try {
          const response = await fetch(`/admin/api/admin/tickets/${ticketId}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body, is_internal: isInternal })
          });
          
          const data = await response.json();
          
          if (response.ok && data.success) {
            commentInput.value = '';
            if (document.getElementById('isInternalNote')) {
              document.getElementById('isInternalNote').checked = false;
            }
            loadComments();
            loadTicketData();
            if (window.showNotification) {
              window.showNotification('Reactie toegevoegd', 'success', 3000);
            }
          } else {
            throw new Error(data.error || 'Failed to add comment');
          }
        } catch (error) {
          console.error('Error adding comment:', error);
          if (window.showNotification) {
            window.showNotification('Fout: ' + error.message, 'error', 5000);
          }
        }
      });
    }
    
    // Show internal comments toggle
    const showInternalCheckbox = document.getElementById('showInternalComments');
    if (showInternalCheckbox) {
      showInternalCheckbox.addEventListener('change', (e) => {
        showInternalComments = e.target.checked;
        loadComments();
      });
    }
    
    // Quick actions
    const quickResolveBtn = document.getElementById('quickResolveBtn');
    const quickCloseBtn = document.getElementById('quickCloseBtn');
    const quickReopenBtn = document.getElementById('quickReopenBtn');
    
    if (quickResolveBtn) {
      quickResolveBtn.addEventListener('click', () => changeStatus('resolved'));
    }
    if (quickCloseBtn) {
      quickCloseBtn.addEventListener('click', () => changeStatus('closed'));
    }
    if (quickReopenBtn) {
      quickReopenBtn.addEventListener('click', () => changeStatus('open'));
    }
    
    // Assign, status, priority buttons
    const assignBtn = document.getElementById('assignTicketBtn');
    const statusBtn = document.getElementById('changeStatusBtn');
    const priorityBtn = document.getElementById('changePriorityBtn');
    
    if (assignBtn) assignBtn.addEventListener('click', () => openAssignModal());
    if (statusBtn) statusBtn.addEventListener('click', () => openStatusModal());
    if (priorityBtn) priorityBtn.addEventListener('click', () => openPriorityModal());
  }

  // Change status
  async function changeStatus(status) {
    try {
      const response = await fetch(`/admin/api/admin/tickets/${ticketId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        loadTicketData();
        loadTimeline();
        if (isAdmin) loadActivityLog();
        if (window.showNotification) {
          window.showNotification('Status gewijzigd', 'success', 3000);
        }
      } else {
        throw new Error(data.error || 'Failed to change status');
      }
    } catch (error) {
      console.error('Error changing status:', error);
      if (window.showNotification) {
        window.showNotification('Fout: ' + error.message, 'error', 5000);
      }
    }
  }

  // Open assign modal
  function openAssignModal() {
    // Simple prompt for now - can be enhanced with a proper modal
    const assigneeOptions = employees.map(emp => {
      const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email;
      return `${emp.id}: ${name}`;
    }).join('\n');
    
    const assigneeId = prompt(`Toewijzen aan (ID):\n\n${assigneeOptions}\n\nOf leeg laten om toewijzing te verwijderen:`);
    
    if (assigneeId !== null) {
      assignTicket(assigneeId || null);
    }
  }

  // Assign ticket
  async function assignTicket(assigneeId) {
    try {
      const response = await fetch(`/admin/api/admin/tickets/${ticketId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: assigneeId })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        location.reload(); // Reload to show updated assignee
      } else {
        throw new Error(data.error || 'Failed to assign ticket');
      }
    } catch (error) {
      console.error('Error assigning ticket:', error);
      if (window.showNotification) {
        window.showNotification('Fout: ' + error.message, 'error', 5000);
      }
    }
  }

  // Open status modal
  function openStatusModal() {
    const statuses = [
      { value: 'new', label: 'Nieuw' },
      { value: 'open', label: 'Open' },
      { value: 'waiting_on_customer', label: 'Wachten op klant' },
      { value: 'waiting_on_internal', label: 'Wachten intern' },
      { value: 'resolved', label: 'Opgelost' },
      { value: 'closed', label: 'Gesloten' }
    ];
    
    const statusOptions = statuses.map(s => `${s.value}: ${s.label}`).join('\n');
    const status = prompt(`Status wijzigen:\n\n${statusOptions}`);
    
    if (status && statuses.find(s => s.value === status)) {
      changeStatus(status);
    }
  }

  // Open priority modal
  function openPriorityModal() {
    const priorities = [
      { value: 'low', label: 'Laag' },
      { value: 'normal', label: 'Normaal' },
      { value: 'high', label: 'Hoog' },
      { value: 'urgent', label: 'Urgent' }
    ];
    
    const priorityOptions = priorities.map(p => `${p.value}: ${p.label}`).join('\n');
    const priority = prompt(`Prioriteit wijzigen:\n\n${priorityOptions}`);
    
    if (priority && priorities.find(p => p.value === priority)) {
      updatePriority(priority);
    }
  }

  // Update priority
  async function updatePriority(priority) {
    try {
      const response = await fetch(`/admin/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        location.reload(); // Reload to show updated priority
      } else {
        throw new Error(data.error || 'Failed to update priority');
      }
    } catch (error) {
      console.error('Error updating priority:', error);
      if (window.showNotification) {
        window.showNotification('Fout: ' + error.message, 'error', 5000);
      }
    }
  }

  // Helper functions
  function formatDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('nl-NL', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  function formatRelativeTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Zojuist';
    if (diffMins < 60) return diffMins + ' minuten geleden';
    if (diffHours < 24) return diffHours + ' uur geleden';
    if (diffDays < 7) return diffDays + ' dagen geleden';
    return formatDateTime(iso);
  }

  function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();

