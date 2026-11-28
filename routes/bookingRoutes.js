const express = require('express');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const User = require('../models/User');
const getUserIdFromToken = require('../utils/getUserIdFromToken');
const router = express.Router();

// Create Booking
router.post('/create', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const { propertyId, checkInDate, checkOutDate, totalGuests, bookingNotes } = req.body;

		// Validation
		if (!propertyId || !checkInDate || !checkOutDate || !totalGuests) {
			return res.status(400).json({
				message: 'Please provide propertyId, checkInDate, checkOutDate, and totalGuests'
			});
		}

		const propertyObj = await Property.findById(propertyId);
		if (!propertyObj) {
			return res.status(404).json({ message: 'Property not found' });
		}

		if (!propertyObj.isAvailable || propertyObj.status !== 'approved') {
			return res.status(400).json({ message: 'Property is not available for booking' });
		}

		// Check for date conflicts
		const bookingConflict = await Booking.findOne({
			property: propertyId,
			status: { $in: ['pending', 'confirmed'] },
			$or: [{ checkInDate: { $lt: new Date(checkOutDate) }, checkOutDate: { $gt: new Date(checkInDate) } }]
		});

		if (bookingConflict) {
			return res.status(400).json({ message: 'Property is already booked for these dates' });
		}

		const checkIn = new Date(checkInDate);
		const checkOut = new Date(checkOutDate);
		const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

		if (nights < 1) {
			return res.status(400).json({ message: 'Check-out date must be after check-in date' });
		}

		const totalPrice = propertyObj.price * nights;

		const newBooking = new Booking({
			user: userId,
			property: propertyId,
			owner: propertyObj.owner,
			checkInDate: new Date(checkInDate),
			checkOutDate: new Date(checkOutDate),
			totalGuests,
			totalPrice,
			bookingNotes: bookingNotes || ''
		});

		await newBooking.save();

		const populatedBooking = await Booking.findById(newBooking._id)
			.populate('property')
			.populate('user', 'name email phone')
			.populate('owner', 'name email phone');

		res.status(201).json({
			message: 'Booking created successfully',
			booking: populatedBooking
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Get Booking by ID
router.get('/:id', async (req, res) => {
	try {
		const booking = await Booking.findById(req.params.id)
			.populate('property')
			.populate('user', 'name email phone')
			.populate('owner', 'name email phone');

		if (!booking) {
			return res.status(404).json({ message: 'Booking not found' });
		}

		res.status(200).json(booking);
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Update Booking Status (Cancel, Confirm)
router.put('/:id/status', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const { status, cancellationReason } = req.body;

		if (!['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
			return res.status(400).json({ message: 'Invalid status' });
		}

		const booking = await Booking.findById(req.params.id);
		if (!booking) {
			return res.status(404).json({ message: 'Booking not found' });
		}

		// Only owner or admin can update booking status
		if (booking.owner.toString() !== userId && booking.user.toString() !== userId) {
			return res.status(403).json({ message: 'Not authorized' });
		}

		booking.status = status;
		if (status === 'cancelled' && cancellationReason) {
			booking.cancellationReason = cancellationReason;
		}

		await booking.save();

		const updatedBooking = await Booking.findById(booking._id)
			.populate('property')
			.populate('user', 'name email phone')
			.populate('owner', 'name email phone');

		res.status(200).json({
			message: 'Booking status updated successfully',
			booking: updatedBooking
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Add Review to Booking
router.put('/:id/review', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const { rating, review } = req.body;

		if (!rating || rating < 0 || rating > 5) {
			return res.status(400).json({ message: 'Rating must be between 0 and 5' });
		}

		const booking = await Booking.findById(req.params.id);
		if (!booking) {
			return res.status(404).json({ message: 'Booking not found' });
		}

		if (booking.user.toString() !== userId) {
			return res.status(403).json({ message: 'Only booking user can add review' });
		}

		booking.rating = rating;
		booking.review = review;

		await booking.save();

		// Update property rating
		const allBookingForProperty = await Booking.find({
			property: booking.property,
			rating: { $ne: null }
		});

		if (allBookingForProperty.length > 0) {
			const avgRating = allBookingForProperty.reduce((sum, b) => sum + b.rating, 0) / allBookingForProperty.length;
			await Property.findByIdAndUpdate(booking.property, {
				rating: avgRating,
				reviewsCount: allBookingForProperty.length
			});
		}

		const updatedBooking = await Booking.findById(booking._id)
			.populate('property')
			.populate('user', 'name email phone')
			.populate('owner', 'name email phone');

		res.status(200).json({
			message: 'Review added successfully',
			booking: updatedBooking
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Cancel Booking
router.put('/:id/cancel', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const { cancellationReason } = req.body;

		const booking = await Booking.findById(req.params.id);
		if (!booking) {
			return res.status(404).json({ message: 'Booking not found' });
		}

		if (booking.user.toString() !== userId) {
			return res.status(403).json({ message: 'Not authorized to cancel this booking' });
		}

		if (booking.status !== 'pending' && booking.status !== 'confirmed') {
			return res.status(400).json({ message: 'Cannot cancel this booking' });
		}

		booking.status = 'cancelled';
		booking.cancellationReason = cancellationReason || 'User cancelled';
		booking.paymentStatus = 'refunded';

		await booking.save();

		const updatedBooking = await Booking.findById(booking._id)
			.populate('property')
			.populate('user', 'name email phone')
			.populate('owner', 'name email phone');

		res.status(200).json({
			message: 'Booking cancelled successfully',
			booking: updatedBooking
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Check Availability
router.post('/check-availability', async (req, res) => {
	try {
		const { propertyId, checkInDate, checkOutDate } = req.body;

		if (!propertyId || !checkInDate || !checkOutDate) {
			return res.status(400).json({
				message: 'Please provide propertyId, checkInDate, and checkOutDate'
			});
		}

		const conflictingBooking = await Booking.findOne({
			property: propertyId,
			status: { $in: ['pending', 'confirmed'] },
			$or: [{ checkInDate: { $lt: new Date(checkOutDate) }, checkOutDate: { $gt: new Date(checkInDate) } }]
		});

		res.status(200).json({
			available: !conflictingBooking,
			conflictingDates: conflictingBooking
				? {
						checkInDate: conflictingBooking.checkInDate,
						checkOutDate: conflictingBooking.checkOutDate
					}
				: null
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

module.exports = router;
