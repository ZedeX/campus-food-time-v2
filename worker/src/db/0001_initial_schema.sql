-- Migration: 0001_initial_schema.sql
-- Campus Food Time - Initial Database Schema
-- All business data in D1 (SQLite)

-- Users table (teachers, parents, admin)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('teacher', 'parent', 'admin')),
  phone TEXT UNIQUE,
  password TEXT NOT NULL, -- reversible encryption
  name TEXT NOT NULL,
  school_id INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_type ON users(type);

-- Sessions table (single device login, sliding expiry)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, -- session UUID
  user_id TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE, -- JWT or UUID
  expires_at TEXT NOT NULL,
  last_accessed TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Classes table (auxiliary info for parent/student identity, not linked to recipes)
CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY, -- format: class:<school_id>:<grade>:<class_number>
  name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  class_number INTEGER NOT NULL,
  school_id INTEGER NOT NULL DEFAULT 1,
  visible INTEGER DEFAULT 1, -- boolean: 1=visible, 0=hidden
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id)
);
CREATE INDEX IF NOT EXISTS idx_classes_school ON classes(school_id);

-- Students table (for parent registration verification)
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  class_id TEXT NOT NULL,
  school_id INTEGER NOT NULL DEFAULT 1,
  id_number TEXT, -- full ID number, nullable
  id_prefix TEXT, -- first 3 digits (for verification)
  id_suffix TEXT, -- last 4 digits (for verification)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (class_id) REFERENCES classes(id),
  FOREIGN KEY (school_id) REFERENCES schools(id)
);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_name_class ON students(name, class_id);

-- Parent-Student relations table (many-to-many)
CREATE TABLE IF NOT EXISTS parent_student_relations (
  id TEXT PRIMARY KEY,
  parent_user_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  relation TEXT, -- e.g. "父亲", "母亲"
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(parent_user_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_relations_parent ON parent_student_relations(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_relations_student ON parent_student_relations(student_id);

-- Daily recipes table
CREATE TABLE IF NOT EXISTS daily_recipes (
  id TEXT PRIMARY KEY, -- format: daily_<school_id>_<date>
  date TEXT NOT NULL, -- YYYY-MM-DD (Beijing date)
  school_id INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE(school_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_recipes(date);
CREATE INDEX IF NOT EXISTS idx_daily_school ON daily_recipes(school_id);

-- Weekly recipes table
CREATE TABLE IF NOT EXISTS weekly_recipes (
  id TEXT PRIMARY KEY, -- format: weekly_<school_id>_<yearWeek>
  year_week TEXT NOT NULL, -- YYYY-WNN (ISO 8601)
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  start_date TEXT NOT NULL, -- Monday date
  end_date TEXT NOT NULL, -- Sunday date
  school_id INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  UNIQUE(school_id, year_week)
);
CREATE INDEX IF NOT EXISTS idx_weekly_year_week ON weekly_recipes(year_week);
CREATE INDEX IF NOT EXISTS idx_weekly_school ON weekly_recipes(school_id);

-- Recipe media table (images and videos)
CREATE TABLE IF NOT EXISTS recipe_media (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  recipe_type TEXT NOT NULL CHECK(recipe_type IN ('daily', 'weekly')),
  media_type TEXT NOT NULL CHECK(media_type IN ('image', 'video')),
  dish_name TEXT, -- required for daily images, used for statistics
  title TEXT,
  r2_key TEXT NOT NULL, -- R2 object key (not public URL)
  filename TEXT NOT NULL, -- display filename
  order_num INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (recipe_id) REFERENCES daily_recipes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_media_recipe ON recipe_media(recipe_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON recipe_media(recipe_type, media_type);

-- Recipe snapshots table (version history)
CREATE TABLE IF NOT EXISTS recipe_snapshots (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  recipe_type TEXT NOT NULL CHECK(recipe_type IN ('daily', 'weekly')),
  version INTEGER NOT NULL,
  snapshot_data TEXT NOT NULL, -- JSON of full recipe state
  is_pinned INTEGER DEFAULT 0, -- admin-pinned versions are always kept
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES daily_recipes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_snapshots_recipe ON recipe_snapshots(recipe_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_version ON recipe_snapshots(recipe_id, version);

-- Semesters table
CREATE TABLE IF NOT EXISTS semesters (
  id TEXT PRIMARY KEY, -- format: YYYY-YYYY-N
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER DEFAULT 0,
  school_id INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (school_id) REFERENCES schools(id)
);
CREATE INDEX IF NOT EXISTS idx_semesters_school ON semesters(school_id);
CREATE INDEX IF NOT EXISTS idx_semesters_active ON semesters(is_active);

-- Operation logs table (INSERT only, no UPDATE/DELETE)
CREATE TABLE IF NOT EXISTS operation_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_type TEXT NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  result TEXT NOT NULL DEFAULT 'success',
  details TEXT, -- JSON additional info
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_user ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_type ON operation_logs(user_type);
CREATE INDEX IF NOT EXISTS idx_logs_action ON operation_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_created ON operation_logs(created_at);

-- System config table (key-value)
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dish aliases table (for statistics normalization)
CREATE TABLE IF NOT EXISTS dish_aliases (
  id TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  alias_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(alias_name)
);
CREATE INDEX IF NOT EXISTS idx_aliases_canonical ON dish_aliases(canonical_name);

-- Archives table (semester data archives)
CREATE TABLE IF NOT EXISTS archives (
  id TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL,
  semester_name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  school_id INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing', 'completed', 'failed')),
  metadata_url TEXT, -- JSON metadata file R2 key
  media_zip_url TEXT, -- media ZIP file R2 key
  file_size INTEGER DEFAULT 0,
  recipe_count_daily INTEGER DEFAULT 0,
  recipe_count_weekly INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT NOT NULL,
  FOREIGN KEY (semester_id) REFERENCES semesters(id),
  FOREIGN KEY (school_id) REFERENCES schools(id)
);
CREATE INDEX IF NOT EXISTS idx_archives_semester ON archives(semester_id);
