const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const router = express.Router();

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


// router.post("/send-email", async (req, res) => {
//   	try {
//     	const { to, subject, message } = req.body;

//     	const info = await transporter.sendMail({
// 	      	from: `"PTG Institute Team" <${process.env.EMAIL_USER}>`,
// 	      	to,
// 	      	subject,
// 	      	html: `<p>${message}</p>`,
//     	});

// 	    res.json({
// 	      	success: true,
// 	      	messageId: info.messageId,
// 	    });
//   	} catch (error) {
//    		console.error(error);
//     	res.status(500).json({
//       		success: false,
//       		error: error.message,
//     	});
//   	}
// });

router.post('/class-prop-confirmation', async (req, res) => {
	const { name, email } = req.body;

	if (!email) {
		return res.status(400).json({
			error: 'email required',
		});
	}

	try {
		await transporter.sendMail({
			from: process.env.EMAIL_USER,
			to: email,
			subject: 'Thank you for your class proposal',
			html: `
				<p>Hello ${name},</p>
				<p>Thank you for submitting a class proposal for next year's PTG national convention. The institute team has received your information and will review it for consideration.</p>
				<p>This inbox is not monitored, so please reach out to institute@ptg.org with any further communication.</p>
				<p>Best,<br>The Institute Team</p>
			`
		});

		return res.status(200).json({ message: 'Confirmation email sent successfully' });

	} catch (error) {
		console.error("Nodemailer failed to send email:", error);
		// Return a 500 error if the mail server itself fails
		return res.status(500).json({ error: 'Failed to send email' });
	}
});


module.exports = router;