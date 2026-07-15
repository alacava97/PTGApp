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
	try {
    const emails = await pool.query(`
	    SELECT
				e.id,
				e.address,
				b.copy_id,
				b.id AS bulk_id,
				b.send_at,
				e.status
				FROM emailing e
				LEFT JOIN bulk_emails b ON e.bulk_id = b.id;
    `);

    const bulks = await pool.query(`
    	SELECT
    		b.id,
    		CONCAT(c.year, ' - ', l.city_state) AS convention,
    		b.copy_id,
    		to_char (b.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
    		b.send_at,
    		b.job_status
    	FROM bulk_emails b
    	LEFT JOIN conventions c ON c.id = b.convention_id
    	LEFT JOIN locations l ON l.id = c.location_id;
    `);

    const conflicts = await pool.query(`
    	SELECT
    		b.id,
    		b.convention_id,
    		b.copy_id
    	FROM bulk_emails b;
    `);

    res.json({ emails: emails.rows, bulk: bulks.rows, conflicts: conflicts.rows });
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

router.post(`/api/scheduleBulkSend`, async (req, res) => {
	const formData = req.body.formData;
	const emailGroup = req.body.group;

	if (!formData || Object.keys(formData).length == 0) {
		return res.status(400).json({ error: 'No valid fields provided.' });
	}

	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		const { rows } = await client.query(`
			INSERT INTO bulk_emails (copy_id, send_at, convention_id)
			VALUES ($1, $2, $3)
			RETURNING *;
		`, [formData.copy_id, formData.send_at, formData.convention_id]);

		const record = rows[0];

		formData.bulk_id = record.id;

		const { values, params } = constructValues(formData, emailGroup);

		await client.query(`
			INSERT INTO emailing (address, bulk_id)
			VALUES ${values};
		`, params);

		await client.query('COMMIT');

		return res.json({
			ok: true,
			status: 200,
			message: 'Emails successfully scheduled',
			record
		});
	} catch (err) {
    await client.query('ROLLBACK');

    if (err.code === '23505') {
      const errCol = err.constraint?.split('_')?.[1] || 'Field';
      return res.status(400).json({ error: `${errCol} already exists.` });
    }

    console.error('Error inserting record:', err);
    return res.status(500).json({ error: 'Internal server error' });

  } finally {
    client.release();
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

router.delete('/api/cancelBulkSend/:id', async (req, res) => {
	const { id } = req.params;
	const userId = req.user.id;

	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		const { rows } = await client.query(
			`SELECT * FROM bulk_emails WHERE id = $1 FOR UPDATE`,
			[id]
		);

		if (rows.length === 0) {
			await client.query('ROLLBACK');
			return res.status(404).json({ error: 'Entry not found' });
		}

		const record = rows[0];

		if (record.job_status !== 'pending') {
			await client.query('ROLLBACK');
			return res.status(409).json({
				error: 'JOB_ALREADY_COMPLETED',
				message: 'Completed jobs cannot be canceled.'
			});
		}

		await client.query(
			`DELETE FROM bulk_emails WHERE id = $1`,
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

function constructValues(formData, emailGroup) {
    const group = typeof emailGroup[0] === 'string'
        ? emailGroup
        : emailGroup.map(a => a.email);

    const values = [];
    const params = [];

    group.forEach((address, i) => {
        const offset = i * 2;

        values.push(
            `($${offset + 1}, $${offset + 2})`
        );

        params.push(
            address,
            formData.bulk_id
        );
    });

    return {
        values: values.join(", "),
        params
    };
}

module.exports = router;