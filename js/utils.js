/**
 * utils.js
 * Shared utility functions used across all modules.
 * Handles formatting, DOM helpers, toast notifications, modals, etc.
 */

// ============================================================
// DATE & TIME UTILITIES
// ============================================================

/**
 * Format a date to Japanese-style display (YYYY/MM/DD)
 * @param {string|Date} date
 * @returns {string}
 */
function formatDateJP(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d)) return '—';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Format a date for display
 * @param {string|Date} date
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string}
 */
function formatDate(date, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!date) return '—';
  const d = new Date(date + 'T00:00:00'); // prevent timezone shift
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', options);
}

/**
 * Format time (HH:MM) to 12-hour display
 * @param {string} time - "HH:MM" format
 * @returns {string}
 */
function formatTime12(time) {
  if (!time) return '—';
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Get today's date as YYYY-MM-DD string
 * @returns {string}
 */
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get the first day of a month as YYYY-MM-DD
 * @param {number} year
 * @param {number} month - 0-indexed
 * @returns {string}
 */
function getMonthStart(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

/**
 * Get the last day of a month as YYYY-MM-DD
 * @param {number} year
 * @param {number} month - 0-indexed
 * @returns {string}
 */
function getMonthEnd(year, month) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
}

/**
 * Get current month as YYYY-MM string
 * @returns {string}
 */
function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Calculate number of days until a date
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {number}
 */
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = target - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get start of current week (Monday)
 * @returns {Date}
 */
function getWeekStart() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(today.setDate(diff));
}

/**
 * Check if a date string is today
 * @param {string} dateStr
 * @returns {boolean}
 */
function isToday(dateStr) {
  return dateStr === getTodayString();
}

/**
 * Get day of week name from a date string
 * @param {string} dateStr
 * @returns {string}
 */
function getDayOfWeek(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return APP_CONFIG.days[date.getDay() === 0 ? 6 : date.getDay() - 1];
}

// ============================================================
// CURRENCY & NUMBER UTILITIES
// ============================================================

/**
 * Format amount as Japanese Yen
 * @param {number} amount
 * @returns {string}
 */
function formatYen(amount) {
  if (amount === null || amount === undefined) return '¥0';
  return '¥' + Number(amount).toLocaleString('ja-JP');
}

/**
 * Format a duration in minutes to human-readable
 * @param {number} minutes
 * @returns {string}
 */
function formatDuration(minutes) {
  if (!minutes) return '0min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/**
 * Format hours number
 * @param {number} hours
 * @returns {string}
 */
function formatHours(hours) {
  if (!hours) return '0h';
  return `${Number(hours).toFixed(1)}h`;
}

/**
 * Calculate worked hours from start/end time and break minutes
 * @param {string} startTime - "HH:MM"
 * @param {string} endTime - "HH:MM"
 * @param {number} breakMinutes
 * @returns {number} hours
 */
function calcWorkedHours(startTime, endTime, breakMinutes = 0) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) endMins += 24 * 60; // cross midnight
  const worked = (endMins - startMins - Number(breakMinutes)) / 60;
  return Math.max(0, Math.round(worked * 100) / 100);
}

/**
 * Calculate pay from hours and wage
 * @param {number} hours
 * @param {number} wage
 * @returns {number}
 */
function calcPay(hours, wage) {
  return Math.round(hours * wage);
}

// ============================================================
// STRING UTILITIES
// ============================================================

/**
 * Capitalize first letter
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get initials from a name
 * @param {string} firstName
 * @param {string} lastName
 * @returns {string}
 */
function getInitials(firstName, lastName) {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (!f && !l) return '?';
  return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase();
}

/**
 * Truncate text
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(text, maxLength = 50) {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

/**
 * Show a toast notification
 * @param {string} title
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {number} duration - ms to auto-dismiss (0 = no auto-dismiss)
 */
function showToast(title, message = '', type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: 'checkmark-circle-outline',
    error: 'close-circle-outline',
    warning: 'warning-outline',
    info: 'information-circle-outline'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <ion-icon name="${icons[type]}" class="toast-icon"></ion-icon>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Close notification">
      <ion-icon name="close-outline"></ion-icon>
    </button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  const dismiss = () => {
    toast.classList.add('toast--exit');
    setTimeout(() => toast.remove(), 300);
  };

  closeBtn.addEventListener('click', dismiss);

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(dismiss, duration);
  }
}

// ============================================================
// MODAL UTILITIES
// ============================================================

/**
 * Open a modal by overlay ID
 * @param {string} modalId
 */
function openModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Focus first focusable element
  setTimeout(() => {
    const focusable = overlay.querySelector('input, select, textarea, button:not(.modal-close)');
    if (focusable) focusable.focus();
  }, 100);
}

/**
 * Close a modal by overlay ID
 * @param {string} modalId
 */
function closeModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

/**
 * Close modal when clicking overlay backdrop
 */
function initModalOverlayClose() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  // Close buttons
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.dataset.modal);
    });
  });

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal-overlay:not(.hidden)');
      if (openModal) closeModal(openModal.id);
    }
  });
}

// ============================================================
// DOM UTILITIES
// ============================================================

/**
 * Escape HTML to prevent XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Set loading state on a button
 * @param {HTMLButtonElement} btn
 * @param {boolean} isLoading
 */
function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  const text = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');

  if (isLoading) {
    btn.disabled = true;
    if (text) text.classList.add('hidden');
    if (loader) loader.classList.remove('hidden');
  } else {
    btn.disabled = false;
    if (text) text.classList.remove('hidden');
    if (loader) loader.classList.add('hidden');
  }
}

/**
 * Show loading state in a container
 * @param {HTMLElement} container
 * @param {string} message
 */
function showLoading(container, message = 'Loading...') {
  if (!container) return;
  container.innerHTML = `
    <div class="loading-spinner">
      <ion-icon name="reload-outline"></ion-icon>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
}

/**
 * Show empty state in a container
 * @param {HTMLElement} container
 * @param {string} icon
 * @param {string} title
 * @param {string} message
 * @param {string} actionHtml - optional action button HTML
 */
function showEmptyState(container, icon, title, message, actionHtml = '') {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state">
      <ion-icon name="${escapeHtml(icon)}"></ion-icon>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      ${actionHtml}
    </div>
  `;
}

/**
 * Set a form input's value safely
 * @param {string} id - Element ID
 * @param {string} value - Value to set
 */
function setFormValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

/**
 * Clear and populate a select element
 * @param {HTMLSelectElement} select
 * @param {Array} options - [{value, label}]
 * @param {string} placeholder
 */
function populateSelect(select, options, placeholder = '') {
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = '';
  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    select.appendChild(opt);
  }
  options.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}

// ============================================================
// FORM VALIDATION
// ============================================================

/**
 * Validate an input field and show error
 * @param {HTMLInputElement} input
 * @param {string} errorId
 * @param {string} message
 * @returns {boolean} isValid
 */
function validateField(input, errorId, message) {
  const errorEl = document.getElementById(errorId);
  if (!input.value.trim()) {
    if (errorEl) errorEl.textContent = message;
    input.classList.add('input-error');
    return false;
  }
  if (errorEl) errorEl.textContent = '';
  input.classList.remove('input-error');
  return true;
}

/**
 * Clear all form errors
 * @param {HTMLFormElement} form
 */
function clearFormErrors(form) {
  if (!form) return;
  form.querySelectorAll('.form-error').forEach(el => el.textContent = '');
  form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
}

// ============================================================
// PASSWORD STRENGTH
// ============================================================

/**
 * Calculate password strength (0-4)
 * @param {string} password
 * @returns {number}
 */
function getPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(4, score);
}

/**
 * Update password strength UI
 * @param {string} password
 */
function updatePasswordStrength(password) {
  const bars = document.querySelectorAll('.strength-bar');
  const label = document.getElementById('strength-label');
  if (!bars.length) return;

  const strength = getPasswordStrength(password);
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const classes = ['', 'active-weak', 'active-fair', 'active-good', 'active-strong'];

  bars.forEach((bar, i) => {
    bar.className = 'strength-bar';
    if (i < strength) bar.classList.add(classes[strength]);
  });

  if (label) label.textContent = password ? labels[strength] : 'Password strength';
}

// ============================================================
// CHART UTILITIES
// ============================================================

/**
 * Default chart options for a clean, Japanese-inspired look
 */
const defaultChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#4A4A5A',
        font: { family: "'Segoe UI', -apple-system, sans-serif", size: 12 },
        padding: 16,
        usePointStyle: true,
        pointStyleWidth: 8
      }
    },
    tooltip: {
      backgroundColor: '#1A1A2E',
      titleColor: '#F0F0F5',
      bodyColor: '#B0B0C0',
      borderColor: '#2E2E3E',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      titleFont: { weight: '600' }
    }
  },
  scales: {
    x: {
      grid: { color: '#E8E7E4', drawBorder: false },
      ticks: { color: '#8A8A9A', font: { size: 11 } }
    },
    y: {
      grid: { color: '#E8E7E4', drawBorder: false },
      ticks: { color: '#8A8A9A', font: { size: 11 } },
      beginAtZero: true
    }
  }
};

/**
 * Destroy an existing chart instance if it exists
 * @param {string} canvasId
 */
function destroyChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const existing = Chart.getChart(canvas);
  if (existing) existing.destroy();
}

// ============================================================
// CONFIRMATION DIALOG
// ============================================================

let pendingDeleteCallback = null;

/**
 * Show delete confirmation dialog
 * @param {string} message
 * @param {Function} onConfirm
 */
function confirmDelete(message, onConfirm) {
  const msgEl = document.getElementById('confirm-message');
  if (msgEl) msgEl.textContent = message;
  pendingDeleteCallback = onConfirm;
  openModal('confirm-modal-overlay');
}

/**
 * Initialize delete confirmation button
 */
function initConfirmModal() {
  const confirmBtn = document.getElementById('confirm-delete-btn');
  if (!confirmBtn) return;

  confirmBtn.addEventListener('click', () => {
    if (typeof pendingDeleteCallback === 'function') {
      pendingDeleteCallback();
      pendingDeleteCallback = null;
    }
    closeModal('confirm-modal-overlay');
  });
}

// ============================================================
// GREETING UTILITIES
// ============================================================

/**
 * Get time-appropriate greeting
 * @returns {string}
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

/**
 * Format date for the topbar
 * @returns {string}
 */
function getTopbarDate() {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

// ============================================================
// STORAGE UTILITIES (for preferences / caching)
// ============================================================

/**
 * Save data to localStorage
 * @param {string} key
 * @param {any} data
 */
function saveLocal(key, data) {
  try {
    localStorage.setItem(`jslm_${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

/**
 * Load data from localStorage
 * @param {string} key
 * @param {any} defaultValue
 * @returns {any}
 */
function loadLocal(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(`jslm_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Remove item from localStorage
 * @param {string} key
 */
function removeLocal(key) {
  localStorage.removeItem(`jslm_${key}`);
}

// ============================================================
// COLOR UTILITIES
// ============================================================

/**
 * Hex to rgba converter
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
function hexToRgba(hex, alpha = 1) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Generate a readable text color (black or white) for a background
 * @param {string} hex
 * @returns {string}
 */
function getContrastColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1A1A2E' : '#FFFFFF';
}
