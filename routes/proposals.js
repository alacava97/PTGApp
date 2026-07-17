const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

const { requireLogin } = require(`../middleware/requireLogin`);

router.use(requireLogin);

router.get(`/proposalsByYear/:year`, async (req, res) => {
	const year = req.params.year;

  	try {
	    const result = await pool.query(`
	      	SELECT 
	        	c.*,
	    		t.type AS type,
	    		l.level AS level
	    	FROM
	    		class_proposals c
	    	LEFT JOIN types t ON t.id = c.type
	    	LEFT JOIN levels l ON l.id = c.level
	    	WHERE
	    		year = $1
	    `, [year]);

	    res.json(result.rows);
	  } catch (err) {
	    console.error(`Error:`, err);
	    res.status(500).json({ error: 'Database query failed' });
	  }
});

router.get(`/proposalById/:id`, async (req, res) => {
	const id = req.params.id;

  	try {
	    const result = await pool.query(`
	      	SELECT 
	        	c.*,
	    		t.type AS type,
	    		l.level AS level
	    	FROM
	    		class_proposals c
	    	LEFT JOIN types t ON t.id = c.type
	    	LEFT JOIN levels l ON l.id = c.level
	    	WHERE
	    		c.id = $1
	    `, [id]);

	    res.json(result.rows);
	  } catch (err) {
	    console.error(`Error:`, err);
	    res.status(500).json({ error: 'Database query failed' });
	  }
});

module.exports = router;