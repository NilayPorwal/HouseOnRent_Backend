const express = require('express');
const Property = require('../models/Property');
const State = require('../models/State');
const City = require('../models/City');
const User = require('../models/User');
const Favourite = require('../models/Favourite');
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

// Get all properties with filters and pagination
router.get('/', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		// Pagination
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		// Filters
		const filters = {};

		if (req.query.priceMin || req.query.priceMax) {
			filters.price = {};
			if (req.query.priceMin) filters.price.$gte = parseInt(req.query.priceMin);
			if (req.query.priceMax) filters.price.$lte = parseInt(req.query.priceMax);
		}

		if (req.query.propertyType) {
			filters.propertyType = req.query.propertyType;
		}

		if (req.query.bedrooms) {
			filters.bedrooms = parseInt(req.query.bedrooms);
		}

		if (req.query.state) {
			filters.state_id = req.query.state;
		}

		if (req.query.city) {
			filters.city_id = req.query.city;
		}

		if (req.query.search) {
			filters.$or = [
				{ title: { $regex: req.query.search, $options: 'i' } },
				{ address: { $regex: req.query.search, $options: 'i' } },
				{ description: { $regex: req.query.search, $options: 'i' } }
			];
		}

		filters.isAvailable = true;

		// Get total count
		const total = await Property.countDocuments(filters);

		// Get properties
		const properties = await Property.find(filters)
			.populate('owner', 'name email phone')
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean();

		if (!properties.length) {
			return res.status(200).json({
				message: 'No properties found',
				data: [],
				pagination: { page, limit, total, pages: 0 }
			});
		}

		// Get favorites
		const favourites = await Favourite.find({ user: userId }, 'property');
		const favSet = new Set(favourites.map(f => f.property.toString()));

		// Get state and city names
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
			city_name: cityMap[p.city_id] || null,
			isFavourite: favSet.has(p._id.toString())
		}));

		res.status(200).json({
			data: enriched,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit)
			}
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Add new property
router.post('/add', upload.array('images', 5), async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const { title, description, price, address, amenities, city, state, bedrooms, bathrooms, propertyType, area } =
			req.body;

		// Validation
		if (!title || !price || !address) {
			return res.status(400).json({ message: 'title, price, and address are required' });
		}

		if (!req.files || req.files.length === 0) {
			return res.status(400).json({ message: 'At least one image is required' });
		}

		const imagePaths = req.files.map(file => `/uploads/${file.filename}`);
		const parsedAmenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;

		const newProperty = new Property({
			title: title.trim(),
			description: description || '',
			price: parseInt(price),
			address: address.trim(),
			state_id: state || null,
			city_id: city || null,
			bedrooms: parseInt(bedrooms) || 1,
			bathrooms: parseInt(bathrooms) || 1,
			propertyType: propertyType || 'Apartment',
			area: area ? parseInt(area) : null,
			amenities: parsedAmenities || {},
			images: imagePaths,
			owner: userId
		});

		await newProperty.save();

		const populatedProperty = await Property.findById(newProperty._id).populate('owner', 'name email phone');

		res.status(201).json({
			message: 'Property added successfully',
			property: populatedProperty
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Get single property by ID
router.get('/:id', async (req, res) => {
	try {
		const property = await Property.findById(req.params.id).populate('owner', 'name email phone');

		if (!property) {
			return res.status(404).json({ message: 'Property not found' });
		}

		const state = await State.findOne({ _id: property.state_id });
		const city = await City.findOne({ _id: property.city_id });

		const enriched = {
			...property.toObject(),
			state_name: state?.name || null,
			city_name: city?.name || null
		};

		res.status(200).json(enriched);
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Update Property
router.put('/:id', upload.array('images', 5), async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const property = await Property.findById(req.params.id);
		if (!property) {
			return res.status(404).json({ message: 'Property not found' });
		}

		// Check ownership
		if (property.owner.toString() !== userId) {
			return res.status(403).json({ message: 'Not authorized to update this property' });
		}

		const {
			title,
			description,
			price,
			address,
			amenities,
			city,
			state,
			bedrooms,
			bathrooms,
			propertyType,
			area,
			isAvailable
		} = req.body;

		if (title) property.title = title.trim();
		if (description) property.description = description;
		if (price) property.price = parseInt(price);
		if (address) property.address = address.trim();
		if (bedrooms) property.bedrooms = parseInt(bedrooms);
		if (bathrooms) property.bathrooms = parseInt(bathrooms);
		if (propertyType) property.propertyType = propertyType;
		if (area) property.area = parseInt(area);
		if (city) property.city_id = city;
		if (state) property.state_id = state;
		if (amenities) property.amenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
		if (isAvailable !== undefined) property.isAvailable = isAvailable;

		if (req.files && req.files.length > 0) {
			const newImages = req.files.map(file => `/uploads/${file.filename}`);
			property.images = newImages;
		}

		await property.save();

		const updatedProperty = await Property.findById(property._id).populate('owner', 'name email phone');

		res.status(200).json({
			message: 'Property updated successfully',
			property: updatedProperty
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Delete Property
router.delete('/:id', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const property = await Property.findById(req.params.id);
		if (!property) {
			return res.status(404).json({ message: 'Property not found' });
		}

		// Check ownership
		if (property.owner.toString() !== userId) {
			return res.status(403).json({ message: 'Not authorized to delete this property' });
		}

		// Delete associated favorites
		await Favourite.deleteMany({ property: req.params.id });

		await Property.findByIdAndDelete(req.params.id);

		res.status(200).json({ message: 'Property deleted successfully' });
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Search property
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
			],
			isAvailable: true
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
		res.status(500).json({ message: 'Failed to search properties', error: err.message });
	}
});

// Get Featured Properties
router.get('/featured', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const featured = await Property.find({ isAvailable: true })
			.populate('owner', 'name email phone')
			.sort({ rating: -1, reviewsCount: -1 })
			.limit(5)
			.lean();

		const favourites = await Favourite.find({ user: userId }, 'property');
		const favSet = new Set(favourites.map(f => f.property.toString()));

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

		const enriched = featured.map(p => ({
			...p,
			state_name: stateMap[p.state_id] || null,
			city_name: cityMap[p.city_id] || null,
			isFavourite: favSet.has(p._id.toString())
		}));

		res.status(200).json(enriched);
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

module.exports = router;
