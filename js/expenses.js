/**
 * expenses.js
 * Expense tracking module — CRUD, filtering, and analytics.
 */

// Module state
const expensesState = {
  expenses: [],
  filtered: [],
  monthFilter: getCurrentMonth(),
  categoryFilter: '',
  sortFilter: 'date-desc',
  charts: {
    category: null,
    trend: null
  }
};

// Category configuration
const EXPENSE_CATEGORIES = {
  food: { label: 'Food', icon: 'restaurant-outline', color: '#F4A261' },
  transportation: { label: 'Transportation', icon: 'train-outline', color: '#457B9D' },
  rent: { label: 'Rent', icon: 'home-outline', color: '#2DC653' },
  shopping: { label: 'Shopping', icon: 'bag-outline', color: '#E63946' },
  entertainment: { label: 'Entertainment', icon: 'game-controller-outline', color: '#9333EA' },
  study: { label: 'Study', icon: 'school-outline', color: '#3B82F6' },
  bills: { label: 'Bills', icon: 'receipt-outline', color: '#6B7280' },
  other: { label: 'Other', icon: 'ellipsis-horizontal-outline', color: '#9CA3AF' }
};

// ============================================================
// INITIALIZATION
// ============================================================

async function initExpenses() {
  const monthInput = document.getElementById('expense-month-filter');
  if (monthInput) monthInput.value = getCurrentMonth();

  setupExpenseEventListeners();
  await loadExpenses();
}

function setupExpenseEventListeners() {
  document.getElementById('add-expense-btn')?.addEventListener('click', () => openExpenseModal());
  document.getElementById('add-expense-btn-empty')?.addEventListener('click', () => openExpenseModal());
  document.getElementById('expense-form')?.addEventListener('submit', handleExpenseSubmit);

  // Filters
  document.getElementById('expense-month-filter')?.addEventListener('change', (e) => {
    expensesState.monthFilter = e.target.value;
    applyExpenseFilters();
  });

  document.getElementById('expense-category-filter')?.addEventListener('change', (e) => {
    expensesState.categoryFilter = e.target.value;
    applyExpenseFilters();
  });

  document.getElementById('expense-sort-filter')?.addEventListener('change', (e) => {
    expensesState.sortFilter = e.target.value;
    applyExpenseFilters();
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadExpenses() {
  const container = document.getElementById('expenses-list');
  if (container) showLoading(container, 'Loading expenses...');

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('expenses')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('expense_date', { ascending: false });

    if (error) throw error;

    expensesState.expenses = data || [];
    applyExpenseFilters();
    renderExpenseCharts();
  } catch (err) {
    console.error('[Expenses] Load error:', err);
    showToast('Error', 'Failed to load expenses.', 'error');
  }
}

function applyExpenseFilters() {
  let filtered = [...expensesState.expenses];

  if (expensesState.monthFilter) {
    filtered = filtered.filter(e => e.expense_date?.startsWith(expensesState.monthFilter));
  }

  if (expensesState.categoryFilter) {
    filtered = filtered.filter(e => e.category === expensesState.categoryFilter);
  }

  // Sorting
  switch (expensesState.sortFilter) {
    case 'date-asc': filtered.sort((a, b) => a.expense_date.localeCompare(b.expense_date)); break;
    case 'amount-desc': filtered.sort((a, b) => b.amount - a.amount); break;
    case 'amount-asc': filtered.sort((a, b) => a.amount - b.amount); break;
    default: filtered.sort((a, b) => b.expense_date.localeCompare(a.expense_date));
  }

  expensesState.filtered = filtered;
  renderExpenseStats(filtered);
  renderExpenseList(filtered);
}

// ============================================================
// RENDERING
// ============================================================

function renderExpenseStats(filtered) {
  const total = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const food = filtered.filter(e => e.category === 'food').reduce((sum, e) => sum + Number(e.amount), 0);
  const transport = filtered.filter(e => e.category === 'transportation').reduce((sum, e) => sum + Number(e.amount), 0);
  const rent = filtered.filter(e => e.category === 'rent').reduce((sum, e) => sum + Number(e.amount), 0);

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('exp-total', formatYen(total));
  setEl('exp-food', formatYen(food));
  setEl('exp-transport', formatYen(transport));
  setEl('exp-rent', formatYen(rent));
}

function renderExpenseList(expenses) {
  const container = document.getElementById('expenses-list');
  if (!container) return;

  if (!expenses.length) {
    showEmptyState(
      container,
      'wallet-outline',
      'No Expenses Found',
      expensesState.monthFilter ? 'No expenses for this period.' : 'Start tracking your daily expenses.',
      `<button class="btn btn--primary" onclick="openExpenseModal()">
        <ion-icon name="add-outline"></ion-icon> Add Expense
      </button>`
    );
    return;
  }

  container.innerHTML = expenses.map(exp => renderExpenseItem(exp)).join('');
}

function renderExpenseItem(exp) {
  const cat = EXPENSE_CATEGORIES[exp.category] || EXPENSE_CATEGORIES.other;
  return `
    <div class="list-item">
      <div class="list-item-icon" style="background-color:${hexToRgba(cat.color, 0.12)};color:${cat.color};">
        <ion-icon name="${cat.icon}"></ion-icon>
      </div>
      <div class="list-item-info">
        <div class="list-item-title">${escapeHtml(exp.description)}</div>
        <div class="list-item-meta">
          <span><ion-icon name="calendar-outline"></ion-icon> ${formatDate(exp.expense_date)}</span>
          <span class="badge badge--${escapeHtml(exp.category)}">${cat.label}</span>
          ${exp.notes ? `<span><ion-icon name="chatbubble-outline"></ion-icon> ${escapeHtml(truncate(exp.notes, 40))}</span>` : ''}
        </div>
      </div>
      <div class="list-item-badge">
        <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);color:var(--color-expense);">
          ${formatYen(exp.amount)}
        </div>
      </div>
      <div class="list-item-actions">
        <button class="action-btn" onclick="openExpenseModal('${escapeHtml(exp.id)}')" aria-label="Edit expense" title="Edit">
          <ion-icon name="create-outline"></ion-icon>
        </button>
        <button class="action-btn action-btn--delete" onclick="deleteExpense('${escapeHtml(exp.id)}')" aria-label="Delete expense" title="Delete">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// CHARTS
// ============================================================

function renderExpenseCharts() {
  renderExpenseCategoryChart();
  renderExpenseTrendChart();
}

function renderExpenseCategoryChart() {
  destroyChart('expense-category-chart');
  const canvas = document.getElementById('expense-category-chart');
  if (!canvas) return;

  const monthStr = expensesState.monthFilter || getCurrentMonth();
  const monthExpenses = expensesState.expenses.filter(e => e.expense_date?.startsWith(monthStr));

  const totals = {};
  Object.keys(EXPENSE_CATEGORIES).forEach(k => totals[k] = 0);
  monthExpenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + Number(e.amount); });

  const labels = [];
  const data = [];
  const colors = [];

  Object.entries(totals).forEach(([key, val]) => {
    if (val > 0) {
      labels.push(EXPENSE_CATEGORIES[key].label);
      data.push(val);
      colors.push(EXPENSE_CATEGORIES[key].color);
    }
  });

  if (!data.length) {
    canvas.parentElement.innerHTML = '<div class="empty-state empty-state--small"><ion-icon name="pie-chart-outline"></ion-icon><p>No data yet</p></div>';
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
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${formatYen(ctx.raw)}`
          }
        }
      }
    }
  });
}

function renderExpenseTrendChart() {
  destroyChart('expense-trend-chart');
  const canvas = document.getElementById('expense-trend-chart');
  if (!canvas) return;

  const now = new Date();
  const months = [];
  const data = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const total = expensesState.expenses
      .filter(e => e.expense_date?.startsWith(monthStr))
      .reduce((sum, e) => sum + Number(e.amount), 0);
    months.push(APP_CONFIG.monthsShort[d.getMonth()]);
    data.push(total);
  }

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{
        label: 'Total Expenses',
        data,
        backgroundColor: hexToRgba('#E63946', 0.75),
        borderColor: '#E63946',
        borderWidth: 1.5,
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
          callbacks: { label: (ctx) => ` ${formatYen(ctx.raw)}` }
        }
      }
    }
  });
}

// ============================================================
// MODAL
// ============================================================

function openExpenseModal(expId = null) {
  const form = document.getElementById('expense-form');
  const title = document.getElementById('expense-modal-title');
  const idInput = document.getElementById('expense-id');

  form?.reset();
  if (idInput) idInput.value = '';
  if (title) title.textContent = expId ? 'Edit Expense' : 'Add Expense';

  const dateEl = document.getElementById('expense-date');
  if (dateEl) dateEl.value = getTodayString();

  if (expId) {
    const exp = expensesState.expenses.find(e => e.id === expId);
    if (exp) {
      if (idInput) idInput.value = exp.id;
      setFormValue('expense-desc', exp.description);
      setFormValue('expense-amount', exp.amount);
      setFormValue('expense-category', exp.category);
      setFormValue('expense-date', exp.expense_date);
      setFormValue('expense-notes', exp.notes);
    }
  }

  openModal('expense-modal-overlay');
}

async function handleExpenseSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('expense-id')?.value;
  const description = document.getElementById('expense-desc')?.value.trim();
  const amount = parseFloat(document.getElementById('expense-amount')?.value);
  const category = document.getElementById('expense-category')?.value;
  const expenseDate = document.getElementById('expense-date')?.value;
  const notes = document.getElementById('expense-notes')?.value.trim();

  if (!description || !amount || !category || !expenseDate) {
    showToast('Missing Fields', 'Please fill in all required fields.', 'warning');
    return;
  }

  if (amount <= 0) {
    showToast('Invalid Amount', 'Amount must be greater than 0.', 'warning');
    return;
  }

  const submitBtn = document.getElementById('expense-submit-btn');
  submitBtn.disabled = true;

  try {
    const sb = getSupabase();
    const payload = {
      user_id: window.currentUser.id,
      description,
      amount,
      category,
      expense_date: expenseDate,
      notes: notes || null
    };

    let error;

    if (id) {
      ({ error } = await sb.from('expenses').update(payload).eq('id', id).eq('user_id', window.currentUser.id));
    } else {
      ({ error } = await sb.from('expenses').insert(payload));
    }

    if (error) throw error;

    closeModal('expense-modal-overlay');
    await loadExpenses();
    showToast(id ? 'Expense Updated' : 'Expense Added', `${formatYen(amount)} — ${description}`, 'success');

  } catch (err) {
    console.error('[Expenses] Save error:', err);
    showToast('Save Failed', 'Could not save expense. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

// ============================================================
// DELETE
// ============================================================

function deleteExpense(expId) {
  const exp = expensesState.expenses.find(e => e.id === expId);
  const name = exp?.description || 'this expense';

  confirmDelete(`Delete "${name}"? This action cannot be undone.`, async () => {
    try {
      const sb = getSupabase();
      const { error } = await sb.from('expenses').delete().eq('id', expId).eq('user_id', window.currentUser.id);
      if (error) throw error;
      await loadExpenses();
      showToast('Expense Deleted', 'The expense has been removed.', 'success');
    } catch (err) {
      console.error('[Expenses] Delete error:', err);
      showToast('Delete Failed', 'Could not delete expense. Please try again.', 'error');
    }
  });
}

// ============================================================
// ANALYTICS HELPERS (for dashboard)
// ============================================================

function getMonthlyExpenses() {
  const monthStr = getCurrentMonth();
  return expensesState.expenses
    .filter(e => e.expense_date?.startsWith(monthStr))
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

function getMonthlyExpenseHistory(months = 6) {
  const result = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const total = expensesState.expenses
      .filter(e => e.expense_date?.startsWith(monthStr))
      .reduce((sum, e) => sum + Number(e.amount), 0);
    result.push({
      month: APP_CONFIG.monthsShort[d.getMonth()],
      expenses: total
    });
  }

  return result;
}
