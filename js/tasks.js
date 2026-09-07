/**
 * tasks.js
 * Task management module — CRUD, filtering, priority, due dates.
 */

// Module state
const tasksState = {
  tasks: [],
  filtered: [],
  activeFilter: 'all',
  priorityFilter: '',
  categoryFilter: ''
};

// ============================================================
// INITIALIZATION
// ============================================================

async function initTasks() {
  setupTaskEventListeners();
  await loadTasks();
}

function setupTaskEventListeners() {
  document.getElementById('add-task-btn')?.addEventListener('click', () => openTaskModal());
  document.getElementById('add-task-btn-empty')?.addEventListener('click', () => openTaskModal());
  document.getElementById('task-form')?.addEventListener('submit', handleTaskSubmit);

  // Filter tabs
  document.querySelectorAll('.task-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.task-filter-btn').forEach(b => b.classList.remove('task-filter-btn--active'));
      btn.classList.add('task-filter-btn--active');
      tasksState.activeFilter = btn.dataset.filter;
      applyTaskFilters();
    });
  });

  // Priority and category filters
  document.getElementById('task-priority-filter')?.addEventListener('change', (e) => {
    tasksState.priorityFilter = e.target.value;
    applyTaskFilters();
  });

  document.getElementById('task-category-filter')?.addEventListener('change', (e) => {
    tasksState.categoryFilter = e.target.value;
    applyTaskFilters();
  });
}

// ============================================================
// DATA LOADING
// ============================================================

async function loadTasks() {
  const container = document.getElementById('tasks-board');
  if (container) showLoading(container, 'Loading tasks...');

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('tasks')
      .select('*')
      .eq('user_id', window.currentUser.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    tasksState.tasks = data || [];
    applyTaskFilters();
    updateTaskBadge();
  } catch (err) {
    console.error('[Tasks] Load error:', err);
    showToast('Error', 'Failed to load tasks.', 'error');
  }
}

function applyTaskFilters() {
  const today = getTodayString();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let filtered = [...tasksState.tasks];

  // Tab filter
  switch (tasksState.activeFilter) {
    case 'today':
      filtered = filtered.filter(t => !t.completed && t.due_date === today);
      break;
    case 'upcoming':
      filtered = filtered.filter(t => {
        if (t.completed) return false;
        if (!t.due_date) return true;
        const due = new Date(t.due_date + 'T00:00:00');
        return due > now;
      });
      break;
    case 'completed':
      filtered = filtered.filter(t => t.completed);
      break;
    default:
      // All — show pending first, then completed
      break;
  }

  // Priority filter
  if (tasksState.priorityFilter) {
    filtered = filtered.filter(t => t.priority === tasksState.priorityFilter);
  }

  // Category filter
  if (tasksState.categoryFilter) {
    filtered = filtered.filter(t => t.category === tasksState.categoryFilter);
  }

  // Sort: incomplete first, then by priority, then by due date
  filtered.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
    }
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  tasksState.filtered = filtered;
  renderTasksList(filtered);
}

// ============================================================
// UPDATE BADGE
// ============================================================

function updateTaskBadge() {
  const pendingCount = tasksState.tasks.filter(t => !t.completed).length;
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = pendingCount > 9 ? '9+' : pendingCount;
    badge.style.display = pendingCount > 0 ? 'flex' : 'none';
  }
}

// ============================================================
// RENDERING
// ============================================================

function renderTasksList(tasks) {
  const container = document.getElementById('tasks-board');
  if (!container) return;

  if (!tasks.length) {
    const messages = {
      all: 'Add your first task to stay organized.',
      today: 'No tasks due today.',
      upcoming: 'No upcoming tasks.',
      completed: 'No completed tasks yet.'
    };

    showEmptyState(
      container,
      'checkmark-done-circle-outline',
      tasksState.activeFilter === 'completed' ? 'No Completed Tasks' : 'No Tasks Found',
      messages[tasksState.activeFilter] || 'No tasks found.',
      tasksState.activeFilter !== 'completed'
        ? `<button class="btn btn--primary" onclick="openTaskModal()">
            <ion-icon name="add-outline"></ion-icon> Add Task
           </button>`
        : ''
    );
    return;
  }

  container.innerHTML = tasks.map(task => renderTaskItem(task)).join('');
}

function renderTaskItem(task) {
  const today = getTodayString();
  const isOverdue = !task.completed && task.due_date && task.due_date < today;

  let dueDisplay = '';
  if (task.due_date) {
    const dueDate = formatDate(task.due_date, { month: 'short', day: 'numeric' });
    const dueTime = task.due_time ? ` at ${formatTime12(task.due_time)}` : '';
    dueDisplay = `
      <span class="task-due ${isOverdue ? 'task-due--overdue' : ''}">
        <ion-icon name="calendar-outline"></ion-icon>
        ${isOverdue ? 'Overdue — ' : ''}${dueDate}${dueTime}
      </span>
    `;
  }

  return `
    <div class="task-item task-item--${escapeHtml(task.priority)} ${task.completed ? 'task-item--completed' : ''}"
         data-id="${escapeHtml(task.id)}">
      <button
        class="task-checkbox ${task.completed ? 'task-checkbox--checked' : ''}"
        onclick="toggleTaskComplete('${escapeHtml(task.id)}', ${!task.completed})"
        aria-label="${task.completed ? 'Mark incomplete' : 'Mark complete'}"
        title="${task.completed ? 'Mark incomplete' : 'Mark complete'}">
        ${task.completed ? '<ion-icon name="checkmark-outline"></ion-icon>' : ''}
      </button>
      <div class="task-content">
        <div class="task-title">${escapeHtml(task.title)}</div>
        ${task.description ? `<div class="task-desc">${escapeHtml(truncate(task.description, 100))}</div>` : ''}
        <div class="task-meta">
          <span class="badge badge--${escapeHtml(task.priority)}">${capitalize(task.priority)}</span>
          <span class="badge badge--${escapeHtml(task.category || 'other')}">${capitalize(task.category || 'other')}</span>
          ${dueDisplay}
        </div>
      </div>
      <div class="list-item-actions">
        <button class="action-btn" onclick="openTaskModal('${escapeHtml(task.id)}')" aria-label="Edit task" title="Edit">
          <ion-icon name="create-outline"></ion-icon>
        </button>
        <button class="action-btn action-btn--delete" onclick="deleteTask('${escapeHtml(task.id)}')" aria-label="Delete task" title="Delete">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      </div>
    </div>
  `;
}

// ============================================================
// MODAL
// ============================================================

function openTaskModal(taskId = null) {
  const form = document.getElementById('task-form');
  const title = document.getElementById('task-modal-title');
  const idInput = document.getElementById('task-id');

  form?.reset();
  if (idInput) idInput.value = '';
  if (title) title.textContent = taskId ? 'Edit Task' : 'Add Task';

  if (taskId) {
    const task = tasksState.tasks.find(t => t.id === taskId);
    if (task) {
      if (idInput) idInput.value = task.id;
      setFormValue('task-title', task.title);
      setFormValue('task-desc', task.description);
      setFormValue('task-priority', task.priority);
      setFormValue('task-category', task.category);
      setFormValue('task-due', task.due_date);
      setFormValue('task-due-time', task.due_time);
    }
  }

  openModal('task-modal-overlay');
}

async function handleTaskSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('task-id')?.value;
  const title = document.getElementById('task-title')?.value.trim();
  const description = document.getElementById('task-desc')?.value.trim();
  const priority = document.getElementById('task-priority')?.value;
  const category = document.getElementById('task-category')?.value;
  const dueDate = document.getElementById('task-due')?.value;
  const dueTime = document.getElementById('task-due-time')?.value;

  if (!title || !priority) {
    showToast('Missing Fields', 'Please fill in the title and priority.', 'warning');
    return;
  }

  const submitBtn = document.getElementById('task-submit-btn');
  submitBtn.disabled = true;

  try {
    const sb = getSupabase();
    const payload = {
      user_id: window.currentUser.id,
      title,
      description: description || null,
      priority,
      category: category || 'other',
      due_date: dueDate || null,
      due_time: dueTime || null
    };

    let error;

    if (id) {
      ({ error } = await sb.from('tasks').update(payload).eq('id', id).eq('user_id', window.currentUser.id));
    } else {
      ({ error } = await sb.from('tasks').insert(payload));
    }

    if (error) throw error;

    closeModal('task-modal-overlay');
    await loadTasks();
    showToast(id ? 'Task Updated' : 'Task Added', `"${title}" has been ${id ? 'updated' : 'added'}.`, 'success');

  } catch (err) {
    console.error('[Tasks] Save error:', err);
    showToast('Save Failed', 'Could not save task. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

// ============================================================
// COMPLETE / UNCOMPLETE
// ============================================================

/**
 * Toggle task completion status
 * @param {string} taskId
 * @param {boolean} completed
 */
async function toggleTaskComplete(taskId, completed) {
  try {
    const sb = getSupabase();
    const { error } = await sb.from('tasks')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null
      })
      .eq('id', taskId)
      .eq('user_id', window.currentUser.id);

    if (error) throw error;

    // Optimistically update local state
    const task = tasksState.tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = completed;
      task.completed_at = completed ? new Date().toISOString() : null;
    }

    applyTaskFilters();
    updateTaskBadge();

    if (completed) {
      showToast('Task Complete! ✅', 'Great job! Keep it up! 頑張って！', 'success');
    }
  } catch (err) {
    console.error('[Tasks] Toggle error:', err);
    showToast('Error', 'Could not update task status.', 'error');
  }
}

// ============================================================
// DELETE
// ============================================================

function deleteTask(taskId) {
  const task = tasksState.tasks.find(t => t.id === taskId);
  const name = task?.title || 'this task';

  confirmDelete(`Delete "${name}"? This action cannot be undone.`, async () => {
    try {
      const sb = getSupabase();
      const { error } = await sb.from('tasks').delete().eq('id', taskId).eq('user_id', window.currentUser.id);
      if (error) throw error;
      await loadTasks();
      showToast('Task Deleted', 'The task has been removed.', 'success');
    } catch (err) {
      console.error('[Tasks] Delete error:', err);
      showToast('Delete Failed', 'Could not delete task. Please try again.', 'error');
    }
  });
}

// ============================================================
// ANALYTICS HELPERS (for dashboard/calendar)
// ============================================================

/**
 * Get pending tasks (for dashboard widget)
 * @param {number} limit
 * @returns {Array}
 */
function getPendingTasks(limit = 5) {
  const today = getTodayString();
  return tasksState.tasks
    .filter(t => !t.completed)
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
      }
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    })
    .slice(0, limit);
}

/**
 * Get tasks for a specific date (for calendar)
 * @param {string} dateStr
 * @returns {Array}
 */
function getTasksForDate(dateStr) {
  return tasksState.tasks.filter(t => t.due_date === dateStr);
}
