class Row {
	constructor() {
		this.row = document.createElement('div');
		this.row.classList.add('row');
	}

	addTitle(html, id) {
		this.title = document.createElement('span');
		if (id) {
			this.title.id = id;
		}
		this.title.innerHTML = html;
		this.title.classList.add('row-title');
		this.row.appendChild(this.title);
	}

	addSubtitle(html, id) {
		this.subtitle = document.createElement('span');
		if (id) {
			this.subtitle.id = id;
		}
		this.subtitle.innerHTML = html;
		this.subtitle.classList.add('row-subtitle');
		this.row.appendChild(this.subtitle);
	}

	addArrow(link) {
		this.arrow = document.createElement('span');
		this.arrow.classList.add('arrow');
		this.arrow.innerHTML = `&#9654;`;
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
		this.editArrow.classList.add('arrow');
		this.editArrow.innerHTML = `edit &#9654;`;
		this.row.appendChild(this.editArrow);
	}

	addDeleteButton() {
		this.deleteButton = document.createElement('div');
		this.deleteButton.classList.add('delete-btn', 'arrow');
		this.deleteButton.innerHTML = `&times;`;
		this.row.appendChild(this.deleteButton);
	}

	addSeparator() {
		this.separator = document.createElement('div');
		this.separator.classList.add('seperator');
		this.row.appendChild(this.separator);
	}
}