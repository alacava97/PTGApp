class Row {
	constructor() {
		this.row = document.createElement('div');
		this.row.classList.add('row');

		this.titles = document.createElement('div');
		this.titles.classList.add('row-titles');
		this.row.appendChild(this.titles);
	}

	static() {
		this.row.classList.remove('row');
		this.row.classList.add('static-row');
	}

	addTitle(html, id) {
		this.title = document.createElement('span');
		if (id) {
			this.title.id = id;
		}
		this.title.innerHTML = html;
		this.title.classList.add('row-title');
		this.titles.appendChild(this.title);
	}

	addSubtitle(html, id) {
		this.subtitle = document.createElement('span');
		if (id) {
			this.subtitle.id = id;
		}
		this.subtitle.innerHTML = html;
		this.subtitle.classList.add('row-subtitle');
		this.titles.appendChild(this.subtitle);
	}

	addArrow(link) {
		this.arrow = document.createElement('span');
		this.arrow.classList.add('row-arrow');
		this.arrow.innerHTML = `More Info &#9654;`;
		this.row.addEventListener('click', (e) => {
			e.stopPropagation();
			window.location.href = link;
		});
		this.row.appendChild(this.arrow);
	}

	addLink(link) {
		this.row.addEventListener('click', (e) => {
			e.stopPropagation();
			window.location.href = link;
		});
	}

	editArrow() {
		this.editArrow = document.createElement('span');
		this.editArrow.classList.add('row-arrow');
		this.editArrow.innerHTML = `edit &#9654;`;
		this.row.appendChild(this.editArrow);
	}

	addDeleteButton() {
		this.deleteButton = document.createElement('button');
		this.deleteButton.classList.add('row-delete-button');
		this.deleteButton.innerHTML = `×`;
		this.row.appendChild(this.deleteButton);
	}

	addSeparator(type) {
		this.separator = document.createElement('div');
		if (type == 'horizontal') {
			this.separator.classList.add('separator');
		} else if (type == 'vertical') {
			this.separator.classList.add('vertical-separator');
		}
		this.row.appendChild(this.separator);
	}

	addStatus(statusText) {
		this.status = document.createElement('div');
		this.status.classList.add('status');
		this.status.textContent = statusText;
		this.row.appendChild(this.status);
	}

	addDDMenu() {
		this.ddArrow = document.createElement('span');
		this.ddArrow.classList.add('fa', 'fa-caret-down');
		this.row.appendChild(this.ddArrow);

		this.dd = document.createElement('div');
		this.dd.classList.add('row-dd');
		this.dd.addEventListener('click', (e) => { e.stopPropagation() });
		this.row.appendChild(this.dd);

		this.row.addEventListener('click', (e) => {
			e.stopPropagation();
			this.dd.style.display =
				this.dd.style.display === 'flex' ? 'none' : 'flex';
		});

		document.addEventListener('click', (e) => {
			this.dd.style.display = 'none';
		});
	}
}