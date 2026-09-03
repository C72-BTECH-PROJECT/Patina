import express from 'express';
import { sendNotification, getNotifications, markNotificationRead } from '../Controllers/notification.controller.js';
import { requireAuth } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

router.post('/send', requireAuth, async (req, res) => {
  const { userId, type, message, data } = req.body || {};

  if (!userId || !type || !message) {
    return res.status(400).json({ message: 'userId, type, and message are required.' });
  }

  const sent = await sendNotification(userId, type, message, data || {});
  if (!sent) {
    return res.status(500).json({ message: 'Could not send notification.' });
  }

  return res.status(200).json({ message: 'Notification sent.' });
});

router.get('/', requireAuth, async (req, res) => {
  const unreadOnly = String(req.query.unread || 'false').toLowerCase() === 'true';
  const data = await getNotifications(req.session.userId, unreadOnly);
  return res.json(data);
});

router.post('/:id/read', requireAuth, async (req, res) => {
  const updated = await markNotificationRead(req.params.id, req.session.userId);
  if (!updated) {
    return res.status(404).json({ message: 'Notification not found.' });
  }
  return res.status(200).json({ message: 'Marked as read.' });
});

export default router;
