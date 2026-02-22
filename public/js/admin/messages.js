/**
 * Admin Messages (Chat) UI: conversations list, thread, composer, new chat modal.
 */
(function () {
  const page = document.getElementById('messagesPage');
  if (!page) return;

  const openId = (page.getAttribute('data-open-id') || '').trim();
  const scrollMessageId = (page.getAttribute('data-scroll-message-id') || '').trim();

  const listSkeleton = document.getElementById('messagesListSkeleton');
  const listEmpty = document.getElementById('messagesListEmpty');
  const listInner = document.getElementById('messagesListInner');
  const mainPlaceholder = document.getElementById('messagesMainPlaceholder');
  const threadWrap = document.getElementById('messagesThreadWrap');
  const threadTitle = document.getElementById('messagesThreadTitle');
  const threadMeta = document.getElementById('messagesThreadMeta');
  const threadAvatars = document.getElementById('messagesThreadAvatars');
  const messagesInner = document.getElementById('messagesMessagesInner');
  const loadMoreWrap = document.getElementById('messagesLoadMore');
  const loadMoreBtn = document.getElementById('messagesLoadMoreBtn');
  const newPill = document.getElementById('messagesNewPill');
  const composerInput = document.getElementById('messagesComposerInput');
  const composerSend = document.getElementById('messagesComposerSend');
  const searchInput = document.getElementById('messagesSearchInput');
  const tabs = document.querySelectorAll('.messages-tab');
  const backBtn = document.getElementById('messagesBackBtn');
  const infoPanelBtn = document.getElementById('messagesInfoPanelBtn');
  const rightPanel = document.getElementById('messagesRightPanel');
  const rightPanelClose = document.getElementById('messagesRightPanelClose');
  const rightPanelBody = document.getElementById('messagesRightPanelBody');
  const btnNew = document.getElementById('messagesBtnNew');
  const newModal = document.getElementById('messagesNewModal');
  const newModalBackdrop = document.getElementById('messagesNewModalBackdrop');
  const newModalClose = document.getElementById('messagesNewModalClose');
  const newSearchInput = document.getElementById('messagesNewSearchInput');
  const newResults = document.getElementById('messagesNewResults');

  let conversations = [];
  let currentConversationId = null;
  let currentConversation = null;
  let messages = [];
  let nextCursor = null;
  let currentTab = 'all';
  let newMessagesCount = 0;
  let pollInterval = null;

  function currentUserId() {
    return window.currentUserId || (document.body.getAttribute('data-user-id') || '').trim();
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
  }

  function participantDisplayName(p) {
    if (!p) return '—';
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || (p.email || '').trim();
    return name || '—';
  }

  function avatarHtml(profile, sizeClass) {
    const name = participantDisplayName(profile);
    const initial = (name !== '—' ? name.charAt(0) : '?').toUpperCase();
    const img = profile && profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="">` : initial;
    return `<div class="messages-conv-avatar ${sizeClass || ''}">${img}</div>`;
  }

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const today = now.toDateString() === d.toDateString();
    if (today) return d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.toDateString() === d.toDateString()) return 'Gisteren';
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }

  function formatDateSep(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    if (now.toDateString() === d.toDateString()) return 'Vandaag';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.toDateString() === d.toDateString()) return 'Gisteren';
    return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  async function api(path, opts) {
    const res = await fetch(path, { credentials: 'same-origin', ...opts });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  async function loadConversations() {
    const params = new URLSearchParams();
    if (currentTab === 'unread') params.set('unread', 'true');
    const search = (searchInput && searchInput.value || '').trim();
    if (search) params.set('search', search);
    const data = await api('/admin/api/messages/conversations' + (params.toString() ? '?' + params : ''));
    conversations = data.conversations || [];
    renderConversationList();
    if (listSkeleton) listSkeleton.style.display = 'none';
    if (listEmpty) listEmpty.style.display = conversations.length === 0 ? 'block' : 'none';
    if (listInner) listInner.style.display = conversations.length > 0 ? 'block' : 'none';
  }

  function conversationTitle(c) {
    if (c && c.title && String(c.title).trim()) return c.title.trim();
    const parts = (c && c.participants) ? (c.participants.map((p) => participantDisplayName(p)).filter((n) => n !== '—')) : [];
    return parts.length ? parts.join(', ') : 'Chat';
  }

  function renderConversationList() {
    if (!listInner) return;
    listInner.innerHTML = conversations.map((c) => {
      const title = conversationTitle(c);
      const preview = c.last_message_at ? (c.last_message_preview || 'Bericht') : 'Geen berichten';
      const time = formatTime(c.last_message_at);
      const active = c.id === currentConversationId ? ' active' : '';
      const badge = c.unread ? `<span class="messages-conv-badge">${c.unread_count || '1'}</span>` : '';
      const initial = (title || '?').charAt(0).toUpperCase();
      return `<button type="button" class="messages-conv-item${active}" data-conversation-id="${escapeHtml(c.id)}">
        <div class="messages-conv-avatar">${escapeHtml(initial)}</div>
        <div class="messages-conv-body">
          <div class="messages-conv-title">${escapeHtml(title)}</div>
          <div class="messages-conv-preview">${escapeHtml(preview)}</div>
          <div class="messages-conv-meta">
            <span class="messages-conv-time">${escapeHtml(time)}</span>
            ${badge}
          </div>
        </div>
      </button>`;
    }).join('');
    listInner.querySelectorAll('.messages-conv-item').forEach((el) => {
      el.addEventListener('click', () => openConversation(el.getAttribute('data-conversation-id')));
    });
  }

  function showThreadSkeleton(show) {
    const sk = document.getElementById('messagesThreadSkeleton');
    const info = document.getElementById('messagesThreadInfo');
    const partSk = document.getElementById('messagesParticipantsSkeleton');
    if (sk) sk.style.display = show ? 'block' : 'none';
    if (info) info.style.display = show ? 'none' : 'flex';
    if (partSk) partSk.style.display = show ? 'block' : 'none';
    if (rightPanelBody) rightPanelBody.style.display = show ? 'none' : 'block';
  }

  async function openConversation(id) {
    if (!id) return;
    currentConversationId = id;
    newMessagesCount = 0;
    if (newPill) newPill.style.display = 'none';
    renderConversationList();
    mainPlaceholder.style.display = 'none';
    threadWrap.style.display = 'flex';
    showThreadSkeleton(true);
    threadTitle.textContent = '';
    threadMeta.textContent = '';
    threadAvatars.innerHTML = '';
    if (rightPanelBody) rightPanelBody.innerHTML = '';
    messagesInner.innerHTML = '';
    try {
      const data = await api('/admin/api/messages/conversations/' + id);
      currentConversation = data.conversation;
      if (!currentConversation) {
        showThreadSkeleton(false);
        threadTitle.textContent = 'Chat';
        threadMeta.textContent = '0 deelnemer(s)';
        return;
      }
      showThreadSkeleton(false);
      threadTitle.textContent = conversationTitle(currentConversation);
      const partCount = (currentConversation.participants || []).length;
      threadMeta.textContent = partCount + ' deelnemer(s)';
      threadAvatars.innerHTML = (currentConversation.participants || []).slice(0, 3).map((p) => avatarHtml(p)).join('');
      if (rightPanelBody && currentConversation.participants) {
        rightPanelBody.innerHTML = currentConversation.participants.map((p) => {
          const name = participantDisplayName(p);
          return `<div class="messages-partipant">${avatarHtml(p)}<span class="messages-partipant-name">${escapeHtml(name)}</span></div>`;
        }).join('');
      }
      await api('/admin/api/messages/conversations/' + id + '/read', { method: 'POST' });
      nextCursor = null;
      messages = [];
      await loadMessages();
      if (scrollMessageId) {
        const el = document.getElementById('msg-' + scrollMessageId);
        if (el) el.scrollIntoView({ block: 'center' });
      }
      startPolling();
    } catch (e) {
      showThreadSkeleton(false);
      threadTitle.textContent = 'Chat';
      threadMeta.textContent = '—';
      if (window.showNotification) window.showNotification('Kon conversatie niet laden: ' + e.message, 'error');
    }
  }

  async function loadMessages(append) {
    if (!currentConversationId) return;
    const url = '/admin/api/messages/conversations/' + currentConversationId + '/messages' + (nextCursor ? '?cursor=' + encodeURIComponent(nextCursor) : '');
    const data = await api(url);
    const list = data.messages || [];
    nextCursor = data.nextCursor || null;
    if (append) messages = list.concat(messages);
    else messages = list;
    renderMessages(append);
    if (loadMoreWrap) loadMoreWrap.style.display = nextCursor ? 'block' : 'none';
    if (loadMoreBtn) loadMoreBtn.onclick = () => loadMessages(true);
  }

  function renderMessages(append) {
    if (!messagesInner) return;
    let html = '';
    let lastDate = '';
    const me = currentUserId();
    for (const m of messages) {
      const d = m.created_at ? m.created_at.slice(0, 10) : '';
      if (d !== lastDate) {
        lastDate = d;
        html += '<div class="messages-date-sep">' + escapeHtml(formatDateSep(m.created_at)) + '</div>';
      }
      if (m.message_type === 'system') {
        html += '<div class="messages-msg-system"><div class="messages-msg-system-inner">⚙ ' + escapeHtml(m.body) + '</div></div>';
        continue;
      }
      const own = m.sender_id === me;
      const name = participantDisplayName(m.sender);
      const bubble = escapeHtml(m.body).replace(/\n/g, '<br>');
      html += `<div class="messages-msg-wrap ${own ? 'own' : ''}" id="msg-${m.id}">
        <div class="messages-msg-avatar">${m.sender ? avatarHtml(m.sender) : '<div class="messages-conv-avatar">?</div>'}</div>
        <div class="messages-msg-body">
          <div class="messages-msg-name">${escapeHtml(name)}</div>
          <div class="messages-msg-bubble">${bubble}</div>
          <div class="messages-msg-time">${formatTime(m.created_at)}</div>
        </div>
      </div>`;
    }
    if (append) messagesInner.insertAdjacentHTML('afterbegin', html);
    else messagesInner.innerHTML = html;
    if (!append) {
      const list = messagesInner.parentElement;
      if (list) list.scrollTop = list.scrollHeight;
    }
  }

  async function sendMessage() {
    const body = (composerInput && composerInput.value || '').trim();
    if (!body || !currentConversationId) return;
    composerInput.value = '';
    try {
      const data = await api('/admin/api/messages/conversations/' + currentConversationId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body })
      });
      messages.push(data.message);
      renderMessages();
      const list = messagesInner && messagesInner.parentElement;
      if (list) list.scrollTop = list.scrollHeight;
      loadConversations();
    } catch (e) {
      if (window.showNotification) window.showNotification('Kan bericht niet verzenden: ' + e.message, 'error');
      else console.error(e);
    }
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      if (!currentConversationId) return;
      const list = messagesInner && messagesInner.parentElement;
      const wasAtBottom = list ? list.scrollHeight - list.scrollTop - list.clientHeight < 80 : true;
      const data = await api('/admin/api/messages/conversations/' + currentConversationId + '/messages');
      const newList = data.messages || [];
      const prevIds = new Set(messages.map((m) => m.id));
      const added = newList.filter((m) => !prevIds.has(m.id));
      if (added.length > 0) {
        messages = newList;
        renderMessages();
        if (wasAtBottom) {
          if (list) list.scrollTop = list.scrollHeight;
        } else {
          newMessagesCount += added.length;
          if (newPill) {
            newPill.textContent = newMessagesCount + ' nieuwe bericht(en)';
            newPill.style.display = 'block';
            newPill.onclick = () => {
              if (list) list.scrollTop = list.scrollHeight;
              newMessagesCount = 0;
              newPill.style.display = 'none';
            };
          }
        }
        loadConversations();
      }
    }, 5000);
  }

  if (searchInput) {
    let searchDebounce;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(loadConversations, 300);
    });
  }
  tabs.forEach((t) => {
    t.addEventListener('click', () => {
      tabs.forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      currentTab = t.getAttribute('data-tab') || 'all';
      loadConversations();
    });
  });

  if (composerInput && composerSend) {
    composerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    composerSend.addEventListener('click', sendMessage);
  }

  if (backBtn) backBtn.addEventListener('click', () => { mainPlaceholder.style.display = 'flex'; threadWrap.style.display = 'none'; currentConversationId = null; if (pollInterval) clearInterval(pollInterval); loadConversations(); });
  if (infoPanelBtn && rightPanel) infoPanelBtn.addEventListener('click', () => rightPanel.classList.toggle('collapsed'));
  if (rightPanelClose) rightPanelClose.addEventListener('click', () => rightPanel.classList.add('collapsed'));

  function openNewModal() {
    newModal.hidden = false;
    newSearchInput.value = '';
    newResults.innerHTML = '<p class="messages-modal-hint">Typ om collega\'s te zoeken.</p>';
    newSearchInput.focus();
  }
  function closeNewModal() {
    newModal.hidden = true;
  }
  if (btnNew) btnNew.addEventListener('click', openNewModal);
  if (newModalBackdrop) newModalBackdrop.addEventListener('click', closeNewModal);
  if (newModalClose) newModalClose.addEventListener('click', closeNewModal);

  let newSearchDebounce;
  if (newSearchInput) {
    newSearchInput.addEventListener('input', () => {
      clearTimeout(newSearchDebounce);
      const q = newSearchInput.value.trim();
      if (q.length < 2) {
        newResults.innerHTML = '<p class="messages-modal-hint">Typ minstens 2 tekens.</p>';
        return;
      }
      newSearchDebounce = setTimeout(async () => {
        try {
          const data = await api('/admin/api/messages/users?search=' + encodeURIComponent(q));
          const users = data.users || [];
          if (users.length === 0) {
            newResults.innerHTML = '<p class="messages-modal-hint">Geen resultaten.</p>';
            return;
          }
          newResults.innerHTML = users.map((u) => {
            const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '—';
            return `<button type="button" class="messages-user-item" data-user-id="${escapeHtml(u.id)}">
              ${avatarHtml(u)}
              <div>
                <div class="messages-user-item-name">${escapeHtml(name)}</div>
                ${u.role_name ? '<div class="messages-user-item-role">' + escapeHtml(u.role_name) + '</div>' : ''}
              </div>
            </button>`;
          }).join('');
          newResults.querySelectorAll('.messages-user-item').forEach((el) => {
            el.addEventListener('click', async () => {
              const userId = el.getAttribute('data-user-id');
              try {
                const data = await api('/admin/api/messages/dm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ other_user_id: userId }) });
                closeNewModal();
                openConversation(data.conversation.id);
              } catch (e) {
                if (window.showNotification) window.showNotification('Kon chat niet starten: ' + e.message, 'error');
              }
            });
          });
        } catch (_) {
          newResults.innerHTML = '<p class="messages-modal-hint">Fout bij zoeken.</p>';
        }
      }, 250);
    });
  }

  loadConversations().then(() => {
    if (openId) openConversation(openId);
  });
})();
