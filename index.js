const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

const env = process.env.NODE_ENV || 'development';

if (env === 'production') {
	dotenv.config({ path: '.env.prod' });
} else {
	dotenv.config({ path: '.env.dev' });
}

const propertyRoutes = require('./routes/propertyRoutes');
const userRoutes = require('./routes/userRoutes');
const locationRoutes = require('./routes/locationRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const adminRoutes = require('./routes/adminRoutes');
const Property = require('./models/Property');
const User = require('./models/User');
const { uploadDir } = require('./utils/uploadStorage');

const app = express();

app.use(cors({ origin: '*' }));

app.use(express.json());

app.use('/uploads', express.static(uploadDir));

// Health check endpoint
app.get('/api/health', (req, res) => {
	res.status(200).json({ message: 'Server is running' });
});

// Error handler middleware
app.use((err, req, res, next) => {
	console.error('Error:', err);
	const status = err.status || 500;
	const message = err.message || 'Internal Server Error';
	res.status(status).json({ message, error: message });
});

mongoose
	.connect(process.env.MONGO_URI, {
		retryWrites: true,
		w: 'majority'
	})
	.then(async () => {
		console.log('MongoDB connected');
		await Property.updateMany({ status: { $exists: false } }, [
			{ $set: { status: { $cond: ['$isAvailable', 'approved', 'pending'] } } }
		]);
		console.log('Property approval migration completed');

		// Remove legacy null phone values
		await User.updateMany({ $or: [{ phone: null }, { phone: '' }] }, { $unset: { phone: '' } });
		await User.syncIndexes();
		console.log('User phone index migration completed');
	})
	.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/properties', propertyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/admin', adminRoutes);

// Serve the admin dashboard
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get('/admin', (req, res) => {
	res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
	console.log(`\n🚀 Server running on port ${PORT}`);
	console.log(`Environment: ${env}`);
	console.log(`Base URL: http://localhost:${PORT}\n`);

	// Ping the deployed server every 12 minutes to prevent free-tier idle sleep.
	if (env === 'production') {
		const keepAliveUrl =
			process.env.SERVER_URL || process.env.RENDER_EXTERNAL_URL || 'https://rentnest-htu6.onrender.com';
		const healthUrl = `${keepAliveUrl.replace(/\/$/, '')}/api/health`;
		const intervalMs = 13 * 60 * 1000;

		const pingServer = async () => {
			try {
				const response = await fetch(healthUrl, {
					headers: { 'User-Agent': 'HouseOnRent-KeepAlive/1.0' },
					signal: AbortSignal.timeout(10000)
				});

				console.log(`[KeepAlive] ${new Date().toISOString()} - ${response.status} ${healthUrl}`);
			} catch (error) {
				console.error(`[KeepAlive] Ping failed: ${error.message}`);
			}
		};

		// Start after 13 minutes. The health endpoint remains available for Render health checks in the meantime.
		const keepAliveTimer = setInterval(pingServer, intervalMs);
		keepAliveTimer.unref?.();

		console.log(`[KeepAlive] Enabled: pinging ${healthUrl} every 12 minutes`);
	}
});
