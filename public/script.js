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