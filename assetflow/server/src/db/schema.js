import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'assetflow.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      departmentId INTEGER,
      role TEXT NOT NULL DEFAULT 'Employee' CHECK(role IN ('Admin','AssetManager','DeptHead','Employee')),
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (departmentId) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      headId INTEGER,
      parentId INTEGER,
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (headId) REFERENCES employees(id),
      FOREIGN KEY (parentId) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS asset_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      customFields TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      categoryId INTEGER NOT NULL,
      serialNumber TEXT,
      acquisitionDate TEXT,
      acquisitionCost REAL DEFAULT 0,
      condition TEXT NOT NULL DEFAULT 'New' CHECK(condition IN ('New','Good','Fair','Poor')),
      location TEXT,
      photo TEXT,
      isShared INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Available' CHECK(status IN ('Available','Allocated','Reserved','Under Maintenance','Lost','Retired','Disposed')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoryId) REFERENCES asset_categories(id)
    );

    CREATE TABLE IF NOT EXISTS allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assetId INTEGER NOT NULL,
      employeeId INTEGER NOT NULL,
      departmentId INTEGER,
      allocatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      expectedReturnDate TEXT,
      actualReturnDate TEXT,
      returnConditionNotes TEXT,
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Returned','Overdue')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (assetId) REFERENCES assets(id),
      FOREIGN KEY (employeeId) REFERENCES employees(id),
      FOREIGN KEY (departmentId) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS transfer_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assetId INTEGER NOT NULL,
      fromEmployeeId INTEGER NOT NULL,
      toEmployeeId INTEGER NOT NULL,
      requestedAt TEXT NOT NULL DEFAULT (datetime('now')),
      approvedBy INTEGER,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (assetId) REFERENCES assets(id),
      FOREIGN KEY (fromEmployeeId) REFERENCES employees(id),
      FOREIGN KEY (toEmployeeId) REFERENCES employees(id),
      FOREIGN KEY (approvedBy) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assetId INTEGER NOT NULL,
      bookedById INTEGER NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      purpose TEXT,
      status TEXT NOT NULL DEFAULT 'Upcoming' CHECK(status IN ('Upcoming','Ongoing','Completed','Cancelled')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (assetId) REFERENCES assets(id),
      FOREIGN KEY (bookedById) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS maintenance_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assetId INTEGER NOT NULL,
      reportedById INTEGER NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low','Medium','High')),
      photo TEXT,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','TechnicianAssigned','InProgress','Resolved')),
      approvedById INTEGER,
      technicianId INTEGER,
      resolvedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (assetId) REFERENCES assets(id),
      FOREIGN KEY (reportedById) REFERENCES employees(id),
      FOREIGN KEY (approvedById) REFERENCES employees(id),
      FOREIGN KEY (technicianId) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS audit_cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      departmentId INTEGER,
      location TEXT,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','Closed')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (departmentId) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS audit_cycle_auditors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycleId INTEGER NOT NULL,
      employeeId INTEGER NOT NULL,
      FOREIGN KEY (cycleId) REFERENCES audit_cycles(id),
      FOREIGN KEY (employeeId) REFERENCES employees(id),
      UNIQUE(cycleId, employeeId)
    );

    CREATE TABLE IF NOT EXISTS audit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycleId INTEGER NOT NULL,
      assetId INTEGER NOT NULL,
      auditorId INTEGER,
      result TEXT CHECK(result IN ('Verified','Missing','Damaged')),
      notes TEXT,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cycleId) REFERENCES audit_cycles(id),
      FOREIGN KEY (assetId) REFERENCES assets(id),
      FOREIGN KEY (auditorId) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipientId INTEGER NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      relatedId INTEGER,
      relatedType TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (recipientId) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      action TEXT NOT NULL,
      entityType TEXT,
      entityId INTEGER,
      details TEXT DEFAULT '{}',
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES employees(id)
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(categoryId);
    CREATE INDEX IF NOT EXISTS idx_assets_tag ON assets(tag);
    CREATE INDEX IF NOT EXISTS idx_allocations_asset ON allocations(assetId);
    CREATE INDEX IF NOT EXISTS idx_allocations_employee ON allocations(employeeId);
    CREATE INDEX IF NOT EXISTS idx_allocations_status ON allocations(status);
    CREATE INDEX IF NOT EXISTS idx_bookings_asset ON bookings(assetId);
    CREATE INDEX IF NOT EXISTS idx_bookings_times ON bookings(startTime, endTime);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
    CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance_requests(assetId);
    CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipientId);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(userId);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
    CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(departmentId);
    CREATE INDEX IF NOT EXISTS idx_transfer_status ON transfer_requests(status);
  `);
}

export function logActivity(userId, action, entityType, entityId, details = {}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO activity_logs (userId, action, entityType, entityId, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, action, entityType, entityId, JSON.stringify(details));
}

export function createNotification(recipientId, type, message, relatedId = null, relatedType = null) {
  const db = getDb();
  db.prepare(`
    INSERT INTO notifications (recipientId, type, message, relatedId, relatedType)
    VALUES (?, ?, ?, ?, ?)
  `).run(recipientId, type, message, relatedId, relatedType);
}

export function generateAssetTag() {
  const db = getDb();
  const result = db.prepare(`SELECT tag FROM assets ORDER BY id DESC LIMIT 1`).get();
  if (!result) return 'AF-0001';
  const num = parseInt(result.tag.replace('AF-', ''), 10) + 1;
  return `AF-${String(num).padStart(4, '0')}`;
}
