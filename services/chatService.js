/**
 * Admin chat service: conversations, messages, participants.
 * Uses Supabase (service role) for DB; permission checks done in API layer.
 */
const { supabaseAdmin } = require('../config/supabase');

const MESSAGES_PAGE_SIZE = 30;

/**
 * Build dm_key for a DM between two users (sorted UUIDs).
 * Ensures one DM per pair.
 */
function buildDmKey(userId1, userId2) {
  if (!userId1 || !userId2) return null;
  const ids = [userId1, userId2].sort();
  return ids[0] + '_' + ids[1];
}

/**
 * Get conversations for a user with optional filters.
 * @param {string} userId
 * @param {{ unread?: boolean, mentions?: boolean, search?: string }} filters
 */
async function getConversationsForUser(userId, filters = {}) {
  let q = supabaseAdmin
    .from('conversation_participants')
    .select(`
      conversation_id,
      last_read_at,
      muted,
      role,
      conversations (
        id,
        type,
        title,
        created_by,
        created_at,
        last_message_at,
        metadata,
        dm_key
      )
    `)
    .eq('user_id', userId)
    .order('conversation_id', { ascending: false });

  const { data: participants, error: partError } = await q;
  if (partError) throw partError;

  const convIds = (participants || []).map((p) => p.conversation_id).filter(Boolean);
  if (convIds.length === 0) return { conversations: [], participantsByConv: {} };

  const convMap = new Map();
  const participantsByConv = {};
  for (const p of participants || []) {
    const c = Array.isArray(p.conversations) ? p.conversations[0] : p.conversations;
    if (c && typeof c === 'object') {
      convMap.set(c.id, { ...c, _last_read_at: p.last_read_at, _muted: p.muted, _role: p.role });
      participantsByConv[c.id] = participantsByConv[c.id] || [];
      participantsByConv[c.id].push({ last_read_at: p.last_read_at, muted: p.muted, role: p.role });
    }
  }

  const ids = Array.from(convMap.keys());
  let convList = ids.map((id) => {
    const row = convMap.get(id);
    const lastRead = row._last_read_at;
    const lastMsg = row.last_message_at ? new Date(row.last_message_at) : null;
    const unread = lastMsg && (!lastRead || new Date(lastRead) < lastMsg);
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      created_by: row.created_by,
      created_at: row.created_at,
      last_message_at: row.last_message_at,
      metadata: row.metadata || {},
      dm_key: row.dm_key,
      last_read_at: lastRead,
      muted: row._muted,
      role: row._role,
      unread,
    };
  });

  if (filters.unread) convList = convList.filter((c) => c.unread);
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim().toLowerCase();
    const convIdsWithSearch = new Set();
    for (const c of convList) {
      if (c.title && c.title.toLowerCase().includes(term)) convIdsWithSearch.add(c.id);
    }
    if (convIdsWithSearch.size === 0) {
      const { data: searchParticipants } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id, profiles!inner(first_name, last_name, email)')
        .in('conversation_id', ids);
      for (const sp of searchParticipants || []) {
        const profile = Array.isArray(sp.profiles) ? sp.profiles[0] : sp.profiles;
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || '';
        if (name.toLowerCase().includes(term)) convIdsWithSearch.add(sp.conversation_id);
      }
    }
    convList = convList.filter((c) => convIdsWithSearch.has(c.id));
  }

  convList.sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });

  // Last message preview per conversation
  if (convList.length > 0) {
    const { data: lastMessages } = await supabaseAdmin
      .from('messages')
      .select('conversation_id, body, created_at')
      .in('conversation_id', ids)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    const previewByConv = new Map();
    for (const m of lastMessages || []) {
      if (!previewByConv.has(m.conversation_id)) previewByConv.set(m.conversation_id, m.body ? m.body.slice(0, 80) : '');
    }
    convList.forEach((c) => {
      c.last_message_preview = previewByConv.get(c.id) || '';
    });
  }

  // DM display title: other participant name
  const dmConvs = convList.filter((c) => c.type === 'dm');
  if (dmConvs.length > 0) {
    const { data: partRows } = await supabaseAdmin
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', dmConvs.map((c) => c.id));
    const otherIds = new Set();
    const convToOther = new Map();
    for (const p of partRows || []) {
      if (p.user_id !== userId) {
        otherIds.add(p.user_id);
        convToOther.set(p.conversation_id, p.user_id);
      }
    }
    if (otherIds.size > 0) {
      const { data: profs } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', [...otherIds]);
      const nameById = new Map();
      for (const pr of profs || []) {
        const name = [pr.first_name, pr.last_name].filter(Boolean).join(' ') || pr.email || '—';
        nameById.set(pr.id, name);
      }
      convList.forEach((c) => {
        if (c.type === 'dm') {
          const otherId = convToOther.get(c.id);
          c.title = otherId ? nameById.get(otherId) || 'Chat' : c.title || 'Chat';
        }
      });
    }
  }

  return { conversations: convList, participantsByConv };
}

/**
 * Get one conversation with participants (profiles).
 */
async function getConversation(conversationId, userId) {
  const { data: conv, error: convError } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();
  if (convError || !conv) return null;

  const { data: partRows } = await supabaseAdmin
    .from('conversation_participants')
    .select('user_id, role, last_read_at, muted, created_at')
    .eq('conversation_id', conversationId);
  const isParticipant = (partRows || []).some((p) => p.user_id === userId);
  if (!isParticipant) return null;

  const userIds = (partRows || []).map((p) => p.user_id).filter(Boolean);
  let profiles = [];
  if (userIds.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, avatar_url, role_id')
      .in('id', userIds);
    profiles = profs || [];
  }

  const participants = (partRows || []).map((p) => {
    const profile = profiles.find((pr) => pr.id === p.user_id);
    return {
      user_id: p.user_id,
      role: p.role,
      last_read_at: p.last_read_at,
      muted: p.muted,
      created_at: p.created_at,
      first_name: profile?.first_name,
      last_name: profile?.last_name,
      email: profile?.email,
      avatar_url: profile?.avatar_url,
    };
  });

  return { ...conv, participants };
}

/**
 * Get messages for a conversation (cursor-based, older first for page N, then reverse for display).
 */
async function getMessages(conversationId, userId, cursor = null, limit = MESSAGES_PAGE_SIZE) {
  const { data: part } = await supabaseAdmin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!part) return { messages: [], nextCursor: null };

  let q = supabaseAdmin
    .from('messages')
    .select('id, conversation_id, sender_id, message_type, body, body_rich, metadata, created_at, edited_at, deleted_at')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    const { data: curRow } = await supabaseAdmin.from('messages').select('created_at').eq('id', cursor).single();
    if (curRow) q = q.lt('created_at', curRow.created_at);
  }

  const { data: rows, error } = await q;
  if (error) throw error;

  const hasMore = (rows || []).length > limit;
  const list = (hasMore ? rows.slice(0, limit) : rows || []);
  const nextCursor = hasMore && list.length ? list[list.length - 1].id : null;

  const senderIds = [...new Set(list.map((m) => m.sender_id).filter(Boolean))];
  let senders = {};
  if (senderIds.length > 0) {
    const { data: profs } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email, avatar_url')
      .in('id', senderIds);
    for (const p of profs || []) senders[p.id] = p;
  }

  const messages = list.map((m) => ({
    ...m,
    sender: m.sender_id ? senders[m.sender_id] : null,
  })).reverse();

  return { messages, nextCursor };
}

/**
 * Send a user message and optionally link mentions.
 * Returns the inserted message.
 */
async function sendMessage(conversationId, body, senderId, mentionUserIds = []) {
  const { data: part } = await supabaseAdmin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', senderId)
    .maybeSingle();
  if (!part) throw new Error('Not a participant');

  const { data: message, error: msgError } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message_type: 'user',
      body: (body || '').trim().slice(0, 10000),
    })
    .select()
    .single();
  if (msgError) throw msgError;

  const mentionIds = Array.isArray(mentionUserIds) ? mentionUserIds.filter((id) => id && id !== senderId) : [];
  if (mentionIds.length > 0) {
    await supabaseAdmin.from('message_mentions').insert(
      mentionIds.map((uid) => ({ message_id: message.id, mentioned_user_id: uid }))
    );
  }

  return message;
}

/**
 * Get or create a DM between two users. Returns conversation.
 */
async function getOrCreateDM(userId1, userId2) {
  if (userId1 === userId2) throw new Error('Cannot create DM with yourself');
  const dmKey = buildDmKey(userId1, userId2);
  if (!dmKey) throw new Error('Invalid users');

  const { data: existing } = await supabaseAdmin
    .from('conversations')
    .select('id, type, title, created_by, created_at, last_message_at, metadata, dm_key')
    .eq('type', 'dm')
    .eq('dm_key', dmKey)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      type: 'dm',
      title: null,
      created_by: userId1,
      dm_key: dmKey,
    })
    .select()
    .single();
  if (error) throw error;

  await supabaseAdmin.from('conversation_participants').insert([
    { conversation_id: created.id, user_id: userId1, role: 'member' },
    { conversation_id: created.id, user_id: userId2, role: 'member' },
  ]);
  return created;
}

/**
 * Create a group conversation.
 */
async function createGroup(title, creatorId, participantIds) {
  const userIds = [creatorId, ...(participantIds || []).filter((id) => id && id !== creatorId)];
  const uniq = [...new Set(userIds)];
  if (uniq.length < 2) throw new Error('Group must have at least 2 participants');

  const { data: conv, error: convError } = await supabaseAdmin
    .from('conversations')
    .insert({
      type: 'group',
      title: (title || 'Groep').trim().slice(0, 255),
      created_by: creatorId,
    })
    .select()
    .single();
  if (convError) throw convError;

  const rows = uniq.map((uid) => ({
    conversation_id: conv.id,
    user_id: uid,
    role: uid === creatorId ? 'admin' : 'member',
  }));
  const { error: partError } = await supabaseAdmin.from('conversation_participants').insert(rows);
  if (partError) throw partError;
  return conv;
}

/**
 * Add participants to a group (admin/manager only in API).
 */
async function addParticipants(conversationId, userIds, actorId) {
  const { data: conv } = await supabaseAdmin.from('conversations').select('type, id').eq('id', conversationId).single();
  if (!conv || conv.type !== 'group') throw new Error('Not a group conversation');

  const { data: actor } = await supabaseAdmin
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', actorId)
    .maybeSingle();
  if (!actor || (actor.role !== 'admin' && actor.role !== 'member')) throw new Error('Not a participant');
  if (actor.role !== 'admin') throw new Error('Only group admin can add participants');

  const existing = await supabaseAdmin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId);
  const existingIds = new Set((existing.data || []).map((p) => p.user_id));
  const toAdd = (userIds || []).filter((id) => id && !existingIds.has(id));
  if (toAdd.length === 0) return;

  await supabaseAdmin.from('conversation_participants').insert(
    toAdd.map((uid) => ({ conversation_id: conversationId, user_id: uid, role: 'member' }))
  );
}

/**
 * Mark conversation as read for user.
 */
async function markConversationRead(conversationId, userId) {
  await supabaseAdmin
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
}

/**
 * Insert a system message (e.g. "Ticket toegewezen", "Deal verplaatst").
 * metadata can include: entityType, entityId, url, title, target_user_ids (array).
 */
async function sendSystemMessage(conversationId, body, metadata = {}) {
  const { data: msg, error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: null,
      message_type: 'system',
      body: (body || '').trim().slice(0, 2000),
      metadata: metadata || {},
    })
    .select()
    .single();
  if (error) throw error;
  return msg;
}

module.exports = {
  buildDmKey,
  getConversationsForUser,
  getConversation,
  getMessages,
  sendMessage,
  getOrCreateDM,
  createGroup,
  addParticipants,
  markConversationRead,
  sendSystemMessage,
  MESSAGES_PAGE_SIZE,
};
