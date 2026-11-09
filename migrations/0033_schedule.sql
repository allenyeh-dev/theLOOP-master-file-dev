-- Staff schedule per brand (the SCHEDULE tab). A shift is one person on one date; end_time <= start_time means it runs past midnight.
-- Staff only see a day once a manager (schedule.manage) has published it; a row in schedule_publish marks the day as published.
CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_date TEXT NOT NULL,   -- 'YYYY-MM-DD'
  start_time TEXT NOT NULL,   -- 'HH:MM'
  end_time TEXT NOT NULL,     -- 'HH:MM'
  position TEXT NOT NULL DEFAULT 'FOH',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shifts_brand_date ON shifts (brand_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON shifts (user_id, shift_date);

CREATE TABLE IF NOT EXISTS schedule_publish (
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  shift_date TEXT NOT NULL,
  published_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (brand_id, shift_date)
);
