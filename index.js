// house-rent-backend/app.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const houseRoutes = require('./routes/houseRoutes');
const userRoutes = require('./routes/userRoutes');
const locationRoutes = require('./routes/locationRoutes');
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
		useNewUrlParser: true,
		useUnifiedTopology: true
	})
	.then(() => console.log('MongoDB connected'))
	.catch(err => console.error(err));

app.use('/api/houses', houseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/location', locationRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
