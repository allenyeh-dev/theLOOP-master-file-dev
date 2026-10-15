-- Each "push" of an event announcement: notifies the brand's staff and asks them to
-- acknowledge it in-app. Re-pushing an event creates a new row, so everyone is asked again.
CREATE TABLE IF NOT EXISTS happening_pushes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  happening_id INTEGER NOT NULL REFERENCES brand_happenings(id) ON DELETE CASCADE,
  sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_happening_pushes_happening_id ON happening_pushes(happening_id);

CREATE TABLE IF NOT EXISTS happening_push_acks (
  push_id INTEGER NOT NULL REFERENCES happening_pushes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acked_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (push_id, user_id)
);
