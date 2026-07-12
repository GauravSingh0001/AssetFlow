import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb, logActivity } from '../db/schema.js';
import { generateToken, authenticate } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/signup
router.post('/signup', (req, res) => {
  try {
    const { name, email, password, departmentId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM employees WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO employees (name, email, passwordHash, departmentId, role, status)
      VALUES (?, ?, ?, ?, 'Employee', 'Active')
    `).run(name, email, passwordHash, departmentId || null);

    const user = db.prepare('SELECT id, name, email, role, departmentId, status FROM employees WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(user);

    logActivity(user.id, 'Account Created', 'employee', user.id, { name, email });

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM employees WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (user.status === 'Inactive') {
      return res.status(403).json({ error: 'Account is deactivated. Contact your administrator.' });
    }
    if (!bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);
    const { passwordHash, ...safeUser } = user;

    logActivity(user.id, 'Login', 'employee', user.id, {});

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare(`
      SELECT e.id, e.name, e.email, e.role, e.departmentId, e.status, d.name as departmentName
      FROM employees e
      LEFT JOIN departments d ON e.departmentId = d.id
      WHERE e.id = ?
    `).get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT id, name FROM employees WHERE email = ?').get(email);

    // Always return success to prevent email enumeration
    if (user) {
      const resetToken = Math.random().toString(36).substring(2, 15);
      console.log(`[Password Reset] Token for ${email}: ${resetToken}`);
      logActivity(user.id, 'Password Reset Requested', 'employee', user.id, {});
    }

    res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

export default router;
