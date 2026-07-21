const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

const { requireLogin } = require(`../middleware/requireLogin`);

router.use(requireLogin);

router.get('/getClassList', requireLogin, async (req, res) => {
  try {
    const result = await pool.query(`
    SELECT 
      	classes.id,
      	classes.title,
      	classes.level,
      	classes.length,
      	classes.special_equipment,
    		classes.description,
      	types.type AS type,
      	sponsors.sponsor_name AS sponsor,
      	COALESCE(
		    jsonb_agg(
		        jsonb_build_object(
		            'id', instructors.id,
		            'name',
		                instructors.name ||
		                CASE
		                    WHEN instructors.rpt THEN ', RPT'
		                    ELSE ''
		                END
	        	)
		    ) FILTER (WHERE instructors.id IS NOT NULL),
		    '[]'::jsonb
		) AS instructors
      	FROM classes
      	LEFT JOIN class_instructors ON classes.id = class_instructors.class_id
      	LEFT JOIN instructors ON instructors.id = class_instructors.instructor_id
      	LEFT JOIN types ON types.id = classes.type
      	LEFT JOIN sponsors ON sponsors.id = classes.sponsor_id
      	GROUP BY classes.id, classes.title, classes.level, types.type, classes.special_equipment, sponsors.sponsor_name
      	ORDER BY classes.title ASC;
  `);
    res.json(result.rows);
  } catch (err) {
    console.error(`Error fetching data from ${table}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/getInstructorList', requireLogin, async(req, res) => {
	try {
    const result = await pool.query(`
    SELECT 
   		id,
    	name
    FROM
    	instructors
    ORDER BY
    	name ASC
  `);
    res.json(result.rows);
  } catch (err) {
    console.error(`Error fetching data from ${table}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
})

module.exports = router;