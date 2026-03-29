const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true
		},
		property: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Property',
			required: true
		},
		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true
		},
		checkInDate: {
			type: Date,
			required: true
		},
		checkOutDate: {
			type: Date,
			required: true
		},
		totalGuests: {
			type: Number,
			min: 1,
			required: true
		},
		totalPrice: {
			type: Number,
			required: true,
			min: 0
		},
		status: {
			type: String,
			enum: ['pending', 'confirmed', 'cancelled', 'completed'],
			default: 'pending'
		},
		bookingNotes: {
			type: String,
			default: ''
		},
		paymentMethod: {
			type: String,
			enum: ['upi', 'card', 'netbanking', 'wallet'],
			default: 'upi'
		},
		paymentStatus: {
			type: String,
			enum: ['pending', 'completed', 'failed', 'refunded'],
			default: 'pending'
		},
		cancellationReason: {
			type: String,
			default: null
		},
		rating: {
			type: Number,
			min: 0,
			max: 5,
			default: null
		},
		review: {
			type: String,
			default: null
		},
		createdAt: {
			type: Date,
			default: Date.now
		},
		updatedAt: {
			type: Date,
			default: Date.now
		}
	},
	{ timestamps: true }
);

// Index for better query performance
bookingSchema.index({ user: 1 });
bookingSchema.index({ property: 1 });
bookingSchema.index({ owner: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ checkInDate: 1, checkOutDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
