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

form.addEventListener('submit', async (e) => {
	e.preventDefault();

	const formData = new FormData(form);
	const data = {};

	for (let [key, value] of formData.entries()) {
		if (value === 'on') {
			data[key] = true;
		} else if (value === '') {
			data[key] = false
		} else {
			data[key] = value;
		}
	}

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
			loadInstructors();
		}
	} catch (error) {
		console.error('Request failed:', error);
		message.textContent = 'Network error or server issue';
	}
});

document.addEventListener('DOMContentLoaded', function () {
  	const modal = document.getElementById('newModal');
	const closeBtn = document.getElementById('close-btn');
	const openBtn = document.getElementById('new-btn');

	closeBtn.addEventListener('click', function () {
		modal.style.display = 'none';
	});

	openBtn.addEventListener('click', function () {
		modal.style.display = 'flex';
	});

	modal.addEventListener('click', function (event) {
		if (event.target === modal) {
	  		modal.style.display = 'none';
		}
	});
});

async function loadRecords() {
	const instList = document.getElementById('list');
	instList.innerHTML = '';

	try {
		const response = await fetch(`/api/read/${table}`);
		if (!response.ok) throw new Error('Network response was not ok');

		all = await response.json();
		displayRecords(all);
	} catch (err) {
		console.error('Failed to load instructors:', err);
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