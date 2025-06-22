const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema({
	title: { type: String, required: true },
	description: String,
	price: { type: Number, required: true },
	address: String,
	state_id: Number,
	city_id: Number,
	pincode: String,
	latitude: Number,
	longitude: Number,
	images: [String],
	amenities: {
		parking: Boolean,
		wifi: Boolean,
		ac: Boolean,
		furnished: Boolean
	},
	owner: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true
	},
	createdAt: {
		type: Date,
		default: Date.now
	}
});

module.exports = mongoose.model('House', houseSchema);
