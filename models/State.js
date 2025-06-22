const mongoose = require('mongoose');

const stateSchema = new mongoose.Schema({
	_id: Number,
	name: String,
	country_id: Number,
	country_code: String,
	country_name: String,
	state_code: String,
	type: String,
	latitude: Number,
	longitude: Number
});

module.exports = mongoose.model('State', stateSchema);
