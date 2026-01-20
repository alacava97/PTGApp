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

async function fetchClassHistory(classId) {
	const res = await fetch(`/api/classFromSchedule/${classId}`);
	if (!res.ok) throw new Error('Network error');
	return res.json();
}

/* -----------------------------
   Page Setup
----------------------------- */

async function loadClassData(classId) {
	try {
		const [classRecord, instructors, classHistory] = await Promise.all([
			fetchClass(classId),
			fetchInstructorsForClass(classId),
			fetchClassHistory(classId)
		]);

		setupTitle(classRecord, classId);
		setupDescription(classRecord);
		setupDetails(classRecord);
		setupSponsor(classRecord);
		setupNotes(classRecord);
		setupHistory(classHistory);
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
   Description
----------------------------- */

function setupDescription(classRecord) {
	const container = document.getElementById('description');
	container.innerHTML = '';

	const modal = new Modal('description-modal');
	modal.content(`
		<h4>Update Description</h4>
		<form>
			<textarea id="description-area" name="description" class="fit-content"></textarea>
			<div class="seperator"></div>
			<button type="submit">Submit</button>
		</form>
	`);

	let description = classRecord.description;

	const row = new Row();
	row.addSubtitle(description || 'No description', 'description-row');
	container.appendChild(row.row);

	row.row.addEventListener('click', () => {
		modal.show();
		document.getElementById('description-area').value = description;
	});

	modal.formSubmit(async () => {
		const updated = await fetchClass(getId());
		document.getElementById('description-row').textContent = updated.description || 'No description';
		description = updated.description;
	}, 'classes');
}

/* -----------------------------
   Details
----------------------------- */

function setupDetails(classRecord) {
	const container = document.getElementById('details');
	container.innerHTML = '';

	const modal = new Modal('detail-modal');
	modal.content(`
		<h4>Update Class Details</h4>
		<form>
			<label for="length-input">Length</label>
			<input type="number" min="1" max="5" name="length" id="length-input">
			<div class="seperator"></div>
			<label for="type-select"></label>
			<select name="type" id="type-select"></select>
			<div class="seperator"></div>
			<label for="level-select"></label>
			<select name="level" id="level-select">
				<option value="everyone">Everyone</option>
				<option value="beginner">Beginner</option>
				<option value="intermediate">Intermediate</option>
				<option value="advanced">Advanced</option>
			</select>
			<div class="seperator"></div>
			<label for="uprights">Uprights</label>
			<input id="uprights" name="uprights" type="number">
			<div class="seperator"></div>
			<label for="grands">Grands</label>
			<input id="grands" name="grands" type="number">
			<div class="seperator"></div>
			<button type="submit">Submit</button>
		</form>
	`);

	let details = {
		length: classRecord.length,
		type: classRecord.type_name,
		typeId: classRecord.type || 'No type',
		level: classRecord.level,
		uprights: classRecord.uprights || 0,
		grands: classRecord.grands || 0
	}

	let lengthValue = details.length
		? `${details.length} ${details.length === 1 ? 'period' : 'periods'}`
		: 'No length';

	const row = new Row();
	row.addTitle('Details', 'details-title');
	row.addSubtitle(`Length: ${lengthValue}`, 'length-subtitle');
	row.addSubtitle(`Type: ${details.type || 'No type'}`, 'type-subtitle');
	row.addSubtitle(`Level: ${details.level?details.level.charAt(0).toUpperCase() + details.level.slice(1):'No level'}`, 'level-subtitle');
	row.addSubtitle(`Uprights: ${details.uprights}`, 'upright-subtitle');
	row.addSubtitle(`Grands: ${details.grands}`, 'grand-subtitle');

	row.row.addEventListener('click', () => {
		modal.show();
		document.getElementById('length-input').value = details.length;
		document.getElementById('type-select').value = details.typeId;
		document.getElementById('level-select').value = details.level;
		document.getElementById('uprights').value = details.uprights;
		document.getElementById('grands').value = details.grands;
	});

	container.appendChild(row.row);

	modal.formSubmit(async () => {
		const updated = await fetchClass(classRecord.id);
		details = {
			length: updated.length,
			type: updated.type_name,
			typeId: updated.type,
			level: updated.level,
			uprights: updated.uprights || 0,
			grands: updated.grands || 0	
		}

		document.getElementById('length-subtitle').textContent = `Length: ${details.length} ${details.length === 1 ? 'period' : 'periods'}`;
		document.getElementById('type-subtitle').textContent = `Type: ${details.type}`;
		document.getElementById('level-subtitle').textContent = `Level: ${details.level.charAt(0).toUpperCase() + details.level.slice(1)}`;
		document.getElementById('upright-subtitle').textContent = `Uprights: ${details.uprights}`;
		document.getElementById('grand-subtitle').textContent = `Grands: ${details.grands}`;
	}, 'classes');
}

/* -----------------------------
   Notes
----------------------------- */

function setupNotes(classRecord) {
	const container = document.getElementById('notes');
	container.innerHTML = '';

	const modal = new Modal('notes-modal');
	modal.content(`
		<h4>Update Notes</h4>
		<form>
			<textarea id="notes-area" name="notes" class="fit-content"></textarea>
			<div class="seperator"></div>
			<button type="submit">Submit</button>
		</form>
	`);

	let notes = classRecord.notes;

	const row = new Row();
	row.addSubtitle(notes || 'No notes', 'notes-row');
	container.appendChild(row.row);

	row.row.addEventListener('click', () => {
		modal.show();
		document.getElementById('notes-area').value = notes;
	});

	modal.formSubmit(async () => {
		const updated = await fetchClass(getId());
		document.getElementById('notes-row').textContent = updated.notes || 'No notes';
		notes = updated.notes;
	}, 'classes');
}

/* -----------------------------
    Sponsored
----------------------------- */

function setupSponsor(classRecord) {
	const moreInfo = document.getElementById('more-info');
	moreInfo.innerHTML = '';

	const oldModal = document.getElementById('sponsor-modal');
	if (oldModal) oldModal.remove();

	const modal = new Modal('sponsor-modal');
	modal.content(`
		<h4>Instructor Sponsor</h4>
 		<form id="edit-sponsor">
 			<label>Sponsored
 				<input id="sponsored" class="small-input" type="checkbox" name="sponsored">
 			</label>
 			<div class="seperator"></div>
 			<input type="text" name="sponsor" autocomplete="off" placeholder="Sponsor" id="sponsor">
 			<button type="submit">Update Sponsor</button>
 		</form>
	`);

	document.getElementById('sponsored').addEventListener('change', sponsorCheck);

	let sponsored = {
		sponsored: classRecord.sponsored,
		sponsor: classRecord.sponsor
	}

	const sponsorRow = new Row();
	sponsorRow.addTitle('Sponsor', 'sponsored-row');
	sponsorRow.addSubtitle(sponsored.sponsored?sponsored.sponsor:'No sponsor on record', 'sponsor-row');
	moreInfo.appendChild(sponsorRow.row);

	sponsorRow.row.addEventListener('click', () => {
		modal.show();
		document.getElementById('sponsored').checked = sponsored.sponsored;
		document.getElementById('sponsor').value = sponsored.sponsor || '';
		sponsorCheck();
	});

	modal.formSubmit(async () => {
		const updated = await fetchClass(classRecord.id);
		sponsored = {
			sponsored: updated.sponsored,
			sponsor: updated.sponsor
		}
		document.getElementById('sponsored-row').textContent = sponsored.sponsored?'Sponsor':'No sponsor on record', 'sponsor-row';
		document.getElementById('sponsor-row').textContent = sponsored.sponsored?sponsored.sponsor:'';
	}, 'classes');
}

/* -----------------------------
   History
----------------------------- */

function setupHistory(classHistory) {
	const container = document.getElementById('history');
	container.innerHTML = '';
	console.log(classHistory)
	let history = classHistory;

	const row = new Row();
	row.addTitle('Class History');
	if (history.length < 1) {
		row.addSubtitle('No history');
	}
	history.forEach(year => {
		row.addSubtitle(`Taught ${year.times_taught}${year.times_taught == 1?' time':' times'} in ${year.year} - ${formatRating(year.rating) || 'No data'}/5 ★`);
	});

	container.appendChild(row.row);
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

function formatRating(rating) {
	if (rating === null || rating === undefined) return 'No data';

	const num = Number(rating);

	if (Number.isNaN(num)) return 'No data';

	// Whole number → no decimal
	if (Number.isInteger(num)) {
		return num;
	}

	// Decimal → 1 place
	return num.toFixed(1);
}
