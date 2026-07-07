const express = require('express');
const Favourite = require('../models/Favourite');
const Property = require('../models/Property');
const User = require('../models/User');
const State = require('../models/State');
const City = require('../models/City');
const getUserIdFromToken = require('../utils/getUserIdFromToken');
const router = express.Router();

// Get All Favorites (must be before parameterized routes)
router.get('/all/favourite', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const favourites = await Favourite.find({ user: userId }).populate('property').sort({ addedAt: -1 });

		// Fetch states and cities
		const [states, cities] = await Promise.all([State.find({}, '_id name'), City.find({}, '_id name')]);

		const stateMap = states.reduce((acc, state) => {
			acc[state._id.toString()] = state.name;
			return acc;
		}, {});

		const cityMap = cities.reduce((acc, city) => {
			acc[city._id.toString()] = city.name;
			return acc;
		}, {});

		const enrichedFavourites = favourites
			.filter(fav => fav.property) // Filter out null properties (deleted properties)
			.map(fav => {
				const propObj = fav.property.toObject ? fav.property.toObject() : fav.property;
				return {
					...propObj,
					state_name: stateMap[fav.property.state_id?.toString()] || null,
					city_name: cityMap[fav.property.city_id?.toString()] || null,
					isFavourite: true
				};
			});

		res.status(200).json(enrichedFavourites);
	} catch (err) {
		console.error('Error in /all/favourite:', err);
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Get Favorites Count (must be before parameterized routes)
router.get('/count', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const count = await Favourite.countDocuments({ user: userId });

		res.status(200).json({ count });
	} catch (err) {
		console.error('Error in /count:', err);
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Check if Property is Favorited (must be before general /:propertyId routes)
router.get('/:propertyId/is-favourite', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const { propertyId } = req.params;

		const favourite = await Favourite.findOne({ user: userId, property: propertyId });

		res.status(200).json({
			isFavourite: !!favourite
		});
	} catch (err) {
		console.error('Error in /is-favourite:', err);
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Add to Favorites
router.post('/:propertyId', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const { propertyId } = req.params;

		const property = await Property.findById(propertyId);
		if (!property) {
			return res.status(404).json({ message: 'Property not found' });
		}

		// Check if already in favorites
		const existing = await Favourite.findOne({ user: userId, property: propertyId });
		if (existing) {
			return res.status(400).json({ message: 'Property already in favorites' });
		}

		const favourite = new Favourite({
			user: userId,
			property: propertyId
		});

		await favourite.save();

		res.status(201).json({
			message: 'Property added to favorites',
			favourite
		});
	} catch (err) {
		console.error('Error in POST /:propertyId:', err);
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Remove from Favorites
router.delete('/:propertyId', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const { propertyId } = req.params;

		const result = await Favourite.findOneAndDelete({
			user: userId,
			property: propertyId
		});

		if (!result) {
			return res.status(404).json({ message: 'Favorite not found' });
		}

		res.status(200).json({
			message: 'Property removed from favorites'
		});
	} catch (err) {
		console.error('Error in DELETE /:propertyId:', err);
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

module.exports = router;
