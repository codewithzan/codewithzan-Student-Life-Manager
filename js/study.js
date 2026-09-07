/**
 * study.js
 * Japanese study tracking — CRUD, streak calculation, analytics.
 */

// Module state
const studyState = {
  sessions: [],
  filtered: [],
  monthFilter: getCurrentMonth(),
  categoryFilter: '',
  streak: 0,
  charts: {
    category: null,
    weekly: null
  }
};

// Study category configuration
const STUDY_CATEGORIES = {
  vocabulary: { label: 'Vocabulary', icon: 'book-outline', color: '#3B82F6', jp: '語彙' },
  kanji: { label: 'Kanji', icon: 'text-outline', color: '#E63946', jp: '漢字' },
  grammar: { label: 'Grammar', icon: 'create-outline', color: '#2DC653', jp: '文法' },
  listening: { label: 'Listening', icon: 'headset-outline', color: '#F4A261', jp: '聴解' },
  reading: { label: 'Reading', icon: 'reader-outline', color: '#9333EA', jp: '読解' },
  speaking: { label: 'Speaking', icon: 'mic-outline', color: '#457B9D', jp: '会話' }
};

// ============================================================
// INITIALIZATION
// ============================================================

async function initStudy() {
  const monthInput = document.getElementById('study-month-filter');
  if (monthInput) monthInput.value = getCurrentMonth();

  setupStudyEventListeners();
  await loadStudySessions();
}

function setupStudyEventListeners() {
  document.getElementById('add-study-btn')?.addEventListener('click', () => openStudyModal());
  document.getElementById('add-study-btn-empty')?.addEventListener('click', () => openStudyModal());
  document.getElementById('study-form')?.addEventListener('submit', handleStudySubmit);

  document.getElementById('study-month-filter')?.addEventListener('change', (e) => {
    studyState.monthFilter = e.target.value;
    applyStudyFilters();
  });

  document.getElementById('study-category-filter')?.addEventListener('change', (e) => {
    studyState.categoryFilter = e.target.value;
    applyStudyFilters();
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadStudySessions() {
  const container = document.getElementById('study-list');
  if (container) showLoading(container, 'Loading sessions...');

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('study_sessions')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('session_date', { ascending: false });

    if (error) throw error;

    studyState.sessions = data || [];
    studyState.streak = calculateStudyStreak(studyState.sessions);
    applyStudyFilters();
    renderStudyCharts();
  } catch (err) {
    console.error('[Study] Load error:', err);
    showToast('Error', 'Failed to load study sessions.', 'error');
  }
}

function applyStudyFilters() {
  let filtered = [...studyState.sessions];

  if (studyState.monthFilter) {
    filtered = filtered.filter(s => s.session_date?.startsWith(studyState.monthFilter));
  }

  if (studyState.categoryFilter) {
    filtered = filtered.filter(s => s.category === studyState.categoryFilter);
  }

  studyState.filtered = filtered;
  renderStudyStats(filtered);
  renderStudyList(filtered);
}

// ============================================================
// STREAK CALCULATION
// ============================================================

/**
 * Calculate consecutive study streak
 * @param {Array} sessions
 * @returns {number} streak days
 */
function calculateStudyStreak(sessions) {
  if (!sessions.length) return 0;

  // Get unique study dates, sorted descending
  const uniqueDates = [...new Set(sessions.map(s => s.session_date))].sort().reverse();
  if (!uniqueDates.length) return 0;

  const today = getTodayString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Streak must include today or yesterday to be active
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterdayStr) return 0;

  let streak = 0;
  let currentDate = new Date(uniqueDates[0] + 'T00:00:00');

  for (const dateStr of uniqueDates) {
    const d = new Date(dateStr + 'T00:00:00');
    const diffDays = Math.round((currentDate - d) / (1000 * 60 * 60 * 24));

    if (diffDays === 0 || diffDays === 1) {
      streak++;
      currentDate = d;
    } else {
      break;
    }
  }

  return streak;
}

// ============================================================
// RENDERING
// ============================================================

function renderStudyStats(filtered) {
  const totalMinutes = filtered.reduce((sum, s) => sum + Number(s.duration_minutes), 0);

  // This week
  const weekStart = getWeekStart();
  const weekSessions = studyState.sessions.filter(s => {
    const d = new Date(s.session_date + 'T00:00:00');
    return d >= weekStart;
  });
  const weekMinutes = weekSessions.reduce((sum, s) => sum + Number(s.duration_minutes), 0);

  // Top category
  const catTotals = {};
  filtered.forEach(s => { catTotals[s.category] = (catTotals[s.category] || 0) + Number(s.duration_minutes); });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('study-streak-val', `${studyState.streak} ${studyState.streak === 1 ? 'day' : 'days'}`);
  setEl('study-hours-month', formatHours(totalMinutes / 60));
  setEl('study-hours-week', formatHours(weekMinutes / 60));
  setEl('study-top-cat', topCat ? capitalize(topCat[0]) : '—');

  // Also update global streak stat on dashboard
  const statStreak = document.getElementById('stat-streak');
  const statStudy = document.getElementById('stat-study-hours');
  if (statStreak) statStreak.textContent = `${studyState.streak} days`;
  const monthMinutes = studyState.sessions
    .filter(s => s.session_date?.startsWith(getCurrentMonth()))
    .reduce((sum, s) => sum + Number(s.duration_minutes), 0);
  if (statStudy) statStudy.textContent = `${formatHours(monthMinutes / 60)} this month`;
}

function renderStudyList(sessions) {
  const container = document.getElementById('study-list');
  if (!container) return;

  if (!sessions.length) {
    showEmptyState(
      container,
      'library-outline',
      'No Study Sessions',
      'Begin logging your Japanese study sessions.',
      `<button class="btn btn--primary" onclick="openStudyModal()">
        <ion-icon name="add-outline"></ion-icon> Log Session
      </button>`
    );
    return;
  }

  container.innerHTML = sessions.map(s => renderStudyItem(s)).join('');
}

function renderStudyItem(session) {
  const cat = STUDY_CATEGORIES[session.category] || STUDY_CATEGORIES.vocabulary;
  return `
    <div class="list-item">
      <div class="list-item-icon" style="background-color:${hexToRgba(cat.color, 0.12)};color:${cat.color};">
        <ion-icon name="${cat.icon}"></ion-icon>
      </div>
      <div class="list-item-info">
        <div class="list-item-title">${cat.label} <span style="font-family:serif;font-size:0.85em;color:var(--color-text-muted);">${cat.jp}</span></div>
        <div class="list-item-meta">
          <span><ion-icon name="calendar-outline"></ion-icon> ${formatDate(session.session_date)}</span>
          <span><ion-icon name="time-outline"></ion-icon> ${formatDuration(session.duration_minutes)}</span>
          <span class="badge badge--${escapeHtml(session.category)}">${cat.label}</span>
        </div>
        ${session.notes ? `<div style="font-size:var(--font-size-xs);color:var(--color-text-muted);margin-top:4px;">${escapeHtml(truncate(session.notes, 80))}</div>` : ''}
      </div>
      <div class="list-item-actions">
        <button class="action-btn" onclick="openStudyModal('${escapeHtml(session.id)}')" aria-label="Edit session" title="Edit">
          <ion-icon name="create-outline"></ion-icon>
        </button>
        <button class="action-btn action-btn--delete" onclick="deleteStudySession('${escapeHtml(session.id)}')" aria-label="Delete session" title="Delete">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// CHARTS
// ============================================================

function renderStudyCharts() {
  renderStudyCategoryChart();
  renderStudyWeeklyChart();
}

function renderStudyCategoryChart() {
  destroyChart('study-category-chart');
  const canvas = document.getElementById('study-category-chart');
  if (!canvas) return;

  const monthStr = getCurrentMonth();
  const monthSessions = studyState.sessions.filter(s => s.session_date?.startsWith(monthStr));

  const catTotals = {};
  Object.keys(STUDY_CATEGORIES).forEach(k => catTotals[k] = 0);
  monthSessions.forEach(s => { catTotals[s.category] = (catTotals[s.category] || 0) + Number(s.duration_minutes); });

  const labels = [];
  const data = [];
  const colors = [];

  Object.entries(catTotals).forEach(([key, val]) => {
    if (val > 0) {
      labels.push(STUDY_CATEGORIES[key].label);
      data.push(Math.round(val / 60 * 10) / 10);
      colors.push(STUDY_CATEGORIES[key].color);
    }
  });

  if (!data.length) {
    canvas.parentElement.innerHTML = '<div class="empty-state empty-state--small"><ion-icon name="pie-chart-outline"></ion-icon><p>No study data yet</p></div>';
    return;
  }

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => hexToRgba(c, 0.85)),
        borderColor: colors,
        borderWidth: 2,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#4A4A5A',
            font: { size: 11 },
            padding: 12,
            usePointStyle: true
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw}h`
          }
        }
      }
    }
  });
}

function renderStudyWeeklyChart() {
  destroyChart('study-weekly-chart');
  const canvas = document.getElementById('study-weekly-chart');
  if (!canvas) return;

  const weekStart = getWeekStart();
  const days = [];
  const data = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const minutes = studyState.sessions
      .filter(s => s.session_date === dateStr)
      .reduce((sum, s) => sum + Number(s.duration_minutes), 0);
    days.push(APP_CONFIG.daysShort[i]);
    data.push(Math.round(minutes / 60 * 10) / 10);
  }

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Study Hours',
        data,
        backgroundColor: days.map((_, i) => {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + i);
          return d.toISOString().split('T')[0] === getTodayString()
            ? hexToRgba('#E63946', 0.85)
            : hexToRgba('#457B9D', 0.7);
        }),
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
          callbacks: { label: (ctx) => ` ${ctx.raw}h` }
        }
      }
    }
  });
}

// ============================================================
// MODAL
// ============================================================

function openStudyModal(sessionId = null) {
  const form = document.getElementById('study-form');
  const title = document.getElementById('study-modal-title');
  const idInput = document.getElementById('study-id');

  form?.reset();
  if (idInput) idInput.value = '';
  if (title) title.textContent = sessionId ? 'Edit Study Session' : 'Log Study Session';

  const dateEl = document.getElementById('study-date');
  if (dateEl) dateEl.value = getTodayString();

  if (sessionId) {
    const session = studyState.sessions.find(s => s.id === sessionId);
    if (session) {
      if (idInput) idInput.value = session.id;
      setFormValue('study-category', session.category);
      setFormValue('study-duration', session.duration_minutes);
      setFormValue('study-date', session.session_date);
      setFormValue('study-notes', session.notes);
    }
  }

  openModal('study-modal-overlay');
}

async function handleStudySubmit(e) {
  e.preventDefault();

  const id = document.getElementById('study-id')?.value;
  const category = document.getElementById('study-category')?.value;
  const duration = parseInt(document.getElementById('study-duration')?.value);
  const sessionDate = document.getElementById('study-date')?.value;
  const notes = document.getElementById('study-notes')?.value.trim();

  if (!category || !duration || !sessionDate) {
    showToast('Missing Fields', 'Please fill in all required fields.', 'warning');
    return;
  }

  if (duration < 1) {
    showToast('Invalid Duration', 'Duration must be at least 1 minute.', 'warning');
    return;
  }

  const submitBtn = document.getElementById('study-submit-btn');
  submitBtn.disabled = true;

  try {
    const sb = getSupabase();
    const payload = {
      user_id: window.currentUser.id,
      category,
      duration_minutes: duration,
      session_date: sessionDate,
      notes: notes || null
    };

    let error;

    if (id) {
      ({ error } = await sb.from('study_sessions').update(payload).eq('id', id).eq('user_id', window.currentUser.id));
    } else {
      ({ error } = await sb.from('study_sessions').insert(payload));
    }

    if (error) throw error;

    closeModal('study-modal-overlay');
    await loadStudySessions();
    showToast(id ? 'Session Updated' : 'Session Logged', `${formatDuration(duration)} of ${capitalize(category)} study recorded! 🎌`, 'success');

  } catch (err) {
    console.error('[Study] Save error:', err);
    showToast('Save Failed', 'Could not save study session. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

// ============================================================
// DELETE
// ============================================================

function deleteStudySession(sessionId) {
  const session = studyState.sessions.find(s => s.id === sessionId);
  const name = session ? `${capitalize(session.category)} session` : 'this session';

  confirmDelete(`Delete ${name}? This action cannot be undone.`, async () => {
    try {
      const sb = getSupabase();
      const { error } = await sb.from('study_sessions').delete().eq('id', sessionId).eq('user_id', window.currentUser.id);
      if (error) throw error;
      await loadStudySessions();
      showToast('Session Deleted', 'The study session has been removed.', 'success');
    } catch (err) {
      console.error('[Study] Delete error:', err);
      showToast('Delete Failed', 'Could not delete session. Please try again.', 'error');
    }
  });
}

// ============================================================
// ANALYTICS HELPERS (for dashboard)
// ============================================================

function getStudyStreak() {
  return studyState.streak;
}

function getMonthlyStudyHours() {
  const monthStr = getCurrentMonth();
  const minutes = studyState.sessions
    .filter(s => s.session_date?.startsWith(monthStr))
    .reduce((sum, s) => sum + Number(s.duration_minutes), 0);
  return minutes / 60;
}

function getWeeklyStudyData() {
  const weekStart = getWeekStart();
  const result = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const minutes = studyState.sessions
      .filter(s => s.session_date === dateStr)
      .reduce((sum, s) => sum + Number(s.duration_minutes), 0);
    result.push({ day: APP_CONFIG.daysShort[i], hours: Math.round(minutes / 60 * 10) / 10 });
  }
  return result;
}
