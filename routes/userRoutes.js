const express = require('express');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');
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
		const { name, email, password, phone } = req.body;

		// Validation
		if (!name || !email || !password || !phone) {
			return res.status(400).json({
				message: 'Please provide name, email, password, and phone'
			});
		}

		const existingUser = await User.findOne({
			$or: [{ email }, { phone }]
		});
		if (existingUser) {
			return res.status(400).json({
				message: 'User with this email or phone already exists'
			});
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		const newUser = new User({
			name,
			email,
			phone,
			password: hashedPassword
		});

		await newUser.save();

		const token = generateToken(newUser._id);
		res.status(201).json({
			message: 'User registered successfully',
			token,
			user: {
				id: newUser._id,
				name: newUser.name,
				email: newUser.email,
				phone: newUser.phone
			}
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Login
router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			return res.status(400).json({
				message: 'Please provide email and password'
			});
		}

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
				email: user.email,
				phone: user.phone,
				role: user.role
			}
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Get Profile Details
router.get('/profile/details', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const user = await User.findById(userId).select('-password').populate('properties');

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		res.status(200).json(user);
	} catch (err) {
		res.status(401).json({ message: err.message });
	}
});

// Update Profile
router.put('/profile/update', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const { name, phone, bio, profilePicture } = req.body;
		const updateData = {};

		if (name) updateData.name = name;
		if (phone) updateData.phone = phone;
		if (bio !== undefined) updateData.bio = bio;
		if (profilePicture) updateData.profilePicture = profilePicture;

		const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true }).select(
			'-password'
		);

		res.status(200).json({
			message: 'Profile updated successfully',
			user: updatedUser
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Get User's Properties (for owner)
router.get('/my-properties', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const properties = await Property.find({ owner: userId }).sort({ createdAt: -1 });

		res.status(200).json(properties);
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Get User's Bookings
router.get('/my-bookings', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const bookings = await Booking.find({ user: userId })
			.populate('property')
			.populate('owner', 'name email phone')
			.sort({ createdAt: -1 });

		res.status(200).json(bookings);
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Get Bookings for Owner (properties they own)
router.get('/owner-bookings', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const bookings = await Booking.find({ owner: userId })
			.populate('property')
			.populate('user', 'name email phone')
			.sort({ createdAt: -1 });

		res.status(200).json(bookings);
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

module.exports = router;
