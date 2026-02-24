/**
 * Header notifications: trigger in user dropdown, popover list, tabs, mark read.
 * Loaded on every admin page.
 */
(function () {
  const trigger = document.getElementById('headerNotificationsTrigger');
  const badge = document.getElementById('headerNotificationsBadge');
  const badgeOnToggle = document.getElementById('headerNotificationsBadgeOnToggle');
  const popover = document.getElementById('headerNotificationsPopover');
  const listEl = document.getElementById('headerNotificationsList');
  const loadingEl = document.getElementById('headerNotificationsLoading');
  const readAllBtn = document.getElementById('headerNotificationsReadAll');
  const userDropdown = document.getElementById('headerUserDropdown');

  if (!trigger || !popover || !listEl) return;

  let currentTab = 'all';
  let notifications = [];
  let lastUnreadCount = 0;

  function setBadge(count) {
    const n = Number(count) || 0;
    const text = n > 99 ? '99+' : String(n);
    if (badge) {
      badge.setAttribute('data-count', n);
      badge.textContent = text;
    }
    if (badgeOnToggle) {
      badgeOnToggle.setAttribute('data-count', n);
      badgeOnToggle.textContent = text;
      badgeOnToggle.setAttribute('aria-hidden', n === 0 ? 'true' : 'false');
    }
  }

  async function fetchUnreadCount() {
    try {
      const res = await fetch('/admin/api/notifications/unread-count', { credentials: 'same-origin' });
      const data = await res.json();
      if (data.success && typeof data.count === 'number') {
        const count = data.count;
        if (count > lastUnreadCount && lastUnreadCount > 0 && popover.hasAttribute('hidden')) {
          if (typeof window.showNotification === 'function') {
            window.showNotification(count === 1 ? 'Je hebt 1 nieuwe melding' : 'Je hebt ' + count + ' nieuwe meldingen', 'info', 4000);
          }
        }
        lastUnreadCount = count;
        setBadge(count);
      }
    } catch (_) {}
  }

  function formatTime(createdAt) {
    if (!createdAt) return '';
    const d = new Date(createdAt);
    const now = new Date();
    const diff = (now - d) / 60000;
    if (diff < 1) return 'Nu';
    if (diff < 60) return Math.floor(diff) + ' min';
    if (diff < 1440) return Math.floor(diff / 60) + ' u';
    if (diff < 10080) return Math.floor(diff / 1440) + ' d';
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }

  function iconForType(type) {
    if (type === 'mention') return '&#64;';
    if (type === 'system') return '⚙';
    return '💬';
  }

  function renderList() {
    const filter = currentTab === 'all' ? null : currentTab === 'mention' ? 'mention' : 'system';
    const items = filter ? notifications.filter((n) => n.type === filter) : notifications;
    if (items.length === 0) {
      listEl.innerHTML = '<div class="header-notifications-loading">Geen meldingen</div>';
      return;
    }
    listEl.innerHTML = items
      .map(
        (n) =>
          `<button type="button" class="header-notifications-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}" data-url="${(n.url || '').replace(/"/g, '&quot;')}">
            <span class="header-notifications-item-icon">${iconForType(n.type)}</span>
            <div class="header-notifications-item-body">
              <div class="header-notifications-item-title">${escapeHtml(n.title || 'Melding')}</div>
              <div class="header-notifications-item-preview">${escapeHtml(n.body || '')}</div>
              <div class="header-notifications-item-time">${formatTime(n.created_at)}</div>
            </div>
          </button>`
      )
      .join('');
    listEl.querySelectorAll('.header-notifications-item').forEach((el) => {
      el.addEventListener('click', () => {
        const url = el.getAttribute('data-url');
        if (url) window.location.href = url;
        popover.setAttribute('hidden', '');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  async function loadNotifications(type) {
    if (loadingEl) loadingEl.style.display = 'block';
    listEl.innerHTML = '';
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (type) params.set('type', type);
      const res = await fetch('/admin/api/notifications?' + params.toString(), { credentials: 'same-origin' });
      const data = await res.json();
      if (data.success) {
        notifications = data.notifications || [];
        setBadge(data.unreadCount != null ? data.unreadCount : 0);
        renderList();
      } else {
        listEl.innerHTML = '<div class="header-notifications-loading">Kon meldingen niet laden</div>';
      }
    } catch (_) {
      listEl.innerHTML = '<div class="header-notifications-loading">Fout bij laden</div>';
    }
    if (loadingEl) loadingEl.style.display = 'none';
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = !popover.hasAttribute('hidden');
    if (open) {
      popover.setAttribute('hidden', '');
      trigger.setAttribute('aria-expanded', 'false');
    } else {
      popover.removeAttribute('hidden');
      trigger.setAttribute('aria-expanded', 'true');
      loadNotifications(currentTab === 'all' ? null : currentTab);
    }
  });

  popover.querySelectorAll('.header-notifications-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      popover.querySelectorAll('.header-notifications-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.getAttribute('data-tab') || 'all';
      loadNotifications(currentTab === 'all' ? null : currentTab);
    });
  });

  if (readAllBtn) readAllBtn.addEventListener('click', async () => {
    try {
      await fetch('/admin/api/notifications/read-all', { method: 'POST', credentials: 'same-origin' });
      setBadge(0);
      notifications.forEach((n) => (n.is_read = true));
      renderList();
    } catch (_) {}
  });

  document.addEventListener('click', (e) => {
    if (userDropdown && !userDropdown.contains(e.target)) {
      popover.setAttribute('hidden', '');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  fetchUnreadCount();
  setInterval(fetchUnreadCount, 60000);
})();
