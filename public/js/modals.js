class Modal {
	constructor(id) {
		this.modal = document.createElement('div');
		this.modal.classList.add('modal');
		this.modal.id = id;

		this.modalContent = document.createElement('div');
		this.modalContent.classList.add('modal-content');

		const closeBtn = document.createElement('div');
		closeBtn.classList.add('close-btn');
		closeBtn.innerHTML = `&times`;

		closeBtn.addEventListener('click', () => this.close());

		this.modalContent.appendChild(closeBtn);
		this.modal.appendChild(this.modalContent);

		this.modal.addEventListener('click', e => {
			if (e.target === this.modal) this.close();
		});

		document.body.appendChild(this.modal);
	}

	show() {
		this.modal.style.display = "flex";
	}

	close() {
		this.modal.style.display = "none";
	}

	content(html) {
		this.modalContent.insertAdjacentHTML('beforeend', html);
	}
}