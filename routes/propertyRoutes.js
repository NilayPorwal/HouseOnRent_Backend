const express = require('express');
const Property = require('../models/Property');
const State = require('../models/State');
const City = require('../models/City');
const User = require('../models/User');
const Favourite = require('../models/Favourite');
const multer = require('multer');
const getUserIdFromToken = require('../utils/getUserIdFromToken');
const router = express.Router();

// Multer setup for image upload
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, 'uploads/');
	},
	filename: function (req, file, cb) {
		cb(null, Date.now() + '-' + file.originalname);
	}
});
const upload = multer({ storage: storage });

// Get all properties with filters and pagination
router.get('/', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		// Pagination
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		// Filters
		const filters = {};

		if (req.query.priceMin || req.query.priceMax) {
			filters.price = {};
			if (req.query.priceMin) filters.price.$gte = parseInt(req.query.priceMin);
			if (req.query.priceMax) filters.price.$lte = parseInt(req.query.priceMax);
		}

		if (req.query.propertyType) {
			filters.propertyType = req.query.propertyType;
		}

		if (req.query.bedrooms) {
			filters.bedrooms = parseInt(req.query.bedrooms);
		}

		if (req.query.state) {
			filters.state_id = req.query.state;
		}

		if (req.query.city) {
			filters.city_id = req.query.city;
		}

		if (req.query.search) {
			filters.$or = [
				{ title: { $regex: req.query.search, $options: 'i' } },
				{ address: { $regex: req.query.search, $options: 'i' } },
				{ description: { $regex: req.query.search, $options: 'i' } }
			];
		}

		filters.isAvailable = true;
		filters.status = 'approved';

		// Get total count
		const total = await Property.countDocuments(filters);

		// Get properties
		const properties = await Property.find(filters)
			.populate('owner', 'name email phone')
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.lean();

		if (!properties.length) {
			return res.status(200).json({
				message: 'No properties found',
				data: [],
				pagination: { page, limit, total, pages: 0 }
			});
		}

		// Get favorites
		const favourites = await Favourite.find({ user: userId }, 'property');
		const favSet = new Set(favourites.map(f => f.property.toString()));

		// Get state and city names
		const stateMap = await State.find({}, '_id name').then(states => {
			return states.reduce((acc, state) => {
				acc[state._id] = state.name;
				return acc;
			}, {});
		});

		const cityMap = await City.find({}, '_id name').then(cities => {
			return cities.reduce((acc, city) => {
				acc[city._id] = city.name;
				return acc;
			}, {});
		});

		const enriched = properties.map(p => ({
			...p,
			state_name: stateMap[p.state_id] || null,
			city_name: cityMap[p.city_id] || null,
			isFavourite: favSet.has(p._id.toString())
		}));

		res.status(200).json({
			data: enriched,
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit)
			}
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Add new property
router.post('/add', upload.array('images', 5), async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const {
			title,
			description,
			price,
			address,
			amenities,
			city,
			state,
			bedrooms,
			bathrooms,
			propertyType,
			area,
			pincode,
			mobileNumber,
			latitude,
			longitude
		} = req.body;

		// Validation
		if (!title || !price || !address) {
			return res.status(400).json({ message: 'title, price, and address are required' });
		}

		if (!mobileNumber || !/^\d{10}$/.test(mobileNumber.trim())) {
			return res.status(400).json({ message: 'Please provide a valid 10-digit Indian mobile number' });
		}

		if (!req.files || req.files.length === 0) {
			return res.status(400).json({ message: 'At least one image is required' });
		}

		// Validate state and city if provided
		let stateDoc = null;
		if (state) {
			if (isNaN(state)) {
				// If state is a string (name), find by name
				stateDoc = await State.findOne({ name: state });
			} else {
				// If state is a number (id), find by id
				stateDoc = await State.findById(parseInt(state));
			}
			if (!stateDoc) {
				return res.status(400).json({ message: `State not found` });
			}
		}
		let cityDoc = null;
		if (city) {
			if (isNaN(city)) {
				// If city is a string (name), find by name
				cityDoc = await City.findOne({ name: city });
			} else {
				// If city is a number (id), find by id
				cityDoc = await City.findById(parseInt(city));
			}
			if (!cityDoc) {
				return res.status(400).json({ message: `City not found` });
			}

			// Verify that city belongs to the selected state (if state is provided)
			if (stateDoc && cityDoc.state_id !== stateDoc._id) {
				return res.status(400).json({ message: 'City does not belong to the selected state' });
			}
		}

		const imagePaths = req.files.map(file => `/uploads/${file.filename}`);
		const parsedAmenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;

		let propertyCode = null;
		if (stateDoc && cityDoc) {
			const serialInCity = (await Property.countDocuments({ city_id: cityDoc._id })) + 1;
			const stateCodePart = stateDoc.state_code || stateDoc._id;
			propertyCode = `${stateCodePart}${cityDoc._id}-${serialInCity}`;
		}

		const newProperty = new Property({
			title: title.trim(),
			description: description || '',
			price: parseInt(price),
			address: address.trim(),
			state_id: stateDoc ? stateDoc._id : null,
			city_id: cityDoc ? cityDoc._id : null,
			propertyCode,
			pincode: pincode || null,
			mobileNumber: mobileNumber.trim(),
			latitude: latitude ? parseFloat(latitude) : null,
			longitude: longitude ? parseFloat(longitude) : null,
			bedrooms: parseInt(bedrooms) || 1,
			bathrooms: parseInt(bathrooms) || 1,
			propertyType: propertyType || 'Apartment',
			area: area ? parseInt(area) : null,
			amenities: parsedAmenities || {},
			images: imagePaths,
			owner: userId,
			status: 'pending',
			isAvailable: false,
			rejectionReason: '',
			reviewedBy: null,
			reviewedAt: null
		});

		await newProperty.save();

		const populatedProperty = await Property.findById(newProperty._id).populate('owner', 'name email phone');

		// Fetch state and city names for response
		const stateData = state ? await State.findById(state) : null;
		const cityData = city ? await City.findById(city) : null;

		const enrichedProperty = {
			...populatedProperty.toObject(),
			state_name: stateData?.name || null,
			city_name: cityData?.name || null
		};

		res.status(201).json({
			message: 'Property submitted successfully and is pending admin approval',
			property: enrichedProperty
		});
	} catch (err) {
		console.error('Add Property Error:', err);
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Get single property by ID
router.get('/:id', async (req, res) => {
	try {
		const property = await Property.findById(req.params.id).populate('owner', 'name email phone');

		if (!property || property.status !== 'approved' || !property.isAvailable) {
			return res.status(404).json({ message: 'Property not found' });
		}

		const state = await State.findOne({ _id: property.state_id });
		const city = await City.findOne({ _id: property.city_id });

		const enriched = {
			...property.toObject(),
			state_name: state?.name || null,
			city_name: city?.name || null
		};

		res.status(200).json(enriched);
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Update Property
router.put('/:id', upload.array('images', 5), async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const property = await Property.findById(req.params.id);
		if (!property) {
			return res.status(404).json({ message: 'Property not found' });
		}

		// Check ownership
		if (property.owner.toString() !== userId) {
			return res.status(403).json({ message: 'Not authorized to update this property' });
		}

		const {
			title,
			description,
			price,
			address,
			amenities,
			city,
			state,
			bedrooms,
			bathrooms,
			propertyType,
			area,
			isAvailable,
			pincode,
			mobileNumber,
			removedImages
		} = req.body;

		if (title !== undefined) property.title = title.trim();
		if (description !== undefined) property.description = description || '';
		if (price !== undefined) property.price = parseInt(price);
		if (address !== undefined) property.address = address.trim();
		if (bedrooms !== undefined) property.bedrooms = parseInt(bedrooms);
		if (bathrooms !== undefined) property.bathrooms = parseInt(bathrooms);
		if (propertyType !== undefined) property.propertyType = propertyType;
		if (area !== undefined) property.area = parseInt(area);
		if (pincode !== undefined) property.pincode = pincode || null;
		if (mobileNumber !== undefined) {
			if (!/^\d{10}$/.test(mobileNumber.trim())) {
				return res.status(400).json({ message: 'Please provide a valid 10-digit Indian mobile number' });
			}
			property.mobileNumber = mobileNumber.trim();
		}
		let cityDoc = null;
		let stateDoc = null;
		if (city) {
			if (isNaN(city)) {
				cityDoc = await City.findOne({ name: city });
			} else {
				cityDoc = await City.findById(parseInt(city));
			}
			if (!cityDoc) {
				return res.status(400).json({ message: `City not found` });
			}
			property.city_id = cityDoc._id;
		}
		if (state) {
			if (isNaN(state)) {
				stateDoc = await State.findOne({ name: state });
			} else {
				stateDoc = await State.findById(parseInt(state));
			}
			if (!stateDoc) {
				return res.status(400).json({ message: `State not found` });
			}
			property.state_id = stateDoc._id;
		}
		if ((cityDoc || stateDoc) && property.city_id && property.state_id) {
			const currentState = stateDoc || (await State.findOne({ _id: property.state_id }));
			const currentCity = cityDoc || (await City.findOne({ _id: property.city_id }));
			if (currentState && currentCity) {
				const serialInCity =
					(await Property.countDocuments({
						city_id: currentCity._id,
						_id: { $ne: property._id }
					})) + 1;
				const stateCodePart = currentState.state_code || currentState._id;
				property.propertyCode = `${stateCodePart}${currentCity._id}-${serialInCity}`;
			}
		}
		if (amenities) property.amenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
		if (isAvailable !== undefined) property.isAvailable = isAvailable;

		// Owners cannot publish or unpublish listings directly. Any edit re-enters moderation.
		property.status = 'pending';
		property.isAvailable = false;
		property.rejectionReason = '';
		property.reviewedBy = null;
		property.reviewedAt = null;

		let removedImageList = [];
		if (removedImages) {
			try {
				removedImageList = typeof removedImages === 'string' ? JSON.parse(removedImages) : removedImages;
			} catch (err) {
				removedImageList = [];
			}
		}

		const normalizedRemovedImages = (Array.isArray(removedImageList) ? removedImageList : [])
			.map(img => String(img || '').trim())
			.filter(Boolean);
		const existingImages = Array.isArray(property.images) ? property.images : [];
		const remainingImages = existingImages.filter(img => !normalizedRemovedImages.includes(String(img)));
		const newImages = req.files && req.files.length > 0 ? req.files.map(file => `/uploads/${file.filename}`) : [];
		property.images = [...remainingImages, ...newImages];

		await property.save();

		const updatedProperty = await Property.findById(property._id).populate('owner', 'name email phone');

		res.status(200).json({
			message: 'Property updated successfully',
			property: updatedProperty
		});
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Delete Property
router.delete('/:id', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const property = await Property.findById(req.params.id);
		if (!property) {
			return res.status(404).json({ message: 'Property not found' });
		}

		// Check ownership
		if (property.owner.toString() !== userId) {
			return res.status(403).json({ message: 'Not authorized to delete this property' });
		}

		// Delete associated favorites
		await Favourite.deleteMany({ property: req.params.id });

		await Property.findByIdAndDelete(req.params.id);

		res.status(200).json({ message: 'Property deleted successfully' });
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Search property
router.post('/search', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers?.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const { location } = req.body;
		if (!location) {
			return res.status(400).json({ message: 'Location query parameter is required' });
		}

		const states = await State.find({ name: { $regex: location, $options: 'i' } }, '_id name');
		const cities = await City.find({ name: { $regex: location, $options: 'i' } }, '_id name');

		const stateIds = states.map(s => s._id);
		const cityIds = cities.map(c => c._id);

		const matchedProperties = await Property.find({
			$or: [
				{ state_id: { $in: stateIds } },
				{ city_id: { $in: cityIds } },
				{ address: { $regex: location, $options: 'i' } },
				{ propertyCode: { $regex: location, $options: 'i' } }
			],
			isAvailable: true,
			status: 'approved'
		})
			.populate('owner', 'name email')
			.sort({ createdAt: -1 })
			.lean();

		const stateMap = states.reduce((acc, state) => {
			acc[state._id] = state.name;
			return acc;
		}, {});

		const cityMap = cities.reduce((acc, city) => {
			acc[city._id] = city.name;
			return acc;
		}, {});

		const missingStateIds = [
			...new Set(matchedProperties.filter(p => p.state_id && !stateMap[p.state_id]).map(p => p.state_id))
		];
		const missingCityIds = [
			...new Set(matchedProperties.filter(p => p.city_id && !cityMap[p.city_id]).map(p => p.city_id))
		];

		if (missingStateIds.length) {
			const missingStates = await State.find({ _id: { $in: missingStateIds } }, '_id name');
			missingStates.forEach(state => {
				stateMap[state._id] = state.name;
			});
		}

		if (missingCityIds.length) {
			const missingCities = await City.find({ _id: { $in: missingCityIds } }, '_id name');
			missingCities.forEach(city => {
				cityMap[city._id] = city.name;
			});
		}

		const enriched = matchedProperties.map(p => ({
			...p,
			state_name: stateMap[p.state_id] || null,
			city_name: cityMap[p.city_id] || null
		}));

		res.status(200).json(enriched);
	} catch (err) {
		res.status(500).json({ message: 'Failed to search properties', error: err.message });
	}
});

// Get Featured Properties
router.get('/featured', async (req, res) => {
	try {
		const userId = await getUserIdFromToken(req.headers.authorization);
		if (!userId) {
			return res.status(401).json({ message: 'Invalid or missing token' });
		}

		const featured = await Property.find({ isAvailable: true, status: 'approved' })
			.populate('owner', 'name email phone')
			.sort({ rating: -1, reviewsCount: -1 })
			.limit(5)
			.lean();

		const favourites = await Favourite.find({ user: userId }, 'property');
		const favSet = new Set(favourites.map(f => f.property.toString()));

		const stateMap = await State.find({}, '_id name').then(states => {
			return states.reduce((acc, state) => {
				acc[state._id] = state.name;
				return acc;
			}, {});
		});

		const cityMap = await City.find({}, '_id name').then(cities => {
			return cities.reduce((acc, city) => {
				acc[city._id] = city.name;
				return acc;
			}, {});
		});

		const enriched = featured.map(p => ({
			...p,
			state_name: stateMap[p.state_id] || null,
			city_name: cityMap[p.city_id] || null,
			isFavourite: favSet.has(p._id.toString())
		}));

		res.status(200).json(enriched);
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Get property by code
router.get('/code/:code', async (req, res) => {
	try {
		const property = await Property.findOne({ propertyCode: req.params.code }).populate('owner', 'name email phone');

		if (!property || property.status !== 'approved' || !property.isAvailable) {
			return res.status(404).json({ message: 'Property not found' });
		}

		const state = await State.findOne({ _id: property.state_id });
		const city = await City.findOne({ _id: property.city_id });

		const enriched = {
			...property.toObject(),
			state_name: state?.name || null,
			city_name: city?.name || null
		};

		res.status(200).json(enriched);
	} catch (err) {
		res.status(500).json({ message: 'Server error', error: err.message });
	}
});

// Web redirect endpoint for deep linking
router.get('/product/:id', async (req, res) => {
	try {
		const property = await Property.findById(req.params.id);

		if (!property) {
			return res.status(404).send('<h1>Property not found</h1>');
		}

		const propertyCode = property.propertyCode;
		const appPackage = 'com.rentaltown.app'; // Your app's package name
		const playStoreUrl = `https://play.google.com/store/apps/details?id=${appPackage}`;
		const deepLink = `rentaltown://property/${propertyCode}`;

		const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RentalTown - ${property.title}</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            max-width: 400px;
        }
        h1 { color: #333; margin: 0 0 10px 0; }
        p { color: #666; margin: 10px 0; }
        .property-info { 
            background: #f5f5f5; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0;
            text-align: left;
        }
        .property-info h3 { margin: 0 0 10px 0; color: #333; }
        .property-info p { margin: 5px 0; font-size: 14px; }
        .buttons { margin-top: 20px; }
        a { 
            display: inline-block;
            padding: 12px 24px;
            margin: 5px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s;
        }
        .btn-app { 
            background: #667eea; 
            color: white;
        }
        .btn-app:hover { 
            background: #5568d3; 
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        .btn-store { 
            background: #34A853; 
            color: white;
        }
        .btn-store:hover { 
            background: #2d9148; 
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(52, 168, 83, 0.4);
        }
        .loading { 
            color: #999; 
            font-size: 14px; 
            margin-top: 20px;
        }
        @keyframes spin { 
            from { transform: rotate(0deg); } 
            to { transform: rotate(360deg); } 
        }
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏠 RentalTown</h1>
        <p>Opening property details...</p>
        
        <div class="property-info">
            <h3>${property.title}</h3>
            <p><strong>₹${property.price}</strong>/month</p>
            <p>${property.address}</p>
            <p>Code: <strong>${propertyCode}</strong></p>
        </div>

        <div class="buttons">
            <a href="${deepLink}" class="btn-app">Open in App</a>
            <a href="${playStoreUrl}" class="btn-store">Get App</a>
        </div>

        <div class="loading">
            <div class="spinner"></div>
            <p>Redirecting to RentalTown...</p>
        </div>
    </div>

    <script>
        const deepLink = '${deepLink}';
        const playStoreUrl = '${playStoreUrl}';
        const appOpenedTime = Date.now();

        // Try to open the deep link
        window.location.href = deepLink;

        // Fallback to Play Store after 2 seconds if app doesn't open
        setTimeout(() => {
            const now = Date.now();
            // If only ~2 seconds passed, app didn't open, so redirect to Play Store
            if (now - appOpenedTime >= 1800) {
                window.location.href = playStoreUrl;
            }
        }, 2000);
    </script>
</body>
</html>
		`;

		res.setHeader('Content-Type', 'text/html; charset=utf-8');
		res.send(htmlContent);
	} catch (err) {
		res.status(500).send('<h1>Error loading property</h1>');
	}
});

module.exports = router;
