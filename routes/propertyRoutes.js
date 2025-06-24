const express = require('express');
const Property = require('../models/Property');
const State = require('../models/State');
const City = require('../models/City');
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

// Get all properties
router.get('/', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}
		const properties = await Property.find().populate('owner', 'name email').sort({ createdAt: -1 }).lean();

		if (!properties.length) {
			return res.status(404).json({ message: 'No properties found' });
		}

		const stateMap = await State.find({}, '_id name').then(states => {
			return states.reduce((acc, state) => {
				acc[state._id] = state.name;
				return acc;
			}, {});
		});

		const cityMap = await City.find({}, '_id name').then(cities => {
			return cities.reduce((acc, city) => {
				acc[city._id] = city.name;
				return acc;
			}, {});
		});

		const enriched = properties.map(p => ({
			...p,
			state_name: stateMap[p.state_id] || null,
			city_name: cityMap[p.city_id] || null
		}));
		res.status(200).json(enriched);
	} catch (err) {
		res.status(401).json({ error: err.message });
	}
});

// Add new properties
router.post('/add', upload.array('images', 5), async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}
		const { title, description, price, address, amenities, city, state } = req.body;

		const imagePaths = req.files.map(file => `/uploads/${file.filename}`);

		if (!title || !price || !address || imagePaths.length === 0) {
			return res.status(400).json({ message: 'Missing required fields' });
		}

		const parsedAmenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
		const newProperty = new Property({
			title,
			description,
			price,
			address,
			state_id: state,
			city_id: city,
			amenities: parsedAmenities || {},
			images: imagePaths,
			owner: userId
		});

		await newProperty.save();
		res.status(200).json({ message: 'Property added successfully', property: newProperty });
	} catch (err) {
		res.status(401).json({ message: err.message });
	}
});

// Get single property by ID
router.get('/:id', async (req, res) => {
	try {
		const property = await Property.findById(req.params.id).populate('owner', 'name email');
		if (!property) return res.status(404).json({ message: 'Property not found' });
		res.json(property);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Delete Property
router.delete('/:id', async (req, res) => {
	try {
		const deleted = await Property.findByIdAndDelete(req.params.id);
		if (!deleted) return res.status(404).json({ message: 'Property not found' });
		res.json({ message: 'Property deleted successfully' });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

router.post('/search', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers?.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}
		const { location } = req.body;
		if (!location) {
			return res.status(400).json({ message: 'Location query parameter is required' });
		}

		const states = await State.find({ name: { $regex: location, $options: 'i' } }, '_id name');
		const cities = await City.find({ name: { $regex: location, $options: 'i' } }, '_id name');

		const stateIds = states.map(s => s._id);
		const cityIds = cities.map(c => c._id);

		const matchedProperties = await Property.find({
			$or: [
				{ state_id: { $in: stateIds } },
				{ city_id: { $in: cityIds } },
				{ address: { $regex: location, $options: 'i' } }
			]
		})
			.populate('owner', 'name email')
			.sort({ createdAt: -1 })
			.lean();

		const stateMap = states.reduce((acc, state) => {
			acc[state._id] = state.name;
			return acc;
		}, {});

		const cityMap = cities.reduce((acc, city) => {
			acc[city._id] = city.name;
			return acc;
		}, {});

		const enriched = matchedProperties.map(p => ({
			...p,
			state_name: stateMap[p.state_id] || null,
			city_name: cityMap[p.city_id] || null
		}));

		res.status(200).json(enriched);
	} catch (err) {
		res.status(400).json({ message: 'Failed to search properties' });
	}
});

module.exports = router;
