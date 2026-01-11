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

async function read(table) {
	try {
		const response = await fetch(`/api/read/${table}`, {
			credentials: 'include'
		});
		if (!response.ok) throw new Error('Network response was not ok');

		const all = await response.json();
		return all;
	} catch (err) {
		console.error('Failed to load data:', err);
	}
}

async function readEntry(table, id) {
	try {
		const res = await fetch(`/api/readEntry/${table}/${id}`)
		if(!res.ok) throw new Error('Network error');

		const data = await res.json();
		return data;
	} catch (err) {
		console.error('Failed to load data:', err);
	}
}

async function updateRecord(table, id, data) {
	try {
		const res = await fetch(`/api/update/${table}/${id}`, {
			method: 'PATCH',
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

async function apiGetCall(route, param1) {
		try {
			const res = await fetch(`/api/${route}/${param1}`, {
				credentials: 'include'
			});
			if (!res.ok) throw new Error('Network response was not ok');

			return await res.json();
		} catch (err) {
			console.error('Failed to get:', err);
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
		const terms = searchBar.value.toLowerCase().split(',')
			.map(term => term.trim())
			.filter(term => term !== '');

		let filtered;

		if (terms.length === 0) {
			filtered = records;
		} else {
			filtered = records.filter(entry => 
				terms.some(term => 
					Object.values(entry).some(value =>
						typeof value === 'string' && value.toLowerCase().includes(term)
					)
				)
			);
		}

		const count = document.getElementById('count');
		count.innerHTML = `Found ${filtered.length} records.`;

		displayRecords(filtered);
	});
}

async function populateModals(id) {
	const modals = document.querySelectorAll('.modal');
	try {
		const res = await fetch(`/api/readEntry/instructors/${id}`);
		const instData = await res.json();
		modals.forEach(modal => {
			const inputs = modal.querySelectorAll('input');
			inputs.forEach(input => {
				const value = instData[input.name];
				if(value !== undefined) {
					if (input.type === 'checkbox') {
						input.checked = !!value;
					} else {
						input.value = value;
					}
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
	
	if (sponsored.checked) {
		sponsor.style.display = 'inline-block';
	} else {
		sponsor.style.display = 'none';
	}
}

function parseForm(form) {
	const formData = new FormData(form);
	const data = {};

	form.querySelectorAll('input').forEach(input => {
		if (input.type === 'checkbox') {
			data[input.name] = input.checked;
		} else {
			data[input.name] = formData.get(input.name) || null;
		}
	});

	form.querySelectorAll('select').forEach(select => {
		if (select.multiple) {
			data[select.name] = Array.from(select.selectedOptions).map(opt => opt.value);
		} else {
			data[select.name] = formData.get(select.name) || null;
		}
	});

	form.querySelectorAll('textarea').forEach(textarea => {
		data[textarea.name] = formData.get(textarea.name) || null;
	});

	return data;
}

async function handleFormSubmission(e, form, endpoint, method = 'PUT', afterSubmit = () => {}) {
	e.preventDefault();

	const data = parseForm(form);
	const message = document.getElementById('message');

	try {
		const res = await fetch(endpoint, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});

		const result = await res.json();
		if (message) {
			message.textContent = result.message || result.error || 'Unknown response';
		}

		if (res.ok) {
			if (form.reset) form.reset();
			const modal = form.closest('.modal');
			if (modal) modal.style.display = "none";
			await afterSubmit();
		}
	} catch (err) {
		console.error('Form submission failed:', err);
		message.textContent = 'Network error or server issue';
	}
}

function createSearchableDropdown(inputId, resultsId, options) {
	const input = document.getElementById(inputId);
	const results = document.getElementById(resultsId);

	if (!input || !results) {
		console.error(`Input or results container not found for IDs: ${inputId}, ${resultsId}`);
		return;
	}

	input.addEventListener('input', () => {
		const searchTerm = input.value.toLowerCase();
		results.innerHTML = '';

		if (input.value == '') {
			return
		}

		options
			.filter(o => o.toLowerCase().includes(searchTerm))
			.forEach(o => {
				const li = document.createElement('li');
				li.textContent = o;
				li.classList.add('dd-options');
				li.addEventListener('click', () => {
					input.value = o;
					results.innerHTML = '';
				});
				results.appendChild(li);
			});
	});

	input.addEventListener('blur', () => {
		results.innerHTML = '';
	});
}

async function linkInstructorToClass({ instructor_id, class_title }) {
	try {
		const res = await fetch('/api/addInstructorClassByTitle', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ instructor_id, class_title })
		});

		if (!res.ok) {
			const errData = await res.json();
			throw new Error(errData.error || 'Failed to link instructor to class');
		}
	} catch (err) {
		console.error(err);
	}
}

async function linkClasstoInstructor({ class_id, instructor_name }) {
	try {
		const res = await fetch('/api/addClassbyInstructorName', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ class_id, instructor_name })
		});

		if (!res.ok) {
			const errData = await res.json();
			throw new Error(errData.error || 'Failed to link instructor to class');
		}
		return res.json();
	} catch (err) {
		console.error(err);
	}
}

async function deleteClassInstructorLink(classId, instructorId) {
  try {
    const res = await fetch('/api/deleteInstructorClass', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: classId, instructor_id: instructorId }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || 'Failed to delete link');
    }

    console.log('Link deleted successfully');

  } catch (err) {
    console.error(err);
    console.log('Error deleting link: ' + err.message);
  }
}

function getId() {
	return new URLSearchParams(window.location.search).get('id');
}

function checkOverlap(events) {
  const overlaps = [];

  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const a = events[i];
      const b = events[j];

      const aEnd = Number(a.start_period) + Number(a.length) - 1;
      const bEnd = Number(b.start_period) + Number(b.length) - 1;

      if (a.start_period <= bEnd && b.start_period <= aEnd) {
        overlaps.push({ eventA: a, eventB: b });
      }
    }
  }

  return overlaps;
}

async function downloadElementAsPDF(element) {
	const html = element.outerHTML;

	const res = await fetch('/api/export-pdf', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ html })
	});

	const blob = await res.blob();
	const url = URL.createObjectURL(blob);

	const a = document.createElement('a');
	a.href = url;
	a.download = 'element.pdf';
	a.click();
	a.remove();
}

async function deleteEntry(table, id) {
	try {
		const res = await fetch(`/api/delete/${table}/${id}`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json'
			}
		});

		if(!res.ok) throw new Error('Network error');

		if (res.status === 204) {
			console.log('Deleted successfully (No Content)');
			return;
		}

		const data = await res.json();
		console.log('Deleted successfully:', data);
		return data;
	} catch (err) {
		console.log('Error deleting:', err);
		throw error;
	}
}

function addTooltip(el, text) {
	el.classList.add('tooltip');
	const tooltip = document.createElement('span');
	tooltip.textContent = text;
	tooltip.classList.add('tooltiptext');
	el.appendChild(tooltip);
}


async function populateYearDropdown(dd) {
	const conventions = await read('conventions');
	conventions.forEach(convention => {
		const option = document.createElement('option');
		option.textContent = convention.name;
		option.value = convention.location_id;
		dd.appendChild(option);
	});
}