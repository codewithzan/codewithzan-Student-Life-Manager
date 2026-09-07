/**
 * dashboard.js
 * Main dashboard orchestrator — navigation, section switching,
 * dashboard overview widgets, calendar, and charts.
 */

// ============================================================
// MAIN INITIALIZATION
// ============================================================

/**
 * Initialize the entire dashboard application
 * Called after auth verification
 */
async function initDashboardApp() {
  // Show loading on main content
  setTopbarDate();
  initModalOverlayClose();
  initConfirmModal();
  initNavigation();
  initSidebar();

  // Initialize all modules
  await Promise.all([
    initSchedule(),
    initShifts(),
    initExpenses(),
    initStudy(),
    initJLPT(),
    initTasks()
  ]);

  // Render dashboard overview after all data is loaded
  await renderDashboard();

  // Initialize calendar (requires all data)
  initCalendar();

  // Navigate to default section
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateToSection(hash);

  console.log('[Dashboard] App fully initialized');
}

// ============================================================
// NAVIGATION
// ============================================================

/**
 * Initialize section navigation
 */
function initNavigation() {
  // Nav links
  document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      navigateToSection(section);
      closeMobileSidebar();
    });
  });

  // Inline navigation links (dash-card-link with data-nav)
  document.addEventListener('click', (e) => {
    const navEl = e.target.closest('[data-nav]');
    if (navEl) {
      e.preventDefault();
      navigateToSection(navEl.dataset.nav);
    }
  });

  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateToSection(hash, false);
  });
}

/**
 * Navigate to a dashboard section
 * @param {string} sectionName
 * @param {boolean} updateHistory - Whether to push to history
 */
function navigateToSection(sectionName, updateHistory = true) {
  const validSections = ['dashboard', 'schedule', 'shifts', 'expenses', 'study', 'jlpt', 'tasks', 'calendar', 'settings'];
  if (!validSections.includes(sectionName)) sectionName = 'dashboard';

  // Hide all sections
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));

  // Show target section
  const target = document.getElementById(`section-${sectionName}`);
  if (target) target.classList.remove('hidden');

  // Update nav links
  document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    link.classList.toggle('nav-link--active', link.dataset.section === sectionName);
  });

  // Update topbar title
  const titles = {
    dashboard: 'Dashboard',
    schedule: 'School Schedule',
    shifts: 'Part-Time Job',
    expenses: 'Expense Tracker',
    study: 'Japanese Study',
    jlpt: 'JLPT Preparation',
    tasks: 'Task Manager',
    calendar: 'Calendar',
    settings: 'Settings'
  };
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) topbarTitle.textContent = titles[sectionName] || 'Dashboard';

  // Update URL hash
  if (updateHistory) {
    window.history.pushState(null, '', `#${sectionName}`);
  }

  // Re-render calendar if navigating to it
  if (sectionName === 'calendar') {
    renderCalendarView();
  }

  // Refresh dashboard charts when revisiting
  if (sectionName === 'dashboard') {
    renderDashboardCharts();
  }
}

// ============================================================
// SIDEBAR (Mobile)
// ============================================================

function initSidebar() {
  const toggle = document.getElementById('sidebar-toggle');
  const close = document.getElementById('sidebar-close');
  const overlay = document.getElementById('sidebar-overlay');

  toggle?.addEventListener('click', () => {
    openMobileSidebar();
    toggle.setAttribute('aria-expanded', 'true');
  });

  close?.addEventListener('click', closeMobileSidebar);
  overlay?.addEventListener('click', closeMobileSidebar);

  // Keyboard trap within sidebar when open
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileSidebar();
  });
}

function openMobileSidebar() {
  document.getElementById('sidebar')?.classList.add('sidebar--open');
  document.getElementById('sidebar-overlay')?.classList.add('sidebar-overlay--visible');
  document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('sidebar--open');
  document.getElementById('sidebar-overlay')?.classList.remove('sidebar-overlay--visible');
  document.body.style.overflow = '';
  document.getElementById('sidebar-toggle')?.setAttribute('aria-expanded', 'false');
}

// ============================================================
// TOPBAR DATE
// ============================================================

function setTopbarDate() {
  const dateEl = document.getElementById('topbar-date');
  if (dateEl) dateEl.textContent = getTopbarDate();

  // Update section subtitle on dashboard
  const sub = document.getElementById('dash-greeting-sub');
  if (sub) {
    const now = new Date();
    sub.textContent = `${getGreeting()}! Today is ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
  }
}

// ============================================================
// DASHBOARD OVERVIEW
// ============================================================

/**
 * Render all dashboard overview content
 */
async function renderDashboard() {
  renderDashboardStats();
  renderTodaysClasses();
  renderUpcomingShifts();
  renderPendingTasksWidget();
  renderJLPTWidget();
  renderDashboardCharts();
}

/**
 * Render top-level stat cards
 */
function renderDashboardStats() {
  const income = getMonthlyIncome();
  const expenses = getMonthlyExpenses();
  const savings = income - expenses;
  const streak = getStudyStreak();

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setEl('stat-income', formatYen(income));
  setEl('stat-expenses', formatYen(expenses));
  setEl('stat-savings', formatYen(savings));
  setEl('stat-streak', `${streak} ${streak === 1 ? 'day' : 'days'}`);

  setEl('stat-income-change', 'This month from work');
  setEl('stat-expense-change', 'This month total spending');
  setEl('stat-savings-pct', savings >= 0 ? '🟢 Positive savings' : '🔴 Spending over income');

  const studyHours = getMonthlyStudyHours();
  setEl('stat-study-hours', `${formatHours(studyHours)} this month`);
}

/**
 * Render today's classes widget
 */
function renderTodaysClasses() {
  const container = document.getElementById('dash-classes');
  if (!container) return;

  const classes = getTodaysClasses();

  if (!classes.length) {
    container.innerHTML = `
      <div class="empty-state empty-state--small">
        <ion-icon name="book-outline"></ion-icon>
        <p>No classes today 🎉</p>
      </div>
    `;
    return;
  }

  container.innerHTML = classes.map(cls => {
    const bg = cls.color || '#E63946';
    return `
      <div class="dash-class-item">
        <div class="dash-item-dot" style="background-color:${escapeHtml(bg)};"></div>
        <div class="dash-item-info">
          <div class="dash-item-title">${escapeHtml(cls.subject)}</div>
          <div class="dash-item-meta">${formatTime12(cls.start_time)} — ${formatTime12(cls.end_time)}${cls.classroom ? ` · ${cls.classroom}` : ''}</div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render upcoming shifts widget
 */
function renderUpcomingShifts() {
  const container = document.getElementById('dash-shifts');
  if (!container) return;

  const shifts = getUpcomingShifts();

  if (!shifts.length) {
    container.innerHTML = `
      <div class="empty-state empty-state--small">
        <ion-icon name="briefcase-outline"></ion-icon>
        <p>No upcoming shifts this week</p>
      </div>
    `;
    return;
  }

  container.innerHTML = shifts.map(shift => {
    const pay = shift.total_pay || calcPay(calcWorkedHours(shift.start_time, shift.end_time, shift.break_minutes), shift.hourly_wage);
    return `
      <div class="dash-shift-item">
        <div class="dash-item-dot" style="background-color:var(--color-income);"></div>
        <div class="dash-item-info">
          <div class="dash-item-title">${escapeHtml(shift.workplace)}</div>
          <div class="dash-item-meta">
            ${formatDate(shift.shift_date, { weekday: 'short', month: 'short', day: 'numeric' })}
            · ${formatTime12(shift.start_time)}
          </div>
        </div>
        <div class="dash-item-badge" style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);color:var(--color-income);">
          ${formatYen(pay)}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render pending tasks widget
 */
function renderPendingTasksWidget() {
  const container = document.getElementById('dash-tasks');
  if (!container) return;

  const tasks = getPendingTasks(5);

  if (!tasks.length) {
    container.innerHTML = `
      <div class="empty-state empty-state--small">
        <ion-icon name="checkmark-circle-outline"></ion-icon>
        <p>All caught up! No pending tasks 🎉</p>
      </div>
    `;
    return;
  }

  const priorityColors = { high: '#E63946', medium: '#F4A261', low: '#2DC653' };

  container.innerHTML = tasks.map(task => {
    const isOverdue = task.due_date && task.due_date < getTodayString();
    return `
      <div class="dash-task-item">
        <div class="dash-item-dot" style="background-color:${priorityColors[task.priority] || '#ccc'};"></div>
        <div class="dash-item-info">
          <div class="dash-item-title">${escapeHtml(task.title)}</div>
          <div class="dash-item-meta">
            <span class="badge badge--${escapeHtml(task.priority)}" style="font-size:0.6rem;">${capitalize(task.priority)}</span>
            ${task.due_date ? `<span style="font-size:var(--font-size-xs);color:${isOverdue ? 'var(--color-danger)' : 'var(--color-text-muted)'};">
              ${isOverdue ? '⚠ Overdue: ' : ''}${formatDate(task.due_date, { month: 'short', day: 'numeric' })}
            </span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render JLPT countdown widget
 */
function renderJLPTWidget() {
  const days = getDaysUntilJLPT();
  const level = getJLPTLevel();

  const dashDays = document.getElementById('dash-jlpt-days');
  const dashLabel = document.getElementById('dash-jlpt-label');
  const dashLevel = document.getElementById('dash-jlpt-level');

  if (days === null) {
    if (dashDays) dashDays.textContent = '--';
    if (dashLabel) dashLabel.textContent = 'Days until JLPT';
    if (dashLevel) dashLevel.textContent = 'Set your goal in the JLPT section';
    return;
  }

  if (dashDays) dashDays.textContent = days >= 0 ? days : `+${Math.abs(days)}`;
  if (dashLabel) dashLabel.textContent = days >= 0 ? 'Days until JLPT' : 'Days since JLPT';
  if (dashLevel) dashLevel.textContent = level ? `Target: JLPT ${level}` : 'Set your target level';
}

// ============================================================
// DASHBOARD CHARTS
// ============================================================

/**
 * Render the income vs expenses chart on the dashboard
 */
function renderDashboardCharts() {
  renderIncomeExpenseChart();
  renderDashStudyChart();
}

function renderIncomeExpenseChart() {
  destroyChart('income-expense-chart');
  const canvas = document.getElementById('income-expense-chart');
  if (!canvas) return;

  const incomeHistory = getMonthlyIncomeHistory(6);
  const expenseHistory = getMonthlyExpenseHistory(6);

  const labels = incomeHistory.map(d => d.month);
  const incomeData = incomeHistory.map(d => d.income);
  const expenseData = expenseHistory.map(d => d.expenses);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: hexToRgba('#2DC653', 0.75),
          borderColor: '#2DC653',
          borderWidth: 1.5,
          borderRadius: 5
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: hexToRgba('#E63946', 0.75),
          borderColor: '#E63946',
          borderWidth: 1.5,
          borderRadius: 5
        }
      ]
    },
    options: {
      ...defaultChartOptions,
      plugins: {
        ...defaultChartOptions.plugins,
        tooltip: {
          ...defaultChartOptions.plugins.tooltip,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${formatYen(ctx.raw)}`
          }
        }
      },
      scales: {
        ...defaultChartOptions.scales,
        y: {
          ...defaultChartOptions.scales.y,
          ticks: {
            ...defaultChartOptions.scales.y.ticks,
            callback: (val) => formatYen(val)
          }
        }
      }
    }
  });
}

function renderDashStudyChart() {
  destroyChart('study-hours-chart');
  const canvas = document.getElementById('study-hours-chart');
  if (!canvas) return;

  const weekData = getWeeklyStudyData();
  const today = APP_CONFIG.daysShort[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: weekData.map(d => d.day),
      datasets: [{
        label: 'Study Hours',
        data: weekData.map(d => d.hours),
        backgroundColor: weekData.map(d =>
          d.day === today ? hexToRgba('#E63946', 0.85) : hexToRgba('#457B9D', 0.7)
        ),
        borderRadius: 6
      }]
    },
    options: {
      ...defaultChartOptions,
      plugins: {
        ...defaultChartOptions.plugins,
        legend: { display: false },
        tooltip: {
          ...defaultChartOptions.plugins.tooltip,
          callbacks: { label: (ctx) => ` ${ctx.raw}h studied` }
        }
      }
    }
  });
}

// ============================================================
// CALENDAR
// ============================================================

// Calendar state
const calendarState = {
  currentView: 'month',
  currentDate: new Date(),
  events: []
};

/**
 * Initialize calendar view controls
 */
function initCalendar() {
  // View buttons
  document.querySelectorAll('[data-cal-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-cal-view]').forEach(b => b.classList.remove('view-btn--active'));
      btn.classList.add('view-btn--active');
      calendarState.currentView = btn.dataset.calView;
      renderCalendarView();
    });
  });

  // Navigation
  document.getElementById('cal-prev')?.addEventListener('click', () => {
    navigateCalendar(-1);
  });

  document.getElementById('cal-next')?.addEventListener('click', () => {
    navigateCalendar(1);
  });

  document.getElementById('cal-today-btn')?.addEventListener('click', () => {
    calendarState.currentDate = new Date();
    renderCalendarView();
  });

  document.getElementById('cal-panel-close')?.addEventListener('click', () => {
    document.getElementById('cal-event-panel')?.classList.add('hidden');
  });
}

/**
 * Navigate calendar forward/backward
 * @param {number} direction - 1 or -1
 */
function navigateCalendar(direction) {
  const d = calendarState.currentDate;
  switch (calendarState.currentView) {
    case 'month':
      calendarState.currentDate = new Date(d.getFullYear(), d.getMonth() + direction, 1);
      break;
    case 'week':
      calendarState.currentDate = new Date(d.getTime() + direction * 7 * 24 * 60 * 60 * 1000);
      break;
    case 'day':
      calendarState.currentDate = new Date(d.getTime() + direction * 24 * 60 * 60 * 1000);
      break;
  }
  renderCalendarView();
}

/**
 * Render the calendar based on current view
 */
function renderCalendarView() {
  buildCalendarEvents();
  switch (calendarState.currentView) {
    case 'month': renderMonthCalendar(); break;
    case 'week': renderWeekCalendar(); break;
    case 'day': renderDayCalendar(); break;
  }
}

/**
 * Build unified event list from all modules
 */
function buildCalendarEvents() {
  const events = [];

  // Classes (recurring weekly)
  if (typeof scheduleState !== 'undefined') {
    scheduleState.classes.forEach(cls => {
      events.push({
        type: 'class',
        title: cls.subject,
        day: cls.day_of_week,
        startTime: cls.start_time,
        endTime: cls.end_time,
        color: cls.color || '#457B9D',
        recurring: true,
        data: cls
      });
    });
  }

  // Shifts
  if (typeof shiftsState !== 'undefined') {
    shiftsState.shifts.forEach(shift => {
      events.push({
        type: 'shift',
        title: shift.workplace,
        date: shift.shift_date,
        startTime: shift.start_time,
        endTime: shift.end_time,
        color: '#2DC653',
        data: shift
      });
    });
  }

  // Tasks
  if (typeof tasksState !== 'undefined') {
    tasksState.tasks.filter(t => t.due_date && !t.completed).forEach(task => {
      events.push({
        type: 'task',
        title: task.title,
        date: task.due_date,
        time: task.due_time,
        color: task.priority === 'high' ? '#E63946' : task.priority === 'medium' ? '#F4A261' : '#2DC653',
        data: task
      });
    });
  }

  // JLPT Exam
  if (typeof jlptState !== 'undefined' && jlptState.goal?.exam_date) {
    events.push({
      type: 'jlpt',
      title: `JLPT ${jlptState.goal.target_level || ''} Exam`,
      date: jlptState.goal.exam_date,
      color: '#E63946',
      data: jlptState.goal
    });
  }

  calendarState.events = events;
}

/**
 * Get events for a specific date
 * @param {string} dateStr
 * @returns {Array}
 */
function getEventsForDate(dateStr) {
  const dayName = getDayOfWeek(dateStr);
  const events = [];

  calendarState.events.forEach(evt => {
    if (evt.recurring && evt.day === dayName) {
      events.push({ ...evt, date: dateStr });
    } else if (evt.date === dateStr) {
      events.push(evt);
    }
  });

  // Sort by time
  events.sort((a, b) => {
    const timeA = a.startTime || a.time || '00:00';
    const timeB = b.startTime || b.time || '00:00';
    return timeA.localeCompare(timeB);
  });

  return events;
}

/**
 * Render month calendar view
 */
function renderMonthCalendar() {
  const container = document.getElementById('calendar-container');
  const periodLabel = document.getElementById('cal-period-label');
  if (!container) return;

  const d = calendarState.currentDate;
  const year = d.getFullYear();
  const month = d.getMonth();

  if (periodLabel) {
    periodLabel.textContent = `${APP_CONFIG.months[month]} ${year}`;
  }

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday start
  const today = getTodayString();

  let html = '<div class="cal-month-grid">';

  // Day headers
  APP_CONFIG.daysShort.forEach(day => {
    html += `<div class="cal-month-header-cell">${day}</div>`;
  });

  // Fill in blank cells before month starts
  for (let i = 0; i < startDow; i++) {
    html += '<div class="cal-month-cell cal-month-cell--other-month"></div>';
  }

  // Month days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const events = getEventsForDate(dateStr);

    let eventChips = '';
    const maxVisible = 2;
    events.slice(0, maxVisible).forEach(evt => {
      eventChips += `
        <span class="cal-event-chip cal-event-chip--${evt.type}"
              title="${escapeHtml(evt.title)}"
              onclick="showDayEvents('${dateStr}', event)">
          ${escapeHtml(truncate(evt.title, 15))}
        </span>
      `;
    });

    if (events.length > maxVisible) {
      eventChips += `<span class="cal-more-events" onclick="showDayEvents('${dateStr}', event)">+${events.length - maxVisible} more</span>`;
    }

    html += `
      <div class="cal-month-cell ${isToday ? 'cal-month-cell--today' : ''}"
           onclick="showDayEvents('${dateStr}', event)">
        <div class="cal-day-num">${day}</div>
        ${eventChips}
      </div>
    `;
  }

  // Fill remaining cells
  const totalCells = startDow + lastDay.getDate();
  const remainCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 0; i < remainCells; i++) {
    html += '<div class="cal-month-cell cal-month-cell--other-month"></div>';
  }

  html += '</div>';
  container.innerHTML = html;
  document.getElementById('cal-event-panel')?.classList.add('hidden');
}

/**
 * Render week calendar view
 */
function renderWeekCalendar() {
  const container = document.getElementById('calendar-container');
  const periodLabel = document.getElementById('cal-period-label');
  if (!container) return;

  // Find Monday of current week
  const d = new Date(calendarState.currentDate);
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - dow);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    days.push(day);
  }

  if (periodLabel) {
    const start = days[0];
    const end = days[6];
    periodLabel.textContent = `${APP_CONFIG.monthsShort[start.getMonth()]} ${start.getDate()} — ${APP_CONFIG.monthsShort[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }

  const today = getTodayString();

  let html = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:600px;">';

  // Header
  html += '<thead><tr><th style="width:60px;padding:8px;background:var(--color-surface-alt);border:1px solid var(--color-border);font-size:var(--font-size-xs);color:var(--color-text-muted);"></th>';
  days.forEach(day => {
    const dateStr = day.toISOString().split('T')[0];
    const isToday = dateStr === today;
    html += `
      <th style="padding:8px;background:var(--color-surface-alt);border:1px solid var(--color-border);text-align:center;">
        <div style="font-size:var(--font-size-xs);font-weight:700;color:${isToday ? 'var(--color-primary)' : 'var(--color-text-secondary)'};">
          ${APP_CONFIG.daysShort[day.getDay() === 0 ? 6 : day.getDay() - 1]}
        </div>
        <div style="font-size:${isToday ? 'var(--font-size-md)' : 'var(--font-size-sm)'};font-weight:700;
          color:${isToday ? 'white' : 'var(--color-text-primary)'};
          background:${isToday ? 'var(--color-primary)' : 'none'};
          border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;margin:4px auto 0;">
          ${day.getDate()}
        </div>
      </th>
    `;
  });
  html += '</tr></thead><tbody>';

  // Time rows (8:00 - 21:00)
  for (let h = 8; h <= 20; h++) {
    const timeStr = `${String(h).padStart(2, '0')}:00`;
    html += `<tr>
      <td style="padding:4px 8px;border:1px solid var(--color-border);font-size:0.65rem;color:var(--color-text-muted);vertical-align:top;background:var(--color-surface-alt);white-space:nowrap;">${formatTime12(timeStr)}</td>`;

    days.forEach(day => {
      const dateStr = day.toISOString().split('T')[0];
      const dayEvents = getEventsForDate(dateStr).filter(e => {
        const eHour = parseInt((e.startTime || '00:00').split(':')[0]);
        return eHour === h;
      });

      let cellContent = dayEvents.map(evt => `
        <div style="
          background-color:${hexToRgba(evt.color, 0.15)};
          border-left:3px solid ${escapeHtml(evt.color)};
          border-radius:4px;
          padding:3px 6px;
          margin-bottom:3px;
          font-size:0.65rem;
          font-weight:600;
          color:${escapeHtml(evt.color)};
          cursor:pointer;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        " title="${escapeHtml(evt.title)}">
          ${escapeHtml(truncate(evt.title, 16))}
        </div>
      `).join('');

      html += `<td style="border:1px solid var(--color-border);padding:3px;vertical-align:top;min-width:80px;min-height:40px;">${cellContent}</td>`;
    });

    html += '</tr>';
  }

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

/**
 * Render day calendar view
 */
function renderDayCalendar() {
  const container = document.getElementById('calendar-container');
  const periodLabel = document.getElementById('cal-period-label');
  if (!container) return;

  const d = calendarState.currentDate;
  const dateStr = d.toISOString().split('T')[0];

  if (periodLabel) {
    periodLabel.textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  const events = getEventsForDate(dateStr);
  const today = getTodayString();

  let html = '<div style="padding:var(--spacing-4);">';

  if (dateStr === today) {
    html += '<div style="display:inline-block;background:var(--color-primary);color:white;padding:4px 12px;border-radius:var(--radius-full);font-size:var(--font-size-xs);font-weight:700;margin-bottom:var(--spacing-4);">TODAY</div>';
  }

  if (!events.length) {
    html += `
      <div class="empty-state empty-state--small">
        <ion-icon name="calendar-outline"></ion-icon>
        <p>No events on this day</p>
      </div>
    `;
  } else {
    // Timeline style
    for (let h = 6; h <= 22; h++) {
      const timeStr = `${String(h).padStart(2, '0')}:00`;
      const hourEvents = events.filter(e => {
        const eHour = parseInt((e.startTime || e.time || '00:00').split(':')[0]);
        return eHour === h;
      });

      html += `
        <div style="display:flex;align-items:flex-start;gap:var(--spacing-3);padding:var(--spacing-2) 0;border-bottom:1px solid var(--color-border);">
          <div style="width:60px;font-size:var(--font-size-xs);color:var(--color-text-muted);padding-top:6px;flex-shrink:0;">${formatTime12(timeStr)}</div>
          <div style="flex:1;min-height:36px;">
            ${hourEvents.map(evt => `
              <div style="
                background-color:${hexToRgba(evt.color, 0.12)};
                border-left:4px solid ${escapeHtml(evt.color)};
                border-radius:var(--radius-sm);
                padding:var(--spacing-2) var(--spacing-3);
                margin-bottom:var(--spacing-1);
              ">
                <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-primary);">${escapeHtml(evt.title)}</div>
                ${evt.startTime && evt.endTime
                  ? `<div style="font-size:var(--font-size-xs);color:var(--color-text-muted);">${formatTime12(evt.startTime)} — ${formatTime12(evt.endTime)}</div>`
                  : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  html += '</div>';
  container.innerHTML = html;
}

/**
 * Show events for a specific day in the event panel
 * @param {string} dateStr
 * @param {Event} e
 */
function showDayEvents(dateStr, e) {
  if (e) e.stopPropagation();

  const panel = document.getElementById('cal-event-panel');
  const panelTitle = document.getElementById('cal-event-panel-title');
  const panelBody = document.getElementById('cal-event-panel-body');

  if (!panel) return;

  const events = getEventsForDate(dateStr);
  const formattedDate = formatDate(dateStr, { weekday: 'long', month: 'long', day: 'numeric' });

  if (panelTitle) panelTitle.textContent = formattedDate;

  if (!events.length) {
    if (panelBody) panelBody.innerHTML = '<p style="color:var(--color-text-muted);font-size:var(--font-size-sm);text-align:center;padding:var(--spacing-4);">No events on this day.</p>';
  } else {
    if (panelBody) {
      panelBody.innerHTML = events.map(evt => `
        <div class="cal-panel-event">
          <div class="cal-panel-event-dot" style="background-color:${escapeHtml(evt.color)};"></div>
          <div class="cal-panel-event-info">
            <div class="cal-panel-event-title">${escapeHtml(evt.title)}</div>
            <div class="cal-panel-event-time">
              ${evt.type === 'class' ? 'Class' : evt.type === 'shift' ? 'Work' : evt.type === 'task' ? 'Task' : 'JLPT'}
              ${evt.startTime ? ` · ${formatTime12(evt.startTime)}${evt.endTime ? ` — ${formatTime12(evt.endTime)}` : ''}` : ''}
            </div>
          </div>
          <span class="badge badge--${evt.type === 'class' ? 'study' : evt.type === 'shift' ? 'food' : evt.type === 'jlpt' ? 'kanji' : 'other'}" style="font-size:0.6rem;">
            ${capitalize(evt.type)}
          </span>
        </div>
      `).join('');
    }
  }

  panel.classList.remove('hidden');
}

// ============================================================
// WAIT FOR AUTH THEN INIT
// ============================================================

// Wait for auth module to set up currentUser, then init dashboard app
const dashInitInterval = setInterval(() => {
  if (window.currentUser) {
    clearInterval(dashInitInterval);
    initDashboardApp().catch(err => {
      console.error('[Dashboard] Init failed:', err);
    });
  }
}, 100);

// Safety timeout after 5 seconds
setTimeout(() => {
  clearInterval(dashInitInterval);
  if (!window.currentUser) {
    console.warn('[Dashboard] Timeout waiting for auth, redirecting...');
    window.location.href = 'index.html';
  }
}, 5000);
