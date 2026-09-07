/**
 * jlpt.js
 * JLPT exam preparation tracker — level selection, countdown, progress.
 */

// Module state
const jlptState = {
  goal: null,
  selectedLevel: null,
  countdownInterval: null
};

// JLPT level requirements (approximate)
const JLPT_REQUIREMENTS = {
  N5: { vocab: 800, kanji: 100, desc: 'Basic Japanese — hiragana, katakana, simple phrases' },
  N4: { vocab: 1500, kanji: 300, desc: 'Basic Japanese — everyday conversations' },
  N3: { vocab: 3750, kanji: 650, desc: 'Intermediate — understands everyday situations' },
  N2: { vocab: 6000, kanji: 1000, desc: 'Advanced — reads newspapers, business Japanese' },
  N1: { vocab: 10000, kanji: 2000, desc: 'Expert level — nuanced understanding' }
};

// Progress categories
const JLPT_SKILLS = [
  { key: 'vocab_progress', label: 'Vocabulary', icon: 'book-outline', color: '#3B82F6' },
  { key: 'kanji_progress', label: 'Kanji', icon: 'text-outline', color: '#E63946' },
  { key: 'grammar_progress', label: 'Grammar', icon: 'create-outline', color: '#2DC653' },
  { key: 'listening_progress', label: 'Listening', icon: 'headset-outline', color: '#F4A261' },
  { key: 'reading_progress', label: 'Reading', icon: 'reader-outline', color: '#9333EA' }
];

// ============================================================
// INITIALIZATION
// ============================================================

async function initJLPT() {
  setupJLPTEventListeners();
  await loadJLPTGoal();
  renderJLPTProgressGrid();
}

function setupJLPTEventListeners() {
  // Level selection buttons
  document.querySelectorAll('.jlpt-level-btn').forEach(btn => {
    btn.addEventListener('click', () => selectJLPTLevel(btn.dataset.level));
  });

  // Exam date change
  const examDateEl = document.getElementById('jlpt-exam-date');
  if (examDateEl) {
    examDateEl.addEventListener('change', updateJLPTCountdown);
  }

  // Save button
  document.getElementById('save-jlpt-btn')?.addEventListener('click', saveJLPTGoal);
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadJLPTGoal() {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('jlpt_goals')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

    if (data) {
      jlptState.goal = data;
      populateJLPTForm(data);
    }
  } catch (err) {
    console.error('[JLPT] Load error:', err);
  }
}

/**
 * Populate the JLPT form with saved goal data
 * @param {Object} goal
 */
function populateJLPTForm(goal) {
  // Set selected level
  if (goal.target_level) {
    selectJLPTLevel(goal.target_level, false);
  }

  // Set exam date
  const dateEl = document.getElementById('jlpt-exam-date');
  if (dateEl && goal.exam_date) {
    dateEl.value = goal.exam_date;
    updateJLPTCountdown();
  }

  // Set notes
  const notesEl = document.getElementById('jlpt-notes');
  if (notesEl && goal.notes) {
    notesEl.value = goal.notes;
  }

  // Update progress inputs
  JLPT_SKILLS.forEach(skill => {
    const input = document.getElementById(`jlpt-${skill.key}`);
    if (input) input.value = goal[skill.key] || 0;
    updateProgressBar(skill.key, goal[skill.key] || 0);
  });
}

// ============================================================
// LEVEL SELECTION
// ============================================================

/**
 * Handle JLPT level selection
 * @param {string} level - N1 through N5
 * @param {boolean} updateUI - Whether to update button states
 */
function selectJLPTLevel(level, updateUI = true) {
  jlptState.selectedLevel = level;

  if (updateUI) {
    document.querySelectorAll('.jlpt-level-btn').forEach(btn => {
      btn.classList.toggle('jlpt-level-btn--active', btn.dataset.level === level);
    });
  } else {
    document.querySelectorAll('.jlpt-level-btn').forEach(btn => {
      btn.classList.toggle('jlpt-level-btn--active', btn.dataset.level === level);
    });
  }

  // Update dashboard JLPT widget
  const dashLevel = document.getElementById('dash-jlpt-level');
  if (dashLevel) {
    const req = JLPT_REQUIREMENTS[level];
    dashLevel.textContent = `Target: JLPT ${level} — ${req?.desc || ''}`;
  }
}

// ============================================================
// COUNTDOWN
// ============================================================

/**
 * Update the JLPT countdown displays
 */
function updateJLPTCountdown() {
  const dateEl = document.getElementById('jlpt-exam-date');
  const daysCountEl = document.getElementById('jlpt-days-count');
  const descEl = document.getElementById('jlpt-countdown-desc');
  const dashDaysEl = document.getElementById('dash-jlpt-days');
  const dashLabel = document.getElementById('dash-jlpt-label');

  if (!dateEl?.value) {
    if (daysCountEl) daysCountEl.textContent = '--';
    if (descEl) descEl.textContent = 'Set your exam date to start countdown';
    if (dashDaysEl) dashDaysEl.textContent = '--';
    return;
  }

  const days = daysUntil(dateEl.value);
  const levelStr = jlptState.selectedLevel ? `JLPT ${jlptState.selectedLevel}` : 'your exam';

  if (days === null) return;

  let daysText, descText;

  if (days < 0) {
    daysText = Math.abs(days);
    descText = `${levelStr} exam was ${Math.abs(days)} days ago`;
  } else if (days === 0) {
    daysText = '0';
    descText = `🎉 ${levelStr} exam is TODAY! Good luck!`;
  } else {
    daysText = days;
    const examDate = new Date(dateEl.value + 'T00:00:00');
    descText = `Until ${levelStr} on ${formatDate(dateEl.value, { month: 'long', day: 'numeric', year: 'numeric' })}`;
  }

  if (daysCountEl) daysCountEl.textContent = daysText;
  if (descEl) descEl.textContent = descText;
  if (dashDaysEl) dashDaysEl.textContent = days >= 0 ? days : `+${Math.abs(days)}`;
  if (dashLabel) dashLabel.textContent = days >= 0 ? 'Days until JLPT' : 'Days since JLPT';
}

// ============================================================
// PROGRESS GRID
// ============================================================

/**
 * Render the progress tracking grid
 */
function renderJLPTProgressGrid() {
  const grid = document.getElementById('jlpt-progress-grid');
  if (!grid) return;

  const goal = jlptState.goal || {};

  grid.innerHTML = JLPT_SKILLS.map(skill => {
    const value = goal[skill.key] || 0;
    return `
      <div class="jlpt-progress-item">
        <div class="jlpt-progress-header">
          <span class="jlpt-progress-label">
            <ion-icon name="${skill.icon}" style="color:${skill.color};"></ion-icon>
            ${skill.label}
          </span>
          <div style="display:flex;align-items:center;gap:8px;">
            <input
              type="number"
              id="jlpt-${skill.key}"
              class="jlpt-progress-input"
              value="${value}"
              min="0"
              max="100"
              aria-label="${skill.label} progress percentage"
              oninput="updateProgressBar('${skill.key}', this.value)"
            />
            <span class="jlpt-progress-pct" id="jlpt-${skill.key}-pct">${value}%</span>
          </div>
        </div>
        <div class="progress-bar-track">
          <div
            class="progress-bar-fill"
            id="jlpt-${skill.key}-bar"
            style="width:${value}%;background:linear-gradient(90deg, ${skill.color}, ${hexToRgba(skill.color, 0.7)});"
          ></div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Update a progress bar UI
 * @param {string} skillKey
 * @param {number} value
 */
function updateProgressBar(skillKey, value) {
  const pct = Math.min(100, Math.max(0, parseInt(value) || 0));
  const bar = document.getElementById(`jlpt-${skillKey}-bar`);
  const pctLabel = document.getElementById(`jlpt-${skillKey}-pct`);
  if (bar) bar.style.width = `${pct}%`;
  if (pctLabel) pctLabel.textContent = `${pct}%`;
}

// ============================================================
// SAVE
// ============================================================

/**
 * Save JLPT goal to Supabase
 */
async function saveJLPTGoal() {
  const examDate = document.getElementById('jlpt-exam-date')?.value;
  const notes = document.getElementById('jlpt-notes')?.value.trim();

  // Collect progress values
  const progressData = {};
  JLPT_SKILLS.forEach(skill => {
    const input = document.getElementById(`jlpt-${skill.key}`);
    progressData[skill.key] = Math.min(100, Math.max(0, parseInt(input?.value) || 0));
  });

  const saveBtn = document.getElementById('save-jlpt-btn');
  if (saveBtn) saveBtn.disabled = true;

  try {
    const sb = getSupabase();
    const payload = {
      user_id: window.currentUser.id,
      target_level: jlptState.selectedLevel || null,
      exam_date: examDate || null,
      notes: notes || null,
      ...progressData
    };

    let error;

    if (jlptState.goal?.id) {
      // Update existing
      ({ error } = await sb.from('jlpt_goals')
        .update(payload)
        .eq('id', jlptState.goal.id)
        .eq('user_id', window.currentUser.id));
    } else {
      // Insert new
      let data;
      ({ data, error } = await sb.from('jlpt_goals').insert(payload).select().single());
      if (!error && data) jlptState.goal = data;
    }

    if (error) throw error;

    // Refresh goal data
    await loadJLPTGoal();
    updateJLPTCountdown();

    showToast('JLPT Goal Saved', `${jlptState.selectedLevel || 'Goal'} target saved successfully! がんばって！`, 'success');

  } catch (err) {
    console.error('[JLPT] Save error:', err);
    showToast('Save Failed', 'Could not save JLPT goal. Please try again.', 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ============================================================
// ANALYTICS HELPERS (for dashboard/calendar)
// ============================================================

/**
 * Get days until JLPT exam
 * @returns {number|null}
 */
function getDaysUntilJLPT() {
  const goal = jlptState.goal;
  if (!goal?.exam_date) return null;
  return daysUntil(goal.exam_date);
}

/**
 * Get JLPT exam date string
 * @returns {string|null}
 */
function getJLPTExamDate() {
  return jlptState.goal?.exam_date || null;
}

/**
 * Get JLPT target level
 * @returns {string|null}
 */
function getJLPTLevel() {
  return jlptState.selectedLevel || jlptState.goal?.target_level || null;
}
