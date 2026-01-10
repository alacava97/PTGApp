class Modal {
	constructor(id) {
		this.modal = document.createElement('div');
		this.modal.classList.add('modal');
		this.modal.id = id;

		this.modalContent = document.createElement('div');
		this.modalContent.classList.add('modal-content');
		this.modalContent.addEventListener('click', (e) => { e.stopPropagation() });

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
		const message = this.modal.querySelector('#message')
		if (message) { message.innerHTML = '' };
	}

	close() {
		this.modal.style.display = "none";
	}

	content(html) {
		this.modalContent.insertAdjacentHTML('beforeend', html);
	}

	findEl(el) {
		console.log(this.modal.querySelector(el));
	}

	formSubmit(onSuccess, table, instClass = false, id = getId()) {
		const modalForm = this.modal.querySelector('form');
		modalForm.addEventListener('submit', async (e) => {
			const form = this.modal.querySelector('form');
			try {
				if (!instClass) {
					await handleFormSubmission(e, form, `/api/update/${table}/${id}`, 'PATCH', () => {
	                	onSuccess();
	                	this.close();
	                });
            	} else {
            		e.preventDefault();
            		const data = parseForm(form);
            		onSuccess(data);
            		this.close();
            	}
                form.reset();
            } catch (err) {
                console.error('Error updating class:', err);
            }
		});
	}
}