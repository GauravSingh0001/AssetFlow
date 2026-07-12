import { Router } from 'express';
import { getDb, logActivity } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { adminOnly } from '../middleware/rbac.js';

const router = Router();
router.use(authenticate);

// GET /api/employees
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { department, role, status, search } = req.query;
    
    let query = `
      SELECT e.id, e.name, e.email, e.role, e.departmentId, e.status, e.createdAt,
        d.name as departmentName
      FROM employees e
      LEFT JOIN departments d ON e.departmentId = d.id
      WHERE 1=1
    `;
    const params = [];

    if (department) { query += ` AND e.departmentId = ?`; params.push(department); }
    if (role) { query += ` AND e.role = ?`; params.push(role); }
    if (status) { query += ` AND e.status = ?`; params.push(status); }
    if (search) { query += ` AND (e.name LIKE ? OR e.email LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }

    query += ` ORDER BY e.name`;
    const employees = db.prepare(query).all(...params);
    res.json({ employees });
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// GET /api/employees/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const emp = db.prepare(`
      SELECT e.id, e.name, e.email, e.role, e.departmentId, e.status, e.createdAt,
        d.name as departmentName
      FROM employees e LEFT JOIN departments d ON e.departmentId = d.id
      WHERE e.id = ?
    `).get(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json({ employee: emp });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
});

// PUT /api/employees/:id/role — Admin only
router.put('/:id/role', adminOnly, (req, res) => {
  try {
    const { role } = req.body;
    if (!['Admin', 'AssetManager', 'DeptHead', 'Employee'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const db = getDb();
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    db.prepare(`UPDATE employees SET role = ?, updatedAt = datetime('now') WHERE id = ?`).run(role, req.params.id);
    logActivity(req.user.id, 'Role Changed', 'employee', parseInt(req.params.id), { from: emp.role, to: role, employee: emp.name });

    res.json({ message: `Role updated to ${role}`, employee: { ...emp, role, passwordHash: undefined } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// PUT /api/employees/:id/status — Admin only
router.put('/:id/status', adminOnly, (req, res) => {
  try {
    const { status } = req.body;
    if (!['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const db = getDb();
    db.prepare(`UPDATE employees SET status = ?, updatedAt = datetime('now') WHERE id = ?`).run(status, req.params.id);
    logActivity(req.user.id, 'Account Status Changed', 'employee', parseInt(req.params.id), { status });
    res.json({ message: `Account ${status === 'Active' ? 'activated' : 'deactivated'}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// PUT /api/employees/:id — Update employee details
router.put('/:id', adminOnly, (req, res) => {
  try {
    const { name, departmentId } = req.body;
    const db = getDb();
    db.prepare(`
      UPDATE employees SET name = COALESCE(?, name), departmentId = COALESCE(?, departmentId), updatedAt = datetime('now') WHERE id = ?
    `).run(name, departmentId, req.params.id);

    logActivity(req.user.id, 'Employee Updated', 'employee', parseInt(req.params.id), { name, departmentId });
    const emp = db.prepare(`
      SELECT e.id, e.name, e.email, e.role, e.departmentId, e.status, d.name as departmentName
      FROM employees e LEFT JOIN departments d ON e.departmentId = d.id WHERE e.id = ?
    `).get(req.params.id);
    res.json({ employee: emp });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

export default router;
