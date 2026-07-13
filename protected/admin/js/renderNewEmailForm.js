function renderNewEmailForm(conventions, copies, groups) {
	//render convention select
	conventions.forEach(c => {
		const option = document.createElement('option');
		option.value = c.id;
		option.innerHTML = `${c.year} - ${c.city_state}`
		DOM.conSelect.appendChild(option);
	});

	//initialize 'new' button
	DOM.newEmailForm.style.display = 'none';
	DOM.newBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		DOM.newEmailForm.style.display = 
			DOM.newEmailForm.style.display === 'grid' ? 'none' : 'grid';
	});

	DOM.newEmailForm.addEventListener('click', (e) => {
		e.stopPropagation();
	})

	document.addEventListener('click', (e) => {
		if (e.target != DOM.newEmailForm) {
			DOM.newEmailForm.style.display = 'none';
		}
	});

	//initialize 'view copy' dropdown
	const viewCopy = document.getElementById('view-copy');
	const viewCopyContainer = viewCopy.parentElement;
	viewCopyContainer.addEventListener('click', () => {
		if (viewCopy.style.display === 'block') {
			viewCopy.style.display = 'none';
		} else {
			renderCopy(viewCopy, copies);
		}
	});

	DOM.copySelect.addEventListener('change', () => {
		if (viewCopy.style.display === 'block') {
			renderCopy(viewCopy, copies);
		}
	});

	//initialize 'view group' dropdown
	const viewGroup = document.getElementById('view-group');
	const viewGroupContainer = viewGroup.parentElement;
	viewGroupContainer.addEventListener('click', async () => {
		if (viewGroup.style.display === 'block') {
			viewGroup.style.display = 'none';
		} else {
			viewGroup.style.display = 'block';
			await renderEmailGroup(viewGroup, groups)
		}
	});

	DOM.groupSelect.addEventListener('change', async () => {
		if (viewGroup.style.display === 'block') {
			await renderEmailGroup(viewGroup, groups)
		}
	});

	DOM.conSelect.addEventListener('change', async () => {
		if (viewGroup.style.display === 'block') {
			await renderEmailGroup(viewGroup, groups)
		}
	})
}

function renderCopy(viewCopy, copies) {
	viewCopy.style.display = 'block';
	
	const selectedCopy = copies[DOM.copySelect.value];
	if(selectedCopy){
		viewCopy.textContent = selectedCopy;
	} else {
		viewCopy.textContent = 'No copy selected'
	}
}

async function renderEmailGroup(viewGroup, groups) {
	viewGroup.innerHTML = '';
	if(!DOM.groupSelect.value) {
		viewGroup.innerHTML = 'No group selected';
	} else if (DOM.groupSelect.value == 1) {
		viewGroup.appendChild(renderGroupTable(groups));
	} else if (DOM.groupSelect.value == 2) {
		const selectedConvention = DOM.conSelect.value
		if (!selectedConvention) {
			viewGroup.textContent = 'No convention selected';
		} else {
			const addresses = await fetchInstructorsByConvention(selectedConvention);
			viewGroup.appendChild(renderGroupTable(addresses));
		}
	}
}

function renderGroupTable(data) {
	const table = document.createElement('table');

	const headers = ['Instructor ID', 'Email Address', 'Name'];
	const headerRow = document.createElement('tr');
	headers.forEach(h => {
		const th = document.createElement('th');
		th.textContent = h;
		headerRow.appendChild(th);
	});
	table.appendChild(headerRow);

	data.forEach(e => {
		const tr = document.createElement('tr');
		Object.keys(e).forEach(key => {
			const td = document.createElement('td');
			td.textContent = e[key];
			tr.appendChild(td);
		});
		table.appendChild(tr);
	});

	return table;
}