// models/Favourite.js
const mongoose = require('mongoose');

const favouriteSchema = new mongoose.Schema({
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
	addedAt: {
		type: Date,
		default: Date.now
	}
});

favouriteSchema.index({ user: 1, property: 1 }, { unique: true }); // prevent duplicates

module.exports = mongoose.model('Favourite', favouriteSchema);
