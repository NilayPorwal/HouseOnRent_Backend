const fs = require('fs');
const path = require('path');

// Persistent Render disk and local development fallback
const UPLOAD_DIR = process.env.NODE_ENV === 'production' ? '/var/data/uploads' : path.join(__dirname, '..', 'uploads');

const uploadDir = path.resolve(UPLOAD_DIR);

fs.mkdirSync(uploadDir, { recursive: true });

module.exports = { uploadDir };
