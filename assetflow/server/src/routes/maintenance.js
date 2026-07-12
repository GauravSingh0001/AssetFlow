import { Router } from 'express';
import { getDb, logActivity, createNotification } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { managerUp } from '../middleware/rbac.js';

const router = Router();
router.use(authenticate);

// GET /api/maintenance
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status, priority, assetId } = req.query;
    let query = `
      SELECT m.*, a.tag as assetTag, a.name as assetName,
        rb.name as reportedByName, ab.name as approvedByName, t.name as technicianName
      FROM maintenance_requests m
      LEFT JOIN assets a ON m.assetId = a.id
      LEFT JOIN employees rb ON m.reportedById = rb.id
      LEFT JOIN employees ab ON m.approvedById = ab.id
      LEFT JOIN employees t ON m.technicianId = t.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ` AND m.status = ?`; params.push(status); }
    if (priority) { query += ` AND m.priority = ?`; params.push(priority); }
    if (assetId) { query += ` AND m.assetId = ?`; params.push(assetId); }
    query += ` ORDER BY m.createdAt DESC`;

    const requests = db.prepare(query).all(...params);
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch maintenance requests' });
  }
});

// POST /api/maintenance — Raise request
router.post('/', (req, res) => {
  try {
    const { assetId, description, priority } = req.body;
    if (!assetId || !description) return res.status(400).json({ error: 'Asset and description are required' });

    const db = getDb();
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    if (['Retired', 'Disposed'].includes(asset.status)) {
      return res.status(400).json({ error: 'Cannot create maintenance request for retired/disposed assets' });
    }

    const result = db.prepare(`
      INSERT INTO maintenance_requests (assetId, reportedById, description, priority, status)
      VALUES (?, ?, ?, ?, 'Pending')
    `).run(assetId, req.user.id, description, priority || 'Medium');

    logActivity(req.user.id, 'Maintenance Requested', 'maintenance', result.lastInsertRowid, { asset: asset.tag, priority });

    // Notify asset managers
    const managers = db.prepare(`SELECT id FROM employees WHERE role IN ('Admin', 'AssetManager') AND status = 'Active'`).all();
    managers.forEach(m => {
      createNotification(m.id, 'MaintenanceRequest', `New maintenance request for ${asset.name} (${asset.tag}): ${description.substring(0, 80)}`, result.lastInsertRowid, 'maintenance');
    });

    const request = db.prepare(`
      SELECT m.*, a.tag as assetTag, a.name as assetName, rb.name as reportedByName
      FROM maintenance_requests m LEFT JOIN assets a ON m.assetId = a.id LEFT JOIN employees rb ON m.reportedById = rb.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json({ request });
  } catch (err) {
    console.error('Create maintenance error:', err);
    res.status(500).json({ error: 'Failed to create maintenance request' });
  }
});

// PUT /api/maintenance/:id/approve
router.put('/:id/approve', managerUp, (req, res) => {
  try {
    const db = getDb();
    const request = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'Pending') return res.status(400).json({ error: 'Request is not pending' });

    db.prepare(`UPDATE maintenance_requests SET status = 'Approved', approvedById = ?, updatedAt = datetime('now') WHERE id = ?`).run(req.user.id, req.params.id);
    db.prepare(`UPDATE assets SET status = 'Under Maintenance', updatedAt = datetime('now') WHERE id = ?`).run(request.assetId);

    logActivity(req.user.id, 'Maintenance Approved', 'maintenance', parseInt(req.params.id), {});
    createNotification(request.reportedById, 'MaintenanceApproved', `Your maintenance request has been approved`, parseInt(req.params.id), 'maintenance');

    res.json({ message: 'Maintenance request approved, asset status set to Under Maintenance' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// PUT /api/maintenance/:id/reject
router.put('/:id/reject', managerUp, (req, res) => {
  try {
    const db = getDb();
    const request = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    db.prepare(`UPDATE maintenance_requests SET status = 'Rejected', approvedById = ?, updatedAt = datetime('now') WHERE id = ?`).run(req.user.id, req.params.id);
    logActivity(req.user.id, 'Maintenance Rejected', 'maintenance', parseInt(req.params.id), {});
    createNotification(request.reportedById, 'MaintenanceRejected', `Your maintenance request has been rejected`, parseInt(req.params.id), 'maintenance');

    res.json({ message: 'Maintenance request rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

// PUT /api/maintenance/:id/assign
router.put('/:id/assign', managerUp, (req, res) => {
  try {
    const { technicianId } = req.body;
    const db = getDb();
    db.prepare(`UPDATE maintenance_requests SET status = 'TechnicianAssigned', technicianId = ?, updatedAt = datetime('now') WHERE id = ?`).run(technicianId || null, req.params.id);
    logActivity(req.user.id, 'Technician Assigned', 'maintenance', parseInt(req.params.id), { technicianId });
    res.json({ message: 'Technician assigned' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign technician' });
  }
});

// PUT /api/maintenance/:id/start
router.put('/:id/start', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`UPDATE maintenance_requests SET status = 'InProgress', updatedAt = datetime('now') WHERE id = ?`).run(req.params.id);
    logActivity(req.user.id, 'Maintenance Started', 'maintenance', parseInt(req.params.id), {});
    res.json({ message: 'Maintenance in progress' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start maintenance' });
  }
});

// PUT /api/maintenance/:id/resolve
router.put('/:id/resolve', managerUp, (req, res) => {
  try {
    const db = getDb();
    const request = db.prepare('SELECT * FROM maintenance_requests WHERE id = ?').get(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    db.prepare(`UPDATE maintenance_requests SET status = 'Resolved', resolvedAt = datetime('now'), updatedAt = datetime('now') WHERE id = ?`).run(req.params.id);

    // Restore asset status (unless retired/disposed)
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(request.assetId);
    if (asset && !['Retired', 'Disposed'].includes(asset.status)) {
      db.prepare(`UPDATE assets SET status = 'Available', updatedAt = datetime('now') WHERE id = ?`).run(request.assetId);
    }

    logActivity(req.user.id, 'Maintenance Resolved', 'maintenance', parseInt(req.params.id), { asset: asset?.tag });
    createNotification(request.reportedById, 'MaintenanceResolved', `Maintenance for ${asset?.name} (${asset?.tag}) has been resolved`, parseInt(req.params.id), 'maintenance');

    res.json({ message: 'Maintenance resolved, asset status restored' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve maintenance' });
  }
});

export default router;
