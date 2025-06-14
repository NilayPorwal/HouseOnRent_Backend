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
		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			required: true
		}
	},
	{ timestamps: true }
);

module.exports = mongoose.model('House', houseSchema);
