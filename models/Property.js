const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true
		},
		description: {
			type: String,
			default: ''
		},
		price: {
			type: Number,
			required: true,
			min: 0
		},
		address: {
			type: String,
			required: true,
			trim: true
		},
		state_id: String,
		city_id: String,
		pincode: String,
		latitude: Number,
		longitude: Number,
		images: [String],
		amenities: {
			parking: Boolean,
			wifi: Boolean,
			ac: Boolean,
			furnished: Boolean,
			gym: Boolean,
			pool: Boolean,
			kitchen: Boolean,
			washer: Boolean
		},
		bedrooms: {
			type: Number,
			min: 1,
			default: 1
		},
		bathrooms: {
			type: Number,
			min: 1,
			default: 1
		},
		propertyType: {
			type: String,
			enum: ['Apartment', 'Villa', 'PG', 'House', 'Studio'],
			default: 'Apartment'
		},
		area: {
			type: Number,
			min: 0 // in square feet
		},
		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true
		},
		isAvailable: {
			type: Boolean,
			default: true
		},
		rating: {
			type: Number,
			min: 0,
			max: 5,
			default: 0
		},
		reviewsCount: {
			type: Number,
			default: 0
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
propertySchema.index({ owner: 1 });
propertySchema.index({ state_id: 1 });
propertySchema.index({ city_id: 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ propertyType: 1 });
propertySchema.index({ isAvailable: 1 });

module.exports = mongoose.model('Property', propertySchema);
