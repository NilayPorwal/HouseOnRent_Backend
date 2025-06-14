const express = require('express');
const House = require('../models/House');
const router = express.Router();

// Get all houses
router.get('/', async (req, res) => {
	try {
		const houses = await House.find().populate('owner', 'name email');
		res.json(houses);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Add new house
router.post('/', async (req, res) => {
	try {
		const house = new House(req.body);
		await house.save();
		res.status(201).json(house);
	} catch (err) {
		res.status(500).json({ error: err.message });
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
