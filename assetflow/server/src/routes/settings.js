import { Router } from 'express';
import { getDb, logActivity } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { adminOnly } from '../middleware/rbac.js';

const router = Router();

// GET /api/settings — Publicly readable so branding can be applied everywhere (even on Login screen)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM system_settings').all();
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json({ settings });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to fetch system settings' });
  }
});

// POST /api/settings — Admin-only update
router.post('/', authenticate, adminOnly, (req, res) => {
  try {
    const db = getDb();
    const updates = req.body; // e.g. { company_name: "Brand", primary_color: "#123" }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Invalid settings object' });
    }

    const stmt = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
    
    // Run in transaction
    const updateTransaction = db.transaction((data) => {
      for (const [key, val] of Object.entries(data)) {
        stmt.run(key, String(val));
      }
    });

    updateTransaction(updates);
    logActivity(req.user.id, 'Branding Settings Updated', 'settings', null, updates);

    // Fetch and return the updated object
    const rows = db.prepare('SELECT key, value FROM system_settings').all();
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });

    res.json({ message: 'Settings updated successfully', settings });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update system settings' });
  }
});

export default router;
