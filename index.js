require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');

const pool = require('./db/pool');
const { requireLogin } = require('./middleware/requireLogin');

const authRoutes = require('./routes/auth');
const { getAllowedFields } = require('./utils/dbHelper');

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

app.use(
  session({
    store: new pgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 2,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
);

app.use('/api/auth', authRoutes);
app.use('/login.html', express.static(path.join(__dirname, 'public', 'login.html')));
app.use('/register.html', express.static(path.join(__dirname, 'public', 'register.html')));

app.use(requireLogin);

app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

//create
app.post('/api/create/:table', requireLogin, async (req, res) => {
  const table = req.params.table;

  let allowedFields;
  try {
    allowedFields = await getAllowedFields(table, pool);
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

    let record;

    if (table === 'types') {
      const { rows } = await client.query(
        `INSERT INTO types (type, position)
         VALUES ($1, (SELECT COALESCE(MAX(position),0)+1 FROM types))
         RETURNING id, position`,
        [data.type]
      );
      record = rows[0];

    } else {
      record = await createRecord({ table, data, returning: ['id'] }, client);
  
      if (table === 'classes' && Array.isArray(instructorIds) && instructorIds.length > 0) {
        const insertPromises = instructorIds.map((instId) => {
          return client.query(
            'INSERT INTO class_instructors (class_id, instructor_id) VALUES ($1, $2)',
            [record.id, instId]
          );
        });
        await Promise.all(insertPromises);
      }
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

app.post('/api/addSchedule', requireLogin, async (req, res) => {
  const { title, day, start_period, end_period, room } = req.body;
  try {
    const classResult = await pool.query(
      'SELECT id FROM classes WHERE title = $1',
      [title]
    );

    if (classResult.rowCount === 0) {
      return res.status(400).json({ error: 'Class not found' });
    }

    const class_id = classResult.rows[0].id;

    await pool.query(
      `INSERT INTO schedule (class_id, day, start_period, room)
       VALUES ($1, $2, $3, $4)`,
      [class_id, day, start_period, room]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to insert schedule' });
  }
});

app.post('/api/addInstructorClassByTitle', requireLogin, async (req, res) => {
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

app.post('/api/addClassbyInstructorName', requireLogin, async (req, res) => {
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

//end create

//read
app.get('/api/read/:table', requireLogin, async (req, res) => {
  const table = req.params.table;

  try {
    allowedFields = await getAllowedFields(table, pool);
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
      classes.length,
      types.type AS type,
      COALESCE(
      string_agg(
      instructors.name ||
      CASE
        WHEN instructors.rpt IS NOT NULL AND instructors.rpt <> ''
      THEN ', ' || instructors.rpt
      ELSE ''
      END,
      ', '
    ),
    'No instructors'
    )AS instructor_name
    FROM classes
    LEFT JOIN class_instructors ON classes.id = class_instructors.class_id
    LEFT JOIN instructors ON instructors.id = class_instructors.instructor_id
    JOIN types ON types.id = classes.type
    GROUP BY classes.id, classes.title, classes.level, types.type
    ORDER BY classes.id;
  `;
  } else if (table === 'types') {
    query = `SELECT * FROM types ORDER BY position ASC`;
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

app.get('/api/classByInst/:id', requireLogin, async (req, res) => {
  const id = req.params.id;

  try {
    const allowedFields = await getAllowedFields('classes', pool);
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

app.get('/api/instByClass/:id', requireLogin, async (req, res) => {
  const id = req.params.id;

  try {
    const allowedFields = await getAllowedFields('classes', pool);
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
      classes.length,
      instructors.id AS instructor_id,
    instructors.name ||
    CASE
      WHEN instructors.rpt IS NOT NULL AND instructors.rpt <> ''
    THEN ', ' || instructors.rpt
    ELSE ''
    END
    AS instructor_name,
      types.type AS type_name,
      types.id AS type_id
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

app.get('/api/readEntry/:table/:id', requireLogin, async (req, res) => {
  const { table, id } = req.params;

  let allowedFields;
  try {
    allowedFields = await getAllowedFields(table, pool);
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

app.get('/api/schedule', requireLogin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        schedule.id AS schedule_id,
        schedule.day,
        schedule.start_period,
        schedule.room,
        schedule.class_id,
        classes.title,
        classes.length,
        types.type,
        types.color,
        COALESCE(string_agg(instructors.name, ', '), 'No instructors') as instructors
      FROM
        schedule
      JOIN
        classes ON classes.id = schedule.class_id
      JOIN
        types ON types.id = classes.type
      LEFT JOIN
        class_instructors ON classes.id = class_instructors.class_id
      LEFT JOIN
        instructors ON class_instructors.instructor_id = instructors.id
      GROUP BY 
          schedule.id,
          schedule.day,
          schedule.start_period,
          schedule.room,
          classes.title,
          classes.length,
          types.color,
          types.type
      ORDER BY
        schedule.id ASC
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(result.rows);
  } catch (err) {
    console.error(`Error querying table:`, err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

//end read

//update
app.patch('/api/update/:table/:id', requireLogin, async (req, res) => {
  const { table, id } = req.params;
  const updates = req.body;

  try {
    const allowedFields = await getAllowedFields(table, pool);
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

//end update

//delete
app.delete('/api/deleteInstructorClass', requireLogin, async (req, res) => {
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

app.delete('/api/delete/:table/:id', requireLogin, async (req, res) => {
  const { table, id } = req.params;

  try {

    const allowedTables = ['schedule', 'classes', 'instructors', 'types'];
    if (!allowedTables.includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    const query = `
      DELETE FROM ${table}
      WHERE id = $1
      RETURNING *;
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ message: 'Entry deleted', entry: result.rows[0] });
  } catch (err) {
    console.error('Error deleting entry:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

//generate pdf of page
app.post('/api/export-pdf', requireLogin, async (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).send('No HTML provided');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const content = `
    <html>
      <head>
        <link rel="stylesheet" href="http://localhost:3000/styles.css">
      </head>
      <body>
      ${html}
      </body>
    </html>
  `;

  await page.setContent(content, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    height: '2000px',
    width: '2810px',
    printBackground: true,
    margin: { top: 20, right: 20, bottom: 20, left: 20},
  });

  await browser.close();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="element.pdf"');
  res.send(pdfBuffer);
});

app.patch('/api/update-order', requireLogin, async (req, res) => {
  const { order } = req.body;
  if (!order) return res.status(400).send('Missing order data');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const item of order) {
      await client.query(
        'UPDATE types SET position = $1 WHERE id = $2',
        [item.position, item.id]
      );
    }

    await client.query('COMMIT');
    res.send('Order updated');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).send('Database error');
  } finally {
    client.release();
  }
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));


app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
