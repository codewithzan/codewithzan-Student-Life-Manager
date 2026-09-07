/**
 * schedule.js
 * Manages school class schedule — CRUD operations and weekly/list views.
 */

// Module state
const scheduleState = {
  classes: [],
  currentView: 'weekly',
  editingId: null
};

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize the schedule module
 */
async function initSchedule() {
  setupScheduleEventListeners();
  await loadClasses();
}

/**
 * Set up all event listeners for the schedule module
 */
function setupScheduleEventListeners() {
  // Add class buttons
  document.getElementById('add-class-btn')?.addEventListener('click', () => openClassModal());
  document.getElementById('add-class-btn-empty')?.addEventListener('click', () => openClassModal());

  // View toggle
  document.getElementById('schedule-weekly-btn')?.addEventListener('click', () => switchScheduleView('weekly'));
  document.getElementById('schedule-list-btn')?.addEventListener('click', () => switchScheduleView('list'));

  // Form submission
  document.getElementById('class-form')?.addEventListener('submit', handleClassSubmit);

  // Live calc preview for shifts (shared time fields)
  const startEl = document.getElementById('class-start');
  const endEl = document.getElementById('class-end');
  if (startEl) startEl.addEventListener('change', updateWeeklyPreview);
  if (endEl) endEl.addEventListener('change', updateWeeklyPreview);
}

// ============================================================
// DATA LOADING
// ============================================================

/**
 * Load all classes from Supabase
 */
async function loadClasses() {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('schedules')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('day_of_week')
      .order('start_time');

    if (error) throw error;

    scheduleState.classes = data || [];
    renderSchedule();
  } catch (err) {
    console.error('[Schedule] Load error:', err);
    showToast('Error', 'Failed to load schedule.', 'error');
  }
}

// ============================================================
// RENDERING
// ============================================================

/**
 * Render the schedule based on current view
 */
function renderSchedule() {
  if (scheduleState.currentView === 'weekly') {
    renderWeeklyView();
  } else {
    renderListView();
  }
}

/**
 * Switch between weekly and list views
 * @param {'weekly'|'list'} view
 */
function switchScheduleView(view) {
  scheduleState.currentView = view;

  const weeklyBtn = document.getElementById('schedule-weekly-btn');
  const listBtn = document.getElementById('schedule-list-btn');
  const weeklyView = document.getElementById('schedule-weekly-view');
  const listView = document.getElementById('schedule-list-view');

  if (view === 'weekly') {
    weeklyBtn?.classList.add('view-btn--active');
    listBtn?.classList.remove('view-btn--active');
    weeklyView?.classList.remove('hidden');
    listView?.classList.add('hidden');
    renderWeeklyView();
  } else {
    listBtn?.classList.add('view-btn--active');
    weeklyBtn?.classList.remove('view-btn--active');
    listView?.classList.remove('hidden');
    weeklyView?.classList.add('hidden');
    renderListView();
  }
}

/**
 * Render the weekly timetable grid
 */
function renderWeeklyView() {
  const grid = document.getElementById('weekly-grid');
  if (!grid) return;

  const days = APP_CONFIG.days;
  const todayName = APP_CONFIG.days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  // Time slots: 8:00 to 21:00
  const timeSlots = [];
  for (let h = 8; h <= 21; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`);
  }

  // Group classes by day
  const classByDay = {};
  days.forEach(d => classByDay[d] = []);
  scheduleState.classes.forEach(cls => {
    if (classByDay[cls.day_of_week]) {
      classByDay[cls.day_of_week].push(cls);
    }
  });

  let html = '';

  // Header row
  html += '<div class="weekly-time-col" style="border-bottom:1px solid var(--color-border);background:var(--color-surface-alt);"></div>';
  days.forEach(day => {
    const isToday = day === todayName;
    html += `
      <div class="weekly-day-header ${isToday ? 'weekly-day-header--today' : ''}">
        <div class="weekly-day-name">${day.slice(0, 3)}</div>
        ${isToday ? '<div style="font-size:0.6rem;color:var(--color-primary);font-weight:600;">TODAY</div>' : ''}
      </div>
    `;
  });

  // Time rows
  timeSlots.forEach(time => {
    // Time label
    html += `<div class="weekly-time-label">${time}</div>`;

    // Day cells
    days.forEach(day => {
      const slotClasses = classByDay[day].filter(cls => cls.start_time.slice(0, 5) === time);
      let cellContent = '';

      slotClasses.forEach(cls => {
        const bg = cls.color || '#E63946';
        const textColor = getContrastColor(bg);
        cellContent += `
          <div class="class-chip"
               style="background-color:${escapeHtml(bg)};color:${textColor};"
               onclick="openClassModal('${escapeHtml(cls.id)}')"
               title="${escapeHtml(cls.subject)} — ${formatTime12(cls.start_time)} to ${formatTime12(cls.end_time)}">
            <span class="class-chip-subject">${escapeHtml(cls.subject)}</span>
            <span class="class-chip-time">${formatTime12(cls.start_time)}</span>
          </div>
        `;
      });

      html += `<div class="weekly-slot">${cellContent}</div>`;
    });
  });

  grid.innerHTML = html;
}

/**
 * Render the list view of all classes
 */
function renderListView() {
  const container = document.getElementById('schedule-list');
  if (!container) return;

  if (!scheduleState.classes.length) {
    showEmptyState(
      container,
      'book-outline',
      'No Classes Yet',
      'Add your first class to get started.',
      `<button class="btn btn--primary" onclick="openClassModal()">
        <ion-icon name="add-outline"></ion-icon> Add Class
      </button>`
    );
    return;
  }

  // Group by day
  const grouped = {};
  APP_CONFIG.days.forEach(d => grouped[d] = []);
  scheduleState.classes.forEach(cls => {
    if (grouped[cls.day_of_week]) grouped[cls.day_of_week].push(cls);
  });

  let html = '';
  APP_CONFIG.days.forEach(day => {
    if (!grouped[day].length) return;
    html += `<div class="subsection-title" style="margin-top:var(--spacing-5);margin-bottom:var(--spacing-3);">${day}</div>`;
    grouped[day].forEach(cls => {
      html += renderClassListItem(cls);
    });
  });

  container.innerHTML = html;
}

/**
 * Render a single class list item HTML
 * @param {Object} cls
 * @returns {string}
 */
function renderClassListItem(cls) {
  const bg = cls.color || '#E63946';
  return `
    <div class="schedule-list-item" style="border-left-color:${escapeHtml(bg)};">
      <div class="list-item-icon" style="background-color:${hexToRgba(bg, 0.12)};color:${escapeHtml(bg)};">
        <ion-icon name="book-outline"></ion-icon>
      </div>
      <div class="list-item-info">
        <div class="list-item-title">${escapeHtml(cls.subject)}</div>
        <div class="list-item-meta">
          <span><ion-icon name="time-outline"></ion-icon> ${formatTime12(cls.start_time)} — ${formatTime12(cls.end_time)}</span>
          ${cls.classroom ? `<span><ion-icon name="location-outline"></ion-icon> ${escapeHtml(cls.classroom)}</span>` : ''}
          ${cls.teacher ? `<span><ion-icon name="person-outline"></ion-icon> ${escapeHtml(cls.teacher)}</span>` : ''}
        </div>
        ${cls.notes ? `<div style="font-size:var(--font-size-xs);color:var(--color-text-muted);margin-top:4px;">${escapeHtml(cls.notes)}</div>` : ''}
      </div>
      <div class="list-item-actions">
        <button class="action-btn" onclick="openClassModal('${escapeHtml(cls.id)}')" aria-label="Edit class" title="Edit">
          <ion-icon name="create-outline"></ion-icon>
        </button>
        <button class="action-btn action-btn--delete" onclick="deleteClass('${escapeHtml(cls.id)}')" aria-label="Delete class" title="Delete">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// MODAL — CREATE / EDIT
// ============================================================

/**
 * Open the class modal for create or edit
 * @param {string|null} classId - If provided, edit mode
 */
function openClassModal(classId = null) {
  const form = document.getElementById('class-form');
  const title = document.getElementById('class-modal-title');
  const idInput = document.getElementById('class-id');

  // Reset form
  form?.reset();
  if (idInput) idInput.value = '';
  if (title) title.textContent = classId ? 'Edit Class' : 'Add Class';

  // Reset color picker
  const colorInput = document.getElementById('class-color');
  if (colorInput) colorInput.value = '#E63946';

  scheduleState.editingId = classId;

  if (classId) {
    // Populate form with existing data
    const cls = scheduleState.classes.find(c => c.id === classId);
    if (cls) {
      if (idInput) idInput.value = cls.id;
      setFormValue('class-subject', cls.subject);
      setFormValue('class-teacher', cls.teacher);
      setFormValue('class-day', cls.day_of_week);
      setFormValue('class-start', cls.start_time?.slice(0, 5));
      setFormValue('class-end', cls.end_time?.slice(0, 5));
      setFormValue('class-room', cls.classroom);
      setFormValue('class-notes', cls.notes);
      if (colorInput) colorInput.value = cls.color || '#E63946';
    }
  }

  openModal('class-modal-overlay');
}

/**
 * Handle class form submission (create or update)
 * @param {Event} e
 */
async function handleClassSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('class-id')?.value;
  const subject = document.getElementById('class-subject')?.value.trim();
  const teacher = document.getElementById('class-teacher')?.value.trim();
  const day = document.getElementById('class-day')?.value;
  const startTime = document.getElementById('class-start')?.value;
  const endTime = document.getElementById('class-end')?.value;
  const classroom = document.getElementById('class-room')?.value.trim();
  const color = document.getElementById('class-color')?.value;
  const notes = document.getElementById('class-notes')?.value.trim();

  // Validation
  if (!subject || !day || !startTime || !endTime) {
    showToast('Missing Fields', 'Please fill in all required fields.', 'warning');
    return;
  }

  if (startTime >= endTime) {
    showToast('Invalid Time', 'End time must be after start time.', 'warning');
    return;
  }

  const submitBtn = document.getElementById('class-submit-btn');
  submitBtn.disabled = true;

  try {
    const sb = getSupabase();
    const payload = {
      user_id: window.currentUser.id,
      subject,
      teacher: teacher || null,
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
      classroom: classroom || null,
      color: color || '#E63946',
      notes: notes || null
    };

    let error;

    if (id) {
      // Update existing
      ({ error } = await sb.from('schedules').update(payload).eq('id', id).eq('user_id', window.currentUser.id));
    } else {
      // Insert new
      ({ error } = await sb.from('schedules').insert(payload));
    }

    if (error) throw error;

    closeModal('class-modal-overlay');
    await loadClasses();
    showToast(id ? 'Class Updated' : 'Class Added', `${subject} has been ${id ? 'updated' : 'added'} to your schedule.`, 'success');

  } catch (err) {
    console.error('[Schedule] Save error:', err);
    showToast('Save Failed', 'Could not save class. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

// ============================================================
// DELETE
// ============================================================

/**
 * Delete a class with confirmation
 * @param {string} classId
 */
function deleteClass(classId) {
  const cls = scheduleState.classes.find(c => c.id === classId);
  const name = cls?.subject || 'this class';
  confirmDelete(`Delete "${name}"? This action cannot be undone.`, async () => {
    try {
      const sb = getSupabase();
      const { error } = await sb.from('schedules').delete().eq('id', classId).eq('user_id', window.currentUser.id);
      if (error) throw error;
      await loadClasses();
      showToast('Class Deleted', `${name} has been removed.`, 'success');
    } catch (err) {
      console.error('[Schedule] Delete error:', err);
      showToast('Delete Failed', 'Could not delete class. Please try again.', 'error');
    }
  });
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Set a form input's value safely
 * @param {string} id
 * @param {string} value
 */
function setFormValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

/**
 * Get today's classes (for dashboard)
 * @returns {Array}
 */
function getTodaysClasses() {
  const todayName = APP_CONFIG.days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  return scheduleState.classes
    .filter(c => c.day_of_week === todayName)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

function updateWeeklyPreview() {
  // Placeholder for any real-time grid preview updates
}
