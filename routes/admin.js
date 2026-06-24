const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

const { requireLogin, requireAdmin } = require(`../middleware/requireLogin`);

router.use(requireLogin);
router.use(requireAdmin);

router.get(`/getUsers`, async (req, res) => {
  const query = `
  	SELECT
	  	id,
	  	name,
	  	email,
	  	role,
	  	institute_team,
	  	title,
	  	special_permission
	FROM
		users
	WHERE
	  hidden IS NOT true
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
})


module.exports = router;