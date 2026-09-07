# Japanese Student Life Manager 🇯🇵

An all-in-one productivity dashboard for international students living and studying in Japan.

## Setup Instructions

### 1. Create a Supabase Project
1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Create a new project
3. Note your **Project URL** and **anon public key** from Settings → API

### 2. Configure the Application
Open `js/config.js` and replace:
```js
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

### 3. Set Up the Database
1. In Supabase, go to **SQL Editor**
2. Copy the entire SQL block from the comment in `js/config.js`
3. Run it to create all tables, indexes, RLS policies, and triggers

### 4. Enable Authentication (Optional: Google)
1. In Supabase, go to **Authentication → Providers**
2. Enable Email/Password (enabled by default)
3. Optionally enable Google OAuth

### 5. Deploy
Simply serve the files from any static web server:
- **Local**: Use VS Code Live Server, Python's `http.server`, or any static server
- **Production**: Deploy to Netlify, Vercel, GitHub Pages, or any static host

## Project Structure
```
project/
├── index.html          # Login/Signup page
├── dashboard.html      # Main dashboard (protected)
├── css/
│   ├── style.css       # Global styles + auth page
│   ├── dashboard.css   # Dashboard components
│   └── responsive.css  # Responsive + dark mode
├── js/
│   ├── config.js       # Supabase config + SQL schema
│   ├── utils.js        # Shared utilities
│   ├── auth.js         # Authentication module
│   ├── schedule.js     # School schedule CRUD
│   ├── shifts.js       # Part-time job tracker
│   ├── expenses.js     # Expense tracker
│   ├── study.js        # Japanese study tracker
│   ├── jlpt.js         # JLPT prep tracker
│   ├── tasks.js        # Task manager
│   └── dashboard.js    # Dashboard + calendar
└── assets/             # Static assets
```

## Features
- 🔐 Supabase Authentication (email/password + Google)
- 📚 School Schedule (weekly timetable + list view)
- 💼 Part-Time Job Manager (shift tracking + salary calculation)
- 💴 Expense Tracker (8 categories + charts)
- 📖 Japanese Study Tracker (6 categories + streak)
- 🏆 JLPT Preparation (N1-N5, countdown, progress)
- ✅ Task Manager (priority, categories, due dates)
- 📅 Unified Calendar (month/week/day views)
- 📊 Analytics Charts (Chart.js)
- 🌙 Dark Mode (system preference)
- 📱 Fully Responsive
