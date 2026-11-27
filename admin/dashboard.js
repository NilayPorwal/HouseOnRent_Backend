const API = '/api/admin';
let token = localStorage.getItem('adminToken');
let currentFilter = null;
let currentPage = 1;
const PAGE_LIMIT = 15;
let currentView = 'overview';
let currentAdminId = null;

const qs = selector => document.querySelector(selector);
const loginView = qs('#loginView');
const dashboardView = qs('#dashboardView');

async function api(path, options = {}) {
	const response = await fetch(API + path, {
		...options,
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) }
	});
	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.message || 'Request failed');
	return data;
}

function showToast(message) {
	const toast = qs('#toast');
	toast.textContent = message;
	toast.classList.add('show');
	setTimeout(() => toast.classList.remove('show'), 2600);
}

function openConfirmModal({ title, message, confirmText = 'Confirm', type = 'danger', showReason = false }) {
	return new Promise(resolve => {
		const modal = qs('#confirmModal');
		const submitButton = qs('#confirmSubmit');
		const cancelButton = qs('#confirmCancel');
		const reasonField = qs('#reasonField');
		const reasonInput = qs('#confirmReason');

		qs('#confirmTitle').textContent = title;
		qs('#confirmMessage').textContent = message;
		qs('#confirmIcon').textContent = type === 'success' ? '✓' : '!';
		qs('#confirmIcon').style.background = type === 'success' ? '#d1fae5' : '#fee2e2';
		qs('#confirmIcon').style.color = type === 'success' ? '#047857' : '#b91c1c';
		submitButton.textContent = confirmText;
		submitButton.className = `modal-button confirm ${type}`;
		reasonField.classList.toggle('hidden', !showReason);
		reasonInput.value = '';
		modal.classList.remove('hidden');
		modal.setAttribute('aria-hidden', 'false');

		const close = result => {
			modal.classList.add('hidden');
			modal.setAttribute('aria-hidden', 'true');
			submitButton.removeEventListener('click', confirmHandler);
			cancelButton.removeEventListener('click', cancelHandler);
			modal.removeEventListener('click', backdropHandler);
			document.removeEventListener('keydown', escapeHandler);
			resolve(result);
		};
		const confirmHandler = () => close({ confirmed: true, reason: reasonInput.value.trim() });
		const cancelHandler = () => close({ confirmed: false, reason: '' });
		const backdropHandler = event => {
			if (event.target === modal) cancelHandler();
		};
		const escapeHandler = event => {
			if (event.key === 'Escape') cancelHandler();
		};

		submitButton.addEventListener('click', confirmHandler);
		cancelButton.addEventListener('click', cancelHandler);
		modal.addEventListener('click', backdropHandler);
		document.addEventListener('keydown', escapeHandler);
		cancelButton.focus();
	});
}

function showDashboard(user) {
	loginView.classList.add('hidden');
	dashboardView.classList.remove('hidden');
	currentAdminId = user.id || user._id || null;
	qs('#adminName').textContent = user.name || 'Admin';
	qs('#adminAvatar').textContent = (user.name || 'A')[0].toUpperCase();
	loadStats();
	loadTable();
}

qs('#loginForm').addEventListener('submit', async event => {
	event.preventDefault();
	const email = qs('#email').value.trim();
	const password = qs('#password').value;
	qs('#loginError').textContent = '';
	try {
		const response = await fetch('/api/users/admin-login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password })
		});
		const data = await response.json();
		if (!response.ok) throw new Error(data.message || 'Login failed');
		if (data.user.role !== 'admin') throw new Error('This account does not have admin access');
		token = data.token;
		localStorage.setItem('adminToken', token);
		localStorage.setItem('adminUser', JSON.stringify(data.user));
		showDashboard(data.user);
	} catch (error) {
		qs('#loginError').textContent = error.message;
	}
});

qs('#logoutButton').addEventListener('click', () => {
	localStorage.removeItem('adminToken');
	localStorage.removeItem('adminUser');
	token = null;
	dashboardView.classList.add('hidden');
	loginView.classList.remove('hidden');
});

async function loadStats() {
	try {
		const data = await api('/stats');
		qs('#totalProperties').textContent = data.stats.totalProperties;
		qs('#pendingProperties').textContent = data.stats.pendingProperties;
		qs('#approvedProperties').textContent = data.stats.approvedProperties;
		qs('#pendingNav').textContent = data.stats.pendingProperties;
	} catch (error) {
		if (error.message.includes('session') || error.message.includes('authentication')) {
			qs('#logoutButton').click();
		}
	}
}

function statusBadge(status) {
	return `<span class="badge ${status}">${status}</span>`;
}

let propertyPhotos = new Map();
let previewPhotos = [];
let previewIndex = 0;

function getPropertyImageUrl(image) {
	if (typeof image !== 'string') return '';
	const value = image.trim();
	if (!value) return '';
	if (/^(https?:|data:|blob:)/i.test(value)) return value;
	if (value.startsWith('//')) return value;
	return value.startsWith('/') ? value : '/' + value.replace(/^\.\//, '');
}

function openPhotoPreview(propertyId) {
	previewPhotos = propertyPhotos.get(String(propertyId)) || [];
	previewIndex = 0;
	if (!previewPhotos.length) return;

	const modal = qs('#photoPreviewModal');
	modal.classList.remove('hidden');
	modal.setAttribute('aria-hidden', 'false');
	updatePhotoPreview();
	qs('#photoPreviewClose').focus();
}

function updatePhotoPreview() {
	const image = qs('#photoPreviewImage');
	const counter = qs('#photoPreviewCounter');
	const dots = qs('#photoPreviewDots');
	const prev = qs('#photoPreviewPrev');
	const next = qs('#photoPreviewNext');

	if (!previewPhotos.length) return;
	previewIndex = (previewIndex + previewPhotos.length) % previewPhotos.length;
	image.src = previewPhotos[previewIndex];
	image.alt = `Property photo ${previewIndex + 1} of ${previewPhotos.length}`;
	counter.textContent = `${previewIndex + 1} / ${previewPhotos.length}`;
	dots.innerHTML = previewPhotos
		.map(
			(_, index) =>
				`<button type="button" class="photo-preview-dot ${index === previewIndex ? 'active' : ''}" data-photo-index="${index}" aria-label="View photo ${index + 1}"></button>`
		)
		.join('');
	prev.hidden = previewPhotos.length < 2;
	next.hidden = previewPhotos.length < 2;
}

function closePhotoPreview() {
	const modal = qs('#photoPreviewModal');
	modal.classList.add('hidden');
	modal.setAttribute('aria-hidden', 'true');
	previewPhotos = [];
	previewIndex = 0;
}

qs('#photoPreviewClose').addEventListener('click', closePhotoPreview);
qs('#photoPreviewPrev').addEventListener('click', () => {
	previewIndex -= 1;
	updatePhotoPreview();
});
qs('#photoPreviewNext').addEventListener('click', () => {
	previewIndex += 1;
	updatePhotoPreview();
});
qs('#photoPreviewDots').addEventListener('click', event => {
	const dot = event.target.closest('[data-photo-index]');
	if (!dot) return;
	previewIndex = Number(dot.dataset.photoIndex);
	updatePhotoPreview();
});
qs('#photoPreviewModal').addEventListener('click', event => {
	if (event.target === qs('#photoPreviewModal')) closePhotoPreview();
});
document.addEventListener('keydown', event => {
	if (qs('#photoPreviewModal').classList.contains('hidden')) return;
	if (event.key === 'Escape') closePhotoPreview();
	if (event.key === 'ArrowLeft') {
		previewIndex -= 1;
		updatePhotoPreview();
	}
	if (event.key === 'ArrowRight') {
		previewIndex += 1;
		updatePhotoPreview();
	}
});

async function loadProperties() {
	const body = qs('#propertiesBody');
	body.innerHTML = '<tr><td colspan="7" class="empty">Loading properties…</td></tr>';
	try {
		const search = qs('#searchInput').value.trim();
		const params = new URLSearchParams();
		if (currentFilter) params.set('status', currentFilter);
		if (search) params.set('search', search);
		params.set('page', currentPage);
		params.set('limit', PAGE_LIMIT);
		const data = await api('/properties?' + params);
		qs('#totalUsers').textContent = (await api('/stats')).stats.totalUsers;

		if (!data.properties.length) {
			body.innerHTML = '<tr><td colspan="7" class="empty">No properties found</td></tr>';
			renderPagination({}); // Clear pagination when no data
			return;
		}

		body.innerHTML = data.properties
			.map(property => {
				const images = Array.isArray(property.images) ? property.images.map(getPropertyImageUrl).filter(Boolean) : [];
				propertyPhotos.set(String(property._id), images);
				const image = images[0] || '';
				const thumb = image
					? `<button class="property-thumb-button" type="button" data-preview-property="${property._id}" aria-label="Preview photos for ${escapeHtml(property.title)}"><img class="property-thumb" src="${escapeHtml(image)}" alt="${escapeHtml(property.title)}"><span class="property-photo-count">${images.length}</span></button>`
					: '<div class="property-thumb property-thumb-empty"></div>';
				const action =
					property.status === 'pending'
						? `<div class="actions"><button class="action-button approve" data-action="approved" data-id="${property._id}">Approve</button><button class="action-button reject" data-action="rejected" data-id="${property._id}">Reject</button></div>`
						: '<span style="color:#9CA3AF">Reviewed</span>';
				return `<tr>
        <td><div class="property-cell">${thumb}<div><div class="property-name">${escapeHtml(property.title)}</div><div class="property-code">${escapeHtml(property.propertyCode || property.address || '—')}</div></div></div></td>
        <td><div class="property-name">${escapeHtml(property.owner?.name || 'Unknown')}</div><div class="owner-detail">${escapeHtml(property.owner?.email || 'Email unavailable')}</div><div class="owner-detail">${escapeHtml(property.mobileNumber || 'Phone unavailable')}</div></td>
        <td><strong>₹${Number(property.price || 0).toLocaleString('en-IN')}</strong></td>
        <td><div class="owner-detail">${escapeHtml([property.address, property.city_name, property.state_name].filter(Boolean).join(', ') || 'Address unavailable')}</div></td>
        <td>${statusBadge(property.status || 'pending')}</td>
        <td>${new Date(property.createdAt).toLocaleDateString('en-IN')}</td>
        <td>${action}</td>
      </tr>`;
			})
			.join('');
		renderPagination(data.pagination);
	} catch (error) {
		body.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(error.message)}</td></tr>`;
	}
}

function escapeHtml(value) {
	return String(value).replace(
		/[&<>'"]/g,
		char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]
	);
}

qs('#propertiesBody').addEventListener('click', async event => {
	const previewButton = event.target.closest('[data-preview-property]');
	if (previewButton) {
		openPhotoPreview(previewButton.dataset.previewProperty);
		return;
	}

	const button = event.target.closest('[data-action]');
	if (!button) return;

	const isRejected = button.dataset.action === 'rejected';
	const result = await openConfirmModal({
		title: isRejected ? 'Reject property?' : 'Approve property?',
		message: isRejected
			? 'Are you sure you want to reject this property?'
			: 'Are you sure you want to approve this property?',
		confirmText: isRejected ? 'Reject' : 'Approve',
		type: isRejected ? 'danger' : 'success',
		showReason: isRejected
	});
	if (!result.confirmed) return;

	button.disabled = true;
	try {
		await api(`/properties/${button.dataset.id}/status`, {
			method: 'PATCH',
			body: JSON.stringify({ status: button.dataset.action, rejectionReason: result.reason })
		});
		showToast(`Property ${button.dataset.action}`);
		loadStats();
		loadTable();
	} catch (error) {
		button.disabled = false;
		showToast(error.message);
	}
});

qs('#searchInput').addEventListener(
	'input',
	debounce(() => {
		currentPage = 1;
		loadTable();
	}, 350)
);
qs('#refreshButton').addEventListener('click', () => {
	loadStats();
	loadTable();
});

document.querySelectorAll('.nav-item').forEach(button =>
	button.addEventListener('click', () => {
		document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
		button.classList.add('active');
		currentView = button.dataset.view;
		currentFilter = ['pending', 'approved', 'rejected'].includes(currentView) ? currentView : null;
		currentPage = 1;
		qs('#searchInput').value = '';

		if (currentView === 'users') {
			qs('#pageTitle').textContent = 'Users';
			qs('#tableTitle').textContent = 'Registered users';
			qs('#tableSubtitle').textContent = 'Administrators appear first';
			qs('#searchInput').placeholder = 'Search users';
		} else {
			qs('#pageTitle').textContent = currentView[0].toUpperCase() + currentView.slice(1);
			qs('#tableTitle').textContent = currentFilter
				? `${currentFilter[0].toUpperCase() + currentFilter.slice(1)} properties`
				: 'Recent properties';
			qs('#tableSubtitle').textContent = currentFilter ? `All ${currentFilter} listings` : 'Latest submitted listings';
			qs('#searchInput').placeholder = 'Search properties';
		}
		loadTable();
	})
);

qs('#pagination').addEventListener('click', event => {
	const button = event.target.closest('[data-page]');
	if (!button || button.disabled) return;
	if (button.dataset.page === 'prev' && currentPage > 1) currentPage -= 1;
	if (button.dataset.page === 'next') currentPage += 1;
	loadTable();
});

function debounce(fn, delay) {
	let timeout;
	return (...args) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => fn(...args), delay);
	};
}

function renderPagination(pagination) {
	const container = qs('#pagination');
	if (!container) return;
	const page = pagination?.page || 1;
	const pages = pagination?.pages || 0;
	const total = pagination?.total || 0;
	const start = total === 0 ? 0 : (page - 1) * PAGE_LIMIT + 1;
	const end = Math.min(page * PAGE_LIMIT, total);
	container.innerHTML = `
		<span class="pagination-info">Showing ${start}-${end} of ${total}</span>
		<button class="pagination-button" data-page="prev" ${page <= 1 ? 'disabled' : ''}>Previous</button>
		<span class="pagination-pages">Page ${page} of ${Math.max(pages, 1)}</span>
		<button class="pagination-button" data-page="next" ${page >= pages ? 'disabled' : ''}>Next</button>
	`;
}

function getProfilePhoto(user) {
	const profilePicture = typeof user.profilePicture === 'string' ? user.profilePicture.trim() : '';
	if (!profilePicture) return '';
	if (/^(https?:|data:|blob:)/i.test(profilePicture)) return profilePicture;
	if (profilePicture.startsWith('//')) return profilePicture;
	return profilePicture.startsWith('/') ? profilePicture : '/' + profilePicture.replace(/^\.\//, '');
}

async function loadUsers() {
	const body = qs('#propertiesBody');
	body.innerHTML = '<tr><td colspan="5" class="empty">Loading users…</td></tr>';
	try {
		const params = new URLSearchParams({ page: currentPage, limit: PAGE_LIMIT });
		const search = qs('#searchInput').value.trim();
		if (search) params.set('search', search);
		const data = await api('/users?' + params);
		qs('#tableHead').innerHTML =
			'<tr><th>User</th><th>Email</th><th>Mobile number</th><th>Registered</th><th>Action</th></tr>';
		if (!data.users.length) {
			body.innerHTML = '<tr><td colspan="5" class="empty">No users found</td></tr>';
			renderPagination({});
			return;
		}
		body.innerHTML = data.users
			.map(user => {
				const photo = getProfilePhoto(user);
				const initial = escapeHtml((user.name || 'U')[0].toUpperCase());
				const avatar = photo
					? `<img class="user-avatar" src="${escapeHtml(photo)}" alt="${escapeHtml(user.name || 'User')}" onerror="this.replaceWith(Object.assign(document.createElement('div'), {className:'user-avatar user-avatar-placeholder', textContent:'${initial}'}))">`
					: `<div class="user-avatar user-avatar-placeholder">${initial}</div>`;
				const isCurrentAdmin = currentAdminId && String(user._id) === String(currentAdminId);
				const action = isCurrentAdmin
					? '<span style="color:#9CA3AF">Current admin</span>'
					: `<button class="action-button reject" data-delete-user="${user._id}">Delete</button>`;
				return `<tr><td><div class="user-cell">${avatar}<div><div class="property-name">${escapeHtml(user.name || 'Unknown')}</div><span class="badge ${user.role === 'admin' ? 'approved' : 'pending'}">${escapeHtml(user.role)}</span></div></div></td><td>${escapeHtml(user.email || 'Email unavailable')}</td><td>${escapeHtml(user.phone || 'Phone unavailable')}</td><td>${new Date(user.createdAt).toLocaleDateString('en-IN')}</td><td>${action}</td></tr>`;
			})
			.join('');
		renderPagination(data.pagination);
	} catch (error) {
		body.innerHTML = `<tr><td colspan="5" class="empty">${escapeHtml(error.message)}</td></tr>`;
	}
}

async function loadTable() {
	if (currentView === 'users') return loadUsers();
	qs('#tableHead').innerHTML =
		'<tr><th>Property</th><th>Owner</th><th>Price</th><th>Address</th><th>Status</th><th>Submitted</th><th>Action</th></tr>';
	return loadProperties();
}

const savedUser = localStorage.getItem('adminUser');
if (token && savedUser) {
	showDashboard(JSON.parse(savedUser));
}

qs('#propertiesBody').addEventListener('click', async event => {
	const deleteButton = event.target.closest('[data-delete-user]');
	if (!deleteButton) return;

	const result = await openConfirmModal({
		title: 'Confirm deletion',
		message:
			'Are you sure you want to delete this user? This will also delete their associated properties and bookings.',
		confirmText: 'Delete',
		type: 'danger'
	});
	if (!result.confirmed) return;

	deleteButton.disabled = true;
	try {
		await api(`/users/${deleteButton.dataset.deleteUser}`, { method: 'DELETE' });
		showToast('User deleted successfully');
		loadStats();
		loadTable();
	} catch (error) {
		deleteButton.disabled = false;
		showToast(error.message);
	}
});
