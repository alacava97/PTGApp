document.addEventListener('DOMContentLoaded', function () {
  	const modals = document.querySelectorAll('.modal');
  	const modal = document.getElementById('newModal')
});

function modalButtons(modals) {
	const closeBtn = document.getElementById('close-btn');
	const openBtn = document.getElementById('new-btn');

	modals.forEach(el => {
		el.addEventListener('click', function (event) {
			if (event.target === el) {
		  		el.style.display = 'none';
			}
		});

		closeBtn.addEventListener('click', function () {
			el.style.display = 'none';
		});
	});
}

function openBtn(modal) {
	if (openBtn) {
		openBtn.addEventListener('click', function () {
			modal.style.display = 'flex';
		});
	}
}