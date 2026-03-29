const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const propertyRoutes = require('./routes/propertyRoutes');
const userRoutes = require('./routes/userRoutes');
const locationRoutes = require('./routes/locationRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const path = require('path');
const fs = require('fs');

const env = process.env.NODE_ENV || 'development';

if (env === 'production') {
	dotenv.config({ path: '.env.prod' });
} else {
	dotenv.config({ path: '.env.dev' });
}

const app = express();

app.use(cors({ origin: '*' }));

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir);
}

mongoose
	.connect(process.env.MONGO_URI, {
		retryWrites: true,
		w: 'majority'
	})
	.then(() => console.log('MongoDB connected'))
	.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/properties', propertyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/favorites', favoriteRoutes);

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
	console.log(`\n🚀 Server running on port ${PORT}`);
	console.log(`Environment: ${env}`);
	console.log(`Base URL: http://localhost:${PORT}\n`);
});
