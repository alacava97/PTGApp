document.addEventListener('DOMContentLoaded', initInstructorPage);

async function initInstructorPage() {
	const instructorId = getId();

	await loadInstructorData(instructorId);
}

/* -----------------------------
   Data Fetching
----------------------------- */

async function fetchInstructor(instructorId) {
	const res = await fetch(`/api/readEntry/instructors/${instructorId}`);
	if (!res.ok) throw new Error('Network error');
	return res.json();
}

async function fetchClassForInstructors(instructorId) {
	const res = await fetch(`/api/classByInst/${instructorId}`);
	if (!res.ok) throw new Error('Network error');
	return res.json();
}

/* -----------------------------
   Page Setup
----------------------------- */

async function loadInstructorData(instructorId) {
	try {
		const [instructorRecord, classes] = await Promise.all([
			fetchInstructor(instructorId),
			fetchClassForInstructors(instructorId)
		]);

		setupName(instructorRecord, instructorId);
		setupContact(instructorRecord);
		setupClasses(classes, instructorId);
		setupCTE(instructorRecord, instructorId);
		setupBoard(instructorRecord, instructorId);
		setupDeleteInstructor(instructorId);
	} catch (err) {
		console.error('Internal server error:', err);
	}
}

/* -----------------------------
   Name Setup
----------------------------- */

function setupName(instructorRecord, instructorId) {
	const name = document.getElementById('instructor-name');

	const modal = new Modal('name-modal');
	modal.content(`
		<h4>Update Instructor Name</h4>
		<form>
			<input type="text" name="name" id="name-input">
			<div class="seperator"></div>
			<button type="submit">Submit</button>
		</form>
	`);

	let instNameRPT = `${instructorRecord.name}${instructorRecord.rpt?', RPT':''}`;
	let instName = instructorRecord.name;

	name.innerHTML = `${instNameRPT} ✎`;
	name.addEventListener('click', () => {
		modal.show();
		document.getElementById('name-input').value = instName;
	});

	modal.formSubmit(async () => {
		const updated = await fetchInstructor(instructorId);
		instNameRPT = `${updated.name}${updated.rpt?', RPT':''}`;
		instName = updated.name;
		name.innerHTML = `${instNameRPT} ✎`;
		document.getElementById('name-row').innerHTML = instNameRPT;
	}, 'instructors');
}

/* -----------------------------
   Contact
----------------------------- */

function setupContact(instructorRecord) {
	const contact = document.getElementById('instructor-details');
	contact.innerHTML = '';

	const modal = new Modal('contact-modal');
	modal.content(`
		<h4>Instructor Contact</h4>
 		<form id="edit-contact">
			<input id="instructor-name-input" type="text" name="name"required placeholder="Instructor name">
 			<div class="seperator"></div>
 			<input id="instructor-email" type="email" name="email" placeholder="Email">
 			<div class="seperator"></div>
 			<input id="instructor-phone" type="tel" name="phone" placeholder="Phone">
 			<div class="seperator"></div>
 			<label>RPT Status
				<input id="rpt-radio" class="small-input" type="checkbox" name="rpt">
 			</label>
 			<div class="seperator"></div>
 			<button type="submit">Update Record</button>
 			<div id="message"></div>
 		</form>`);

	let contactInfo = {
		name: instructorRecord.name,
		email: instructorRecord.email,
		phone: instructorRecord.phone,
		rpt: instructorRecord.rpt
	}

	const row = new Row();
	row.addTitle(`${contactInfo.name}${contactInfo.rpt ? ', RPT' : ''}`, 'name-row');
	row.addSubtitle(contactInfo.email || 'No email on record', 'email-row');
	row.addSubtitle(contactInfo.phone || 'No phone on record', 'phone-row');
	contact.appendChild(row.row);

	row.row.addEventListener('click', () => {
		modal.show();
		document.getElementById('instructor-name-input').value = contactInfo.name;
		document.getElementById('instructor-email').value = contactInfo.email;
		document.getElementById('instructor-phone').value = contactInfo.phone  ;
		document.getElementById('rpt-radio').checked = contactInfo.rpt;
	});

	modal.formSubmit(async () => {
		const updated = await fetchInstructor(getId());
		contactInfo = {
			name: updated.name,
			email: updated.email,
			phone: updated.phone,
			rpt: updated.rpt
		}
		document.getElementById('name-row').innerHTML = `${contactInfo.name}${contactInfo.rpt ? ', RPT' : ''}`;
		document.getElementById('email-row').innerHTML = contactInfo.email || 'No email on record';
		document.getElementById('phone-row').innerHTML = contactInfo.phone || 'No phone on record';
		document.getElementById('instructor-name').innerHTML = `${contactInfo.name}${contactInfo.rpt ? ', RPT' : ''} ✎`;
	}, 'instructors');
}

/* -----------------------------
   Classes
----------------------------- */

async function setupClasses(instClass, instructorId) {
	const container = document.getElementById('classes');
	container.innerHTML = '';

	const oldModal = document.getElementById('delete-confirmation-modal');
	if (oldModal) oldModal.remove();
	const deleteModal = new Modal('delete-confirmation-modal');
	deleteModal.content(`
		<h4>Remove class from instructor record?</h4>
		<button id="delete-button" class="red">Delete</button>
	`);

	for (const entry of instClass) {
		const row = new Row();
		row.addTitle(entry.title);
		row.addSubtitle(entry.level || 'No level');
		row.addSubtitle(entry.type_name || 'No type');
		row.addLink(`/class-info.html?id=${entry.class_id}`);
		row.addDeleteButton();

		row.deleteButton.addEventListener('click', e => {
			e.stopPropagation();
			deleteModal.show();

			const btn = document.getElementById('delete-button');
			btn.onclick = async () => {
				await deleteClassInstructorLink(entry.class_id, instructorId);
				const updated = await fetchClassForInstructors(instructorId);
				await setupClasses(updated, instructorId);
				deleteModal.close();
			};
		});

		container.appendChild(row.row);
	}

	const addRow = new Row();
	addRow.addSubtitle('<b>＋</b> Add class');
	addRow.row.addEventListener('click', () => showClassModal(instructorId));
	container.appendChild(addRow.row);
}

async function showClassModal(instructorId) {
	const oldModal = document.getElementById('class-modal');
	if (oldModal) oldModal.remove();

	const modal = new Modal('class-modal');
	modal.content(`
		<h4>Select a Class</h4>
		<form>
			<input id="searchable" placeholder="Search classes">
			<ul id="results" class="drop-down-select"></ul>
			<div class="seperator"></div>
			<button type="submit">Add Instructor</button>
		</form>
	`);

	const classData = await read('classes');
	await createSearchableDropdown(
		'searchable',
		'results',
		classData,
		'title'
	);

	modal.formSubmit(async () => {
		const classId =
			document.getElementById('searchable').getAttribute('row-id');

		await linkInstructorToClass({
			instructor_id: instructorId,
			class_id: classId
		});

		const updated = await fetchClassForInstructors(instructorId);
		await setupClasses(updated, instructorId);
	}, '', 'other');

	modal.show();
}

/* -----------------------------
    Certifications
----------------------------- */

function setupCTE(instructorRecord, instructorId) {
	const moreInfo = document.getElementById('more-info');
	moreInfo.innerHTML = '';

	const modal = new Modal('cte-modal');
	modal.content(`
		<h4>Instructor CTE</h4>
 		<form id="edit-cte">
 			<label>CTE
 				<input id="cte" class="small-input" type="checkbox" name="cte">
 			</label>
			<label>Exam Committee
 				<input id="exam" class="small-input" type="checkbox" name="exam">
 			</label>
			<label>Tuning Tutor
 				<input id="tutor" class="small-input" type="checkbox" name="tutor">
 			</label>
 			<div class="seperator"></div>
 			<button type="submit">Update Certifications</button>
 		</form>
	`);

	let examInfo = {
		cte: instructorRecord.cte,
		exam: instructorRecord.exam,
		tutor: instructorRecord.tutor
	}

	const cteRow = new Row();
	cteRow.addTitle('Examiner Certifications', 'cte-title');
	cteRow.addSubtitle(examInfo.cte?'CTE':'', 'cte-subtitle');
	cteRow.addSubtitle(examInfo.tutor?'Exam Tutor':'', 'exam-subtitle')
	cteRow.addSubtitle(examInfo.exam?'Instructor is on the exam committee':'', 'committee-subtitle');
	moreInfo.appendChild(cteRow.row);

	cteRow.row.addEventListener('click', () => {
		modal.show();
		document.getElementById('cte').checked = examInfo.cte;
		document.getElementById('exam').checked = examInfo.exam;
		document.getElementById('tutor').checked = examInfo.tutor;
	});

	modal.formSubmit(async () => {
		const updated = await fetchInstructor(instructorId);
		examInfo = {
			cte: updated.cte,
			exam: updated.exam,
			tutor: updated.tutor
		}
		document.getElementById('cte-subtitle').textContent = examInfo.cte?'CTE':'', 'cte-subtitle';
		document.getElementById('exam-subtitle').textContent = examInfo.tutor?'Exam Tutor':'', 'exam-subtitle';
		document.getElementById('committee-subtitle').textContent = examInfo.exam?'Instructor is on the exam committee':'';
	}, 'instructors');
}

/* -----------------------------
    Board
----------------------------- */

function setupBoard(instructorRecord, instructorId) {
	const moreInfo = document.getElementById('more-info');

	const modal = new Modal('board-modal');
	modal.content(`
		<h4>Instructor Board Status</h4>
 		<form id="edit-board">
 			<label>Board Member
 				<input id="board" class="small-input" type="checkbox" name="board">
 			</label>
 			<div class="seperator"></div>
 			<button type="submit">Update Board Status</button>
 		</form>
	`);

	let board = instructorRecord.board;

	const boardRow = new Row();
	boardRow.addTitle('Board Status', 'board-title');
	boardRow.addSubtitle(board?'Instructor is on the board':'Instructor is not on the board', 'board-subtitle');
	moreInfo.appendChild(boardRow.row);

	boardRow.row.addEventListener('click', () => {
		modal.show();
		document.getElementById('board').checked = board;
	});

	modal.formSubmit(async () => {
		const updated = await fetchInstructor(instructorId);
		board = updated.board;
		document.getElementById('board-subtitle').textContent = board?'Instructor is on the board':'Instructor is not on the board';
	}, 'instructors');
}

/* -----------------------------
    Delete Instructor
----------------------------- */

async function setupDeleteInstructor(instructorId) {
	const modal = new Modal('delete-instructor-modal');
	modal.content(`
		<h4>Permanently delete instructor record?</h4>
		<button id="delete-instructor-button" class="red">Delete</button>
	`);

	document.getElementById('delete-instructor').addEventListener('click', () => {
		modal.show();
	});

	document.getElementById('delete-instructor-button')?.addEventListener('click', async () => {
		await deleteEntry('instructors', instructorId);
		window.location.href = '/instructors.html';
	});
}