-- Shift logs per brand (the LOGS tab): opening log, closing log and incident report.
-- Everyone sees the logs of their own brands; only manager / chef / gm / admin roles can write them (enforced in src/routes/logs.ts).
-- `details` is a JSON object whose keys depend on `type` (validated server-side).
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('opening', 'closing', 'incident')),
  log_date TEXT NOT NULL,          -- business day 'YYYY-MM-DD'
  title TEXT NOT NULL DEFAULT '',  -- incident title; empty for opening / closing (shown as "<type> — <brand>")
  details TEXT NOT NULL DEFAULT '{}',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_brand_date ON logs (brand_id, log_date);
