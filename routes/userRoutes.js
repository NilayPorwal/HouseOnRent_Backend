const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const router = express.Router();
const jwt = require('jsonwebtoken');
const getUserIdFromToken = require('../utils/getUserIdFromToken');

// Generate JWT Token
const generateToken = userId => {
	return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
		expiresIn: '7d'
	});
};

// Register
router.post('/register', async (req, res) => {
	try {
		const { name, email, password } = req.body;

		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res.status(400).json({ message: 'User already exists' });
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		const newUser = new User({
			name,
			email,
			password: hashedPassword
		});

		await newUser.save();

		const token = generateToken(newUser._id);
		res.status(200).json({
			message: 'User registered successfully',
			token,
			user: {
				id: newUser._id,
				name: newUser.name,
				email: newUser.email
			}
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err });
	}
});

// Login
router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body;

		const user = await User.findOne({ email });
		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) {
			return res.status(401).json({ message: 'Invalid credentials' });
		}

		const token = generateToken(user._id);
		res.status(200).json({
			message: 'Login successful',
			token,
			user: {
				id: user._id,
				name: user.name,
				email: user.email
			}
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err });
	}
});

router.get('/profile/details', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		const user = await User.findById(userId).select('-password');

		res.status(200).json(user);
	} catch (err) {
		res.status(401).json({ message: err.message });
	}
});

module.exports = router;
