import bcrypt from 'bcryptjs';
import { getDb, logActivity, generateAssetTag } from './schema.js';

export function seedDatabase() {
  const db = getDb();
  
  // Check if system settings are empty
  const settingsCount = db.prepare(`SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='system_settings'`).get();
  if (settingsCount.count > 0) {
    const emptySettings = db.prepare(`SELECT COUNT(*) as count FROM system_settings`).get();
    if (emptySettings.count === 0) {
      console.log('Seeding system settings...');
      const settingsInsert = db.prepare(`
        INSERT INTO system_settings (key, value) VALUES (?, ?)
      `);
      settingsInsert.run('company_name', 'Sinton Agency');
      settingsInsert.run('company_logo', '');
      settingsInsert.run('company_icon', 'Globe');
      settingsInsert.run('primary_color', '#0B132B');
      settingsInsert.run('accent_color', '#00B4D8');
      settingsInsert.run('sidebar_color', '#0B132B');
    }
  }

  // Check if already seeded
  const existing = db.prepare(`SELECT COUNT(*) as count FROM employees`).get();
  if (existing.count > 0) {
    console.log('Database already seeded, skipping...');
    return;
  }

  console.log('Seeding database...');

  const passwordHash = bcrypt.hashSync('Admin123!', 10);
  const empPassword = bcrypt.hashSync('Password123!', 10);

  // ── Insert Admin ───────────────────────────────────────────────────────
  db.prepare(`
    INSERT INTO employees (name, email, passwordHash, role, status)
    VALUES (?, ?, ?, 'Admin', 'Active')
  `).run('Amanda Torres', 'admin@company.com', passwordHash);

  // ── Insert Departments (without heads first) ──────────────────────────
  const deptInsert = db.prepare(`
    INSERT INTO departments (name, parentId, status)
    VALUES (?, ?, 'Active')
  `);
  
  deptInsert.run('Executive Leadership', null);  // 1
  deptInsert.run('Operations', null);             // 2
  deptInsert.run('Information Technology', 2);     // 3
  deptInsert.run('Research & Development', null);  // 4
  deptInsert.run('Facilities Management', 2);      // 5
  deptInsert.run('Finance & Accounting', null);    // 6
  deptInsert.run('Human Resources', 1);            // 7
  deptInsert.run('Fleet & Logistics', 2);          // 8

  // ── Insert Employees ──────────────────────────────────────────────────
  const empInsert = db.prepare(`
    INSERT INTO employees (name, email, passwordHash, departmentId, role, status)
    VALUES (?, ?, ?, ?, ?, 'Active')
  `);

  // Department Heads
  empInsert.run('James Park', 'james.park@company.com', empPassword, 3, 'DeptHead');        // 2
  empInsert.run('Sarah Chen', 'sarah.chen@company.com', empPassword, 4, 'DeptHead');        // 3
  empInsert.run('Tom Rivera', 'tom.rivera@company.com', empPassword, 5, 'DeptHead');        // 4
  empInsert.run('Lin Zhao', 'lin.zhao@company.com', empPassword, 6, 'DeptHead');            // 5
  empInsert.run('Priya Nair', 'priya.nair@company.com', empPassword, 7, 'DeptHead');        // 6

  // Asset Manager
  empInsert.run('Marcus Webb', 'marcus.webb@company.com', empPassword, 8, 'AssetManager');   // 7

  // Regular Employees
  empInsert.run('Nina Okafor', 'nina.okafor@company.com', empPassword, 4, 'Employee');       // 8
  empInsert.run('Alex Kim', 'alex.kim@company.com', empPassword, 3, 'Employee');             // 9
  empInsert.run('Maria Santos', 'maria.santos@company.com', empPassword, 5, 'Employee');     // 10
  empInsert.run('David Liu', 'david.liu@company.com', empPassword, 3, 'Employee');           // 11
  empInsert.run('Rachel Green', 'rachel.green@company.com', empPassword, 6, 'Employee');     // 12
  empInsert.run('Carlos Martinez', 'carlos.martinez@company.com', empPassword, 8, 'Employee'); // 13
  empInsert.run('Emma Wilson', 'emma.wilson@company.com', empPassword, 4, 'Employee');       // 14
  empInsert.run('Ryan Cooper', 'ryan.cooper@company.com', empPassword, 1, 'Employee');       // 15

  // ── Assign Department Heads ───────────────────────────────────────────
  const updateHead = db.prepare(`UPDATE departments SET headId = ? WHERE id = ?`);
  updateHead.run(1, 1);   // Amanda Torres → Executive Leadership
  updateHead.run(2, 3);   // James Park → IT
  updateHead.run(3, 4);   // Sarah Chen → R&D
  updateHead.run(4, 5);   // Tom Rivera → Facilities
  updateHead.run(5, 6);   // Lin Zhao → Finance
  updateHead.run(6, 7);   // Priya Nair → HR
  updateHead.run(7, 8);   // Marcus Webb → Fleet & Logistics

  // Update admin's department
  db.prepare(`UPDATE employees SET departmentId = 1 WHERE id = 1`).run();

  // ── Insert Asset Categories ───────────────────────────────────────────
  const catInsert = db.prepare(`
    INSERT INTO asset_categories (name, customFields, status)
    VALUES (?, ?, 'Active')
  `);

  catInsert.run('Electronics', JSON.stringify([
    { name: 'warrantyPeriod', type: 'text', label: 'Warranty Period' },
    { name: 'manufacturer', type: 'text', label: 'Manufacturer' }
  ]));
  catInsert.run('Furniture', JSON.stringify([
    { name: 'material', type: 'text', label: 'Material' }
  ]));
  catInsert.run('Vehicles', JSON.stringify([
    { name: 'licensePlate', type: 'text', label: 'License Plate' },
    { name: 'mileage', type: 'number', label: 'Mileage' }
  ]));
  catInsert.run('Lab Equipment', JSON.stringify([
    { name: 'calibrationDate', type: 'date', label: 'Last Calibration' }
  ]));
  catInsert.run('Office Equipment', JSON.stringify([]));
  catInsert.run('Conference Rooms', JSON.stringify([
    { name: 'capacity', type: 'number', label: 'Seating Capacity' }
  ]));

  // ── Insert Assets ────────────────────────────────────────────────────
  const assetInsert = db.prepare(`
    INSERT INTO assets (tag, name, categoryId, serialNumber, acquisitionDate, acquisitionCost, condition, location, isShared, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  assetInsert.run('AF-0001', 'Dell Workstation XPS', 1, 'SN-DWX-9901', '2024-03-15', 2400, 'Good', 'HQ Floor 3', 0, 'Allocated');
  assetInsert.run('AF-0002', 'Ford Transit Van', 3, 'SN-FTV-0034', '2023-06-20', 38000, 'Good', 'Parking Bay B', 0, 'Under Maintenance');
  assetInsert.run('AF-0003', 'Centrifuge G-Force X3', 4, 'SN-CGX-2241', '2023-01-10', 14700, 'Good', 'Lab Wing C', 0, 'Allocated');
  assetInsert.run('AF-0004', 'HVAC Unit MX-400', 5, 'SN-HVM-0112', '2022-08-01', 8200, 'Fair', 'Roof Level 1', 0, 'Available');
  assetInsert.run('AF-0005', 'Conference Room A', 6, null, '2022-01-01', 3600, 'Good', 'HQ Floor 1', 1, 'Available');
  assetInsert.run('AF-0006', 'MacBook Pro 16"', 1, 'SN-MBP-2287', '2024-06-10', 3200, 'New', 'Remote', 0, 'Allocated');
  assetInsert.run('AF-0007', 'Toyota Prius Hybrid', 3, 'SN-TPH-0051', '2023-09-15', 28000, 'Good', 'Parking Bay A', 1, 'Available');
  assetInsert.run('AF-0008', 'Spectrophotometer UV-3', 4, 'SN-SUV-3380', '2020-03-22', 22000, 'Poor', 'Lab Wing A', 0, 'Retired');
  assetInsert.run('AF-0009', 'Industrial Generator', 5, 'SN-IGN-0205', '2021-11-05', 45000, 'Good', 'Basement B', 0, 'Available');
  assetInsert.run('AF-0010', 'Cisco Network Switch', 1, 'SN-CNS-5544', '2024-01-18', 6800, 'Good', 'Server Room', 0, 'Available');
  assetInsert.run('AF-0011', 'Ergonomic Desk Set', 2, 'SN-EDS-1102', '2024-09-01', 1400, 'New', 'HQ Floor 2', 0, 'Available');
  assetInsert.run('AF-0012', 'Mercedes Sprinter', 3, 'SN-MSP-0078', '2022-04-10', 52000, 'Fair', 'Depot South', 0, 'Under Maintenance');
  assetInsert.run('AF-0013', 'Conference Room B', 6, null, '2022-01-01', 2800, 'Good', 'HQ Floor 2', 1, 'Available');
  assetInsert.run('AF-0014', 'Lab Suite 1', 4, null, '2021-06-01', 15000, 'Good', 'Lab Wing A', 1, 'Available');
  assetInsert.run('AF-0015', 'Projector Kit A', 5, 'SN-PKA-0001', '2023-07-15', 1800, 'Good', 'AV Storage', 1, 'Available');
  assetInsert.run('AF-0016', 'Standing Desk Pro', 2, 'SN-SDP-0042', '2024-11-20', 950, 'New', 'HQ Floor 3', 0, 'Available');
  assetInsert.run('AF-0017', 'Delivery Van #2', 3, 'SN-DVN-0092', '2023-02-28', 35000, 'Good', 'Depot South', 1, 'Available');

  // ── Insert Allocations ───────────────────────────────────────────────
  const allocInsert = db.prepare(`
    INSERT INTO allocations (assetId, employeeId, departmentId, allocatedAt, expectedReturnDate, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  allocInsert.run(1, 7, 8, '2024-11-01', '2025-02-01', 'Active');    // Dell to Marcus
  allocInsert.run(3, 3, 4, '2024-10-15', null, 'Active');             // Centrifuge to Sarah
  allocInsert.run(6, 5, 6, '2024-12-01', '2025-06-01', 'Active');     // MacBook to Lin Zhao

  // Past allocation (returned)
  const allocInsertReturned = db.prepare(`
    INSERT INTO allocations (assetId, employeeId, departmentId, allocatedAt, expectedReturnDate, actualReturnDate, returnConditionNotes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  allocInsertReturned.run(1, 9, 3, '2024-06-01', '2024-10-30', '2024-10-28', 'Good condition, minor wear on keyboard', 'Returned');

  // Overdue allocation
  allocInsert.run(11, 2, 3, '2024-08-01', '2024-12-15', 'Overdue');  // Desk to James, past due

  // ── Insert Bookings ──────────────────────────────────────────────────
  const bookingInsert = db.prepare(`
    INSERT INTO bookings (assetId, bookedById, startTime, endTime, purpose, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  bookingInsert.run(5, 1, '2025-01-13 08:00', '2025-01-13 10:00', 'Strategy Session', 'Completed');
  bookingInsert.run(5, 5, '2025-01-15 10:00', '2025-01-15 12:00', 'Quarterly Review', 'Completed');
  bookingInsert.run(13, 2, '2025-01-13 11:00', '2025-01-13 13:00', 'Sprint Planning', 'Completed');
  bookingInsert.run(14, 3, '2025-01-14 08:00', '2025-01-14 12:00', 'Batch Testing', 'Completed');
  bookingInsert.run(7, 7, '2025-01-13 09:00', '2025-01-13 11:00', 'Site Visit — Oakland', 'Completed');
  
  // Future bookings
  bookingInsert.run(5, 1, '2025-07-14 09:00', '2025-07-14 11:00', 'Board Prep Meeting', 'Upcoming');
  bookingInsert.run(13, 5, '2025-07-14 14:00', '2025-07-14 16:00', 'Finance Review', 'Upcoming');
  bookingInsert.run(14, 8, '2025-07-15 10:00', '2025-07-15 14:00', 'Lab Experiments', 'Upcoming');
  bookingInsert.run(15, 6, '2025-07-16 09:00', '2025-07-16 11:00', 'Training Session', 'Upcoming');

  // ── Insert Maintenance Requests ──────────────────────────────────────
  const maintInsert = db.prepare(`
    INSERT INTO maintenance_requests (assetId, reportedById, description, priority, status, approvedById, resolvedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  maintInsert.run(2, 7, 'Engine warning light on, needs diagnostic check', 'High', 'InProgress', 7, null);
  maintInsert.run(12, 13, 'Brake pad replacement due at 80K miles', 'Medium', 'Approved', 7, null);
  maintInsert.run(4, 4, 'HVAC showing critical failure indicators, needs emergency repair', 'High', 'Pending', null, null);
  maintInsert.run(10, 11, 'Firmware update required for security patch', 'Low', 'Pending', null, null);
  
  // Resolved maintenance
  maintInsert.run(1, 9, 'Keyboard replacement needed', 'Medium', 'Resolved', 7, '2024-10-15');
  maintInsert.run(9, 10, 'Annual generator inspection', 'Low', 'Resolved', 7, '2024-10-05');

  // ── Insert Transfer Requests ─────────────────────────────────────────
  const transferInsert = db.prepare(`
    INSERT INTO transfer_requests (assetId, fromEmployeeId, toEmployeeId, status, approvedBy)
    VALUES (?, ?, ?, ?, ?)
  `);

  transferInsert.run(1, 7, 8, 'Pending', null);  // Dell from Marcus to Nina
  transferInsert.run(6, 5, 9, 'Approved', 7);     // MacBook from Lin to Alex (approved)

  // ── Insert Notifications ─────────────────────────────────────────────
  const notifInsert = db.prepare(`
    INSERT INTO notifications (recipientId, type, message, relatedId, relatedType, read)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  notifInsert.run(1, 'MaintenanceRequest', 'New maintenance request for HVAC Unit MX-400', 3, 'maintenance', 0);
  notifInsert.run(7, 'TransferRequest', 'Transfer request for Dell Workstation XPS from Marcus to Nina', 1, 'transfer', 0);
  notifInsert.run(7, 'MaintenanceApproved', 'Maintenance approved for Ford Transit Van', 1, 'maintenance', 1);
  notifInsert.run(5, 'AssetAssigned', 'MacBook Pro 16" has been assigned to you', 6, 'asset', 1);
  notifInsert.run(8, 'BookingConfirmed', 'Lab Suite 1 booking confirmed for Jul 15', 8, 'booking', 0);
  notifInsert.run(2, 'OverdueReturn', 'Ergonomic Desk Set (AF-0011) is overdue for return', 11, 'asset', 0);
  notifInsert.run(1, 'AuditDiscrepancy', '2 assets flagged as discrepant in Q4 Audit', null, 'audit', 0);

  // ── Insert Activity Logs ─────────────────────────────────────────────
  const logInsert = db.prepare(`
    INSERT INTO activity_logs (userId, action, entityType, entityId, details, timestamp)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  logInsert.run(7, 'Asset Allocated', 'asset', 1, JSON.stringify({ to: 'Marcus Webb', asset: 'AF-0001' }), '2025-01-13 08:15:00');
  logInsert.run(3, 'Maintenance Resolved', 'maintenance', 5, JSON.stringify({ asset: 'AF-0001' }), '2025-01-13 08:00:00');
  logInsert.run(7, 'Asset Registered', 'asset', 16, JSON.stringify({ tag: 'AF-0016', name: 'Standing Desk Pro' }), '2025-01-12 14:30:00');
  logInsert.run(5, 'Booking Created', 'booking', 7, JSON.stringify({ asset: 'Conference Room B', time: '2025-07-14 14:00–16:00' }), '2025-01-12 10:00:00');
  logInsert.run(7, 'Maintenance Approved', 'maintenance', 2, JSON.stringify({ asset: 'AF-0012' }), '2025-01-11 16:45:00');
  logInsert.run(8, 'Transfer Requested', 'transfer', 1, JSON.stringify({ asset: 'AF-0001', from: 'Marcus Webb', to: 'Nina Okafor' }), '2025-01-11 11:30:00');
  logInsert.run(1, 'Department Updated', 'department', 3, JSON.stringify({ field: 'head', value: 'James Park' }), '2025-01-10 09:00:00');



  console.log('✅ Database seeded successfully!');
  console.log('   Admin login: admin@company.com / Admin123!');
  console.log('   Employee login: (any)@company.com / Password123!');
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase();
}
