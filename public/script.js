//dynamically insert the navbar into the document, highlighting the active link
document.addEventListener('DOMContentLoaded', () => {
	const navbar = document.getElementById('navbar');
	if (navbar) {
		fetch('navbar.html')
			.then(response => response.text())
			.then(html => {
				navbar.innerHTML = html;

				const currentPath = window.location.pathname.split('/').pop();
				const links = navbar.querySelectorAll('a');

				links.forEach(link => {
					const href = link.getAttribute('href');
					if (href === ('/' + currentPath) || (href === 'index.html' && currentPath === '')) {
						link.classList.add('active');
					}
				});
			})
			.catch(err => {
				console.error('Failed to load navbar:', err)
			});
	}
});

async function create(e, table) {
	e.preventDefault();

	const sponsor = document.getElementById('sponsor');
	const message = document.getElementById('message');

	const formData = new FormData(form);
	const data = {};

	for (let [key, value] of formData.entries()) {
		if (value === 'on') {
			data[key] = true;
		} else if (value === '') {
			data[key] = null;
		} else {
			data[key] = value;
		}
	}

	form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
		if (!formData.has(cb.name)) {
			data[cb.name] = false;
		}
	});

	try {
		const res = await fetch(`/api/create/${table}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});

		const result = await res.json();
		message.textContent = result.message || result.error || 'Unknown response';

		if (res.ok) {
			form.reset();
			if (sponsor) {
				sponsor.style.display = 'none';
			}
			loadRecords(table);
		}
	} catch (error) {
		console.error('Request failed:', error);
		message.textContent = 'Network error or server issue';
	}
}

async function read(table) {
	try {
		const response = await fetch(`/api/read/${table}`);
		if (!response.ok) throw new Error('Network response was not ok');

		const all = await response.json();
		return all;
	} catch (err) {
		console.error('Failed to load instructors:', err);
	}
}

async function updateRecord(table, id, data) {
	try {
	const res = await fetch(`/api/update/${table}/${id}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(data)
	});
	if (!res.ok) throw new Error('Network response was not ok');
	const result =  await res.json();
	return result;
	} catch (err) {
		console.error('Internal server error:', err);
		return { error: 'Request failed' };
	}
}

async function populateDropdown(dropdown, table, toDisplay) {
	try{
		const response = await fetch(`/api/read/${table}`);
		if(!response.ok) throw new Error(`Failed to fetch data from ${table} table`);
		const data = await response.json();

		data.forEach(row => {
			const option = document.createElement('option');
			option.value = row.id;
			option.textContent = row[toDisplay];
			dropdown.appendChild(option);
		});
	} catch (err) {
		console.error(`Failed to load ${table} table:`, err);
	}
}

function searchBar(records) {
	const searchBar = document.getElementById('searchbar');
	searchBar.addEventListener('input', () => {
		const term = searchBar.value.toLowerCase();
		const filtered = records.filter(entry => {
			return Object.values(entry).some(value => 
				typeof value === 'string' && value.toLowerCase().includes(term)
			);
		});

		const count = document.getElementById('count');
		count.innerHTML = `Found ${filtered.length} records.`;

		displayRecords(filtered);
	});
}

function modalButtons() {
	const modals = document.querySelectorAll('.modal');
	const openBtn = document.getElementById('new-btn');

	modals.forEach(el => {
		el.addEventListener('click', function (event) {
			if (event.target === el) {
		  		el.style.display = 'none';
			}
		});

		const closeBtn = el.querySelector('.close-btn');
		closeBtn.addEventListener('click', function () {
			el.style.display = 'none';
		})
	});
}

function openBtn(btnId, modalId) {
	const openBtn = document.getElementById(btnId);
	const modal = document.getElementById(modalId);
	if (openBtn) {
		openBtn.addEventListener('click', function () {
			modal.style.display = 'flex';
		});
	}
}

async function populateModals(id) {
	const modals = document.querySelectorAll('.modal');
	try {
		const res = await fetch(`/api/instructors/${id}`);
		const instData = await res.json();
		modals.forEach(modal => {
			const inputs = modal.querySelectorAll('input');
			inputs.forEach(input => {
				if (input.type === 'checkbox') {
					input.checked = !!instData[input.name];
				} else {
					input.value = instData[input.name];
				}
			});
		});
	} catch (err) {
		console.error('Internal server error:', err);
	}
}

function sponsorCheck() {
	const sponsored = document.getElementById('sponsored');
	const sponsor = document.getElementById('sponsor');

	console.log('Checked:', sponsored.checked);
	
	if (sponsored.checked) {
		sponsor.style.display = 'inline-block';
	} else {
		sponsor.style.display = 'none';
	}
}