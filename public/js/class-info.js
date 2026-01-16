document.addEventListener('DOMContentLoaded', initClassPage);

async function initClassPage() {
	const classId = getId();

	await setupDeleteClass(classId);
	await loadClassData(classId);
	await setupDropdowns();
}

/* -----------------------------
   Data Fetching
----------------------------- */

async function fetchClass(classId) {
	const res = await fetch(`/api/readEntry/classes/${classId}`);
	if (!res.ok) throw new Error('Network error');
	return res.json();
}

async function fetchInstructorsForClass(classId) {
	const res = await fetch(`/api/instByClass/${classId}`);
	if (!res.ok) throw new Error('Network error');
	return res.json();
}

/* -----------------------------
   Page Setup
----------------------------- */

async function loadClassData(classId) {
	try {
		const [classRecord, instructors] = await Promise.all([
			fetchClass(classId),
			fetchInstructorsForClass(classId)
		]);

		setupTitle(classRecord, classId);
		setupLength(classRecord);
		setupType(classRecord);
		setupLevel(classRecord);
		await setupInstructors(instructors, classId);

	} catch (err) {
		console.error('Internal server error:', err);
	}
}

/* -----------------------------
   Title
----------------------------- */

function setupTitle(classRecord, classId) {
	const title = document.getElementById('class-title');

	const modal = new Modal('title-modal');
	modal.content(`
		<h4>Update Class Title</h4>
		<form>
			<input type="text" name="title" id="title-input">
			<div class="seperator"></div>
			<button type="submit">Submit</button>
		</form>
	`);

	let classTitle = classRecord.title

	title.textContent = `${classRecord.title} ✎`;
	title.addEventListener('click', () => {
		modal.show();
		document.getElementById('title-input').value = classTitle;
	});

	modal.formSubmit(async () => {
		const updated = await fetchClass(classId);
		title.textContent = `${updated.title} ✎`;
		classTitle = updated.title;
	}, 'classes');
}

/* -----------------------------
   Length
----------------------------- */

function setupLength(classRecord) {
	const container = document.getElementById('length');
	container.innerHTML = '';

	const modal = new Modal('length-modal');
	modal.content(`
		<h4>Update Class Length</h4>
		<form>
			<input type="number" min="1" max="5" name="length" id="length-input">
			<div class="seperator"></div>
			<button type="submit">Submit</button>
		</form>
	`);

	const row = new Row();
	const value = classRecord.length
		? `${classRecord.length} ${classRecord.length === 1 ? 'period' : 'periods'}`
		: 'No length';

	let length = classRecord.length;

	row.addTitle(value, 'length-title');
	row.row.addEventListener('click', () => {
		modal.show();
		document.getElementById('length-input').value = length;
	});

	container.appendChild(row.row);

	modal.formSubmit(async () => {
		const updated = await fetchClass(getId());
		document.getElementById('length-title').textContent =
			`${updated.length} ${updated.length === 1 ? 'period' : 'periods'}`;
			length = updated.length;
	}, 'classes');
}

/* -----------------------------
   Type
----------------------------- */

function setupType(classRecord) {
	const container = document.getElementById('type');
	container.innerHTML = '';

	const modal = new Modal('type-modal');
	modal.content(`
		<h4>Update Type</h4>
		<form>
			<select name="type" id="type-select"></select>
			<div class="seperator"></div>
			<button type="submit">Submit</button>
		</form>
	`);

	const row = new Row();
	row.addTitle(classRecord.type_name || 'No type', 'type-title');
	container.appendChild(row.row);

	let type = classRecord.type;

	row.row.addEventListener('click', () => {
		modal.show();
		document.getElementById('type-select').value = type;
	});

	modal.formSubmit(async () => {
		const updated = await fetchClass(getId());
		document.getElementById('type-title').textContent = updated.type_name;
		type = updated.type;
	}, 'classes');
}

/* -----------------------------
   Level
----------------------------- */

function setupLevel(classRecord) {
	const container = document.getElementById('level');
	container.innerHTML = '';

	const modal = new Modal('level-modal');
	modal.content(`
		<h4>Update Level</h4>
		<form>
			<select name="level" id="level-select">
				<option value="everyone">Everyone</option>
				<option value="beginner">Beginner</option>
				<option value="intermediate">Intermediate</option>
				<option value="advanced">Advanced</option>
			</select>
			<div class="seperator"></div>
			<button type="submit">Submit</button>
		</form>
	`);

	const levelText =
		classRecord.level.charAt(0).toUpperCase() + classRecord.level.slice(1);

	const row = new Row();
	row.addTitle(levelText, 'level-title');
	container.appendChild(row.row);

	let level = classRecord.level;

	row.row.addEventListener('click', () => {
		modal.show();
		document.getElementById('level-select').value = level;
	});

	modal.formSubmit(async () => {
		const updated = await fetchClass(getId());
		document.getElementById('level-title').textContent =
			updated.level.charAt(0).toUpperCase() + updated.level.slice(1);
		level = updated.level
	}, 'classes');
}

/* -----------------------------
   Instructors
----------------------------- */

async function setupInstructors(instClass, classId) {
	const container = document.getElementById('instructors');
	container.innerHTML = '';

	const oldModal = document.getElementById('delete-confirmation-modal');
	if (oldModal) oldModal.remove();
	const deleteModal = new Modal('delete-confirmation-modal');
	deleteModal.content(`
		<h4>Remove instructor from class record?</h4>
		<button id="delete-button" class="red">Delete</button>
	`);

	for (const entry of instClass) {
		const row = new Row();
		row.addTitle(entry.instructor_name);
		row.addSubtitle(entry.sponsor || 'No sponsor');
		row.addLink(`/instructor-info.html?id=${entry.instructor_id}`);
		row.addDeleteButton();

		row.deleteButton.addEventListener('click', e => {
			e.stopPropagation();
			deleteModal.show();

			const btn = document.getElementById('delete-button');
			btn.onclick = async () => {
				await deleteClassInstructorLink(classId, entry.instructor_id);
				const updated = await fetchInstructorsForClass(classId);
				await setupInstructors(updated, classId);
				deleteModal.close();
			};
		});

		container.appendChild(row.row);
	}

	const addRow = new Row();
	addRow.addSubtitle('<b>＋</b> Add instructor');
	addRow.row.addEventListener('click', () => showInstructorModal(classId));
	container.appendChild(addRow.row);
}

async function showInstructorModal(classId) {
	const oldModal = document.getElementById('instructor-modal');
	if (oldModal) oldModal.remove();

	const modal = new Modal('instructor-modal');
	modal.content(`
		<h4>Select an Instructor</h4>
		<form>
			<input id="searchable" placeholder="Search instructors">
			<ul id="results" class="drop-down-select"></ul>
			<div class="seperator"></div>
			<button type="submit">Add Instructor</button>
		</form>
	`);

	const instructorData = await read('instructors');
	await createSearchableDropdown(
		'searchable',
		'results',
		instructorData,
		'name'
	);

	modal.formSubmit(async () => {
		const instId =
			document.getElementById('searchable').getAttribute('row-id');

		await linkInstructorToClass({
			instructor_id: instId,
			class_id: classId
		});

		const updated = await fetchInstructorsForClass(classId);
		await setupInstructors(updated, classId);
	}, '', 'other');

	modal.show();
}


/* -----------------------------
   Delete Class
----------------------------- */

async function setupDeleteClass(classId) {
	const modal = new Modal('delete-class-modal');
	modal.content(`
		<h4>Permanently delete class record?</h4>
		<button id="delete-class-button" class="red">Delete</button>
	`);

	document.getElementById('delete-class').addEventListener('click', () => {
		modal.show();
	});

	document.getElementById('delete-class-button')?.addEventListener('click', async () => {
		await deleteEntry('classes', classId);
		window.location.href = '/classes.html';
	});
}

/* -----------------------------
   Dropdowns
----------------------------- */

async function setupDropdowns() {
	const typeDD = document.getElementById('type-select');
	if (typeDD) {
		await populateDropdown(typeDD, 'types', 'type');
	}
}