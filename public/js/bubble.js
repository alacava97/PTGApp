async function renderBubble(year, container) {
		const scheduleData = await read('schedule');
		const response = await fetch(`/api/readEntry/conventions/2`);
		if(!response.ok) throw new Error(`Failed to fetch types`);
		const convention = await response.json();
		const periods = await read('periods');

		const data = { schedule: scheduleData, convention: convention, periods: periods };

		let MAX_ROWS_PER_PAGE = 26;

		let currentPage = createPage(container);
		createBubbleGridHeader(data, year, currentPage);
		let bubbleGrid = createBubbleGridSkeleton();
		currentPage.appendChild(bubbleGrid);
		let rowCount = 0;

		const schedule = data.schedule.filter(e => e.year == year);
		const types = [...new Set(schedule.map(item => item.type))].sort();

		types.forEach(t => {
			if (t !== 'No Type') {
				if (rowCount !== MAX_ROWS_PER_PAGE) {
					if (rowCount + 1 == MAX_ROWS_PER_PAGE) {
						currentPage = createPage(container);
					  	bubbleGrid = createBubbleGridSkeleton();
					  	currentPage.appendChild(bubbleGrid);
					  	rowCount = 0;
					  	MAX_ROWS_PER_PAGE = 33;
					}

					const typeHeader = document.createElement('div');
					typeHeader.classList.add('type-header');
					typeHeader.innerHTML = t.toUpperCase();
					bubbleGrid.appendChild(typeHeader);
					rowCount++;
				}

				const ts = schedule
					.filter(s => s.type == t)
					.sort((a, b) => {
						const normalize = str =>
							(str || '').toLowerCase().replace(/^the\s+/, '');

						const getSortValue = item =>
							item.short_title || item.title;

						return normalize(getSortValue(a)).localeCompare(normalize(getSortValue(b)));
					});

				const seen = new Set();
				const uniqueItems = [];

				ts.forEach(item => {
				  const key = `${item.short_title || item.title} | ${item.instructor_name}`;
				  if (!seen.has(key)) {
				    seen.add(key);
				    uniqueItems.push(item);
				  }
				});

				const days = ['Wednesday', 'Thursday', 'Friday', 'Saturday']

				uniqueItems.forEach(item => {
					if (rowCount >= MAX_ROWS_PER_PAGE) {
					    currentPage = createPage(container);
					  	bubbleGrid = createBubbleGridSkeleton();
					  	currentPage.appendChild(bubbleGrid);
					  	rowCount = 0;
					  	MAX_ROWS_PER_PAGE = 33;

					  	const continued = document.createElement('div');
					  	continued.classList.add('type-header');
					  	continued.innerHTML = `${t.toUpperCase()} <i style="font-weight:400;">(continued)</i>`;
					  	bubbleGrid.appendChild(continued);
					}

					const sessions = ts.filter(s => s.class_id == item.class_id);
				  	const title = document.createElement('div');
				  	title.classList.add('class-title');

				  	title.innerHTML = `
				    	${item.short_title || item.title} | 
				    	${item.instructor_name.replace(/,\s*RPT/g, '')}
				    	<i>${item.sponsor_name ? ', ' + item.sponsor_name : ''}</i>
				 	 `;

				  	bubbleGrid.appendChild(title);

				  	days.forEach((day, index) => {
				    	for (k = 1; k < 6; k++) {
					      	if (k == 5 && index == 3) continue;

					      	const match = sessions.find(s => 
					      		s.day == day && s.start_period == k 
					      	);

					      	const pNum = document.createElement('div');

					      	if (k == 5 && index !== 3) {
					      		pNum.classList.add('no-bubble-last');
					      	}
					      	pNum.classList.add('no-bubble');
					      	
					      	if (match) {
					      		const bubble = document.createElement('div');
					      		bubble.classList.add('bubble');

					      		const span = match.length;
					      		pNum.style.gridColumn = `span ${span}`;

					      		pNum.appendChild(bubble);

					      		k += span - 1;
					      	}

					    	bubbleGrid.appendChild(pNum);
					    }	
				  	});

				  	const room = document.createElement('div');
				  	room.classList.add('room-name');
				  	room.textContent = item.room;
				  	bubbleGrid.appendChild(room);

				  	rowCount++;
				});
			}
		});
		

		currentPage.appendChild(bubbleGrid);
	}

	function createPage(container) {
	  	const page = document.createElement('div');
	  	page.classList.add('page');
	    container.appendChild(page);
	  	return page;
	}

	function createBubbleGridHeader(data, year, container) {
		const h1 = document.createElement('h1');
		h1.innerHTML = `${year} Technical Institute`;
		container.appendChild(h1);

		const h2 = document.createElement('h2');
		h2.innerHTML = `Class Schedule | ${data.convention.city_state}`;
		container.appendChild(h2);

		const dateTable = document.createElement('table');
		dateTable.classList.add('time-table');
		const th = document.createElement('th');
		th.textContent = data.convention.dates;
		th.colSpan = 5;
		dateTable.appendChild(th);

		const pRow = document.createElement('tr');
		const timeRow = document.createElement('tr');

		for (i = 1; i < 6; i++) {
			const p = document.createElement('td');
			p.innerHTML = `Period ${i}`;
			pRow.appendChild(p);

			const time = data.periods.find(p => p.id == i);
			const t = document.createElement('td');
			t.innerHTML = `${time.start.slice(0, -3)}-${time.end.slice(0, -3)}`;
			timeRow.appendChild(t);
		};

		dateTable.appendChild(pRow);
		dateTable.appendChild(timeRow);
		container.appendChild(dateTable);

		const h3 = document.createElement('h3');
		h3.innerHTML = `Schedule subject to change. Rev. ${new Date().toLocaleDateString('ne-US')}`;
		container.appendChild(h3);

		const h4 = document.createElement('h4');
		h4.innerHTML = `Regional Meetings - Thursday | 6:45 - 7:45 a.m.`;
		container.appendChild(h4);

		return 
	}

	function createBubbleGridSkeleton() {
		const bubbleGrid = document.createElement('div');
		bubbleGrid.classList.add('bubble-grid');

		const bubbleHeader = document.createElement('div');
		bubbleHeader.innerHTML = `
			<span class="bubble" style="height:10px;width:10px;display:inline-block;"></span>
			<span>1 Period Class |</span>
			<span class="bubble" style="height:10px;width:20px;display:inline-block;"></span>
			<span>2 Period Class |</span>
			<span class="bubble" style="height:10px;width:40px;display:inline-block;"></span>
			<span>4 Period Class</span>`;

		bubbleHeader.classList.add('bubble-header');
		bubbleGrid.appendChild(bubbleHeader);

		let days = ['Wed | 7/22', 'Thurs | 7/23', 'Fri | 7/24', 'Sat | 7/25'];
		days.forEach((day, index) => {
			const dayHeader = document.createElement('div');
			if (index == 3) {
				dayHeader.classList.add('day-header-last');
			} else {
				dayHeader.classList.add('day-header');
			}
			dayHeader.innerHTML = `${day}`;
			bubbleGrid.appendChild(dayHeader);

			for (j = 1; j < 6; j++) {
				if (j == 5 && index == 3) continue;
				const pNum = document.createElement('div');
				pNum.classList.add('period-number');
				if (j == 4 && index == 3 || j == 5 && index !== 3) pNum.classList.add('period-number-last');
				pNum.textContent = j;
				bubbleGrid.appendChild(pNum);
			}
		});

		days = ['Wednesday', 'Thursday', 'Friday', 'Saturday'];

		const roomHeader = document.createElement('div');
		roomHeader.classList.add('room-header');
		roomHeader.textContent = 'Room';
		bubbleGrid.appendChild(roomHeader);

		return bubbleGrid;
	}