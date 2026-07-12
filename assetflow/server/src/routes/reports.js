import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/reports/asset-utilization
router.get('/asset-utilization', (req, res) => {
  try {
    const db = getDb();
    const stats = db.prepare(`
      SELECT a.tag, a.name, c.name as category,
        (SELECT COUNT(*) FROM allocations WHERE assetId = a.id) as totalAllocations,
        (SELECT COUNT(*) FROM bookings WHERE assetId = a.id) as totalBookings,
        (SELECT COUNT(*) FROM maintenance_requests WHERE assetId = a.id) as totalMaintenance
      FROM assets a LEFT JOIN asset_categories c ON a.categoryId = c.id
      ORDER BY totalAllocations + totalBookings DESC
    `).all();
    res.json({ data: stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch utilization data' });
  }
});

// GET /api/reports/maintenance-frequency
router.get('/maintenance-frequency', (req, res) => {
  try {
    const db = getDb();
    const byCategory = db.prepare(`
      SELECT c.name as category, COUNT(m.id) as requestCount,
        SUM(CASE WHEN m.status = 'Resolved' THEN 1 ELSE 0 END) as resolvedCount
      FROM maintenance_requests m
      LEFT JOIN assets a ON m.assetId = a.id
      LEFT JOIN asset_categories c ON a.categoryId = c.id
      GROUP BY c.name ORDER BY requestCount DESC
    `).all();

    const byAsset = db.prepare(`
      SELECT a.tag, a.name, COUNT(m.id) as requestCount
      FROM maintenance_requests m LEFT JOIN assets a ON m.assetId = a.id
      GROUP BY a.id ORDER BY requestCount DESC LIMIT 10
    `).all();

    res.json({ byCategory, byAsset });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch maintenance data' });
  }
});

// GET /api/reports/department-allocation
router.get('/department-allocation', (req, res) => {
  try {
    const db = getDb();
    const data = db.prepare(`
      SELECT d.name as department, 
        COUNT(DISTINCT al.assetId) as activeAssets,
        COUNT(DISTINCT al.id) as totalAllocations
      FROM departments d
      LEFT JOIN allocations al ON al.departmentId = d.id AND al.status = 'Active'
      WHERE d.status = 'Active'
      GROUP BY d.id ORDER BY activeAssets DESC
    `).all();
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch department data' });
  }
});

// GET /api/reports/booking-heatmap
router.get('/booking-heatmap', (req, res) => {
  try {
    const db = getDb();
    const bookings = db.prepare(`
      SELECT b.startTime, b.endTime, a.name as resourceName
      FROM bookings b LEFT JOIN assets a ON b.assetId = a.id
      WHERE b.status IN ('Upcoming', 'Ongoing', 'Completed')
      ORDER BY b.startTime
    `).all();

    // Generate heatmap data (hour of day × day of week)
    const heatmap = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    for (let h = 0; h < 24; h++) {
      for (const d of days) {
        const key = `${d}-${h}`;
        heatmap[key] = { day: d, hour: h, count: 0 };
      }
    }

    bookings.forEach(b => {
      const start = new Date(b.startTime);
      const end = new Date(b.endTime);
      const day = days[start.getDay()];
      for (let h = start.getHours(); h < end.getHours() && h < 24; h++) {
        const key = `${day}-${h}`;
        if (heatmap[key]) heatmap[key].count++;
      }
    });

    res.json({ heatmap: Object.values(heatmap), bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

// GET /api/reports/assets-condition
router.get('/assets-condition', (req, res) => {
  try {
    const db = getDb();
    const data = db.prepare(`
      SELECT condition, COUNT(*) as count FROM assets
      WHERE status NOT IN ('Retired', 'Disposed')
      GROUP BY condition
    `).all();

    const needsMaintenance = db.prepare(`
      SELECT a.tag, a.name, a.condition, c.name as category, a.location
      FROM assets a LEFT JOIN asset_categories c ON a.categoryId = c.id
      WHERE a.condition IN ('Fair', 'Poor') AND a.status NOT IN ('Retired', 'Disposed', 'Under Maintenance')
      ORDER BY CASE a.condition WHEN 'Poor' THEN 1 WHEN 'Fair' THEN 2 END
    `).all();

    res.json({ conditionSummary: data, needsMaintenance });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch condition data' });
  }
});

// GET /api/reports/export/:type
router.get('/export/:type', async (req, res) => {
  try {
    const db = getDb();
    const { type } = req.params;
    let data, filename;

    switch (type) {
      case 'assets':
        data = db.prepare(`SELECT a.tag, a.name, c.name as category, a.status, a.condition, a.location, a.acquisitionDate, a.acquisitionCost FROM assets a LEFT JOIN asset_categories c ON a.categoryId = c.id`).all();
        filename = 'assets_report.csv';
        break;
      case 'allocations':
        data = db.prepare(`SELECT a.tag as assetTag, a.name as assetName, e.name as employee, al.allocatedAt, al.expectedReturnDate, al.status FROM allocations al LEFT JOIN assets a ON al.assetId = a.id LEFT JOIN employees e ON al.employeeId = e.id`).all();
        filename = 'allocations_report.csv';
        break;
      case 'maintenance':
        data = db.prepare(`SELECT a.tag as assetTag, m.description, m.priority, m.status, e.name as reportedBy, m.createdAt FROM maintenance_requests m LEFT JOIN assets a ON m.assetId = a.id LEFT JOIN employees e ON m.reportedById = e.id`).all();
        filename = 'maintenance_report.csv';
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    if (!data.length) return res.status(404).json({ error: 'No data to export' });

    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;
