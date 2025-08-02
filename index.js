require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

console.log('starting...')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Register
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hash, 'user']
    );
    res.json({ message: 'Account created successfully!' });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  res.json({ token });
});

// Protected test route
app.get('/api/profile', verifyToken, async (req, res) => {
  const user = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
  res.json(user.rows[0]);
});

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.sendStatus(401);
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

//create
async function createRecord({ table, data, returning = ['id'] }, client = pool) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  const query = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING ${returning.join(' ')}
  `;

  const result = await client.query(query, values);
  return result.rows[0];
}

// New Instructor
app.post('/api/newInstructor', async (req, res) => {
  try {
    const instructor = await createRecord({
      table: 'instructors',
      data: req.body,
      returning: ['id', 'name']
    });

    res.json({ message: 'Successfully created record for ' + instructor.name });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'Instructor already exists' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
