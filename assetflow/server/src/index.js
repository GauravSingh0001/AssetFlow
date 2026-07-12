import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from './db/schema.js';
import { seedDatabase } from './db/seed.js';

// Routes
import authRoutes from './routes/auth.js';
import departmentRoutes from './routes/departments.js';
import categoryRoutes from './routes/categories.js';
import employeeRoutes from './routes/employees.js';
import assetRoutes from './routes/assets.js';
import allocationRoutes from './routes/allocations.js';
import transferRoutes from './routes/transfers.js';
import bookingRoutes from './routes/bookings.js';
import maintenanceRoutes from './routes/maintenance.js';
import auditRoutes from './routes/audits.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import activityLogRoutes from './routes/activityLogs.js';
import settingsRoutes from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000', 'http://localhost:4173'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (!req.url.includes('/api/notifications') && !req.url.includes('/api/auth/me')) {
      console.log(`${req.method} ${req.url} ${res.statusCode} ${ms}ms`);
    }
  });
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/settings', settingsRoutes);

// Dashboard stats endpoint
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const db = getDb();
    const stats = {
      assetsAvailable: db.prepare(`SELECT COUNT(*) as c FROM assets WHERE status = 'Available'`).get().c,
      assetsAllocated: db.prepare(`SELECT COUNT(*) as c FROM assets WHERE status = 'Allocated'`).get().c,
      totalAssets: db.prepare(`SELECT COUNT(*) as c FROM assets`).get().c,
      maintenanceToday: db.prepare(`SELECT COUNT(*) as c FROM maintenance_requests WHERE status IN ('Approved','InProgress','TechnicianAssigned')`).get().c,
      activeBookings: db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status IN ('Upcoming','Ongoing')`).get().c,
      pendingTransfers: db.prepare(`SELECT COUNT(*) as c FROM transfer_requests WHERE status = 'Pending'`).get().c,
      overdueReturns: db.prepare(`SELECT COUNT(*) as c FROM allocations WHERE status = 'Overdue' OR (status = 'Active' AND expectedReturnDate < datetime('now'))`).get().c,
      pendingMaintenance: db.prepare(`SELECT COUNT(*) as c FROM maintenance_requests WHERE status = 'Pending'`).get().c,
    };

    const recentActivity = db.prepare(`
      SELECT al.*, e.name as userName FROM activity_logs al
      LEFT JOIN employees e ON al.userId = e.id
      ORDER BY al.timestamp DESC LIMIT 10
    `).all();
    recentActivity.forEach(a => { a.details = JSON.parse(a.details || '{}'); });

    res.json({ stats, recentActivity });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files in production
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// Fallback for React Router (send index.html for all non-API routes)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize
try {
  // Ensure data directory exists
  const dataDir = path.join(__dirname, '..', 'data');
  const fs = await import('fs');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  // Ensure uploads directory exists
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  // Init DB and seed
  getDb();
  seedDatabase();

  app.listen(PORT, () => {
    console.log(`\n🚀 AssetFlow API server running at http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
  });
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}
