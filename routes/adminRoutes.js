const express = require('express');
const Property = require('../models/Property');
const User = require('../models/User');
const Booking = require('../models/Booking');
const State = require('../models/State');
const City = require('../models/City');
const Favourite = require('../models/Favourite');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
router.use(adminAuth);

router.get('/stats', async (req, res) => {
	try {
		const [
			totalProperties,
			pendingProperties,
			approvedProperties,
			rejectedProperties,
			totalUsers,
			totalBookings,
			recentProperties
		] = await Promise.all([
			Property.countDocuments(),
			Property.countDocuments({ status: 'pending' }),
			Property.countDocuments({ status: 'approved' }),
			Property.countDocuments({ status: 'rejected' }),
			User.countDocuments(),
			Booking.countDocuments(),
			Property.find()
				.populate('owner', 'name email phone')
				.populate('reviewedBy', 'name email')
				.sort({ createdAt: -1 })
				.limit(8)
				.lean()
		]);

		res.json({
			stats: { totalProperties, pendingProperties, approvedProperties, rejectedProperties, totalUsers, totalBookings },
			recentProperties
		});
	} catch (err) {
		res.status(500).json({ message: 'Failed to load dashboard statistics', error: err.message });
	}
});

router.get('/properties', async (req, res) => {
	try {
		const status =
			req.query.status && ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null;
		const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
		const limit = 15;
		const filter = status ? { status } : {};
		const search = (req.query.search || '').trim();
		if (search) {
			filter.$or = [
				{ title: { $regex: search, $options: 'i' } },
				{ address: { $regex: search, $options: 'i' } },
				{ propertyCode: { $regex: search, $options: 'i' } }
			];
		}

		const [properties, total] = await Promise.all([
			Property.find(filter)
				.populate('owner', 'name email phone')
				.populate('reviewedBy', 'name email')
				.sort({ createdAt: -1 })
				.skip((page - 1) * limit)
				.limit(limit)
				.lean(),
			Property.countDocuments(filter)
		]);

		const stateIds = [...new Set(properties.map(property => property.state_id).filter(Boolean))];
		const cityIds = [...new Set(properties.map(property => property.city_id).filter(Boolean))];
		const [states, cities] = await Promise.all([
			State.find({ _id: { $in: stateIds } }, '_id name').lean(),
			City.find({ _id: { $in: cityIds } }, '_id name').lean()
		]);
		const stateMap = Object.fromEntries(states.map(state => [String(state._id), state.name]));
		const cityMap = Object.fromEntries(cities.map(city => [String(city._id), city.name]));

		const enrichedProperties = properties.map(property => ({
			...property,
			state_name: stateMap[String(property.state_id)] || null,
			city_name: cityMap[String(property.city_id)] || null
		}));

		res.json({ properties: enrichedProperties, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
	} catch (err) {
		res.status(500).json({ message: 'Failed to load properties', error: err.message });
	}
});

router.patch('/properties/:id/status', async (req, res) => {
	try {
		const { status, rejectionReason = '' } = req.body;
		if (!['approved', 'rejected'].includes(status)) {
			return res.status(400).json({ message: 'Status must be approved or rejected' });
		}

		const property = await Property.findById(req.params.id);
		if (!property) {
			return res.status(404).json({ message: 'Property not found' });
		}

		property.status = status;
		property.isAvailable = status === 'approved';
		property.rejectionReason = status === 'rejected' ? rejectionReason.trim() : '';
		property.reviewedBy = req.admin._id;
		property.reviewedAt = new Date();
		await property.save();

		res.json({ message: `Property ${status} successfully`, property });
	} catch (err) {
		res.status(500).json({ message: 'Failed to update property status', error: err.message });
	}
});

router.get('/users', async (req, res) => {
	try {
		const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
		const limit = 15;
		const search = (req.query.search || '').trim();
		const filter = {};
		if (search) {
			filter.$or = [
				{ name: { $regex: search, $options: 'i' } },
				{ email: { $regex: search, $options: 'i' } },
				{ phone: { $regex: search, $options: 'i' } }
			];
		}

		const [users, total] = await Promise.all([
			User.find(filter)
				.select('_id name email phone profilePicture role isVerified createdAt')
				.sort({ role: 1, createdAt: -1 })
				.lean(),
			User.countDocuments(filter)
		]);

		const orderedUsers = users.sort((a, b) => {
			if (a.role === 'admin' && b.role !== 'admin') return -1;
			if (a.role !== 'admin' && b.role === 'admin') return 1;
			return new Date(b.createdAt) - new Date(a.createdAt);
		});
		const paginatedUsers = orderedUsers.slice((page - 1) * limit, page * limit);

		res.json({
			users: paginatedUsers,
			pagination: { page, limit, total, pages: Math.ceil(total / limit) }
		});
	} catch (err) {
		res.status(500).json({ message: 'Failed to load users', error: err.message });
	}
});

router.delete('/users/:id', async (req, res) => {
	try {
		if (req.params.id === req.admin._id.toString()) {
			return res.status(400).json({ message: 'You cannot delete your own admin account' });
		}
		const user = await User.findById(req.params.id);
		if (!user) return res.status(404).json({ message: 'User not found' });

		await Promise.all([
			Favourite.deleteMany({ user: user._id }),
			Booking.deleteMany({ $or: [{ user: user._id }, { owner: user._id }] }),
			Property.deleteMany({ owner: user._id })
		]);
		await User.findByIdAndDelete(user._id);
		res.json({ message: 'User and associated records deleted successfully' });
	} catch (err) {
		res.status(500).json({ message: 'Failed to delete user', error: err.message });
	}
});

module.exports = router;
