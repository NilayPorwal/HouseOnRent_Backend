const express = require('express');
const House = require('../models/House');
const multer = require('multer');
const getUserIdFromToken = require('../utils/getUserIdFromToken');
const router = express.Router();

// Multer setup for image upload
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, 'uploads/');
	},
	filename: function (req, file, cb) {
		cb(null, Date.now() + '-' + file.originalname);
	}
});
const upload = multer({ storage: storage });

// Get all houses
router.get('/', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}
		const houses = await House.find().populate('owner', 'name email');
		res.status(201).json(houses);
	} catch (err) {
		res.status(401).json({ error: err.message });
	}
});

// Add new house
router.post('/add', upload.array('images', 5), async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}
		const { title, description, price, location, amenities } = req.body;

		const imagePaths = req.files.map(file => `/uploads/${file.filename}`);

		if (!title || !price || !location || imagePaths.length === 0) {
			return res.status(400).json({ message: 'Missing required fields' });
		}

		const parsedAmenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
		const newHouse = new House({
			title,
			description,
			price,
			location,
			amenities: parsedAmenities || {},
			images: imagePaths,
			owner: userId
		});

		await newHouse.save();
		res.status(201).json({ message: 'Property added successfully', house: newHouse });
	} catch (err) {
		res.status(401).json({ message: err.message });
	}
});

// Get single house by ID
router.get('/:id', async (req, res) => {
	try {
		const house = await House.findById(req.params.id).populate('owner', 'name email');
		if (!house) return res.status(404).json({ message: 'House not found' });
		res.json(house);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Delete house
router.delete('/:id', async (req, res) => {
	try {
		const deleted = await House.findByIdAndDelete(req.params.id);
		if (!deleted) return res.status(404).json({ message: 'House not found' });
		res.json({ message: 'House deleted successfully' });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

module.exports = router;
