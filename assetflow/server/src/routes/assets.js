import { Router } from 'express';
import { getDb, logActivity, createNotification, generateAssetTag } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { managerUp } from '../middleware/rbac.js';

const router = Router();
router.use(authenticate);

// GET /api/assets
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { search, category, status, department, location, shared } = req.query;

    let query = `
      SELECT a.*, c.name as categoryName,
        al.employeeId as allocatedToId, e.name as allocatedToName, al.expectedReturnDate
      FROM assets a
      LEFT JOIN asset_categories c ON a.categoryId = c.id
      LEFT JOIN allocations al ON a.id = al.assetId AND al.status = 'Active'
      LEFT JOIN employees e ON al.employeeId = e.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (a.tag LIKE ? OR a.name LIKE ? OR a.serialNumber LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) { query += ` AND a.categoryId = ?`; params.push(category); }
    if (status) { query += ` AND a.status = ?`; params.push(status); }
    if (location) { query += ` AND a.location LIKE ?`; params.push(`%${location}%`); }
    if (shared !== undefined) { query += ` AND a.isShared = ?`; params.push(shared === 'true' ? 1 : 0); }

    query += ` ORDER BY a.id DESC`;
    const assets = db.prepare(query).all(...params);
    res.json({ assets });
  } catch (err) {
    console.error('Get assets error:', err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// GET /api/assets/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const asset = db.prepare(`
      SELECT a.*, c.name as categoryName
      FROM assets a LEFT JOIN asset_categories c ON a.categoryId = c.id
      WHERE a.id = ?
    `).get(req.params.id);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });

    // Get allocation history
    const allocations = db.prepare(`
      SELECT al.*, e.name as employeeName, d.name as departmentName
      FROM allocations al
      LEFT JOIN employees e ON al.employeeId = e.id
      LEFT JOIN departments d ON al.departmentId = d.id
      WHERE al.assetId = ?
      ORDER BY al.allocatedAt DESC
    `).all(req.params.id);

    // Get maintenance history
    const maintenanceHistory = db.prepare(`
      SELECT m.*, e.name as reportedByName, a2.name as approvedByName
      FROM maintenance_requests m
      LEFT JOIN employees e ON m.reportedById = e.id
      LEFT JOIN employees a2 ON m.approvedById = a2.id
      WHERE m.assetId = ?
      ORDER BY m.createdAt DESC
    `).all(req.params.id);

    res.json({ asset, allocations, maintenanceHistory });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// POST /api/assets
router.post('/', managerUp, (req, res) => {
  try {
    const { name, categoryId, serialNumber, acquisitionDate, acquisitionCost, condition, location, isShared } = req.body;
    if (!name || !categoryId) return res.status(400).json({ error: 'Name and category are required' });

    const db = getDb();
    const tag = generateAssetTag();

    const result = db.prepare(`
      INSERT INTO assets (tag, name, categoryId, serialNumber, acquisitionDate, acquisitionCost, condition, location, isShared, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available')
    `).run(tag, name, categoryId, serialNumber || null, acquisitionDate || null, acquisitionCost || 0, condition || 'New', location || null, isShared ? 1 : 0);

    logActivity(req.user.id, 'Asset Registered', 'asset', result.lastInsertRowid, { tag, name });
    const asset = db.prepare('SELECT a.*, c.name as categoryName FROM assets a LEFT JOIN asset_categories c ON a.categoryId = c.id WHERE a.id = ?').get(result.lastInsertRowid);
    res.status(201).json({ asset });
  } catch (err) {
    console.error('Create asset error:', err);
    res.status(500).json({ error: 'Failed to register asset' });
  }
});

// PUT /api/assets/:id
router.put('/:id', managerUp, (req, res) => {
  try {
    const { name, categoryId, serialNumber, acquisitionDate, acquisitionCost, condition, location, isShared, status } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Asset not found' });

    // Status change validation
    if (status && ['Retired', 'Disposed'].includes(status) && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admin can retire or dispose assets' });
    }

    db.prepare(`
      UPDATE assets SET 
        name = COALESCE(?, name), categoryId = COALESCE(?, categoryId),
        serialNumber = COALESCE(?, serialNumber), acquisitionDate = COALESCE(?, acquisitionDate),
        acquisitionCost = COALESCE(?, acquisitionCost), condition = COALESCE(?, condition),
        location = COALESCE(?, location), isShared = COALESCE(?, isShared),
        status = COALESCE(?, status), updatedAt = datetime('now')
      WHERE id = ?
    `).run(name, categoryId, serialNumber, acquisitionDate, acquisitionCost, condition, location, isShared !== undefined ? (isShared ? 1 : 0) : null, status, req.params.id);

    logActivity(req.user.id, 'Asset Updated', 'asset', parseInt(req.params.id), { status, name: name || existing.name });

    const asset = db.prepare('SELECT a.*, c.name as categoryName FROM assets a LEFT JOIN asset_categories c ON a.categoryId = c.id WHERE a.id = ?').get(req.params.id);
    res.json({ asset });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// GET /api/assets/stats/summary
router.get('/stats/summary', (req, res) => {
  try {
    const db = getDb();
    const stats = {
      total: db.prepare('SELECT COUNT(*) as c FROM assets').get().c,
      available: db.prepare(`SELECT COUNT(*) as c FROM assets WHERE status = 'Available'`).get().c,
      allocated: db.prepare(`SELECT COUNT(*) as c FROM assets WHERE status = 'Allocated'`).get().c,
      underMaintenance: db.prepare(`SELECT COUNT(*) as c FROM assets WHERE status = 'Under Maintenance'`).get().c,
      retired: db.prepare(`SELECT COUNT(*) as c FROM assets WHERE status = 'Retired'`).get().c,
      lost: db.prepare(`SELECT COUNT(*) as c FROM assets WHERE status = 'Lost'`).get().c,
    };
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
