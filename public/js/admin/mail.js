// Global actions menu handler
let currentMailId = null;
let actionsMenu = null;

// Confirm dialog function for mail actions
function showMailConfirmDialog(message, onConfirm, onCancel) {
  // Remove existing dialog if present
  const existing = document.getElementById("mailConfirmDialog");
  if (existing) existing.remove();

  // Create modal element
  const modal = document.createElement("div");
  modal.id = "mailConfirmDialog";
  modal.style.cssText = "display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 3000; align-items: center; justify-content: center; animation: fadeIn 0.2s ease;";
  modal.className = "mail-confirm-dialog-modal";

  modal.innerHTML = `
    <div style="background: white; border-radius: 12px; padding: 0; max-width: 480px; width: 90%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); animation: slideUp 0.2s ease;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #111827; display: flex; align-items: center; gap: 10px;">
          <i class="fas fa-exclamation-triangle" style="color: #f59e0b; font-size: 22px;"></i>
          Bevestiging
        </h2>
        <span class="modal-close" style="font-size: 24px; cursor: pointer; color: #9ca3af; line-height: 1; transition: color 0.15s;" onmouseover="this.style.color='#374151'" onmouseout="this.style.color='#9ca3af'">&times;</span>
      </div>
      <div style="padding: 24px;">
        <div style="font-size: 14px; color: #374151; line-height: 1.6;">
          ${message}
        </div>
      </div>
      <div style="display: flex; gap: 12px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid #e5e7eb; background: #f9fafb; border-radius: 0 0 12px 12px;">
        <button id="cancelMailConfirm" class="btn-outline" style="padding: 10px 20px; border-radius: 6px; font-weight: 500;">Annuleren</button>
        <button id="confirmMailAction" class="btn-primary" style="padding: 10px 20px; border-radius: 6px; font-weight: 500; background: #dc2626; border-color: #dc2626;" onmouseover="this.style.background='#b91c1c'; this.style.borderColor='#b91c1c'" onmouseout="this.style.background='#dc2626'; this.style.borderColor='#dc2626'">Verwijderen</button>
      </div>
    </div>
  `;

  // Add CSS animations if not already present
  if (!document.getElementById('mailConfirmDialogStyles')) {
    const style = document.createElement('style');
    style.id = 'mailConfirmDialogStyles';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(10px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(modal);

  // Event handlers
  const handleCancel = () => {
    modal.style.opacity = "0";
    if (typeof onCancel === "function") onCancel();
    setTimeout(() => modal.remove(), 200);
  };

  const handleConfirm = () => {
    modal.style.opacity = "0";
    if (typeof onConfirm === "function") onConfirm();
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector(".modal-close")?.addEventListener("click", handleCancel);
  modal.querySelector("#cancelMailConfirm")?.addEventListener("click", handleCancel);
  modal.querySelector("#confirmMailAction")?.addEventListener("click", handleConfirm);
  
  // Close on outside click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) handleCancel();
  });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      handleCancel();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

// Helper function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Expose openMail early for inline onclick handlers
window.openMail = function(mailId) {
  if (!mailId) return;
  try {
    // Try to use the global openMailDrawer function
    if (typeof openMailDrawer === 'function') {
      openMailDrawer(mailId);
    } else if (window.__openMailDrawer) {
      window.__openMailDrawer(mailId);
    } else if (window.openMailDrawer) {
      window.openMailDrawer(mailId);
    } else {
      // Fallback: wait for drawer to be ready
      setTimeout(() => {
        if (typeof openMailDrawer === 'function') {
          openMailDrawer(mailId);
        } else if (window.__openMailDrawer) {
          window.__openMailDrawer(mailId);
        } else if (window.openMailDrawer) {
          window.openMailDrawer(mailId);
        }
      }, 100);
    }
  } catch (e) { 
    console.error('openMail error:', e); 
  }
};

function showMailActionsMenu(mailId, event) {
  event.stopPropagation();
  currentMailId = mailId;
  
  if (!actionsMenu) {
    actionsMenu = document.getElementById('mailActionsMenu');
  }
  
  if (actionsMenu) {
    // Hide menu first to get correct dimensions
    actionsMenu.style.display = 'none';
    
    // Get button position
    const button = event.target.closest('button') || event.target.closest('.mail-action-icon');
    const buttonRect = button ? button.getBoundingClientRect() : { right: event.clientX, bottom: event.clientY, top: event.clientY };
    
    // Show menu temporarily to get dimensions
    actionsMenu.style.display = 'block';
    actionsMenu.style.visibility = 'hidden';
    const menuRect = actionsMenu.getBoundingClientRect();
    actionsMenu.style.display = 'none';
    actionsMenu.style.visibility = 'visible';
    
    // Calculate position - align right edge of menu with right edge of button (open to the left)
    let leftPos = buttonRect.right - menuRect.width;
    let topPos = buttonRect.bottom + 4; // 4px gap below button
    
    // Ensure menu doesn't go off left edge
    if (leftPos < 10) {
      leftPos = 10;
    }
    
    // Check if menu would overflow bottom edge
    if (topPos + menuRect.height > window.innerHeight - 10) {
      topPos = buttonRect.top - menuRect.height - 4; // Show above button instead
      if (topPos < 10) {
        topPos = 10;
      }
    }
    
    // Check if menu would overflow right edge (fallback: show to the right if needed)
    if (leftPos + menuRect.width > window.innerWidth - 10) {
      // If not enough space on left, try right side
      leftPos = buttonRect.right + 4;
      if (leftPos + menuRect.width > window.innerWidth - 10) {
        // Still doesn't fit, align to right edge
        leftPos = window.innerWidth - menuRect.width - 10;
      }
    }
    
    // Apply position
    actionsMenu.style.display = 'block';
    actionsMenu.style.position = 'fixed';
    actionsMenu.style.left = leftPos + 'px';
    actionsMenu.style.top = topPos + 'px';
    actionsMenu.style.zIndex = '9999';
    
    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', closeActionsMenu, { once: true });
    }, 100);
  }
}

function closeActionsMenu() {
  if (actionsMenu) {
    actionsMenu.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const mailCardsList = document.getElementById('mailCardsList');
  const searchInput = document.getElementById('mailSearch');
  const labelFilter = document.getElementById('labelFilter');
  const mailboxSelect = document.getElementById('mailboxSelect');
  const composeBtn = document.getElementById('composeBtn');

  // Drawer/polling state used across functions in this scope
  let mailRefreshInterval = null;
  let pendingReloadAfterDrawer = false;

  // Force exact parity between data-* and visible text on initial load and on dynamically added cards
  function applyCardText(card) {
    if (!card || !card.classList.contains('mail-card')) return;
    const fromEl = card.querySelector('.mail-sender-name');
    const subjEl = card.querySelector('.mail-card-subject');
    const dsFrom = card.getAttribute('data-from-name');
    const dsSubj = card.getAttribute('data-subject');
    const dsFromEmail = card.getAttribute('data-from-email') || '';

    const currentFrom = (fromEl?.textContent || '').trim();
    const currentSubj = (subjEl?.textContent || '').trim();

    const safeFrom = (typeof dsFrom === 'string' && dsFrom.trim() !== '')
      ? dsFrom
      : (currentFrom || (dsFromEmail ? dsFromEmail.split('@')[0] : ''));

    const safeSubj = (typeof dsSubj === 'string' && dsSubj.trim() !== '')
      ? dsSubj
      : currentSubj;

    if (fromEl) fromEl.textContent = safeFrom;
    if (subjEl) subjEl.textContent = safeSubj;
  }

  function applyAllCards() {
    document.querySelectorAll('.mail-card').forEach(applyCardText);
  }

  // Initial apply
  applyAllCards();

  // Observe later DOM changes (e.g., due to polling or lazy rendering)
  if (mailCardsList) {
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.classList?.contains('mail-card')) {
            applyCardText(node);
          } else {
            node.querySelectorAll?.('.mail-card')?.forEach(applyCardText);
          }
        });
      }
    });
    mo.observe(mailCardsList, { childList: true, subtree: true });
  }

  // Safety: re-apply right after window load to override any late modifiers
  window.addEventListener('load', () => {
    setTimeout(applyAllCards, 0);
  });

  // Mailbox switching
  if (mailboxSelect) {
    mailboxSelect.addEventListener('change', (e) => {
      const mailboxId = e.target.value;
      const url = new URL(window.location);
      if (mailboxId === 'all') {
        url.searchParams.delete('mailbox');
      } else {
        url.searchParams.set('mailbox', mailboxId);
      }
      // Reset to first page when mailbox changes
      url.searchParams.set('page', '1');
      window.location.href = url.toString();
    });
  }

  // Per-page selector
  // perPageSelect is now in pagination container, handled by initMailPagination

  function normalize(s) { return (s || '').toLowerCase(); }

  function cardMatches(card, term, label) {
    const txt = normalize(card.textContent);
    const hasTerm = !term || txt.includes(term);
    const hasLabel = label === 'all' || txt.includes(label.replace('_',' '));
    return hasTerm && hasLabel;
  }

  function applyFilters() {
    const term = normalize(searchInput?.value || '');
    const label = (labelFilter?.value || 'all');
    const cards = mailCardsList ? mailCardsList.querySelectorAll('.mail-card') : [];
    cards.forEach(card => {
      card.style.display = cardMatches(card, term, label) ? 'flex' : 'none';
    });
    
    // Update results count
    const visibleCount = Array.from(cards).filter(c => c.style.display !== 'none').length;
    const info = document.getElementById('paginationInfo');
    if (info) {
      info.textContent = `Toont ${visibleCount} berichten`;
    }
  }

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (labelFilter) labelFilter.addEventListener('change', applyFilters);
  
  // Pagination handlers
  const paginationPrev = document.getElementById('paginationPrev');
  const paginationNext = document.getElementById('paginationNext');
  const paginationBtns = document.querySelectorAll('.pagination-btn[data-page]');
  
  if (paginationPrev) {
    paginationPrev.addEventListener('click', () => {
      const url = new URL(window.location);
      const currentPage = parseInt(url.searchParams.get('page')) || 1;
      if (currentPage > 1) {
        url.searchParams.set('page', currentPage - 1);
        window.location.href = url.toString();
      }
    });
  }
  
  if (paginationNext) {
    paginationNext.addEventListener('click', () => {
      const url = new URL(window.location);
      const currentPage = parseInt(url.searchParams.get('page')) || 1;
      // Get total pages from pagination container or use a reasonable default
      const maxPage = Math.max(...Array.from(paginationBtns).map(b => parseInt(b.getAttribute('data-page')) || 0));
      if (currentPage < maxPage) {
        url.searchParams.set('page', currentPage + 1);
        window.location.href = url.toString();
      }
    });
  }
  
  paginationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.getAttribute('data-page');
      if (page) {
        const url = new URL(window.location);
        url.searchParams.set('page', page);
        window.location.href = url.toString();
      }
    });
  });
  
  // Store preloaded AI replies
  const preloadedReplies = {};
  
  // Removed AI preloading to save tokens; replies generate on demand.
  
  // Make cards clickable
  if (mailCardsList) {
    mailCardsList.addEventListener('click', (e) => {
      const card = e.target.closest('.mail-card');
      if (card && !e.target.closest('.mail-card-actions')) {
        const mailId = card.getAttribute('data-mail-id');
        if (mailId) {
          openMailDrawer(mailId);
        }
      }
    });
  }

  // Actions menu handlers
  const actionsMenuEl = document.getElementById('mailActionsMenu');
  if (actionsMenuEl) {
    actionsMenuEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('.mail-action-item');
      if (!btn || !currentMailId) return;
      
      const action = btn.getAttribute('data-action');
      closeActionsMenu();
      
      if (action === 'open') {
        openMailDrawer(currentMailId);
      } else if (action === 'ai-reply') {
        await aiReply(currentMailId);
      } else if (action === 'unsubscribe') {
        await quickUnsubscribe(currentMailId);
      } else if (action === 'archive') {
        await archiveMail(currentMailId);
      } else if (action === 'create-ticket') {
        await createTicketFromMail(currentMailId);
      }
    });
  }

  function ensureDrawer() {
    let drawer = document.querySelector('.mail-drawer');
    let backdrop = document.querySelector('.mail-drawer-backdrop');
    
    // Create backdrop for click-outside-to-close
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'mail-drawer-backdrop';
      backdrop.id = 'mailDrawerBackdrop';
      document.body.appendChild(backdrop);
      
      backdrop.addEventListener('click', () => {
        closeDrawer();
      });
    }
    
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.className = 'mail-drawer';
      drawer.id = 'mailDrawer';
      drawer.innerHTML = `
        <div class="mail-drawer-overlay"></div>
        <div class="mail-drawer-content">
          <div class="mail-drawer-header">
            <div class="mail-drawer-header-left">
              <button class="mail-drawer-close" id="mailDrawerClose">
                <i class="fas fa-times"></i>
              </button>
            </div>
            <div class="mail-detail-actions" id="mailDetailActions">
              <button class="mail-action-btn" data-action="reply" title="Beantwoorden">
                <i class="fas fa-reply"></i>
              </button>
              <button class="mail-action-btn" data-action="forward" title="Doorsturen">
                <i class="fas fa-share"></i>
              </button>
              <button class="mail-action-btn" data-action="archive" title="Archiveren">
                <i class="fas fa-box-archive"></i>
              </button>
              <button class="mail-action-btn" data-action="delete" title="Verwijderen">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="mail-drawer-body" id="mailDrawerBody"></div>
        </div>
      `;
      document.body.appendChild(drawer);
      
      const closeBtn = drawer.querySelector('#mailDrawerClose');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => closeDrawer());
      }
      
      // Prevent clicks inside drawer content from closing it
      const content = drawer.querySelector('.mail-drawer-content');
      if (content) {
        content.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }
    }
    return drawer;
  }
  
  function closeDrawer() {
    const drawer = document.querySelector('.mail-drawer');
    const backdrop = document.querySelector('.mail-drawer-backdrop');
    if (drawer) drawer.classList.remove('show');
    if (backdrop) backdrop.classList.remove('show');
    // Remove global outside click handler if present
    if (window.__mailDrawerOutsideHandler) {
      document.removeEventListener('mousedown', window.__mailDrawerOutsideHandler, true);
      window.__mailDrawerOutsideHandler = null;
    }
    // Re-enable body scroll
  document.body.classList.remove('mail-drawer-open');
  // If polling reload was deferred while drawer was open, do it now
  if (typeof pendingReloadAfterDrawer !== 'undefined' && pendingReloadAfterDrawer) {
    pendingReloadAfterDrawer = false;
    location.reload();
    return;
  }
  // Resume polling if not running
  if (typeof startMailPolling === 'function' && !mailRefreshInterval) {
    startMailPolling();
  }
  }

  async function openMailDrawer(id) {
    const drawer = ensureDrawer();
    const backdrop = document.getElementById('mailDrawerBackdrop');
    const body = drawer.querySelector('#mailDrawerBody');
    body.innerHTML = `
      <div class="mail-drawer-loading">
        <div class="mail-drawer-spinner"></div>
        <span>Mail wordt geladen...</span>
      </div>
    `;
    drawer.classList.add('show');
    if (backdrop) backdrop.classList.add('show');
  // Prevent body scroll and layout shifts
  document.body.classList.add('mail-drawer-open');
  // Pause polling while drawer is open
  if (mailRefreshInterval) {
    clearInterval(mailRefreshInterval);
    mailRefreshInterval = null;
  }
    // Install global outside click handler to close when clicking anywhere
    if (!window.__mailDrawerOutsideHandler) {
      window.__mailDrawerOutsideHandler = (ev) => {
        const content = document.querySelector('.mail-drawer-content');
        if (!content) return;
        if (!content.contains(ev.target)) {
          closeDrawer();
        }
      };
      document.addEventListener('mousedown', window.__mailDrawerOutsideHandler, true);
    }
    try {
      // Fallback in case network is slow or blocked
      const timeoutHandle = setTimeout(() => {
        if (body && body.querySelector('.mail-drawer-loading')) {
          body.innerHTML = '<div class="mail-drawer-loading"><div class="mail-drawer-spinner"></div><span>Kon mail niet laden (timeout). Probeer opnieuw.</span></div>';
        }
      }, 10000);

      const res = await fetch(`/admin/api/mail/${id}`);
      const ct = res.headers.get('content-type') || '';
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || `HTTP ${res.status}`);
      }
      if (!ct.includes('application/json')) {
        const errText = await res.text().catch(() => '');
        clearTimeout(timeoutHandle);
        throw new Error(errText || 'Ongeldig antwoord van server');
      }
      const data = await res.json();
      clearTimeout(timeoutHandle);
      
      // Store mail data globally for tips to access
      window.__currentMailData = data.mail || data;
      const m = data.mail;
      // Escape HTML for text content
      const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };
      
      // Clean and sanitize HTML email content - preserve inline styles
      const sanitizeHtml = (html) => {
        if (!html) return '';
        // Create a temporary div to parse HTML
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Remove scripts and event handlers
        const scripts = temp.querySelectorAll('script');
        scripts.forEach(s => s.remove());
        // Remove meta tags inside body content (avoid browser console errors)
        const metas = temp.querySelectorAll('meta');
        metas.forEach(m => m.remove());
        
        // Remove potentially dangerous attributes but preserve ALL inline styles and CSS
        const allElements = temp.querySelectorAll('*');
        allElements.forEach(el => {
          // Remove onclick and other event handlers, but keep style attribute
          Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on')) {
              el.removeAttribute(attr.name);
            }
            // Keep style, class, id, src, href, alt, title attributes
          });
          
          // Ensure images have proper styling while preserving existing styles
          if (el.tagName === 'IMG') {
            const existingStyle = el.getAttribute('style') || '';
            let newStyle = existingStyle;
            
            if (!newStyle.includes('max-width') && !newStyle.includes('maxWidth')) {
              newStyle = (newStyle ? newStyle + '; ' : '') + 'max-width: 100%';
            }
            if (!newStyle.includes('height:') && !newStyle.includes('height ')) {
              newStyle = (newStyle ? newStyle + '; ' : '') + 'height: auto';
            }
            if (!newStyle.includes('display:')) {
              newStyle = (newStyle ? newStyle + '; ' : '') + 'display: block';
            }
            
            el.setAttribute('style', newStyle);
          }
        });
        
        // Keep all style tags in place - don't move them
        // They will be rendered correctly by the browser
        
        // Return the HTML - preserve everything except dangerous scripts
        return temp.innerHTML;
      };
      
      // Get initials for avatar
      const fromName = m.from_name || m.from_email || '';
      const initials = fromName.split(/\s+/).map(s => s[0]).join('').slice(0,2).toUpperCase() || '?';
      
      // Get label class mapping
      const labelMap = {
        'customer_request': { name: 'Klantaanvraag', class: 'klantaanvraag' },
        'lead': { name: 'Kans', class: 'kans' },
        'urgent': { name: 'Urgent', class: 'urgent' },
        'newsletter': { name: 'Nieuwsbrief', class: 'nieuwsbrief' },
        'other': { name: 'Overig', class: 'overig' },
        'support_request': { name: 'Supportaanvraag', class: 'support_request' },
        'follow_up': { name: 'Follow-up', class: 'follow_up' },
        'feedback': { name: 'Feedback', class: 'feedback' },
        'invoice': { name: 'Factuur', class: 'invoice' },
        'factuur': { name: 'Factuur', class: 'invoice' },
        'bevestiging': { name: 'Bevestiging', class: 'bevestiging' },
        'spam': { name: 'Spam', class: 'spam' },
        'junk': { name: 'Spam', class: 'spam' }
      };
      const currentLabel = Array.isArray(m.labels) && m.labels[0] ? m.labels[0].label : 'other';
      const labelInfo = labelMap[currentLabel] || labelMap['other'];
      
      // Update header actions with mail ID and set up event listener
      const headerActions = drawer.querySelector('#mailDetailActions');
      if (headerActions) {
        headerActions.querySelectorAll('button').forEach(btn => {
          btn.setAttribute('data-id', m.id);
        });
        
        // Set up event listener for header actions
        headerActions.addEventListener('click', async (e) => {
          const btn = e.target.closest('button[data-action]');
          if (!btn) return;
          const action = btn.getAttribute('data-action');
          const mailId = btn.getAttribute('data-id') || m.id;
          
          if (action === 'reply') {
            // Scroll to AI reply container or focus on reply
            const aiContainer = document.getElementById('aiReplyContainer');
            if (aiContainer) {
              aiContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // If AI reply exists, focus on textarea
              const textarea = document.getElementById('aiSuggestionTextarea');
              if (textarea && textarea.style.display !== 'none') {
                setTimeout(() => {
                  textarea.focus();
                  textarea.readOnly = false;
                  textarea.style.borderColor = '#3b82f6';
                }, 300);
              } else {
                // Trigger AI reply generation
                aiReply(mailId);
              }
            }
          } else if (action === 'forward') {
            // Forward functionality (placeholder for now)
            if (window.showNotification) {
              window.showNotification('Doorsturen functionaliteit komt binnenkort', 'info', 3000);
            }
          } else if (action === 'archive') {
            await archiveMail(mailId);
          } else if (action === 'delete') {
            await deleteMail(mailId);
          }
        });
      }
      
      // Render new layout structure
      body.innerHTML = `
        <!-- Subject Row -->
        <div class="mail-drawer-subject-row">
          <div class="mail-drawer-subject">${escapeHtml(m.subject || '(geen onderwerp)')}</div>
          <button id="drawerLabelBadge" class="mail-label-tag mail-label-neutral" style="cursor:pointer;border:none;display:inline-flex;align-items:center;justify-content:center;gap:4px;visibility:hidden;position:relative;font-size:12px;padding:5px 10px;flex-shrink:0;margin:0;line-height:12px;height:22px;box-sizing:border-box;">
            <span id="drawerLabelText"></span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </div>
        
        <!-- Sender Info -->
        <div class="mail-detail-sender">
          <div class="mail-sender-avatar">${initials}</div>
          <div class="mail-sender-info">
            <div class="mail-sender-name-row">
              <span class="mail-sender-name">${escapeHtml(m.from_name || m.from_email)}</span>
              <span class="mail-sender-email">&lt;${escapeHtml(m.from_email)}&gt;</span>
            </div>
            <div class="mail-sender-meta">
              <span class="mail-category-badge-large ${labelInfo.class}" id="emailCategoryBadge">${labelInfo.name}</span>
              <span class="mail-sender-time">${new Date(m.received_at).toLocaleString('nl-NL')}</span>
            </div>
          </div>
        </div>
        
        <!-- Customer Link Suggestion -->
        <div id="customerLinkTip" class="mail-ai-tip-compact" style="display:none;">
          <div class="mail-ai-tip-compact-inner" style="background:#fef3c7;border-color:#fbbf24;">
            <svg class="mail-ai-tip-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#d97706;">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <div class="mail-ai-tip-content">
              <div class="mail-ai-tip-header">
                <span class="mail-ai-tip-title">Klant gekoppeld</span>
              </div>
              <p class="mail-ai-tip-text" id="customerLinkText">Deze e-mail is automatisch gekoppeld aan een klant. Bevestig om toekomstige e-mails automatisch te koppelen.</p>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="mail-ai-tip-action" id="customerLinkConfirmBtn" style="background:#059669;color:white;">Bevestigen</button>
              <button class="mail-ai-tip-action" id="customerLinkChangeBtn" style="background:transparent;border:1px solid #d97706;color:#d97706;">Wijzigen</button>
            </div>
          </div>
        </div>

        <!-- Ticket Creation Suggestion -->
        <div id="ticketTip" class="mail-ai-tip-compact" style="display:none;">
          <div class="mail-ai-tip-compact-inner" style="background:#fee2e2;border-color:#ef4444;">
            <svg class="mail-ai-tip-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#dc2626;">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <div class="mail-ai-tip-content">
              <div class="mail-ai-tip-header">
                <span class="mail-ai-tip-title">AI-tip: Maak ticket aan</span>
                <span class="mail-ai-tip-badge" id="ticketPriorityBadge" style="display:none;"></span>
              </div>
              <p class="mail-ai-tip-text" id="ticketTipText">Deze e-mail bevat een vraag of probleem van een klant. Maak automatisch een ticket aan?</p>
            </div>
            <button class="mail-ai-tip-action" id="ticketCreateBtn" style="background:#dc2626;color:white;">Maak ticket aan</button>
          </div>
        </div>

        <!-- AI Tip Section - Compact Blue Design (kansen style) -->
        <div id="aiTipCompact" class="mail-ai-tip-compact" style="display:none;">
          <div class="mail-ai-tip-compact-inner">
            <svg class="mail-ai-tip-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
              <path d="M20 3v4"></path>
              <path d="M22 5h-4"></path>
              <path d="M4 17v2"></path>
              <path d="M5 18H3"></path>
            </svg>
            <div class="mail-ai-tip-content">
              <div class="mail-ai-tip-header">
                <span class="mail-ai-tip-title">AI-tip: Maak een kans aan</span>
                <span class="mail-ai-tip-badge" id="aiTipConfidence" style="display:none;">95% match</span>
              </div>
              <p class="mail-ai-tip-text">Deze e-mail lijkt een potentiële klantaanvraag te zijn. Wil je automatisch een kans aanmaken?</p>
            </div>
            <button class="mail-ai-tip-action" id="aiTipCreateBtn">Maak kans aan</button>
          </div>
        </div>
        
        <!-- AI Suggestion Section -->
        <div class="mail-ai-suggestion" id="aiReplyContainer">
          <div class="mail-ai-suggestion-header">
            <div class="mail-ai-header-left">
              <div class="mail-ai-header-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9333ea" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles" style="width:16px;height:16px;">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
                  <path d="M20 3v4"></path>
                  <path d="M22 5h-4"></path>
                  <path d="M4 17v2"></path>
                  <path d="M5 18H3"></path>
                </svg>
              </div>
              <h3 class="mail-ai-suggestion-title">AI-suggestie voor antwoord</h3>
            </div>
            <div class="mail-ai-feedback" id="aiFeedbackButtons" style="display:none;">
              <button class="mail-ai-feedback-btn" title="Goed antwoord" data-feedback="good">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-thumbs-up" style="width:16px;height:16px;">
                  <path d="M7 10v12"></path>
                  <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"></path>
                </svg>
              </button>
              <button class="mail-ai-feedback-btn" title="Slecht antwoord" data-feedback="bad">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-thumbs-down" style="width:16px;height:16px;">
                  <path d="M17 14V2"></path>
                  <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"></path>
                </svg>
              </button>
            </div>
          </div>
          <div class="mail-ai-suggestion-content" id="aiSuggestionContent">
            <div class="mail-drawer-loading" id="aiReplyLoading" style="display:none;">
              <div class="mail-drawer-spinner"></div>
              <span>AI antwoord wordt gegenereerd...</span>
            </div>
            <textarea class="mail-ai-textarea" id="aiSuggestionTextarea" rows="6" style="display:none;" placeholder="AI antwoord wordt geladen..."></textarea>
            <div class="mail-ai-info" id="aiReplyInfo" style="display:none;">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-check" style="width:16px;height:16px;">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="m9 12 2 2 4-4"></path>
              </svg>
              <span>Handtekening wordt automatisch toegevoegd bij verzenden</span>
            </div>
          </div>
          <div class="mail-ai-suggestion-actions" id="aiSuggestionActions" style="display:none;">
            <button class="mail-ai-edit-btn" id="aiEditBtn">
              <i class="fas fa-edit"></i>
              Bewerken
            </button>
            <button class="mail-ai-send-btn" id="aiSendBtn" data-id="${m.id}">
              <i class="fas fa-paper-plane"></i>
              Verzenden
            </button>
          </div>
        </div>
        
        <!-- Original Message -->
        <div class="mail-original-message">
          <div class="mail-original-header">
            <i class="fas fa-envelope"></i>
            <span>Origineel Bericht</span>
          </div>
          <div class="mail-original-content" id="mailEmailContent"></div>
        </div>
      `;
      // Render label badge on the right of subject (seed with labels from payload if present)
      renderDrawerLabelBadge(m.id, Array.isArray(m.labels) ? m.labels : []);
      
      // Render original email HTML with original CSS (isolated in iframe to prevent conflicts)
      (function renderOriginalEmail(){
        const container = document.getElementById('mailEmailContent');
        if (!container) return;
        
        // Prefer HTML version, fallback to plain text
        if (m.body_html && m.body_html.trim()) {
          // Sanitize HTML but preserve all inline styles and embedded CSS
          const sanitized = sanitizeHtml(m.body_html);
          
          // Extract style tags from original HTML to preserve email CSS
          const styleTagMatches = m.body_html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
          let extractedStyles = '';
          if (styleTagMatches) {
            extractedStyles = styleTagMatches.map(tag => {
              const contentMatch = tag.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
              return contentMatch ? contentMatch[1] : '';
            }).join('\n');
          }
          
          const iframe = document.createElement('iframe');
          iframe.className = 'mail-email-iframe';
          // Sandbox without scripts; allow-same-origin so we can auto-resize height
          iframe.setAttribute('sandbox', 'allow-same-origin');
          iframe.setAttribute('referrerpolicy', 'no-referrer');
          iframe.style.width = '100%';
          iframe.style.border = '1px solid #e5e7eb';
          iframe.style.background = '#ffffff';
          iframe.style.borderRadius = '8px';
          iframe.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
          container.appendChild(iframe);

          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) return;

          // Build HTML with original email styles preserved + minimal reset
          const srcHtml = `<!doctype html>
            <html>
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <base target="_blank" />
                <style>
                  /* Minimal reset - only what's needed to prevent conflicts */
                  html,body{
                    margin:0;
                    padding:16px;
                    background:#ffffff;
                    color:#111827;
                    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, "Helvetica Neue", Arial, "Apple Color Emoji", "Segoe UI Emoji";
                  }
                  img{max-width:100%;height:auto;}
                  table{width:auto;border-collapse:collapse;}
                  
                  /* Preserve original email styles */
                  ${extractedStyles}
                </style>
              </head>
              <body>${sanitized}</body>
            </html>`;

          // Write content and auto-resize
          doc.open();
          doc.write(srcHtml);
          doc.close();

          const resize = () => {
            try {
              const h = Math.max(
                doc.body?.scrollHeight || 0,
                doc.documentElement?.scrollHeight || 0
              );
              if (h) iframe.style.height = (h + 24) + 'px'; // Add padding
            } catch(_) {}
          };
          iframe.addEventListener('load', resize);
          // Resize after content/layout settles
          setTimeout(resize, 50);
          setTimeout(resize, 250);
          setTimeout(resize, 500);
        } else if (m.body_text) {
          // Plain text fallback - show in styled container
          const textDiv = document.createElement('div');
          textDiv.className = 'mail-email-content-text';
          textDiv.style.padding = '16px';
          textDiv.style.background = '#ffffff';
          textDiv.style.border = '1px solid #e5e7eb';
          textDiv.style.borderRadius = '8px';
          textDiv.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1)';
          textDiv.style.whiteSpace = 'pre-wrap';
          textDiv.style.color = '#374151';
          textDiv.style.fontSize = '14px';
          textDiv.style.lineHeight = '1.6';
          textDiv.textContent = m.body_text;
          container.appendChild(textDiv);
        }
      })();
      
      // Load AI reply - check preloaded first, then draft, then generate
      (async () => {
        // First check preloaded replies
        if (preloadedReplies[m.id]) {
          const reply = preloadedReplies[m.id];
          if (!reply.error) {
            await loadAiReply(m.id, reply.draft, reply.draftHtml, reply.signature);
            return;
          }
        }
        
        // Then check for existing draft in database
        try {
          const draftRes = await fetch(`/admin/api/mail/${m.id}/draft`);
          if (draftRes.ok) {
            const draftData = await draftRes.json();
            if (draftData.draft) {
              // Load existing draft
              await loadAiReply(m.id, draftData.draft, draftData.draftHtml, draftData.signature);
              return;
            }
          }
        } catch (e) {
          // Error fetching draft, continue to generate new reply
        }
          
        // No preloaded or existing draft, generate AI reply on demand
        aiReply(m.id);
      })();
      
      // Handle body action buttons
      body.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const aid = b.getAttribute('data-id');
        const a = b.getAttribute('data-action');
        
        if (a === 'create-opportunity') {
          await createOpportunityFromMail(aid);
        } else if (a === 'feedback') {
          // Handle AI feedback
          const feedback = b.getAttribute('data-feedback');
          // TODO: Implement feedback
        }
      });
    } catch (e) {
      body.innerHTML = '<div>Kon mail niet laden.</div>';
    }
  }

  // Expose drawer opener globally for inline handlers
  window.__openMailDrawer = openMailDrawer;
  window.openMailDrawer = openMailDrawer;

  // Render label badge with chevron and interactive colorized menu
  async function renderDrawerLabelBadge(mailId, seedLabels = []){
    const badgeBtn = document.getElementById('drawerLabelBadge');
    const textSpan = document.getElementById('drawerLabelText');
    if (!badgeBtn || !textSpan) return;
    const nameMap = { customer_request:'Klantaanvraag', urgent:'Urgent', lead:'Kans', junk:'Spam', support:'Support', newsletter:'Nieuwsbrief', other:'Overig', feedback:'Feedback', invoice:'Factuur', factuur:'Factuur', bevestiging:'Bevestiging', support_request:'Supportaanvraag', follow_up:'Follow-up', spam:'Spam' };
    const classFor = (label) => ({ newsletter:'mail-label-neutral', other:'mail-label-neutral', follow_up:'mail-label-neutral', feedback:'mail-label-neutral', junk:'mail-label-neutral', spam:'mail-label-neutral', support_request:'mail-label-orange', support:'mail-label-orange', invoice:'mail-label-factuur', factuur:'mail-label-factuur', bevestiging:'mail-label-bevestiging', customer_request:'mail-label-blue', lead:'mail-label-personal', urgent:'mail-label-important' }[label] || 'mail-label-neutral');
    let current = (Array.isArray(seedLabels) && seedLabels[0]?.label) || null;
    let displayed = null;
    try {
      const res = await fetch(`/admin/api/mail/${mailId}/labels`);
      const data = await res.json();
      current = (Array.isArray(data.labels) && data.labels[0]?.label) || null;
    } catch(_) {}
    const setBadge = (label) => {
      if (!label || label === displayed) return;
      displayed = label;
      badgeBtn.className = `mail-label-tag ${classFor(label)}`;
      textSpan.textContent = nameMap[label] || label;
      badgeBtn.style.visibility = 'visible';
    };
    // Show immediately from seed if available, fallback to 'other'
    if (current) setBadge(current);
    // Create / reuse a popover menu
    let menu = document.getElementById('drawerLabelMenu');
    if (!menu){
      menu = document.createElement('div');
      menu.id = 'drawerLabelMenu';
      menu.style.position = 'absolute';
      menu.style.background = '#fff';
      menu.style.border = '1px solid #e5e7eb';
      menu.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
      menu.style.borderRadius = '8px';
      menu.style.padding = '6px';
      menu.style.display = 'none';
      menu.style.zIndex = '9999';
      document.body.appendChild(menu);
    }
    const options = ['lead','customer_request','support_request','urgent','newsletter','invoice','factuur','bevestiging','other','spam','feedback','follow_up'];
    const optionHtml = options.map(l => `<button data-value="${l}" class="mail-label-tag ${classFor(l)}" style="display:flex;align-items:center;gap:8px;width:100%;justify-content:flex-start;margin:4px 0;cursor:pointer;border:none;">${nameMap[l]}</button>`).join('');
    const openMenu = () => {
      menu.innerHTML = optionHtml;
      menu.style.display = 'block';
      // allow measuring after display
      const rect = badgeBtn.getBoundingClientRect();
      const menuWidth = menu.offsetWidth || 220;
      const menuHeight = menu.offsetHeight || 200;
      let left = window.scrollX + rect.right - menuWidth;
      let top = window.scrollY + rect.bottom + 6;
      const maxLeft = window.scrollX + window.innerWidth - menuWidth - 8;
      const minLeft = window.scrollX + 8;
      const maxTop = window.scrollY + window.innerHeight - menuHeight - 8;
      left = Math.max(minLeft, Math.min(maxLeft, left));
      top = Math.min(maxTop, top);
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
      menu.style.maxHeight = '280px';
      menu.style.overflow = 'auto';
      const close = (ev) => {
        if (!menu.contains(ev.target) && ev.target !== badgeBtn){
          menu.style.display = 'none';
          document.removeEventListener('click', close, true);
        }
      };
      setTimeout(() => document.addEventListener('click', close, true), 0);
    };
    badgeBtn.onclick = (e) => { e.stopPropagation(); openMenu(); };
    menu.onclick = async (e) => {
      const btn = e.target.closest('button[data-value]');
      if (!btn) return;
      const newLabel = btn.getAttribute('data-value');
      try {
        const r = await fetch(`/admin/api/mail/${mailId}/labels`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ label: newLabel }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Fout');
        setBadge(newLabel);
        menu.style.display = 'none';
        if (window.showNotification) window.showNotification('Label bijgewerkt', 'success', 2500);

        // Reflect in listing immediately (both new and legacy cards)
        const updateListRow = () => {
          const item = document.querySelector(`.mail-item[data-mail-id="${mailId}"]`);
          if (item) {
            const row = item.querySelector('.mail-tags-row');
            if (row) {
              const cls = classFor(newLabel);
              const text = nameMap[newLabel] || newLabel;
              let extra = '';
              if (newLabel === 'lead') {
                extra = `<button class="btn-outline-sm" style="margin-left:8px" onclick="event.stopPropagation(); createOpportunityFromMail('${mailId}')"><i class="fas fa-user-plus"></i> Maak kans aan</button>`;
              }
              row.innerHTML = `<span class="mail-label-tag ${cls}">${text}</span>${extra}`;
            }
          }
          // Legacy card support
          const card = document.querySelector(`.mail-card[data-mail-id="${mailId}"] .mail-card-labels`);
          if (card) {
            const text = nameMap[newLabel] || newLabel;
            card.innerHTML = `<span class="mail-label-badge" style="background:#e5e7eb;color:#4b5563;">${text}</span>`;
          }
        };
        updateListRow();
      } catch(err){ if (window.showNotification) window.showNotification('Kon label niet bijwerken: '+err.message, 'error', 4000); }
    };

    // Customer link tip
    const customerLinkTip = document.getElementById('customerLinkTip');
    const customerLinkConfirmBtn = document.getElementById('customerLinkConfirmBtn');
    const customerLinkChangeBtn = document.getElementById('customerLinkChangeBtn');
    const customerLinkText = document.getElementById('customerLinkText');
    
    // Check if mail has auto_linked_customer_id but not confirmed
    const mailData = window.__currentMailData || {};
    const hasAutoLinked = mailData.auto_linked_customer_id && !mailData.customer_link_confirmed;
    const autoLinkedCustomer = mailData.auto_linked_customer || null;
    
    if (customerLinkTip && hasAutoLinked) {
      customerLinkTip.style.display = 'block';
      requestAnimationFrame(() => customerLinkTip.classList.add('show'));
      
      if (autoLinkedCustomer) {
        customerLinkText.textContent = `Deze e-mail is automatisch gekoppeld aan ${autoLinkedCustomer.name || autoLinkedCustomer.email || 'een klant'}. Bevestig om toekomstige e-mails automatisch te koppelen.`;
      }
      
      customerLinkConfirmBtn.onclick = async () => {
        try {
          const res = await fetch(`/admin/api/mails/${mailId}/confirm-customer-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_id: mailData.auto_linked_customer_id,
              create_mapping: true
            })
          });
          
          if (!res.ok) throw new Error('Kon customer link niet bevestigen');
          
          customerLinkTip.style.display = 'none';
          if (window.showNotification) {
            window.showNotification('Klant link bevestigd! Toekomstige e-mails worden automatisch gekoppeld.', 'success', 4000);
          }
          
          // Reload mail data
          if (typeof openMailDrawer === 'function') {
            openMailDrawer(mailId);
          }
        } catch (err) {
          if (window.showNotification) {
            window.showNotification('Fout bij bevestigen: ' + err.message, 'error', 4000);
          }
        }
      };
      
      customerLinkChangeBtn.onclick = () => {
        // TODO: Open customer selection dialog
        if (window.showNotification) {
          window.showNotification('Klant selectie functionaliteit komt binnenkort', 'info', 3000);
        }
      };
    }

    // Ticket creation tip
    const ticketTip = document.getElementById('ticketTip');
    const ticketCreateBtn = document.getElementById('ticketCreateBtn');
    const ticketPriorityBadge = document.getElementById('ticketPriorityBadge');
    const ticketTipText = document.getElementById('ticketTipText');
    
    const shouldCreateTicket = mailData.should_create_ticket && !mailData.ticket_id;
    const suggestedPriority = mailData.suggested_ticket_priority || 'normal';
    
    if (ticketTip && shouldCreateTicket) {
      ticketTip.style.display = 'block';
      requestAnimationFrame(() => ticketTip.classList.add('show'));
      
      // Set priority badge
      const priorityMap = {
        'urgent': { text: 'Urgent', color: '#dc2626', bg: '#fee2e2' },
        'high': { text: 'Hoog', color: '#ea580c', bg: '#fff7ed' },
        'normal': { text: 'Normaal', color: '#059669', bg: '#d1fae5' },
        'low': { text: 'Laag', color: '#6b7280', bg: '#f3f4f6' }
      };
      
      const priorityInfo = priorityMap[suggestedPriority] || priorityMap['normal'];
      if (ticketPriorityBadge) {
        ticketPriorityBadge.textContent = priorityInfo.text;
        ticketPriorityBadge.style.display = 'inline-flex';
        ticketPriorityBadge.style.background = priorityInfo.bg;
        ticketPriorityBadge.style.color = priorityInfo.color;
      }
      
      ticketCreateBtn.onclick = async () => {
        try {
          ticketCreateBtn.disabled = true;
          ticketCreateBtn.textContent = 'Ticket wordt aangemaakt...';
          
          const res = await fetch(`/admin/api/mails/${mailId}/auto-create-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Kon ticket niet aanmaken');
          }
          
          const data = await res.json();
          
          ticketTip.style.display = 'none';
          if (window.showNotification) {
            window.showNotification(`Ticket aangemaakt met prioriteit: ${priorityInfo.text}`, 'success', 4000);
          }
          
          // Optionally redirect to ticket
          if (data.ticket && data.ticket.id) {
            setTimeout(() => {
              window.location.href = `/admin/tickets/${data.ticket.id}`;
            }, 1500);
          }
        } catch (err) {
          ticketCreateBtn.disabled = false;
          ticketCreateBtn.textContent = 'Maak ticket aan';
          if (window.showNotification) {
            window.showNotification('Fout bij aanmaken ticket: ' + err.message, 'error', 4000);
          }
        }
      };
    }

    // AI suggestion tip (no auto action) - only for leads, not customer requests
    const tip = document.getElementById('aiTipCompact');
    const tipBtn = document.getElementById('aiTipCreateBtn');
    const confEl = document.getElementById('aiTipConfidence');
    // Only suggest creating opportunity for "lead" labels (new sales opportunities)
    // NOT for "customer_request" (existing customers asking for support)
    const shouldSuggest = current === 'lead' || current === 'follow_up';
    if (tip && tipBtn) {
      // Only show if no ticket tip is showing
      const showAITip = shouldSuggest && !shouldCreateTicket;
      tip.style.display = showAITip ? 'block' : 'none';
      if (showAITip) { requestAnimationFrame(() => tip.classList.add('show')); }
      tipBtn.onclick = () => createOpportunityFromMail(mailId);
      // Optional: set confidence text if server provided a score on the mail object
      try {
        const score = (window.__lastMailScore && typeof window.__lastMailScore === 'number') ? window.__lastMailScore : null;
        if (confEl && score != null) {
          confEl.textContent = `${Math.round(score * 100)}% match`;
          confEl.style.display = 'inline-flex';
        }
      } catch(_) {}
    }
  }

  async function aiReply(id) {
    const container = document.getElementById('aiReplyContainer');
    if (!container) {
      console.error('AI reply container not found');
      return;
    }
    
    if (!id) {
      console.error('Mail ID is missing');
      return;
    }
    
    // Show loading indicator in the new structure
    const loadingEl = document.getElementById('aiReplyLoading');
    const textareaEl = document.getElementById('aiSuggestionTextarea');
    const infoEl = document.getElementById('aiReplyInfo');
    const actionsEl = document.getElementById('aiSuggestionActions');
    const feedbackEl = document.getElementById('aiFeedbackButtons');
    
    if (loadingEl) loadingEl.style.display = 'flex';
    if (textareaEl) textareaEl.style.display = 'none';
    if (infoEl) infoEl.style.display = 'none';
    if (actionsEl) actionsEl.style.display = 'none';
    if (feedbackEl) feedbackEl.style.display = 'none';
    
    try {
      const res = await fetch(`/admin/api/mail/${id}/ai-reply`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      
      const data = await res.json();
      
      if (data.draft) {
        await loadAiReply(id, data.draft, data.draftHtml, data.signature);
      } else {
        if (loadingEl) loadingEl.innerHTML = `<div style="color:#dc2626;">Fout: ${data.error || 'Kon AI-antwoord niet genereren'}</div>`;
      }
    } catch (e) {
      console.error('AI reply error:', e);
      if (loadingEl) loadingEl.innerHTML = `<div style="color:#dc2626;">Fout: ${e.message || 'Onbekende fout bij genereren AI-antwoord'}</div>`;
      if (window.showNotification) {
        window.showNotification('Fout bij genereren AI-antwoord: ' + e.message, 'error', 5000);
      }
    }
  }
  
  async function loadAiReply(mailId, draftText, draftHtml = null, signatureHtml = null) {
    // Get elements in new structure
    const loadingEl = document.getElementById('aiReplyLoading');
    const textareaEl = document.getElementById('aiSuggestionTextarea');
    const infoEl = document.getElementById('aiReplyInfo');
    const actionsEl = document.getElementById('aiSuggestionActions');
    const feedbackEl = document.getElementById('aiFeedbackButtons');
    const editBtn = document.getElementById('aiEditBtn');
    const sendBtn = document.getElementById('aiSendBtn');
    
    if (!textareaEl || !actionsEl) {
      console.error('AI reply elements not found');
      return;
    }
    
    // Get current feedback status with timeout (don't wait too long)
    let feedback = null;
    try {
      const feedbackRes = await Promise.race([
        fetch(`/admin/api/mail/${mailId}/feedback`),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500))
      ]);
      if (feedbackRes.ok) {
        const feedbackData = await feedbackRes.json();
        feedback = feedbackData.feedback;
      }
    } catch (e) {
      // No feedback yet or timeout - continue without feedback
    }
    
    // Extract the main reply body without signature
    let cleanReplyBody = draftText || '';
    if (signatureHtml) {
      cleanReplyBody = cleanReplyBody
        .replace(/\n\n(GrowSocial|Rogier\s+Schoenmakers|.*@.*|.*\+31.*|.*growsocialmedia\.nl.*)+$/gi, '')
        .trim();
    }
    
    // Hide loading, show textarea and actions
    if (loadingEl) loadingEl.style.display = 'none';
    textareaEl.style.display = 'block';
    textareaEl.value = cleanReplyBody;
    textareaEl.readOnly = true;
    
    if (infoEl) infoEl.style.display = 'flex';
    if (actionsEl) actionsEl.style.display = 'flex';
    if (feedbackEl) {
      feedbackEl.style.display = 'flex';
      // Update feedback buttons
      feedbackEl.querySelectorAll('button').forEach(btn => {
        const fb = btn.getAttribute('data-feedback');
        btn.classList.toggle('active', (fb === 'good' && feedback === 'positive') || (fb === 'bad' && feedback === 'negative'));
        btn.setAttribute('data-mail-id', mailId);
      });
    }
    
    // Store signature for later use
    window._currentMailSignature = signatureHtml || '';
    
    // Feedback handlers
    if (feedbackEl) {
      feedbackEl.querySelectorAll('button[data-feedback]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const feedbackType = btn.getAttribute('data-feedback');
          const mid = btn.getAttribute('data-mail-id');
          
          try {
            const apiFeedbackType = feedbackType === 'good' ? 'positive' : 'negative';
            await fetch(`/admin/api/mail/${mid}/feedback`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ feedback: apiFeedbackType })
            });
            
            // Update UI
            feedbackEl.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (window.showNotification) {
              window.showNotification(
                feedbackType === 'good' ? 'Bedankt voor je feedback!' : 'Bedankt, we gebruiken dit om te verbeteren.',
                'success',
                2000
              );
            }
          } catch (err) {
            if (window.showNotification) {
              window.showNotification('Fout bij opslaan feedback', 'error', 3000);
            }
          }
        });
      });
    }
    
    // Edit button - toggle readonly state
    if (!editBtn || !textareaEl) {
      console.error('Edit button or textarea not found');
      return;
    }
    
    let isEditing = false;
    
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      isEditing = !isEditing;
      textareaEl.readOnly = !isEditing;
      
      if (isEditing) {
        editBtn.classList.add('active');
        editBtn.innerHTML = '<i class="fas fa-check"></i> Opslaan';
        textareaEl.style.borderColor = '#3b82f6';
        textareaEl.focus();
      } else {
        editBtn.classList.remove('active');
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Bewerken';
        textareaEl.style.borderColor = '#e5e7eb';
        
        // Save edited text
        const editedText = textareaEl.value.trim();
        if (editedText) {
          fetch(`/admin/api/mail/${mailId}/draft`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draft: editedText })
          }).catch(err => {
            console.error('Error saving draft:', err);
            if (window.showNotification) {
              window.showNotification('Fout bij opslaan wijzigingen', 'error', 3000);
            }
          });
        }
      }
    });
    
    // Send button
    if (sendBtn) {
      sendBtn.addEventListener('click', async () => {
        const text = textareaEl.value;
        if (!text.trim()) {
          if (window.showNotification) {
            window.showNotification('Antwoord is leeg', 'error', 3000);
        }
        return;
      }
      
      // Get HTML signature from stored variable
      const htmlSignature = window._currentMailSignature || '';
      
      // The textarea contains ONLY the reply body (no signature)
      // Signature will be added separately when sending
      const replyBodyText = text;
      
      // Combine text body with HTML signature for email
      // Convert text to HTML (preserve line breaks) and append signature
      const textHtml = replyBodyText.replace(/\n/g, '<br>');
      const fullHtmlBody = htmlSignature ? textHtml + '<br><br>' + htmlSignature : textHtml;
      
      // Plain text version - use the original text
      const fullTextBody = text;
      
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verzenden...';
      
      try {
        const res = await fetch(`/admin/api/mail/${mailId}/send-reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: fullTextBody, html: fullHtmlBody })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          if (window.showNotification) {
            window.showNotification('Antwoord succesvol verzonden', 'success', 3000);
          }
          
          // Close drawer after delay
          setTimeout(() => {
            closeDrawer();
            // Remove mail from list
            const item = document.querySelector(`.mail-item[data-mail-id="${mailId}"]`);
            if (item) item.remove();
          }, 1500);
        } else {
          // Check if it's an SPF error for better user messaging
          const errorMsg = data.error || 'Verzenden mislukt';
          if (data.isSpfError || errorMsg.includes('SPF')) {
            // Show detailed SPF error message
            const spfHelp = errorMsg.split('\n').filter(line => line.trim()).join('\n');
            if (window.showNotification) {
              window.showNotification(spfHelp, 'error', 10000);
            } else {
              alert(spfHelp);
            }
          } else {
            throw new Error(errorMsg);
          }
        }
      } catch (err) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Verzenden';
        if (window.showNotification) {
          window.showNotification('Fout bij verzenden: ' + err.message, 'error', 5000);
        }
      }
    });
  }

  async function quickUnsubscribe(id) {
    try {
      const res = await fetch(`/admin/api/mail/${id}/unsubscribe`, { method: 'POST' });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Onbekende fout' }));
        throw new Error(error.error || 'Kon niet afmelden');
      }
      
      const data = await res.json();
      const message = data.autoUnsubscribed 
        ? 'Succesvol automatisch afgemeld van deze nieuwsbrief' 
        : 'Afmelding geregistreerd (automatisch afmelden niet mogelijk)';
      
      // Update UI - remove unsubscribe button and show success
      const item = document.querySelector(`.mail-item[data-mail-id="${id}"]`);
      if (item) {
        const unsubscribeBtn = item.querySelector('.mail-unsubscribe-btn');
        if (unsubscribeBtn) {
          unsubscribeBtn.style.background = '#d1fae5';
          unsubscribeBtn.style.color = '#059669';
          unsubscribeBtn.style.borderColor = '#059669';
          unsubscribeBtn.innerHTML = '<i class="fas fa-check"></i> Afgemeld';
          unsubscribeBtn.disabled = true;
        }
      }
      
      if (window.showNotification) {
        window.showNotification(message, 'success', 4000);
      } else {
        alert(message);
      }
    } catch (e) {
      if (window.showNotification) {
        window.showNotification('Fout bij afmelden: ' + (e.message || 'Onbekende fout'), 'error', 4000);
      } else {
        alert('Kon afmelding niet verwerken: ' + (e.message || 'Onbekende fout'));
      }
    }
  }

  async function archiveMail(id) {
    try {
      await fetch(`/admin/api/mail/${id}/archive`, { method: 'POST' });
      const card = document.querySelector(`.mail-card[data-mail-id="${id}"]`);
      if (card) card.remove();
      if (window.showNotification) {
        window.showNotification('Mail gearchiveerd', 'success', 3000);
      }
      // Update count
      applyFilters();
    } catch (e) {
      if (window.showNotification) {
        window.showNotification('Kon mail niet archiveren', 'error', 5000);
      }
    }
  }

  async function createTicketFromMail(mailId) {
    try {
      const res = await fetch(`/admin/api/tickets/from-mail/${mailId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        if (window.showNotification) {
          window.showNotification(`Ticket ${data.ticket?.ticket_number || ''} aangemaakt!`, 'success', 4000);
        }
        // Redirect to tickets page after a short delay
        setTimeout(() => {
          window.location.href = '/admin/tickets';
        }, 1500);
      } else {
        throw new Error(data.error || 'Kon ticket niet aanmaken');
      }
    } catch (e) {
      if (window.showNotification) {
        window.showNotification('Fout bij aanmaken ticket: ' + e.message, 'error', 5000);
      }
    }
  }

  // Toggle star function
  window.toggleStar = async function(mailId, evt) {
    if (evt) evt.stopPropagation();
    const card = document.querySelector(`.mail-card[data-mail-id="${mailId}"]`);
    const icon = card?.querySelector('.mail-action-icon:first-of-type i');
    if (icon) {
      icon.classList.toggle('fas');
      icon.classList.toggle('far');
      if (icon.classList.contains('fas')) {
        icon.style.color = '#fbbf24';
      } else {
        icon.style.color = '#6b7280';
      }
    }
  };

  // Delete mail function
  window.deleteMail = async function(mailId, evt) {
    if (evt) evt.stopPropagation();
    const card = document.querySelector(`.mail-card[data-mail-id="${mailId}"]`);
    const item = document.querySelector(`.mail-item[data-mail-id="${mailId}"]`);
    if (!card && !item) return;
    
    // Get mail subject for better confirmation message
    const subject = card?.querySelector('.mail-card-subject')?.textContent || 
                    item?.querySelector('.mail-subject')?.textContent || 
                    'deze mail';
    
    showMailConfirmDialog(
      `Weet je zeker dat je deze mail wilt verwijderen?<br><strong>${escapeHtml(subject)}</strong><br><br>Deze actie kan niet ongedaan worden gemaakt.`,
      async () => {
        try {
          await fetch(`/admin/api/mail/${mailId}`, { method: 'DELETE' });
          if (card) card.remove();
          if (item) item.remove();
          if (window.showNotification) {
            window.showNotification('Mail verwijderd', 'success', 3000);
          }
          if (typeof applyFilters === 'function') {
            applyFilters();
          }
        } catch (e) {
          if (window.showNotification) {
            window.showNotification('Kon mail niet verwijderen', 'error', 5000);
          }
        }
      }
    );
  };

  composeBtn?.addEventListener('click', () => {
    alert('Compose: komt binnenkort (concept modal).');
  });
  
  // Auto-refresh mail list every 15 seconds to show new emails instantly
  
  function startMailPolling() {
    // Clear existing interval if any
    if (mailRefreshInterval) {
      clearInterval(mailRefreshInterval);
    }
    
    // Track current count to avoid unnecessary reloads
    let currentCount = mailCardsList?.querySelectorAll('.mail-card').length || 0;
    
    // Poll every 15 seconds for new mails (faster than cron)
    mailRefreshInterval = setInterval(async () => {
      try {
        if (document.body.classList.contains('mail-drawer-open')) {
          pendingReloadAfterDrawer = true;
          return;
        }
        // Get current mailbox filter
        const currentMailbox = mailboxSelect?.value || 'all';
        const currentLabel = labelFilter?.value || 'all';
        const currentSearch = searchInput?.value || '';
        const currentPerPage = parseInt(new URL(window.location).searchParams.get('perPage')) || 15;
        
        // Build URL with current filters
        let url = '/admin/api/mail/list';
        const params = new URLSearchParams();
        if (currentMailbox !== 'all') params.append('mailbox', currentMailbox);
        if (currentLabel !== 'all') params.append('label', currentLabel);
        if (currentSearch) params.append('search', currentSearch);
        params.append('perPage', Math.max(1, Math.min(50, currentPerPage)));
        if (params.toString()) url += '?' + params.toString();
        
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.mails && Array.isArray(data.mails)) {
            // Reload if count changed or new mails detected
            if (data.count !== currentCount || data.newCount > 0) {
              currentCount = data.count;
              if (!document.body.classList.contains('mail-drawer-open')) {
                location.reload();
              } else {
                pendingReloadAfterDrawer = true;
              }
            }
          }
        }
      } catch (e) {
        console.error('Error polling for new mails:', e);
      }
    }, 15000); // 15 seconds - faster polling for instant updates
  }
  
  // Start polling when page loads
  startMailPolling();
  
  // Clear interval when page unloads
  window.addEventListener('beforeunload', () => {
    if (mailRefreshInterval) {
      clearInterval(mailRefreshInterval);
    }
  });

  // New listing controls wiring (search + filters)
  (function initNewListingFilters(){
    const search = document.getElementById('mailSearchInput');
    const mailbox = document.getElementById('mailboxSelect');
    const labelSelect = document.getElementById('labelSelect');
    const filterSelect = document.getElementById('filterSelect');
    if (!search && !mailbox && !labelSelect && !filterSelect) return;
    
    // Debounce helper
    const debounce = (fn, ms = 300) => {
      let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    };

    // Render list rows from API data
    const renderList = (mails = []) => {
      const list = document.getElementById('mailList');
      if (!list) return;
      const nameMap = {
        customer_request: 'Klantaanvraag',
        support_request: 'Supportaanvraag',
        urgent: 'Urgent',
        lead: 'Kans',
        junk: 'Spam',
        spam: 'Spam',
        support: 'Support',
        newsletter: 'Nieuwsbrief',
        other: 'Overig',
        follow_up: 'Follow-up',
        feedback: 'Feedback',
        invoice: 'Factuur',
        factuur: 'Factuur',
        bevestiging: 'Bevestiging'
      };
      const classFor = (label) => ({
        newsletter: 'mail-label-neutral',
        other: 'mail-label-neutral',
        follow_up: 'mail-label-neutral',
        feedback: 'mail-label-neutral',
        junk: 'mail-label-neutral',
        spam: 'mail-label-neutral',
        support_request: 'mail-label-orange',
        support: 'mail-label-orange',
        invoice: 'mail-label-factuur',
        factuur: 'mail-label-factuur',
        bevestiging: 'mail-label-bevestiging',
        customer_request: 'mail-label-blue',
        lead: 'mail-label-personal',
        urgent: 'mail-label-important'
      }[label] || 'mail-label-neutral');
      const rows = mails.map(m => {
        const fromEmail = m.from_email || '';
        const fromName = (m.display_from_name || m.from_name || '').trim() || (fromEmail ? fromEmail.split('@')[0] : '');
        const initials = (fromName || '?').split(/\s+/).map(s => s[0]).join('').slice(0,2).toUpperCase();
        const subject = (m.display_subject || m.subject || '').trim();
        const preview = (m.body_text || '').replace(/\s+/g,' ').slice(0,120);
        const d = m.received_at ? new Date(m.received_at) : new Date();
        const isToday = d.toDateString() === new Date().toDateString();
        const timeDisplay = isToday ? d.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}) : d.toLocaleDateString('nl-NL',{day:'2-digit',month:'short'});
        const labels = Array.isArray(m.labels) ? m.labels : [];
        return `
          <div class="mail-item" data-mail-id="${m.id}" data-read="${m.read_at ? 'true' : 'false'}">
            <label class="mail-checkbox-label" onclick="event.stopPropagation()">
              <input type="checkbox" class="mail-checkbox-input mail-item-checkbox" onchange="updateBulkActions()">
              <span class="mail-checkbox-box"></span>
            </label>
            <div class="mail-content" onclick="openMail('${m.id}')">
              <div class="mail-top-row">
                <div class="mail-sender-section">
                  <div class="mail-avatar">${initials}</div>
                  <div class="mail-sender-info">
                    <div class="mail-sender-name">${fromName}</div>
                    <div class="mail-sender-email">${fromEmail}</div>
                  </div>
                </div>
                <div class="mail-meta-section">
                  ${m.read_at ? '' : '<span class="mail-unread-dot" title="Ongelezen"></span>'}
                  ${m.has_attachments ? '<span class="mail-attachment-tag">📎</span>' : ''}
                  <button class="mail-star-btn" onclick="event.stopPropagation(); toggleStar('${m.id}')">★</button>
                  <span class="mail-time">${timeDisplay}</span>
                </div>
              </div>
              <div class="mail-subject">${subject}</div>
              ${preview ? `<div class="mail-preview">${preview}${(m.body_text||'').length>120?'…':''}</div>` : ''}
              <div class="mail-tags-row">
                ${labels.map(l => {
                  const isCustomerRequest = l.label === 'customer_request';
                  const isSupport = l.label === 'support';
                  const customer = m.customers || null;
                  const hasCustomer = customer && (customer.id || customer.name || customer.company_name);
                  
                  if ((isCustomerRequest || isSupport) && hasCustomer) {
                    const customerName = customer.company_name || customer.name || '';
                    const logoUrl = customer.logo_url || null;
                    return `<span class="mail-label-tag ${classFor(l.label)}" style="display:inline-flex;align-items:center;gap:6px;">
                      ${logoUrl ? `<img src="${logoUrl}" alt="${customerName}" style="width:16px;height:16px;border-radius:3px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">` : ''}
                      <span>${nameMap[l.label] || (l.label||'')}</span>
                      ${customerName ? `<span style="color:#9ca3af;font-size:11px;font-weight:400;margin-left:2px;">${customerName}</span>` : ''}
                    </span>`;
                  }
                  return `<span class="mail-label-tag ${classFor(l.label)}">${nameMap[l.label] || (l.label||'')}</span>`;
                }).join('')}
                ${labels.some(l => l.label==='lead') ? `<button class="btn-outline-sm" style="margin-left:8px" onclick="event.stopPropagation(); createOpportunityFromMail('${m.id}')"><i class="fas fa-user-plus"></i> Maak kans aan</button>` : ''}
                ${labels.some(l => l.label==='junk' || l.label==='newsletter') ? `<button class="btn-outline-sm mail-unsubscribe-btn" style="margin-left:8px;background:#fee2e2;color:#dc2626;border-color:#dc2626;" onclick="event.stopPropagation(); quickUnsubscribe('${m.id}')" title="Afmelden van deze nieuwsbrief"><i class="fas fa-ban"></i> Afmelden</button>` : ''}
              </div>
            </div>
          </div>`
      }).join('');
      list.innerHTML = rows || '';
    };

    // AJAX search (debounced)
    const ajaxSearch = debounce(async () => {
      const params = new URLSearchParams();
      const mailboxVal = mailbox?.value || 'all';
      const labelVal = labelSelect?.value || 'all';
      const searchVal = search?.value?.trim() || '';
      const filterVal = filterSelect?.value || 'all';
      if (mailboxVal && mailboxVal !== 'all') params.set('mailbox', mailboxVal);
      if (labelVal && labelVal !== 'all') params.set('label', labelVal);
      if (searchVal) params.set('search', searchVal);
      if (filterVal === 'unread' || filterVal === 'attachments') params.set('filter', filterVal);
      const url = '/admin/api/mail/list' + (params.toString() ? ('?' + params.toString()) : '');
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.mails)) {
          renderList(data.mails);
          // Reflect URL without reload
          const newUrl = new URL(window.location);
          if (searchVal) newUrl.searchParams.set('search', searchVal); else newUrl.searchParams.delete('search');
          window.history.replaceState({}, '', newUrl.toString());
        }
      } catch (_) {}
    }, 350);

    const apply = () => {
      const url = new URL(window.location);
      if (mailbox && mailbox.value !== 'all') url.searchParams.set('mailbox', mailbox.value); else url.searchParams.delete('mailbox');
      const labelVal = labelSelect?.value || 'all';
      if (labelVal !== 'all') url.searchParams.set('label', labelVal); else url.searchParams.delete('label');
      const searchVal = search?.value?.trim();
      if (searchVal) url.searchParams.set('search', searchVal); else url.searchParams.delete('search');
      const filterVal = filterSelect?.value || 'all';
      if (filterVal === 'unread') url.searchParams.set('filter', 'unread');
      else if (filterVal === 'attachments') url.searchParams.set('filter', 'attachments');
      else url.searchParams.delete('filter');
      url.searchParams.set('page', '1');
      window.location.href = url.toString();
    };
    // Live AJAX search while typing
    search?.addEventListener('input', () => ajaxSearch());
    // Enter still triggers full filter (optional)
    search?.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    mailbox?.addEventListener('change', apply);
    labelSelect?.addEventListener('change', apply);
    filterSelect?.addEventListener('change', apply);
  })();

  // Open mail on row click (event delegation, safe around checkboxes/actions)
  (function initMailRowOpen(){
    const list = document.getElementById('mailList');
    if (!list) return;
    list.addEventListener('click', (e) => {
      // Ignore clicks on checkboxes or inside checkbox label
      if (e.target.closest('.mail-checkbox-label')) return;
      // Ignore explicit action buttons inside meta
      if (e.target.closest('.mail-star-btn')) return;
      const item = e.target.closest('.mail-item');
      if (!item) return;
      const id = item.getAttribute('data-mail-id');
      if (id) {
        e.preventDefault();
        openMail(id);
      }
    });
  })();
}

});

// Make showMailActionsMenu globally available
window.showMailActionsMenu = showMailActionsMenu;


// Selection & pagination helpers for new listing
window.toggleSelectAll = function(checkbox){
  document.querySelectorAll('.mail-item-checkbox').forEach(cb => {
    cb.checked = checkbox.checked;
    const item = cb.closest('.mail-item');
    if (!item) return;
    if (checkbox.checked) item.classList.add('selected'); else item.classList.remove('selected');
  });
  window.updateBulkActions();
};

window.updateBulkActions = function(){
  const checked = Array.from(document.querySelectorAll('.mail-item-checkbox')).filter(cb => cb.checked);
  const bar = document.getElementById('bulkActionsBar');
  const countEl = document.getElementById('bulkCount');
  if (bar && countEl){
    if (checked.length > 0){
      bar.style.display = 'flex';
      countEl.textContent = `${checked.length} geselecteerd`;
    } else {
      bar.style.display = 'none';
    }
  }
};

window.clearSelection = function(){
  document.querySelectorAll('.mail-item-checkbox').forEach(cb => cb.checked = false);
  document.getElementById('selectAllCheckbox')?.removeAttribute('checked');
  document.querySelectorAll('.mail-item').forEach(i => i.classList.remove('selected'));
  window.updateBulkActions();
};

window.markSelectedAsRead = async function(){
  const ids = Array.from(document.querySelectorAll('.mail-item-checkbox')).filter(cb => cb.checked).map(cb => cb.closest('.mail-item')?.dataset.mailId).filter(Boolean);
  ids.forEach(id => { const el = document.querySelector(`.mail-item[data-mail-id="${id}"]`); if (el) el.dataset.read = 'true'; });
  window.clearSelection();
};

window.deleteSelected = async function(){
  const ids = Array.from(document.querySelectorAll('.mail-item-checkbox')).filter(cb => cb.checked).map(cb => cb.closest('.mail-item')?.dataset.mailId).filter(Boolean);
  if (ids.length === 0) return;
  
  showMailConfirmDialog(
    `Weet je zeker dat je <strong>${ids.length}</strong> e-mail${ids.length > 1 ? 's' : ''} wilt verwijderen?<br><br>Deze actie kan niet ongedaan worden gemaakt.`,
    async () => {
      try {
        // Show loading state
        const bulkBar = document.getElementById('bulkActionsBar');
        if (bulkBar) {
          bulkBar.style.opacity = '0.6';
          bulkBar.style.pointerEvents = 'none';
        }
        
        // Delete all mails in one bulk request
        const res = await fetch('/admin/api/mail/bulk/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids })
        });
        
        const data = await res.json();
        
        if (res.ok && data.success) {
          // Remove all DOM elements at once (no visual step-by-step)
          ids.forEach(id => {
            const item = document.querySelector(`.mail-item[data-mail-id="${id}"]`);
            const card = document.querySelector(`.mail-card[data-mail-id="${id}"]`);
            if (item) item.remove();
            if (card) card.remove();
          });
          
          window.clearSelection();
          
          if (window.showNotification) {
            window.showNotification(`${ids.length} e-mail${ids.length > 1 ? 's' : ''} verwijderd`, 'success', 3000);
          }
          
          // Refresh counts if function exists
          if (typeof applyFilters === 'function') {
            applyFilters();
          }
        } else {
          throw new Error(data.error || 'Kon e-mails niet verwijderen');
        }
      } catch (e) {
        console.error('Error deleting mails:', e);
        if (window.showNotification) {
          window.showNotification('Fout bij verwijderen: ' + (e.message || 'Onbekende fout'), 'error', 5000);
        }
      } finally {
        // Restore bulk bar
        const bulkBar = document.getElementById('bulkActionsBar');
        if (bulkBar) {
          bulkBar.style.opacity = '1';
          bulkBar.style.pointerEvents = 'auto';
        }
      }
    }
  );
};

  // Create opportunity from a mail
  window.createOpportunityFromMail = async function(mailId){
    try {
      const res = await fetch(`/admin/api/opportunities/from-mail/${mailId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fout bij aanmaken lead');
      if (window.showNotification) window.showNotification('Kans aangemaakt', 'success', 3000);
      // Redirect to the newly created opportunity detail page
      if (data.opportunity && data.opportunity.id) {
        setTimeout(() => { window.location.href = `/admin/opportunities/${data.opportunity.id}`; }, 500);
      } else {
      setTimeout(() => { window.location.href = '/admin/opportunities'; }, 500);
      }
    } catch (e) {
      if (window.showNotification) window.showNotification('Kon lead niet aanmaken: ' + e.message, 'error', 5000);
    }
  };

// Pagination functions (same as payments page)
window.goToPage = function(page) {
  const url = new URL(window.location);
  url.searchParams.set('page', page);
  window.location.href = url.toString();
};

// Initialize pagination on page load
(function initMailPagination() {
  const paginationContainer = document.querySelector('.pagination-container');
  if (!paginationContainer) return;
  
  const url = new URL(window.location);
  const currentPage = parseInt(paginationContainer.getAttribute('data-current-page')) || parseInt(url.searchParams.get('page')) || 1;
  const perPage = parseInt(paginationContainer.getAttribute('data-per-page')) || parseInt(url.searchParams.get('perPage')) || parseInt(document.getElementById('perPageSelect')?.value) || 10;
  const totalMails = parseInt(paginationContainer.getAttribute('data-total-mails')) || 0;
  const totalPages = parseInt(paginationContainer.getAttribute('data-total-pages')) || Math.ceil(totalMails / perPage);
  
  // Update pagination info
  const paginationInfo = document.getElementById('paginationInfo');
  if (paginationInfo && totalMails > 0) {
    const startIndex = (currentPage - 1) * perPage;
    const endIndex = Math.min(currentPage * perPage, totalMails);
    paginationInfo.textContent = `Toont ${startIndex + 1} tot ${endIndex} van ${totalMails} resultaten`;
  }
  
  // Render pagination buttons
  const paginationButtons = document.getElementById('paginationButtons');
  if (paginationButtons && totalPages > 0) {
    // Generate page buttons (max 8 pages shown)
    const pageButtons = [];
    const maxPagesToShow = 8;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === currentPage;
      pageButtons.push(`
        <button class="pagination-page ${isActive ? 'pagination-page-active' : ''}" onclick="goToPage(${i})">
          ${i}
        </button>
      `);
    }
    
    paginationButtons.innerHTML = `
      <button class="pagination-nav" id="prevButton" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      ${pageButtons.join('')}
      <button class="pagination-nav" id="nextButton" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    `;
  }
  
  // Items per page selector
  const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
  if (itemsPerPageSelect) {
    itemsPerPageSelect.addEventListener('change', (e) => {
      const url = new URL(window.location);
      url.searchParams.set('perPage', e.target.value);
      url.searchParams.set('page', '1'); // Reset to first page
      window.location.href = url.toString();
    });
  }
})();

