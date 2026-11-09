-- Task to-do list per brand (the TASKS tab). Any member of the brand can add, tick, and delete tasks.
-- A task is "done" when completed_at is set; done tasks stay listed until deleted one by one or cleared together.
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'med' CHECK (priority IN ('high', 'med', 'low')),
  due_date TEXT,             -- 'YYYY-MM-DD', optional
  due_time TEXT,             -- 'HH:MM', optional
  assigned_to TEXT NOT NULL DEFAULT '', -- free text: people or a team ("Marcus, Sarah", "Bar team")
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,         -- UTC, NULL while open
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_brand ON tasks (brand_id, completed_at);
