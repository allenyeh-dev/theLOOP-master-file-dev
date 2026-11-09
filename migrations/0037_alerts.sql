-- Service alerts (T1-T3) are written into `logs` as incident reports; the admin chooses from which tier up they notify.
-- Emergency alerts (the red triangle next to the avatar) are stored here and notify Admin + Executive only.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- 'T1' | 'T2' | 'T3' = lowest tier that sends a notification; 'off' = never notify.
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('service_alert_min_tier', 'T3');

CREATE TABLE IF NOT EXISTS emergency_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER REFERENCES brands(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('fire', 'medical', 'security', 'facility')),
  notes TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_emergency_open ON emergency_alerts (resolved_at);
