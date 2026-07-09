function renderEmails(data) {
	const table = document.createElement('table');

	table.appendChild(renderHeaders());
	data.forEach(e => {
		table.appendChild(renderEmailRows(e))
	});

	DOM.main.appendChild(table)
}

function renderHeaders() {
	const headers = ['ID', 'To', 'Copy', 'Convention', 'Send At', 'Status', 'Cancel'];
	const headerRow = document.createElement('tr');
	headers.forEach(h => {
		const th = document.createElement('th');
		th.textContent = h;
		headerRow.appendChild(th);
	});
	
	return headerRow;
}

function renderEmailRows(e) {
	const tr = document.createElement('tr');

	Object.keys(e).forEach(key => {
		const td = document.createElement('td');
		if (key == 'send_at') {
			const options = {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour12: true,
				hour: 'numeric',
				minute: 'numeric'
			}
			td.textContent = new Intl.DateTimeFormat("en-us", options).format(new Date(e[key]))
		} else {
			td.textContent = e[key];
			if (key == 'status' && e[key] == 'sent') {
				td.classList.add('sent-email');
			} else if (key == 'status' && e[key] == 'pending') {
				td.classList.add('pending-email')
			}
		}
	
		tr.appendChild(td);
	});

	const td = document.createElement('td');

	if (e.status == 'pending') {
		td.appendChild(renderDeleteButton(e, tr));
	}
	
	tr.appendChild(td);

	return tr;
}

function renderDeleteButton(e) {
	const deleteButton = document.createElement('button');
	deleteButton.classList.add('delete-x');
	deleteButton.textContent = '×';
	deleteButton.addEventListener('click',async  () => {
		if (confirm(`Cancel email to ${e.to}?`)) {
			await cancelEmail(e.id)
		}
	});
	
	return deleteButton;
}