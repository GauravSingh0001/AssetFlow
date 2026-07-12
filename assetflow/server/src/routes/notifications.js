import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/notifications
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { unreadOnly } = req.query;
    let query = `SELECT * FROM notifications WHERE recipientId = ?`;
    const params = [req.user.id];
    if (unreadOnly === 'true') { query += ` AND read = 0`; }
    query += ` ORDER BY createdAt DESC LIMIT 50`;

    const notifications = db.prepare(query).all(...params);
    const unreadCount = db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE recipientId = ? AND read = 0`).get(req.user.id).c;

    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND recipientId = ?`).run(req.params.id, req.user.id);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`UPDATE notifications SET read = 1 WHERE recipientId = ?`).run(req.user.id);
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notifications' });
  }
});

export default router;
