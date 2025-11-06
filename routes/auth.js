const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');

const router = express.Router();

// --- LOGIN ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Store user info in session before saving
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    req.session.save(err => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Login failed' });
      }

      // Respond after session saved
      res.json({ success: true, user: { id: user.id, email: user.email, role: user.role } });
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- LOGOUT ---
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// --- REGISTER ---
router.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
      [email, hashed, role || 'user']
    );

    res.status(201).json({ message: 'Registered successfully' });
  } catch (err) {
    console.error('Register error:', err);

    if (err.code === '23505') {
      return res.status(400).json({ error: 'Email already exists' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
