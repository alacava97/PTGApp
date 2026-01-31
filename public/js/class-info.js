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
		setupClassSetup(classRecord);
		pianoSetup(classRecord);
		setupSponsor(classRecord);
		setupNotes(classRecord);
		setupHistory(classHistory, classId);
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
			<label for="type-select">Type</label>
			<select name="type" id="type-select"></select>
			<div class="seperator"></div>
			<label for="level-select">Level</label>
			<select name="level" id="level-select">
				<option value="introductory">Introductory</option>
				<option value="foundational">Foundational</option>
				<option value="intermediate">Intermediate</option>
				<option value="advanced">Advanced</option>
				<option value="everyone">Everyone</option>
			</select>
			<div class="seperator"></div>
			<label for="sessions">Sessions</label>
			<input id="sessions" name="sessions" type="number">
			<div class="seperator"></div>
			<button type="submit">Submit</button>
		</form>
	`);

	let details = {
		length: classRecord.length,
		type: classRecord.type_name,
		typeId: classRecord.type || 'No type',
		level: classRecord.level,
		sessions: classRecord.sessions || 0
	}

	let lengthValue = details.length
		? `${details.length} ${details.length === 1 ? 'period' : 'periods'}`
		: 'No length';

	const row = new Row();
	row.addTitle('Details', 'details-title');
	row.addSubtitle(`Length: ${lengthValue}`, 'length-subtitle');
	row.addSeparator();
	row.addSubtitle(`Type: ${details.type || 'No type'}`, 'type-subtitle');
	row.addSeparator();
	row.addSubtitle(`Level: ${details.level?details.level.charAt(0).toUpperCase() + details.level.slice(1):'No level'}`, 'level-subtitle');
	row.addSeparator();
	row.addSubtitle(`Sessions: ${details.sessions}`, 'session-subtitle');

	row.row.addEventListener('click', () => {
		modal.show();
		document.getElementById('length-input').value = details.length;
		document.getElementById('type-select').value = details.typeId;
		document.getElementById('level-select').value = details.level;
		document.getElementById('sessions').value = details.sessions;
	});

	container.appendChild(row.row);

	modal.formSubmit(async () => {
		const updated = await fetchClass(classRecord.id);
		details = {
			length: updated.length,
			type: updated.type_name,
			typeId: updated.type,
			level: updated.level,
			sessions: updated.sessions || 0
		}

		document.getElementById('length-subtitle').textContent = `Length: ${details.length} ${details.length === 1 ? 'period' : 'periods'}`;
		document.getElementById('type-subtitle').textContent = `Type: ${details.type}`;
		document.getElementById('level-subtitle').textContent = `Level: ${details.level.charAt(0).toUpperCase() + details.level.slice(1)}`;
		document.getElementById('session-subtitle').textContent = `Sessions: ${details.sessions}`;
	}, 'classes');
}

/* -----------------------------
   Class Setup
----------------------------- */

function setupClassSetup(classRecord) {
	const container = document.getElementById('setup');
	container.innerHTML = '';

	const modal = new Modal('setup-modal');
	modal.content(`
		<h4>Update Class Setup</h4>
		<form>
			<label for="conflict">Conflicts</label>
			<textarea id="conflicts" name="conflicts"></textarea>
			<div class="seperator"></div>
			<label for="preferences">Preferences</label>
			<textarea name="preferences" id="preferences"></textarea>
			<div class="seperator"></div>
			<label for="class_requirements">Class Requirements</label>
			<textarea name="class_requirements" id="class_requirements"></textarea>
			<div class="seperator"></div>
			<label for="prep_time">Prep Time</label>
			<select id="prep_time" name="prep_time">
				<option value="10 minutes">10 Minutes</option>
				<option value="15 minutes">15 Minutes</option>
				<option value="30 minutes">30 Minutes</option>
				<option value="1 hour">1 hour</option>
				<option value="More than 1 hour">More than 1 hour</option>
			</select>
			<div class="seperator"></div>
			<label for="seating">Seating</label>
			<select id="seating" name="seating">
				<option value="either">Either</option>
				<option value="theater">Theater</option>
				<option value="classroom">Classroom</option>
			</select>
			<div class="seperator"></div>
			<label for="extra_tables">Extra Tables</label>
			<input id="extra_tables" name="extra_tables" type="number">
			<div class="seperator"></div>
			<label for="av">AV Needs</label>
			<textarea name="av" id="av"></textarea>
			<div class="seperator"></div>
			<label for="special_equipment">Special Equipment</label>
			<textarea name="special_equipment" id="special_equipment"></textarea>
			<div class="seperator"></div>
			<button type="submit">Submit</button>
		</form>
	`);

	let setup = {
		conflicts: classRecord.conflicts || '',
		preferences: classRecord.preferences || '',
		class_requirements: classRecord.class_requirements || '',
		prep_time: classRecord.prep_time || '',
		seating: classRecord.seating || 'either',
		extra_tables: classRecord.extra_tables || '',
		av: classRecord.av || '',
		special_equipment: classRecord.special_equipment || ''
	}

	const row = new Row();
	row.addTitle('Class Setup', 'setup-title');
	row.addSubtitle(`Conflicts: ${setup.conflicts}`, 'conflict-subtitle');
	row.addSeparator();
	row.addSubtitle(`Preferences: ${setup.preferences}`, 'preference-subtitle');
	row.addSeparator();
	row.addSubtitle(`Requirements: ${setup.class_requirements}`, 'requirement-subtitle');
	row.addSeparator();
	row.addSubtitle(`Prep Time: ${setup.prep_time}`, 'preptime-subtitle');
	row.addSeparator();
	row.addSubtitle(`Seating: ${setup.seating}`, 'seating-subtitle');
	row.addSeparator();
	row.addSubtitle(`Extra Tables: ${setup.extra_tables}`, 'extratable-subtitle');
	row.addSeparator();
	row.addSubtitle(`AV Needs: ${setup.av}`, 'av-subtitle');
	row.addSeparator();
	row.addSubtitle(`Special Equipment: ${setup.special_equipment}`, 'equipment-subtitle');

	row.row.addEventListener('click', () => {
		modal.show();
		document.getElementById('conflicts').value = setup.conflicts;
		document.getElementById('preferences').value = setup.preferences;
		document.getElementById('class_requirements').value = setup.class_requirements;
		document.getElementById('prep_time').value = setup.prep_time;
		document.getElementById('seating').value = setup.seating;
		document.getElementById('extra_tables').value = setup.extra_tables;
		document.getElementById('av').value = setup.av;
		document.getElementById('special_equipment').value = setup.special_equipment;
	});

	container.appendChild(row.row);

	modal.formSubmit(async () => {
		const updated = await fetchClass(classRecord.id);
		setup = {
			conflicts: updated.conflicts || '',
			preferences: updated.preferences || '',
			class_requirements: updated.class_requirements || '',
			prep_time: updated.prep_time || '',
			seating: updated.seating || 'either',
			extra_tables: updated.extra_tables || '',
			av: updated.av || '',
			special_equipment: updated.special_equipment || ''
		}

		document.getElementById('conflict-subtitle').textContent = `Conflicts: ${setup.conflicts}`;
		document.getElementById('preference-subtitle').textContent = `Preferences: ${setup.preferences}`;
		document.getElementById('requirement-subtitle').textContent = `Requirements: ${setup.class_requirements}`;
		document.getElementById('preptime-subtitle').textContent = `Prep Time: ${setup.prep_time}`;
		document.getElementById('seating-subtitle').textContent = `Seating: ${setup.seating}`;
		document.getElementById('extratable-subtitle').textContent = `Extra Tables: ${setup.extra_tables}`;
		document.getElementById('av-subtitle').textContent = `AV Needs: ${setup.av}`;
		document.getElementById('equipment-subtitle').textContent = `Special Equipment: ${setup.special_equipment}`;
	}, 'classes');
}

/* -----------------------------
   Piano Setup
----------------------------- */

function pianoSetup(classRecord) {
	const container = document.getElementById('pianos');

	const modal = new Modal('setup-modal');
	modal.content(`
		<h4>Update Piano Setup</h4>
		<form>
			<label for="piano">Pianos Needed</label>
			<input name="piano" id="piano" type="number" min="0" max="2">
			<div class="seperator"></div>
			<div class="flex-cols">
				<div id="piano1" class="sub-form">
					<span><b>Piano 1</b></span>
					<div class="seperator"></div>

					<label for="piano-1-type">Type</label>
					<input id="piano-1-type" name="piano_1_type" type="text">
					<div class="seperator"></div>

					<label for="piano-1-quality">Quality</label>
					<textarea id="piano-1-quality" name="piano_1_quality"></textarea>
					<div class="seperator"></div>

					<label for="piano-1-size">Size</label>
					<input id="piano-1-size" name="piano_1_size" type="text">
					<div class="seperator"></div>

					<label for="piano-1-supplier">Supplier</label>
					<textarea id="piano-1-supplier" name="piano_1_supplier"></textarea>
					<div class="seperator"></div>

					<label for="piano-1-manufacturer">Manufacturer</label>
					<input id="piano-1-manufacturer" name="piano_1_manufacturer" type="text">
					<div class="seperator"></div>

					<label for="piano-1-share">Shared
						<input id="piano-1-share" name="piano_1_share" type="checkbox">
					</label>
					<div class="seperator"></div>

					<label for="piano-1-requirements">Requirements</label>
					<input id="piano-1-requirements" name="piano_1_requirements" type="text">
					<div class="seperator"></div>
				</div>

				<div id="piano2" class="sub-form">
					<span><b>Piano 2</b></span>
					<div class="seperator"></div>

					<label for="piano-2-type">Type</label>
					<input id="piano-2-type" name="piano_2_type" type="text">
					<div class="seperator"></div>

					<label for="piano-2-quality">Quality</label>
					<textarea id="piano-2-quality" name="piano_2_quality"></textarea>
					<div class="seperator"></div>

					<label for="piano-2-size">Size</label>
					<input id="piano-2-size" name="piano_2_size" type="text">
					<div class="seperator"></div>

					<label for="piano-2-supplier">Supplier</label>
					<textarea id="piano-2-supplier" name="piano_2_supplier"></textarea>
					<div class="seperator"></div>

					<label for="piano-2-manufacturer">Manufacturer</label>
					<input id="piano-2-manufacturer" name="piano_2_manufacturer" type="text">
					<div class="seperator"></div>

					<label for="piano-2-share">Shared
						<input id="piano-2-share" name="piano_2_share" type="checkbox">
					</label>
					<div class="seperator"></div>

					<label for="piano-2-requirements">Requirements</label>
					<input id="piano-2-requirements" name="piano_2_requirements" type="text">
					<div class="seperator"></div>
				</div>
			</div>
			<button type="submit">Submit</button>
		</form>
	`);

	document.getElementById('piano').addEventListener('change', (e) => {
		checkPianos(e.target.value)
	});

	let pianos = {
		piano: classRecord.piano || 0,
		piano1: {
			type: classRecord.piano_1_type || '',
			quality: classRecord.piano_1_quality || '',
			size: classRecord.piano_1_size || '',
			supplier: classRecord.piano_1_supplier || '',
			manufacturer: classRecord.piano_1_manufacturer || '',
			share: classRecord.piano_1_share || 'false',
			requirements: classRecord.piano_1_requirements || ''
		},
		piano2: {
			type: classRecord.piano_2_type || '',
			quality: classRecord.piano_2_quality || '',
			size: classRecord.piano_2_size || '',
			supplier: classRecord.piano_2_supplier || '',
			manufacturer: classRecord.piano_2_manufacturer || '',
			share: classRecord.piano_2_share || 'false',
			requirements: classRecord.piano_2_requirements || ''
		}
	}

	const row = new Row();
	row.addTitle('Piano Needs', 'piano-title');
	row.addSubtitle('No Pianos Needed', 'no-piano');

	const pianoSection = document.getElementById('pianos')
	
	pianoSection.insertBefore(
			row.row,
			pianoSection.firstChild
		);

	const piano1Row = new Row();
	piano1Row.addTitle('Piano 1');
	piano1Row.addSubtitle(`Type: ${pianos.piano1.type}`, 'piano-1-type-subtitle');
	piano1Row.addSeparator();
	piano1Row.addSubtitle(`Quality: ${pianos.piano1.quality}`, 'piano-1-quality-subtitle');
	piano1Row.addSeparator();
	piano1Row.addSubtitle(`Size: ${pianos.piano1.size}`, 'piano-1-size-subtitle');
	piano1Row.addSeparator();
	piano1Row.addSubtitle(`Supplier: ${pianos.piano1.supplier}`, 'piano-1-supplier-subtitle');
	piano1Row.addSeparator();
	piano1Row.addSubtitle(`Manufacturer: ${pianos.piano1.manufacturer}`, 'piano-1-manufacturer-subtitle');
	piano1Row.addSeparator();
	piano1Row.addSubtitle(`Shared: ${pianos.piano1.share}`, 'piano-1-share-subtitle');
	piano1Row.addSeparator();
	piano1Row.addSubtitle(`Requirements: ${pianos.piano1.requirements}`, 'piano-1-requirements-subtitle');

	document.getElementById('piano1-info').appendChild(piano1Row.row);

	const piano2Row = new Row();
	piano2Row.addTitle('Piano 2');
	piano2Row.addSubtitle(`Type: ${pianos.piano2.type}`, 'piano-2-type-subtitle');
	piano2Row.addSeparator();
	piano2Row.addSubtitle(`Quality: ${pianos.piano2.quality}`, 'piano-2-quality-subtitle');
	piano2Row.addSeparator();
	piano2Row.addSubtitle(`Size: ${pianos.piano2.size}`, 'piano-2-size-subtitle');
	piano2Row.addSeparator();
	piano2Row.addSubtitle(`Supplier: ${pianos.piano2.supplier}`, 'piano-2-supplier-subtitle');
	piano2Row.addSeparator();
	piano2Row.addSubtitle(`Manufacturer: ${pianos.piano2.manufacturer}`, 'piano-2-manufacturer-subtitle');
	piano2Row.addSeparator();
	piano2Row.addSubtitle(`Shared: ${pianos.piano2.share}`, 'piano-2-share-subtitle');
	piano2Row.addSeparator();
	piano2Row.addSubtitle(`Requirements: ${pianos.piano2.requirements}`, 'piano-2-requirements-subtitle');

	document.getElementById('piano2-info').appendChild(piano2Row.row);

	checkPianoRows(pianos);

	container.addEventListener('click', () => {
		modal.show();
		checkPianos(pianos.piano);
		document.getElementById('piano').value = pianos.piano;
		document.getElementById('piano-1-type').value = pianos.piano1.type;
		document.getElementById('piano-1-quality').value = pianos.piano1.quality;
		document.getElementById('piano-1-size').value = pianos.piano1.size;
		document.getElementById('piano-1-supplier').value = pianos.piano1.supplier;
		document.getElementById('piano-1-manufacturer').value = pianos.piano1.manufacturer;
		document.getElementById('piano-1-share').checked = pianos.piano1.share;
		document.getElementById('piano-1-requirements').value = pianos.piano1.requirements;

		document.getElementById('piano-2-type').value = pianos.piano2.type;
		document.getElementById('piano-2-quality').value = pianos.piano2.quality;
		document.getElementById('piano-2-size').value = pianos.piano2.size;
		document.getElementById('piano-2-supplier').value = pianos.piano2.supplier;
		document.getElementById('piano-2-manufacturer').value = pianos.piano2.manufacturer;
		document.getElementById('piano-2-share').checked = pianos.piano2.share;
		document.getElementById('piano-2-requirements').value = pianos.piano2.requirements;
	});

	modal.formSubmit(async () => {
		const updated = await fetchClass(classRecord.id);
		pianos = {
			piano: updated.piano || 0,
			piano1: {
				type: updated.piano_1_type || '',
				quality: updated.piano_1_quality || '',
				size: updated.piano_1_size || '',
				supplier: updated.piano_1_supplier || '',
				manufacturer: updated.piano_1_manufacturer || '',
				share: updated.piano_1_share || 'false',
				requirements: updated.piano_1_requirements || ''
			},
			piano2: {
				type: updated.piano_2_type || '',
				quality: updated.piano_2_quality || '',
				size: updated.piano_2_size || '',
				supplier: updated.piano_2_supplier || '',
				manufacturer: updated.piano_2_manufacturer || '',
				share: updated.piano_2_share || 'false',
				requirements: updated.piano_2_requirements || ''
			}
		}

		if (pianos.piano >=1) {
			console.log('test');
			document.getElementById('piano-1-type-subtitle').textContent = `Type: ${pianos.piano1.type}`;
			document.getElementById('piano-1-quality-subtitle').textContent = `Quality: ${pianos.piano1.quality}`;
			document.getElementById('piano-1-size-subtitle').textContent = `Size: ${pianos.piano1.size}`;
			document.getElementById('piano-1-supplier-subtitle').textContent = `Supplier: ${pianos.piano1.supplier}`;
			document.getElementById('piano-1-manufacturer-subtitle').textContent = `Manufacturer: ${pianos.piano1.manufacturer}`;
			document.getElementById('piano-1-share-subtitle').textContent = `Shared: ${pianos.piano1.share}`;
			document.getElementById('piano-1-requirements-subtitle').textContent = `Requirements: ${pianos.piano1.requirements}`;
		}

		if (pianos.piano >=2) {
			document.getElementById('piano-2-type-subtitle').textContent = `Type: ${pianos.piano2.type}`;
			document.getElementById('piano-2-quality-subtitle').textContent = `Quality: ${pianos.piano2.quality}`;
			document.getElementById('piano-2-size-subtitle').textContent = `Size: ${pianos.piano2.size}`;
			document.getElementById('piano-2-supplier-subtitle').textContent = `Supplier: ${pianos.piano2.supplier}`;
			document.getElementById('piano-2-manufacturer-subtitle').textContent = `Manufacturer: ${pianos.piano2.manufacturer}`;
			document.getElementById('piano-2-share-subtitle').textContent = `Shared: ${pianos.piano2.share}`;
			document.getElementById('piano-2-requirements-subtitle').textContent = `Requirements: ${pianos.piano2.requirements}`;
		}

		checkPianoRows(pianos);
	}, 'classes');
}

function checkPianos(data) {
		const piano1 = document.getElementById('piano1');
		const piano2 = document.getElementById('piano2');

		if (data == 0) {
			piano1.style.display = 'none';
			piano2.style.display = 'none';
		}

		if (data >= 1) {
			piano1.style.display = 'flex';
			piano2.style.display = 'none';
		}

		if (data >= 2) {
			piano1.style.display = 'flex';
			piano2.style.display = 'flex';
		}
}

function checkPianoRows(data) {
		const pianoTitle = document.getElementById('no-piano');
		const piano1Info = document.getElementById('piano1-info');
		const piano2Info = document.getElementById('piano2-info');

		if (data.piano == 0) {
			piano1Info.style.display = 'none';
			piano2Info.style.display = 'none';
			pianoTitle.textContent = 'No Pianos Needed';
		}

		if (data.piano >= 1) {
			piano1Info.style.display = 'grid';
			piano2Info.style.display = 'none';
			pianoTitle.textContent = '1 Piano Needed';
		}

		if (data.piano >= 2) {
			piano1Info.style.display = 'grid';
			piano2Info.style.display = 'grid';
			pianoTitle.textContent = '2 Pianos Needed';
		}
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

function setupHistory(classHistory, classId) {
	const container = document.getElementById('history');
	container.innerHTML = '';
	let history = classHistory;

	const row = new Row();
	row.addTitle('Class History');
	if (history.length < 1) {
		row.addSubtitle('No history');
	} else {
		history.forEach(year => {
			row.addSubtitle(`Taught ${year.times_taught}${year.times_taught == 1?' time':' times'} in ${year.year} - ${formatRating(year.rating) || 'No data'}/5 ★`);
		});
		row.addArrow(`/public/review-info.html?id=${classId}`);
	}
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
