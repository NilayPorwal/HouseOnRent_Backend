const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
	{
		name: {
			type: String,
			required: true,
			trim: true
		},
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true
		},
		phone: {
			type: String,
			required: false,
			unique: true,
			sparse: true,
			trim: true
		},
		password: {
			type: String,
			required: false,
			minlength: 6
		},
		profilePicture: {
			type: String,
			default: null
		},
		role: {
			type: String,
			enum: ['user', 'owner', 'admin'],
			default: 'user'
		},
		bio: {
			type: String,
			default: ''
		},
		isVerified: {
			type: Boolean,
			default: false
		},
		properties: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: 'Property'
			}
		]
	},
	{ timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
