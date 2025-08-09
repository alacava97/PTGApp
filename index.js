require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const router = express.Router();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

console.log('starting...')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

//functions
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

async function createRecord({ table, data, returning = ['id'] }, client = pool) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  const query = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING ${returning.join(', ')}
  `;

  const result = await client.query(query, values);
  return result.rows[0];
}

async function getAllowedFields(table, client = pool) {
  const res = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
  `, [table]);

  return res.rows.map(r => r.column_name);
}

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

app.post('/api/create/:table', async (req, res) => {
  const table = req.params.table;

  let allowedFields;
  try {
    allowedFields = await getAllowedFields(table);
  } catch (err) {
    return res.status(500).json({ error: 'Error loading table schema' });
  }

  if (!allowedFields.length) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  const instructorIds = req.body.instructor_ids || [];

  const data = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      data[field] = req.body[field];
    }
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const record = await createRecord({ table, data, returning: ['id'] }, client);

    if (table === 'classes' && Array.isArray(instructorIds) && instructorIds.length > 0) {
      const insertPromises = instructorIds.map((instId) => {
        return client.query(
          'INSERT INTO class_instructors (class_id, instructor_id) VALUES ($1, $2)',
          [record.id, instId]
        );
      });
      await Promise.all(insertPromises);
    }

    await client.query('COMMIT');
    res.json({ message: `Created record in ${table}`, id: record.id });
  } catch (err) {
    await client.query('ROLLBACK');

    if (err.code === '23505') {
      const errCol = err.constraint.split('_')[1];
      return res.status(400).json({ error: `${errCol} already exists.` });
    }

    console.error('Error inserting record:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});


//read all data from a table
app.get('/api/read/:table', async (req, res) => {
  const table = req.params.table;

  try {
    allowedFields = await getAllowedFields(table);
  } catch (err) {
    console.error(`Error loading table schema ${table}:`, err);
    return res.status(500).json({ error: 'Error loading table schema' });
  }

  if (!allowedFields.length) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  let query = '';
  let params = [];

  if (table === 'classes') {
    query = `
    SELECT 
      classes.id,
      classes.title,
      classes.level,
      types.type AS type,
      COALESCE(string_agg(instructors.name, ', '), 'No instructors') AS instructor_name
    FROM classes
    LEFT JOIN class_instructors ON classes.id = class_instructors.class_id
    LEFT JOIN instructors ON instructors.id = class_instructors.instructor_id
    JOIN types ON types.id = classes.type
    GROUP BY classes.id, classes.title, classes.level, types.type
    ORDER BY classes.id;
  `;
  } else {
    query = `SELECT * FROM ${table} ORDER BY id ASC`;
  }

  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(`Error fetching data from ${table}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/classByInst/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const allowedFields = await getAllowedFields('classes');
    if (!allowedFields.length) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
  } catch (err) {
    console.error(`Error loading table schema:`, err);
    return res.status(500).json({ error: 'Error loading table schema' });
  }

  const query = `
    SELECT 
      classes.id AS class_id,
      classes.title,
      classes.level,
      instructors.id AS instructor_id,
      instructors.name AS instructor_name,
      types.type AS type_name
    FROM 
      class_instructors
    JOIN 
      classes ON class_instructors.class_id = classes.id
    JOIN 
      instructors ON class_instructors.instructor_id = instructors.id
    JOIN 
      types ON classes.type = types.id
    WHERE 
      instructors.id = $1
    ORDER BY 
      classes.id ASC
  `;

  const params = [id];

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(`Error fetching data:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/instByClass/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const allowedFields = await getAllowedFields('classes');
    if (!allowedFields.length) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
  } catch (err) {
    console.error(`Error loading table schema:`, err);
    return res.status(500).json({ error: 'Error loading table schema' });
  }

  const query = `
    SELECT 
      classes.id AS class_id,
      classes.title,
      classes.level,
      instructors.id AS instructor_id,
      instructors.name AS instructor_name,
      types.type AS type_name
    FROM 
      class_instructors
    JOIN 
      classes ON class_instructors.class_id = classes.id
    JOIN 
      instructors ON class_instructors.instructor_id = instructors.id
    JOIN 
      types ON classes.type = types.id
    WHERE 
      classes.id = $1
    ORDER BY 
      classes.id ASC
  `;

  const params = [id];

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(`Error fetching data:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


//Get single instructor
app.get('/api/readEntry/:table/:id', async (req, res) => {
  const { table, id } = req.params;

  let allowedFields;
  try {
    allowedFields = await getAllowedFields(table);
  } catch (err) {
    console.error(`Error loading table schema for "${table}":`, err);
    return res.status(500).json({ error: 'Error loading table schema' });
  }

  if (!allowedFields.length) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  try {
    const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(`Error querying table "${table}" with id ${id}:`, err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.put('/api/update/:table/:id', async (req, res) => {
  const { table, id } = req.params;
  const updates = req.body;

  try {
    const allowedFields = await getAllowedFields(table);
    if (allowedFields.length === 0) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    const keys = Object.keys(updates).filter(k => allowedFields.includes(k));
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const setClauses = keys.map((key, i) => `${key} = $${i + 1}`);
    const values = keys.map(k => updates[k]);
    values.push(id);

    const query = `
      UPDATE ${table}
      SET ${setClauses.join(', ')}
      WHERE id = $${values.length}
      RETURNING *;
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ message: 'Entry updated', entry: result.rows[0] });
  } catch (err) {
    console.error('Error updating entry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/addInstructorClassByTitle', async (req, res) => {
  const { instructor_id, class_title } = req.body;

  if (!instructor_id || !class_title) {
    return res.status(400).json({ error: 'Missing instructor_id or class_title' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO class_instructors (instructor_id, class_id)
       SELECT $1, id FROM classes WHERE title = $2
       RETURNING *`,
      [instructor_id, class_title]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({ success: true, link: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/addClassbyInstructorName', async (req, res) => {
  const { class_id, instructor_name } = req.body;

  if (!class_id || !instructor_name) {
    return res.status(400).json({ error: 'Missing class_id or instructor_name' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO class_instructors (class_id, instructor_id)
       SELECT $1, id FROM instructors WHERE name = $2
       RETURNING *`,
      [class_id, instructor_name]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Instructor not found' });
    }

    res.json({ success: true, link: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/deleteInstructorClass', async (req, res) => {
  try {
    const { class_id, instructor_id } = req.body;

    if (!class_id || !instructor_id) {
      return res.status(400).json({ error: 'Missing class_id or instructor_id' });
    }

    const result = await pool.query(
      `DELETE FROM class_instructors WHERE class_id = $1 AND instructor_id = $2`,
      [class_id, instructor_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
