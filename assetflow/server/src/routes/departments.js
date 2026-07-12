import { Router } from 'express';
import { getDb, logActivity } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { adminOnly } from '../middleware/rbac.js';

const router = Router();
router.use(authenticate);

// GET /api/departments
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const departments = db.prepare(`
      SELECT d.*, 
        e.name as headName, e.email as headEmail,
        p.name as parentName,
        (SELECT COUNT(*) FROM employees WHERE departmentId = d.id AND status = 'Active') as employeeCount
      FROM departments d
      LEFT JOIN employees e ON d.headId = e.id
      LEFT JOIN departments p ON d.parentId = p.id
      ORDER BY d.name
    `).all();
    res.json({ departments });
  } catch (err) {
    console.error('Get departments error:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

// GET /api/departments/:id
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const dept = db.prepare(`
      SELECT d.*, e.name as headName, p.name as parentName,
        (SELECT COUNT(*) FROM employees WHERE departmentId = d.id AND status = 'Active') as employeeCount
      FROM departments d
      LEFT JOIN employees e ON d.headId = e.id
      LEFT JOIN departments p ON d.parentId = p.id
      WHERE d.id = ?
    `).get(req.params.id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    res.json({ department: dept });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// POST /api/departments
router.post('/', adminOnly, (req, res) => {
  try {
    const { name, headId, parentId } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name is required' });

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO departments (name, headId, parentId, status) VALUES (?, ?, ?, 'Active')
    `).run(name, headId || null, parentId || null);

    // If headId is set, promote that employee to DeptHead
    if (headId) {
      db.prepare(`UPDATE employees SET role = 'DeptHead' WHERE id = ? AND role = 'Employee'`).run(headId);
    }

    logActivity(req.user.id, 'Department Created', 'department', result.lastInsertRowid, { name });

    const dept = db.prepare(`SELECT * FROM departments WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ department: dept });
  } catch (err) {
    console.error('Create department error:', err);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// PUT /api/departments/:id
router.put('/:id', adminOnly, (req, res) => {
  try {
    const { name, headId, parentId, status } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Department not found' });

    // If head is changing, update roles
    if (headId !== undefined && headId !== existing.headId) {
      // Demote old head if they're not heading another dept
      if (existing.headId) {
        const otherDepts = db.prepare('SELECT COUNT(*) as c FROM departments WHERE headId = ? AND id != ?').get(existing.headId, req.params.id);
        if (otherDepts.c === 0) {
          db.prepare(`UPDATE employees SET role = 'Employee' WHERE id = ? AND role = 'DeptHead'`).run(existing.headId);
        }
      }
      // Promote new head
      if (headId) {
        db.prepare(`UPDATE employees SET role = 'DeptHead' WHERE id = ? AND role = 'Employee'`).run(headId);
      }
    }

    db.prepare(`
      UPDATE departments SET name = COALESCE(?, name), headId = ?, parentId = ?, 
        status = COALESCE(?, status), updatedAt = datetime('now')
      WHERE id = ?
    `).run(name, headId ?? existing.headId, parentId ?? existing.parentId, status, req.params.id);

    logActivity(req.user.id, 'Department Updated', 'department', parseInt(req.params.id), { name, headId, status });

    const updated = db.prepare(`
      SELECT d.*, e.name as headName, p.name as parentName,
        (SELECT COUNT(*) FROM employees WHERE departmentId = d.id AND status = 'Active') as employeeCount
      FROM departments d LEFT JOIN employees e ON d.headId = e.id LEFT JOIN departments p ON d.parentId = p.id
      WHERE d.id = ?
    `).get(req.params.id);
    res.json({ department: updated });
  } catch (err) {
    console.error('Update department error:', err);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// DELETE /api/departments/:id (soft delete)
router.delete('/:id', adminOnly, (req, res) => {
  try {
    const db = getDb();
    db.prepare(`UPDATE departments SET status = 'Inactive', updatedAt = datetime('now') WHERE id = ?`).run(req.params.id);
    logActivity(req.user.id, 'Department Deactivated', 'department', parseInt(req.params.id), {});
    res.json({ message: 'Department deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate department' });
  }
});

export default router;
