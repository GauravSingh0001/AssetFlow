import { Router } from 'express';
import { getDb, logActivity, createNotification } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { headUp } from '../middleware/rbac.js';

const router = Router();
router.use(authenticate);

// GET /api/transfers
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.query;
    let query = `
      SELECT t.*, a.tag as assetTag, a.name as assetName,
        fe.name as fromEmployeeName, te.name as toEmployeeName,
        ap.name as approvedByName
      FROM transfer_requests t
      LEFT JOIN assets a ON t.assetId = a.id
      LEFT JOIN employees fe ON t.fromEmployeeId = fe.id
      LEFT JOIN employees te ON t.toEmployeeId = te.id
      LEFT JOIN employees ap ON t.approvedBy = ap.id
      WHERE 1=1
    `;
    const params = [];
    if (status) { query += ` AND t.status = ?`; params.push(status); }
    query += ` ORDER BY t.requestedAt DESC`;
    
    const transfers = db.prepare(query).all(...params);
    res.json({ transfers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

// POST /api/transfers — Create transfer request
router.post('/', (req, res) => {
  try {
    const { assetId, toEmployeeId } = req.body;
    if (!assetId || !toEmployeeId) return res.status(400).json({ error: 'Asset and target employee are required' });

    const db = getDb();
    
    // Find current holder
    const allocation = db.prepare(`SELECT * FROM allocations WHERE assetId = ? AND status IN ('Active', 'Overdue')`).get(assetId);
    if (!allocation) return res.status(400).json({ error: 'Asset is not currently allocated' });

    const fromEmployeeId = allocation.employeeId;
    if (fromEmployeeId === toEmployeeId) return res.status(400).json({ error: 'Cannot transfer to the same person' });

    const result = db.prepare(`
      INSERT INTO transfer_requests (assetId, fromEmployeeId, toEmployeeId, status) VALUES (?, ?, ?, 'Pending')
    `).run(assetId, fromEmployeeId, toEmployeeId);

    const asset = db.prepare('SELECT tag, name FROM assets WHERE id = ?').get(assetId);
    const toEmp = db.prepare('SELECT name FROM employees WHERE id = ?').get(toEmployeeId);
    const fromEmp = db.prepare('SELECT name FROM employees WHERE id = ?').get(fromEmployeeId);

    logActivity(req.user.id, 'Transfer Requested', 'transfer', result.lastInsertRowid, {
      asset: asset.tag, from: fromEmp.name, to: toEmp.name
    });

    // Notify asset managers
    const managers = db.prepare(`SELECT id FROM employees WHERE role IN ('Admin', 'AssetManager') AND status = 'Active'`).all();
    managers.forEach(m => {
      createNotification(m.id, 'TransferRequest', 
        `Transfer request: ${asset.name} (${asset.tag}) from ${fromEmp.name} to ${toEmp.name}`,
        result.lastInsertRowid, 'transfer');
    });

    const transfer = db.prepare(`
      SELECT t.*, a.tag as assetTag, a.name as assetName, fe.name as fromEmployeeName, te.name as toEmployeeName
      FROM transfer_requests t LEFT JOIN assets a ON t.assetId = a.id LEFT JOIN employees fe ON t.fromEmployeeId = fe.id LEFT JOIN employees te ON t.toEmployeeId = te.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json({ transfer });
  } catch (err) {
    console.error('Transfer request error:', err);
    res.status(500).json({ error: 'Failed to create transfer request' });
  }
});

// PUT /api/transfers/:id/approve
router.put('/:id/approve', headUp, (req, res) => {
  try {
    const db = getDb();
    const transfer = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(req.params.id);
    if (!transfer) return res.status(404).json({ error: 'Transfer request not found' });
    if (transfer.status !== 'Pending') return res.status(400).json({ error: 'Transfer is not pending' });

    // Update transfer
    db.prepare(`UPDATE transfer_requests SET status = 'Approved', approvedBy = ? WHERE id = ?`).run(req.user.id, req.params.id);

    // Close old allocation
    db.prepare(`UPDATE allocations SET status = 'Returned', actualReturnDate = datetime('now'), returnConditionNotes = 'Transferred' WHERE assetId = ? AND status IN ('Active', 'Overdue')`).run(transfer.assetId);

    // Create new allocation
    const toEmp = db.prepare('SELECT * FROM employees WHERE id = ?').get(transfer.toEmployeeId);
    db.prepare(`INSERT INTO allocations (assetId, employeeId, departmentId, status) VALUES (?, ?, ?, 'Active')`).run(transfer.assetId, transfer.toEmployeeId, toEmp.departmentId);

    const asset = db.prepare('SELECT tag, name FROM assets WHERE id = ?').get(transfer.assetId);
    logActivity(req.user.id, 'Transfer Approved', 'transfer', parseInt(req.params.id), { asset: asset.tag });

    createNotification(transfer.toEmployeeId, 'AssetAssigned', `${asset.name} (${asset.tag}) has been transferred to you`, transfer.assetId, 'asset');
    createNotification(transfer.fromEmployeeId, 'TransferApproved', `Transfer of ${asset.name} (${asset.tag}) has been approved`, transfer.assetId, 'asset');

    res.json({ message: 'Transfer approved and allocation updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve transfer' });
  }
});

// PUT /api/transfers/:id/reject
router.put('/:id/reject', headUp, (req, res) => {
  try {
    const db = getDb();
    db.prepare(`UPDATE transfer_requests SET status = 'Rejected', approvedBy = ? WHERE id = ?`).run(req.user.id, req.params.id);
    
    const transfer = db.prepare('SELECT * FROM transfer_requests WHERE id = ?').get(req.params.id);
    const asset = db.prepare('SELECT tag, name FROM assets WHERE id = ?').get(transfer.assetId);
    
    logActivity(req.user.id, 'Transfer Rejected', 'transfer', parseInt(req.params.id), { asset: asset.tag });
    createNotification(transfer.fromEmployeeId, 'TransferRejected', `Transfer request for ${asset.name} (${asset.tag}) was rejected`, transfer.assetId, 'transfer');

    res.json({ message: 'Transfer rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject transfer' });
  }
});

export default router;
