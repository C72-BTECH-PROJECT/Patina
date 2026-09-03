import supabase from '../Config/supabase.js';

export const sendNotification = async (userId, type, message, data = {}) => {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    message,
    data,
  });

  if (error) {
    console.error('Notification insert failed:', error.message);
    return false;
  }

  return true;
};

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

  if (error) {
    console.error('Notification fetch failed:', error.message);
    return { notifications: [], unreadCount: 0 };
  }

  const notifications = data || [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount };
};

export const markNotificationRead = async (notificationId, userId) => {
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Notification update failed:', error.message);
    return null;
  }

  return data;
};
