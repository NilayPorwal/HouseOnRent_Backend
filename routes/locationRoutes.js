const express = require('express');
const getUserIdFromToken = require('../utils/getUserIdFromToken');
const State = require('../models/State');
const City = require('../models/City');
const router = express.Router();

// Get all states
router.get('/states', async (req, res) => {
	try {
		const states = await State.find({}, 'name _id').sort('name');
		res.status(200).json(states);
	} catch (err) {
		res.status(500).json({ message: 'Failed to fetch states' });
	}
});

// Get cities by state ID
router.get('/cities/:stateId', async (req, res) => {
	try {
		const stateId = parseInt(req.params.stateId);
		const cities = await City.find({ state_id: stateId }, 'name _id').sort('name');
		res.status(200).json(cities);
	} catch (err) {
		res.status(500).json({ message: 'Failed to fetch cities' });
	}
});

module.exports = router;
