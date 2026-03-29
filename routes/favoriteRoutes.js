const express = require('express');
const Favourite = require('../models/Favourite');
const Property = require('../models/Property');
const User = require('../models/User');
const State = require('../models/State');
const City = require('../models/City');
const getUserIdFromToken = require('../utils/getUserIdFromToken');
const router = express.Router();

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
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Get All Favorites
router.get('/all/favourite', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const favourites = await Favourite.find({ user: userId })
			.populate({
				path: 'property',
				populate: { path: 'owner', select: 'name email phone' }
			})
			.sort({ addedAt: -1 });

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

		const enrichedFavourites = favourites.map(fav => ({
			...fav.property.toObject(),
			state_name: stateMap[fav.property.state_id] || null,
			city_name: cityMap[fav.property.city_id] || null,
			isFavourite: true
		}));

		res.status(200).json(enrichedFavourites);
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Get Favorites Count
router.get('/count', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const count = await Favourite.countDocuments({ user: userId });

		res.status(200).json({ count });
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Check if Property is Favorited
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
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

module.exports = router;
