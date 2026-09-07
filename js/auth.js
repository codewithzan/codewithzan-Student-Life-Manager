/**
 * auth.js
 * Handles all Supabase authentication operations:
 * Login, Signup, Logout, Session management, and redirects.
 */

// ============================================================
// AUTH STATE MANAGER
// ============================================================

/**
 * Main auth initialization — runs on every page
 * Determines which page we're on and handles auth accordingly
 */
async function initAuth() {
  try {
    const sb = await initSupabase();

    // Listen for auth state changes globally
    sb.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Event:', event, '| Session:', session?.user?.email ?? 'none');

      const onDashboard = window.location.pathname.includes('dashboard');
      const onIndex = !onDashboard;

      if (event === 'SIGNED_IN' && onIndex) {
        // Redirect to dashboard
        window.location.href = 'dashboard.html';
      } else if ((event === 'SIGNED_OUT' || !session) && onDashboard) {
        // Redirect to login
        window.location.href = 'index.html';
      }
    });

    // Check current session
    const { data: { session } } = await sb.auth.getSession();

    const onDashboard = window.location.pathname.includes('dashboard');
    const onIndex = !onDashboard;

    if (session && onIndex) {
      window.location.href = 'dashboard.html';
      return;
    }

    if (!session && onDashboard) {
      window.location.href = 'index.html';
      return;
    }

    // Initialize page-specific auth features
    if (onIndex) {
      initAuthPage();
    } else if (onDashboard) {
      await initDashboardAuth(session);
    }

  } catch (error) {
    console.error('[Auth] Initialization error:', error);
    showAuthError('Failed to initialize. Please refresh the page.');
  }
}

// ============================================================
// AUTH PAGE (index.html)
// ============================================================

/**
 * Initialize the authentication page (login/signup forms)
 */
function initAuthPage() {
  // Tab switching
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  if (loginTab && signupTab) {
    loginTab.addEventListener('click', () => switchTab('login'));
    signupTab.addEventListener('click', () => switchTab('signup'));
  }

  // Login form
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Signup form
  if (signupForm) {
    signupForm.addEventListener('submit', handleSignup);
  }

  // Google OAuth
  const googleBtn = document.getElementById('google-login-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', handleGoogleLogin);
  }

  // Password visibility toggles
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      const icon = btn.querySelector('ion-icon');
      if (icon) icon.setAttribute('name', isPassword ? 'eye-off-outline' : 'eye-outline');
    });
  });

  // Password strength meter
  const signupPassword = document.getElementById('signup-password');
  if (signupPassword) {
    signupPassword.addEventListener('input', () => {
      updatePasswordStrength(signupPassword.value);
    });
  }

  // Forgot password
  const forgotBtn = document.getElementById('forgot-password-btn');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', handleForgotPassword);
  }

  // Set default date values
  const today = getTodayString();
  console.log('[Auth] Auth page initialized. Today:', today);
}

/**
 * Switch between login and signup tabs
 * @param {'login'|'signup'} tab
 */
function switchTab(tab) {
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const notification = document.getElementById('auth-notification');

  if (tab === 'login') {
    loginTab?.classList.add('auth-tab--active');
    signupTab?.classList.remove('auth-tab--active');
    loginForm?.classList.remove('hidden');
    signupForm?.classList.add('hidden');
  } else {
    signupTab?.classList.add('auth-tab--active');
    loginTab?.classList.remove('auth-tab--active');
    signupForm?.classList.remove('hidden');
    loginForm?.classList.add('hidden');
  }

  // Clear notifications on tab switch
  if (notification) {
    notification.className = 'auth-notification hidden';
    notification.textContent = '';
  }
}

// ============================================================
// LOGIN HANDLER
// ============================================================

/**
 * Handle login form submission
 * @param {Event} e
 */
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const btn = document.getElementById('login-btn');

  // Clear previous errors
  clearAuthNotification();

  // Validate
  if (!email || !password) {
    showAuthError('Please enter your email and password.');
    return;
  }

  if (!isValidEmail(email)) {
    showAuthError('Please enter a valid email address.');
    return;
  }

  setButtonLoading(btn, true);

  try {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      let msg = 'Login failed. Please check your credentials.';
      if (error.message.includes('Invalid login')) msg = 'Invalid email or password.';
      if (error.message.includes('Email not confirmed')) msg = 'Please confirm your email before logging in.';
      showAuthError(msg);
      return;
    }

    if (data.session) {
      showAuthSuccess('Login successful! Redirecting...');
      // Redirect handled by onAuthStateChange
    }
  } catch (err) {
    console.error('[Auth] Login error:', err);
    showAuthError('An unexpected error occurred. Please try again.');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ============================================================
// SIGNUP HANDLER
// ============================================================

/**
 * Handle signup form submission
 * @param {Event} e
 */
async function handleSignup(e) {
  e.preventDefault();
  clearAuthNotification();

  const firstName = document.getElementById('signup-firstname')?.value.trim();
  const lastName = document.getElementById('signup-lastname')?.value.trim();
  const email = document.getElementById('signup-email')?.value.trim();
  const university = document.getElementById('signup-university')?.value.trim();
  const password = document.getElementById('signup-password')?.value;
  const confirmPassword = document.getElementById('signup-confirm-password')?.value;
  const termsAgreed = document.getElementById('terms-agree')?.checked;
  const btn = document.getElementById('signup-btn');

  // Validation
  let hasErrors = false;

  if (!firstName) {
    const err = document.getElementById('signup-firstname-error');
    if (err) err.textContent = 'First name is required.';
    hasErrors = true;
  }

  if (!email || !isValidEmail(email)) {
    const err = document.getElementById('signup-email-error');
    if (err) err.textContent = !email ? 'Email is required.' : 'Invalid email format.';
    hasErrors = true;
  }

  if (!password || password.length < 8) {
    const err = document.getElementById('signup-password-error');
    if (err) err.textContent = 'Password must be at least 8 characters.';
    hasErrors = true;
  }

  if (password !== confirmPassword) {
    const err = document.getElementById('signup-confirm-error');
    if (err) err.textContent = 'Passwords do not match.';
    hasErrors = true;
  }

  if (!termsAgreed) {
    const err = document.getElementById('terms-error');
    if (err) err.textContent = 'You must agree to the terms.';
    hasErrors = true;
  }

  if (hasErrors) return;

  setButtonLoading(btn, true);

  try {
    const sb = getSupabase();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName || '',
          university: university || ''
        }
      }
    });

    if (error) {
      let msg = 'Sign up failed. Please try again.';
      if (error.message.includes('already registered')) msg = 'This email is already registered. Try logging in.';
      if (error.message.includes('password')) msg = 'Password must be at least 8 characters.';
      showAuthError(msg);
      return;
    }

    if (data.user && !data.session) {
      // Email confirmation required
      showAuthSuccess('Account created! Please check your email to confirm your account.');
    } else if (data.session) {
      // Auto-confirmed
      showAuthSuccess('Account created successfully! Redirecting...');
    }

  } catch (err) {
    console.error('[Auth] Signup error:', err);
    showAuthError('An unexpected error occurred. Please try again.');
  } finally {
    setButtonLoading(btn, false);
  }
}

// ============================================================
// GOOGLE OAUTH
// ============================================================

/**
 * Handle Google OAuth login
 */
async function handleGoogleLogin() {
  try {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard.html`
      }
    });

    if (error) {
      showAuthError('Google login failed. Please try again.');
    }
  } catch (err) {
    console.error('[Auth] Google login error:', err);
    showAuthError('Google login is not available right now.');
  }
}

// ============================================================
// FORGOT PASSWORD
// ============================================================

/**
 * Handle forgot password
 */
async function handleForgotPassword() {
  const email = document.getElementById('login-email')?.value.trim();

  if (!email || !isValidEmail(email)) {
    showAuthError('Please enter your email address first, then click "Forgot password?"');
    return;
  }

  try {
    const sb = getSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard.html`
    });

    if (error) {
      showAuthError('Failed to send reset email. Please try again.');
      return;
    }

    showAuthSuccess(`Password reset email sent to ${email}. Check your inbox!`);
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    showAuthError('Failed to send reset email. Please try again.');
  }
}

// ============================================================
// DASHBOARD AUTH
// ============================================================

/**
 * Initialize auth for dashboard page
 * @param {Object} session
 */
async function initDashboardAuth(session) {
  if (!session) return;

  const user = session.user;

  // Load user profile
  let profile = null;
  try {
    const sb = getSupabase();
    const { data } = await sb.from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data;
  } catch (err) {
    console.warn('[Auth] Could not load profile:', err);
  }

  // Merge user metadata and profile
  const firstName = profile?.first_name || user.user_metadata?.first_name || '';
  const lastName = profile?.last_name || user.user_metadata?.last_name || '';
  const university = profile?.university || user.user_metadata?.university || 'Student';
  const initials = getInitials(firstName, lastName) || user.email?.charAt(0).toUpperCase() || '?';

  // Store current user globally for other modules
  window.currentUser = {
    id: user.id,
    email: user.email,
    firstName,
    lastName,
    university,
    initials,
    profile,
    createdAt: user.created_at
  };

  // Update UI elements
  updateUserUI(firstName, lastName, initials, university);

  // Settings page values
  const emailEl = document.getElementById('settings-email');
  const joinedEl = document.getElementById('settings-joined');
  if (emailEl) emailEl.value = user.email || '';
  if (joinedEl) joinedEl.value = formatDate(user.created_at);

  // Pre-fill profile form
  const pfFirst = document.getElementById('profile-firstname');
  const pfLast = document.getElementById('profile-lastname');
  const pfUni = document.getElementById('profile-university');
  const pfCountry = document.getElementById('profile-country');
  const pfMajor = document.getElementById('profile-major');
  if (pfFirst) pfFirst.value = firstName;
  if (pfLast) pfLast.value = lastName;
  if (pfUni) pfUni.value = university !== 'Student' ? university : '';
  if (pfCountry) pfCountry.value = profile?.country || '';
  if (pfMajor) pfMajor.value = profile?.major || '';

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Profile form
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', handleProfileUpdate);
  }

  // Preferences form
  const prefsForm = document.getElementById('preferences-form');
  if (prefsForm) {
    prefsForm.addEventListener('submit', handlePreferencesUpdate);
    // Load saved preferences
    if (profile?.preferences) {
      const prefs = profile.preferences;
      const currencyEl = document.getElementById('pref-currency');
      const dateEl = document.getElementById('pref-dateformat');
      const weekEl = document.getElementById('pref-weekstart');
      const reminderEl = document.getElementById('pref-reminder');
      if (currencyEl) currencyEl.value = prefs.currency || 'JPY';
      if (dateEl) dateEl.value = prefs.dateFormat || 'JP';
      if (weekEl) weekEl.value = prefs.weekStart || 'monday';
      if (reminderEl) reminderEl.checked = prefs.studyReminder || false;
    }
  }

  console.log('[Auth] Dashboard initialized for:', user.email);
}

/**
 * Update sidebar and topbar user interface elements
 */
function updateUserUI(firstName, lastName, initials, university) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Student';

  const sidebarUsername = document.getElementById('sidebar-username');
  const sidebarUniversity = document.getElementById('sidebar-university');
  const avatarInitials = document.getElementById('avatar-initials');
  const topbarInitials = document.getElementById('topbar-initials');
  const dashGreetingName = document.getElementById('dash-greeting-name');

  if (sidebarUsername) sidebarUsername.textContent = fullName;
  if (sidebarUniversity) sidebarUniversity.textContent = university || 'Student';
  if (avatarInitials) avatarInitials.textContent = initials;
  if (topbarInitials) topbarInitials.textContent = initials;
  if (dashGreetingName) dashGreetingName.textContent = firstName || 'Student';
}

// ============================================================
// LOGOUT
// ============================================================

/**
 * Handle user logout
 */
async function handleLogout() {
  try {
    const sb = getSupabase();
    await sb.auth.signOut();
    // onAuthStateChange will handle redirect
  } catch (err) {
    console.error('[Auth] Logout error:', err);
    window.location.href = 'index.html';
  }
}

// ============================================================
// PROFILE UPDATE
// ============================================================

/**
 * Handle profile form submission
 * @param {Event} e
 */
async function handleProfileUpdate(e) {
  e.preventDefault();

  const firstName = document.getElementById('profile-firstname')?.value.trim();
  const lastName = document.getElementById('profile-lastname')?.value.trim();
  const university = document.getElementById('profile-university')?.value.trim();
  const country = document.getElementById('profile-country')?.value.trim();
  const major = document.getElementById('profile-major')?.value.trim();

  try {
    const sb = getSupabase();
    const user = window.currentUser;

    const { error } = await sb.from('profiles').upsert({
      id: user.id,
      first_name: firstName,
      last_name: lastName,
      university,
      country,
      major,
      updated_at: new Date().toISOString()
    });

    if (error) throw error;

    // Update global user state
    window.currentUser.firstName = firstName;
    window.currentUser.lastName = lastName;
    window.currentUser.university = university;
    const initials = getInitials(firstName, lastName);
    updateUserUI(firstName, lastName, initials, university);

    showToast('Profile Updated', 'Your profile has been saved successfully.', 'success');
  } catch (err) {
    console.error('[Auth] Profile update error:', err);
    showToast('Update Failed', 'Could not save profile. Please try again.', 'error');
  }
}

/**
 * Handle preferences form submission
 * @param {Event} e
 */
async function handlePreferencesUpdate(e) {
  e.preventDefault();

  const currency = document.getElementById('pref-currency')?.value;
  const dateFormat = document.getElementById('pref-dateformat')?.value;
  const weekStart = document.getElementById('pref-weekstart')?.value;
  const studyReminder = document.getElementById('pref-reminder')?.checked;

  try {
    const sb = getSupabase();
    const user = window.currentUser;

    const preferences = { currency, dateFormat, weekStart, studyReminder };

    const { error } = await sb.from('profiles').upsert({
      id: user.id,
      preferences,
      updated_at: new Date().toISOString()
    });

    if (error) throw error;

    showToast('Preferences Saved', 'Your preferences have been updated.', 'success');
  } catch (err) {
    console.error('[Auth] Preferences update error:', err);
    showToast('Update Failed', 'Could not save preferences. Please try again.', 'error');
  }
}

// ============================================================
// AUTH NOTIFICATION HELPERS
// ============================================================

function showAuthError(message) {
  const el = document.getElementById('auth-notification');
  if (!el) return;
  el.className = 'auth-notification auth-notification--error';
  el.innerHTML = `<ion-icon name="alert-circle-outline"></ion-icon> ${escapeHtml(message)}`;
}

function showAuthSuccess(message) {
  const el = document.getElementById('auth-notification');
  if (!el) return;
  el.className = 'auth-notification auth-notification--success';
  el.innerHTML = `<ion-icon name="checkmark-circle-outline"></ion-icon> ${escapeHtml(message)}`;
}

function clearAuthNotification() {
  const el = document.getElementById('auth-notification');
  if (!el) return;
  el.className = 'auth-notification hidden';
  el.textContent = '';
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Check if email format is valid
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================================
// GET CURRENT USER
// ============================================================

/**
 * Get current authenticated user from Supabase
 * @returns {Promise<Object|null>}
 */
async function getCurrentUser() {
  try {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    return user;
  } catch (err) {
    console.error('[Auth] Get user error:', err);
    return null;
  }
}

// ============================================================
// AUTO-INITIALIZE
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
});
