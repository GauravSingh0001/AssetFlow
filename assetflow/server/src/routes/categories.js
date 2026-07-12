import { Router } from 'express';
import { getDb, logActivity } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';
import { adminOnly } from '../middleware/rbac.js';

const router = Router();
router.use(authenticate);

// GET /api/categories
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const categories = db.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM assets WHERE categoryId = c.id) as assetCount
      FROM asset_categories c ORDER BY c.name
    `).all();
    categories.forEach(c => { c.customFields = JSON.parse(c.customFields || '[]'); });
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/categories
router.post('/', adminOnly, (req, res) => {
  try {
    const { name, customFields } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const db = getDb();
    const result = db.prepare(`
      INSERT INTO asset_categories (name, customFields, status) VALUES (?, ?, 'Active')
    `).run(name, JSON.stringify(customFields || []));

    logActivity(req.user.id, 'Category Created', 'category', result.lastInsertRowid, { name });
    const cat = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(result.lastInsertRowid);
    cat.customFields = JSON.parse(cat.customFields);
    res.status(201).json({ category: cat });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Category name already exists' });
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// PUT /api/categories/:id
router.put('/:id', adminOnly, (req, res) => {
  try {
    const { name, customFields, status } = req.body;
    const db = getDb();
    db.prepare(`
      UPDATE asset_categories SET name = COALESCE(?, name), customFields = COALESCE(?, customFields),
        status = COALESCE(?, status), updatedAt = datetime('now') WHERE id = ?
    `).run(name, customFields ? JSON.stringify(customFields) : null, status, req.params.id);

    logActivity(req.user.id, 'Category Updated', 'category', parseInt(req.params.id), { name, status });
    const cat = db.prepare('SELECT * FROM asset_categories WHERE id = ?').get(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    cat.customFields = JSON.parse(cat.customFields);
    res.json({ category: cat });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// DELETE /api/categories/:id (soft delete)
router.delete('/:id', adminOnly, (req, res) => {
  try {
    const db = getDb();
    db.prepare(`UPDATE asset_categories SET status = 'Inactive', updatedAt = datetime('now') WHERE id = ?`).run(req.params.id);
    logActivity(req.user.id, 'Category Deactivated', 'category', parseInt(req.params.id), {});
    res.json({ message: 'Category deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate category' });
  }
});

export default router;
