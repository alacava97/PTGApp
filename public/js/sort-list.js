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
		const li = renderListItem(entry[displayKey]);
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
	        	list.appendChild(renderListItem(data.record.name));
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

	// to do: clean up inline edit and delete button
	  function attachInlineEdit(span, li) {
	    span.addEventListener('click', () => {
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
	    del.className = 'delete-btn2';
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

function renderListItem(display) {
	const li = document.createElement('li');
	const span = document.createElement('span');
	span.textContent = display;
	li.appendChild(span);

	return li;
}