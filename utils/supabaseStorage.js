const path = require('path');

const SUPABASE_URL = 'https://wucyooqzbsavqmrxzqfy.supabase.co';
const SUPABASE_BUCKET = 'rental-town';

function getSupabaseKey() {
	return process.env.SUPABASE_KEY;
}

function safeFileName(originalName) {
	const extension = path.extname(originalName || '').toLowerCase();
	const randomId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
	return `${randomId}${extension}`;
}

async function uploadPropertyImage(file) {
	const key = getSupabaseKey();
	if (!key) {
		throw new Error('SUPABASE_KEY is not configured');
	}

	const objectName = `properties/${safeFileName(file.originalname)}`;
	const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${objectName.split('/').map(encodeURIComponent).join('/')}`;

	const response = await fetch(uploadUrl, {
		method: 'PUT',
		headers: {
			apikey: key,
			authorization: `Bearer ${key}`,
			'content-type': file.mimetype || 'application/octet-stream',
			'x-upsert': 'true'
		},
		body: file.buffer,
		signal: AbortSignal.timeout(30000)
	});

	if (!response.ok) {
		const details = await response.text();
		throw new Error(`Supabase upload failed (${response.status}): ${details}`);
	}

	return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${objectName.split('/').map(encodeURIComponent).join('/')}`;
}

module.exports = { uploadPropertyImage };
