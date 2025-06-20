const mongoose = require('mongoose');

const houseSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true
		},
		description: String,
		price: {
			type: Number,
			required: true
		},
		location: String,
		images: [String],
		amenities: {
			wifi: { type: Boolean, default: false },
			parking: { type: Boolean, default: false },
			ac: { type: Boolean, default: false }
		},
		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true
		}
	},
	{ timestamps: true }
);

module.exports = mongoose.model('House', houseSchema);
