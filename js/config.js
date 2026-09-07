// ============================================================
// SUPABASE CONFIGURATION
// ============================================================
// Get these from: https://app.supabase.com → Your Project → Settings → API
const SUPABASE_URL = 'https://hmaljmwjfvzdjvqyernq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYWxqbXdqZnZ6ZGp2cXllcm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjEyMjEsImV4cCI6MjEwNDMzNzIyMX0.XsMuvqJBURG9UYoiOmhy8Zl7-jTJoEhgK1hzDN5B3NA';


// ============================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================
// Import Supabase via CDN (loaded dynamically)
let supabaseClient = null;

/**
 * Initialize Supabase client
 * Loads the Supabase library from CDN if not already loaded
 */
async function initSupabase() {
  if (supabaseClient) return supabaseClient;

  // Load Supabase SDK dynamically
  if (!window.supabase) {
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
  }

  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  return supabaseClient;
}

/**
 * Dynamically load a script tag
 * @param {string} src - Script URL
 * @returns {Promise}
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Get the initialized Supabase client
 * @returns {Object} Supabase client instance
 */
function getSupabase() {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized. Call initSupabase() first.');
  }
  return supabaseClient;
}

// ============================================================
// APP CONSTANTS
// ============================================================
const APP_CONFIG = {
  name: 'Japanese Student Life Manager',
  version: '1.0.0',
  defaultCurrency: 'JPY',
  currencySymbol: '¥',
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  daysShort: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  months: ['January', 'February', 'March', 'April', 'May', 'June',
           'July', 'August', 'September', 'October', 'November', 'December'],
  monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  studyCategories: ['vocabulary', 'kanji', 'grammar', 'listening', 'reading', 'speaking'],
  expenseCategories: ['food', 'transportation', 'rent', 'shopping', 'entertainment', 'study', 'bills', 'other'],
  jlptLevels: ['N5', 'N4', 'N3', 'N2', 'N1'],
  taskPriorities: ['high', 'medium', 'low'],
  taskCategories: ['school', 'work', 'study', 'personal', 'other']
};
