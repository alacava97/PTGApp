const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const resetLimiter = rateLimit({
  windowsMs: 15 * 60 * 1000,
  max: 5,
  message: {
    error: 'Too many password reset attempts. Please try again later.'
  }
});

const transporter = nodemailer.createTransport({
  host: 'smtp.titan.email',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'user')`,
      [name, email, hashed]
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

router.post('/password-reset', resetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const result = await pool.query(
      'SELECT id, last_reset_request, reset_expires, reset_token FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    const genericResponse = {
      message: 'If an account with that email exists, a password reset link has been sent.'
    };

    if (!user) return res.json(genericResponse);

    if (
      user.last_reset_request &&
      Date.now() - new Date(user.last_reset_request).getTime() < 5 * 60 * 1000
    ) {
      return res.json(genericResponse);
    }

    let token = user.reset_token;

    if (!user.reset_expires || new Date(user.reset_expires) < new Date()) {
      token = crypto.randomBytes(32).toString('hex');

      await pool.query(
        `UPDATE users 
         SET reset_token = $1, last_reset_request = NOW(), reset_expires = NOW() + INTERVAL '1 hour' 
         WHERE id = $2`,
        [token, user.id]
      );
    } else {
      await pool.query(
        `UPDATE users SET last_reset_request = NOW() WHERE id = $1`,
        [user.id]
      );
    }

    const resetLink = `https://myptginstitute.com/reset-password?token=${token}`;

    await transporter.sendMail({
      from: `"PTG Institute Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'PTG Institute Password Reset',
      html: `
        <p>A request has been made to reset your PTG Institute password.</p>
        <p><a href="${resetLink}">Click here to reset your password</a></p>
        <p>If you didn't make this request, please ignore this email.</p>
      `
    });

    return res.json(genericResponse);

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// On the server
router.get('/session', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

module.exports = router;
