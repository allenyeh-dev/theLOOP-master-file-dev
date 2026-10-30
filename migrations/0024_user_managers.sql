-- Who each person's SOPs are submitted to. One manager per person; no row = falls back to an admin.
CREATE TABLE IF NOT EXISTS user_managers (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (user_id != manager_id)
);
CREATE INDEX IF NOT EXISTS idx_user_managers_manager_id ON user_managers(manager_id);

-- A step assigned to a specific person (manager route). NULL = any holder of role_id, as before.
ALTER TABLE sop_approvals ADD COLUMN assignee_id INTEGER REFERENCES users(id);
