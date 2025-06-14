// house-rent-backend/app.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const houseRoutes = require('./routes/houseRoutes');
const userRoutes = require('./routes/userRoutes');

dotenv.config();
const app = express();

app.use(express.json());

mongoose
	.connect(process.env.MONGO_URI, {
		useNewUrlParser: true,
		useUnifiedTopology: true
	})
	.then(() => console.log('MongoDB connected'))
	.catch(err => console.error(err));

app.use('/api/houses', houseRoutes);
app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
