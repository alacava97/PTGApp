function setupSortList(data, displayKey, table, addBtnId) {
	const list = document.createElement('ul');
	list.classList.add('sort-list');
	
	const addBtn = document.createElement('button');
	addBtn.textContent = `+ Add Item`;
	addBtn.classList.add('add-btn')

	//render list
	data.sort((a, b) => {
		return a.position - b.position
	}).forEach(entry => {
		const li = renderListItem(entry, displayKey);
		li.draggable="true";
		li.dataset.id = entry.id;
		list.appendChild(li);
	});

	//setup drag and drop
	list.addEventListener('dragstart', (e) => {
		if (e.target.tagName === 'LI') {
			e.target.classList.add('dragging');
		}
	});

	list.addEventListener('dragend', async (e) => {
		if (e.target.tagName === 'LI') {
			e.target.classList.remove('dragging');
		}

		const newOrder = [...list.children].map((li, index) => ({
			id: li.dataset.id,
			position: index + 1
		}));

		try {
	        await fetch('/api/update-order', {
	          method: 'PATCH',
	          headers: { 'Content-Type': 'application/json' },
	          body: JSON.stringify({ order: newOrder, table })
	        });
	      } catch (err) {
	        console.error('Failed to update order:', err);
	      }
	});

	list.addEventListener('dragover', (e) => {
		e.preventDefault();

		const draggingItem = document.querySelector('.dragging');
		const siblings = [...list.querySelectorAll('li:not(.dragging)')];

		const nextSibling = siblings.find(sibling => {
			const box = sibling.getBoundingClientRect();
			const boxCenter = box.top + box.height / 2;
			return e.clientY <= boxCenter;
		});

		if (nextSibling) {
			list.insertBefore(draggingItem, nextSibling);
		} else {
			list.appendChild(draggingItem);
		}
	});

	// add new item
	addBtn?.addEventListener('click', () => {
	    const li = document.createElement('li');
	    li.className = 'new-item';
	    const input = document.createElement('input');
	    input.type = 'text';
	    input.placeholder = `New item...`;
	    li.appendChild(input);
	    list.appendChild(li);
	    input.focus();

	    let finalized = false;

	    const finalizeAdd = async () => {
    		if (finalized == true) return;
    		finalized = true;
	      	input.blur();
	      	const value = input.value.trim();
	      	if (!value) return li.remove();
	      	try {
	      		let newData

	      		if (table == "rooms") {
	      			const loc_id = list.dataset.loc_id;
      				newData = { [displayKey]: value, 'location_id': loc_id };
	      		} else {
	      			newData = { [displayKey]: value };
	      		}
	        	const res = await fetch(`/api/create/${table}`, {
	          		method: 'POST',
	          		headers: { 'Content-Type': 'application/json' },
	          		body: JSON.stringify(newData)
	        	});
	        	const data = await res.json();
	        	li.remove();
	        	list.appendChild(renderListItem(data.record, displayKey));
	      	} catch (err) {
	        	console.error(`Add item failed:`, err);
	        	li.remove();
	      	}
	    };

	    input.addEventListener('keydown', e => {
	      	if (e.key === 'Enter') finalizeAdd();
	      	if (e.key === 'Escape') li?.remove();
	    });
	    input?.addEventListener('blur', finalizeAdd);
	});

	function renderListItem(entry, displayKey) {
		const li = document.createElement('li');
		li.dataset.id = entry.id;

		const span = document.createElement('span');
		span.textContent = entry[displayKey];
		attachInlineEdit(span, li);
		li.appendChild(span);
		attachDeleteButton(li);

		return li;
	}

	// to do: clean up inline edit and delete button
  	function attachInlineEdit(span, li) {
	    span.addEventListener('click', () => {
	    	if (span.querySelector('input.inline-edit')) return;
	      	const oldText = span.textContent;
	      	const input = document.createElement('input');
	      	input.type = 'text';
	      	input.value = oldText;
	      	input.classList.add('inline-edit');
	      	span.textContent = '';
	      	span.appendChild(input);
	      	input.focus();

	      	const save = async () => {
	        	const newText = input.value.trim();
	        	if (newText === oldText || !newText) return (span.textContent = oldText);
	        	try {
	          		const res = await fetch(`/api/update/${table}/${li.dataset.id}`, {
	            	method: 'PATCH',
	            	headers: { 'Content-Type': 'application/json' },
	            	body: JSON.stringify({ [displayKey]: newText })
	          	});
	          	if (!res.ok) throw new Error('Update failed');
	          	span.textContent = newText;
		        } catch (err) {
		          	console.error(`Failed to update ${displayKey}:`, err);
		          	span.textContent = oldText;
		        }
      		};

	      	input.addEventListener('blur', save);
	      	input.addEventListener('keydown', e => {
		        if (e.key === 'Enter') input.blur();
		        if (e.key === 'Escape') span.textContent = oldText;
	      	});
	    });
  	}

	function attachDeleteButton(li) {
	    const del = document.createElement('button');
	    del.textContent = '×';
	    del.classList.add('sort-list-delete');
	    li.appendChild(del);

	    del.addEventListener('click', async (e) => {
	      	e.stopPropagation();
	      	const id = li.dataset.id;
	      	if (!confirm(`Delete this ${displayKey}?`)) return;

	      	try {
	        	const res = await fetch(`/api/delete/${table}/${id}`, { method: 'DELETE' });

	        	const data = await res.json();

	        	if (!res.ok) {
	        		alert(data.error);
	        		return;
	       		}

	        	li.remove();
	      	} catch (err) {
	        	console.error(`Delete ${displayKey} failed:`, err);
	      	}
	    });
  	}
	
	return { list, addBtn };
}

class List {
	constructor(record, deleteFunction) {
		this.deleteFunction = deleteFunction;
		this.listContainer = document.createElement('div');
		this.record = record;
	}

	addTitle(title) {
		this.listTitle = document.createElement('h3');
		this.listTitle.textContent = title;
		this.listContainer.appendChild(this.listTitle);
	}

	renderList(data, displayKey) {
		this.list = document.createElement('ul');
		this.list.classList.add('sort-list');

		data.forEach(entry => {
			const li = new ListItem(entry, displayKey);
			li.li.dataset.entry = entry;
			if (this.deleteFunction) {
				li.attachDeleteButton(this.deleteFunction, entry, this.record);
			}
			this.list.appendChild(li.li);
		});

		this.listContainer.appendChild(this.list);
	}

	renderListItem(data, displayKey) {
		const li = new ListItem(data, displayKey);
		li.attachDeleteButton(this.deleteFunction, data, this.record)
		this.list.appendChild(li.li);
	}

	createAddButton(addFunction, options, displayKey, serachable = false) {
		this.addBtn = document.createElement('button');
		this.addBtn.textContent = `+ Add Item`;
		this.addBtn.classList.add('add-btn');

		this.addBtn.addEventListener('click', () => {
			const li = document.createElement('li');
		    li.classList.add('new-item');
		    const input = document.createElement('input');
		    input.type = 'text';
		    input.placeholder = `New item...`;
		    li.appendChild(input);

		    this.list.appendChild(li);
		    input.focus();

		    let finalized = false;

		    if(options && searchable == true) {
		    	const results = document.createElement('ul');
				results.classList.add('drop-down-select');

				input.addEventListener('input', () => {
					const searchTerm = input.value.toLowerCase();
					results.innerHTML = '';

					if (input.value == '') {
						return
					}

					options
						.filter(o => o[displayKey].toLowerCase().includes(searchTerm))
						.forEach(o => {
							const searchableLi = document.createElement('li');
							searchableLi.textContent = o[displayKey];
							searchableLi.classList.add('dd-options');
							searchableLi.addEventListener('click', () => {
								input.value = o[displayKey];
								input.setAttribute('row-id', o.id);
								results.innerHTML = '';
							});
							results.appendChild(searchableLi);
						});
				});

				li.appendChild(results);

			    const finalizeAdd = async () => {
		    		if (finalized == true) return;
		    		finalized = true;
			      	input.blur();
			      	const value = input.value.trim();
			      	if (!value) return li.remove();
			      	try {
			      		const data = await addFunction(input.getAttribute('row-id'), this.record.id);
			        	li.remove();
			        	this.renderListItem(options.find(o => o.id == input.getAttribute('row-id')), displayKey);
			      	} catch (err) {
			        	console.error(`Add item failed:`, err);
			        	li.remove();
			      	}
			    };

			    input.addEventListener('keydown', e => {
			      	if (e.key === 'Enter') finalizeAdd();
			      	if (e.key === 'Escape') li?.remove();
			    });
			    input?.addEventListener('blur', (e) => {
			    	if (e.target.getAttribute('row-id')) {
			    		finalizeAdd();
			    	} else {
			    		e.target.focus();
			    	}
			    });
		    }
		});

		this.listContainer.appendChild(this.addBtn);
	}
}

class ListItem {
	constructor(entry, displayKey) {
		this.li = document.createElement('li');

		const span = document.createElement('span');
		span.textContent = entry[displayKey];
		this.li.appendChild(span);
	}

	attachDeleteButton(deleteFunction, instructor, record) {
		this.del = document.createElement('button');
	    this.del.textContent = '×';
	    this.del.classList.add('sort-list-delete');
	    this.li.appendChild(this.del);

	    this.del.addEventListener('click', () => {
	    	deleteFunction(instructor, record);
	    	this.li.remove();
	    });
	}
}