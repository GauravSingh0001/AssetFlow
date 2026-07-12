import { Router } from 'express';
import { getDb, logActivity, createNotification } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { managerUp } from '../middleware/rbac.js';

const router = Router();
router.use(authenticate);

// GET /api/allocations
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, assetId, employeeId } = req.query;
    let query = `
      SELECT al.*, a.tag as assetTag, a.name as assetName, 
        e.name as employeeName, d.name as departmentName
      FROM allocations al
      LEFT JOIN assets a ON al.assetId = a.id
      LEFT JOIN employees e ON al.employeeId = e.id
      LEFT JOIN departments d ON al.departmentId = d.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ` AND al.status = ?`; params.push(status); }
    if (assetId) { query += ` AND al.assetId = ?`; params.push(assetId); }
    if (employeeId) { query += ` AND al.employeeId = ?`; params.push(employeeId); }
    query += ` ORDER BY al.allocatedAt DESC`;
    
    const allocations = db.prepare(query).all(...params);
    
    // Check for overdue
    const now = new Date().toISOString();
    allocations.forEach(al => {
      if (al.status === 'Active' && al.expectedReturnDate && al.expectedReturnDate < now) {
        al.isOverdue = true;
      }
    });
    
    res.json({ allocations });
  } catch (err) {
    console.error('Get allocations error:', err);
    res.status(500).json({ error: 'Failed to fetch allocations' });
  }
});

// POST /api/allocations — Allocate asset
router.post('/', managerUp, (req, res) => {
  try {
    const { assetId, employeeId, departmentId, expectedReturnDate } = req.body;
    if (!assetId || !employeeId) return res.status(400).json({ error: 'Asset and employee are required' });

    const db = getDb();
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    // Conflict check
    const activeAllocation = db.prepare(`SELECT al.*, e.name as employeeName FROM allocations al LEFT JOIN employees e ON al.employeeId = e.id WHERE al.assetId = ? AND al.status = 'Active'`).get(assetId);
    if (activeAllocation) {
      return res.status(409).json({
        error: `Asset is currently held by ${activeAllocation.employeeName}`,
        currentHolder: activeAllocation,
        suggestTransfer: true
      });
    }

    if (!['Available', 'Reserved'].includes(asset.status)) {
      return res.status(400).json({ error: `Asset cannot be allocated. Current status: ${asset.status}` });
    }

    const result = db.prepare(`
      INSERT INTO allocations (assetId, employeeId, departmentId, expectedReturnDate, status)
      VALUES (?, ?, ?, ?, 'Active')
    `).run(assetId, employeeId, departmentId || null, expectedReturnDate || null);

    db.prepare(`UPDATE assets SET status = 'Allocated', updatedAt = datetime('now') WHERE id = ?`).run(assetId);

    logActivity(req.user.id, 'Asset Allocated', 'asset', assetId, { to: employeeId, tag: asset.tag });
    
    const emp = db.prepare('SELECT name FROM employees WHERE id = ?').get(employeeId);
    createNotification(employeeId, 'AssetAssigned', `${asset.name} (${asset.tag}) has been assigned to you`, assetId, 'asset');

    const allocation = db.prepare(`
      SELECT al.*, a.tag as assetTag, a.name as assetName, e.name as employeeName
      FROM allocations al LEFT JOIN assets a ON al.assetId = a.id LEFT JOIN employees e ON al.employeeId = e.id
      WHERE al.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json({ allocation });
  } catch (err) {
    console.error('Allocate error:', err);
    res.status(500).json({ error: 'Failed to allocate asset' });
  }
});

// PUT /api/allocations/:id/return — Return asset
router.put('/:id/return', (req, res) => {
  try {
    const { returnConditionNotes } = req.body;
    const db = getDb();
    
    const allocation = db.prepare('SELECT * FROM allocations WHERE id = ?').get(req.params.id);
    if (!allocation) return res.status(404).json({ error: 'Allocation not found' });
    if (allocation.status !== 'Active' && allocation.status !== 'Overdue') {
      return res.status(400).json({ error: 'Allocation is not active' });
    }

    db.prepare(`
      UPDATE allocations SET status = 'Returned', actualReturnDate = datetime('now'), returnConditionNotes = ? WHERE id = ?
    `).run(returnConditionNotes || null, req.params.id);

    db.prepare(`UPDATE assets SET status = 'Available', updatedAt = datetime('now') WHERE id = ?`).run(allocation.assetId);

    const asset = db.prepare('SELECT tag, name FROM assets WHERE id = ?').get(allocation.assetId);
    logActivity(req.user.id, 'Asset Returned', 'asset', allocation.assetId, { tag: asset.tag, condition: returnConditionNotes });

    res.json({ message: 'Asset returned successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to return asset' });
  }
});

// GET /api/allocations/overdue
router.get('/overdue', (req, res) => {
  try {
    const db = getDb();
    const overdue = db.prepare(`
      SELECT al.*, a.tag as assetTag, a.name as assetName, e.name as employeeName, d.name as departmentName
      FROM allocations al
      LEFT JOIN assets a ON al.assetId = a.id
      LEFT JOIN employees e ON al.employeeId = e.id
      LEFT JOIN departments d ON al.departmentId = d.id
      WHERE al.status = 'Active' AND al.expectedReturnDate < datetime('now')
      ORDER BY al.expectedReturnDate ASC
    `).all();
    
    // Also update status to Overdue
    overdue.forEach(al => {
      db.prepare(`UPDATE allocations SET status = 'Overdue' WHERE id = ? AND status = 'Active'`).run(al.id);
    });
    
    res.json({ allocations: overdue });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch overdue allocations' });
  }
});

export default router;
