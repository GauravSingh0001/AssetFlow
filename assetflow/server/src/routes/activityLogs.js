import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { managerUp } from '../middleware/rbac.js';

const router = Router();
router.use(authenticate);
router.use(managerUp);

// GET /api/activity-logs
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { userId, action, startDate, endDate, limit } = req.query;
    let query = `
      SELECT al.*, e.name as userName, e.email as userEmail
      FROM activity_logs al
      LEFT JOIN employees e ON al.userId = e.id
      WHERE 1=1
    `;
    const params = [];
    if (userId) { query += ` AND al.userId = ?`; params.push(userId); }
    if (action) { query += ` AND al.action LIKE ?`; params.push(`%${action}%`); }
    if (startDate) { query += ` AND al.timestamp >= ?`; params.push(startDate); }
    if (endDate) { query += ` AND al.timestamp <= ?`; params.push(endDate); }
    query += ` ORDER BY al.timestamp DESC LIMIT ?`;
    params.push(parseInt(limit) || 100);

    const logs = db.prepare(query).all(...params);
    logs.forEach(l => { l.details = JSON.parse(l.details || '{}'); });
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

export default router;
