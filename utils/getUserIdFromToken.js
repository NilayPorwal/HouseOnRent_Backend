// utils/getUserIdFromToken.js
const jwt = require('jsonwebtoken');

const getUserIdFromToken = authHeader => {
	if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
	const token = authHeader.split(' ')[1];
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		return decoded.id;
	} catch (err) {
		if (err.name === 'TokenExpiredError') {
			throw new Error('Token expired');
		}
		throw new Error('Invalid token');
	}
};

module.exports = getUserIdFromToken;
