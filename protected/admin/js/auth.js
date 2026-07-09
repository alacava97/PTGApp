async function requireAdmin() {
	const res = await fetch('/auth/session', {
		credentials: 'include'
	});

	const user = await res.json();
	
	if (!user.special_permission) {
		window.location.replace('/public/oops.html');
	}
}