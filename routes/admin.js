const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

const { requireLogin, requireAdmin } = require(`../middleware/requireLogin`);

router.use(requireLogin);
router.use(requireAdmin);

router.get(`/api/getUsers`, async (req, res) => {
  const query = `
  	SELECT
	  	id,
	  	name,
	  	email,
  		CASE
  			WHEN role = 'user' THEN 'FALSE'
  			ELSE 'TRUE'
  		END AS access
	FROM
		users
	WHERE
	  hidden IS NOT true AND
	  role = 'user'
  	ORDER BY
  		id;
	`;

  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(`Error fetching users:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get(`/api/getInstitute`, async (req, res) => {
  const query = `
  	SELECT
	  	id,
	  	name,
	  	email,
	  	title,
	  	special_permission
		FROM
			users
		WHERE
		  hidden IS NOT true AND
		  institute_team = true AND
		  role = 'admin'
	  	ORDER BY
	  		id;
		`;

  try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(`Error fetching users:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get(`/api/getEmails`, async (req, res) => {
	const query = `
		SELECT
			e.id,
			e.to,
			e.copy_id,
			CONCAT(c.year, ' - ', l.city_state) AS convention,
			e.send_at,
			e.status
			FROM emailing e
			LEFT JOIN conventions c ON c.id = e.convention_id
			LEFT JOIN locations l ON l.id = c.location_id;
	`;
	try {
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(`Error fetching pending emails:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get(`/api/getEmailAddressesByConvention/:conId`, async (req, res) => {
	const conId = req.params.conId;

	try {
		result = await pool.query(`
			SELECT DISTINCT
				i.id,
				i.email,
				i.name
			FROM
				instructors i
			LEFT JOIN class_instructors ci ON i.id = ci.instructor_id
			LEFT JOIN classes c ON c.id = ci.class_id
			LEFT JOIN schedule s ON s.class_id = c.id
			WHERE
				s.convention = $1 AND
        i.email IS NOT NULL
      ORDER BY i.name
		`, [conId]);

		res.json(result.rows);

	} catch (err) {
		console.error(`Error fetching email addresses:`, err);
		res.status(500).json({ error: 'Internal server error' });
	}
});

router.delete(`/api/deleteUser/:id`, async (req, res) => {
	const { id } = req.params;
	const userId = req.user.id;
	const client = await pool.connect();
	
	try {
		await client.query('BEGIN');

		const {rows } = await client.query(`
			DELETE FROM users
			WHERE id = $1
			RETURNING *;
		`, [id]);

		if (rows.length === 0) {
			return res.status(404).json({ error: 'Entry not found' });
		}

		const record = rows[0];

		const toDisplay = `Deleted ${record.name}`;

		await client.query(`
			INSERT INTO audit_log
				(user_id, action, table_name, record_id, old_data, to_display)
			VALUES
				($1, 'DELETE', 'users', $2, $3, $4)
			`, [userId, record.id, record, toDisplay]
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

router.delete('/api/cancelSend/:id', async (req, res) => {
	const { id } = req.params;
	const userId = req.user.id;

	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		const { rows } = await client.query(
			`SELECT * FROM emailing WHERE id = $1 FOR UPDATE`,
			[id]
		);

		if (rows.length === 0) {
			await client.query('ROLLBACK');
			return res.status(404).json({ error: 'Entry not found' });
		}

		const record = rows[0];

		if (record.status !== 'pending') {
			await client.query('ROLLBACK');
			return res.status(409).json({
				error: 'EMAIL_ALREADY_SENT',
				message: 'Sent emails cannot be deleted.'
			});
		}

		await client.query(
			`DELETE FROM emailing WHERE id = $1`,
			[id]
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

module.exports = router;