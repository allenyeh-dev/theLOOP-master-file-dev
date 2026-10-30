-- Small per-account settings (e.g. which language column the SOP form shows).
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);
