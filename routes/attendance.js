const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

const { requireLogin } = require(`../middleware/requireLogin`);

router.use(requireLogin);

router.get(`/getScheduleForAttendance/:year`, async (req, res) => {
	const year = req.params.year;

	try {
	    const result = await pool.query(`
	    	SELECT
		        s.id AS schedule_id,
		        c.title AS class_title,
	    		c.length,
		        CASE
		        	WHEN s.day = 3 THEN 'Wednesday'
		        	WHEN s.day = 4 THEN 'Thursday'
		        	WHEN s.day = 5 THEN 'Friday'
		       		WHEN s.day = 6 THEN 'Saturday'
		        	WHEN s.day = 7 THEN 'Sunday'
		        	ELSE NULL
		        END AS day,
		        s.start_period,
	    		s.attendance,
		        r.name AS room,
		        COALESCE(
		        	string_agg(i.name, ', '),
		        	'No instructors'
		        ) AS instructors
		    FROM schedule s
		    JOIN classes c ON c.id = s.class_id
		    LEFT JOIN class_instructors ci ON ci.class_id = s.class_id
		    LEFT JOIN instructors i ON i.id = ci.instructor_id
		    LEFT JOIN rooms r ON r.id = s.room_id
		    LEFT JOIN conventions con ON con.id = s.convention
		    WHERE con.year = $1 AND
		    	c.type <> 20
		    GROUP BY
			    s.id,
			    c.title,
	    		c.length,
			    s.day,
			    s.start_period,
			    s.attendance,
			    r.name,
			    r.position
		    ORDER BY s.day, s.start_period, r.position;
	    `, [year]);
	    res.json(result.rows);
  	} catch (err) {
	    console.error(`Error fetching users:`, err);
	    res.status(500).json({ error: 'Internal server error' });
  	}
});

module.exports = router;