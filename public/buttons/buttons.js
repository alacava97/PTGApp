class Button {
	constructor(buttonId, buttonFunction) {
		this.button = document.getElementById(buttonId);
		this.buttFunc = buttonFunction;

		if (!this.button) {
			throw new Error(`Button not found: ${buttonId}`);
		}

		this.init();
	}

	init() {
		this.button.addEventListener('click', async (event) => {
			if (this.button.disabled) return;

			const buttText = this.button.textContent;

			this.disable();
			try {
				await this.buttFunc(event);
			} catch (error) {
				console.error('Button error:', error);
			} finally {
				this.enable(buttText);
			}
		});
	}

	disable() {
		this.button.disabled = true;
		this.button.textContent = "working...";
		this.button.classList.add('disabled');
	}

	enable(buttText) {
		this.button.disabled = false;
		this.button.textContent = buttText;
		this.button.classList.remove('disabled');
	}
}