import { Router } from 'express';
import { getDb, logActivity, createNotification } from '../db/schema.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/bookings
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { assetId, status, startDate, endDate } = req.query;
    let query = `
      SELECT b.*, a.tag as assetTag, a.name as assetName, e.name as bookedByName
      FROM bookings b
      LEFT JOIN assets a ON b.assetId = a.id
      LEFT JOIN employees e ON b.bookedById = e.id
      WHERE 1=1
    `;
    const params = [];
    if (assetId) { query += ` AND b.assetId = ?`; params.push(assetId); }
    if (status) { query += ` AND b.status = ?`; params.push(status); }
    if (startDate) { query += ` AND b.endTime >= ?`; params.push(startDate); }
    if (endDate) { query += ` AND b.startTime <= ?`; params.push(endDate); }
    query += ` ORDER BY b.startTime ASC`;

    const bookings = db.prepare(query).all(...params);
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET /api/bookings/resources — List bookable assets
router.get('/resources', (req, res) => {
  try {
    const db = getDb();
    const resources = db.prepare(`
      SELECT a.id, a.tag, a.name, a.location, c.name as categoryName
      FROM assets a LEFT JOIN asset_categories c ON a.categoryId = c.id
      WHERE a.isShared = 1 AND a.status NOT IN ('Retired', 'Disposed', 'Lost')
      ORDER BY a.name
    `).all();
    res.json({ resources });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// POST /api/bookings
router.post('/', (req, res) => {
  try {
    const { assetId, startTime, endTime, purpose } = req.body;
    if (!assetId || !startTime || !endTime) {
      return res.status(400).json({ error: 'Asset, start time, and end time are required' });
    }

    if (new Date(startTime) >= new Date(endTime)) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    const db = getDb();
    
    // Check asset is bookable
    const asset = db.prepare('SELECT * FROM assets WHERE id = ? AND isShared = 1').get(assetId);
    if (!asset) return res.status(400).json({ error: 'Asset is not available for booking' });

    // Overlap validation: reject if any existing booking overlaps
    // Overlap occurs when: existingStart < newEnd AND existingEnd > newStart
    const overlap = db.prepare(`
      SELECT b.*, e.name as bookedByName
      FROM bookings b LEFT JOIN employees e ON b.bookedById = e.id
      WHERE b.assetId = ? AND b.status IN ('Upcoming', 'Ongoing')
        AND b.startTime < ? AND b.endTime > ?
    `).get(assetId, endTime, startTime);

    if (overlap) {
      return res.status(409).json({
        error: `Time slot conflicts with existing booking by ${overlap.bookedByName} (${overlap.startTime} to ${overlap.endTime})`,
        conflictingBooking: overlap
      });
    }

    const result = db.prepare(`
      INSERT INTO bookings (assetId, bookedById, startTime, endTime, purpose, status) VALUES (?, ?, ?, ?, ?, 'Upcoming')
    `).run(assetId, req.user.id, startTime, endTime, purpose || null);

    logActivity(req.user.id, 'Booking Created', 'booking', result.lastInsertRowid, { asset: asset.tag, time: `${startTime} to ${endTime}` });
    createNotification(req.user.id, 'BookingConfirmed', `Booking confirmed: ${asset.name} from ${startTime} to ${endTime}`, result.lastInsertRowid, 'booking');

    const booking = db.prepare(`
      SELECT b.*, a.tag as assetTag, a.name as assetName, e.name as bookedByName
      FROM bookings b LEFT JOIN assets a ON b.assetId = a.id LEFT JOIN employees e ON b.bookedById = e.id
      WHERE b.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json({ booking });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// PUT /api/bookings/:id/cancel
router.put('/:id/cancel', (req, res) => {
  try {
    const db = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.bookedById !== req.user.id && !['Admin', 'AssetManager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You can only cancel your own bookings' });
    }
    if (!['Upcoming'].includes(booking.status)) {
      return res.status(400).json({ error: 'Only upcoming bookings can be cancelled' });
    }

    db.prepare(`UPDATE bookings SET status = 'Cancelled' WHERE id = ?`).run(req.params.id);
    logActivity(req.user.id, 'Booking Cancelled', 'booking', parseInt(req.params.id), {});
    createNotification(booking.bookedById, 'BookingCancelled', `Your booking has been cancelled`, parseInt(req.params.id), 'booking');

    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// PUT /api/bookings/:id/reschedule
router.put('/:id/reschedule', (req, res) => {
  try {
    const { startTime, endTime } = req.body;
    if (!startTime || !endTime) return res.status(400).json({ error: 'New start and end times required' });

    const db = getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.bookedById !== req.user.id && !['Admin', 'AssetManager'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You can only reschedule your own bookings' });
    }

    // Check overlap excluding this booking
    const overlap = db.prepare(`
      SELECT * FROM bookings WHERE assetId = ? AND id != ? AND status IN ('Upcoming', 'Ongoing')
        AND startTime < ? AND endTime > ?
    `).get(booking.assetId, req.params.id, endTime, startTime);

    if (overlap) {
      return res.status(409).json({ error: 'New time slot conflicts with an existing booking' });
    }

    db.prepare(`UPDATE bookings SET startTime = ?, endTime = ?, status = 'Upcoming' WHERE id = ?`).run(startTime, endTime, req.params.id);
    logActivity(req.user.id, 'Booking Rescheduled', 'booking', parseInt(req.params.id), { startTime, endTime });

    res.json({ message: 'Booking rescheduled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reschedule booking' });
  }
});

export default router;
