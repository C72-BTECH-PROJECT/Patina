import express from 'express';
import { getNotifications, markNotificationRead } from '../Controllers/notification.controller.js';
import { requireAuth } from '../Middlewares/auth.Middleware.js';

const router = express.Router();

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
