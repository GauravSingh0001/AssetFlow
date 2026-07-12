import { Router } from 'express';
import { getDb, logActivity, createNotification } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { adminOnly } from '../middleware/rbac.js';

const router = Router();
router.use(authenticate);

// GET /api/audits
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.query;
    let query = `
      SELECT ac.*, d.name as departmentName,
        (SELECT COUNT(*) FROM audit_items WHERE cycleId = ac.id) as totalItems,
        (SELECT COUNT(*) FROM audit_items WHERE cycleId = ac.id AND result IS NOT NULL) as completedItems,
        (SELECT COUNT(*) FROM audit_items WHERE cycleId = ac.id AND result != 'Verified') as discrepancies
      FROM audit_cycles ac
      LEFT JOIN departments d ON ac.departmentId = d.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ` AND ac.status = ?`; params.push(status); }
    query += ` ORDER BY ac.createdAt DESC`;

    const cycles = db.prepare(query).all(...params);
    
    // Attach auditors
    cycles.forEach(c => {
      c.auditors = db.prepare(`
        SELECT e.id, e.name, e.email FROM audit_cycle_auditors aca
        LEFT JOIN employees e ON aca.employeeId = e.id WHERE aca.cycleId = ?
      `).all(c.id);
    });
    
    res.json({ cycles });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit cycles' });
  }
});

// GET /api/audits/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const cycle = db.prepare(`
      SELECT ac.*, d.name as departmentName FROM audit_cycles ac 
      LEFT JOIN departments d ON ac.departmentId = d.id WHERE ac.id = ?
    `).get(req.params.id);
    if (!cycle) return res.status(404).json({ error: 'Audit cycle not found' });

    cycle.auditors = db.prepare(`
      SELECT e.id, e.name, e.email FROM audit_cycle_auditors aca
      LEFT JOIN employees e ON aca.employeeId = e.id WHERE aca.cycleId = ?
    `).all(cycle.id);

    const items = db.prepare(`
      SELECT ai.*, a.tag as assetTag, a.name as assetName, a.location, a.status as currentStatus,
        e.name as auditorName
      FROM audit_items ai
      LEFT JOIN assets a ON ai.assetId = a.id
      LEFT JOIN employees e ON ai.auditorId = e.id
      WHERE ai.cycleId = ?
      ORDER BY a.tag
    `).all(req.params.id);

    res.json({ cycle, items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit cycle' });
  }
});

// POST /api/audits — Create audit cycle
router.post('/', adminOnly, (req, res) => {
  try {
    const { name, departmentId, location, startDate, endDate, auditorIds } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Name, start date, and end date are required' });
    }

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO audit_cycles (name, departmentId, location, startDate, endDate, status)
      VALUES (?, ?, ?, ?, ?, 'Open')
    `).run(name, departmentId || null, location || null, startDate, endDate);

    const cycleId = result.lastInsertRowid;

    // Assign auditors
    if (auditorIds?.length) {
      const insertAuditor = db.prepare(`INSERT INTO audit_cycle_auditors (cycleId, employeeId) VALUES (?, ?)`);
      auditorIds.forEach(id => insertAuditor.run(cycleId, id));
    }

    // Generate audit items based on scope
    let assetQuery = `SELECT id FROM assets WHERE status NOT IN ('Retired', 'Disposed')`;
    const assetParams = [];
    if (departmentId) {
      assetQuery += ` AND id IN (SELECT assetId FROM allocations WHERE departmentId = ? AND status = 'Active')`;
      assetParams.push(departmentId);
    }
    if (location) {
      assetQuery += ` AND location LIKE ?`;
      assetParams.push(`%${location}%`);
    }

    // If no scope filter, include all non-retired assets
    const assets = db.prepare(assetQuery).all(...assetParams);
    const insertItem = db.prepare(`INSERT INTO audit_items (cycleId, assetId) VALUES (?, ?)`);
    assets.forEach(a => insertItem.run(cycleId, a.id));

    logActivity(req.user.id, 'Audit Cycle Created', 'audit', cycleId, { name, itemCount: assets.length });

    // Notify auditors
    if (auditorIds?.length) {
      auditorIds.forEach(id => {
        createNotification(id, 'AuditAssigned', `You have been assigned as auditor for: ${name}`, cycleId, 'audit');
      });
    }

    const cycle = db.prepare('SELECT * FROM audit_cycles WHERE id = ?').get(cycleId);
    res.status(201).json({ cycle, itemCount: assets.length });
  } catch (err) {
    console.error('Create audit error:', err);
    res.status(500).json({ error: 'Failed to create audit cycle' });
  }
});

// PUT /api/audits/:cycleId/items/:itemId — Mark audit item
router.put('/:cycleId/items/:itemId', (req, res) => {
  try {
    const { result, notes } = req.body;
    if (!result || !['Verified', 'Missing', 'Damaged'].includes(result)) {
      return res.status(400).json({ error: 'Valid result (Verified/Missing/Damaged) is required' });
    }

    const db = getDb();
    const cycle = db.prepare('SELECT * FROM audit_cycles WHERE id = ?').get(req.params.cycleId);
    if (!cycle) return res.status(404).json({ error: 'Audit cycle not found' });
    if (cycle.status === 'Closed') return res.status(400).json({ error: 'Audit cycle is closed' });

    db.prepare(`
      UPDATE audit_items SET result = ?, notes = ?, auditorId = ?, updatedAt = datetime('now') WHERE id = ? AND cycleId = ?
    `).run(result, notes || null, req.user.id, req.params.itemId, req.params.cycleId);

    logActivity(req.user.id, 'Audit Item Updated', 'audit', parseInt(req.params.itemId), { result, cycleId: req.params.cycleId });

    res.json({ message: 'Audit item updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update audit item' });
  }
});

// PUT /api/audits/:id/close — Close audit cycle
router.put('/:id/close', adminOnly, (req, res) => {
  try {
    const db = getDb();
    const cycle = db.prepare('SELECT * FROM audit_cycles WHERE id = ?').get(req.params.id);
    if (!cycle) return res.status(404).json({ error: 'Audit cycle not found' });
    if (cycle.status === 'Closed') return res.status(400).json({ error: 'Already closed' });

    // Update missing items → Lost
    const missingItems = db.prepare(`
      SELECT ai.assetId FROM audit_items ai WHERE ai.cycleId = ? AND ai.result = 'Missing'
    `).all(req.params.id);

    missingItems.forEach(item => {
      db.prepare(`UPDATE assets SET status = 'Lost', updatedAt = datetime('now') WHERE id = ?`).run(item.assetId);
    });

    db.prepare(`UPDATE audit_cycles SET status = 'Closed' WHERE id = ?`).run(req.params.id);

    logActivity(req.user.id, 'Audit Cycle Closed', 'audit', parseInt(req.params.id), { missingCount: missingItems.length });

    // Generate discrepancy notifications
    const discrepancies = db.prepare(`
      SELECT COUNT(*) as c FROM audit_items WHERE cycleId = ? AND result != 'Verified'
    `).get(req.params.id);

    if (discrepancies.c > 0) {
      const admins = db.prepare(`SELECT id FROM employees WHERE role = 'Admin' AND status = 'Active'`).all();
      admins.forEach(a => {
        createNotification(a.id, 'AuditDiscrepancy', `${discrepancies.c} discrepancies found in audit: ${cycle.name}`, parseInt(req.params.id), 'audit');
      });
    }

    res.json({ message: `Audit cycle closed. ${missingItems.length} assets marked as Lost.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to close audit cycle' });
  }
});

// GET /api/audits/:id/discrepancies
router.get('/:id/discrepancies', (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare(`
      SELECT ai.*, a.tag as assetTag, a.name as assetName, a.location, e.name as auditorName
      FROM audit_items ai
      LEFT JOIN assets a ON ai.assetId = a.id
      LEFT JOIN employees e ON ai.auditorId = e.id
      WHERE ai.cycleId = ? AND ai.result IS NOT NULL AND ai.result != 'Verified'
      ORDER BY ai.result, a.tag
    `).all(req.params.id);
    res.json({ discrepancies: items });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch discrepancies' });
  }
});

export default router;
