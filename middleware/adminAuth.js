const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function adminAuth(req, res, next) {
	try {
		const authorization = req.headers.authorization;
		if (!authorization || !authorization.startsWith('Bearer ')) {
			return res.status(401).json({ message: 'Admin authentication required' });
		}

		const decoded = jwt.verify(authorization.split(' ')[1], process.env.JWT_SECRET);
		const user = await User.findById(decoded.id).select('_id name email role');
		if (!user) {
			return res.status(401).json({ message: 'Invalid admin session' });
		}
		if (user.role !== 'admin') {
			return res.status(403).json({ message: 'Admin access required' });
		}

		req.admin = user;
		next();
	} catch (err) {
		return res.status(401).json({ message: 'Invalid or expired admin session' });
	}
};
