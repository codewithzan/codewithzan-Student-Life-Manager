/**
 * shifts.js
 * Part-time job shift tracking — CRUD, calculations, and stats.
 */

// Module state
const shiftsState = {
  shifts: [],
  filtered: [],
  monthFilter: getCurrentMonth(),
  workplaceFilter: ''
};

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize shifts module
 */
async function initShifts() {
  // Set default month filter to current month
  const monthInput = document.getElementById('shift-month-filter');
  if (monthInput) monthInput.value = getCurrentMonth();

  setupShiftEventListeners();
  await loadShifts();
}

/**
 * Set up all event listeners for shifts
 */
function setupShiftEventListeners() {
  document.getElementById('add-shift-btn')?.addEventListener('click', () => openShiftModal());
  document.getElementById('add-shift-btn-empty')?.addEventListener('click', () => openShiftModal());
  document.getElementById('shift-form')?.addEventListener('submit', handleShiftSubmit);

  // Filter listeners
  document.getElementById('shift-month-filter')?.addEventListener('change', (e) => {
    shiftsState.monthFilter = e.target.value;
    applyShiftFilters();
  });

  document.getElementById('shift-workplace-filter')?.addEventListener('change', (e) => {
    shiftsState.workplaceFilter = e.target.value;
    applyShiftFilters();
  });

  // Live pay calculator in modal
  const startEl = document.getElementById('shift-start');
  const endEl = document.getElementById('shift-end');
  const breakEl = document.getElementById('shift-break');
  const wageEl = document.getElementById('shift-wage');

  [startEl, endEl, breakEl, wageEl].forEach(el => {
    el?.addEventListener('input', updateShiftCalcPreview);
    el?.addEventListener('change', updateShiftCalcPreview);
  });
}

// ============================================================
// DATA LOADING
// ============================================================

/**
 * Load all shifts from Supabase
 */
async function loadShifts() {
  const container = document.getElementById('shifts-list');
  if (container) showLoading(container, 'Loading shifts...');

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('shifts')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('shift_date', { ascending: false });

    if (error) throw error;

    shiftsState.shifts = data || [];
    updateWorkplaceFilter();
    applyShiftFilters();
  } catch (err) {
    console.error('[Shifts] Load error:', err);
    showToast('Error', 'Failed to load shifts.', 'error');
  }
}

/**
 * Apply current filters and re-render
 */
function applyShiftFilters() {
  let filtered = [...shiftsState.shifts];

  if (shiftsState.monthFilter) {
    filtered = filtered.filter(s => s.shift_date?.startsWith(shiftsState.monthFilter));
  }

  if (shiftsState.workplaceFilter) {
    filtered = filtered.filter(s => s.workplace === shiftsState.workplaceFilter);
  }

  shiftsState.filtered = filtered;
  renderShiftStats(filtered);
  renderShiftsList(filtered);
}

/**
 * Update the workplace dropdown filter with unique values
 */
function updateWorkplaceFilter() {
  const select = document.getElementById('shift-workplace-filter');
  if (!select) return;

  const workplaces = [...new Set(shiftsState.shifts.map(s => s.workplace))].filter(Boolean).sort();
  const options = workplaces.map(w => ({ value: w, label: w }));
  populateSelect(select, options, 'All Workplaces');
}

// ============================================================
// RENDERING
// ============================================================

/**
 * Render shift statistics cards
 * @param {Array} shifts
 */
function renderShiftStats(shifts) {
  const totalHours = shifts.reduce((sum, s) => sum + (Number(s.worked_hours) || 0), 0);
  const totalPay = shifts.reduce((sum, s) => sum + (Number(s.total_pay) || 0), 0);
  const count = shifts.length;
  const avgRate = count > 0
    ? shifts.reduce((sum, s) => sum + Number(s.hourly_wage), 0) / count
    : 0;

  const hoursEl = document.getElementById('shift-hours-month');
  const incomeEl = document.getElementById('shift-income-month');
  const countEl = document.getElementById('shift-count-month');
  const rateEl = document.getElementById('shift-avg-rate');

  if (hoursEl) hoursEl.textContent = formatHours(totalHours);
  if (incomeEl) incomeEl.textContent = formatYen(totalPay);
  if (countEl) countEl.textContent = count;
  if (rateEl) rateEl.textContent = `${formatYen(Math.round(avgRate))}/h`;
}

/**
 * Render the shifts list
 * @param {Array} shifts
 */
function renderShiftsList(shifts) {
  const container = document.getElementById('shifts-list');
  if (!container) return;

  if (!shifts.length) {
    showEmptyState(
      container,
      'briefcase-outline',
      'No Shifts Found',
      shiftsState.monthFilter ? 'No shifts this month. Log your first shift!' : 'Start tracking your part-time work shifts.',
      `<button class="btn btn--primary" onclick="openShiftModal()">
        <ion-icon name="add-outline"></ion-icon> Log Shift
      </button>`
    );
    return;
  }

  container.innerHTML = shifts.map(shift => renderShiftItem(shift)).join('');
}

/**
 * Render a single shift item
 * @param {Object} shift
 * @returns {string}
 */
function renderShiftItem(shift) {
  const workedHours = shift.worked_hours || calcWorkedHours(shift.start_time, shift.end_time, shift.break_minutes);
  const pay = shift.total_pay || calcPay(workedHours, shift.hourly_wage);

  return `
    <div class="list-item">
      <div class="list-item-icon" style="background-color:var(--color-income-muted);color:var(--color-income);">
        <ion-icon name="briefcase-outline"></ion-icon>
      </div>
      <div class="list-item-info">
        <div class="list-item-title">${escapeHtml(shift.workplace)}</div>
        <div class="list-item-meta">
          <span><ion-icon name="calendar-outline"></ion-icon> ${formatDate(shift.shift_date)}</span>
          <span><ion-icon name="time-outline"></ion-icon> ${formatTime12(shift.start_time)} — ${formatTime12(shift.end_time)}</span>
          <span><ion-icon name="hourglass-outline"></ion-icon> ${formatHours(workedHours)}</span>
          ${shift.break_minutes > 0 ? `<span>Break: ${shift.break_minutes}min</span>` : ''}
        </div>
        ${shift.notes ? `<div style="font-size:var(--font-size-xs);color:var(--color-text-muted);margin-top:4px;">${escapeHtml(shift.notes)}</div>` : ''}
      </div>
      <div class="list-item-badge">
        <div style="text-align:right;">
          <div style="font-size:var(--font-size-lg);font-weight:var(--font-weight-bold);color:var(--color-income);">${formatYen(pay)}</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-text-muted);">${formatYen(shift.hourly_wage)}/h</div>
        </div>
      </div>
      <div class="list-item-actions">
        <button class="action-btn" onclick="openShiftModal('${escapeHtml(shift.id)}')" aria-label="Edit shift" title="Edit">
          <ion-icon name="create-outline"></ion-icon>
        </button>
        <button class="action-btn action-btn--delete" onclick="deleteShift('${escapeHtml(shift.id)}')" aria-label="Delete shift" title="Delete">
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
 * Open the shift modal for create or edit
 * @param {string|null} shiftId
 */
function openShiftModal(shiftId = null) {
  const form = document.getElementById('shift-form');
  const title = document.getElementById('shift-modal-title');
  const idInput = document.getElementById('shift-id');

  form?.reset();
  if (idInput) idInput.value = '';
  if (title) title.textContent = shiftId ? 'Edit Shift' : 'Log Work Shift';

  // Default break to 0
  const breakEl = document.getElementById('shift-break');
  if (breakEl) breakEl.value = '0';

  // Default date to today
  const dateEl = document.getElementById('shift-date');
  if (dateEl) dateEl.value = getTodayString();

  // Reset preview
  updateShiftCalcPreview();

  if (shiftId) {
    const shift = shiftsState.shifts.find(s => s.id === shiftId);
    if (shift) {
      if (idInput) idInput.value = shift.id;
      setFormValue('shift-workplace', shift.workplace);
      setFormValue('shift-date', shift.shift_date);
      setFormValue('shift-start', shift.start_time?.slice(0, 5));
      setFormValue('shift-end', shift.end_time?.slice(0, 5));
      setFormValue('shift-break', shift.break_minutes ?? 0);
      setFormValue('shift-wage', shift.hourly_wage);
      setFormValue('shift-notes', shift.notes);
      setTimeout(updateShiftCalcPreview, 50);
    }
  }

  openModal('shift-modal-overlay');
}

/**
 * Update the pay calculator preview in the modal
 */
function updateShiftCalcPreview() {
  const start = document.getElementById('shift-start')?.value;
  const end = document.getElementById('shift-end')?.value;
  const breakMins = parseInt(document.getElementById('shift-break')?.value) || 0;
  const wage = parseFloat(document.getElementById('shift-wage')?.value) || 0;

  const hoursEl = document.getElementById('calc-hours');
  const payEl = document.getElementById('calc-pay');

  if (start && end && wage) {
    const hours = calcWorkedHours(start, end, breakMins);
    const pay = calcPay(hours, wage);
    if (hoursEl) hoursEl.textContent = formatHours(hours);
    if (payEl) payEl.textContent = formatYen(pay);
  } else {
    if (hoursEl) hoursEl.textContent = '—';
    if (payEl) payEl.textContent = '—';
  }
}

/**
 * Handle shift form submission
 * @param {Event} e
 */
async function handleShiftSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('shift-id')?.value;
  const workplace = document.getElementById('shift-workplace')?.value.trim();
  const shiftDate = document.getElementById('shift-date')?.value;
  const startTime = document.getElementById('shift-start')?.value;
  const endTime = document.getElementById('shift-end')?.value;
  const breakMinutes = parseInt(document.getElementById('shift-break')?.value) || 0;
  const hourlyWage = parseFloat(document.getElementById('shift-wage')?.value);
  const notes = document.getElementById('shift-notes')?.value.trim();

  // Validation
  if (!workplace || !shiftDate || !startTime || !endTime || !hourlyWage) {
    showToast('Missing Fields', 'Please fill in all required fields.', 'warning');
    return;
  }

  if (hourlyWage <= 0) {
    showToast('Invalid Wage', 'Please enter a valid hourly wage.', 'warning');
    return;
  }

  const workedHours = calcWorkedHours(startTime, endTime, breakMinutes);
  const totalPay = calcPay(workedHours, hourlyWage);

  const submitBtn = document.getElementById('shift-submit-btn');
  submitBtn.disabled = true;

  try {
    const sb = getSupabase();
    const payload = {
      user_id: window.currentUser.id,
      workplace,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      break_minutes: breakMinutes,
      hourly_wage: hourlyWage,
      worked_hours: workedHours,
      total_pay: totalPay,
      notes: notes || null
    };

    let error;

    if (id) {
      ({ error } = await sb.from('shifts').update(payload).eq('id', id).eq('user_id', window.currentUser.id));
    } else {
      ({ error } = await sb.from('shifts').insert(payload));
    }

    if (error) throw error;

    closeModal('shift-modal-overlay');
    await loadShifts();
    showToast(id ? 'Shift Updated' : 'Shift Logged', `${formatHours(workedHours)} at ${workplace} — ${formatYen(totalPay)}`, 'success');

  } catch (err) {
    console.error('[Shifts] Save error:', err);
    showToast('Save Failed', 'Could not save shift. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

// ============================================================
// DELETE
// ============================================================

/**
 * Delete a shift with confirmation
 * @param {string} shiftId
 */
function deleteShift(shiftId) {
  const shift = shiftsState.shifts.find(s => s.id === shiftId);
  const name = shift ? `${shift.workplace} on ${formatDate(shift.shift_date)}` : 'this shift';

  confirmDelete(`Delete shift at ${name}? This action cannot be undone.`, async () => {
    try {
      const sb = getSupabase();
      const { error } = await sb.from('shifts').delete().eq('id', shiftId).eq('user_id', window.currentUser.id);
      if (error) throw error;
      await loadShifts();
      showToast('Shift Deleted', 'The shift has been removed.', 'success');
    } catch (err) {
      console.error('[Shifts] Delete error:', err);
      showToast('Delete Failed', 'Could not delete shift. Please try again.', 'error');
    }
  });
}

// ============================================================
// ANALYTICS HELPERS (for dashboard)
// ============================================================

/**
 * Get this month's shift income
 * @returns {number}
 */
function getMonthlyIncome() {
  const monthStr = getCurrentMonth();
  return shiftsState.shifts
    .filter(s => s.shift_date?.startsWith(monthStr))
    .reduce((sum, s) => sum + (Number(s.total_pay) || 0), 0);
}

/**
 * Get upcoming shifts (next 7 days)
 * @returns {Array}
 */
function getUpcomingShifts() {
  const today = getTodayString();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  return shiftsState.shifts
    .filter(s => s.shift_date >= today && s.shift_date <= nextWeekStr)
    .sort((a, b) => a.shift_date.localeCompare(b.shift_date))
    .slice(0, 5);
}

/**
 * Get monthly income for the last N months
 * @param {number} months
 * @returns {Array} [{month, income}]
 */
function getMonthlyIncomeHistory(months = 6) {
  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const income = shiftsState.shifts
      .filter(s => s.shift_date?.startsWith(monthStr))
      .reduce((sum, s) => sum + (Number(s.total_pay) || 0), 0);
    result.push({
      month: APP_CONFIG.monthsShort[d.getMonth()],
      income
    });
  }

  return result;
}
