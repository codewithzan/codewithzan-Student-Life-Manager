/**
 * config.js
 * Supabase configuration and client initialization.
 * Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project credentials.
 */

// ============================================================
// SUPABASE CONFIGURATION
// ============================================================
// Get these from: https://app.supabase.com → Your Project → Settings → API
const SUPABASE_URL = 'https://hmaljmwjfvzdjvqyernq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYWxqbXdqZnZ6ZGp2cXllcm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjEyMjEsImV4cCI6MjEwNDMzNzIyMX0.XsMuvqJBURG9UYoiOmhy8Zl7-jTJoEhgK1hzDN5B3NA';

// ============================================================
// DATABASE SCHEMA (SQL to run in Supabase SQL Editor)
// ============================================================
/*

-- ============================================================
-- JAPANESE STUDENT LIFE MANAGER — DATABASE SCHEMA
-- Run this SQL in your Supabase project's SQL Editor
-- ============================================================

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- Extends auth.users with student-specific information
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  university TEXT,
  country TEXT,
  major TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{
    "currency": "JPY",
    "dateFormat": "JP",
    "weekStart": "monday",
    "studyReminder": false
  }',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCHEDULES TABLE (Class Schedule)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  teacher TEXT,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  classroom TEXT,
  color TEXT DEFAULT '#E63946',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON public.schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_day ON public.schedules(user_id, day_of_week);

-- ============================================================
-- SHIFTS TABLE (Part-Time Job Shifts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workplace TEXT NOT NULL,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  hourly_wage NUMERIC(10, 2) NOT NULL,
  worked_hours NUMERIC(10, 2),
  total_pay NUMERIC(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON public.shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON public.shifts(user_id, shift_date);

-- ============================================================
-- EXPENSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('food','transportation','rent','shopping','entertainment','study','bills','other')),
  expense_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(user_id, category);

-- ============================================================
-- STUDY SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('vocabulary','kanji','grammar','listening','reading','speaking')),
  duration_minutes INTEGER NOT NULL,
  session_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_user_id ON public.study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_date ON public.study_sessions(user_id, session_date);

-- ============================================================
-- JLPT GOALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.jlpt_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_level TEXT CHECK (target_level IN ('N1','N2','N3','N4','N5')),
  exam_date DATE,
  vocab_progress INTEGER DEFAULT 0 CHECK (vocab_progress BETWEEN 0 AND 100),
  kanji_progress INTEGER DEFAULT 0 CHECK (kanji_progress BETWEEN 0 AND 100),
  grammar_progress INTEGER DEFAULT 0 CHECK (grammar_progress BETWEEN 0 AND 100),
  listening_progress INTEGER DEFAULT 0 CHECK (listening_progress BETWEEN 0 AND 100),
  reading_progress INTEGER DEFAULT 0 CHECK (reading_progress BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_jlpt_user_id ON public.jlpt_goals(user_id);

-- ============================================================
-- TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  category TEXT DEFAULT 'other' CHECK (category IN ('school','work','study','personal','other')),
  due_date DATE,
  due_time TIME,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON public.tasks(user_id, completed);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_study_updated_at BEFORE UPDATE ON public.study_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_jlpt_updated_at BEFORE UPDATE ON public.jlpt_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jlpt_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- SCHEDULES policies
CREATE POLICY "Users can view own schedules" ON public.schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own schedules" ON public.schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own schedules" ON public.schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own schedules" ON public.schedules FOR DELETE USING (auth.uid() = user_id);

-- SHIFTS policies
CREATE POLICY "Users can view own shifts" ON public.shifts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own shifts" ON public.shifts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own shifts" ON public.shifts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own shifts" ON public.shifts FOR DELETE USING (auth.uid() = user_id);

-- EXPENSES policies
CREATE POLICY "Users can view own expenses" ON public.expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON public.expenses FOR DELETE USING (auth.uid() = user_id);

-- STUDY SESSIONS policies
CREATE POLICY "Users can view own study sessions" ON public.study_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study sessions" ON public.study_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study sessions" ON public.study_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own study sessions" ON public.study_sessions FOR DELETE USING (auth.uid() = user_id);

-- JLPT GOALS policies
CREATE POLICY "Users can view own jlpt goals" ON public.jlpt_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jlpt goals" ON public.jlpt_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jlpt goals" ON public.jlpt_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own jlpt goals" ON public.jlpt_goals FOR DELETE USING (auth.uid() = user_id);

-- TASKS policies
CREATE POLICY "Users can view own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP (Edge Function alternative)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

*/

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
