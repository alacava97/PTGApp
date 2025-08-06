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