const DataAPI = {
	load: async () => {
		const [ emails, conventions, mailInfo ] = await Promise.all([
			fetchJSON(`/admin/api/getEmails`),
			fetchJSON(`/api/public/getConventions`),
			fetchJSON(`/api/email/getMailInfo`)
		]);

		return { emails, conventions, mailInfo };
	}
}

async function cancelEmail(id, tr) {
	await fetch(`/admin/api/cancelSend/${id}`, {
		method: 'DELETE',
		headers: { 'content-type': 'application/json' },
	})
	.then(res => {
		if(!res.ok) {
			throw new Error('There was a problem.')
		}
		tr.remove();
		return res.json();
	})
	.catch(error => console.error('Error:', error));
}

async function fetchInstructorsByConvention(id) {
	const res = await fetch(`/admin/api/getEmailAddressesByConvention/${id}`);

	if (!res.ok) {
		throw new Error('Error fetching instructors by convention id');
	}

	return await res.json();
}