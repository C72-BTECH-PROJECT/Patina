import express from 'express';
import { getNotifications, markNotificationRead } from '../Controllers/notification.controller.js';
import { requireAuth } from '../Middlewares/auth.Middleware.js';
import { sendError } from '../Middlewares/errorHandler.js';
import { isUuid } from '../Services/validation.js';

const router = express.Router();

// R-13 (B5): a database error is a 500 through the error contract, never an empty
// inbox or "not found".
router.get('/', requireAuth, async (req, res) => {
  const unreadOnly = String(req.query.unread || 'false').toLowerCase() === 'true';
  try {
    const data = await getNotifications(req.session.userId, unreadOnly);
    return res.json(data);
  } catch (err) {
    return sendError(req, res, { status: 500, error: 'database_error', message: 'Could not load notifications.', cause: err?.cause || err, context: 'notifications: list' });
  }
});

router.post('/:id/read', requireAuth, async (req, res) => {
  // Not a UUID cannot name a notification (and would be a database error, not a miss).
  if (!isUuid(req.params.id)) {
    return res.status(404).json({ error: 'not_found', message: 'Notification not found.' });
  }
  let updated;
  try {
    updated = await markNotificationRead(req.params.id, req.session.userId);
  } catch (err) {
    return sendError(req, res, { status: 500, error: 'database_error', message: 'Could not update the notification.', cause: err?.cause || err, context: 'notifications: mark read' });
  }
  if (!updated) {
    return res.status(404).json({ error: 'not_found', message: 'Notification not found.' });
  }
  return res.status(200).json({ message: 'Marked as read.' });
});

export default router;
