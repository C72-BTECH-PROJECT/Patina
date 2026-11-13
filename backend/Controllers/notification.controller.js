import supabase from '../Config/supabase.js';
import { logError } from '../Middlewares/errorHandler.js';

// R-13 (B5): a database error is an error. Reads and marks throw an Error with
// `code: 'database_error'` and the Supabase error as `cause` (logged by the caller,
// never sent to the client); they never answer an empty inbox or "not found".
const dbFailure = (context, cause) => Object.assign(new Error(`${context} failed`), { code: 'database_error', cause });

/**
 * Insert one notification. Returns true when it was stored, false when the insert
 * failed (logged). Callers report the outcome (`notified`) rather than claim it.
 */
export const sendNotification = async (userId, type, message, data = {}) => {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    message,
    data,
  });

  if (error) {
    logError(null, `[notifications] insert failed (type=${type})`, error);
    return false;
  }

  return true;
};

/** The user's notifications, newest first. Throws on a database error (B5). */
export const getNotifications = async (userId, unreadOnly = false) => {
  let query = supabase
    .from('notifications')
    .select('id, type, message, read, created_at, data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data, error } = await query;
  if (error) throw dbFailure('notification fetch', error);

  const notifications = data || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount };
};

/**
 * Mark one of the user's notifications read. Resolves to the row, or null when the
 * user has no such notification. Throws on a database error (never "not found").
 */
export const markNotificationRead = async (notificationId, userId) => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select();

  if (error) throw dbFailure('notification update', error);

  return Array.isArray(data) && data.length ? data[0] : null;
};
