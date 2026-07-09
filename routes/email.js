const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');

require('dotenv').config();

const router = express.Router();

const { requireLogin, requireAdmin } = require(`../middleware/requireLogin`);

const resetLimiter = rateLimit({
  	windowMs: 15 * 60 * 1000,
  	max: 5,
  	message: {
    	error: 'Too many attempts. Please try again later.'
  	}
});

const transporter = nodemailer.createTransport({
	host: "smtp.titan.email",
	port: 465,
	secure: true,
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
	},
});

router.post('/class-prop-confirmation', async (req, res) => {
	const { name, email, formData, convention } = req.body;

	if (!email) {
		return res.status(400).json({
			error: 'email required',
		});
	}

	const formFields = Object.entries(formData)
		.map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value || ''}`)
		.join('<br>');


	const date = convention.props_closed;

	const formatted = new Intl.DateTimeFormat("en-US", {
	  	weekday: "long",
	  	year: "numeric",
	  	month: "long",
	  	day: "numeric",
	}).format(new Date(date));

	try {
		await transporter.sendMail({
			from: process.env.EMAIL_USER,
			to: email,
			subject: 'Thank you for your class proposal',
			html: `
				<p>Dear ${name},</p>
				<p>Thank you for submitting your class proposal to the PTG Institute Team! We appreciate hearing from you, and look forward to reading through your proposal as we prepare for the ${convention.year} PTG Convention.</p>
				<p>We’ll review class submissions as they come in, finalizing decisions in late September, and let you know by October 5th. A copy of your proposal is included below. If you wish to <a href="myptginstitute.com/public/class-proposal-form.html?id=${convention.id}">submit any additional class proposals</a>, make sure they’re in by ${formatted}</p>
				<p>Have any questions or concerns? We're happy to help! Send an email to institute@ptg.org.</p>
				<p>All the best,</p>
				<p>The PTG Institute Team<br>institute@ptg.org</p>
				<p><i>Please note: <b>this inbox is not monitored.</b> All communications should be addressed to institute@ptg.org.</i></p>

				<p>${formFields}</p>
			`
		});

		return res.status(200).json({ message: 'Confirmation email sent successfully' });

	} catch (error) {
		console.error("Nodemailer failed to send email:", error);
		// Return a 500 error if the mail server itself fails
		return res.status(500).json({ error: 'Failed to send email' });
	}
});

router.use(requireAdmin);

function createCopy(copyId, toFill) {
	let data = toFill

	if(!data) {
		data = {year: '{current year}'}
	}

	const copies = {
		1: `Hello, thank you for joining us at the ${data.year} PTG convention. Here you'll find unique links to see reviews for your class as they come in.`
	}

	let copy = {};

	if (!copyId) {
		Object.keys(copies).forEach(c => {
			copy[c] = copies[c];
		});
	} else {
		copy = copies[copyId];
	}

	return { copy }
}

router.get('/getMailInfo/', async (req, res) => {
  try {
    const result = await pool.query(`
			SELECT DISTINCT
				i.id,
				i.email,
				i.name
			FROM
				instructors i
    	WHERE i.email IS NOT NULL
			ORDER BY i.name
    `);

    const mailInfo = {
      emails: result.rows,
      copies: createCopy()
    };

    res.json(mailInfo);
  } catch (err) {
    console.error('Error fetching emails:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});



module.exports = router;