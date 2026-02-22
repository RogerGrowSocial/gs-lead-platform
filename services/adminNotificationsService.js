/**
 * Admin bell notifications: list, mark read.
 * Table: admin_notifications (message, mention, system).
 */
const { supabaseAdmin } = require('../config/supabase');

const DEFAULT_LIMIT = 20;

/**
 * Get notifications for user with optional type filter.
 * @param {string} userId
 * @param {{ limit?: number, type?: 'message'|'mention'|'system' }} opts
 */
async function getNotifications(userId, opts = {}) {
  const limit = Math.min(Number(opts.limit) || DEFAULT_LIMIT, 50);
  let q = supabaseAdmin
    .from('admin_notifications')
    .select('id, user_id, type, title, body, url, metadata, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (opts.type) q = q.eq('type', opts.type);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * Get unread count for user.
 */
async function getUnreadCount(userId) {
  const { count, error } = await supabaseAdmin
    .from('admin_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Mark one notification as read.
 */
async function markRead(notificationId, userId) {
  const { error } = await supabaseAdmin
    .from('admin_notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Mark all notifications as read for user.
 */
async function markAllRead(userId) {
  const { error } = await supabaseAdmin
    .from('admin_notifications')
    .update({ is_read: true })
    .eq('user_id', userId);
  if (error) throw error;
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
};
