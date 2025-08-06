form.addEventListener('submit', async (e) => {
	e.preventDefault();

	const sponsor = document.getElementById('sponsor')
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
			loadRecords();
		}
	} catch (error) {
		console.error('Request failed:', error);
		message.textContent = 'Network error or server issue';
	}
});