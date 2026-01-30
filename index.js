require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');

const pool = require('./db/pool');
const { requireLogin } = require('./middleware/requireLogin');

const authRoutes = require('./routes/auth');
const { getAllowedFields } = require('./utils/dbHelper');
const { createRecord } = require('./services/crud');

const app = express();

app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

app.use(
  session({
    store: new pgSession({
      pool: pool,
      tableName: 'session',
      createTableIfMissing: true
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

app.use('/auth', authRoutes);
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(requireLogin);
app.use(express.static(path.join(__dirname, 'protected')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

//create
app.post('/api/create/:table', requireLogin, async (req, res) => {
  const table = req.params.table;
  const userId = req.user.id;

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
         RETURNING *`,
        [data.type]
      );
      record = rows[0];

    } else if (table === 'rooms') { 
      const { name, location_id } = req.body;
      const { rows } = await client.query(
        `INSERT INTO rooms (name, location_id, position)
         VALUES ($1, $2, (SELECT COALESCE(MAX(position),0)+1 FROM rooms))
         RETURNING id, name, location_id, position`,
        [name, location_id]
      );
      record = rows[0];

    } else {
      record = await createRecord({ table, data, returning: ['*'] }, client);
  
      if (table === 'classes' &&
        Array.isArray(instructorIds) &&
        instructorIds.length > 0
      ) {
        for (const instId of instructorIds) {
          await client.query(
            'INSERT INTO class_instructors (class_id, instructor_id) VALUES ($1, $2)',
            [record.id, instId]
          );
        }
      }
    }
    await client.query(
     `
      INSERT INTO audit_log
        (user_id, action, table_name, record_id, new_data)
      VALUES
        ($1, 'INSERT', $2, $3, $4)
      `,
      [userId, table, record.id, record]
    );

    await client.query('COMMIT');

    return res.json({ 
      message: `Created record in ${table}`,
      id: record.id,
      record
    });
  } catch (err) {
    await client.query('ROLLBACK');

    if (err.code === '23505') {
      const errCol = err.constraint.split('_')[1];
      console.error('Insert failed:', err);
      return res.status(400).json({ error: `${errCol} already exists.` });
    }

    console.error('Error inserting record:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

app.post('/api/addSchedule', requireLogin, async (req, res) => {
  const { class_id, day, start_period, room } = req.body;
  const userId = req.user.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await pool.query(
    `
      INSERT INTO schedule (class_id, day, start_period, room_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
      [class_id, day, start_period, room]
    );
    const record = rows[0];

    await client.query(
      `
      INSERT INTO audit_log
        (user_id, action, table_name, record_id, new_data)
      VALUES
        ($1, 'INSERT', 'schedule', $2, $3)
      `,
      [userId, record.id, record]
    );

    await client.query('COMMIT');

    res.json({
      message: `Created record in Schedule table`,
      id: record.id,
      record,
      success: true
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to insert schedule' });
  } finally {
    client.release();
  }
});

app.post('/api/addInstructorClassById', requireLogin, async (req, res) => {
  const { instructor_id, class_id } = req.body;
  const userId = req.user.id;

  if (!instructor_id || !class_id) {
    return res.status(400).json({ error: 'Missing instructor_id or class_id' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const { rows } = await pool.query(
      `INSERT INTO class_instructors (instructor_id, class_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [instructor_id, class_id]
    );
    const record = rows[0];

    await client.query(
      `
      INSERT INTO audit_log
        (user_id, action, table_name, record_id, new_data)
      VALUES
        ($1, 'INSERT', 'class_instructors', $2, $3)
      `,
      [userId, record.id, record]
    );

    await client.query('COMMIT');

    if (record.rowCount === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({ success: true, record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
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
        WHEN instructors.rpt IS NOT NULL AND instructors.rpt = TRUE
      THEN ', RPT'
      ELSE ''
      END,
      ', '
    ),
    'No instructors'
    )AS instructor_name,
    array_agg(DISTINCT instructors.id)
        FILTER (WHERE instructors.id IS NOT NULL)
        AS instructor_ids
    FROM classes
    LEFT JOIN class_instructors ON classes.id = class_instructors.class_id
    LEFT JOIN instructors ON instructors.id = class_instructors.instructor_id
    LEFT JOIN types ON types.id = classes.type
    GROUP BY classes.id, classes.title, classes.level, types.type
    ORDER BY classes.id;
  `;
  } else if (table === 'types') {
    query = `SELECT * FROM types ORDER BY position ASC`;
  } else  if (table === 'schedule' ) {
    query =
    `SELECT 
    schedule.id AS schedule_id,
    schedule.notes AS notes,
    classes.title,

    CASE schedule.day
      WHEN 1 THEN 'Monday'
      WHEN 2 THEN 'Tuesday'
      WHEN 3 THEN 'Wednesday'
      WHEN 4 THEN 'Thursday'
      WHEN 5 THEN 'Friday'
      WHEN 6 THEN 'Saturday'
      WHEN 7 THEN 'Sunday'
      ELSE ''
    END AS day,

    p_start.start AS start,
    p_end.end     AS "end",

    rooms.name AS room,

    COALESCE(
      string_agg(
        instructors.name ||
        CASE
          WHEN instructors.rpt IS NOT NULL AND instructors.rpt <> false
          THEN ', RPT'
          ELSE ''
        END,
        ', '
      ),
      'No instructors'
    ) AS instructor_name,
    
    array_agg(DISTINCT instructors.id)
      FILTER (WHERE instructors.id IS NOT NULL)
      AS instructor_ids

  FROM schedule
  JOIN classes ON schedule.class_id = classes.id

  -- starting period
  JOIN periods p_start 
    ON schedule.start_period = p_start.period

  -- ending period
  JOIN periods p_end
    ON p_end.period = schedule.start_period + classes.length - 1

  JOIN rooms ON schedule.room_id = rooms.id
  LEFT JOIN class_instructors ON classes.id = class_instructors.class_id
  LEFT JOIN instructors ON instructors.id = class_instructors.instructor_id

  GROUP BY
    schedule.id,
    schedule.notes,
    classes.title,
    day,
    p_start.start,
    p_end.end,
    classes.length,
    rooms.name;
  `
  } else if (table === 'audit_log') {
    query =
      `SELECT
        a.*,
        u.name
      FROM
        audit_log a
      LEFT JOIN
        users u on u.id = a.user_id
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
      WHEN instructors.rpt IS NOT NULL AND instructors.rpt = TRUE
    THEN ', RPT'
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
    let result = '';

    if (table == 'classes') {
      result = await pool.query(`
        SELECT
          classes.*,
          types.type AS type_name
        FROM
          classes
        LEFT JOIN
          types ON types.id = classes.type
        WHERE
          classes.id = $1
      `, [id]);
    } else {
      result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(`Error querying table "${table}" with id ${id}:`, err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.get('/api/schedule/:year', requireLogin, async (req, res) => {
  const year = req.params.year;

  try {
    const result = await pool.query(`
      SELECT 
        schedule.id AS schedule_id,
        schedule.day,
        schedule.start_period,
        schedule.class_id,
        schedule.notes,
        classes.title,
        classes.length,
        types.type,
        types.color,
        rooms.name as room,
        rooms.id as room_id,
        COALESCE(
          array_agg(
            instructors.name ||
            CASE
              WHEN instructors.rpt IS TRUE THEN ', RPT'
              ELSE ''
            END
          ) FILTER (WHERE instructors.id IS NOT NULL),
          ARRAY[]::text[]
        ) AS instructors,
        array_agg(DISTINCT instructors.id)
          FILTER (WHERE instructors.id IS NOT NULL)
          AS instructor_ids
      FROM
        schedule
      JOIN
        classes ON classes.id = schedule.class_id
      JOIN
        types ON types.id = classes.type
      JOIN
        rooms ON rooms.id = schedule.room_id
      LEFT JOIN
        class_instructors ON classes.id = class_instructors.class_id
      LEFT JOIN
        instructors ON class_instructors.instructor_id = instructors.id
      LEFT JOIN 
        locations ON locations.id = rooms.location_id
      WHERE
        locations.id = $1
      GROUP BY 
          schedule.id,
          schedule.day,
          schedule.start_period,
          schedule.notes,
          classes.title,
          classes.length,
          types.color,
          types.type,
          room,
          rooms.id
      ORDER BY
        schedule.id ASC
    `, [year]);

    res.json(result.rows);
  } catch (err) {
    console.error(`Error querying table:`, err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.get('/api/classFromSchedule/:id', requireLogin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT 
        schedule.class_id,
        classes.title,
        COALESCE(string_agg(DISTINCT instructors.name, ', '), 'No instructors') as instructors,
        conventions.year,
        COUNT(DISTINCT schedule.id) AS times_taught,
        ROUND(AVG((reviews.q1 + reviews.q2 + reviews.q3 + reviews.q4 + reviews.q5 + reviews.q6 + reviews.q7 + reviews.q8)::numeric / 8), 1) AS rating
      FROM
        schedule
      JOIN
        classes ON classes.id = schedule.class_id
      LEFT JOIN
        class_instructors ON classes.id = class_instructors.class_id
      LEFT JOIN
        instructors ON class_instructors.instructor_id = instructors.id
      LEFT JOIN
        rooms ON schedule.room_id = rooms.id
      LEFT JOIN
        locations ON rooms.location_id = locations.id
      LEFT JOIN
        conventions ON locations.id = conventions.location_id
      LEFT JOIN
        reviews ON schedule.id = reviews.schedule_id
      WHERE
        schedule.class_id = $1
      GROUP BY 
          schedule.class_id,
          classes.title,
          conventions.year
      ORDER BY
        conventions.year ASC
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    console.error(`Error querying table:`, err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.get('/api/getRooms/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const result = await pool.query(`
      SELECT
        rooms.*,
        conventions.year AS year
      FROM rooms
      LEFT JOIN
        conventions ON conventions.location_id = rooms.location_id
      WHERE
        rooms.location_id = $1
    `, [id])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(result.rows);
  } catch (err) {
    console.error(`Error getting rooms:`, err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.get('/api/getPropTypes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        type,
        COUNT(DISTINCT id),
        approved,
        year,
        sessions,
        level,
        length
      FROM class_proposals
      GROUP BY
        type,
        approved,
        year,
        sessions,
        level,
        length
    `)

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(result.rows);
  } catch (err) {
    console.error(`Error:`, err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.get('/api/getReviews/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const result = await pool.query(`
      SELECT 
        schedule.id as schedule_id,
        schedule.class_id,
        schedule.start_period AS period,
        rooms.name,
        classes.title,
        COALESCE(string_agg(DISTINCT instructors.name, ', '), 'No instructors') as instructors,
        conventions.year,
        ROUND(AVG((reviews.q1)::numeric), 1) AS q1,
        ROUND(AVG((reviews.q2)::numeric), 1) AS q2,
        ROUND(AVG((reviews.q3)::numeric), 1) AS q3,
        ROUND(AVG((reviews.q4)::numeric), 1) AS q4,
        ROUND(AVG((reviews.q5)::numeric), 1) AS q5,
        ROUND(AVG((reviews.q6)::numeric), 1) AS q6,
        ROUND(AVG((reviews.q7)::numeric), 1) AS q7,
        ROUND(AVG((reviews.q8)::numeric), 1) AS q8,
        CASE
          WHEN schedule.day = 3 THEN 'Wednesday'
          WHEN schedule.day = 4 THEN 'Thursday'
          WHEN schedule.day = 5 THEN 'Friday'
          WHEN schedule.day = 6 THEN 'Saturday'
          WHEN schedule.day = 7 THEN 'Sunday'
          ELSE NULL
        END AS day,
        locations.location_name
      FROM
        schedule
      JOIN
        classes ON classes.id = schedule.class_id
      LEFT JOIN
        class_instructors ON classes.id = class_instructors.class_id
      LEFT JOIN
        instructors ON class_instructors.instructor_id = instructors.id
      LEFT JOIN
        rooms ON schedule.room_id = rooms.id
      LEFT JOIN
        locations ON rooms.location_id = locations.id
      LEFT JOIN
        conventions ON locations.id = conventions.location_id
      LEFT JOIN
        reviews ON schedule.id = reviews.schedule_id
      WHERE
        schedule.class_id = $1
      GROUP BY 
          schedule.id,
          schedule.class_id,
          schedule.day,
          rooms.name,
          schedule.start_period,
          classes.title,
          conventions.year,
          locations.location_name
      ORDER BY
        conventions.year ASC
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    console.error(`Error:`, err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.get('/api/getOpenResponse/:id', async (req, res) => {
  const id = req.params.id;
  
  try {
    const result = await pool.query(`
      SELECT 
        schedule.id as schedule_id,
        schedule.class_id,
        reviews.q9
      FROM
        schedule
      LEFT JOIN
        reviews ON schedule.id = reviews.schedule_id
      WHERE
        schedule.class_id = $1
      GROUP BY 
          schedule.id,
          schedule.class_id,
          reviews.q9
      ORDER BY
        schedule_id ASC
    `, [id]);

    res.json(result.rows);
  } catch (err) {
    console.error(`Error:`, err);
    res.status(500).json({ error: 'Database query failed' });
  }
});
//end read

//update
app.patch('/api/update/:table/:id', requireLogin, async (req, res) => {
  const { table, id } = req.params;
  const updates = req.body;
  const userId = req.user.id;

  const client = await pool.connect();

  try {
    const allowedFields = await getAllowedFields(table, pool);
    if (allowedFields.length === 0) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    const keys = Object.keys(updates).filter(k => allowedFields.includes(k));
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    //begin transaction
    await client.query('BEGIN');

    //store old data
    const oldResult = await client.query(
      `SELECT * FROM ${table} WHERE id = $1`, [id]
    );

    if (oldResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Entry not found' });
    }

    const oldRow = oldResult.rows[0];

    //update
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

    //get new data and insert it into the audit log
    const newRow = result.rows[0];

    await client.query(
      `
      INSERT INTO audit_log
        (user_id, action, table_name, record_id, old_data, new_data)
      VALUES  
        ($1, 'UPDATE', $2, $3, $4, $5)
      `,
      [userId, table, id, oldRow, newRow]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Entry updated',
      entry: newRow
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating entry:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

//end update

//delete
app.delete('/api/deleteInstructorClass', requireLogin, async (req, res) => {
  
  const { class_id, instructor_id } = req.body;
  const userId = req.user.id;

  if (!class_id || !instructor_id) {
    return res.status(400).json({ error: 'Missing class_id or instructor_id' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `DELETE FROM class_instructors WHERE class_id = $1 AND instructor_id = $2 RETURNING *;`,
      [class_id, instructor_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const record = rows[0];

    await client.query(
      `
      INSERT INTO audit_log
        (user_id, action, table_name, record_id, old_data)
      VALUES
        ($1, 'INSERT', 'class_instructors', $2, $3)
      `,
      [userId, record.id, record]
    );

    await client.query('COMMIT');

    res.json({ success: true, record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

app.delete('/api/delete/:table/:id', requireLogin, async (req, res) => {
  const { table, id } = req.params;
  const userId = req.user.id;
  const client = await pool.connect();
    const allowedTables = ['schedule', 'classes', 'instructors', 'types', 'rooms'];
  if (!allowedTables.includes(table)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(`
      DELETE FROM ${table}
      WHERE id = $1
      RETURNING *;
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const record = rows[0];

    await client.query(
      `
      INSERT INTO audit_log
        (user_id, action, table_name, record_id, old_data)
      VALUES
        ($1, 'DELETE', $2, $3, $4)
      `,
      [userId, table, record.id, record]
    );

    await client.query('COMMIT');

    res.json({ message: 'Entry deleted', record });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting entry:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

//generate pdf of page
app.post('/api/export-pdf/:filename', requireLogin, async (req, res) => {
  const { filename } = req.params;
  const { htmlList } = req.body;

  if (!Array.isArray(htmlList) || htmlList.length === 0) {
    return res.status(400).send('No HTML provided');
  }

  const browser = await puppeteer.launch({ headless: true });
  const mergedPdf = await PDFDocument.create();
  const pdfConfigs = {
    'colorblock': {
      height: '2000px',
      width: '2810px',
      margin: { top: 20, right: 20, bottom: 20, left: 20 }
    },
    'classroom-labels': {
      format: 'letter',
      preferCSSPageSize: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
    }
  };


  for (const html of htmlList) {
    const page = await browser.newPage();

    const content = `
      <html>
        <head>
          <link rel="stylesheet" href="http://localhost:3000/public/styles/styles.css">
          <link rel="stylesheet" href="http://localhost:3000/public/styles/schedule-styles.css">
          <link rel="stylesheet" href="http://localhost:3000/public/styles/class-labels.css">
          <link rel="stylesheet" href="http://localhost:3000/public/styles/print.css">
        </head>
        <body>
        ${html}
        </body>
      </html>
    `;

    await page.setContent(content, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      printBackground: true,
      ...(pdfConfigs[filename] ?? {})
    })

    await page.close();

    const pdf = await PDFDocument.load(pdfBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach(p => mergedPdf.addPage(p));
  }

  await browser.close();

  const finalPdf = await mergedPdf.save();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  res.send(Buffer.from(finalPdf));
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
